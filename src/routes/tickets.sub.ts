import { Elysia, t } from 'elysia'
import { betterAuthPlugin } from '../lib/auth-middleware'
import { prisma } from '../lib/db'
import { guardQcOrAdmin, notDeleted } from '../lib/route-helpers'
import { EvidenceKindUnion } from '../lib/ticket-schemas'

export const ticketsSubRouter = new Elysia({ tags: ['Tickets'] })
  .use(betterAuthPlugin)

  .post(
    '/api/tickets/:id/comments',
    async ({ body, params, set, authUser }) => {
      const guard = guardQcOrAdmin(authUser)
      if (guard) return guard
      const ticket = await prisma.ticket.findFirst({ where: { id: params.id, ...notDeleted }, select: { id: true } })
      if (!ticket) {
        set.status = 404
        return { error: 'Ticket not found' }
      }
      if (!body.body?.trim()) {
        set.status = 400
        return { error: 'body wajib diisi' }
      }
      const comment = await prisma.ticketComment.create({
        data: {
          ticketId: params.id,
          authorId: authUser!.id,
          authorTag: authUser!.role === 'QC' ? 'QC' : authUser!.role === 'ADMIN' ? 'ADMIN' : 'SUPER_ADMIN',
          body: body.body,
        },
        include: { author: { select: { id: true, name: true, email: true, role: true } } },
      })
      return { comment }
    },
    {
      detail: {
        summary: 'Add comment to ticket',
        description: "Adds a comment. authorTag is set automatically based on the user's role.",
        security: [{ cookieAuth: [] }],
        responses: {
          200: { description: 'Created comment' },
          400: { description: 'Empty comment body' },
          401: { description: 'Unauthenticated' },
          403: { description: 'Forbidden — requires QC, ADMIN, or SUPER_ADMIN' },
          404: { description: 'Ticket not found' },
        },
      },
      params: t.Object({ id: t.String() }),
      body: t.Object({ body: t.String({ minLength: 1 }) }),
    },
  )

  .post(
    '/api/tickets/:id/evidence',
    async ({ body, params, set, authUser }) => {
      const guard = guardQcOrAdmin(authUser)
      if (guard) return guard
      const ticket = await prisma.ticket.findFirst({ where: { id: params.id, ...notDeleted }, select: { id: true } })
      if (!ticket) {
        set.status = 404
        return { error: 'Ticket not found' }
      }
      if (!body.kind || !body.url) {
        set.status = 400
        return { error: 'kind dan url wajib diisi' }
      }
      const evidence = await prisma.ticketEvidence.create({
        data: { ticketId: params.id, kind: body.kind, url: body.url, note: body.note ?? null },
      })
      return { evidence }
    },
    {
      detail: {
        summary: 'Attach evidence to ticket',
        description: 'Attach a file path, commit hash, screenshot URL, or test log to the ticket.',
        security: [{ cookieAuth: [] }],
        responses: {
          200: { description: 'Attached evidence' },
          400: { description: 'Missing kind or url' },
          401: { description: 'Unauthenticated' },
          403: { description: 'Forbidden — requires QC, ADMIN, or SUPER_ADMIN' },
          404: { description: 'Ticket not found' },
        },
      },
      params: t.Object({ id: t.String() }),
      body: t.Object({
        kind: EvidenceKindUnion,
        url: t.String({ minLength: 1 }),
        note: t.Optional(t.String()),
      }),
    },
  )
