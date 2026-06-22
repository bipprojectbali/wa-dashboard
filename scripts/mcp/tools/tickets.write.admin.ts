import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { prisma } from '../../../src/lib/db'
import { jsonText } from './shared'
import { appLog, audit, getOrCreateClaudeUser } from './tickets-helpers'

export function registerWriteAdminTools(server: McpServer) {
  server.registerTool(
    'ticket_close',
    {
      title: 'Close ticket (QC)',
      description: 'Close a ticket (QC action). Typically used from READY_FOR_QC after verification.',
      inputSchema: z.object({
        id: z.string(),
        comment: z.string().optional().describe('Optional closing comment'),
      }),
    },
    async ({ id, comment }) => {
      const ticket = await prisma.ticket.findUnique({ where: { id } })
      if (!ticket) return jsonText({ error: 'Ticket not found' })
      if (ticket.status === 'CLOSED') return jsonText({ error: 'Ticket already closed' })
      const claude = await getOrCreateClaudeUser()
      const updated = await prisma.ticket.update({
        where: { id },
        data: { status: 'CLOSED', closedAt: new Date() },
      })
      if (comment) {
        await prisma.ticketComment.create({
          data: { ticketId: id, authorId: claude.id, authorTag: 'CLAUDE', body: comment },
        })
      }
      await audit(claude.id, 'TICKET_CLOSED', `#${id}`)
      appLog('info', `MCP: ticket ${id} closed`)
      return jsonText({ ok: true, ticket: updated })
    },
  )

  server.registerTool(
    'ticket_reopen',
    {
      title: 'Reopen ticket (QC)',
      description: "Reopen a CLOSED or READY_FOR_QC ticket — e.g. bug not actually fixed.",
      inputSchema: z.object({
        id: z.string(),
        reason: z.string().min(1).describe('Why reopening — required for accountability'),
      }),
    },
    async ({ id, reason }) => {
      const ticket = await prisma.ticket.findUnique({ where: { id } })
      if (!ticket) return jsonText({ error: 'Ticket not found' })
      if (!['READY_FOR_QC', 'CLOSED'].includes(ticket.status)) {
        return jsonText({ error: `Cannot reopen from status ${ticket.status}` })
      }
      const claude = await getOrCreateClaudeUser()
      const [updated] = await prisma.$transaction([
        prisma.ticket.update({ where: { id }, data: { status: 'REOPENED', closedAt: null } }),
        prisma.ticketComment.create({
          data: { ticketId: id, authorId: claude.id, authorTag: 'CLAUDE', body: `Reopened: ${reason}` },
        }),
      ])
      await audit(claude.id, 'TICKET_REOPENED', `#${id}`)
      appLog('warn', `MCP: ticket ${id} reopened — ${reason}`)
      return jsonText({ ok: true, ticket: updated })
    },
  )

  server.registerTool(
    'ticket_update',
    {
      title: 'Update ticket fields',
      description:
        'Update title, description, priority, route, or assignee. Does not change status — use dedicated tools for that.',
      inputSchema: z.object({
        id: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
        route: z.string().optional(),
        assigneeEmail: z
          .string()
          .email()
          .nullable()
          .optional()
          .describe('Email to assign to, or null to unassign'),
      }),
    },
    async ({ id, title, description, priority, route, assigneeEmail }) => {
      const ticket = await prisma.ticket.findUnique({ where: { id } })
      if (!ticket) return jsonText({ error: 'Ticket not found' })
      const data: Record<string, unknown> = {}
      if (title !== undefined) data.title = title
      if (description !== undefined) data.description = description
      if (priority !== undefined) data.priority = priority
      if (route !== undefined) data.route = route
      if (assigneeEmail !== undefined) {
        if (assigneeEmail === null) {
          data.assigneeId = null
        } else {
          const assignee = await prisma.user.findUnique({ where: { email: assigneeEmail } })
          if (!assignee) return jsonText({ error: `Assignee not found: ${assigneeEmail}` })
          data.assigneeId = assignee.id
        }
      }
      if (Object.keys(data).length === 0) return jsonText({ error: 'No fields to update' })
      const updated = await prisma.ticket.update({ where: { id }, data })
      return jsonText({ ok: true, ticket: updated })
    },
  )

  server.registerTool(
    'ticket_ready_for_qc',
    {
      title: 'Mark ticket ready for QC',
      description:
        'Move ticket to READY_FOR_QC with a summary comment and (optional) commit hash + test log evidence. Only QC can close afterwards.',
      inputSchema: z.object({
        id: z.string(),
        summary: z.string().min(1).describe('What was fixed and how you verified it'),
        commitHash: z.string().optional(),
        testLog: z.string().optional().describe('Playwright test log path or URL'),
      }),
    },
    async ({ id, summary, commitHash, testLog }) => {
      const ticket = await prisma.ticket.findUnique({ where: { id } })
      if (!ticket) return jsonText({ error: 'Ticket not found' })
      if (!['IN_PROGRESS', 'REOPENED'].includes(ticket.status)) {
        return jsonText({
          error: `Can only mark READY_FOR_QC from IN_PROGRESS or REOPENED (current: ${ticket.status})`,
        })
      }
      const claude = await getOrCreateClaudeUser()
      const [updated, comment] = await prisma.$transaction([
        prisma.ticket.update({ where: { id }, data: { status: 'READY_FOR_QC' } }),
        prisma.ticketComment.create({
          data: { ticketId: id, authorId: claude.id, authorTag: 'CLAUDE', body: summary },
        }),
      ])
      const evidence = []
      if (commitHash) {
        evidence.push(
          await prisma.ticketEvidence.create({
            data: { ticketId: id, kind: 'commit', url: commitHash, note: 'Fix commit' },
          }),
        )
      }
      if (testLog) {
        evidence.push(
          await prisma.ticketEvidence.create({
            data: { ticketId: id, kind: 'test_log', url: testLog, note: 'Playwright verification' },
          }),
        )
      }
      await audit(claude.id, 'TICKET_READY_FOR_QC', `#${id}`)
      appLog('info', `MCP: ticket ${id} ready for QC`)
      return jsonText({ ok: true, ticket: updated, comment, evidence })
    },
  )
}
