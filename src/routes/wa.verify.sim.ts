import { Elysia, t } from 'elysia'
import QRCode from 'qrcode'
import { appLog } from '../lib/applog'
import { betterAuthPlugin } from '../lib/auth-middleware'
import { prisma } from '../lib/db'
import { env } from '../lib/env'
import { audit, getIp, guardSuperAdmin } from '../lib/route-helpers'
import { buildVerifyInstruction, maskPhone } from '../lib/wa-verify'
import { pollVerifyRequest, startVerifyRequest } from '../lib/wa-verify-flow'
import { buildWaMeUrl, getOrCreateSimConsumer } from '../lib/wa-verify-sim'

// Proxy server-side untuk halaman Simulasi Login WAV (cookie SUPER_ADMIN). Menjalankan
// start/poll lewat consumer reserved "[simulation]" — API key tak pernah ke browser, tapi
// pipeline yang dijalankan tetap 100% asli. Hanya mode Login (expectedPhone) di v1.

const SERVER_NUMBER = env.WA_VERIFY_SERVER_NUMBER

function notFound(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const waVerifySimRouter = new Elysia({ tags: ['WA Verify'] })
  .use(betterAuthPlugin)

  .post(
    '/api/wa/verify/sim/start',
    async ({ authUser, body, request }) => {
      const guard = guardSuperAdmin(authUser)
      if (guard) return guard

      const sim = await getOrCreateSimConsumer(authUser!.id)
      const created = await startVerifyRequest(sim.id, body.expectedPhone)
      if (!created) {
        return new Response(JSON.stringify({ error: 'Gagal membuat token, coba lagi.' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      audit(authUser!.id, 'WA_VERIFY_SIM_START', `id=${created.id}`, getIp(request))
      appLog('info', `WA verify simulation started by ${authUser!.email}`, `id=${created.id}`)

      return {
        id: created.id,
        token: created.token,
        sendTo: SERVER_NUMBER || null,
        waMeUrl: buildWaMeUrl(SERVER_NUMBER, created.token),
        expiresAt: created.expiresAt.toISOString(),
        instruction: buildVerifyInstruction(created.token, SERVER_NUMBER),
      }
    },
    {
      body: t.Object({ expectedPhone: t.Optional(t.String({ maxLength: 32 })) }),
      detail: { summary: 'Mulai simulasi verifikasi (SUPER_ADMIN, proxy)', security: [{ cookieAuth: [] }] },
    },
  )

  .get(
    '/api/wa/verify/sim/:id',
    async ({ authUser, params }) => {
      const guard = guardSuperAdmin(authUser)
      if (guard) return guard

      const sim = await getOrCreateSimConsumer(authUser!.id)
      const req = await pollVerifyRequest(sim.id, params.id)
      if (!req) return notFound('Simulasi tidak ditemukan.')

      return { ...req, matchedPhone: req.matchedPhone ? maskPhone(req.matchedPhone) : null }
    },
    { detail: { summary: 'Poll status simulasi (SUPER_ADMIN, proxy)', security: [{ cookieAuth: [] }] } },
  )

  .get(
    '/api/wa/verify/sim/:id/qr',
    async ({ authUser, params }) => {
      const guard = guardSuperAdmin(authUser)
      if (guard) return guard
      if (!SERVER_NUMBER) return notFound('Nomor server verifikasi belum dikonfigurasi.')

      const sim = await getOrCreateSimConsumer(authUser!.id)
      // Lookup token via id (scoped sim consumer) → QR meng-encode deep-link token,
      // bukan teks arbitrer dari query (tak ada endpoint "render any text").
      const reqRow = await prisma.verifyRequest.findFirst({
        where: { id: params.id, consumerId: sim.id },
        select: { token: true },
      })
      if (!reqRow) return notFound('Simulasi tidak ditemukan.')

      const url = buildWaMeUrl(SERVER_NUMBER, reqRow.token)
      if (!url) return notFound('Nomor server verifikasi belum dikonfigurasi.')

      const png = await QRCode.toBuffer(url, { type: 'png', margin: 1, width: 256 })
      return new Response(new Uint8Array(png), {
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
      })
    },
    { detail: { summary: 'QR deep-link simulasi (PNG, SUPER_ADMIN)', security: [{ cookieAuth: [] }] } },
  )
