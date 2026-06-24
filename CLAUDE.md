# WA Dashboard

## Runtime & Tooling

Default to **Bun** — never Node.js/npm/npx/ts-node.

```bash
bun <file>              # run file
bun test                # run tests (not jest/vitest)
bun install             # install deps
bun run <script>        # run package.json script
bunx <pkg> <cmd>        # execute package binary
```

Bun auto-loads `.env` — don't use dotenv.

## Build & Dev

```bash
bun run dev             # dev server with HMR (port from .env PORT, default 3111)
bun run build           # Vite production build
bun run start           # production server
bun run typecheck       # tsc --noEmit
bun run lint            # biome check
bun run lint:fix        # biome check --write
bun run docs:llms       # regenerate llms.txt from project sources
bun run docs:llms:check # fail if llms.txt is stale (CI guard)
```

## Testing

```bash
bun run test              # all tests
bun run test:unit         # tests/unit/
bun run test:integration  # tests/integration/ — API via app.handle(), no server needed
```

Helpers in `tests/helpers.ts`: `createTestApp()`, `seedTestUser()`, `createTestSession()`, `cleanupTestData()`

### Isolasi DB Test (Wajib)

Test berjalan terhadap **database terpisah**, bukan DB dev. `tests/setup.ts` (di-preload
via `bunfig.toml` `[test].preload`) menukar `DATABASE_URL` → `TEST_DATABASE_URL` sebelum
`src/lib/db.ts` membacanya. Tanpa ini, test yang menulis singleton (mis. `WaPolicy`
`id="global"`) akan mencemari data dev — gejalanya: setting di UI "kembali sendiri"
setelah `bun test` jalan.

Setup sekali per mesin:
```bash
createdb wa-dashboard-test   # atau: psql -c 'CREATE DATABASE "wa-dashboard-test"'
DATABASE_URL=<test-url> bunx --bun prisma migrate deploy   # apply skema ke DB test
```
Set `TEST_DATABASE_URL` di `.env` (lihat `.env.example`). Preload menolak jalan bila
`TEST_DATABASE_URL` kosong atau sama dengan `DATABASE_URL`. Saat menambah migration baru,
jalankan `migrate deploy` di atas agar DB test ikut sinkron.

## Database

```bash
bun run db:migrate      # prisma migrate dev
bun run db:seed         # seed demo users
bun run db:generate     # regenerate prisma client
```

## Migrasi Database (Wajib)

Setiap kali ada perubahan pada `prisma/schema.prisma`, **wajib** lakukan dua hal berikut
dalam commit yang sama — tidak boleh dipisah:

### 1. Jalankan migrasi lokal

```bash
bun run db:migrate      # buat migration file + apply ke DB lokal
bun run db:generate     # regenerate Prisma Client
```

Ini memastikan DB lokal sinkron dan Prisma Client up-to-date. Jangan skip meski
perubahannya kelihatan kecil — bahkan tambah `?` (optional field) tetap butuh migrasi.

### 2. Buat migration SQL untuk deploy produksi

Setiap migration yang dibuat `prisma migrate dev` menghasilkan file SQL di
`prisma/migrations/<timestamp>_<name>/migration.sql`. File ini adalah satu-satunya
cara DB produksi/staging bisa sinkron — **pastikan file ini ikut di-commit**.

Aturan menulis migration SQL yang aman untuk deploy:

- Pakai `IF NOT EXISTS` / `IF EXISTS` — idempoten, aman di-rerun.
- Kolom NOT NULL di tabel yang sudah berisi data: **wajib** kasih `DEFAULT`
  atau jalankan `UPDATE` backfill sebelum set NOT NULL. Jangan asumsikan tabel kosong.
- Jangan hapus kolom/tabel kecuali sudah dipastikan tidak ada kode yang masih membacanya.
- Untuk rename kolom: buat kolom baru + backfill + hapus kolom lama dalam 2 deployment
  terpisah (blue-green safe), bukan satu ALTER RENAME langsung.

