import { Elysia, t } from 'elysia'
import { env } from '../lib/env'
import { buildVerifyInstruction } from '../lib/wa-verify'
import { verifyConsumerPlugin } from '../lib/wa-verify-auth'
import { pollVerifyRequest, startVerifyRequest } from '../lib/wa-verify-flow'

// Endpoint consumer-facing WAV. Auth MURNI lewat API key (header x-api-key) —
// tanpa session cookie. consumerId SELALU dari verifyConsumer (hash key), tak pernah
// dari input. Query selalu di-scope consumerId → isolasi antar app (404 utk milik lain).

const ERR_UNAUTH = { error: 'API key tidak valid atau consumer non-aktif.' }

// Nomor server tujuan kirim token (untuk instruksi ke user). Diturunkan dari env
// container bila tersedia; bila tidak, biarkan kosong (consumer tampilkan via UI sendiri).
const SERVER_NUMBER = env.WA_VERIFY_SERVER_NUMBER

function consumerError() {
  return new Response(JSON.stringify(ERR_UNAUTH), { status: 401, headers: { 'Content-Type': 'application/json' } })
}

export const waVerifyPublicRouter = new Elysia({ tags: ['WA Verify'] })
  .use(verifyConsumerPlugin)

  .post(
    '/api/verify/start',
    async ({ verifyConsumer, body }) => {
      if (!verifyConsumer) return consumerError()
      const created = await startVerifyRequest(verifyConsumer.id, body.expectedPhone)
      if (!created) {
        return new Response(JSON.stringify({ error: 'Gagal membuat token, coba lagi.' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      return {
        id: created.id,
        token: created.token,
        sendTo: SERVER_NUMBER || null,
        expiresAt: created.expiresAt.toISOString(),
        instruction: buildVerifyInstruction(created.token, SERVER_NUMBER),
      }
    },
    {
      body: t.Object({ expectedPhone: t.Optional(t.String({ maxLength: 32 })) }),
      detail: { summary: 'Mulai verifikasi nomor (consumer, API key)' },
    },
  )

  .get(
    '/api/verify/:id',
    async ({ verifyConsumer, params }) => {
      if (!verifyConsumer) return consumerError()
      // Scope ke consumerId → request milik app lain tampak tidak ada (404).
      const req = await pollVerifyRequest(verifyConsumer.id, params.id)
      if (!req) {
        return new Response(JSON.stringify({ error: 'Verifikasi tidak ditemukan.' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return req
    },
    { detail: { summary: 'Poll status verifikasi (consumer, API key)' } },
  )
