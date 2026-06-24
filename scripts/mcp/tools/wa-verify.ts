import { z } from 'zod'
import { prisma } from '../../../src/lib/db'
import { maskPhone } from '../../../src/lib/wa-verify'
import { replayWebhook } from '../../../src/lib/wa-verify-webhook'
import { errText, jsonText, type ToolModule } from './shared'

// Inspeksi WAV (WhatsApp Inbound Verify) via MCP debug-dev. Readonly: list consumer,
// request (nomor termask), inbound log. Admin: replay webhook manual.

const limitInput = z.object({ limit: z.number().int().min(1).max(200).optional().describe('Max rows (default 50)') })

export const waVerifyReadonlyTools: ToolModule = {
  name: 'wa-verify-readonly',
  scope: 'readonly',
  register(server) {
    server.registerTool(
      'wa_verify_consumers',
      {
        title: 'WA verify consumers',
        description: 'List registered verify consumers (no secrets)',
        inputSchema: z.object({}),
      },
      async () => {
        try {
          const consumers = await prisma.verifyConsumer.findMany({
            select: {
              id: true,
              name: true,
              apiKeyPrefix: true,
              webhookUrl: true,
              active: true,
              createdAt: true,
              _count: { select: { requests: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 200,
          })
          return jsonText(consumers)
        } catch (e) {
          return errText(e instanceof Error ? e.message : String(e))
        }
      },
    )

    server.registerTool(
      'wa_verify_requests',
      {
        title: 'WA verify requests',
        description: 'List recent verify requests (phone masked)',
        inputSchema: limitInput,
      },
      async ({ limit }) => {
        try {
          const rows = await prisma.verifyRequest.findMany({
            select: {
              id: true,
              consumerId: true,
              status: true,
              matchedPhone: true,
              expiresAt: true,
              verifiedAt: true,
              deliveryStatus: true,
              deliveryAttempts: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: limit ?? 50,
          })
          return jsonText(rows.map((r) => ({ ...r, matchedPhone: r.matchedPhone ? maskPhone(r.matchedPhone) : null })))
        } catch (e) {
          return errText(e instanceof Error ? e.message : String(e))
        }
      },
    )

    server.registerTool(
      'wa_verify_inbound',
      {
        title: 'WA verify inbound log',
        description: 'List raw inbound capture log (phone already masked)',
        inputSchema: limitInput,
      },
      async ({ limit }) => {
        try {
          const inbound = await prisma.verifyInboundLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: limit ?? 50,
          })
          return jsonText(inbound)
        } catch (e) {
          return errText(e instanceof Error ? e.message : String(e))
        }
      },
    )
  },
}

export const waVerifyAdminTools: ToolModule = {
  name: 'wa-verify-admin',
  scope: 'admin',
  register(server) {
    server.registerTool(
      'wa_verify_replay',
      {
        title: 'Replay WA verify webhook',
        description: 'Manually replay webhook delivery for a verified request id',
        inputSchema: z.object({ id: z.string().min(1).describe('VerifyRequest id') }),
      },
      async ({ id }) => {
        try {
          return jsonText(await replayWebhook(id))
        } catch (e) {
          return errText(e instanceof Error ? e.message : String(e))
        }
      },
    )
  },
}
