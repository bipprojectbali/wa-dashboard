import { cors } from '@elysiajs/cors'
import { html } from '@elysiajs/html'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { Elysia, t } from 'elysia'
import pkg from '../package.json'
import { createMcpServer, type McpScope } from '../scripts/mcp/server'
import { appLog } from './lib/applog'
import { auth } from './lib/auth'
import { betterAuthPlugin } from './lib/auth-middleware'
import { env } from './lib/env'
import { addConnection, broadcastToAdmins, removeConnection } from './lib/presence'
import { getIp } from './lib/route-helpers'
import { swaggerPlugin } from './lib/swagger-config'
import { adminInfoRouter } from './routes/admin/info'
import { adminLogsRouter } from './routes/admin/logs'
import { adminUsersRouter } from './routes/admin/users'
import { changelogRouter } from './routes/changelog'
import { devAuthRouter } from './routes/dev-auth'
import { ticketsRouter } from './routes/tickets'
import { waRouter } from './routes/wa'

export function createApp() {
  appLog('info', 'Server starting')

  return (
    new Elysia()
      .use(
        cors({
          origin: env.BETTER_AUTH_URL || `http://localhost:${env.PORT}`,
          credentials: true,
          allowedHeaders: ['Content-Type', 'Authorization'],
          methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        }),
      )
      .use(html())
      .use(swaggerPlugin)

      // ─── Better Auth (handles /api/auth/* routes) ─────────
      .use(betterAuthPlugin)

      // ─── Sub-routers ──────────────────────────────────────
      .use(devAuthRouter)
      .use(adminUsersRouter)
      .use(adminLogsRouter)
      .use(adminInfoRouter)
      .use(ticketsRouter)
      .use(changelogRouter)
      .use(waRouter)

      // ─── Global Error Handler ──────────────────────────────
      .onError(({ code, error, request }) => {
        if (code === 'NOT_FOUND') {
          return new Response(JSON.stringify({ error: 'Not Found', status: 404 }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        const url = new URL(request.url)
        const message = error instanceof Error ? error.message : String(error)
        appLog('error', `${request.method} ${url.pathname} — ${message}`)
        console.error('[Server Error]', error)
        return new Response(JSON.stringify({ error: 'Internal Server Error', status: 500 }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      })

      // ─── Request timing + logging ──────────────────────────
      .onRequest(({ request }) => {
        ;(request as any).__startTime = performance.now()
      })
      .onAfterResponse(({ request, set }) => {
        const url = new URL(request.url)
        if (url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/auth/')) {
          const status = typeof set.status === 'number' ? set.status : 200
          const level = status >= 500 ? ('error' as const) : status >= 400 ? ('warn' as const) : ('info' as const)
          appLog(level, `${request.method} ${url.pathname} ${status}`)
          const duration = Math.round(performance.now() - ((request as any).__startTime || 0))
          broadcastToAdmins({
            type: 'request',
            method: request.method,
            path: url.pathname,
            status,
            duration,
            timestamp: new Date().toISOString(),
          })
        }
      })

      // ─── Health ────────────────────────────────────────────
      .get('/health', () => ({ status: 'ok' }), {
        detail: {
          tags: ['Utility'],
          summary: 'Health check',
          description: 'Returns `{ status: "ok" }` when the server is running.',
          responses: { 200: { description: 'Server is healthy' } },
        },
      })

      // ─── WebSocket Presence ────────────────────────────────
      .ws('/ws/presence', {
        async open(ws) {
          const session = await auth.api.getSession({
            headers: new Headers({ cookie: ws.data.headers?.cookie ?? '' }),
          })
          if (!session) {
            ws.close(4001, 'Unauthorized')
            return
          }
          const user = session.user as any
          const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN'
          ;(ws.data as unknown as { userId: string }).userId = user.id
          addConnection(ws as any, user.id, isAdmin)
        },
        close(ws) {
          removeConnection(ws as any)
        },
        message() {},
      })

      // ─── MCP over HTTP ─────────────────────────────────────
      .all('/mcp', async ({ request }) => {
        if (!env.MCP_SECRET && !env.MCP_SECRET_ADMIN) {
          return new Response(JSON.stringify({ error: 'MCP not configured' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        const header = request.headers.get('authorization') ?? ''
        const bearer = header.replace(/^Bearer\s+/i, '').trim()
        const provided = bearer || request.headers.get('x-mcp-secret') || ''
        let scope: McpScope | null = null
        if (env.MCP_SECRET_ADMIN && provided === env.MCP_SECRET_ADMIN) scope = 'admin'
        else if (env.MCP_SECRET && provided === env.MCP_SECRET) scope = 'readonly'
        if (!scope) {
          appLog('warn', `MCP unauthorized from ${getIp(request)}`)
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', 'WWW-Authenticate': 'Bearer' },
          })
        }
        const transport = new WebStandardStreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: true,
        })
        const mcp = createMcpServer(scope)
        await mcp.connect(transport)
        const response = await transport.handleRequest(request)
        response.headers.set('x-mcp-server', 'app-mcp')
        response.headers.set('x-mcp-scope', scope)
        return response
      })

      // ─── Utility ───────────────────────────────────────────
      .get('/api/version', () => ({ name: pkg.name, version: pkg.version }), {
        detail: {
          tags: ['Utility'],
          summary: 'App version',
          description: 'Returns the application name and version from package.json.',
          responses: { 200: { description: 'Name and version' } },
        },
      })
      .get('/api/hello', () => ({ message: 'Hello, world!', method: 'GET' }), {
        detail: {
          tags: ['Utility'],
          summary: 'Hello world (GET)',
          responses: { 200: { description: 'Hello response' } },
        },
      })
      .put('/api/hello', () => ({ message: 'Hello, world!', method: 'PUT' }), {
        detail: {
          tags: ['Utility'],
          summary: 'Hello world (PUT)',
          responses: { 200: { description: 'Hello response' } },
        },
      })
      .get('/api/hello/:name', ({ params }) => ({ message: `Hello, ${params.name}!` }), {
        detail: {
          tags: ['Utility'],
          summary: 'Hello with name',
          description: 'Returns a personalized greeting.',
          responses: { 200: { description: 'Personalized hello' } },
        },
        params: t.Object({ name: t.String({ description: 'Name to greet' }) }),
      })
  )
}
