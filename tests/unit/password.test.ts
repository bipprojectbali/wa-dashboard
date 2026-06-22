import { test, expect, describe } from 'bun:test'

describe('Bun.password (bcrypt)', () => {
  test('hash and verify correct password', async () => {
    const hash = await Bun.password.hash('mypassword', { algorithm: 'bcrypt' })
    expect(hash).toStartWith('$2')
    const valid = await Bun.password.verify('mypassword', hash)
    expect(valid).toBe(true)
  })

  test('reject wrong password', async () => {
    const hash = await Bun.password.hash('mypassword', { algorithm: 'bcrypt' })
    const valid = await Bun.password.verify('wrongpassword', hash)
    expect(valid).toBe(false)
  })

  test('different hashes for same password', async () => {
    const hash1 = await Bun.password.hash('same', { algorithm: 'bcrypt' })
    const hash2 = await Bun.password.hash('same', { algorithm: 'bcrypt' })
    expect(hash1).not.toBe(hash2) // bcrypt salt differs
    expect(await Bun.password.verify('same', hash1)).toBe(true)
    expect(await Bun.password.verify('same', hash2)).toBe(true)
  })
})
