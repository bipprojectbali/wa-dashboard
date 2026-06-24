import { Elysia } from 'elysia'
import { betterAuthPlugin } from '../lib/auth-middleware'
import { prisma } from '../lib/db'
import { audit, getIp, guardAdmin, guardSuperAdmin } from '../lib/route-helpers'
import { maskPhone } from '../lib/wa-verify'
import { replayWebhook } from '../lib/wa-verify-webhook'

// Inspeksi WAV (auth: session cookie). Baca request (masked): ADMIN+.
// Raw inbound log + replay webhook: SUPER_ADMIN. Dipisah dari consumer CRUD demi file-health.

export const waVerifyLogsRouter = new Elysia({ tags: ['WA Verify'] })
  .use(betterAuthPlugin)

  .get(
    '/api/wa/verify/requests',
    async ({ authUser, query }) => {
      const guard = guardAdmin(authUser)
      if (guard) return guard
      const limit = Math.min(Number(query.limit) || 50, 200)
      const rows = await prisma.verifyRequest.findMany({
        select: {
          id: true,
          consumerId: true,
          status: true,
          matchedPhone: true,
          expiresAt: true,
          verifiedAt: true,
          deliveryStatus: true,
          deliveryAttempts: true,
          createdAt: true,
          consumer: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })
      const requests = rows.map((r) => ({ ...r, matchedPhone: r.matchedPhone ? maskPhone(r.matchedPhone) : null }))
      return { requests }
    },
    { detail: { summary: 'List verify requests (masked)', security: [{ cookieAuth: [] }] } },
  )

  .get(
    '/api/wa/verify/inbound',
    async ({ authUser, query }) => {
      const guard = guardSuperAdmin(authUser)
      if (guard) return guard
      const limit = Math.min(Number(query.limit) || 50, 200)
      const inbound = await prisma.verifyInboundLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit })
      return { inbound }
    },
    { detail: { summary: 'Raw inbound log (SUPER_ADMIN)', security: [{ cookieAuth: [] }] } },
  )

  .post(
    '/api/wa/verify/requests/:id/replay',
    async ({ authUser, params, request }) => {
      const guard = guardSuperAdmin(authUser)
      if (guard) return guard
      const result = await replayWebhook(params.id)
      audit(authUser!.id, 'WA_VERIFY_REPLAY', `id=${params.id} ok=${result.ok}`, getIp(request))
      if (!result.ok) return new Response(JSON.stringify({ error: result.reason }), { status: 409 })
      return { ok: true }
    },
    { detail: { summary: 'Replay webhook delivery (SUPER_ADMIN)', security: [{ cookieAuth: [] }] } },
  )
