# Changelog

All notable changes to this project will be documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- **WhatsApp Inbound Verification (WAV)** — verifikasi kepemilikan nomor pola *inbound/proof-of-possession*: user membuktikan kepemilikan dengan **mengirim** token `WAV-XXXXXXXX` ke nomor server (dashboard hanya menerima — aman dari kebijakan anti-ban OTP). Dipakai consumer app eksternal dengan **isolasi penuh** antar app (`consumerId` selalu dari API key, request app lain → 404). Capture via supervisor WS always-on (`src/lib/wa-verify-listener.ts`, rekonsiliasi session 30s tervalidasi terhadap DB). Hasil diekspos via **polling** (sumber kebenaran, `GET /api/verify/:id`) **dan** webhook push HMAC-signed dengan retry + replay. UI tab "Verifikasi Nomor" di `/wa?tab=verify` (ADMIN+SUPER_ADMIN): kelola consumer (API key sekali-tampil), lihat request + inbound log (nomor ter-mask). Endpoint consumer `POST /api/verify/start` + `GET /api/verify/:id` (auth `x-api-key`); manajemen `GET/POST/PUT/DELETE /api/wa/verify/consumers`, `.../regenerate-key`, `GET /api/wa/verify/requests`, `GET /api/wa/verify/inbound`, `POST /api/wa/verify/requests/:id/replay`. Model Prisma `VerifyConsumer`/`VerifyRequest`/`VerifyInboundLog` + enum `VerifyStatus`/`VerifyDelivery`. MCP tools `wa_verify_consumers`/`wa_verify_requests`/`wa_verify_inbound`/`wa_verify_replay` (dev) + `stg_wa_verify_*` (staging). Env baru `WA_VERIFY_SERVER_NUMBER`. Dokumentasi lengkap di `docs/WA-VERIFY.md`.
- **Pairing WhatsApp via nomor HP** di `/wa?tab=connection` — selain scan QR, kini bisa minta kode pairing dengan memasukkan nomor HP (toggle QR ↔ Nomor HP). Memakai endpoint `POST /api/wa/session/pairing-code` yang sudah ada; kode pairing ditampilkan dengan tombol salin.
- **`GET /llms.txt`** — ringkasan project siap-LLM (`text/plain`, `Cache-Control: public, max-age=300`), dibangun live tiap request dari package.json, route catalog, schema Prisma, env catalog, CHANGELOG, dan docs/. CLI `bun run docs:llms` (tulis ke disk) + `bun run docs:llms:check` (cek staleness di CI). Generator murni di `src/lib/llms-generator.ts`.
- **Foto profil kontak WhatsApp** di tab "Info Akun" (`/wa?tab=account`) — avatar dimuat lazy per baris yang masuk viewport (`IntersectionObserver`), dengan fallback inisial nama untuk nomor tanpa foto. Endpoint `GET /api/wa/avatar?contactId=...` mem-proxy `getProfilePicUrl` dan men-cache hasil di Redis (`wa:avatar:<userId>:<contactId>`, TTL 1 jam). MCP tools `wa_avatar` (dev) + `stg_wa_avatar` (staging).
- **WhatsApp anti-ban policy ("kontrak sumpah pengikat")** — kontrak terdokumentasi + enforcement teknis nyata di `POST /api/wa/send`: wajib acknowledge kontrak, blokir kirim-duluan (first-contact) ke nomor non-kontak, jeda minimum antar pesan, cooldown per nomor, dan plafon volume menit/jam/hari. Pelanggaran → 403 (kebijakan) / 429 (rate limit) + audit `WA_SEND_BLOCKED`.
- Halaman **Aturan & Kontrak** di `/wa?tab=policy` — baca kontrak, acknowledge, lihat kuota pakai, dan (SUPER_ADMIN) atur policy global.
- **Pembatalan persetujuan kontrak** — tombol "Batalkan persetujuan" di `WaContractView` (modal konfirmasi) + endpoint `DELETE /api/wa/policy/ack` (audit `WA_POLICY_ACK_REVOKED`). Setelah dibatalkan, pengiriman kembali diblokir sampai disetujui ulang.
- Endpoint `GET/PUT /api/wa/policy` + `POST /api/wa/policy/ack`; model Prisma singleton `WaPolicy` (global, persist di Postgres).
- Mode OTP (first-contact) sebagai escape-hatch SUPER_ADMIN, **default MATI** — aman out-of-the-box, aktivasi tercatat di audit `WA_POLICY_UPDATED`.
- MCP tools `wa_policy_get` / `wa_policy_usage` / `wa_policy_set` (dev) dan `stg_wa_policy` (staging).
- Dokumentasi kontrak lengkap di `docs/WA-POLICY.md`.

