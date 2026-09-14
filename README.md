# TaskFlow — Real-Time Client Project Dashboard

A full-stack internal tool for a small agency to manage client projects, assign
tasks, and watch team activity update live, with three strictly separated
access levels (Admin / Project Manager / Developer) enforced at the API layer.

## Live Links

- **App**: https://task-flow-six-xi.vercel.app/
- **API**: https://taskflow-atga.onrender.com/
- **Repo**: https://github.com/swaraj1917/TaskFlow

The backend is on Render's free tier, which spins down after 15 minutes of
inactivity — if the app hasn't been visited recently, the first request can
take 30–50 seconds to respond while it wakes back up. That's expected, not a
bug; every request after that first one is normal speed.

---

## Stack

| Layer      | Choice                                   |
|------------|-------------------------------------------|
| Frontend   | React 19 + TypeScript (Vite)              |
| Backend    | Node.js + Express 5 + TypeScript          |
| Database   | PostgreSQL (Neon in production; local Postgres via Docker for dev) |
| ORM        | Prisma                                    |
| Real-time  | Socket.io                                 |
| Background jobs | node-cron                           |
| Auth       | JWT access token + HttpOnly refresh cookie|
| Validation | Zod (server-side, on every input)         |

---

## 1. Local Setup

### Option A — Docker (preferred, one command)

Requires Docker and Docker Compose.

```bash
git clone <your-repo-url>
cd TaskFlow
docker compose up --build
```

This starts three containers: `postgres`, `server` (port 5000), and `client`
(port 5173, served via nginx). The server container automatically runs
`prisma migrate deploy` on boot.

Once it's up, seed the database (only needs to be done once, from your host
machine, since seeding needs dev dependencies not present in the production
image):

```bash
cd server
npm install
npx prisma db seed
```

Then open **http://localhost:5173**.

### Option B — Manual (for active development)

```bash
# 1. Start Postgres only
docker compose up postgres -d

# 2. Backend
cd server
cp .env.example .env    # defaults already match the docker-compose Postgres
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev              # http://localhost:5000

# 3. Frontend (new terminal)
cd client
cp .env.example .env
npm install
npm run dev               # http://localhost:5173
```

### Demo accounts (all use password `password123`)

| Role            | Email               |
|-----------------|----------------------|
| Admin           | admin@taskflow.com  |
| Project Manager | pm1@taskflow.com / pm2@taskflow.com |
| Developer       | dev1@taskflow.com … dev4@taskflow.com |

These are the seeded accounts for demoing the app immediately. Beyond them,
Admin can create additional real accounts (with any name, email, password,
and role) from the **Users** tab — see below.

---

## User Management

Admin has a **Users** panel (name/email/password/role → create; role-based
tabs to browse Admin/PM/Developer separately) for onboarding real team
members. There's deliberately **no public self-registration UI** — this is
an internal agency tool, not a consumer product, so accounts should only
exist because an Admin created them. A `POST /api/auth/register` endpoint
does still exist for completeness, but it always hardcodes new signups to
the lowest-privilege `DEVELOPER` role regardless of what's sent in the
request — self-assigned roles (letting a new signup pick "Admin") would be a
real privilege-escalation hole, not a convenience, so role assignment is an
Admin-only action, gated the same way every other admin route is.

---

## 2. Database Schema

```
User (id, name, email, passwordHash, role[ADMIN|PROJECT_MANAGER|DEVELOPER])
 ├─< Project (createdById → User)     "projects this user created (PM/Admin)"
 ├─< Task (assignedDeveloperId → User) "tasks assigned to this developer"
 ├─< TaskActivity                      "status changes this user made"
 ├─< Notification
 └─< RefreshToken

Client (id, name, email, company)
 └─< Project (clientId → Client)

Project (id, name, description, clientId, createdById)
 └─< Task (id, title, description, status, priority, dueDate, isOverdue,
           projectId, assignedDeveloperId)
      └─< TaskActivity (fromStatus, toStatus, userId, createdAt)

Notification (id, userId, message, read, createdAt)
RefreshToken (id, tokenHash, userId, expiresAt)
```

`TaskActivity` is an append-only log — every status change is a new row with
a timestamp and the acting user, never overwritten or derived at read time.

### Indexing decisions

| Index | Reason |
|---|---|
| `Project.clientId`, `Project.createdById` | Every project list is filtered by owner (PM) or client |
| `Task([projectId, status])` | Task boards filter by project + status constantly (compound, status-filtered project view) |
| `Task([assignedDeveloperId, status])` | Developer dashboards filter "my tasks by status" — same pattern, different leading key |
| `Task.dueDate` | The overdue cron job scans by due date every run; date-range filters use it too |
| `Task.priority` | Every dashboard sorts/filters by priority |
| `TaskActivity([projectId, createdAt])` | Per-project activity feed always orders by recency |
| `Notification([userId, read, createdAt])` | Notification dropdown query is exactly this triple — unread-first, most recent, for one user |
| `RefreshToken.userId`, `RefreshToken.expiresAt` | Token lookup on refresh, and the (implied) cleanup of expired tokens |

---

## 3. Architectural Decisions

### Why Socket.io over a raw WebSocket

Native `ws` would work, but Socket.io gives three things this app leans on
directly: **room-based broadcast** (`socket.join`/`.to()`), which is how the
per-project live view and the role-scoped global feed are implemented without
hand-rolling a subscriber registry; **automatic reconnection**, so a
flaky connection doesn't silently stop delivering live updates; and a
**built-in auth handshake** (`socket.handshake.auth`) that fits neatly with
verifying the same JWT used for REST calls, without a second auth scheme.

