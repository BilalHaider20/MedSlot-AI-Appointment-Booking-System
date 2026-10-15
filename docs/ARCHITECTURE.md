# Architecture

Medslot is a small multi-tenant booking product. A signed-in customer of a business
(our demo tenant is **Harbor Street Physio**) can book an appointment by chatting
with an assistant, or by filling in a plain form. Both paths end in the same
appointments service.

```
client/ (React + Vite)  ──HTTP /api──▶  server/ (Express)  ──SQL──▶  PostgreSQL
                                           │
                                           └──HTTPS──▶  Mistral API (optional)
```

## Repo layout

```
client/                 React app (Vite, TypeScript)
server/                 Express API (TypeScript, run with tsx)
  db/schema.sql         DDL, indexes, constraints
  db/seed.sql           sample business, services, users, appointments
  db/NOTES.md           indexing + performance notes
  src/
    index.ts            starts the HTTP server
    app.ts              builds the express app (middleware + routes)
    config.ts           reads env once, validated with zod
    db.ts               pg Pool + small query helper + withTransaction
    lib/                httpError, time helpers, logger
    middleware/         auth, validate, rateLimit, errorHandler
    modules/
      auth/             routes, service, schemas
      services/         list bookable services (catalog)
      appointments/     routes, service, repository, schemas, availability
      chat/             routes, service (conversation state machine), repository
      ai/               mistral client, rules extractor, extract() facade, ai log
docs/                   this file, DESIGN.md, API.md
```

Each module follows the same shape: `*.routes.ts` (HTTP only: parse, call service,
send), `*.service.ts` (business rules, no req/res), `*.repository.ts` (SQL only).
Routes never touch SQL; services never touch `req`.

## Key decisions

| Decision | Why |
| --- | --- |
| Raw SQL with `pg`, no ORM | The schema is a deliverable. Writing the SQL keeps constraints and indexes visible. |
| JWT in an httpOnly cookie (`ms_token`), also accepts `Authorization: Bearer` | Token is not readable by JS (XSS). SameSite=Lax + JSON-only bodies covers CSRF for this scope. Bearer kept for curl/tests. |
| Request/response chat + polling (`GET ...messages?after=`) every 4s | One user talking to one bot. A request/response round trip is the real-time path; polling keeps other tabs in sync. WebSockets would add infra with no user-visible gain here. |
| AI only extracts fields. Code decides what happens next. | The model never books, never invents slots, never writes the reply about availability. Business rules stay testable and deterministic. |
| Rules-based extractor as fallback | Works without an API key, on timeouts, and when the model returns invalid JSON. Same output shape. |
| Double booking prevented in the database | `EXCLUDE USING gist` on `(business_id, tstzrange(starts_at, ends_at))` for active appointments. The app also checks, but the DB is the source of truth under concurrency. |
| Times stored as `timestamptz`, shown in the business timezone | A business has one timezone. Slots are generated in that zone with luxon. |
| Single-business demo, schema is multi-tenant | Every row carries `business_id`; every query filters by the `businessId` in the JWT. Signup attaches users to `DEFAULT_BUSINESS_SLUG`. |

## Data model (summary, full DDL in server/db/schema.sql)

- `businesses` id, name, slug (unique), timezone, open_time, close_time, open_days (int[] ISO weekdays), slot_minutes
- `users` id, business_id, email (citext, unique per business), password_hash, full_name, phone, role ('customer'|'staff'|'admin'), created_at
- `services` id, business_id, name, duration_minutes, price_cents, active
- `appointments` id, business_id, user_id, service_id, starts_at, ends_at, status ('booked'|'cancelled'|'completed'), notes, source ('chat'|'form'), chat_session_id null, created_at, updated_at, cancelled_at
- `chat_sessions` id, business_id, user_id, title, state jsonb (booking draft + step), status ('open'|'closed'), last_message_at, created_at
- `chat_messages` id bigserial, session_id, role ('user'|'assistant'|'system'), content, meta jsonb (ui hints), created_at
- `ai_interactions` id bigserial, business_id, session_id, provider ('mistral'|'rules'), model, latency_ms, request jsonb, response jsonb, parsed jsonb, error text, created_at

All ids are `uuid` (gen_random_uuid()) except message/log ids which are `bigserial` so
`?after=<id>` polling is a cheap index range scan.

## API contract

Base path `/api`. JSON in and out. Errors are always:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Human readable", "details": [] } }
```

Codes: `VALIDATION_ERROR` 400, `UNAUTHORIZED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404,
`CONFLICT` 409 (email taken, slot taken), `RATE_LIMITED` 429, `INTERNAL` 500.

Dates: `date` is `YYYY-MM-DD` in business timezone, `time` is `HH:mm` 24h,
`startsAt`/`endsAt` are ISO 8601 UTC strings. Field names are camelCase in JSON.

### Auth
| Method | Path | Body | Response |
| --- | --- | --- | --- |
| POST | /auth/signup | `{ fullName, email, password (min 8) }` | 201 `{ user }` + sets cookie |
| POST | /auth/login | `{ email, password }` | 200 `{ user }` + sets cookie |
| POST | /auth/logout | - | 204, clears cookie |
| GET | /auth/me | - | 200 `{ user }` or 401 |

