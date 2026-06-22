import { prisma } from '../src/lib/db'
import { createApp } from '../src/app'
import { env } from '../src/lib/env'
import { createHmac } from 'node:crypto'
import { scrypt, randomBytes } from 'node:crypto'

export { prisma }

export function createTestApp() {
  const app = createApp()
  return app
}

/** Hash password using Better Auth's scrypt format: "salt:hex" */
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const key = await new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password.normalize('NFKC'),
      salt,
      64,
      { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 },
      (err, derivedKey) => (err ? reject(err) : resolve(derivedKey)),
    )
  })
  return `${salt}:${key.toString('hex')}`
}

/** Sign a token with HMAC-SHA256 — matches Better Auth's makeSignature() */
async function signToken(token: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.BETTER_AUTH_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(token))
  const b64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
  return `${token}.${b64}`
}

/** Create a test user with Better Auth-compatible scrypt password. */
export async function seedTestUser(
  email = 'test@example.com',
  password = 'test123',
  name = 'Test User',
  role: 'USER' | 'QC' | 'ADMIN' | 'SUPER_ADMIN' = 'USER',
) {
  const hashed = await hashPassword(password)

  const user = await prisma.user.upsert({
    where: { email },
    update: { name, role },
    create: { email, name, role },
  })

  await prisma.account.upsert({
    where: { id: `${user.id}-credential` },
    update: { password: hashed },
    create: {
      id: `${user.id}-credential`,
      accountId: user.id,
      providerId: 'credential',
      userId: user.id,
      password: hashed,
    },
  })

  return user
}

/**
 * Create a session in DB and return the signed cookie value.
 * Format: `token.HMAC-SHA256-b64` — same as Better Auth's signed cookie.
 */
export async function createTestSession(userId: string, expiresAt?: Date): Promise<string> {
  const token = crypto.randomUUID()
  await prisma.session.create({
    data: {
      token,
      userId,
      expiresAt: expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ipAddress: '127.0.0.1',
    },
  })
  return signToken(token)
}

/** Clean up all test data */
export async function cleanupTestData() {
  await prisma.auditLog.deleteMany()
  await prisma.session.deleteMany()
  await prisma.account.deleteMany()
  await prisma.user.deleteMany()
}
