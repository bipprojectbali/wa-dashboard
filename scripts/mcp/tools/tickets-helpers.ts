import { appLog } from '../../../src/lib/applog'
import { prisma } from '../../../src/lib/db'

const CLAUDE_EMAIL = process.env.CLAUDE_USER_EMAIL ?? 'claude@mcp.local'

export async function getOrCreateClaudeUser() {
  const existing = await prisma.user.findUnique({ where: { email: CLAUDE_EMAIL } })
  if (existing) return existing
  const hashed = await Bun.password.hash(crypto.randomUUID())
  return prisma.user.create({
    data: { email: CLAUDE_EMAIL, name: 'Claude (MCP)', password: hashed, role: 'ADMIN' },
  })
}

export async function audit(userId: string | null, action: string, detail: string | null) {
  await prisma.auditLog.create({ data: { userId, action, detail, ip: 'mcp' } }).catch(() => {})
}

export function summarize(ticket: {
  id: string
  title: string
  status: string
  priority: string
  route: string | null
}) {
  return `#${ticket.id.slice(0, 8)} [${ticket.status}/${ticket.priority}] ${ticket.title}${ticket.route ? ` (${ticket.route})` : ''}`
}

export { appLog }
