# Changelog

All notable changes to this project will be documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.1.11] - 2026-07-01

### Added
- **Balasan otomatis WhatsApp saat verifikasi (WAV) berhasil** — nomor server dapat membalas user dengan pesan "berhasil" saat verifikasi sukses (aman: reply-to-inbound, bukan cold outreach). **Default MATI** (`WaPolicy.verifyReplyEnabled=false`) agar nomor server tetap receive-only sampai sengaja dinyalakan di `/wa?tab=policy` (SUPER_ADMIN). Teks bisa diedit kapanpun (`verifyReplyMessage`) dengan **default yang bisa dikembalikan** (kosong/null → varian default di kode, dipilih deterministik per-request agar tak seragam identik). Balasan dipicu best-effort dari `handleInbound` via `sendVerifyReply()` (`src/lib/wa-verify-reply.ts`): **idempoten** (`VerifyRequest.replySentAt` claim-then-send, cegah dobel dari poller re-run), tergate **rate-only** (`checkAndConsume(..., { skipOutreachGates: true })` — lewati ack & first-contact yang khusus kirim-duluan, tetap tunduk min-interval/cooldown/plafon; plafon tercapai → balasan di-skip diam, verifikasi tetap sukses), audit `WA_VERIFY_REPLY_SENT`. Zero PII (teks tak menyisipkan nomor/token). Field baru `WaPolicy.verifyReplyEnabled`/`verifyReplyMessage` + `VerifyRequest.replySentAt`.

## [0.1.10] - 2026-07-01

### Changed
- **Konsolidasi navigasi WhatsApp ke satu menu `/wa`** — panel operator **WA Sessions** dan **Simulasi Login WAV** yang sebelumnya tersebar (tab `/dev?tab=wa-sessions` dan route standalone `/simulation`) kini menjadi tab di dalam `/wa` (`?tab=sessions` & `?tab=simulation`), khusus SUPER_ADMIN di bawah divider "Operator". Sidebar `/dev` menyisakan satu link "WhatsApp" sebagai entry-point tunggal. Route `/simulation` dihapus (komponen `SimLoginPanel` dipakai ulang sebagai tab). Tak ada perubahan endpoint/backend — semua REST WAV (`/api/wa/verify/sim/*`, `/api/admin/wa-sessions`) tetap sama.

## [0.1.9] - 2026-06-30

### Fixed
- **Verifikasi nomor (WAV) tidak pernah jalan di produksi/staging** — request verifikasi selalu PENDING walau `WA_VERIFY_SERVER_NUMBER` sudah diset. Penyebab: `startWaVerifySupervisor()` (plus `sweepWaVerify()` dan audit cleanup) hanya dipanggil di entry dev `src/index.tsx`, sedangkan produksi menjalankan binary dari `src/server.prod.ts` yang tidak pernah memanggilnya — supervisor capture poller tak pernah boot (`running:false`, `serverNumber:null`), token masuk tak tertangkap. Semua boot task kini diekstrak ke `src/lib/startup.ts` (`runStartupTasks()`) yang dipanggil **kedua** entry, plus test guard anti-drift. Wajib redeploy agar aktif.
- **Tool MCP `debug-stg` rusak (protokol usang)** — seluruh tool inspeksi staging via `POST /mcp` membalas 400 "Invalid JSON-RPC message". Endpoint `/mcp` sudah memakai MCP Streamable HTTP standar (`tools/call`), tapi tool masih mengirim body lama `{tool, input}` dan tanpa header `Accept` (406). Ditambahkan helper `mcpCallBody`/`unwrapMcpEnvelope`/`stgMcpCall` di `scripts/mcp/tools/stg-fetch.ts`; 22 call-site dialihkan ke JSON-RPC standar + header `Accept` yang benar.

## [0.1.8] - 2026-06-30

