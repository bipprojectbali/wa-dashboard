# Changelog

All notable changes to this project will be documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- **Foto profil kontak WhatsApp** di tab "Info Akun" (`/wa?tab=account`) — avatar dimuat lazy per baris yang masuk viewport (`IntersectionObserver`), dengan fallback inisial nama untuk nomor tanpa foto. Endpoint `GET /api/wa/avatar?contactId=...` mem-proxy `getProfilePicUrl` dan men-cache hasil di Redis (`wa:avatar:<userId>:<contactId>`, TTL 1 jam). MCP tools `wa_avatar` (dev) + `stg_wa_avatar` (staging).
- **WhatsApp anti-ban policy ("kontrak sumpah pengikat")** — kontrak terdokumentasi + enforcement teknis nyata di `POST /api/wa/send`: wajib acknowledge kontrak, blokir kirim-duluan (first-contact) ke nomor non-kontak, jeda minimum antar pesan, cooldown per nomor, dan plafon volume menit/jam/hari. Pelanggaran → 403 (kebijakan) / 429 (rate limit) + audit `WA_SEND_BLOCKED`.
- Halaman **Aturan & Kontrak** di `/wa?tab=policy` — baca kontrak, acknowledge, lihat kuota pakai, dan (SUPER_ADMIN) atur policy global.
- **Pembatalan persetujuan kontrak** — tombol "Batalkan persetujuan" di `WaContractView` (modal konfirmasi) + endpoint `DELETE /api/wa/policy/ack` (audit `WA_POLICY_ACK_REVOKED`). Setelah dibatalkan, pengiriman kembali diblokir sampai disetujui ulang.
- Endpoint `GET/PUT /api/wa/policy` + `POST /api/wa/policy/ack`; model Prisma singleton `WaPolicy` (global, persist di Postgres).
- Mode OTP (first-contact) sebagai escape-hatch SUPER_ADMIN, **default MATI** — aman out-of-the-box, aktivasi tercatat di audit `WA_POLICY_UPDATED`.
- MCP tools `wa_policy_get` / `wa_policy_usage` / `wa_policy_set` (dev) dan `stg_wa_policy` (staging).
- Dokumentasi kontrak lengkap di `docs/WA-POLICY.md`.

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
