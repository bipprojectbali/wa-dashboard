import { Elysia, t } from 'elysia'
import { appLog } from '../lib/applog'
import { prisma } from '../lib/db'
import { env } from '../lib/env'
import { redis } from '../lib/redis'
import { getIp } from '../lib/route-helpers'

export const devAuthRouter = new Elysia().get(
  '/api/dev-auth/login-as/:email',
  async ({
    request,
    params,
    set,
    query,
  }: {
    request: Request
    params: { email: string }
    set: any
    query: Record<string, string>
  }) => {
    if (env.NODE_ENV !== 'development') {
      set.status = 404
      return { error: 'Not found' }
    }
    const user = await prisma.user.findUnique({ where: { email: params.email } })
    if (!user) {
      set.status = 404
      return { error: `User not found: ${params.email}` }
    }

    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const sessionRecord = await prisma.session.create({
      data: { token, userId: user.id, expiresAt, ipAddress: getIp(request) },
    })

    const sessionPayload = JSON.stringify({ ...sessionRecord, user })
    await redis.set(`ba:kv:${token}`, sessionPayload, 'EX', 7 * 24 * 60 * 60)

    appLog('info', `Dev-auth login: ${user.email} (${user.role})`, getIp(request))

    // Sign token — Better Auth verifies HMAC-SHA256 signature before accepting cookie
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(env.BETTER_AUTH_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(token))
    const b64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    const signedToken = `${token}.${b64}`
    const cookieHeader = `better-auth.session_token=${signedToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`
    const redirect = (query as Record<string, string>).redirect
    if (redirect) {
      set.status = 302
      set.headers.location = redirect
      set.headers['set-cookie'] = cookieHeader
      return
    }
    set.headers['set-cookie'] = cookieHeader
    return { user: { id: user.id, name: user.name, email: user.email, role: user.role } }
  },
  {
    detail: {
      tags: ['Auth'],
      summary: 'Dev login (development only)',
      description:
        '**Development only.** Returns 404 in production. Creates a session for any user by email without a password check. Useful for testing different roles.',
      responses: {
        200: { description: 'Session created and cookie set' },
        302: { description: 'Redirect to ?redirect= param with cookie set' },
        404: { description: 'User not found or production environment' },
      },
    },
    params: t.Object({ email: t.String({ description: 'Email of the user to log in as' }) }),
    query: t.Object({ redirect: t.Optional(t.String({ description: 'Redirect path after login' })) }),
  },
)
