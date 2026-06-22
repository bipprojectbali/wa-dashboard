import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'
import { scrypt, randomBytes } from 'node:crypto'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAIL ?? '').split(',').map((e) => e.trim()).filter(Boolean)

/** Hash using Better Auth's scrypt format: "salt:hex" */
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

async function upsertUser(
  email: string,
  password: string,
  name: string,
  role: 'USER' | 'ADMIN' | 'QC' | 'SUPER_ADMIN',
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

  console.log(`Seeded: ${email} (${role})`)
}

async function main() {
  await upsertUser('superadmin@example.com', 'superadmin123', 'Super Admin', 'SUPER_ADMIN')
  await upsertUser('admin@example.com', 'admin123', 'Admin', 'ADMIN')
  await upsertUser('qc@example.com', 'qc123', 'QC Officer', 'QC')
  await upsertUser('user@example.com', 'user123', 'User', 'USER')

  for (const email of SUPER_ADMIN_EMAILS) {
    const user = await prisma.user.findUnique({ where: { email } })
    if (user && user.role !== 'SUPER_ADMIN') {
      await prisma.user.update({ where: { email }, data: { role: 'SUPER_ADMIN' } })
      console.log(`Promoted to SUPER_ADMIN: ${email}`)
    }
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
