# WA-VERIFY — Verifikasi Nomor Inbound (WAV)

Sistem verifikasi kepemilikan nomor WhatsApp dengan pola **inbound / reverse
verification (proof-of-possession)**: alih-alih dashboard mengirim OTP keluar
(rawan ban), **user yang membuktikan kepemilikan dengan MENGIRIM token ke nomor
WA-server**. Dashboard hanya **menerima** — tak pernah mengirim duluan — sehingga
di luar jangkauan kebijakan anti-ban OTP.

Dipakai oleh consumer app eksternal (mis. 10 app yang terdampak pembatasan OTP).
Tiap app terdaftar sebagai **consumer** dengan **isolasi penuh**: satu app tak
bisa melihat atau memverifikasi request milik app lain.

---

## Alur

```
Consumer app                Dashboard (WAV)            User
     │                            │                      │
     │  POST /api/verify/start    │                      │
     │  (header x-api-key)        │                      │
     │ ─────────────────────────► │                      │
     │  { id, token, sendTo }     │                      │
     │ ◄───────────────────────── │                      │
     │                            │   tampilkan token +  │
     │ ─────────────────────────────────────────────────►│
     │                            │                      │ kirim "WAV-XXXXXXXX"
     │                            │   poller nangkap     │ via WhatsApp ke sendTo
     │                            │ ◄─────────────────── (getChats polling 4s)
     │                            │  match → VERIFIED     │
     │  webhook push (HMAC)       │                      │
     │ ◄───────────────────────── │                      │
     │  ATAU GET /api/verify/:id  │                      │
     │ ─────────────────────────► │                      │
     │  { status: 'VERIFIED' }    │                      │
     │ ◄───────────────────────── │                      │
```

**DB adalah sumber kebenaran.** Polling (`GET /api/verify/:id`) selalu jalan walau
webhook gagal total. Webhook hanya notifikasi best-effort.

### Login vs Discovery

`POST /api/verify/start` menerima `expectedPhone` opsional:

- **Login** (`expectedPhone` diisi) — consumer sudah tahu nomor yang diharapkan
  (mis. verifikasi ulang akun existing). `expectedPhone` dinormalisasi & dicatat;
  nomor yang benar-benar match disimpan di `matchedPhone`. Consumer membandingkan
  sendiri `matchedPhone` vs nomor akun saat menerima hasil.
- **Discovery** (`expectedPhone` kosong) — signup nomor baru; nomor pengirim
  token-lah yang menjadi nomor terverifikasi (`matchedPhone`).

> Matcher tidak menolak otomatis bila `matchedPhone ≠ expectedPhone`; keputusan
> akhir diserahkan ke consumer (lihat payload webhook & polling yang membawa
> kedua field). Token tetap one-time — siapa pun yang mengirim token valid
> pertama kali yang menang.

---

## Token

- Format: `WAV-` + 8 karakter base32 tanpa ambigu.
- Alfabet: `ABCDEFGHJKMNPQRSTUVWXYZ234567` (tanpa `0/1/8/9`, `O/I/L`).
- Regex deteksi di pesan masuk: `/\bWAV-[0-9A-Z]{8}\b/i` (**case-insensitive** —
  keyboard HP kerap meng-autocapitalize/autocorrect; token yang terdeteksi
  dinormalisasi ke uppercase sebelum lookup karena tersimpan uppercase).
- **Token boleh dikelilingi kata penjelasan** (batas kata `\b`) — user tak harus
  mengirim token telanjang. Instruksi default menyuruh user mengirim kalimat
  `Verifikasi nomor saya: WAV-XXXXXXXX` (token di akhir agar batas kata bersih).
  Pembangun pesan/instruksi: `buildVerifyMessage` & `buildVerifyInstruction`
  (sumber tunggal, dipakai public router, sim router, dan pre-fill `wa.me`).
- **One-time**: dijaga unique index + `updateMany` guard `status=PENDING` (satu
  pemenang race, idempoten terhadap pesan dobel dari reconnect).
- **TTL 5 menit** (`TOKEN_TTL_MS`). Lewat itu → `EXPIRED` (live-check saat poll;
  sweep mem-persist).

Generator & matcher: `src/lib/wa-verify.ts`.

---

## Isolasi antar consumer

`consumerId` **selalu** diturunkan dari API key (header `x-api-key` → hash lookup),
**tak pernah** dari body/param — cermin pola `sessionId = authUser.id`.

