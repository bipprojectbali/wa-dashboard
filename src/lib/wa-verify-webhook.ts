import { createHmac } from 'node:crypto'
import { appLog } from './applog'
import { prisma } from './db'
import { maskPhone } from './wa-verify'

// Webhook push ke consumer untuk WAV. DB adalah sumber kebenaran (polling tetap
// jalan walau webhook gagal total); webhook hanya notifikasi best-effort. Ditandatangani
// HMAC per-consumer, idempoten lewat X-WAV-Idempotency-Key = request.id.

const MAX_ATTEMPTS = 5
const TIMEOUT_MS = 10_000

export interface WebhookPayload {
  event: 'verify.succeeded'
  id: string
  matchedPhone: string | null
  expectedPhone: string | null
  verifiedAt: string | null
}

function sign(body: string, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
}

// Kirim satu attempt webhook untuk request VERIFIED. Memperbarui kolom delivery di DB.
// Dipanggil dari matcher (best-effort, async) dan dari sweep/replay.
export async function deliverVerified(requestId: string): Promise<void> {
  const req = await prisma.verifyRequest.findUnique({
    where: { id: requestId },
    include: { consumer: { select: { webhookUrl: true, webhookSecret: true } } },
  })
  if (!req || req.status !== 'VERIFIED') return

  // Tanpa webhookUrl → mode polling-only. Tandai DISABLED agar sweep tak retry.
  if (!req.consumer.webhookUrl) {
    await prisma.verifyRequest
      .update({ where: { id: requestId }, data: { deliveryStatus: 'DISABLED' } })
      .catch(() => {})
    return
  }
  if (req.deliveryStatus === 'DELIVERED') return

  const payload: WebhookPayload = {
    event: 'verify.succeeded',
    id: req.id,
    matchedPhone: req.matchedPhone,
    expectedPhone: req.expectedPhone,
    verifiedAt: req.verifiedAt ? req.verifiedAt.toISOString() : null,
  }
  const body = JSON.stringify(payload)
  const attempt = req.deliveryAttempts + 1

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(req.consumer.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WAV-Signature': sign(body, req.consumer.webhookSecret),
        'X-WAV-Idempotency-Key': req.id,
        'X-WAV-Attempt': String(attempt),
      },
      body,
      signal: ctrl.signal,
    })
    if (res.ok) {
      await prisma.verifyRequest.update({
        where: { id: requestId },
        data: {
          deliveryStatus: 'DELIVERED',
          deliveryAttempts: attempt,
          lastDeliveryAt: new Date(),
          lastDeliveryError: null,
        },
      })
      return
    }
    await recordFailure(requestId, attempt, `HTTP ${res.status}`)
  } catch (e) {
    await recordFailure(requestId, attempt, e instanceof Error ? e.message : String(e))
  } finally {
    clearTimeout(timer)
  }
}

async function recordFailure(requestId: string, attempt: number, error: string): Promise<void> {
  // FAILED bila sudah mentok MAX_ATTEMPTS; selain itu PENDING agar sweep retry.
  const status = attempt >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING'
  await prisma.verifyRequest
    .update({
      where: { id: requestId },
      data: {
        deliveryStatus: status,
        deliveryAttempts: attempt,
        lastDeliveryAt: new Date(),
        lastDeliveryError: error.slice(0, 500),
      },
    })
    .catch(() => {})
  appLog('warn', 'WA verify webhook attempt failed', `req=${requestId} attempt=${attempt} status=${status}`).catch(
    () => {},
  )
}

// Sweep: retry semua request VERIFIED yang webhook-nya PENDING/FAILED & belum mentok.
// Dipanggil berkala dari boot hook (mirror cleanupAuditLogs).
export async function retryPendingWebhooks(): Promise<void> {
  const due = await prisma.verifyRequest.findMany({
    where: {
      status: 'VERIFIED',
      deliveryStatus: { in: ['PENDING', 'FAILED'] },
      deliveryAttempts: { lt: MAX_ATTEMPTS },
    },
    select: { id: true },
    take: 50,
    orderBy: { verifiedAt: 'asc' },
  })
  for (const r of due) {
    await deliverVerified(r.id)
  }
}

// Replay manual (SUPER_ADMIN): reset attempts & kirim ulang. Mengembalikan status terbaru.
export async function replayWebhook(requestId: string): Promise<{ ok: boolean; reason?: string }> {
  const req = await prisma.verifyRequest.findUnique({
    where: { id: requestId },
    select: { status: true, consumer: { select: { webhookUrl: true } } },
  })
  if (!req) return { ok: false, reason: 'not_found' }
  if (req.status !== 'VERIFIED') return { ok: false, reason: 'not_verified' }
  if (!req.consumer.webhookUrl) return { ok: false, reason: 'no_webhook' }

  await prisma.verifyRequest.update({
    where: { id: requestId },
    data: { deliveryStatus: 'PENDING', deliveryAttempts: 0, lastDeliveryError: null },
  })
  await deliverVerified(requestId)
  appLog('info', 'WA verify webhook replayed', `req=${requestId}`).catch(() => {})
  return { ok: true }
}

// Re-export agar pemakai lain bisa mask konsisten bila perlu.
export { maskPhone }
