import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { prisma } from '../../../src/lib/db'
import { jsonText } from './shared'
import { getOrCreateClaudeUser, summarize } from './tickets-helpers'

export function registerReadTools(server: McpServer) {
  server.registerTool(
    'ticket_list',
    {
      title: 'List tickets',
      description: 'List tickets with optional filters. Default: OPEN + IN_PROGRESS + REOPENED (active only).',
      inputSchema: z.object({
        status: z
          .enum(['OPEN', 'IN_PROGRESS', 'READY_FOR_QC', 'REOPENED', 'CLOSED', 'ACTIVE', 'ALL'])
          .default('ACTIVE'),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
        assigneeId: z.string().optional(),
        mine: z.boolean().default(false).describe('Only tickets assigned to the Claude MCP user'),
        limit: z.number().int().min(1).max(200).default(50),
      }),
    },
    async ({ status, priority, assigneeId, mine, limit }) => {
      const where: Record<string, unknown> = {}
      if (status === 'ACTIVE') where.status = { in: ['OPEN', 'IN_PROGRESS', 'REOPENED', 'READY_FOR_QC'] }
      else if (status !== 'ALL') where.status = status
      if (priority) where.priority = priority
      if (assigneeId) where.assigneeId = assigneeId
      if (mine) {
        const claude = await getOrCreateClaudeUser()
        where.assigneeId = claude.id
      }
      const tickets = await prisma.ticket.findMany({
        where,
        include: {
          reporter: { select: { id: true, name: true, email: true } },
          assignee: { select: { id: true, name: true, email: true } },
          _count: { select: { comments: true, evidence: true } },
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        take: limit,
      })
      return jsonText({
        count: tickets.length,
        summary: tickets.map((t: any) => summarize(t)),
        tickets,
      })
    },
  )

  server.registerTool(
    'ticket_get',
    {
      title: 'Get ticket detail',
      description: 'Fetch full ticket with comments and evidence',
      inputSchema: z.object({ id: z.string() }),
    },
    async ({ id }) => {
      const ticket = await prisma.ticket.findUnique({
        where: { id },
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
      if (!ticket) return jsonText({ error: 'Ticket not found' })
      return jsonText({ ticket })
    },
  )
}
