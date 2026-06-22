import { Elysia, t } from 'elysia'
import { betterAuthPlugin } from '../lib/auth-middleware'
import { prisma } from '../lib/db'
import { guardQcOrAdmin, notDeleted } from '../lib/route-helpers'
import { PriorityUnion, StatusUnion } from '../lib/ticket-schemas'

export const ticketsReadRouter = new Elysia({ tags: ['Tickets'] })
  .use(betterAuthPlugin)

  .get(
    '/api/tickets',
    async ({ query, authUser }) => {
      const guard = guardQcOrAdmin(authUser)
      if (guard) return guard
      const limit = Math.min(Number(query.limit) || 50, 200)
      const cursor = query.cursor as string | undefined
      const where: Record<string, unknown> = { ...notDeleted }
      if (query.status) where.status = String(query.status)
      if (query.priority) where.priority = String(query.priority)
      if (query.assigneeId) where.assigneeId = String(query.assigneeId)
      if (query.reporterId) where.reporterId = String(query.reporterId)
      if (query.mine === '1') where.assigneeId = authUser!.id
      const tickets = await prisma.ticket.findMany({
        where,
        include: {
          reporter: { select: { id: true, name: true, email: true, role: true } },
          assignee: { select: { id: true, name: true, email: true, role: true } },
          _count: { select: { comments: true, evidence: true } },
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      })
      const hasMore = tickets.length > limit
      return {
        tickets: hasMore ? tickets.slice(0, limit) : tickets,
        nextCursor: hasMore ? tickets[limit - 1]?.id : undefined,
      }
    },
    {
      detail: {
        summary: 'List tickets',
        description: 'Cursor-based paginated ticket list. Soft-deleted tickets excluded.',
        security: [{ cookieAuth: [] }],
        responses: {
          200: { description: 'Ticket list with optional nextCursor for pagination' },
          401: { description: 'Unauthenticated' },
          403: { description: 'Forbidden — requires QC, ADMIN, or SUPER_ADMIN' },
        },
      },
      query: t.Object({
        limit: t.Optional(t.Numeric({ description: 'Page size (default 50, max 200)' })),
        cursor: t.Optional(t.String({ description: 'Cursor from previous page (ticket ID)' })),
        status: t.Optional(StatusUnion),
        priority: t.Optional(PriorityUnion),
        assigneeId: t.Optional(t.String({ description: 'Filter by assignee user ID' })),
        reporterId: t.Optional(t.String({ description: 'Filter by reporter user ID' })),
        mine: t.Optional(t.Literal('1', { description: 'Only tickets assigned to the current user' })),
      }),
    },
  )

  .get(
    '/api/tickets/:id',
    async ({ params, set, authUser }) => {
      const guard = guardQcOrAdmin(authUser)
      if (guard) return guard
      const ticket = await prisma.ticket.findFirst({
        where: { id: params.id, ...notDeleted },
        include: {
          reporter: { select: { id: true, name: true, email: true, role: true } },
          assignee: { select: { id: true, name: true, email: true, role: true } },
          comments: {
            include: { author: { select: { id: true, name: true, email: true, role: true } } },
            orderBy: { createdAt: 'asc' },
          },
          evidence: { orderBy: { createdAt: 'asc' } },
        },
      })
      if (!ticket) {
        set.status = 404
        return { error: 'Ticket not found' }
      }
      return { ticket }
    },
    {
      detail: {
        summary: 'Get ticket detail',
        description: 'Returns full ticket with comments and evidence.',
        security: [{ cookieAuth: [] }],
        responses: {
          200: { description: 'Ticket detail with comments and evidence' },
          401: { description: 'Unauthenticated' },
          403: { description: 'Forbidden — requires QC, ADMIN, or SUPER_ADMIN' },
          404: { description: 'Ticket not found or soft-deleted' },
        },
      },
      params: t.Object({ id: t.String({ description: 'Ticket ID' }) }),
    },
  )
