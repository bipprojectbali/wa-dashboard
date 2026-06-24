import { prisma } from './db'
import * as wa from './wa-client'
import { maskPhone } from './wa-verify'

// Enrichment sesi WA tingkat operator: gabungkan daftar sesi mentah container
// dengan status koneksi, info akun (nomor ter-mask + nama), dan pemetaan ke user
// dashboard untuk menandai sesi orphan. Satu sumber kebenaran dipakai route admin
// /api/admin/wa-sessions maupun MCP tool wa_sessions_detail.

export interface WaSessionInfo {
  sessionId: string
  state: string | null
  connected: boolean
  phone: string | null
  name: string | null
  mappedUserId: string | null
  mappedUserEmail: string | null
  orphan: boolean
}

// Ekstrak daftar session id dari respons container yang bentuknya bisa beragam:
// array string, array { name }, array { sessionId }, { sessions: [...] }, atau
// { success, result: [...] } (bentuk getSessions wwebjs-api yang sebenarnya).
export function extractSessionIds(raw: unknown): string[] {
  const arr = Array.isArray(raw)
    ? raw
    : ((raw as { sessions?: unknown }).sessions ?? (raw as { result?: unknown }).result)
  if (!Array.isArray(arr)) return []
  const out: string[] = []
  for (const item of arr) {
    if (typeof item === 'string') {
      out.push(item)
    } else if (item && typeof item === 'object') {
      const o = item as { name?: unknown; sessionId?: unknown; id?: unknown }
      const id = o.name ?? o.sessionId ?? o.id
      if (typeof id === 'string') out.push(id)
    }
  }
  return out
}

interface AccountShape {
  sessionInfo?: { pushname?: string; wid?: { user?: string }; me?: { user?: string } }
  pushname?: string
}

// Tarik nomor + nama dari getClassInfo. Per-sesi try/catch di pemanggil: sesi yang
// belum CONNECTED bikin getClassInfo error — degrade ke null, bukan gagalkan list.
async function accountOf(id: string): Promise<{ phone: string | null; name: string | null }> {
  const info = (await wa.getAccountInfo(id)) as AccountShape
  const si = info.sessionInfo
  const rawPhone = si?.wid?.user ?? si?.me?.user ?? null
  const name = si?.pushname ?? info.pushname ?? null
  return { phone: rawPhone ? maskPhone(rawPhone) : null, name }
}

async function statusOf(id: string): Promise<{ state: string | null; connected: boolean }> {
  const s = (await wa.getStatus(id)) as { state?: string }
  const state = s.state ?? null
  return { state, connected: state === 'CONNECTED' }
}

export async function listWaSessions(): Promise<WaSessionInfo[]> {
  const ids = extractSessionIds(await wa.getSessions())
  if (ids.length === 0) return []

  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true } })
  const userById = new Map(users.map((u) => [u.id, u.email]))

  return Promise.all(
    ids.map(async (sessionId): Promise<WaSessionInfo> => {
      let state: string | null = null
      let connected = false
      let phone: string | null = null
      let name: string | null = null
      try {
        ;({ state, connected } = await statusOf(sessionId))
      } catch {}
      try {
        ;({ phone, name } = await accountOf(sessionId))
      } catch {}
      const mappedUserEmail = userById.get(sessionId) ?? null
      return {
        sessionId,
        state,
        connected,
        phone,
        name,
        mappedUserId: mappedUserEmail ? sessionId : null,
        mappedUserEmail,
        orphan: !mappedUserEmail,
      }
    }),
  )
}

// Terminate sesi by raw id. Audit dilakukan di route (butuh authUser/IP), bukan di sini.
export async function terminateWaSession(rawSessionId: string): Promise<unknown> {
  const id = rawSessionId.trim()
  if (!id) throw new Error('sessionId kosong')
  return wa.terminateSession(id)
}
