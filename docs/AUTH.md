# Auth

Better Auth v1.6.9. Session-based, HttpOnly signed cookies, Redis secondary storage.

## Key Files

- `src/lib/auth.ts` — Better Auth instance (Prisma adapter, Redis storage, Google OAuth, hooks)
- `src/lib/auth-middleware.ts` — Elysia `derive` plugin, injects `authUser` globally
- `src/lib/auth-client.ts` — Better Auth React client for frontend
- `src/lib/env.ts` — requires `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`

## Endpoints (Better Auth native)

- `POST /api/auth/sign-in/email` — email/password login
- `POST /api/auth/sign-out` — logout, deletes session
- `GET /api/auth/get-session` — current session (returns `null` body if none)
- `POST /api/auth/sign-in/social` — Google OAuth initiate
- `GET /api/auth/callback/google` — Google OAuth callback
- `GET /api/dev-auth/login-as/:email?redirect=/path` — dev only, no password check

## Session Storage

Sessions stored in Redis (`ba:kv:<token>`) and persisted to DB (`storeSessionInDatabase: true`).
Cookie: `better-auth.session_token=<token>.<HMAC-SHA256-b64>` (signed).
Cookie cache **disabled** — role/blocked can change; Redis is fast enough.

## Custom Fields

`role` and `blocked` declared as `additionalFields` — stored in `user` table.

## SUPER_ADMIN Auto-Promote

Two layers:
1. `databaseHooks.user.create.before` — sets `SUPER_ADMIN` on first sign-up if email is in `SUPER_ADMIN_EMAILS`. Ensures first session has correct role.
2. After sign-in hook — promotes existing users and patches `ba:kv:<token>` in Redis immediately.

## Blocked Users

After sign-in hook: deletes session + throws `APIError('FORBIDDEN')` if `user.blocked = true`.
On admin block: deletes all DB sessions + deletes all `ba:kv:<token>` Redis keys for that user.

## Route Guards (src/app.ts)

```ts
const guard = guardSuperAdmin(authUser)  // returns Response | null
const guard = guardQcOrAdmin(authUser)
const guard = guardAuth(authUser)
if (guard) return guard
```

## Password Hashing

Better Auth uses **scrypt** format: `salt:hex` (NOT bcrypt).
`tests/helpers.ts` and `prisma/seed.ts` implement the same algorithm via `node:crypto`.

## Role Table

| Role | Default Route | Access |
|------|--------------|--------|
| SUPER_ADMIN | `/dev` | `/dev`, `/dashboard`, `/profile` |
| ADMIN | `/dashboard` | `/dashboard`, `/profile` |
| QC | `/dashboard` | `/dashboard` (QC tickets only), `/profile` |
| USER | `/profile` | `/profile` |

`getDefaultRoute(role)` in `src/frontend/hooks/useAuth.ts`.
Blocked users redirect to `/blocked` from all protected routes.

## Ticket Status Transitions

Status machine: `OPEN → IN_PROGRESS → READY_FOR_QC → CLOSED`, with `REOPENED` branch.

Implemented di `src/lib/ticket-helpers.ts`. `isQc = role === 'QC' || role === 'SUPER_ADMIN'`.

| From | QC / SUPER_ADMIN | ADMIN |
|------|-----------------|-------|
| OPEN | `IN_PROGRESS`, `CLOSED`* | `IN_PROGRESS` |
| IN_PROGRESS | `CLOSED` | `READY_FOR_QC` |
| READY_FOR_QC | `CLOSED`, `REOPENED` | — |
| REOPENED | `CLOSED` | `IN_PROGRESS` |
| CLOSED | `REOPENED` | — |

\* **Fast reject**: QC dan SUPER_ADMIN dapat langsung menutup ticket dari status OPEN tanpa melalui alur normal. Ini digunakan untuk menolak ticket yang invalid, duplikat, atau di luar scope — tanpa harus menunggu ADMIN memprosesnya ke `IN_PROGRESS` terlebih dahulu.
