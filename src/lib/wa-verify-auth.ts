import { Elysia } from 'elysia'
import { prisma } from './db'
import { hashApiKey } from './wa-verify-keys'

// Consumer-facing auth untuk WAV. Endpoint publik (consumer app) TIDAK pakai session
// cookie — murni API key lewat header `x-api-key`. consumerId SELALU diturunkan dari
// hash API key (tak pernah dari body/param), cermin pola sessionId = authUser.id.

export type VerifyConsumerCtx = {
  id: string
  name: string
  active: boolean
  webhookUrl: string | null
}

// Resolve consumer aktif dari header x-api-key. Inject `verifyConsumer` (atau null)
// ke context. Lookup ber-index lewat apiKeyHash deterministik (HMAC), bukan iterasi.
export const verifyConsumerPlugin = new Elysia({ name: 'wa-verify-auth' }).derive(
  { as: 'global' },
  async ({ headers }) => {
    const key = headers['x-api-key']
    if (!key) return { verifyConsumer: null as VerifyConsumerCtx | null }

    const row = await prisma.verifyConsumer.findUnique({
      where: { apiKeyHash: hashApiKey(key) },
      select: { id: true, name: true, active: true, webhookUrl: true },
    })
    if (!row?.active) return { verifyConsumer: null as VerifyConsumerCtx | null }
    return { verifyConsumer: row as VerifyConsumerCtx | null }
  },
)
