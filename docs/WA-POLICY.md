# WA Anti-Ban Policy — Kontrak Sumpah Pengikat

Dashboard ini mengirim WhatsApp lewat **wwebjs-api**, klien WhatsApp Web yang
**tidak resmi** dan melanggar Terms of Service Meta. Risiko suspend/ban bersifat
permanen dan tidak bisa dihilangkan — hanya bisa **ditekan**. Dokumen ini adalah
kontrak perilaku yang **ditegakkan oleh kode**, bukan sekadar imbauan.

Teks kontrak yang ditampilkan ke user berada di `src/lib/wa-contract.ts`
(`WA_CONTRACT`, single source of truth, dipakai frontend tab "Aturan & Kontrak").
Enforcement teknisnya di `src/lib/wa-policy.ts`.

---

## Aturan yang ditegakkan di `POST /api/wa/send`

`checkAndConsume(userId, chatId)` mengecek berurutan (fail-fast, consume kuota
hanya bila semua lolos):

| # | Aturan | Field policy | Gagal → |
|---|--------|--------------|---------|
| 1 | Wajib acknowledge kontrak versi terbaru | `requireAck` | **403** |
| 2 | Larang kirim duluan ke nomor non-kontak / belum chat | `allowFirstContact` | **403** |
| 3 | Jeda minimum antar pesan | `minIntervalSeconds` | **429** + `retryAfter` |
| 4 | Cooldown per nomor | `perRecipientCooldownSeconds` | **429** + `retryAfter` |
| 5 | Plafon volume menit / jam / hari | `maxPerMinute/Hour/Day` | **429** + `retryAfter` |

- **403** = pelanggaran kebijakan (belum ack / first-contact diblokir).
- **429** = rate/cooldown; body menyertakan `retryAfter` (detik).
- Tiap pemblokiran dicatat `appLog('warn')` + audit `WA_SEND_BLOCKED`.

"Nomor dikenal" = tersimpan sebagai kontak **atau** sudah ada riwayat chat
(gabungan `getContacts` + `getChats`, di-cache Redis `wa:known:<userId>` 300s).
Konsekuensi: kontak yang baru disimpan butuh ≤5 menit untuk dikenali gate.

---

## Konfigurasi (singleton `wa_policy`, id `global`)

| Field | Default | Range | Arti |
|-------|---------|-------|------|
| `allowFirstContact` | `false` | bool | Izinkan kirim duluan (mode OTP). **Default MATI.** |
| `requireAck` | `true` | bool | Wajib setujui kontrak sebelum kirim |
| `maxPerMinute` | `3` | 1–1000 | Plafon pesan per menit |
| `maxPerHour` | `20` | 1–10000 | Plafon pesan per jam |
| `maxPerDay` | `100` | 1–100000 | Plafon pesan per hari |
| `minIntervalSeconds` | `8` | 0–3600 | Jeda minimum antar pesan |
| `perRecipientCooldownSeconds` | `60` | 0–86400 | Jeda kirim ke nomor sama |
| `contractVersion` | `1` | — | Versi kontrak; naikkan saat isi berubah material |

- Policy **global** (satu config untuk semua user). Baca: ADMIN+. Ubah: **SUPER_ADMIN saja**.
- Baris default dibuat lazy oleh `getPolicy()` (upsert) — tidak ada seed/data migration.
- Cache Redis `wa:policy:cache` TTL 30s; PUT meng-invalidate cache.

---

## Mode OTP (first-contact) — berisiko tinggi

OTP secara definisi adalah kirim-duluan ke nomor baru, jadi melanggar aturan #2.
Disediakan escape-hatch sadar:

- Toggle `allowFirstContact` **DEFAULT OFF** — aman out-of-the-box.
- Hanya **SUPER_ADMIN** yang bisa menyalakannya (PUT `/api/wa/policy`),
  dan aktivasi tercatat di audit `WA_POLICY_UPDATED`.
- Saat aktif, pakai volume serendah mungkin dan nomor yang sudah berumur & aktif harian.

---

## Yang tetap tidak bisa dijamin

Tidak ada konfigurasi yang membuat risiko ban menjadi nol selama memakai klien
tidak resmi. Penerima yang memblokir/melaporkan, nomor baru, dan update deteksi
Meta tetap di luar kendali. Untuk produksi berisiko rendah: gunakan WhatsApp
Business API resmi via penyedia (BSP).

---

## Acknowledge

`POST /api/wa/policy/ack` mencatat ack versi terbaru di Redis `wa:policy:ack:<userId>`
(`{ version, at }`) + audit `WA_POLICY_ACK`. Saat `contractVersion` dinaikkan,
ack lama (`version < contractVersion`) tidak lagi sah — user harus ack ulang
sebelum bisa kirim.

`DELETE /api/wa/policy/ack` membatalkan ack: hapus key `wa:policy:ack:<userId>` +
audit `WA_POLICY_ACK_REVOKED`. Setelah dibatalkan, pengiriman kembali diblokir
oleh gate `requireAck` sampai user menyetujui ulang. Di UI, tombol "Batalkan
persetujuan" (merah) muncul di `WaContractView` saat sudah disetujui, dengan
modal konfirmasi.

---

## Lihat juga

- Endpoint: `docs/API.md` (WA Policy + enforcement send)
- Redis keys & model: `docs/DATABASE.md` (`WaPolicy`, `wa:rl:*`, `wa:policy:*`, `wa:known:*`)
- MCP tools: `docs/MCP.md` (`wa_policy_get/usage/set`, `stg_wa_policy`)
- Frontend: `docs/FRONTEND.md` (tab `?tab=policy`, panel `components/wa/`)