### Fixed
- **Setting policy WhatsApp "kembali sendiri" ke nilai lama** — test integration menulis ke DB dev yang sama dan menimpa singleton `WaPolicy` (`id="global"`); setiap `bun test` jalan, `allowFirstContact` tereset ke `true`, sehingga perubahan operator di `/wa?tab=policy` (mis. dimatikan) tampak "balik on tiba-tiba" pada reload berikutnya. Test kini berjalan terhadap database terpisah lewat `tests/setup.ts` (preload `bunfig.toml` `[test]`) yang menukar `DATABASE_URL` → `TEST_DATABASE_URL` sebelum koneksi dibuat, dengan guard menolak jalan bila `TEST_DATABASE_URL` kosong atau sama dengan DB dev. Env baru `TEST_DATABASE_URL`.
- **Avatar kontak WhatsApp 502 (Bad Gateway)** di tab "Info Akun" — `getProfilePicUrl` di container wwebjs-api membalas non-2xx untuk kasus normal (nomor tanpa foto, foto privat, nomor non-WhatsApp, identifier `@lid`), dan `GET /api/wa/avatar` mengangkatnya jadi `WaUpstreamError` 502 yang menggagalkan request + spam console. Sekarang handler degrade kegagalan upstream per-nomor ke `{ url: null }` (fallback inisial nama), dan men-cache kegagalan dengan TTL pendek (300s) agar container yang sempat down pulih cepat tanpa memanggil upstream berulang.
- **QR code tidak hilang setelah pairing sukses** di `/wa?tab=connection` — saat WS realtime aktif, polling status dimatikan total sehingga transisi ke `CONNECTED` bisa terlewat dan QR macet tampil. Sekarang status tetap di-poll 3 detik selama belum `CONNECTED`, baru mengandalkan WS setelah terhubung.
- **Pairing via nomor HP gagal 422** — `apiFetch` tidak menyetel `Content-Type: application/json` saat mengirim body, sehingga server menerima `text/plain`, gagal mem-parse body, dan validasi `phoneNumber` ditolak. Sekarang `apiFetch` otomatis menambahkan header JSON bila ada body (header eksplisit dari caller tetap menang). `UnauthorizedError` dipindah ke `src/frontend/lib/errors.ts` agar `apiFetch` bisa diuji unit tanpa menyeret pohon React.
- **Tombol "Minta Kode" pairing senyap saat sesi belum dimulai** — container wwebjs-api membalas `HTTP 200 { success: false, message: "session_not_found" }` untuk error level-aplikasi; karena frontend hanya cek status HTTP (bukan field `success`), kegagalan tertelan diam-diam: tak ada kode, tak ada error, tak ada loading. Logika ekstraksi kode dipindah ke `src/frontend/lib/wa-pairing.ts` (`pairingCodeOrThrow`) yang melempar Error dengan pesan actionable ("Klik Start dulu…") saat `success:false` / tak ada kode, sehingga muncul di alert merah.

