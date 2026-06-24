import { z } from 'zod'
import { errText, jsonText, type ToolModule } from './shared'

// Orkestrasi E2E WAV real-world: men-spawn binary `hurl` atas file .hurl yang sama
// yang dibaca manusia (hurl/wa-verify/*.hurl) — satu sumber kebenaran alur.
// Pola human-in-the-loop: start (minta token) → manusia kirim token via WhatsApp → poll.

const DEFAULT_PORT = Number(process.env.PORT) || 3111
const START_FILE = 'hurl/wa-verify/start.hurl'
const POLL_FILE = 'hurl/wa-verify/poll.hurl'

const INSTALL_HINT =
  'Binary `hurl` tidak ditemukan. Install dulu: `brew install hurl` (macOS) ' +
  'atau lihat https://hurl.dev/docs/installation.html. ' +
  'hurl adalah binary standalone (libcurl), bukan paket npm/bun.'

interface HurlRun {
  exitCode: number
  stdout: string
  stderr: string
  spawnFailed: boolean
}

// Spawn hurl --json <file> dengan variabel diinjeksi via --variable (tak ada secret di file).
// spawnFailed=true bila binary hurl absen (ENOENT) — handler degrade rapi, tidak crash.
async function runHurl(file: string, variables: Record<string, string>, timeoutMs: number): Promise<HurlRun> {
  const cmd = ['hurl', '--json', file]
  for (const [k, v] of Object.entries(variables)) {
    cmd.push('--variable', `${k}=${v}`)
  }
  const spawnOpts = {
    cwd: process.cwd(),
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, FORCE_COLOR: '0' },
  } as const
  let proc: Bun.Subprocess<'ignore', 'pipe', 'pipe'>
  try {
    proc = Bun.spawn(cmd, spawnOpts)
  } catch {
    return { exitCode: -1, stdout: '', stderr: '', spawnFailed: true }
  }
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    try {
      proc.kill()
    } catch {}
  }, timeoutMs)
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ])
  const exitCode = await proc.exited
  clearTimeout(timer)
  // hurl tak ditemukan kadang muncul sebagai exit 127 + stderr ENOENT, bukan throw spawn.
  const spawnFailed = exitCode === 127 || /command not found|No such file|ENOENT/i.test(stderr)
  return {
    exitCode: timedOut ? -1 : (exitCode ?? -1),
    stdout: stdout.length > 80_000 ? `${stdout.slice(0, 80_000)}\n…(truncated)` : stdout,
    stderr: stderr.length > 8_000 ? `${stderr.slice(0, 8_000)}\n…(truncated)` : stderr,
    spawnFailed,
  }
}

// Parse output `hurl --json` (JSON Lines): tiap baris satu objek dengan entries[].captures[]
// berbentuk { name, value }. Gabung semua capture jadi Record datar (entry terakhir menang).
// Tahan banting: baris non-JSON dilewati; tak ada capture → objek kosong (bukan throw).
export function parseHurlCaptures(jsonStdout: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of jsonStdout.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    let parsed: unknown
    try {
      parsed = JSON.parse(trimmed)
    } catch {
      continue
    }
    const entries = (parsed as { entries?: unknown }).entries
    if (!Array.isArray(entries)) continue
    for (const entry of entries) {
      const captures = (entry as { captures?: unknown }).captures
      if (!Array.isArray(captures)) continue
      for (const cap of captures) {
        const name = (cap as { name?: unknown }).name
        const value = (cap as { value?: unknown }).value
        if (typeof name === 'string' && value != null) {
          out[name] = typeof value === 'string' ? value : String(value)
        }
      }
    }
  }
  return out
}

// Instruksi human-in-the-loop eksplisit: langkah inbound tak bisa diotomatiskan agent.
export function buildNextStep(token: string, sendTo: string | null): string {
  const target = sendTo ? `nomor server ${sendTo}` : 'nomor server WhatsApp dashboard'
  return (
    `Kirim pesan berisi "${token}" dari HP ke ${target} via WhatsApp. ` +
    'Setelah terkirim, panggil `wa_verify_e2e_poll` dengan requestId yang sama untuk menunggu status VERIFIED.'
  )
}

