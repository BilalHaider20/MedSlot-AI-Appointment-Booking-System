-- Bookwell schema. Safe to re-run: drops everything it owns first.
-- Run via `npm run db:setup`, which also loads seed.sql.

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;     -- case-insensitive email
CREATE EXTENSION IF NOT EXISTS btree_gist; -- "business_id WITH =" inside the gist exclusion constraint

DROP TABLE IF EXISTS ai_interactions, chat_messages, appointments, chat_sessions, services, users, businesses CASCADE;
DROP FUNCTION IF EXISTS set_updated_at();

CREATE TABLE businesses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  slug         text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  timezone     text NOT NULL,                  -- IANA name, validated by the app (luxon)
  open_time    time NOT NULL,
  close_time   time NOT NULL,
  open_days    integer[] NOT NULL,             -- ISO weekdays, 1 = Monday
  slot_minutes integer NOT NULL DEFAULT 30,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (close_time > open_time),
  CHECK (cardinality(open_days) > 0 AND open_days <@ ARRAY[1, 2, 3, 4, 5, 6, 7]),
  CHECK (slot_minutes BETWEEN 5 AND 240)
);

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  email         citext NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
  password_hash text NOT NULL,
  full_name     text NOT NULL CHECK (length(full_name) BETWEEN 1 AND 100),
  phone         text CHECK (length(phone) <= 32),
  role          text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'staff', 'admin')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- Also the index for login: WHERE business_id = $1 AND email = $2.
  CONSTRAINT users_business_email_key UNIQUE (business_id, email),
  -- Target for composite FKs so child rows can't point at another tenant's user.
  CONSTRAINT users_id_business_key UNIQUE (id, business_id)
);

CREATE TABLE services (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  name             text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 480),
  price_cents      integer NOT NULL CHECK (price_cents >= 0),
  active           boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  -- Also serves the catalog listing: WHERE business_id = $1 ORDER BY name.
  CONSTRAINT services_business_name_key UNIQUE (business_id, name),
  CONSTRAINT services_id_business_key UNIQUE (id, business_id)
);

CREATE TABLE chat_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  user_id         uuid NOT NULL,
  title           text NOT NULL DEFAULT 'New conversation' CHECK (length(title) <= 120),
  state           jsonb NOT NULL DEFAULT '{}'::jsonb,
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  -- A conversation is the user's own data: it goes with them.
  FOREIGN KEY (user_id, business_id) REFERENCES users (id, business_id) ON DELETE CASCADE
);

CREATE TABLE appointments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  user_id         uuid NOT NULL,
  service_id      uuid NOT NULL,
  starts_at       timestamptz NOT NULL,
  ends_at         timestamptz NOT NULL,
  status          text NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'cancelled', 'completed')),
  notes           text CHECK (length(notes) <= 500),
  source          text NOT NULL CHECK (source IN ('chat', 'form')),
  chat_session_id uuid REFERENCES chat_sessions (id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  cancelled_at    timestamptz,
  CHECK (ends_at > starts_at),
  CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL)),
  -- NO ACTION (not RESTRICT) on purpose: deleting a user or service that has
  -- bookings fails, but deleting a whole business still cascades, because
  -- NO ACTION is checked at the end of the statement, after the cascade ran.
  -- Retire services with active = false instead of deleting them.
  FOREIGN KEY (user_id, business_id) REFERENCES users (id, business_id),
  FOREIGN KEY (service_id, business_id) REFERENCES services (id, business_id),
  -- The real double-booking guard. One room, one practitioner per business for
  -- now; per-resource booking would add resource_id to this constraint.
  CONSTRAINT appointments_no_overlap EXCLUDE USING gist (
    business_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (status = 'booked')
);

CREATE TABLE chat_messages (
  id         bigserial PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES chat_sessions (id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content    text NOT NULL CHECK (length(content) BETWEEN 1 AND 4000),
  meta       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ai_interactions (
  id          bigserial PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  -- Requests contain the user's words, so they go when the conversation goes.
  session_id  uuid REFERENCES chat_sessions (id) ON DELETE CASCADE,
  provider    text NOT NULL CHECK (provider IN ('mistral', 'rules')),
  model       text,
  latency_ms  integer NOT NULL CHECK (latency_ms >= 0),
  request     jsonb NOT NULL,
  response    jsonb,
  parsed      jsonb,
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER appointments_set_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Indexes. Constraint-backed ones (PKs, UNIQUEs, the exclusion constraint) are not repeated here.

-- "Your appointments" upcoming/past tabs: WHERE business_id AND user_id, ORDER BY starts_at.
CREATE INDEX appointments_user_starts_idx ON appointments (business_id, user_id, starts_at);

-- Availability: booked appointments of one business that touch a given day.
-- Partial, so cancelled/completed history never bloats it.
CREATE INDEX appointments_booked_starts_idx ON appointments (business_id, starts_at) WHERE status = 'booked';

-- Keeps ON DELETE SET NULL from chat_sessions off a sequential scan.
CREATE INDEX appointments_chat_session_idx ON appointments (chat_session_id) WHERE chat_session_id IS NOT NULL;

-- Session list in the sidebar: WHERE user_id ORDER BY last_message_at DESC.
CREATE INDEX chat_sessions_user_recent_idx ON chat_sessions (user_id, last_message_at DESC);

-- Polling: WHERE session_id = $1 AND id > $after ORDER BY id. Also "last 10 messages" for the AI.
CREATE INDEX chat_messages_session_id_idx ON chat_messages (session_id, id);

-- Debugging one conversation's AI calls in order; also used by the cascade delete.
CREATE INDEX ai_interactions_session_created_idx ON ai_interactions (session_id, created_at);

-- Retention job: DELETE ... WHERE created_at < now() - interval '90 days'. BRIN fits append-only rows.
CREATE INDEX ai_interactions_created_brin ON ai_interactions USING brin (created_at);
