import { prisma } from './db'
import { env } from './env'
import { startWaVerifySupervisor } from './wa-verify-poller'
import { sweepWaVerify } from './wa-verify-sweep'

// Boot tasks bersama untuk SEMUA entry point (dev `src/index.tsx` & binary produksi
// `src/server.prod.ts`). Sumber tunggal agar boot produksi tak pernah drift dari dev —
// dulu WAV supervisor cuma dipanggil di index.tsx, jadi poller verifikasi tak pernah
// jalan di produksi (request WAV PENDING selamanya).

const DAY_MS = 24 * 60 * 60 * 1000
const MINUTE_MS = 60 * 1000

async function cleanupAuditLogs(): Promise<void> {
  const cutoff = new Date(Date.now() - env.AUDIT_LOG_RETENTION_DAYS * DAY_MS)
  const { count } = await prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } })
  if (count > 0) console.log(`[Audit] Cleaned up ${count} logs older than ${env.AUDIT_LOG_RETENTION_DAYS} days`)
}

// Dipanggil sekali saat boot oleh tiap entry point. Idempoten di sisi supervisor
// (guard `started`), aman dipanggil ulang.
export function runStartupTasks(): void {
  // Audit log rotation — saat boot, lalu tiap 24 jam.
  cleanupAuditLogs().catch(console.error)
  setInterval(() => cleanupAuditLogs().catch(console.error), DAY_MS)

  // WAV supervisor polling always-on (capture token verifikasi masuk via getChats).
  startWaVerifySupervisor()

  // WAV expiry + webhook retry + cleanup inbound log — saat boot, lalu tiap menit
  // (retry webhook butuh kadens lebih rapat dari audit cleanup).
  sweepWaVerify().catch(console.error)
  setInterval(() => sweepWaVerify().catch(console.error), MINUTE_MS)
}
