# MCP Server

Local MCP server lets Claude drive the app remotely via `.mcp.json`.
Registers `app-mcp` (runs `scripts/mcp/server.ts`) alongside `playwright`.

## Auth

- `MCP_SECRET` — readonly access
- `MCP_SECRET_ADMIN` — full write/dev access

## Entry Points

- `scripts/mcp/server.ts` — MCP server factory
- `scripts/mcp/test-client.ts` — manual test client

## Tool Modules (`scripts/mcp/tools/`)

`admin`, `code`, `db`, `dev`, `health`, `logs`, `presence`, `project`, `redis`, `tickets`, `wa`, `shared`

## Project Tools (readonly)

`project_routes`, `project_schema`, `project_dependencies`, `project_migrations`,
`project_env_map`, `project_structure`, `project_file_health`

`project_file_health` — scan src/, prisma/, tests/, scripts/, docs/ dan laporkan
file yang mendekati / melebihi batas di `docs/FILE-HEALTH.md`. Status:
`ok` (<80%), `warn` (80–100%), `critical` (>100%), `exempt` (migration/seed/generated).

## Ticket Tools

`list`, `get`, `claim`, `comment`, `add_evidence`, `ready_for_qc`, `create`, `close`, `reopen`, `update`

## WhatsApp Tools (`scripts/mcp/tools/wa.ts`)

Readonly (`wa-readonly`): `wa_status` (input `{ userId }`), `wa_sessions` (semua sesi aktif di container, id mentah), `wa_sessions_detail` (input `{}` → semua sesi ter-enrich: status, nomor ter-mask, nama, flag orphan — pakai `listWaSessions` dari `src/lib/wa-sessions.ts`, view operator), `wa_account` (input `{ userId }` → getClassInfo), `wa_avatar` (input `{ userId, contactId }` → getProfilePicUrl), `wa_policy_get` (policy anti-ban global), `wa_policy_usage` (input `{ userId }` → kuota menit/jam/hari).
Admin (`wa-admin`): `wa_terminate` (input `{ userId }` → logout + destroy sesi by user id), `wa_session_terminate` (input `{ sessionId }` → terminate by raw container session id, termasuk sesi orphan), `wa_policy_set` (partial update policy + invalidate cache).

`userId` = WA session id = dashboard user id. Semua memanggil container via `src/lib/wa-client.ts` (API key server-side).

`debug-stg` pair (`scripts/mcp/tools/stg.inspect.ts`, readonly via HTTP `/mcp`): `stg_wa_sessions`, `stg_wa_sessions_detail` (input `{}` → GET `/api/admin/wa-sessions`, sesi ter-enrich + orphan, readonly), `stg_wa_status` (input `{ userId }`), `stg_wa_avatar` (input `{ userId, contactId }`), `stg_wa_policy` (policy anti-ban di STG).

## WhatsApp Inbound Verify Tools (`scripts/mcp/tools/wa-verify.ts`)

Inspeksi fitur WAV (verifikasi nomor inbound). Memanggil `prisma`/lib WAV langsung.

Readonly (`wa-verify-readonly`): `wa_verify_consumers` (list consumer tanpa secret), `wa_verify_requests` (input `{ limit? }` → request terbaru, nomor ter-mask), `wa_verify_inbound` (input `{ limit? }` → raw inbound log, nomor ter-mask).
Admin (`wa-verify-admin`): `wa_verify_replay` (input `{ id }` → replay webhook manual).

`debug-stg` pair (readonly via HTTP `/mcp`): `stg_wa_verify_consumers`, `stg_wa_verify_requests` (input `{ limit? }`), `stg_wa_verify_inbound` (input `{ limit? }`). Lihat `docs/WA-VERIFY.md`.

## WhatsApp Verify E2E Tools (`scripts/mcp/tools/wa-verify-e2e.ts`)

Orkestrasi uji alur WAV nyata dengan men-spawn binary `hurl` atas file
`hurl/wa-verify/*.hurl` (sumber tunggal yang juga dibaca manusia). Pola
human-in-the-loop: langkah kirim token via WhatsApp tak bisa diotomatiskan agent.

Admin (`wa-verify-e2e`, dev saja): `wa_verify_e2e_start` (input `{ apiKey, expectedPhone?, baseUrl?, timeoutMs? }` → spawn `start.hurl`, balas `{ requestId, token, sendTo, mode, nextStep }`), `wa_verify_e2e_poll` (input `{ requestId, apiKey, baseUrl?, timeoutMs? }` → spawn `poll.hurl`, balas `{ status, verified, note }`). Degrade rapi bila `hurl` tak terinstall (kembalikan instruksi install). Pasangan `debug-stg` ditunda sebagai follow-up. Lihat `docs/WA-VERIFY.md` seksi "E2E testing".

## HTTP Fallback

`POST /mcp` — readonly with `MCP_SECRET` bearer, full with `MCP_SECRET_ADMIN`
