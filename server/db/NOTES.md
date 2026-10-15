# Database notes

Postgres 16. Raw SQL, no ORM. `schema.sql` is the source of truth; `npm run db:setup`
drops and recreates the database, then loads `schema.sql` and `seed.sql`.

## Multi-tenancy

- Every tenant-owned table has `business_id`, and every query filters on the
  `businessId` taken from the JWT, never from the request body.
- Composite FKs (`(user_id, business_id) -> users (id, business_id)`, same for
  services) make it impossible for an appointment or chat session to point at
  another tenant's user or service, even if app code gets it wrong.
- Later, row level security can enforce the same rule in the database: set
  `app.business_id` per transaction (`SET LOCAL`), enable RLS on each table
  with `USING (business_id = current_setting('app.business_id')::uuid)`, and
  connect as a role without `BYPASSRLS`. The composite indexes already lead with
  `business_id`, so the extra predicate costs nothing.

## Indexes and the queries they serve

| Index | Query |
| --- | --- |
| `users_business_email_key` (unique) | login: `business_id = $1 AND email = $2` (citext, so case-insensitive) |
| `services_business_name_key` (unique) | catalog: active services of a business, by name |
| `appointments_user_starts_idx (business_id, user_id, starts_at)` | "Your appointments" upcoming / past tabs, ordered by start |
| `appointments_booked_starts_idx (business_id, starts_at) WHERE status = 'booked'` | availability: booked rows touching a day or a two-week window |
| `appointments_no_overlap` (gist, from the exclusion constraint) | double-booking check on insert/update; could also serve `tstzrange && tstzrange` lookups |
| `appointments_chat_session_idx` (partial) | `ON DELETE SET NULL` from chat_sessions without a seq scan |
| `chat_sessions_user_recent_idx (user_id, last_message_at DESC)` | sidebar list of conversations |
| `chat_messages_session_id_idx (session_id, id)` | polling `id > $after ORDER BY id`, and "last 10 messages" for the extractor |
| `ai_interactions_session_created_idx (session_id, created_at)` | debugging one conversation; cascade deletes |
| `ai_interactions_created_brin` (BRIN) | retention deletes by age; tiny for append-only data |

The availability index is partial on `status = 'booked'`. Past bookings turn into
`completed` (eventually by a nightly job; seed data does it by hand), so the index
mostly holds future rows and stays small no matter how much history piles up.

## Double booking

`EXCLUDE USING gist (business_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&)
WHERE (status = 'booked')`. The app checks free slots first for a friendly error,
but under concurrency the constraint is what holds. `[)` means back-to-back
appointments (10:00-10:45, 10:45-11:30) are fine. A violation is SQLSTATE `23P01`,
mapped to `409 CONFLICT`.

Cost: every insert, and every update that touches the range or status, probes the
gist index. That is fine at clinic scale (tens of bookings a day). Cancelling sets
`status = 'cancelled'`, which takes the row out of the constraint, so the slot frees
up immediately. Per-practitioner or per-room booking would add `resource_id WITH =`.

## Chat polling

`chat_messages.id` is a `bigserial`, so `GET ...messages?after=<id>` is a range scan
on `(session_id, id)`. Ids are allocated at insert time, not commit time, so two
concurrent transactions could commit out of order and a poller could skip the lower
id. In this app one session has one writer (its user's request, then the assistant
reply in a transaction), so that does not happen in practice. If several writers
ever share a session, poll with a small overlap (`id > after - N`) and dedupe on
the client, or switch to a per-session sequence number assigned under a row lock.

## ai_interactions growth

One row per extraction attempt (two when Mistral fails and rules take over), with
the prompt and response as jsonb. That is the fastest growing table and it holds
user text, so:

- Retention: delete rows older than 90 days in a nightly job (BRIN index on
  `created_at` keeps that cheap). Rows also cascade away with their chat session.
- At volume, partition by month on `created_at` (`PARTITION BY RANGE`) so
  retention becomes `DROP TABLE` of an old partition instead of a big delete,
  and vacuum stays cheap. Move the PK to `(id, created_at)` when doing this.
- If only metrics are needed long term, keep provider/latency/intent/error and
  null out `request` / `response` after a week.

## Connection pooling

`pg.Pool` with `max: 10` per API process. Chat turns call Mistral (up to 8s)
outside any transaction, so a slow model never holds a connection; only the final
"insert assistant message + update session" step runs in a transaction. With
several API instances, put PgBouncer (transaction mode) in front and keep each
pool small; nothing here relies on session-level state (`SET LOCAL` for RLS
works in transaction mode).

## Auth lookups

`requireAuth` reads `password_changed_at` by primary key on every authenticated
request (sub-millisecond, always cached) so a password change ends older sessions.
If that ever shows up in profiles, cache it per user for a few seconds or move to
short-lived access tokens with refresh tokens. Password reset tokens are stored
as sha256 hashes (`UNIQUE`, which is also the lookup index), and a partial index
on open tokens per user keeps "revoke the older links" cheap.

## Smaller decisions

- `citext` for email instead of `lower(email)` everywhere; uniqueness is per business.
- Status and role enums are `text` + `CHECK`, not Postgres enums, so adding a value
  is a plain migration instead of `ALTER TYPE`.
- `CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL))` keeps the two in sync.
- Deleting a user or service with bookings is blocked (FKs default to NO ACTION),
  but deleting a business cascades, because NO ACTION is checked at the end of
  the statement, after the cascade has removed the appointments. Services are
  retired with `active = false`.
- `updated_at` is maintained by a trigger on appointments so no code path can forget it.