### Changed
- Brand renamed from Base Template → **WA Dashboard**; project reinitialized from base-template2
- Remove unused dependencies: Three.js, React Three Fiber, D3, TanStack Router Vite plugin
- Sync agent configs and update login/blocked routes

---

## [0.1.0] - 2026-06-11

### Added
- Interactive Canvas 2D animated background (replaces Three.js/D3 — zero external deps)
- Role-based redirect after login (email & Google OAuth)
- Google profile photo displayed across all pages
- API Docs panel in `/dev` with Swagger iframe + OpenAPI JSON viewer
- File Health panel in `/dev` — scan project files vs `docs/FILE-HEALTH.md` limits, with pagination, copy buttons, and toast notifications
- Client-side pagination for FileHealthTable
- Production Docker deployment with standalone Prisma migrator
- `copy-migrate` utility script
- Elysia Swagger UI at `/api/docs` with full API documentation (Scalar UI)
- `GET /api/version` endpoint from `package.json`
- `GET /api/admin/file-health` endpoint — line/char count vs limits, status ok/warn/critical/exempt
- `GET /api/admin/sessions` — active sessions with online status and role breakdown
- `debug-dev`, `debug-stg`, and `deploy-stg` MCP servers
- `HMR_PORT` env var for explicit Vite HMR port config
- WebSocket presence tracking (`/ws/presence`) — real-time online user list
- Redis app logs ring buffer (`app:logs`, max 500 entries)
- Audit trail in DB (`AuditLog` table)
- Ticket tracking system with QC role and status machine (`OPEN → IN_PROGRESS → READY_FOR_QC → CLOSED`)
- `dev-auth` endpoint for local testing (no password check, dev only)
- Project visualization panel in `/dev` — 10 interactive React Flow views (routes, schema, dependencies, etc.)
- ER diagram in Database tab (`/dev`) with auto-save positions
- Collapsible sidebar (260px → 60px icon-only), state persisted in `localStorage`
- Tab state persisted in URL `?tab=` search param
- Comprehensive test suite — 147 tests across 18 files
- Mobile-first responsive design across all frontend pages
- Dark/light mode with no flash on load (reads `localStorage` before paint)
- Logout confirmation modal on all protected pages

### Changed
- Migrated auth to **Better Auth v1.6.9** (scrypt passwords, signed HttpOnly cookies, Redis session cache)
- Migrated to **Prisma 7** (ORM 7.8.0), generated client to `./generated/prisma`
- Migrated to static (code-based) **TanStack Router** — no codegen, no generated files
- Landing page redesigned — modern hero, features grid, tech stack section
- Brand renamed from BunStack → **Base Template**
- Split monolithic `app.ts` into focused sub-router modules (`routes/auth`, `routes/admin/*`, `routes/tickets`)
- `src/frontend/routes/dev.tsx` split into panel components under `routes/dev/`
- Sidebar footer and profile layout moved to AppShell

### Fixed
- Auto-reload on stale chunk 404 after deploy
- HMR WebSocket port conflict (`EADDRINUSE`) on dev startup
- Scalar UI blank document (scalarConfig `spec.url`)
- Google OAuth behind reverse proxy (honor `X-Forwarded-Proto`)
- Frontend type safety, responsive sizing, and real mutation state

### Removed
- Three.js, React Three Fiber (`@react-three/fiber`, `@react-three/drei`)
- D3 (`d3`)
- TanStack Router Vite plugin (switched to static router)

---

## [0.0.1] - 2026-04-01

### Added
- Initial full-stack template: Bun + Elysia + React + Vite
- Role-based routing: `SUPER_ADMIN → /dev`, `ADMIN/QC → /dashboard`, `USER → /profile`
- Admin API: user management (list, role change, block/unblock), presence, logs
- Dev console (`/dev`) and dashboard (`/dashboard`) with AppShell layout
- Better Auth (pre-v1.6 — later migrated), Google OAuth
- Prisma ORM with PostgreSQL, Redis via Bun native client
- `.env.example` with all required variables
