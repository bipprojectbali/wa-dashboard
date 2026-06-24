import { Elysia, t } from 'elysia'
import { prisma } from '../lib/db'
import { env } from '../lib/env'
import { generateToken, normalizePhone, TOKEN_TTL_MS } from '../lib/wa-verify'
import { verifyConsumerPlugin } from '../lib/wa-verify-auth'

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
      const expectedPhone = body.expectedPhone ? normalizePhone(body.expectedPhone) : null

      // Token unik; retry kecil bila tabrakan index unik.
      let created: { id: string; token: string; expiresAt: Date } | null = null
      for (let attempt = 0; attempt < 5 && !created; attempt++) {
        const token = generateToken()
        const expiresAt = new Date(Date.now() + TOKEN_TTL_MS)
        try {
          created = await prisma.verifyRequest.create({
            data: { consumerId: verifyConsumer.id, token, expectedPhone, expiresAt },
            select: { id: true, token: true, expiresAt: true },
          })
        } catch {
          // tabrakan token (sangat jarang) → coba token baru
        }
      }
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
        instruction: `Kirim pesan berisi "${created.token}" via WhatsApp${SERVER_NUMBER ? ` ke ${SERVER_NUMBER}` : ''} untuk memverifikasi nomormu.`,
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
      const req = await prisma.verifyRequest.findFirst({
        where: { id: params.id, consumerId: verifyConsumer.id },
        select: { status: true, matchedPhone: true, verifiedAt: true, expiresAt: true },
      })
      if (!req) {
        return new Response(JSON.stringify({ error: 'Verifikasi tidak ditemukan.' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // Live-cek kadaluarsa: PENDING yang lewat expiresAt dilaporkan EXPIRED
      // (sweep akan men-persist; respons tak menunggu sweep).
      const expired = req.status === 'PENDING' && req.expiresAt.getTime() < Date.now()
      return {
        status: expired ? 'EXPIRED' : req.status,
        matchedPhone: req.matchedPhone,
        verifiedAt: req.verifiedAt ? req.verifiedAt.toISOString() : null,
        expiresAt: req.expiresAt.toISOString(),
      }
    },
    { detail: { summary: 'Poll status verifikasi (consumer, API key)' } },
  )
