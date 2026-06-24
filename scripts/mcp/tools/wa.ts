import { z } from 'zod'
import { prisma } from '../../../src/lib/db'
import * as wa from '../../../src/lib/wa-client'
import { getPolicy, getUsage, invalidatePolicyCache } from '../../../src/lib/wa-policy'
import { listWaSessions, terminateWaSession } from '../../../src/lib/wa-sessions'
import { errText, jsonText, type ToolModule } from './shared'

const userIdInput = z.object({ userId: z.string().min(1).describe('WA session id (= dashboard user id)') })

export const waReadonlyTools: ToolModule = {
  name: 'wa-readonly',
  scope: 'readonly',
  register(server) {
    server.registerTool(
      'wa_status',
      {
        title: 'WA session status',
        description: 'Get WhatsApp session state for a user id',
        inputSchema: userIdInput,
      },
      async ({ userId }) => {
        try {
          return jsonText(await wa.getStatus(userId))
        } catch (e) {
          return errText(e instanceof Error ? e.message : String(e))
        }
      },
    )

    server.registerTool(
      'wa_sessions',
      {
        title: 'WA sessions',
        description: 'List all active WhatsApp sessions on the container',
        inputSchema: z.object({}),
      },
      async () => {
        try {
          return jsonText(await wa.getSessions())
        } catch (e) {
          return errText(e instanceof Error ? e.message : String(e))
        }
      },
    )

    server.registerTool(
      'wa_sessions_detail',
      {
        title: 'WA sessions (enriched)',
        description:
          'List all container sessions enriched with status, masked phone, name, and orphan flag (operator view)',
        inputSchema: z.object({}),
      },
      async () => {
        try {
          return jsonText(await listWaSessions())
        } catch (e) {
          return errText(e instanceof Error ? e.message : String(e))
        }
      },
    )

    server.registerTool(
      'wa_account',
      {
        title: 'WA account info',
        description: 'Get WhatsApp account info (getClassInfo) for a user id',
        inputSchema: userIdInput,
      },
      async ({ userId }) => {
        try {
          return jsonText(await wa.getAccountInfo(userId))
        } catch (e) {
          return errText(e instanceof Error ? e.message : String(e))
        }
      },
    )

    server.registerTool(
      'wa_avatar',
      {
        title: 'WA contact avatar',
        description: 'Get a contact profile picture URL (getProfilePicUrl) for a user id',
        inputSchema: z.object({
          userId: z.string().min(1).describe('WA session id (= dashboard user id)'),
          contactId: z.string().min(1).describe('Contact chat id, e.g. 628xxx@c.us'),
        }),
      },
      async ({ userId, contactId }) => {
        try {
          return jsonText(await wa.getProfilePicUrl(userId, contactId))
        } catch (e) {
          return errText(e instanceof Error ? e.message : String(e))
        }
      },
    )

    server.registerTool(
      'wa_policy_get',
      {
        title: 'WA policy',
        description: 'Get global anti-ban policy config',
        inputSchema: z.object({}),
      },
      async () => {
        try {
          return jsonText(await getPolicy())
        } catch (e) {
          return errText(e instanceof Error ? e.message : String(e))
        }
      },
    )

    server.registerTool(
      'wa_policy_usage',
      {
        title: 'WA policy usage',
        description: 'Get send-quota usage (minute/hour/day) for a user id',
        inputSchema: userIdInput,
      },
      async ({ userId }) => {
        try {
          return jsonText(await getUsage(userId))
        } catch (e) {
          return errText(e instanceof Error ? e.message : String(e))
        }
      },
    )
  },
}

export const waAdminTools: ToolModule = {
  name: 'wa-admin',
  scope: 'admin',
  register(server) {
    server.registerTool(
      'wa_terminate',
      {
        title: 'Terminate WA session',
        description: 'Terminate (logout + destroy) a WhatsApp session for a user id',
        inputSchema: userIdInput,
      },
      async ({ userId }) => {
        try {
          return jsonText(await wa.terminateSession(userId))
        } catch (e) {
          return errText(e instanceof Error ? e.message : String(e))
        }
      },
    )

    server.registerTool(
      'wa_session_terminate',
      {
        title: 'Terminate WA session by raw id',
        description: 'Terminate (logout + destroy) a container session by its raw sessionId (incl. orphan sessions)',
        inputSchema: z.object({ sessionId: z.string().min(1).describe('Raw container session id') }),
      },
      async ({ sessionId }) => {
        try {
          return jsonText(await terminateWaSession(sessionId))
        } catch (e) {
          return errText(e instanceof Error ? e.message : String(e))
        }
      },
    )

    server.registerTool(
      'wa_policy_set',
      {
        title: 'Set WA policy',
        description: 'Update global anti-ban policy config (partial update)',
        inputSchema: z.object({
          allowFirstContact: z.boolean().optional(),
          maxPerMinute: z.number().int().min(1).optional(),
          maxPerHour: z.number().int().min(1).optional(),
          maxPerDay: z.number().int().min(1).optional(),
          minIntervalSeconds: z.number().int().min(0).optional(),
          perRecipientCooldownSeconds: z.number().int().min(0).optional(),
          requireAck: z.boolean().optional(),
        }),
      },
      async (input) => {
        try {
          const policy = await prisma.waPolicy.upsert({
            where: { id: 'global' },
            update: input,
            create: { id: 'global', ...input },
          })
          await invalidatePolicyCache()
          return jsonText(policy)
        } catch (e) {
          return errText(e instanceof Error ? e.message : String(e))
        }
      },
    )
  },
}