- `POST /api/verify/start` → `consumerId` dari API key.
- `GET /api/verify/:id` → query di-scope `WHERE id AND consumerId`. Request milik
  app lain tampak **tidak ada** (404), bukan 403 — tak membocorkan eksistensi.

### API key

`src/lib/wa-verify-keys.ts`:

- **Generate**: `wav_sk_` + `randomBytes(24).toString('base64url')`. Plaintext
  ditampilkan **SEKALI** saat create/regenerate — tak disimpan.
- **Simpan**: `apiKeyHash = HMAC-SHA256(key, BETTER_AUTH_SECRET)` (deterministik →
  lookup ber-index `WHERE apiKeyHash`, bukan iterasi). `apiKeyPrefix` (12 char
  pertama) disimpan untuk identifikasi non-sensitif di UI.
- **Verify**: hash input → lookup row → `timingSafeEqual` (anti timing attack).

Plugin auth: `verifyConsumerPlugin` (`src/lib/wa-verify-auth.ts`) — derive Elysia
yang membaca `x-api-key`, resolve consumer **aktif**, inject `verifyConsumer` (atau
`null` → 401). Endpoint consumer-facing **tak pakai session cookie**.

---

## Capture: supervisor polling always-on

`src/lib/wa-verify-poller.ts` — supervisor REST-polling hidup 24/7 lepas dari
browser (beda dari `wa-bridge.ts` yang browser-driven). Menggantikan listener WS
lama: WS upgrade ke container 502 di edge Cloudflare, jadi capture tak pernah
tertangkap. Polling REST tahan NAT/proxy dan latency turun ke ~interval poll.

Hanya **satu nomor server** yang didengarkan, ditentukan `WA_VERIFY_SERVER_NUMBER`
(bukan tiap user) — token inbound selalu dikirim user ke nomor itu.

1. **Reconcile loop** (`RECONCILE_MS = 30s` + sekali saat boot) →
   `resolveServerSession()`:
   - `wa.getSessions()` → daftar session id di container.
   - Cari id yang `getStatus` CONNECTED **dan** nomor akunnya
     (`getClassInfo → sessionInfo.wid.user`, dibandingkan mentah, bukan ter-mask)
     cocok dengan `normalizePhone(WA_VERIFY_SERVER_NUMBER)`. Balas id atau `null`.
2. **Poll loop** (`POLL_INTERVAL_MS = 4s`) → `pollOnce(sessionId)`:
   - `wa.getChats(sessionId)` → tiap chat punya `lastMessage { from, body, fromMe, timestamp }`
     (`timestamp` = epoch **detik**; `t` hanya ada di payload mentah `_data` → fallback).
   - Watermark per-session di Redis `wa:verify:watermark:<sessionId>` (epoch **ms**,
     tanpa TTL). Bootstrap = `Date.now()` saat key belum ada → riwayat lama di-skip.
   - `filterNewInbound(chats, watermark)` (fungsi pure, di-export untuk unit test):
     pesan ikut bila `fromMe === false` & `timestamp*1000 > watermark`. Tiap pesan →
     `handleInbound`. Watermark maju ke `timestamp` terbesar yang terlihat.
3. **Matcher** (`handleInbound`, `src/lib/wa-verify.ts`) menerima pengirim personal
   `@c.us` **dan** `@lid` (varian id pengirim pada pesan inbound nyata), menolak grup
   `@g.us` & broadcast.

**Batasan diketahui:** `getChats` hanya membawa `lastMessage` per chat. Bila user
kirim token lalu kirim pesan lain ke chat yang sama dalam **satu interval poll
(≤4s)**, token bisa terlewat. Mitigasi: interval pendek (cukup untuk pola WAV: user
kirim satu token lalu menunggu). `fetchMessages` per-chat sengaja tak dipakai (mahal).

**Inspeksi:** state poller (`running`, `sessionId`, `watermark`, nomor server
ter-mask, `lastPollAt`, `lastError`, `pollIntervalMs`) via `getSupervisorState()`,
diekspos di `GET /api/wa/verify/supervisor` (guardAdmin — nomor ter-mask), MCP `wa_verify_supervisor`
(debug-dev), dan `stg_wa_verify_supervisor` (debug-stg).

