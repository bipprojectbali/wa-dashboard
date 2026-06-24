import { describe, expect, test } from 'bun:test'
import { buildNextStep, parseHurlCaptures } from '../../scripts/mcp/tools/wa-verify-e2e'

// Sampel output `hurl --json`: satu objek JSON per baris, captures berbentuk { name, value }.
const startJson = JSON.stringify({
  filename: 'hurl/wa-verify/start.hurl',
  entries: [
    {
      index: 1,
      captures: [
        { name: 'request_id', value: 'req_abc123' },
        { name: 'wav_token', value: 'WAV-ABCD2345' },
        { name: 'send_to', value: '628111222333' },
      ],
    },
  ],
  success: true,
})

describe('parseHurlCaptures', () => {
  test('ekstrak semua capture dari output start', () => {
    const caps = parseHurlCaptures(startJson)
    expect(caps.request_id).toBe('req_abc123')
    expect(caps.wav_token).toBe('WAV-ABCD2345')
    expect(caps.send_to).toBe('628111222333')
  })

  test('entry terakhir menang bila nama capture sama (poll multi-retry)', () => {
    const lines = [
      JSON.stringify({ entries: [{ captures: [{ name: 'final_status', value: 'PENDING' }] }] }),
      JSON.stringify({ entries: [{ captures: [{ name: 'final_status', value: 'VERIFIED' }] }] }),
    ].join('\n')
    expect(parseHurlCaptures(lines).final_status).toBe('VERIFIED')
  })

  test('value non-string dikonversi ke string', () => {
    const json = JSON.stringify({ entries: [{ captures: [{ name: 'n', value: 42 }] }] })
    expect(parseHurlCaptures(json).n).toBe('42')
  })

  test('output kosong → objek kosong, bukan throw', () => {
    expect(parseHurlCaptures('')).toEqual({})
  })

  test('baris non-JSON dilewati tanpa throw', () => {
    const mixed = ['not json at all', startJson, '   '].join('\n')
    expect(parseHurlCaptures(mixed).wav_token).toBe('WAV-ABCD2345')
  })

  test('entry tanpa captures → objek kosong', () => {
    const json = JSON.stringify({ entries: [{ index: 1 }] })
    expect(parseHurlCaptures(json)).toEqual({})
  })
})

describe('buildNextStep', () => {
  test('mengandung token + nomor server saat sendTo ada', () => {
    const step = buildNextStep('WAV-ABCD2345', '628111222333')
    expect(step).toContain('WAV-ABCD2345')
    expect(step).toContain('628111222333')
    expect(step).toContain('wa_verify_e2e_poll')
  })

  test('fallback teks generik saat sendTo null', () => {
    const step = buildNextStep('WAV-ABCD2345', null)
    expect(step).toContain('WAV-ABCD2345')
    expect(step).toContain('nomor server WhatsApp dashboard')
  })
})
