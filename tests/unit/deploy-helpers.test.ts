import { describe, expect, it } from 'bun:test'
import { isSensitiveFile } from '../../scripts/mcp/deploy-helpers'

describe('isSensitiveFile', () => {
  it('flags real env files', () => {
    expect(isSensitiveFile('.env')).toBe(true)
    expect(isSensitiveFile('.env.production')).toBe(true)
    expect(isSensitiveFile('.env.local')).toBe(true)
  })

  it('allows env template files (safe to commit)', () => {
    expect(isSensitiveFile('.env.example')).toBe(false)
    expect(isSensitiveFile('.env.sample')).toBe(false)
    expect(isSensitiveFile('.env.template')).toBe(false)
  })

  it('flags key and credential files regardless of directory', () => {
    expect(isSensitiveFile('certs/server.pem')).toBe(true)
    expect(isSensitiveFile('secret.key')).toBe(true)
    expect(isSensitiveFile('config/credentials.json')).toBe(true)
    expect(isSensitiveFile('service-account.json')).toBe(true)
    expect(isSensitiveFile('id_rsa')).toBe(true)
  })

  it('allows ordinary source and config files', () => {
    expect(isSensitiveFile('prisma.config.ts')).toBe(false)
    expect(isSensitiveFile('compose.yml')).toBe(false)
    expect(isSensitiveFile('docs/DATABASE.md')).toBe(false)
  })
})
