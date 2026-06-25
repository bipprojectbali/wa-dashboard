import { prisma } from './db'
import { buildVerifyMessage } from './wa-verify'
import { generateApiKey, generateWebhookSecret } from './wa-verify-keys'

// Provisioning consumer khusus untuk halaman Simulasi Login WAV. Proxy server-side
// (cookie SUPER_ADMIN) menjalankan start/poll memakai consumer ini — API key tak pernah
// ke browser. Sim request = VerifyRequest biasa (otomatis tertangkap poller + muncul di
// panel Requests). Tanpa perubahan schema.

// Nama reserved konstan; consumer dibuat sekali (lazy) lalu dipakai ulang.
export const SIM_CONSUMER_NAME = '[simulation]'

export interface SimConsumer {
  id: string
  name: string
}

// Idempotent: cari consumer sim by nama reserved; lazy-create bila belum ada.
// Plaintext API key tak disimpan/dikembalikan — proxy scope by id, tak butuh.
export async function getOrCreateSimConsumer(createdById: string): Promise<SimConsumer> {
  const existing = await prisma.verifyConsumer.findFirst({
    where: { name: SIM_CONSUMER_NAME },
    select: { id: true, name: true },
  })
  if (existing) return existing

  const key = generateApiKey()
  return prisma.verifyConsumer.create({
    data: {
      name: SIM_CONSUMER_NAME,
      apiKeyHash: key.hash,
      apiKeyPrefix: key.prefix,
      webhookUrl: null,
      webhookSecret: generateWebhookSecret(),
      active: true,
      createdById,
    },
    select: { id: true, name: true },
  })
}

// Deep-link wa.me dengan kalimat verifikasi (token di akhir) sudah terisi di field teks —
// pesan natural, bukan token telanjang. Hanya PRE-FILL — kirim tetap manual oleh operator
// (model keamanan WhatsApp/OS). null bila nomor server belum diset.
export function buildWaMeUrl(serverNumber: string, token: string): string | null {
  const digits = serverNumber.replace(/\D/g, '')
  if (!digits) return null
  return `https://wa.me/${digits}?text=${encodeURIComponent(buildVerifyMessage(token))}`
}