Boot: `startWaVerifySupervisor()` dipanggil di `src/index.tsx`. Graceful no-op bila
`WA_API_BASE_URL` / `WA_API_KEY` / `WA_VERIFY_SERVER_NUMBER` kosong.

---

## Webhook push ke consumer

`src/lib/wa-verify-webhook.ts`. Dipicu async (best-effort) dari matcher saat match,
juga dari sweep & replay manual.

**Payload** (`POST` ke `consumer.webhookUrl`):

```json
{
  "event": "verify.succeeded",
  "id": "<requestId>",
  "matchedPhone": "6281234566789",
  "expectedPhone": "6281234566789",
  "verifiedAt": "2026-06-24T10:00:00.000Z"
}
```

> Token **tidak** disertakan di payload — consumer mengkorelasikan via `id`
> (yang sama dengan `id` dari `POST /api/verify/start`).

**Headers**:

| Header | Isi |
|--------|-----|
| `X-WAV-Signature` | `sha256=<HMAC-SHA256(rawBody, consumer.webhookSecret)>` |
| `X-WAV-Idempotency-Key` | `<requestId>` — sama untuk semua retry request itu |
| `X-WAV-Attempt` | nomor attempt (`1`..`5`) |

Consumer memverifikasi keaslian dengan menghitung ulang HMAC body memakai
`webhookSecret` (muncul di modal saat consumer dibuat, dan bisa di-reveal ulang
kapan saja lewat `GET /api/wa/verify/consumers/:id/reveal-secret` — secret
disimpan plaintext, beda dari apiKey yang di-hash) dan membandingkan
`X-WAV-Signature`.

**Retry & status delivery** (kolom di `VerifyRequest`):

- `deliveryStatus`: `PENDING` (belum/akan retry) → `DELIVERED` (2xx) / `FAILED`
  (mentok `MAX_ATTEMPTS=5`) / `DISABLED` (consumer tanpa `webhookUrl`, polling-only).
- Backoff via **sweep periodik** (`retryPendingWebhooks`, mirror `cleanupAuditLogs`
  di `index.tsx`): ambil `VERIFIED` dengan `deliveryStatus ∈ {PENDING,FAILED}` &
  `attempts < 5` → retry (take 50).
- **Replay manual** (SUPER_ADMIN): `POST /api/wa/verify/requests/:id/replay` →
  reset attempts & kirim ulang. 409 dengan `reason` (`not_found`/`not_verified`/
  `no_webhook`) bila tak bisa.

Timeout per attempt: `10s` (AbortController).

---

## Balasan otomatis ke user (opsional, default MATI)

Selain webhook ke consumer, nomor server **dapat membalas user via WhatsApp** saat
verifikasi berhasil ("Nomor Anda berhasil terverifikasi…"). Ini aman: membalas pesan
**inbound** (user kirim duluan) adalah pola kirim paling aman — bukan cold outreach.

**Default MATI** (`WaPolicy.verifyReplyEnabled=false`) untuk menjaga sifat *receive-only*
(nyaris unbannable) nomor server sampai operator sengaja menyalakan di `/wa?tab=policy`
(SUPER_ADMIN). Teks kustom via `verifyReplyMessage`; kosong/null → varian default di kode
(`DEFAULT_VERIFY_REPLY_MESSAGE`, dipilih deterministik per-request agar tak seragam identik
— anti sidik-jari spam). Tombol "Kembalikan ke default" di UI mengembalikan ke null.

Alur (`sendVerifyReply()` di `src/lib/wa-verify-reply.ts`, dipicu best-effort dari
`handleInbound` blok pemenang match — sejajar dispatch webhook):
1. Berhenti bila `verifyReplyEnabled` MATI.
2. **Idempotency claim**: `updateMany` set `VerifyRequest.replySentAt` dengan guard
   `status=VERIFIED, replySentAt=null` → hanya satu pemenang. Poller yang re-run / match
   dobel → `count=0` → berhenti (tak kirim dobel).
3. Rekonstruksi `chatId = <matchedPhone>@c.us` (hindari `@lid` yang tak selalu bisa dibalas).
4. Gate `checkAndConsume(sessionId, chatId, { skipOutreachGates: true })` — melewati aturan
   **ack** & **first-contact** (khusus kirim-duluan manual; balasan inbound tak butuh)
   tapi tetap tunduk **min-interval, cooldown per-nomor, plafon volume**. Plafon tercapai →
   balasan **di-skip diam** (`appLog('info')`), verifikasi TETAP sukses via polling/webhook.
