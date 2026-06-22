import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { prisma } from '../../../src/lib/db'
import { jsonText } from './shared'
import { appLog, audit, getOrCreateClaudeUser, summarize } from './tickets-helpers'
import { registerWriteAdminTools } from './tickets.write.admin'

export function registerWriteTools(server: McpServer) {
  server.registerTool(
    'ticket_claim',
    {
      title: 'Claim ticket',
      description: 'Assign ticket to Claude MCP user and move status to IN_PROGRESS',
      inputSchema: z.object({ id: z.string() }),
    },
    async ({ id }) => {
      const ticket = await prisma.ticket.findUnique({ where: { id } })
      if (!ticket) return jsonText({ error: 'Ticket not found' })
      if (!['OPEN', 'REOPENED'].includes(ticket.status)) {
        return jsonText({ error: `Cannot claim a ticket in status ${ticket.status}` })
      }
      const claude = await getOrCreateClaudeUser()
      const updated = await prisma.ticket.update({
        where: { id },
        data: { assigneeId: claude.id, status: 'IN_PROGRESS' },
      })
      await audit(claude.id, 'TICKET_CLAIMED', `#${id}`)
      appLog('info', `MCP: claimed ticket ${id} (${updated.title})`)
      return jsonText({ ok: true, ticket: updated })
    },
  )

  server.registerTool(
    'ticket_comment',
    {
      title: 'Comment on ticket',
      description: 'Add a comment to a ticket as Claude (MCP). Use for progress updates and questions.',
      inputSchema: z.object({ id: z.string(), body: z.string().min(1) }),
    },
    async ({ id, body }) => {
      const ticket = await prisma.ticket.findUnique({ where: { id }, select: { id: true } })
      if (!ticket) return jsonText({ error: 'Ticket not found' })
      const claude = await getOrCreateClaudeUser()
      const comment = await prisma.ticketComment.create({
        data: { ticketId: id, authorId: claude.id, authorTag: 'CLAUDE', body },
      })
      return jsonText({ ok: true, comment })
    },
  )

  server.registerTool(
    'ticket_add_evidence',
    {
      title: 'Attach evidence to ticket',
      description: 'Attach evidence: screenshot path, commit hash, test log URL, or Playwright trace.',
      inputSchema: z.object({
        id: z.string(),
        kind: z.enum(['screenshot', 'commit', 'test_log', 'trace', 'other']),
        url: z.string().min(1).describe('File path, commit hash, or URL'),
        note: z.string().optional(),
      }),
    },
    async ({ id, kind, url, note }) => {
      const ticket = await prisma.ticket.findUnique({ where: { id }, select: { id: true } })
      if (!ticket) return jsonText({ error: 'Ticket not found' })
      const evidence = await prisma.ticketEvidence.create({
        data: { ticketId: id, kind, url, note: note ?? null },
      })
      return jsonText({ ok: true, evidence })
    },
  )

  server.registerTool(
    'ticket_create',
    {
      title: 'Create ticket',
      description:
        'Create a new ticket. Reporter defaults to Claude MCP user unless reporterEmail is given (must match an existing user).',
      inputSchema: z.object({
        title: z.string().min(1),
        description: z.string().min(1).describe('Markdown: repro steps, expected vs actual'),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
        route: z.string().optional(),
        reporterEmail: z
          .string()
          .email()
          .optional()
          .describe('Email of reporter user (QC/ADMIN). Defaults to Claude MCP user.'),
        assigneeEmail: z.string().email().optional(),
      }),
    },
    async ({ title, description, priority, route, reporterEmail, assigneeEmail }) => {
      const reporter = reporterEmail
        ? await prisma.user.findUnique({ where: { email: reporterEmail } })
        : await getOrCreateClaudeUser()
      if (!reporter) return jsonText({ error: `Reporter not found: ${reporterEmail}` })
      let assigneeId: string | null = null
      if (assigneeEmail) {
        const assignee = await prisma.user.findUnique({ where: { email: assigneeEmail } })
        if (!assignee) return jsonText({ error: `Assignee not found: ${assigneeEmail}` })
        assigneeId = assignee.id
      }
      const ticket = await prisma.ticket.create({
        data: { title, description, priority, route: route ?? null, reporterId: reporter.id, assigneeId },
      })
      await audit(reporter.id, 'TICKET_CREATED', `#${ticket.id} ${title}`)
      appLog('info', `MCP: ticket created "${title}" by ${reporter.email}`)
      return jsonText({ ok: true, ticket, summary: summarize(ticket) })
    },
  )

  registerWriteAdminTools(server)
}
