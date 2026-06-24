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
Avatar adalah data best-effort: bila container error untuk satu nomor (nomor tanpa foto,
foto privat, non-WhatsApp, atau identifier `@lid`), handler **degrade ke `url: null`**
(bukan 502) dan men-cache kegagalan dengan TTL pendek (300s) agar container yang sempat
down pulih cepat. Frontend memuat avatar secara lazy per baris yang masuk viewport
(`WaContactAvatar.tsx`).

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

### Operator WA Sessions (SUPER_ADMIN)

Panel operator di `/dev` untuk melihat **semua** sesi raw di container (termasuk sesi
orphan yang tak ter-map ke user dashboard) + terminate manual. Berbeda dari `/api/wa/*`
per-user, endpoint ini **sengaja menerima `sessionId` dari input** (bukan `authUser.id`)
agar bisa menjangkau sesi orphan — satu-satunya endpoint WA yang begitu, dijaga ketat
`guardSuperAdmin` + audit. Logika enrichment di `src/lib/wa-sessions.ts` (sumber tunggal,
dipakai juga MCP `wa_sessions_detail`).

| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| GET | `/api/admin/wa-sessions` | guardSuperAdmin | List semua sesi container ter-enrich: `{ sessions: WaSessionInfo[], summary: { total, connected, orphan } }`. Tiap sesi: status koneksi (`getStatus`), nomor **ter-mask** + nama (`getClassInfo`), flag `orphan` (tidak match user DB). Sesi yang gagal di-enrich (belum CONNECTED) degrade ke `phone:null,name:null`, bukan gagalkan list. |
| POST | `/api/admin/wa-sessions/:id/terminate` | guardSuperAdmin | Logout + destroy sesi container by raw `:id`. Audit `WA_SESSION_TERMINATED` + `appLog('warn')`. 400 bila id kosong. |

Nomor di-mask via `maskPhone` (`src/lib/wa-verify.ts`) sebelum keluar server — tak pernah
mengirim digit penuh ke browser/MCP. `WaUpstreamError` propagate sebagai **502**.

## WhatsApp Inbound Verify API (WAV)

Verifikasi kepemilikan nomor pola **inbound** (user kirim token ke nomor server,
dashboard hanya menerima — aman dari kebijakan anti-ban OTP). Dipakai consumer app
eksternal dengan **isolasi penuh** antar app. Kontrak lengkap: `docs/WA-VERIFY.md`.

### Consumer-facing (auth: API key header `x-api-key`, BUKAN cookie)

`consumerId` SELALU dari API key (hash lookup), tak pernah dari input. Query
di-scope `consumerId` → request milik app lain 404 (bukti isolasi).

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/verify/start` | Body `{ expectedPhone? }` → `{ id, token, sendTo, expiresAt, instruction }`. Token `WAV-` + 8 char, one-time, TTL 5 menit. 401 bila API key invalid/non-aktif; 503 bila gagal generate token. |
| GET | `/api/verify/:id` | Poll `{ status, matchedPhone, verifiedAt, expiresAt }`. `status` ∈ PENDING/VERIFIED/EXPIRED (live-cek expiry). 404 untuk id milik consumer lain. |

`expectedPhone` diisi = **login** (consumer bandingkan `matchedPhone` sendiri);
kosong = **discovery** (nomor pengirim jadi nomor terverifikasi).

### Management (auth: session cookie)

| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| GET | `/api/wa/verify/consumers` | guardAdmin | List consumer (id, name, apiKeyPrefix, webhookUrl, active, `_count.requests`) + `canEdit` |
| POST | `/api/wa/verify/consumers` | guardSuperAdmin | Buat consumer → `{ consumer, apiKey }`; **apiKey plaintext hanya muncul sekali**. Audit `WA_VERIFY_CONSUMER_CREATED` |
| PUT | `/api/wa/verify/consumers/:id` | guardSuperAdmin | Update name/webhookUrl/active (404 bila tak ada). Audit `WA_VERIFY_CONSUMER_UPDATED` |
| POST | `/api/wa/verify/consumers/:id/regenerate-key` | guardSuperAdmin | Regen apiKey (balas sekali). Audit `WA_VERIFY_KEY_REGENERATED` |
| DELETE | `/api/wa/verify/consumers/:id` | guardSuperAdmin | Hapus consumer (cascade requests). Audit `WA_VERIFY_CONSUMER_DELETED` |
| GET | `/api/wa/verify/requests` | guardAdmin | List request terbaru (`?limit` max 200), `matchedPhone` **ter-mask** |
| GET | `/api/wa/verify/inbound` | guardSuperAdmin | Raw inbound log (`?limit` max 200) |
| POST | `/api/wa/verify/requests/:id/replay` | guardSuperAdmin | Replay webhook (409 + `reason` bila gagal). Audit `WA_VERIFY_REPLAY` |

### Webhook push ke consumer

Saat match → `POST` ke `consumer.webhookUrl` (bila ada; jika tidak, mode
polling-only). Payload `{ event: 'verify.succeeded', id, matchedPhone, expectedPhone,
verifiedAt }` (token TIDAK disertakan; korelasi via `id`). Headers: `X-WAV-Signature:
sha256=<HMAC(body, webhookSecret)>`, `X-WAV-Idempotency-Key: <id>`, `X-WAV-Attempt: <n>`.
Retry backoff sampai 5×; status delivery di-persist (`PENDING/DELIVERED/FAILED/DISABLED`).
DB = sumber kebenaran (polling tetap jalan walau webhook gagal).

Capture via supervisor WS always-on (`src/lib/wa-verify-listener.ts`), divalidasi
terhadap DB (hanya session ADMIN/SUPER_ADMIN aktif). Boot di `src/index.tsx`.

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
