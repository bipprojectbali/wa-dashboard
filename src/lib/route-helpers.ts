import type { AuthUser } from './auth-middleware'
import { prisma } from './db'

// Soft delete helpers — use in all Ticket queries
export const notDeleted = { deletedAt: null } as const
export function softDelete() {
  return { deletedAt: new Date() }
}

export function getIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip') ?? 'unknown'
}

export function audit(userId: string | null, action: string, detail: string | null, ip: string) {
  prisma.auditLog.create({ data: { userId, action, detail, ip } }).catch(() => {})
}

export function guardSuperAdmin(authUser: AuthUser | null): Response | null {
  if (!authUser)
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  if (authUser.blocked || authUser.role !== 'SUPER_ADMIN')
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  return null
}

export function guardQcOrAdmin(authUser: AuthUser | null): Response | null {
  if (!authUser)
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  if (authUser.blocked || !['QC', 'ADMIN', 'SUPER_ADMIN'].includes(authUser.role))
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  return null
}

export function guardAdmin(authUser: AuthUser | null): Response | null {
  if (!authUser)
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  if (authUser.blocked || !['ADMIN', 'SUPER_ADMIN'].includes(authUser.role))
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  return null
}

export function guardAuth(authUser: AuthUser | null): Response | null {
  if (!authUser)
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  if (authUser.blocked)
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  return null
}