### The real-time role-filtered activity feed

This was the core design problem: three roles need three different slices of
the *same* stream of task-status-change events, live, without re-querying the
database on every socket message.

The approach is **targeted room emission** instead of broadcast-then-filter:
every task status update writes one `TaskActivity` row, then the server emits
it to exactly the rooms that are allowed to see it —

- `activity:admin` — every connected Admin socket joins this room on connect
- `user:<pmId>` — the Project Manager who owns the project (their personal room, joined by every socket on connect)
- `user:<developerId>` — the Developer the task is assigned to

A socket only receives an event if it's sitting in one of those rooms, so
there's no client-side filtering of a firehose — the server decides who sees
what, the same way the REST endpoints do. The person currently *looking* at a
project page also gets it via a separate `project:<id>` room (joined
explicitly via `join-project`) and `task-status-updated`, which drives the
per-project live list independent of the dashboard feed.

For the "missed 20 events while offline" requirement, the feed is never held
in server memory — `GET /activities/recent` re-derives the same role scoping
directly from Postgres (`TaskActivity` + a join on `Task`/`Project`), so a
returning user's first load and a live socket update use the same shape and
the same access rules.

### Why node-cron over a job queue (Bull)

The only background job here is a single periodic sweep — "find tasks past
their due date, flag them" — with no need for job priorities, retries,
distributed workers, or a dashboard. Bull (and its Redis dependency) is the
right tool when jobs are queued dynamically from application code with
per-job state; this is a fixed interval scan, which is exactly what
`node-cron` is for, without adding Redis as an infrastructure dependency for
one job.

### Why the refresh token lives in an HttpOnly cookie, not localStorage

The access token (15 min TTL) is kept in memory only (a module-level variable
in `api.ts`), never persisted — a page refresh clears it, at which point
`AuthContext` calls `/auth/refresh` on mount to get a new one. The refresh
token (7 days) is the one that must survive across sessions, so it's set as
an `HttpOnly`, `SameSite=Lax` cookie: JavaScript can never read it, which
closes off the classic XSS-steals-the-token-from-localStorage path. Refresh
tokens are also stored hashed (SHA-256) in the database and rotated on every
use (old one deleted, new one issued) — so a leaked *old* token is worthless
even if the cookie itself were somehow exfiltrated.

The `api.ts` axios client wraps this with a transparent refresh-and-retry
interceptor: any request that comes back `401` triggers one `/auth/refresh`
call, and the original request is retried once with the new token — so the
15-minute expiry never surfaces to the user as a random logout, only an
actually-expired refresh token does.

### Why Express over Fastify

Express 5 (used here) forwards rejected promises from async route handlers to
error-handling middleware automatically, closing Fastify's main historical
advantage for this use case. Express's ecosystem maturity around exactly the
middleware this app needs — `cookie-parser`, `cors`, and Socket.io's own
Express-based examples — made it the lower-friction choice for a project this
size, where raw request throughput was never the constraint.

---

## 4. Known Limitations

- **Online-user presence** is tracked in a server-side `Set` in
  `socket.ts`. It's correct for a single server process, but would need to
  move to Redis (or Socket.io's Redis adapter) to stay accurate across
  multiple server instances.
- **No rate limiting** on auth endpoints (`/auth/login`, `/auth/refresh`) —
  fine for an internal agency tool behind normal network controls, not
  hardened against credential-stuffing at scale.
- **Refresh token cleanup**: expired `RefreshToken` rows aren't actively
  purged by a job — they're indexed and harmless at rest, but a cleanup cron
  would keep the table small in a long-running deployment.
- **No automated tests.** Given the scope of this assessment, testing time
  went into verifying the real-time role-scoping by hand across all three
  roles rather than into a test suite.
- **No pagination** on project/task lists — acceptable at the scale of "a
  small agency," would need cursor-based pagination before it's used by an
  agency with hundreds of concurrent projects.

---

## 5. Deployment Note

The submission brief asks for Vercel hosting. Vercel's serverless functions
don't hold long-lived connections or run background processes between
requests, which is exactly what this backend needs (a persistent Socket.io
server and an always-running `node-cron` job) — so a literal "everything on
Vercel" deployment isn't structurally compatible with the real-time and
scheduled-job requirements.

What's actually deployed:

- **Frontend** → Vercel (a static Vite build — this part fits Vercel exactly
  as intended)
- **Backend** → Render — a normal long-running Docker web service, which is
  what a stateful WebSocket server and a cron job both need
- **Database** → Neon, not Render's own free Postgres

`CLIENT_URL` on the backend and `VITE_API_URL` / `VITE_SOCKET_URL` on the
frontend are the only two things that change between environments; both are
read from environment variables, not hardcoded.

### Why Neon instead of Render's free Postgres

Render's free Postgres tier is documented as suitable for evaluation, not
anything meant to stay up — Render's own docs state a free Postgres instance
can be restarted for maintenance at any time, and in practice this surfaced
as real, unpredictable data loss during development: rows written and
confirmed present would be gone an hour or two later, with no error, no
warning, and no backup to recover from (free Postgres on Render has none).
Neon's free tier doesn't carry that same idle-restart behavior, so the
database was moved there instead. Everything else about the setup —
Prisma, the schema, the seed script — is identical; only the connection
string changed, since Neon is a standard Postgres endpoint.
