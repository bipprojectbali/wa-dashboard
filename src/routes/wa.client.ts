import { Elysia, t } from 'elysia'
import { appLog } from '../lib/applog'
import { betterAuthPlugin } from '../lib/auth-middleware'
import { redis } from '../lib/redis'
import { audit, getIp, guardAdmin } from '../lib/route-helpers'
import * as wa from '../lib/wa-client'
import { checkAndConsume } from '../lib/wa-policy'

const AVATAR_TTL = 3600
const avatarKey = (userId: string, contactId: string) => `wa:avatar:${userId}:${contactId}`

// sessionId is ALWAYS the authenticated user's id — never taken from input.

export const waClientRouter = new Elysia({ tags: ['WA'] })
  .use(betterAuthPlugin)

  .get(
    '/api/wa/account',
    async ({ authUser }) => {
      const guard = guardAdmin(authUser)
      if (guard) return guard
      return wa.getAccountInfo(authUser!.id)
    },
    { detail: { summary: 'WA account info', security: [{ cookieAuth: [] }] } },
  )

  .get(
    '/api/wa/contacts',
    async ({ authUser }) => {
      const guard = guardAdmin(authUser)
      if (guard) return guard
      return wa.getContacts(authUser!.id)
    },
    { detail: { summary: 'WA contacts', security: [{ cookieAuth: [] }] } },
  )

  .get(
    '/api/wa/chats',
    async ({ authUser }) => {
      const guard = guardAdmin(authUser)
      if (guard) return guard
      return wa.getChats(authUser!.id)
    },
    { detail: { summary: 'WA chats', security: [{ cookieAuth: [] }] } },
  )

  .get(
    '/api/wa/avatar',
    async ({ authUser, query }) => {
      const guard = guardAdmin(authUser)
      if (guard) return guard
      const userId = authUser!.id
      const key = avatarKey(userId, query.contactId)
      const cached = await redis.get(key).catch(() => null)
      if (cached !== null) return { url: cached || null }
      const res = await wa.getProfilePicUrl(userId, query.contactId)
      const url = res.result ?? ''
      redis.set(key, url, 'EX', AVATAR_TTL).catch(() => {})
      return { url: url || null }
    },
    {
      detail: { summary: 'WA contact profile picture URL', security: [{ cookieAuth: [] }] },
      query: t.Object({ contactId: t.String({ minLength: 1 }) }),
    },
  )

  .post(
    '/api/wa/send',
    async ({ authUser, body, set, request }) => {
      const guard = guardAdmin(authUser)
      if (guard) return guard
      if (!body.chatId || !body.content) {
        set.status = 400
        return { error: 'chatId dan content wajib diisi' }
      }
      const check = await checkAndConsume(authUser!.id, body.chatId)
      if (!check.ok) {
        set.status = check.status
        appLog('warn', `WA send blocked for ${authUser!.email}: ${check.error}`)
        audit(authUser!.id, 'WA_SEND_BLOCKED', check.error, getIp(request))
        return check.retryAfter ? { error: check.error, retryAfter: check.retryAfter } : { error: check.error }
      }
      appLog('info', `WA send by ${authUser!.email} to ${body.chatId}`)
      return wa.sendMessage(authUser!.id, body.chatId, body.content)
    },
    {
      detail: { summary: 'Send WA message', security: [{ cookieAuth: [] }] },
      body: t.Object({
        chatId: t.String({ minLength: 1 }),
        content: t.String({ minLength: 1 }),
      }),
    },
  )
