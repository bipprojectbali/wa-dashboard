import { Elysia, t } from 'elysia'
import { appLog } from '../lib/applog'
import { betterAuthPlugin } from '../lib/auth-middleware'
import { guardAdmin } from '../lib/route-helpers'
import * as wa from '../lib/wa-client'

// sessionId is ALWAYS the authenticated user's id — never taken from input.
// This isolates each user's WhatsApp session (1 session per user).

export const waSessionRouter = new Elysia({ tags: ['WA'] })
  .use(betterAuthPlugin)

  .get(
    '/api/wa/session/status',
    async ({ authUser }) => {
      const guard = guardAdmin(authUser)
      if (guard) return guard
      return wa.getStatus(authUser!.id)
    },
    { detail: { summary: 'WA session status', security: [{ cookieAuth: [] }] } },
  )

  .post(
    '/api/wa/session/start',
    async ({ authUser }) => {
      const guard = guardAdmin(authUser)
      if (guard) return guard
      appLog('info', `WA session start by ${authUser!.email}`)
      return wa.startSession(authUser!.id)
    },
    { detail: { summary: 'Start WA session', security: [{ cookieAuth: [] }] } },
  )

  .get(
    '/api/wa/session/qr',
    async ({ authUser }) => {
      const guard = guardAdmin(authUser)
      if (guard) return guard
      return wa.getQr(authUser!.id)
    },
    { detail: { summary: 'WA QR (string)', security: [{ cookieAuth: [] }] } },
  )

  .get(
    '/api/wa/session/qr/image',
    async ({ authUser, set }) => {
      const guard = guardAdmin(authUser)
      if (guard) return guard
      const { bytes, contentType } = await wa.getQrImage(authUser!.id)
      set.headers['Content-Type'] = contentType
      set.headers['Cache-Control'] = 'no-store'
      return new Response(bytes)
    },
    { detail: { summary: 'WA QR (PNG image)', security: [{ cookieAuth: [] }] } },
  )

  .post(
    '/api/wa/session/pairing-code',
    async ({ authUser, body, set }) => {
      const guard = guardAdmin(authUser)
      if (guard) return guard
      if (!body.phoneNumber) {
        set.status = 400
        return { error: 'phoneNumber wajib diisi' }
      }
      return wa.requestPairingCode(authUser!.id, body.phoneNumber)
    },
    {
      detail: { summary: 'Request WA pairing code', security: [{ cookieAuth: [] }] },
      body: t.Object({ phoneNumber: t.String({ minLength: 1 }) }),
    },
  )

  .post(
    '/api/wa/session/restart',
    async ({ authUser }) => {
      const guard = guardAdmin(authUser)
      if (guard) return guard
      appLog('info', `WA session restart by ${authUser!.email}`)
      return wa.restartSession(authUser!.id)
    },
    { detail: { summary: 'Restart WA session', security: [{ cookieAuth: [] }] } },
  )

  .post(
    '/api/wa/session/stop',
    async ({ authUser }) => {
      const guard = guardAdmin(authUser)
      if (guard) return guard
      appLog('info', `WA session stop by ${authUser!.email}`)
      return wa.stopSession(authUser!.id)
    },
    { detail: { summary: 'Stop WA session', security: [{ cookieAuth: [] }] } },
  )

  .post(
    '/api/wa/session/terminate',
    async ({ authUser }) => {
      const guard = guardAdmin(authUser)
      if (guard) return guard
      appLog('warn', `WA session terminate by ${authUser!.email}`)
      return wa.terminateSession(authUser!.id)
    },
    { detail: { summary: 'Terminate WA session', security: [{ cookieAuth: [] }] } },
  )