### Fixed
- **WA container request hang selamanya** — `rawFetch` di `src/lib/wa-client.ts` kini menyertakan `AbortSignal.timeout(WA_API_TIMEOUT_MS)` (default 15s). Sebelumnya tidak ada timeout: jika container lambat/down, semua pemanggil (`/api/admin/wa-sessions`, poller `reconcile()`, `pollOnce()`, dll) hang tanpa batas — panel WA Sessions hanya menampilkan "Loading..." selamanya dan WAV supervisor tidak pernah menemukan `sessionId` sehingga polling inbound tidak jalan. Setelah timeout, request gagal cepat dengan `WaUpstreamError` 502 (bukan hang), poller retry otomatis di siklus reconcile berikutnya. Env baru `WA_API_TIMEOUT_MS` (opsional, default `15000`).
- **Startup migration crash loop di staging** — `src/lib/migrate.ts` kini memeriksa `DIRECT_URL` sebelum jatuh ke `DATABASE_URL`. Sebelumnya migrator pakai `DATABASE_URL` (PgBouncer) yang meng-inject parameter `pgbouncer=true`; PgBouncer menolak dengan `PostgresError: unsupported startup parameter: pgbouncer (08P01)`, menyebabkan crash loop tanpa batas. Dengan `DIRECT_URL` sebagai fallback kedua, migrator otomatis bypass PgBouncer (sama seperti `prisma.config.ts`).

## [0.1.4] - 2026-06-25

### Fixed
- **Migrasi di staging dengan PgBouncer** — `prisma migrate` tidak lagi mengharuskan menukar `DATABASE_URL` ke alamat Postgres langsung secara manual setiap kali ada migrasi. Penyebab: migration butuh koneksi *session-level* (advisory lock + transaksi DDL) yang tidak didukung PgBouncer transaction-mode, sementara runtime app justru harus lewat PgBouncer. Solusi: `prisma.config.ts` kini memakai `DIRECT_URL` untuk migration (`process.env.DIRECT_URL || env('DATABASE_URL')`), sedangkan runtime app (`src/lib/db.ts`) tetap lewat `DATABASE_URL`. Set `DATABASE_URL` → PgBouncer (`:6432`) dan `DIRECT_URL` → Postgres langsung (`:5432`); dev lokal tanpa PgBouncer cukup kosongkan `DIRECT_URL` (fallback otomatis). `compose.yml` meneruskan `DIRECT_URL` ke container.

## [0.1.3] - 2026-06-25

### Fixed
- **Build produksi (Docker/staging)** — server binary tidak lagi crash saat startup dengan `TypeError: exports_external.function().returns is not a function`. Penyebab: `@elysiajs/swagger` meng-import `@scalar/themes` secara statis (hanya untuk string CSS `elysiajsTheme`), yang menyeret `@scalar/types` (ditulis untuk Zod v3) — saat di-bundle dengan Zod v4 project, `z.function().returns()` meledak. Crash hanya muncul di Docker (`--frozen-lockfile`, tanpa artifact Zod v3 nested). Server kini dikompilasi via `scripts/build-server.ts` yang men-stub `@scalar/themes`; UI docs Scalar tetap memuat aset dari CDN, backend tak berubah. Endpoint `/api/docs` + `/api/docs/json` terverifikasi tetap `200`.
- **Docker build** — `prisma generate` di stage builder diberi `DATABASE_URL` placeholder (scoped ke RUN itu saja); `prisma.config.ts` me-resolve env secara eager saat load walau generate tak pernah connect.

## [0.1.1] - 2026-06-25

