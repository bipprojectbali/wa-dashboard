import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { prisma } from './db'
import { env } from './env'
import { redis } from './redis'

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),

  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL || `http://localhost:${env.PORT}`,

  // ─── Email & Password ──────────────────────────────
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
  },

  // ─── Google OAuth ──────────────────────────────────
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },

  // ─── Redis Secondary Storage ───────────────────────
  // Sessions stored in Redis for fast access; also persisted to DB for audit
  secondaryStorage: {
    get: async (key) => {
      const val = await redis.get(key)
      return val ?? null
    },
    set: async (key, value, ttl) => {
      if (ttl) {
        await redis.set(key, value, 'EX', ttl)
      } else {
        await redis.set(key, value)
      }
    },
    delete: async (key) => {
      await redis.del(key)
    },
  },

  // ─── Session Config ────────────────────────────────
  session: {
    expiresIn: 7 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
    storeSessionInDatabase: true,
    // Cookie cache disabled: role/blocked bisa berubah kapan saja.
    // Cache cookie akan serve role lama sampai expiry — tidak aman.
    // Redis secondary storage sudah cukup cepat.
    cookieCache: {
      enabled: false,
    },
  },

  // ─── Custom User Fields ────────────────────────────
  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: false,
        defaultValue: 'USER',
        input: false,
      },
      blocked: {
        type: 'boolean',
        required: false,
        defaultValue: false,
        input: false,
      },
    },
  },

  // ─── Database Hook: set role saat user BARU dibuat ─
  // Ini memastikan user dari SUPER_ADMIN_EMAILS langsung punya role benar
  // sejak sesi pertama — sebelum session dibuat, bukan setelahnya.
  databaseHooks: {
    user: {
      create: {
        before: async (userData) => {
          const email = (userData as { email?: string }).email ?? ''
          if (env.SUPER_ADMIN_EMAILS.length > 0 && env.SUPER_ADMIN_EMAILS.includes(email)) {
            return { data: { ...userData, role: 'SUPER_ADMIN' } }
          }
        },
      },
    },
  },

  // ─── Security ──────────────────────────────────────
  advanced: {
    useSecureCookies: env.NODE_ENV === 'production',
    ipAddress: {
      ipAddressHeaders: ['x-forwarded-for', 'x-real-ip'],
    },
    crossSubDomainCookies: {
      enabled: false,
    },
  },

  // ─── Rate Limiting ─────────────────────────────────
  rateLimit: {
    enabled: env.NODE_ENV === 'production',
    window: 60,
    max: 10,
    storage: 'secondary-storage',
  },

  // ─── CSRF / Trusted Origins ────────────────────────
  trustedOrigins: [env.BETTER_AUTH_URL || `http://localhost:${env.PORT}`, `http://localhost:${env.PORT}`],

  // ─── After Hook: handle blocked users + promote existing user ─
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      const isSignIn =
        ctx.path === '/sign-in/email' || ctx.path === '/sign-in/social' || ctx.path?.startsWith?.('/callback/')

      if (!isSignIn) return

      const newSession = ctx.context.newSession
      if (!newSession) return

      const user = await prisma.user.findUnique({
        where: { id: newSession.user.id },
        select: { blocked: true, email: true, role: true },
      })

      // Reject login untuk user yang diblokir
      if (user?.blocked) {
        await prisma.session.delete({ where: { id: newSession.session.id } }).catch(() => {})
        throw new APIError('FORBIDDEN', {
          message: 'Akun Anda telah diblokir. Hubungi administrator.',
        })
      }

      // Promote existing user ke SUPER_ADMIN jika env baru ditambahkan setelah user sudah ada.
      // Untuk user BARU: databaseHook.user.create.before sudah handle ini dengan benar.
      if (
        env.SUPER_ADMIN_EMAILS.length > 0 &&
        env.SUPER_ADMIN_EMAILS.includes(user?.email ?? '') &&
        user?.role !== 'SUPER_ADMIN'
      ) {
        await prisma.user.update({
          where: { id: newSession.user.id },
          data: { role: 'SUPER_ADMIN' },
        })

        // Update Redis cache langsung agar getSession() pada request berikutnya
        // sudah return role SUPER_ADMIN — bukan USER dari cache lama.
        // Better Auth stores session di Redis sebagai: key="ba:kv:<token>", value={ session, user }
        const token = newSession.session.token
        const redisKey = `ba:kv:${token}`
        const cached = await redis.get(redisKey)
        if (cached) {
          try {
            const parsed = JSON.parse(cached)
            if (parsed?.user) parsed.user.role = 'SUPER_ADMIN'
            const ttlSeconds = Math.floor((new Date(newSession.session.expiresAt).getTime() - Date.now()) / 1000)
            if (ttlSeconds > 0) {
              await redis.set(redisKey, JSON.stringify(parsed), 'EX', ttlSeconds)
            }
          } catch {
            // Delete supaya request berikutnya re-fetch dari DB dengan role benar
            await redis.del(redisKey)
          }
        }
      }
    }),
  },
})

export type Auth = typeof auth
