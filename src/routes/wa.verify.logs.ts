import { Elysia, t } from 'elysia'
import type { Prisma, VerifyDelivery, VerifyStatus } from '../../generated/prisma/client'
import { appLog } from '../lib/applog'
import { betterAuthPlugin } from '../lib/auth-middleware'
import { prisma } from '../lib/db'
import { parsePagination } from '../lib/pagination'
import { audit, getIp, guardAdmin, guardSuperAdmin } from '../lib/route-helpers'
import { maskPhone } from '../lib/wa-verify'
import { getSupervisorState } from '../lib/wa-verify-poller'
import { replayWebhook } from '../lib/wa-verify-webhook'

// Inspeksi WAV (auth: session cookie). Baca request (masked): ADMIN+.
// Raw inbound log + replay webhook: SUPER_ADMIN. Dipisah dari consumer CRUD demi file-health.

const STATUSES: VerifyStatus[] = ['PENDING', 'VERIFIED', 'EXPIRED']
const DELIVERIES: VerifyDelivery[] = ['PENDING', 'DELIVERED', 'FAILED', 'DISABLED']

const bulkDeleteBody = t.Object({
  ids: t.Optional(t.Array(t.String(), { maxItems: 500 })),
  all: t.Optional(t.Boolean()),
})

export const waVerifyLogsRouter = new Elysia({ tags: ['WA Verify'] })
  .use(betterAuthPlugin)

  .get(
    '/api/wa/verify/requests',
    async ({ authUser, query }) => {
      const guard = guardAdmin(authUser)
      if (guard) return guard
      const { limit, offset } = parsePagination(query)
      const where: Prisma.VerifyRequestWhereInput = {}
      const search = String(query.search ?? '').trim()
      // matchedPhone disimpan mentah & hanya keluar masked → search dibatasi ke nama consumer.
      if (search) where.consumer = { name: { contains: search, mode: 'insensitive' } }
      if (STATUSES.includes(query.status as VerifyStatus)) where.status = query.status as VerifyStatus
      if (DELIVERIES.includes(query.delivery as VerifyDelivery)) where.deliveryStatus = query.delivery as VerifyDelivery
      const [rows, total] = await prisma.$transaction([
        prisma.verifyRequest.findMany({
          where,
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
          skip: offset,
        }),
        prisma.verifyRequest.count({ where }),
      ])
      const requests = rows.map((r) => ({ ...r, matchedPhone: r.matchedPhone ? maskPhone(r.matchedPhone) : null }))
      return { requests, total }
    },
    { detail: { summary: 'List verify requests (masked)', security: [{ cookieAuth: [] }] } },
  )

  .post(
    '/api/wa/verify/requests/bulk-delete',
    async ({ authUser, body, request }) => {
      const guard = guardSuperAdmin(authUser)
      if (guard) return guard
      const where = body.all ? {} : { id: { in: body.ids ?? [] } }
      if (!body.all && (body.ids?.length ?? 0) === 0) return { count: 0 }
      const { count } = await prisma.verifyRequest.deleteMany({ where })
      audit(
        authUser!.id,
        'WA_VERIFY_REQUESTS_DELETED',
        body.all ? `bulk all count=${count}` : `bulk ids count=${count}`,
        getIp(request),
      )
      appLog('warn', `WA verify requests bulk-deleted by ${authUser!.email}`, `count=${count} all=${!!body.all}`)
      return { count }
    },
    {
      detail: { summary: 'Bulk delete verify requests (SUPER_ADMIN)', security: [{ cookieAuth: [] }] },
      body: bulkDeleteBody,
    },
  )

  .get(
    '/api/wa/verify/inbound',
    async ({ authUser, query }) => {
      const guard = guardAdmin(authUser)
      if (guard) return guard
      const { limit, offset } = parsePagination(query)
      const where: Prisma.VerifyInboundLogWhereInput = {}
      const search = String(query.search ?? '').trim()
      if (search)
        where.OR = [
          { fromMasked: { contains: search, mode: 'insensitive' } },
          { tokenFound: { contains: search, mode: 'insensitive' } },
        ]
      if (query.matched === 'true') where.matched = true
      else if (query.matched === 'false') where.matched = false
      const [inbound, total] = await prisma.$transaction([
        prisma.verifyInboundLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit, skip: offset }),
        prisma.verifyInboundLog.count({ where }),
      ])
      return { inbound, total }
    },
    { detail: { summary: 'Raw inbound log (masked)', security: [{ cookieAuth: [] }] } },
  )

  .post(
    '/api/wa/verify/inbound/bulk-delete',
    async ({ authUser, body, request }) => {
      const guard = guardSuperAdmin(authUser)
      if (guard) return guard
      const where = body.all ? {} : { id: { in: body.ids ?? [] } }
      if (!body.all && (body.ids?.length ?? 0) === 0) return { count: 0 }
      const { count } = await prisma.verifyInboundLog.deleteMany({ where })
      audit(
        authUser!.id,
        'WA_VERIFY_INBOUND_DELETED',
        body.all ? `bulk all count=${count}` : `bulk ids count=${count}`,
        getIp(request),
      )
      appLog('warn', `WA verify inbound bulk-deleted by ${authUser!.email}`, `count=${count} all=${!!body.all}`)
      return { count }
    },
    {
      detail: { summary: 'Bulk delete inbound logs (SUPER_ADMIN)', security: [{ cookieAuth: [] }] },
      body: bulkDeleteBody,
    },
  )

  .get(
    '/api/wa/verify/supervisor',
    async ({ authUser }) => {
      const guard = guardAdmin(authUser)
      if (guard) return guard
      return getSupervisorState()
    },
    { detail: { summary: 'WAV capture supervisor state', security: [{ cookieAuth: [] }] } },
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
