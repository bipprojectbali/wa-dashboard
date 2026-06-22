import { z } from 'zod'
import { prisma } from '../../../src/lib/db'
import { jsonText, type ToolModule } from './shared'

export const dbTools: ToolModule = {
  name: 'db',
  scope: 'readonly',
  register(server) {
    server.registerTool(
      'db_list_users',
      {
        title: 'List users',
        description: 'List users with optional filters by role and blocked status',
        inputSchema: z.object({
          role: z.enum(['USER', 'ADMIN', 'SUPER_ADMIN']).optional(),
          blocked: z.boolean().optional(),
          limit: z.number().int().min(1).max(500).default(50),
          search: z.string().optional().describe('Substring match on name or email'),
        }),
      },
      async ({ role, blocked, limit, search }) => {
        const where: Record<string, unknown> = {}
        if (role) where.role = role
        if (typeof blocked === 'boolean') where.blocked = blocked
        if (search) {
          where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ]
        }
        const users = await prisma.user.findMany({
          where,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: { id: true, name: true, email: true, role: true, blocked: true, createdAt: true, updatedAt: true },
        })
        return jsonText({ count: users.length, users })
      },
    )

    server.registerTool(
      'db_get_user',
      {
        title: 'Get user',
        description: 'Fetch a single user by id or email, including active session count',
        inputSchema: z.object({
          id: z.string().optional(),
          email: z.string().email().optional(),
        }),
      },
      async ({ id, email }) => {
        if (!id && !email) {
          return jsonText({ error: 'Provide id or email' })
        }
        const user = await prisma.user.findFirst({
          where: id ? { id } : { email },
          include: { _count: { select: { sessions: true } } },
        })
        if (!user) return jsonText({ user: null })
        const { password, _count, ...safe } = user
        return jsonText({ user: { ...safe, sessionCount: _count.sessions } })
      },
    )

    server.registerTool(
      'db_list_sessions',
      {
        title: 'List sessions',
        description: 'List sessions with optional filters',
        inputSchema: z.object({
          userId: z.string().optional(),
          active: z.boolean().optional().describe('true = not expired, false = expired'),
          limit: z.number().int().min(1).max(500).default(50),
        }),
      },
      async ({ userId, active, limit }) => {
        const where: Record<string, unknown> = {}
        if (userId) where.userId = userId
        if (typeof active === 'boolean') {
          where.expiresAt = active ? { gt: new Date() } : { lte: new Date() }
        }
        const sessions = await prisma.session.findMany({
          where,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { email: true, role: true } } },
        })
        return jsonText({
          count: sessions.length,
          sessions: sessions.map((s: any) => ({
            id: s.id,
            token: `${s.token.slice(0, 8)}…`,
            userId: s.userId,
            userEmail: s.user.email,
            userRole: s.user.role,
            createdAt: s.createdAt,
            expiresAt: s.expiresAt,
            isExpired: s.expiresAt < new Date(),
          })),
        })
      },
    )

    server.registerTool(
      'db_list_audit_logs',
      {
        title: 'List audit logs',
        description: 'Recent audit log entries, filterable by user or action',
        inputSchema: z.object({
          userId: z.string().optional(),
          action: z.string().optional().describe('Exact action match, e.g. LOGIN, LOGOUT, ROLE_CHANGED'),
          sinceISO: z.string().optional().describe('ISO timestamp lower bound'),
          limit: z.number().int().min(1).max(1000).default(100),
        }),
      },
      async ({ userId, action, sinceISO, limit }) => {
        const where: Record<string, unknown> = {}
        if (userId) where.userId = userId
        if (action) where.action = action
        if (sinceISO) where.createdAt = { gte: new Date(sinceISO) }
        const logs = await prisma.auditLog.findMany({
          where,
          take: limit,
          orderBy: { createdAt: 'desc' },
        })
        return jsonText({ count: logs.length, logs })
      },
    )

    server.registerTool(
      'db_count_by_table',
      {
        title: 'Table counts',
        description: 'Row counts for each primary table',
        inputSchema: z.object({}),
      },
      async () => {
        const [users, sessions, auditLogs, activeSessions, blockedUsers] = await Promise.all([
          prisma.user.count(),
          prisma.session.count(),
          prisma.auditLog.count(),
          prisma.session.count({ where: { expiresAt: { gt: new Date() } } }),
          prisma.user.count({ where: { blocked: true } }),
        ])
        return jsonText({ users, sessions, auditLogs, activeSessions, blockedUsers })
      },
    )
  },
}
