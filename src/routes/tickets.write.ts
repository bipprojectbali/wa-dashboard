import { Elysia, t } from 'elysia'
import { appLog } from '../lib/applog'
import { betterAuthPlugin } from '../lib/auth-middleware'
import { prisma } from '../lib/db'
import { audit, getIp, guardQcOrAdmin, notDeleted } from '../lib/route-helpers'
import { getAllowedStatusTransitions } from '../lib/ticket-helpers'
import { PriorityUnion, StatusUnion } from '../lib/ticket-schemas'

export const ticketsWriteRouter = new Elysia({ tags: ['Tickets'] })
  .use(betterAuthPlugin)

  .post(
    '/api/tickets',
    async ({ body, set, authUser, request }) => {
      const guard = guardQcOrAdmin(authUser)
      if (guard) return guard
      if (!body.title || !body.description) {
        set.status = 400
        return { error: 'title dan description wajib diisi' }
      }
      const ticket = await prisma.ticket.create({
        data: {
          title: body.title,
          description: body.description,
          priority: (body.priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL') ?? 'MEDIUM',
          route: body.route ?? null,
          reporterId: authUser!.id,
          assigneeId: body.assigneeId ?? null,
        },
      })
      audit(authUser!.id, 'TICKET_CREATED', `#${ticket.id} ${ticket.title}`, getIp(request))
      appLog('info', `Ticket created: ${ticket.title} by ${authUser!.email}`)
      return { ticket }
    },
    {
      detail: {
        summary: 'Create ticket',
        description: 'Creates a new ticket. Reporter is set to the authenticated user.',
        security: [{ cookieAuth: [] }],
        responses: {
          200: { description: 'Created ticket' },
          400: { description: 'Missing title or description' },
          401: { description: 'Unauthenticated' },
          403: { description: 'Forbidden — requires QC, ADMIN, or SUPER_ADMIN' },
        },
      },
      body: t.Object({
        title: t.String({ minLength: 1 }),
        description: t.String({ minLength: 1 }),
        priority: t.Optional(PriorityUnion),
        route: t.Optional(t.String()),
        assigneeId: t.Optional(t.String()),
      }),
    },
  )

  .patch(
    '/api/tickets/:id',
    async ({ body, params, set, authUser, request }) => {
      const guard = guardQcOrAdmin(authUser)
      if (guard) return guard
      const current = await prisma.ticket.findFirst({ where: { id: params.id, ...notDeleted } })
      if (!current) {
        set.status = 404
        return { error: 'Ticket not found' }
      }
      const data: Record<string, unknown> = {}
      if (body.title !== undefined) data.title = body.title
      if (body.description !== undefined) data.description = body.description
      if (body.priority !== undefined) data.priority = body.priority
      if (body.route !== undefined) data.route = body.route
      if (body.assigneeId !== undefined) data.assigneeId = body.assigneeId
      if (body.status !== undefined) {
        const allowed = getAllowedStatusTransitions(current.status, authUser!.role as 'QC' | 'ADMIN' | 'SUPER_ADMIN')
        if (!allowed.includes(body.status)) {
          set.status = 400
          return {
            error: `Transisi status tidak diizinkan untuk role ${authUser!.role}: ${current.status} → ${body.status}`,
          }
        }
        data.status = body.status
        if (body.status === 'CLOSED') data.closedAt = new Date()
        if (body.status === 'REOPENED') data.closedAt = null
      }
      const ticket = await prisma.ticket.update({ where: { id: params.id }, data })
      audit(authUser!.id, 'TICKET_UPDATED', `#${ticket.id} ${Object.keys(data).join(',')}`, getIp(request))
      return { ticket }
    },
    {
      detail: {
        summary: 'Update ticket',
        description: 'Update ticket fields. Status transitions are role-gated.',
        security: [{ cookieAuth: [] }],
        responses: {
          200: { description: 'Updated ticket' },
          400: { description: 'Invalid status transition for current role' },
          401: { description: 'Unauthenticated' },
          403: { description: 'Forbidden — requires QC, ADMIN, or SUPER_ADMIN' },
          404: { description: 'Ticket not found' },
        },
      },
      params: t.Object({ id: t.String() }),
      body: t.Object({
        title: t.Optional(t.String()),
        description: t.Optional(t.String()),
        priority: t.Optional(PriorityUnion),
        route: t.Optional(t.Nullable(t.String())),
        status: t.Optional(StatusUnion),
        assigneeId: t.Optional(t.Nullable(t.String())),
      }),
    },
  )
