import { prisma } from './db'
import { redis } from './redis'
import * as wa from './wa-client'
import { WA_CONTRACT_VERSION } from './wa-contract'

// Enforcement anti-ban untuk pengiriman WhatsApp lewat klien tidak resmi.
// Policy = singleton DB (id "global"); counter & cooldown = Redis per-user.

export interface WaPolicyData {
  id: string
  allowFirstContact: boolean
  maxPerMinute: number
  maxPerHour: number
  maxPerDay: number
  minIntervalSeconds: number
  perRecipientCooldownSeconds: number
  requireAck: boolean
  contractVersion: number
  verifyReplyEnabled: boolean
  verifyReplyMessage: string | null
  updatedAt: Date
  updatedById: string | null
}

const POLICY_ID = 'global'
const POLICY_CACHE_KEY = 'wa:policy:cache'
const POLICY_CACHE_TTL = 30
const KNOWN_TTL = 300

const k = {
  ack: (u: string) => `wa:policy:ack:${u}`,
  known: (u: string) => `wa:known:${u}`,
  last: (u: string) => `wa:rl:last:${u}`,
  recip: (u: string, c: string) => `wa:rl:recip:${u}:${c}`,
  min: (u: string) => `wa:rl:min:${u}`,
  hour: (u: string) => `wa:rl:hour:${u}`,
  day: (u: string) => `wa:rl:day:${u}`,
}

// Baca singleton; buat baris default secara lazy bila belum ada. Cache 30s di Redis.
export async function getPolicy(): Promise<WaPolicyData> {
  try {
    const cached = await redis.get(POLICY_CACHE_KEY)
    if (cached) return JSON.parse(cached) as WaPolicyData
  } catch {}
  const policy = await prisma.waPolicy.upsert({
    where: { id: POLICY_ID },
    update: {},
    create: { id: POLICY_ID },
  })
  redis.set(POLICY_CACHE_KEY, JSON.stringify(policy), 'EX', POLICY_CACHE_TTL).catch(() => {})
  return policy
}

export async function invalidatePolicyCache(): Promise<void> {
  await redis.del(POLICY_CACHE_KEY).catch(() => {})
}

// Catat acknowledge versi kontrak terbaru untuk user.
export async function recordAck(userId: string): Promise<{ version: number; at: string }> {
  const entry = { version: WA_CONTRACT_VERSION, at: new Date().toISOString() }
  await redis.set(k.ack(userId), JSON.stringify(entry)).catch(() => {})
  return entry
}

// Batalkan acknowledge user — hapus key ack. Pengiriman akan kembali tergate
// oleh requireAck sampai user menyetujui ulang.
export async function revokeAck(userId: string): Promise<void> {
  await redis.del(k.ack(userId)).catch(() => {})
}

export async function getAck(userId: string): Promise<{ version: number; at: string } | null> {
  try {
    const raw = await redis.get(k.ack(userId))
    return raw ? (JSON.parse(raw) as { version: number; at: string }) : null
  } catch {
    return null
  }
}

function extractIds(rows: unknown): string[] {
  if (!Array.isArray(rows)) return []
  const out: string[] = []
  for (const r of rows as Array<{ id?: { _serialized?: string } }>) {
    const id = r?.id?._serialized
    if (id) out.push(id)
  }
  return out
}

// chatId yang "dikenal" = tersimpan sebagai kontak ATAU sudah ada riwayat chat.
// Di-cache 300s agar tidak memanggil container tiap kirim.
export async function getKnownRecipients(userId: string): Promise<Set<string>> {
  try {
    const cached = await redis.get(k.known(userId))
    if (cached) return new Set(JSON.parse(cached) as string[])
  } catch {}
  const [contacts, chats] = await Promise.all([
    wa.getContacts(userId).catch(() => null),
    wa.getChats(userId).catch(() => null),
  ])
  const ids = new Set<string>([
    ...extractIds((contacts as { contacts?: unknown })?.contacts),
    ...extractIds((chats as { chats?: unknown })?.chats),
  ])
  redis.set(k.known(userId), JSON.stringify([...ids]), 'EX', KNOWN_TTL).catch(() => {})
  return ids
}

export interface UsageSnapshot {
  minute: { used: number; max: number }
  hour: { used: number; max: number }
  day: { used: number; max: number }
}

export async function getUsage(userId: string, policy?: WaPolicyData): Promise<UsageSnapshot> {
  const p = policy ?? (await getPolicy())
  const [min, hour, day] = await Promise.all([
    redis.get(k.min(userId)).catch(() => null),
    redis.get(k.hour(userId)).catch(() => null),
    redis.get(k.day(userId)).catch(() => null),
  ])
  return {
    minute: { used: Number(min) || 0, max: p.maxPerMinute },
    hour: { used: Number(hour) || 0, max: p.maxPerHour },
    day: { used: Number(day) || 0, max: p.maxPerDay },
  }
}

