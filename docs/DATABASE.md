# Database & Storage

## PostgreSQL (Prisma v6)

Client generated to `./generated/prisma` (gitignored). Import via `src/lib/db.ts`:
```ts
import { prisma } from './lib/db'
```

Commands: `bun run db:migrate` | `bun run db:seed` | `bun run db:generate`

### Schema (`prisma/schema.prisma`)

| Model | Key Fields |
|-------|-----------|
| `User` | id, name, email, password?, role, blocked, emailVerified, image, timestamps |
| `Session` | id, token (unique), userId, expiresAt, ipAddress, userAgent, timestamps |
| `Account` | id, accountId, providerId, userId, password? — Better Auth credential storage |
| `Verification` | id, identifier, value, expiresAt — Better Auth email verification |
| `AuditLog` | id, userId?, action, detail?, ip?, createdAt |
| `Ticket` | id, title, description, status, priority, route?, reporterId, assigneeId?, timestamps, closedAt? |
| `TicketComment` | id, ticketId, authorId?, authorTag, body, createdAt |
| `TicketEvidence` | id, ticketId, kind, url, note?, createdAt |
| `WaPolicy` | id (`global` singleton), allowFirstContact, maxPerMinute/Hour/Day, minIntervalSeconds, perRecipientCooldownSeconds, requireAck, contractVersion, updatedAt, updatedById? |
| `VerifyConsumer` | id, name, apiKeyHash (unique), apiKeyPrefix, webhookUrl?, webhookSecret, active, createdById?, timestamps — app eksternal yang memakai WAV |
| `VerifyRequest` | id (= polling id), consumerId, token (unique), expectedPhone?, status, matchedPhone?, matchedMessageId?, expiresAt, verifiedAt?, deliveryStatus, deliveryAttempts, lastDeliveryAt?, lastDeliveryError?, createdAt |
| `VerifyInboundLog` | id, sessionId, fromMasked, tokenFound?, matched, consumerId?, createdAt — audit pesan masuk (nomor ter-mask) |

Enums: `Role` = `USER | QC | ADMIN | SUPER_ADMIN`; `TicketStatus` = `OPEN | IN_PROGRESS | READY_FOR_QC | REOPENED | CLOSED`; `TicketPriority` = `LOW | MEDIUM | HIGH | CRITICAL`; `VerifyStatus` = `PENDING | VERIFIED | EXPIRED`; `VerifyDelivery` = `PENDING | DELIVERED | FAILED | DISABLED`

`WaPolicy` adalah singleton (1 baris `id="global"`). Dibuat lazy lewat `getPolicy()`
(upsert) — tidak perlu seed. Default aman out-of-the-box: `allowFirstContact=false`,
`requireAck=true`, cap 3/menit·20/jam·100/hari. Lihat `docs/WA-POLICY.md`.

Model `Verify*` adalah fitur **WAV (WhatsApp Inbound Verification)**. `VerifyConsumer`
= app eksternal terdaftar (API key di-hash, plaintext hanya sekali). `VerifyRequest`
= satu sesi verifikasi (token one-time, status + delivery status webhook).
`VerifyInboundLog` = audit mentah pesan masuk listener (nomor ter-mask, dibersihkan
sweep ~24 jam). Tidak ada Redis key baru untuk WAV. Lihat `docs/WA-VERIFY.md`.

### Seed (`prisma/seed.ts`)

Uses scrypt (`node:crypto`) — same format as Better Auth (`salt:hex`). Stores password in `Account` table (not `User.password`).
Demo users: `superadmin@example.com / superadmin123`, `admin@example.com / admin123`, `user@example.com / user123`

## Redis

Bun native `Bun.RedisClient` — no external package. Import via `src/lib/redis.ts`:
```ts
import { redis } from './lib/redis'
```

### Key Namespaces

| Key Pattern | Content | Owner |
|-------------|---------|-------|
| `ba:kv:<token>` | `{ session, user }` JSON — Better Auth session cache | Better Auth |
| `ba:kv:active-sessions-<userId>` | `[{ token, expiresAt }]` — active session list | Better Auth |
| `app:logs` | Redis List, max 500 entries (LTRIM) | `src/lib/applog.ts` |
| `app:logs:next_id` | Auto-increment for log IDs | `src/lib/applog.ts` |
| `wa:policy:cache` | Policy JSON, TTL 30s | `src/lib/wa-policy.ts` |
| `wa:policy:ack:<userId>` | `{ version, at }` — ack kontrak tercatat | `src/lib/wa-policy.ts` |
| `wa:known:<userId>` | JSON array chatId (kontak+chat), TTL 300s | `src/lib/wa-policy.ts` |
| `wa:rl:last:<userId>` | epoch ms last send (min-interval) | `src/lib/wa-policy.ts` |
| `wa:rl:recip:<userId>:<chatId>` | marker cooldown per nomor, TTL = cooldown | `src/lib/wa-policy.ts` |
| `wa:rl:min\|hour\|day:<userId>` | counter kirim, TTL 60/3600/86400 | `src/lib/wa-policy.ts` |
| `wa:avatar:<userId>:<contactId>` | URL foto profil kontak (string; `""` = tidak punya / upstream error), TTL 3600s sukses · 300s error | `src/routes/wa.client.ts` |

### App Logs (`src/lib/applog.ts`)

```ts
appLog(level, message, detail?)   // 'info' | 'warn' | 'error'
getAppLogs({ level?, limit?, afterId? })
clearAppLogs()
```

Logs API requests via `onAfterResponse` hook (skips `/api/auth/*`). Auto-rotates to 500 entries.

## Audit Logs (DB)

Persistent user activity trail in `AuditLog` table.
Actions: `LOGIN`, `LOGOUT`, `LOGIN_FAILED`, `LOGIN_BLOCKED`, `ROLE_CHANGED`, `BLOCKED`, `UNBLOCKED`, `TICKET_CREATED`, `TICKET_UPDATED`, `WA_SEND_BLOCKED`, `WA_POLICY_UPDATED`, `WA_POLICY_ACK`, `WA_POLICY_ACK_REVOKED`, `WA_VERIFY_CONSUMER_CREATED`, `WA_VERIFY_CONSUMER_UPDATED`, `WA_VERIFY_CONSUMER_DELETED`, `WA_VERIFY_KEY_REGENERATED`, `WA_VERIFY_REPLAY`, `WA_SESSION_TERMINATED`
Auto-cleanup: records older than `AUDIT_LOG_RETENTION_DAYS` (default 90) — runs on startup + every 24h.

## WhatsApp API (wwebjs-api container)

External REST container ([wwebjs-api](https://github.com/avoylenko/wwebjs-api)), bukan storage internal. Diakses via `src/lib/wa-client.ts` (server-side only).

| Env | Default | Keterangan |
|-----|---------|------------|
| `WA_API_BASE_URL` | `''` (trailing slash dibuang) | Base URL container, mis. `https://wa-api.wibudev.com` |
| `WA_API_KEY` | `''` | Disuntik sebagai header `x-api-key` — jangan commit nilainya, jangan kirim ke browser |

`sessionId` di container = dashboard `user.id` (1 sesi WhatsApp per user). WS relay via `src/lib/wa-bridge.ts` (butuh `ENABLE_WEBSOCKET=true` di container; fallback polling bila tidak aktif).
