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

## WhatsApp API (ADMIN/SUPER_ADMIN)

Proxy ke container wwebjs-api. `sessionId` SELALU diturunkan dari session cookie
(`authUser.id`) — tidak pernah dari input, sehingga sesi tiap user terisolasi.
Guard: `guardAdmin(authUser)`. API key disuntik server-side di `src/lib/wa-client.ts`
(tidak pernah ke browser).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/wa/session/status` | Status koneksi sesi user |
| POST | `/api/wa/session/start` | Mulai sesi |
| GET | `/api/wa/session/qr` | QR (string) |
| GET | `/api/wa/session/qr/image` | QR (PNG, proxied) |
| POST | `/api/wa/session/pairing-code` | Request pairing code (body `{ phoneNumber }`) |
| POST | `/api/wa/session/restart` | Restart sesi |
| POST | `/api/wa/session/stop` | Stop sesi |
| POST | `/api/wa/session/terminate` | Terminate (logout + destroy) |
| GET | `/api/wa/account` | Info akun (getClassInfo) |
| GET | `/api/wa/contacts` | Daftar kontak |
| GET | `/api/wa/chats` | Daftar chat |
| GET | `/api/wa/avatar` | Foto profil kontak (query `?contactId=<num>@c.us`) — `{ url: string \| null }`, di-cache Redis 1 jam |
| POST | `/api/wa/send` | Kirim pesan (body `{ chatId, content }`) — **digate enforcement anti-ban** |

`GET /api/wa/avatar` memanggil `getProfilePicUrl` di container (1 panggilan upstream per
nomor). `contactId` dari query, divalidasi `minLength: 1`. Hasil di-cache di Redis
`wa:avatar:<userId>:<contactId>` (TTL 3600s); nomor tanpa foto disimpan sebagai marker
string kosong agar tak memanggil upstream berulang, dan dikembalikan sebagai `url: null`.
Frontend memuat avatar secara lazy per baris yang masuk viewport (`WaContactAvatar.tsx`).

### Enforcement anti-ban di `POST /api/wa/send`

Sebelum diteruskan ke container, tiap kirim melewati `checkAndConsume()` di
`src/lib/wa-policy.ts` (urut, fail-fast): (1) wajib ack kontrak versi terbaru,
(2) blokir first-contact ke nomor non-kontak, (3) jeda minimum antar pesan,
(4) cooldown per nomor, (5) plafon menit/jam/hari. Gagal → **403** (pelanggaran
kebijakan: belum ack / first-contact) atau **429** (rate/cooldown, sertakan
`retryAfter` detik). Pemblokiran dicatat `appLog('warn')` + audit `WA_SEND_BLOCKED`.

### WA Policy (kontrak anti-ban)

| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| GET | `/api/wa/policy` | guardAdmin | Policy global + usage kuota user + status ack + teks kontrak + `canEdit` |
| PUT | `/api/wa/policy` | guardSuperAdmin | Update policy (semua field wajib, tervalidasi range), audit `WA_POLICY_UPDATED` |
| POST | `/api/wa/policy/ack` | guardAdmin | Catat acknowledge kontrak versi terbaru, audit `WA_POLICY_ACK` |
| DELETE | `/api/wa/policy/ack` | guardAdmin | Batalkan acknowledge (hapus key Redis ack), audit `WA_POLICY_ACK_REVOKED`. Pengiriman kembali tergate `requireAck` |

Policy = singleton DB (`wa_policy` id `global`). Detail lengkap kontrak & field:
`docs/WA-POLICY.md`.

Frontend: route `/wa` (`src/frontend/routes/wa.tsx`), panel di `src/frontend/components/wa/`.

## Utility

- `GET /health` — `{ status: 'ok' }`
- `GET /api/version` — `{ name, version }` from package.json
- `GET /api/changelog` — latest changelog entry as JSON (`{ version, date, sections }`). Pass `?all=true` for all versions.
- `GET /api/hello` / `PUT /api/hello` / `GET /api/hello/:name`
- `GET /llms.txt` — LLM-friendly project summary, `text/plain` (`Cache-Control: public, max-age=300`). Auto-generated live from package.json, the route catalog, Prisma schema, env catalog, CHANGELOG.md, and docs/. Routed through Elysia via `API_EXACT` in `src/index.tsx` (the dot in the path would otherwise classify it as a static asset). Regenerate the on-disk copy with `bun run docs:llms`; verify freshness in CI with `bun run docs:llms:check`. Generator: `src/lib/llms-generator.ts`.

## WebSocket

- `WS /ws/presence` — real-time presence. Auth via session cookie. Tracks in-memory (`src/lib/presence.ts`). Broadcasts online list to admin subscribers on connect/disconnect.
- `WS /ws/wa` — relay event WhatsApp dari container (`src/lib/wa-bridge.ts`). Auth via session cookie (ADMIN/SUPER_ADMIN). Backend jadi WS client ke container `/ws/:userId`, forward event ke browser milik user itu saja. Graceful fallback ke polling bila container WS belum aktif.

## MCP over HTTP

- `POST /mcp` — readonly with `MCP_SECRET` bearer, full with `MCP_SECRET_ADMIN`
