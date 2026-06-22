# FEATURE-CHECKLIST — Wajib Saat Menambah Fitur Baru

Setiap fitur baru (endpoint, domain logic, schema field, route halaman,
WS channel, dst.) **wajib** lengkap dengan 3 hal di bawah ini **sebelum**
dianggap selesai. Tidak ada pengecualian kecuali user secara eksplisit
membebaskan salah satunya untuk fitur tersebut.

> Tujuan: setiap fitur baru otomatis bisa diuji (CI), bisa diinspeksi
> di dev (`debug-dev`), dan bisa diinspeksi di staging (`debug-stg`).
> Tanpa ini, AI maupun manusia jadi buta terhadap fitur baru saat
> investigasi bug nanti.

---

## 1. Test (Wajib)

Minimal coverage per tipe fitur:

| Tipe Fitur | Test Wajib | Lokasi |
|------------|-----------|--------|
| HTTP endpoint baru | 3 case: happy path, unauthorized, invalid input / not found | `tests/integration/<domain>.test.ts` |
| Domain logic / service / util | Unit test untuk happy path + minimal 1 edge case | `tests/unit/<name>.test.ts` |
| Schema field baru (Prisma) | Migration jalan + minimal 1 integration test yang menyentuh field tsb | sda |
| WS channel baru | Test koneksi + 1 test broadcast/receive | `tests/integration/ws-<name>.test.ts` |
| Frontend route baru | Tidak wajib unit test, tapi backend yang dipanggilnya wajib ikut aturan di atas | — |

Aturan:
- Pakai pattern `createTestApp()` + `app.handle(new Request(...))` dari
  `tests/helpers.ts` — **tidak perlu** menjalankan server.
- Sebelum claim selesai: `bun run test` harus hijau, `bun run typecheck`
  harus hijau, `bun run lint` harus hijau.
- Endpoint yang masuk kontrak publik (lihat `docs/AI_CONTRACT.md` §10)
  juga butuh contract test di `tests/contract/`.

---

## 2. Tool `debug-dev` (Wajib)

Setiap fitur baru wajib bisa diinspeksi via MCP server `debug-dev`
(`scripts/mcp/server.ts`, modul di `scripts/mcp/tools/*.ts`).

Bentuk tool yang diminta tergantung jenis fitur:

| Fitur Baru | Tool Inspeksi Minimum | File Tool |
|------------|----------------------|-----------|
| Endpoint admin / domain baru | List + get-by-id (readonly) di tool module yang relevan | `scripts/mcp/tools/<domain>.ts` |
| Tabel/model Prisma baru | Row count + sample read | `scripts/mcp/tools/db.ts` atau modul baru |
| Redis key namespace baru | List keys + get value | `scripts/mcp/tools/redis.ts` |
| Log/event stream baru | Tail / filter terakhir N entri | `scripts/mcp/tools/logs.ts` |
| WS channel / presence baru | Snapshot state saat ini | `scripts/mcp/tools/presence.ts` atau modul baru |
| Mutation berisiko (block/role/migration) | Tool tertulis terpisah dengan input tervalidasi (zod) | `scripts/mcp/tools/<domain>.ts` |

Aturan:
- **Readonly default, write opt-in.** Tool yang mengubah state harus
  diberi nama eksplisit (`admin_...`, `dev_...`) dan tervalidasi.
- Selalu daftarkan tool baru lewat modul existing dulu — buat file baru
  hanya jika tidak ada modul yang cocok (lihat `docs/FILE-HEALTH.md`).
- Tool baru harus muncul saat MCP server dipanggil — verifikasi via
  `scripts/mcp/test-client.ts` sebelum claim selesai.

---

## 3. Tool `debug-stg` (Wajib)

Tool inspeksi di staging berjalan via `scripts/mcp/stg-server.ts` dan
modul tunggal `scripts/mcp/tools/stg.ts`. Fungsinya: menyentuh staging
HANYA via HTTP (`BASE_URL` + `MCP_SECRET`) — **tidak** akses langsung
DB/Redis staging.

| Fitur Baru | Tool Inspeksi Minimum |
|------------|----------------------|
| Endpoint readonly (GET) | Tool yang memanggil endpoint tsb di STG dan return hasilnya |
| Endpoint write (POST/PUT/DELETE) | Tool readonly yang memverifikasi efek (mis. setelah create, list & cek ada) |
| Schema field baru | Tool readonly yang menampilkan field tsb dari endpoint terkait |
| Log/event baru | Tool yang menarik log STG via endpoint admin yang sudah ada |

Aturan:
- Tool `debug-stg` **dilarang** menulis ke STG kecuali user eksplisit
  meminta (default: readonly).
- Setiap endpoint baru di `debug-dev` yang readonly punya pasangan di
  `debug-stg` — kecuali endpoint tsb memang khusus dev (mis. dev-auth).
- Output tool harus aman ditampilkan — jangan dump password hash,
  session token mentah, atau secret lain.

---

## Checklist Akhir Sebelum Claim Selesai

- [ ] `bun run test` hijau (unit + integration)
- [ ] `bun run typecheck` hijau
- [ ] `bun run lint` hijau
- [ ] Tool inspeksi tersedia di `scripts/mcp/tools/` dan terpanggil di `debug-dev`
- [ ] Tool inspeksi tersedia di `scripts/mcp/tools/stg.ts` dan terpanggil di `debug-stg` (readonly)
- [ ] Update dokumentasi yang relevan (lihat tabel "Update Dokumentasi" di `CLAUDE.md`) — wajib bila menyentuh business logic
- [ ] Tidak ada file yang melewati batas di `docs/FILE-HEALTH.md`

---

## Pengecualian

Boleh **skip salah satu** dari 3 syarat di atas **hanya jika** user
eksplisit bilang "skip test", "skip mcp dev", atau "skip mcp stg" untuk
fitur tersebut. Catat alasannya di commit message. Default: ketiganya
wajib.