`user = { id, fullName, email, role, business: { id, name, timezone } }`

### Catalog and availability (auth required)
| Method | Path | Response |
| --- | --- | --- |
| GET | /services | `{ services: [{ id, name, durationMinutes, priceCents }] }` |
| GET | /availability?serviceId=&date= | `{ date, timezone, slots: ["09:00","09:30",...] }` (past slots and taken slots removed) |

### Appointments (auth required, always scoped to current user)
| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | /appointments?scope=upcoming\|past | - | `{ appointments: [Appointment] }` |
| POST | /appointments | `{ serviceId, date, time, notes? }` | 201 `{ appointment }`, 409 if slot taken |
| POST | /appointments/:id/cancel | - | 200 `{ appointment }` |

`Appointment = { id, service: { id, name, durationMinutes }, startsAt, endsAt, status, notes, source, createdAt }`

### Chat (auth required)
| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | /chat/sessions | - | `{ sessions: [{ id, title, status, lastMessageAt }] }` |
| POST | /chat/sessions | - | 201 `{ session, messages }` (session starts with a greeting) |
| GET | /chat/sessions/:id/messages?after= | - | `{ messages: [Message], session }` |
| POST | /chat/sessions/:id/messages | `{ content (1..1000) }` | 201 `{ messages: [userMsg, assistantMsg], session }` |
| POST | /chat/sessions/:id/confirm | - | 201 `{ messages: [assistantMsg], session, appointment }` |

`Message = { id (string of bigint), role, content, meta, createdAt }`
`session = { id, title, status, state }`

`meta.ui` tells the client what to render under an assistant message:

```ts
type Ui =
  | { type: 'slots'; date: string; serviceId: string; slots: string[] }  // quick-pick chips
  | { type: 'services'; services: { id: string; name: string }[] }     // quick-pick chips
  | { type: 'confirm'; draft: Draft }                                   // summary card + Confirm / Change
  | { type: 'form'; draft: Partial<Draft>; reason: string }             // structured form fallback
  | { type: 'booked'; appointmentId: string }
```

`Draft = { serviceId, serviceName, date, time, notes? }`

## Conversation flow (server/src/modules/chat/chat.service.ts)

1. Save the user message.
2. `ai.extract({ history (last 10 messages), draft, services, today, timezone })`
   returns `{ intent, serviceName?, date?, time?, notes?, confidence }`.
   Intents: `book`, `availability`, `list_appointments`, `cancel`, `confirm`, `deny`, `smalltalk`, `unknown`.
3. Merge extracted fields into `session.state.draft`. Map `serviceName` to a real
   service (case-insensitive contains match). Unknown names are dropped, not trusted.
4. Decide the next step in code:
   - service missing -> ask, ui `services`
   - date missing -> ask for day
   - date in the past / closed day -> say so, offer next open day
   - time missing or slot taken -> list free slots for that day, ui `slots`
   - everything valid -> ui `confirm`
   - `confirm` intent while awaiting confirmation -> book via appointments service
   - `list_appointments` -> short text summary of upcoming appointments
   - `cancel` -> point to the appointments panel (cancel is a button, not chat, to avoid wrong cancellations)
5. If the turn made no progress twice in a row (`state.misses >= 2`), or extraction
   failed, reply with ui `form` prefilled with whatever we have.
6. Save the assistant message with `meta.ui`, update `state`, bump `last_message_at`.

Replies are short templates written in plain language. The model does not write them.

## AI service (server/src/modules/ai)

- `mistral.client.ts` fetch to `https://api.mistral.ai/v1/chat/completions`,
  model from env (`open-mistral-nemo` by default), `temperature: 0`,
  `response_format: { type: 'json_object' }`, 8s timeout via AbortController.
- `rules.extractor.ts` regex/keyword extractor (service names, today/tomorrow/weekday
  names/`12 May`/`2026-05-12`, `3pm`/`15:00`/`half past 3`, yes/no words).
- `extract.ts` uses Mistral when `MISTRAL_API_KEY` is set, validates the JSON with zod,
  falls back to rules on any error. Every call (either provider) is written to
  `ai_interactions` and logged with pino (provider, latency, intent, error).
- User text is passed as message content only, never concatenated into the system prompt.
  Input capped at 1000 chars. Output is validated; anything outside the schema is ignored.

## Middleware order (app.ts)

`helmet` -> `cors` (only CLIENT_ORIGIN, credentials) -> `express.json({ limit: '20kb' })`
-> `cookie-parser` -> `pino-http` request logger (redacts cookie/authorization)
-> global rate limit (300 / 15 min / IP) -> routes (auth routes add 20 / 15 min,
chat message route adds 20 / min per user) -> 404 -> error handler.

## Running

```
cp server/.env.example server/.env   # set DATABASE_URL, JWT_SECRET, optional MISTRAL_API_KEY
npm run db:setup                     # creates DB, schema, seed
npm run dev                          # server :4000, client :5173 (proxy /api -> 4000)
```