export const waVerifyE2eTools: ToolModule = {
  name: 'wa-verify-e2e',
  scope: 'admin',
  register(server) {
    server.registerTool(
      'wa_verify_e2e_start',
      {
        title: 'WAV E2E — start (minta token)',
        description:
          'Langkah 1 alur verifikasi nomor real-world: spawn `hurl` atas hurl/wa-verify/start.hurl ' +
          'untuk minta token WAV via API key consumer. Kembalikan token + instruksi human-in-the-loop. ' +
          'Manusia lalu kirim token via WhatsApp, baru panggil wa_verify_e2e_poll.',
        inputSchema: z.object({
          apiKey: z.string().min(1).describe('API key consumer (wav_sk_...)'),
          expectedPhone: z.string().optional().describe('Nomor diharapkan (mode login); kosong = discovery'),
          baseUrl: z.string().optional().describe(`Base URL app (default http://localhost:${DEFAULT_PORT})`),
          timeoutMs: z.number().int().min(1000).max(60_000).default(30_000),
        }),
      },
      async ({ apiKey, expectedPhone, baseUrl, timeoutMs }) => {
        const base = baseUrl || `http://localhost:${DEFAULT_PORT}`
        const r = await runHurl(
          START_FILE,
          { base_url: base, api_key: apiKey, expected_phone: expectedPhone ?? '' },
          timeoutMs,
        )
        if (r.spawnFailed) return errText(INSTALL_HINT)
        const captures = parseHurlCaptures(r.stdout)
        const requestId = captures.request_id
        const token = captures.wav_token
        if (!requestId || !token) {
          return errText(
            `Gagal memulai verifikasi (exit ${r.exitCode}). ` +
              'Cek apiKey valid, consumer aktif, dan app jalan di base_url. ' +
              `stderr: ${r.stderr || '(kosong)'}`,
          )
        }
        const sendTo = captures.send_to || null
        return jsonText({
          requestId,
          token,
          sendTo,
          mode: expectedPhone ? 'login' : 'discovery',
          nextStep: buildNextStep(token, sendTo),
        })
      },
    )

    server.registerTool(
      'wa_verify_e2e_poll',
      {
        title: 'WAV E2E — poll (tunggu VERIFIED)',
        description:
          'Langkah 3 alur verifikasi nomor real-world: spawn `hurl` atas hurl/wa-verify/poll.hurl ' +
          'untuk poll status SETELAH manusia kirim token via WhatsApp. Retry built-in di file (~5 menit). ' +
          'Kembalikan status akhir (VERIFIED/EXPIRED/PENDING), bukan error mentah, bila assert gagal.',
        inputSchema: z.object({
          requestId: z.string().min(1).describe('requestId dari wa_verify_e2e_start'),
          apiKey: z.string().min(1).describe('API key consumer yang sama dengan start'),
          baseUrl: z.string().optional().describe(`Base URL app (default http://localhost:${DEFAULT_PORT})`),
          timeoutMs: z.number().int().min(1000).max(360_000).default(330_000),
        }),
      },
      async ({ requestId, apiKey, baseUrl, timeoutMs }) => {
        const base = baseUrl || `http://localhost:${DEFAULT_PORT}`
        const r = await runHurl(POLL_FILE, { base_url: base, api_key: apiKey, request_id: requestId }, timeoutMs)
        if (r.spawnFailed) return errText(INSTALL_HINT)
        const captures = parseHurlCaptures(r.stdout)
        const status = captures.final_status || 'UNKNOWN'
        return jsonText({
          requestId,
          status,
          verified: status === 'VERIFIED',
          exitCode: r.exitCode,
          note:
            status === 'VERIFIED'
              ? 'Nomor terverifikasi.'
              : `Belum VERIFIED (status ${status}). Pastikan token sudah dikirim via WhatsApp sebelum TTL 5 menit habis.`,
        })
      },
    )
  },
}
