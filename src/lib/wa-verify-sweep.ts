import { prisma } from './db'
import { retryPendingWebhooks } from './wa-verify-webhook'

// Sweep periodik WAV: tandai request PENDING yang kadaluarsa → EXPIRED, retry webhook
// yang tertunda, dan buang inbound log > 24 jam. Dipanggil dari boot hook (src/index.tsx),
// mirror cleanupAuditLogs. Best-effort: error di satu langkah tak menggagalkan lainnya.

const INBOUND_RETENTION_MS = 24 * 60 * 60 * 1000

export async function sweepWaVerify(): Promise<void> {
  const now = new Date()

  // Kadaluarsa: request masih PENDING tapi lewat expiresAt.
  await prisma.verifyRequest
    .updateMany({ where: { status: 'PENDING', expiresAt: { lt: now } }, data: { status: 'EXPIRED' } })
    .catch(() => {})

  // Retry webhook yang belum terkirim.
  await retryPendingWebhooks().catch(() => {})

  // Buang inbound log lama (PII termask, tetap dibersihkan demi higienis).
  const cutoff = new Date(now.getTime() - INBOUND_RETENTION_MS)
  await prisma.verifyInboundLog.deleteMany({ where: { createdAt: { lt: cutoff } } }).catch(() => {})
}