5. `wa.sendMessage(...)` + audit `WA_VERIFY_REPLY_SENT`. Kegagalan upstream di-`appLog('warn')`,
   tak pernah menggagalkan verifikasi.

Zero PII: teks balasan tak pernah menyisipkan nomor/token.

---

## Endpoint

### Consumer-facing (auth: API key `x-api-key`)

`src/routes/wa.verify.public.ts`:

| Method | Path | Desc |
|--------|------|------|
| POST | `/api/verify/start` | Body `{ expectedPhone? }` → `{ id, token, sendTo, expiresAt, instruction }`. 503 bila gagal generate token (token collision 5×). |
| GET | `/api/verify/:id` | Poll `{ status, matchedPhone, verifiedAt, expiresAt }`. Scoped consumerId → 404 cross-consumer. Live-cek expiry → `EXPIRED`. |

API key invalid / consumer non-aktif → **401**.

### Management (auth: session cookie)

`src/routes/wa.verify.admin.ts` (consumer CRUD) & `src/routes/wa.verify.logs.ts`
(inspeksi) — dipisah demi batas file-health.

| Method | Path | Guard | Desc |
|--------|------|-------|------|
| GET | `/api/wa/verify/consumers` | guardAdmin | List consumer + `_count.requests` + `canEdit` |
| POST | `/api/wa/verify/consumers` | guardSuperAdmin | Buat consumer → balas `apiKey` **sekali** |
| PUT | `/api/wa/verify/consumers/:id` | guardSuperAdmin | Update name/webhookUrl/active (404 bila tak ada) |
| POST | `/api/wa/verify/consumers/:id/regenerate-key` | guardSuperAdmin | Regen apiKey (balas sekali) |
| GET | `/api/wa/verify/consumers/:id/reveal-secret` | guardSuperAdmin | Reveal `webhookSecret` plaintext (disimpan plaintext → boleh di-reveal ulang, beda dari apiKey yang di-hash). 404 bila tak ada |
| DELETE | `/api/wa/verify/consumers/:id` | guardSuperAdmin | Hapus consumer (cascade requests) |
| GET | `/api/wa/verify/requests` | guardAdmin | List request terbaru (`?limit` max 200), **matchedPhone ter-mask** |
| GET | `/api/wa/verify/inbound` | guardAdmin | Raw inbound log (`?limit` max 200) |
| POST | `/api/wa/verify/requests/:id/replay` | guardSuperAdmin | Replay webhook (409 + reason bila gagal) |

Audit actions: `WA_VERIFY_CONSUMER_CREATED/UPDATED/DELETED`, `WA_VERIFY_KEY_REGENERATED`,
`WA_VERIFY_SECRET_REVEALED`, `WA_VERIFY_REPLAY`.

---

## Privasi & PII

- Nomor **selalu di-mask** di log & endpoint inspeksi (`maskPhone`: `628****6789`).
  `matchedPhone` mentah hanya dipakai internal (match) & dikirim ke consumer via
  webhook/polling — bukan ke UI dashboard.
- **Token tak pernah di-log utuh** maupun dikirim di payload webhook.
- `VerifyInboundLog` menyimpan `fromMasked` (sudah ter-mask) + `tokenFound` (token
  yang terdeteksi, untuk audit match), TTL ~24 jam (dibersihkan sweep).

---

## Env

| Env | Default | Keterangan |
|-----|---------|------------|
| `WA_VERIFY_SERVER_NUMBER` | `''` | Nomor server tujuan kirim token (untuk `sendTo`/instruksi ke user) **dan** kunci yang dipakai supervisor untuk memilih session container yang di-poll. Bila kosong, supervisor idle (no-op). |

Reuse `WA_API_BASE_URL` + `WA_API_KEY` (container wwebjs-api) untuk poller.

---

## Frontend

Tab **Verifikasi Nomor** di `/wa?tab=verify` (icon `TbShieldCheck`, ADMIN+SUPER_ADMIN).
Komponen di `src/frontend/components/wa/`: `WaVerifyPanel` (orchestrator),
`WaVerifyConsumers` (CRUD + apiKey modal sekali-tampil), `WaVerifyLogs` (request +
replay), `WaVerifyInbound` (raw log, SUPER_ADMIN saja). Lihat `docs/FRONTEND.md`.

## Simulasi Login (browser, pra-rilis)

