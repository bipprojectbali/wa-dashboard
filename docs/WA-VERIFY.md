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
     │                            │   listener nangkap   │ via WhatsApp ke sendTo
     │                            │ ◄─────────────────── (WS dari container)
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
- Regex deteksi di pesan masuk: `/\bWAV-[0-9A-Z]{8}\b/`.
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

## Capture: supervisor always-on

`src/lib/wa-verify-listener.ts` — `WaVerifySupervisor`. Listener WhatsApp hidup
24/7 lepas dari browser (beda dari `wa-bridge.ts` yang browser-driven).

1. **Reconcile loop** (`RECONCILE_MS = 30s` + sekali saat boot):
   - `wa.getSessions()` → daftar session id di container.
   - **Validasi tiap id terhadap DB**: hanya user `role ∈ {ADMIN, SUPER_ADMIN}` &
     `blocked=false` yang didengarkan. Inilah filter yang mencegah mendengarkan
     sesi asing.
   - Session valid tanpa listener → buka WS persisten. Listener yang session-nya
     hilang/invalid → tutup & lepas. Idempoten (keyed `Map<sessionId, Listener>`).
2. **Per-session WS** ke `<WA_API_BASE_URL→ws>/ws/<sessionId>` dengan header
   `x-api-key`. Reconnect backoff `min(1000·2^retry, 30s)`. Outbound
   dashboard→container (tahan NAT), mirror mekanik `wa-bridge.ts`.
3. **onmessage** → parse frame `{ dataType, data: { message }, sessionId }`; hanya
   `dataType === 'message'`. Filter: `fromMe === false` & `from` diakhiri `@c.us`
   (abaikan grup & pesan sendiri) → serahkan ke `handleInbound`.

Boot: `startWaVerifySupervisor()` dipanggil di `src/index.tsx` (sebelah
`cleanupAuditLogs()`). Graceful no-op bila `WA_API_BASE_URL`/`WA_API_KEY` kosong.

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
`webhookSecret` (diberikan saat consumer dibuat) dan membandingkan
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
| DELETE | `/api/wa/verify/consumers/:id` | guardSuperAdmin | Hapus consumer (cascade requests) |
| GET | `/api/wa/verify/requests` | guardAdmin | List request terbaru (`?limit` max 200), **matchedPhone ter-mask** |
| GET | `/api/wa/verify/inbound` | guardSuperAdmin | Raw inbound log (`?limit` max 200) |
| POST | `/api/wa/verify/requests/:id/replay` | guardSuperAdmin | Replay webhook (409 + reason bila gagal) |

Audit actions: `WA_VERIFY_CONSUMER_CREATED/UPDATED/DELETED`, `WA_VERIFY_KEY_REGENERATED`,
`WA_VERIFY_REPLAY`.

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
| `WA_VERIFY_SERVER_NUMBER` | `''` | Nomor server tujuan kirim token (untuk `sendTo`/instruksi ke user). Bila kosong, consumer menampilkan nomor via UI sendiri. |

Reuse `WA_API_BASE_URL` + `WA_API_KEY` (container wwebjs-api) untuk listener.

---

## Frontend

Tab **Verifikasi Nomor** di `/wa?tab=verify` (icon `TbShieldCheck`, ADMIN+SUPER_ADMIN).
Komponen di `src/frontend/components/wa/`: `WaVerifyPanel` (orchestrator),
`WaVerifyConsumers` (CRUD + apiKey modal sekali-tampil), `WaVerifyLogs` (request +
replay), `WaVerifyInbound` (raw log, SUPER_ADMIN saja). Lihat `docs/FRONTEND.md`.

## MCP

Tools inspeksi: `wa_verify_consumers`/`wa_verify_requests`/`wa_verify_inbound`
(readonly) + `wa_verify_replay` (admin) di dev; `stg_wa_verify_consumers`/
`stg_wa_verify_requests`/`stg_wa_verify_inbound` di staging. Lihat `docs/MCP.md`.