export type PolicyCheck = { ok: true } | { ok: false; status: 403 | 429; error: string; retryAfter?: number }

// INCR + set TTL hanya saat counter pertama kali dibuat (nilai jadi 1).
async function bumpCounter(key: string, ttl: number): Promise<number> {
  const n = await redis.incr(key)
  if (n === 1) await redis.expire(key, ttl).catch(() => {})
  return n
}

// Opsi gate. skipOutreachGates melewati aturan yang khusus untuk kirim-duluan manual
// (wajib-ack & blokir-first-contact) — dipakai balasan otomatis WAV yang membalas pesan
// inbound (bukan cold outreach), tapi tetap tunduk pada rate/cooldown/plafon (rule 3-6).
export interface PolicyCheckOptions {
  skipOutreachGates?: boolean
}

// Cek semua aturan (fail-fast), baru consume kuota bila lolos. Dipanggil dari route send.
export async function checkAndConsume(userId: string, chatId: string, opts?: PolicyCheckOptions): Promise<PolicyCheck> {
  const policy = await getPolicy()

  // 1. Ack gate — khusus kirim-duluan manual; dilewati untuk balasan inbound (skipOutreachGates).
  if (!opts?.skipOutreachGates && policy.requireAck) {
    const ack = await getAck(userId)
    if (!ack || ack.version < policy.contractVersion) {
      return {
        ok: false,
        status: 403,
        error: 'Kamu harus menyetujui kontrak WhatsApp versi terbaru sebelum mengirim pesan.',
      }
    }
  }

  // 2. First-contact rule — idem: balasan inbound berarti user sudah kontak duluan.
  if (!opts?.skipOutreachGates && !policy.allowFirstContact) {
    const known = await getKnownRecipients(userId)
    if (!known.has(chatId)) {
      return {
        ok: false,
        status: 403,
        error:
          'Kirim duluan diblokir: nomor ini belum pernah chat dan bukan kontak tersimpan. Aktifkan mode OTP (SUPER_ADMIN) bila memang disengaja.',
      }
    }
  }

  // 3. Min-interval antar pesan
  if (policy.minIntervalSeconds > 0) {
    const lastRaw = await redis.get(k.last(userId)).catch(() => null)
    if (lastRaw) {
      const elapsed = (Date.now() - Number(lastRaw)) / 1000
      if (elapsed < policy.minIntervalSeconds) {
        return {
          ok: false,
          status: 429,
          error: `Terlalu cepat. Tunggu ${Math.ceil(policy.minIntervalSeconds - elapsed)} detik sebelum mengirim lagi.`,
          retryAfter: Math.ceil(policy.minIntervalSeconds - elapsed),
        }
      }
    }
  }

  // 4. Per-recipient cooldown
  if (policy.perRecipientCooldownSeconds > 0) {
    const onCooldown = await redis.exists(k.recip(userId, chatId)).catch(() => 0)
    if (onCooldown) {
      const ttl = await redis.ttl(k.recip(userId, chatId)).catch(() => policy.perRecipientCooldownSeconds)
      return {
        ok: false,
        status: 429,
        error: `Nomor ini baru saja dikirimi pesan. Cooldown ${ttl > 0 ? ttl : policy.perRecipientCooldownSeconds} detik.`,
        retryAfter: ttl > 0 ? ttl : policy.perRecipientCooldownSeconds,
      }
    }
  }

  // 5. Caps menit / jam / hari (cek sebelum consume)
  const usage = await getUsage(userId, policy)
  if (usage.minute.used >= policy.maxPerMinute)
    return { ok: false, status: 429, error: `Plafon ${policy.maxPerMinute} pesan/menit tercapai.`, retryAfter: 60 }
  if (usage.hour.used >= policy.maxPerHour)
    return { ok: false, status: 429, error: `Plafon ${policy.maxPerHour} pesan/jam tercapai.`, retryAfter: 3600 }
  if (usage.day.used >= policy.maxPerDay)
    return { ok: false, status: 429, error: `Plafon ${policy.maxPerDay} pesan/hari tercapai.`, retryAfter: 86400 }

  // 6. Consume — counter, last-send, cooldown nomor
  await Promise.all([
    bumpCounter(k.min(userId), 60),
    bumpCounter(k.hour(userId), 3600),
    bumpCounter(k.day(userId), 86400),
    redis.set(k.last(userId), String(Date.now())).catch(() => {}),
    policy.perRecipientCooldownSeconds > 0
      ? redis.set(k.recip(userId, chatId), '1', 'EX', policy.perRecipientCooldownSeconds).catch(() => {})
      : Promise.resolve(),
  ])
  return { ok: true }
}