### Added
- **WhatsApp Inbound Verification (WAV)** — verifikasi kepemilikan nomor pola *inbound/proof-of-possession*: user membuktikan kepemilikan dengan **mengirim** token `WAV-XXXXXXXX` ke nomor server (dashboard hanya menerima — aman dari kebijakan anti-ban OTP). Dipakai consumer app eksternal dengan **isolasi penuh** antar app (`consumerId` selalu dari API key, request app lain → 404). Capture via **supervisor REST-polling always-on** (`src/lib/wa-verify-poller.ts`, `getChats` tiap 4s pada session yang nomornya cocok `WA_VERIFY_SERVER_NUMBER`, watermark Redis `wa:verify:watermark:<sessionId>`) — menggantikan listener WS lama yang gagal (WS upgrade 502 di edge Cloudflare). Hasil diekspos via **polling** (sumber kebenaran, `GET /api/verify/:id`) **dan** webhook push HMAC-signed dengan retry + replay. UI tab "Verifikasi Nomor" di `/wa?tab=verify` (ADMIN+SUPER_ADMIN): kelola consumer (API key sekali-tampil), lihat request + inbound log (nomor ter-mask). Endpoint consumer `POST /api/verify/start` + `GET /api/verify/:id` (auth `x-api-key`); manajemen `GET/POST/PUT/DELETE /api/wa/verify/consumers`, `.../regenerate-key`, `GET /api/wa/verify/requests`, `GET /api/wa/verify/inbound`, `POST /api/wa/verify/requests/:id/replay`. Model Prisma `VerifyConsumer`/`VerifyRequest`/`VerifyInboundLog` + enum `VerifyStatus`/`VerifyDelivery`. MCP tools `wa_verify_consumers`/`wa_verify_requests`/`wa_verify_inbound`/`wa_verify_replay` (dev) + `stg_wa_verify_*` (staging). Env baru `WA_VERIFY_SERVER_NUMBER`. Dokumentasi lengkap di `docs/WA-VERIFY.md`.
- **Halaman Simulasi Login WAV** (`/simulation`, SUPER_ADMIN) — jalankan alur WAV end-to-end lewat browser sebelum rilis: dari "halaman login palsu" → buka WhatsApp dengan token terisi → operator kirim → dashboard poll sampai `VERIFIED`, dengan log timeline berstempel waktu tiap langkah. Proxy server-side via consumer reserved `[simulation]` (API key tak pernah ke browser); request sim = `VerifyRequest` biasa → tertangkap poller & muncul di panel Requests. Endpoint `POST /api/wa/verify/sim/start`, `GET /api/wa/verify/sim/:id`, `GET /api/wa/verify/sim/:id/qr` (PNG deep-link). Audit `WA_VERIFY_SIM_START`. Inti start/poll dibagi public router via `src/lib/wa-verify-flow.ts`.
- **Tab "Pesan" WhatsApp** di `/wa?tab=messages` — tampilan terpadu chat (`GET /api/wa/chats`) + inbound log WAV, filter klien-side (search + rentang tanggal), drill-down riwayat satu chat via modal (`GET /api/wa/messages?chatId=`, `fetchMessages` on-demand). Kartu state capture poller (running/idle, nomor server ter-mask, lastPollAt).
- **`GET /api/wa/verify/supervisor`** (guardAdmin) — state capture poller WAV: `running`, `serverNumber` (ter-mask), `sessionId`, `watermark`, `lastPollAt`, `lastError`, `pollIntervalMs`. MCP `wa_verify_supervisor` (dev) + `stg_wa_verify_supervisor` (staging).
- **Panel operator WA Sessions** di `/dev?tab=wa-sessions` (SUPER_ADMIN) — lihat **semua** sesi raw container (termasuk orphan) + terminate manual. Endpoint `GET /api/admin/wa-sessions` + `POST /api/admin/wa-sessions/:id/terminate` (audit `WA_SESSION_TERMINATED`). Nomor ter-mask. MCP `wa_sessions_detail` / `wa_session_terminate`.
- **Reveal webhook secret consumer** — `GET /api/wa/verify/consumers/:id/reveal-secret` (SUPER_ADMIN, audit `WA_VERIFY_SECRET_REVEALED`); secret disimpan plaintext (beda dari apiKey yang di-hash) → boleh di-reveal ulang.
- **Paginasi + pencarian + bulk-delete** di panel consumers/requests/inbound (`?limit`/`offset`/`search`/filter status) + endpoint `POST .../bulk-delete` (`{ ids? }`/`{ all? }`, SUPER_ADMIN, audit + `appLog('warn')`).
- **Harness E2E WAV berbasis Hurl** (`hurl/wa-verify/*.hurl`) + MCP `wa_verify_e2e_start`/`wa_verify_e2e_poll` (dev) — pola human-in-the-loop (langkah kirim token via WhatsApp tak bisa diotomatiskan agent). Degrade rapi bila `hurl` tak terinstall.
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
- **Instruksi token WAV kini berupa kalimat natural**, bukan token telanjang — `instruction` di `POST /api/verify/start` & sim, serta pre-fill deep-link `wa.me`, membungkus token jadi `Verifikasi nomor saya: WAV-XXXXXXXX` (token di akhir agar batas kata bersih). Pembangun tunggal `buildVerifyMessage`/`buildVerifyInstruction` di `src/lib/wa-verify.ts` (dipakai public router, sim router, dan deep-link).
- **Matcher token WAV kini case-insensitive** (regex `/i` + normalisasi uppercase) — bertahan terhadap autocapitalize/autocorrect keyboard HP. Token tetap boleh dikelilingi kata penjelasan (batas kata `\b`).
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