Tab `/wa?tab=simulation` (SUPER_ADMIN) menjalankan alur login WAV end-to-end
lewat browser sebelum rilis: dari "halaman login palsu" → klik → buka WhatsApp dengan
token terisi → operator kirim → dashboard poll sampai `VERIFIED`. Sifatnya uji, jadi
ikut menampilkan **log timeline berstempel waktu** tiap langkah (untuk developer).

**Proxy server-side (Opsi A)**: endpoint cookie-auth SUPER_ADMIN `/api/wa/verify/sim/*`
menjalankan start/poll memakai consumer reserved `[simulation]` (lazy-create idempoten,
`getOrCreateSimConsumer` di `src/lib/wa-verify-sim.ts`). **API key tak pernah ke browser**,
tapi pipeline 100% asli. Request sim = `VerifyRequest` biasa → tertangkap poller & muncul di
panel Requests. Inti start/poll dibagi public router via `src/lib/wa-verify-flow.ts`.

**Kendala jujur**: deep-link `wa.me` hanya **pre-fill** teks (kalimat
`Verifikasi nomor saya: WAV-XXXXXXXX`) — "kirim otomatis" mustahil (model keamanan
WhatsApp/OS), operator tetap tap kirim. UI menyebut ini apa adanya.

v1 hanya **mode Login** (`expectedPhone` diisi). QR via `GET /api/wa/verify/sim/:id/qr`
(PNG, `qrcode` server-side — token di-lookup via id, bukan teks query arbitrer). Audit
`WA_VERIFY_SIM_START`. Endpoint detail: `docs/API.md`. Komponen: `docs/FRONTEND.md`.

## E2E testing (Hurl + MCP)

Uji alur WAV di dunia nyata via file `.hurl` yang **dibaca manusia sekaligus
dieksekusi tool** — satu sumber kebenaran, nol duplikasi logika alur.

### File `.hurl` (`hurl/wa-verify/`)

- `start.hurl` — langkah 1: `POST /api/verify/start` (assert token format +
  capture `request_id`/`wav_token`/`send_to`).
- `poll.hurl` — langkah 3: `GET /api/verify/:id` dengan retry built-in (3s × 100 ≈
  TTL 5 menit), assert `status == VERIFIED`.

Semua nilai diinjeksi via `--variable` (base_url, api_key, expected_phone,
request_id) — **tak ada secret di file**. Jalankan manual:

```bash
hurl --variable base_url=http://localhost:3111 \
     --variable api_key=wav_sk_xxx \
     --variable expected_phone=628123456789 \
     hurl/wa-verify/start.hurl
# kirim token via WhatsApp ke send_to, lalu:
hurl --variable base_url=http://localhost:3111 \
     --variable api_key=wav_sk_xxx \
     --variable request_id=<id> \
     hurl/wa-verify/poll.hurl
```

### Human-in-the-loop (langkah 2 tak bisa diotomatiskan)

Langkah inbound — manusia **fisik mengirim** `WAV-XXXXXXXX` via WhatsApp ke nomor
server — tak bisa dijalankan agent. Tool MCP berpola **start → (pause: manusia kirim)
→ poll**: `wa_verify_e2e_start` balas token + instruksi eksplisit lalu berhenti; agent
menunggu konfirmasi manusia sebelum `wa_verify_e2e_poll`.

### Prasyarat: install `hurl`

`hurl` adalah binary standalone (libcurl), **bukan** paket npm/bun — tak ada di
`package.json`. Install: `brew install hurl` (macOS) / lihat
<https://hurl.dev/docs/installation.html>. Tool MCP degrade rapi bila absen
(kembalikan instruksi install, tidak crash) — kontributor tanpa hurl tetap bisa
menjalankan unit test parser.

## MCP

Tools inspeksi: `wa_verify_consumers`/`wa_verify_requests`/`wa_verify_inbound`
(readonly) + `wa_verify_replay` (admin) di dev; `stg_wa_verify_consumers`/
`stg_wa_verify_requests`/`stg_wa_verify_inbound` di staging.

E2E real-world (admin, dev): `wa_verify_e2e_start` (spawn `start.hurl` → token +
nextStep) + `wa_verify_e2e_poll` (spawn `poll.hurl` → status VERIFIED). Pasangan
`debug-stg` ditunda sebagai follow-up. Lihat `docs/MCP.md`.
