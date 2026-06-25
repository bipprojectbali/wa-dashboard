import type { SimLogEntry } from '@/frontend/components/sim/sim.types'

// Builder murni (tanpa React) untuk timeline log simulasi — unit-testable.

// Tambah entri di akhir (urut kronologis). Mengembalikan array baru (immutable).
export function appendLog(entries: SimLogEntry[], label: string, data?: unknown, at = Date.now()): SimLogEntry[] {
  return [...entries, { at, label, data }]
}

// Durasi antar dua timestamp jadi string ringkas: "820ms" / "3.4s" / "1m 5s".
export function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const totalSec = Math.floor(ms / 1000)
  if (totalSec < 60) return `${(ms / 1000).toFixed(1)}s`
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}m ${sec}s`
}