### Checklist sebelum commit perubahan schema

- [ ] `bun run db:migrate` berhasil (migration file terbuat di `prisma/migrations/`)
- [ ] `bun run db:generate` berhasil (Prisma Client terupdate)
- [ ] `bun run typecheck` hijau (tidak ada type error akibat field baru/hilang)
- [ ] File `prisma/migrations/<timestamp>_*/migration.sql` ikut di-commit
- [ ] Tidak ada `findMany` / query baru yang mengakses field tanpa migration-nya

### Kenapa ini wajib

Schema drift adalah penyebab paling umum crash di prod/staging:
`column does not exist`, `relation does not exist`, `null constraint violation`.
Prisma Client di-generate dari schema, tapi DB tidak berubah otomatis.
Migration adalah satu-satunya jembatan — kalau tertinggal, app jalan tapi query meledak.

## Project Structure

```
src/
  app.ts              # Elysia app factory — all API routes, exported as createApp()
  index.tsx           # Server entry — Vite middleware (dev) / static files (prod)
  serve.ts            # Dev entry: bun --watch src/serve.ts
  lib/
    auth.ts           # Better Auth instance
    auth-middleware.ts # Elysia derive plugin (authUser)
    auth-client.ts    # Better Auth React client
    db.ts             # Prisma singleton — import { prisma }
    redis.ts          # Bun.RedisClient singleton — import { redis }
    applog.ts         # Redis-backed app log ring buffer
    env.ts            # Typed env vars
  frontend/
    router.ts         # Single source of truth for navigation
    routes/           # One file per route, export named *Route const
    hooks/            # useAuth, usePresence
    components/       # ThemeToggle, TicketsPanel, NotFound, ErrorPage
prisma/
  schema.prisma       # DB schema
  seed.ts             # Demo users (scrypt passwords, stored in Account table)
tests/
  helpers.ts          # Test utilities
  unit/               # Env, DB connection, password
  integration/        # API endpoint tests
```

## Update Dokumentasi (Wajib)

Setiap kali menyentuh **business logic** — auth flow, role/permission,
ticket lifecycle, endpoint baru/berubah, schema Prisma, key Redis,
WS channel, MCP tool, env var, atau aturan kerja AI — **wajib** update
dokumentasi yang relevan di commit yang sama:

| Yang Disentuh | Dokumen yang Harus Diupdate |
|---------------|-----------------------------|
| Endpoint API (tambah/ubah/hapus) | `docs/API.md` |
| Auth / role / session | `docs/AUTH.md` |
| Schema Prisma / Redis namespace | `docs/DATABASE.md` |
| Frontend route / hook / komponen utama | `docs/FRONTEND.md` |
| MCP tool baru / berubah | `docs/MCP.md` |
| Aturan/kontrak kerja AI | `docs/AI_CONTRACT.md` |
| Checklist saat tambah fitur | `docs/FEATURE-CHECKLIST.md` |
| Aturan ukuran/struktur file | `docs/FILE-HEALTH.md` |
| Strategi scaling / performance | `docs/SCALING.md` |
| Struktur project / command utama / overview | `CLAUDE.md` (file ini) |

Aturan:
- Update doc + kode dalam **commit yang sama**. Doc yang ketinggalan =
  bug bagi sesi AI berikutnya.
- Kalau perubahan menghapus/rename sesuatu yang disebut di doc, hapus
  juga di doc — jangan biarkan referensi mati.
- Pengecualian: refactor murni internal yang tidak mengubah kontrak
  publik atau perilaku yang dijanjikan doc. Kalau ragu, update.

## Detail Docs

See @docs/AI_CONTRACT.md
See @docs/SCALING.md
See @docs/AUTH.md
See @docs/API.md
See @docs/FRONTEND.md
See @docs/DATABASE.md
See @docs/MCP.md
See @docs/FILE-HEALTH.md
See @docs/FEATURE-CHECKLIST.md
See @docs/SPLIT-CLAUDE.md
