# API Routes

## Admin API (SUPER_ADMIN only)

All routes guarded by `guardSuperAdmin(authUser)` in `src/app.ts`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/users` | List all users (role, blocked, createdAt) |
| PUT | `/api/admin/users/:id/role` | Change role to USER/QC/ADMIN (not self, not SUPER_ADMIN) |
| PUT | `/api/admin/users/:id/block` | Block/unblock (deletes sessions + Redis keys on block) |
| GET | `/api/admin/presence` | Online user IDs |
| GET | `/api/admin/logs/app` | App logs from Redis (filter: level, limit, afterId) |
| GET | `/api/admin/logs/audit` | Audit logs from DB (filter: userId, action, limit) |
| DELETE | `/api/admin/logs/app` | Clear Redis app logs |
| DELETE | `/api/admin/logs/audit` | Clear DB audit logs |
| GET | `/api/admin/schema` | Parsed Prisma schema (models/fields/relations/enums) |
| GET | `/api/admin/routes` | All route metadata with summary stats |
| GET | `/api/admin/project-structure` | File list with line counts, exports, imports |
| GET | `/api/admin/env-map` | Env vars with set/unset status and consuming files |
| GET | `/api/admin/test-coverage` | Source ↔ test file mapping with coverage status |
| GET | `/api/admin/dependencies` | NPM packages with versions and importing files |
| GET | `/api/admin/migrations` | Prisma migration timeline with SQL preview |
| GET | `/api/admin/sessions` | Active sessions with online status and role breakdown |
| GET | `/api/admin/file-health` | Scan project files vs limits in `docs/FILE-HEALTH.md` — status ok/warn/critical/exempt, worst offenders |

## Tickets API (QC/ADMIN/SUPER_ADMIN)

Status machine: `OPEN → IN_PROGRESS → READY_FOR_QC → CLOSED`, with `REOPENED` branch.
`getAllowedStatusTransitions(current, role)` in `src/app.ts` enforces valid moves.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tickets` | List tickets (filter: status, priority, assigneeId, mine=1) |
| POST | `/api/tickets` | Create ticket |
| GET | `/api/tickets/:id` | Detail with comments + evidence |
| PATCH | `/api/tickets/:id` | Update status/priority/assignee (role-gated transitions) |
| POST | `/api/tickets/:id/comments` | Add comment |
| POST | `/api/tickets/:id/evidence` | Attach evidence (url + kind) |

Frontend component: `src/frontend/components/TicketsPanel.tsx` — shared between `/dev` and `/dashboard`.

## Utility

- `GET /health` — `{ status: 'ok' }`
- `GET /api/version` — `{ name, version }` from package.json
- `GET /api/changelog` — latest changelog entry as JSON (`{ version, date, sections }`). Pass `?all=true` for all versions.
- `GET /api/hello` / `PUT /api/hello` / `GET /api/hello/:name`

## WebSocket

- `WS /ws/presence` — real-time presence. Auth via session cookie. Tracks in-memory (`src/lib/presence.ts`). Broadcasts online list to admin subscribers on connect/disconnect.

## MCP over HTTP

- `POST /mcp` — readonly with `MCP_SECRET` bearer, full with `MCP_SECRET_ADMIN`
