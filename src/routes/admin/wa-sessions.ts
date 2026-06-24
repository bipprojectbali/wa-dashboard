import { Elysia } from 'elysia'
import { appLog } from '../../lib/applog'
import { betterAuthPlugin } from '../../lib/auth-middleware'
import { audit, getIp, guardSuperAdmin } from '../../lib/route-helpers'
import { listWaSessions, terminateWaSession } from '../../lib/wa-sessions'

// Panel operator (SUPER_ADMIN): lihat SEMUA sesi container apa adanya + terminate
// manual per sesi. Berbeda dari /api/wa/* per-user, endpoint ini sengaja menerima
// sessionId dari input (bukan authUser.id) untuk menjangkau sesi orphan — dijaga
// guardSuperAdmin + audit WA_SESSION_TERMINATED.

export const adminWaSessionsRouter = new Elysia({ tags: ['Admin — WhatsApp'] })
  .use(betterAuthPlugin)

  .get(
    '/api/admin/wa-sessions',
    async ({ authUser }) => {
      const guard = guardSuperAdmin(authUser)
      if (guard) return guard
      const sessions = await listWaSessions()
      const summary = {
        total: sessions.length,
        connected: sessions.filter((s) => s.connected).length,
        orphan: sessions.filter((s) => s.orphan).length,
      }
      return { sessions, summary }
    },
    {
      detail: {
        summary: 'List all WA container sessions',
        description: 'Semua sesi container ter-enrich (status, nomor ter-mask, nama, flag orphan). SUPER_ADMIN.',
        security: [{ cookieAuth: [] }],
        responses: {
          200: { description: 'Sessions with summary' },
          401: { description: 'Unauthenticated' },
          403: { description: 'Forbidden — requires SUPER_ADMIN' },
          502: { description: 'WA container unreachable' },
        },
      },
    },
  )

  .post(
    '/api/admin/wa-sessions/:id/terminate',
    async ({ authUser, params, request }) => {
      const guard = guardSuperAdmin(authUser)
      if (guard) return guard
      const id = params.id
      if (!id) return new Response(JSON.stringify({ error: 'sessionId kosong' }), { status: 400 })
      const result = await terminateWaSession(id)
      appLog('warn', `WA session terminated by ${authUser!.email}`, `sessionId=${id}`)
      audit(authUser!.id, 'WA_SESSION_TERMINATED', `sessionId=${id}`, getIp(request))
      return result
    },
    {
      detail: {
        summary: 'Terminate a WA container session by raw id',
        description: 'Logout + destroy sesi container (id mentah, termasuk orphan). Diaudit. SUPER_ADMIN.',
        security: [{ cookieAuth: [] }],
        responses: {
          200: { description: 'Terminated' },
          400: { description: 'Empty sessionId' },
          401: { description: 'Unauthenticated' },
          403: { description: 'Forbidden — requires SUPER_ADMIN' },
          502: { description: 'WA container unreachable' },
        },
      },
    },
  )
