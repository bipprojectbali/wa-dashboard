import { Elysia, t } from 'elysia'
import { appLog } from '../lib/applog'
import { betterAuthPlugin } from '../lib/auth-middleware'
import { prisma } from '../lib/db'
import { audit, getIp, guardAdmin, guardSuperAdmin } from '../lib/route-helpers'
import { WA_CONTRACT, WA_CONTRACT_VERSION } from '../lib/wa-contract'
import { getAck, getPolicy, getUsage, invalidatePolicyCache, recordAck, revokeAck } from '../lib/wa-policy'

// Konfigurasi anti-ban global (singleton). Baca: ADMIN+. Ubah: SUPER_ADMIN. Ack: ADMIN+.

const policyBody = t.Object({
  allowFirstContact: t.Boolean(),
  maxPerMinute: t.Integer({ minimum: 1, maximum: 1000 }),
  maxPerHour: t.Integer({ minimum: 1, maximum: 10000 }),
  maxPerDay: t.Integer({ minimum: 1, maximum: 100000 }),
  minIntervalSeconds: t.Integer({ minimum: 0, maximum: 3600 }),
  perRecipientCooldownSeconds: t.Integer({ minimum: 0, maximum: 86400 }),
  requireAck: t.Boolean(),
})

export const waPolicyRouter = new Elysia({ tags: ['WA'] })
  .use(betterAuthPlugin)

  .get(
    '/api/wa/policy',
    async ({ authUser }) => {
      const guard = guardAdmin(authUser)
      if (guard) return guard
      const policy = await getPolicy()
      const [usage, ack] = await Promise.all([getUsage(authUser!.id, policy), getAck(authUser!.id)])
      return {
        policy,
        usage,
        ack,
        contract: { version: WA_CONTRACT_VERSION, sections: WA_CONTRACT },
        canEdit: authUser!.role === 'SUPER_ADMIN',
      }
    },
    { detail: { summary: 'Get WA policy + usage + ack', security: [{ cookieAuth: [] }] } },
  )

  .put(
    '/api/wa/policy',
    async ({ authUser, body, request }) => {
      const guard = guardSuperAdmin(authUser)
      if (guard) return guard
      const policy = await prisma.waPolicy.upsert({
        where: { id: 'global' },
        update: { ...body, updatedById: authUser!.id },
        create: { id: 'global', ...body, updatedById: authUser!.id },
      })
      await invalidatePolicyCache()
      audit(authUser!.id, 'WA_POLICY_UPDATED', `allowFirstContact=${body.allowFirstContact}`, getIp(request))
      appLog('info', `WA policy updated by ${authUser!.email} (firstContact=${body.allowFirstContact})`)
      return { policy }
    },
    {
      detail: { summary: 'Update WA policy (SUPER_ADMIN)', security: [{ cookieAuth: [] }] },
      body: policyBody,
    },
  )

  .post(
    '/api/wa/policy/ack',
    async ({ authUser, request }) => {
      const guard = guardAdmin(authUser)
      if (guard) return guard
      const ack = await recordAck(authUser!.id)
      audit(authUser!.id, 'WA_POLICY_ACK', `version=${ack.version}`, getIp(request))
      appLog('info', `WA contract acknowledged by ${authUser!.email} (v${ack.version})`)
      return { ack }
    },
    { detail: { summary: 'Acknowledge WA contract', security: [{ cookieAuth: [] }] } },
  )

  .delete(
    '/api/wa/policy/ack',
    async ({ authUser, request }) => {
      const guard = guardAdmin(authUser)
      if (guard) return guard
      await revokeAck(authUser!.id)
      audit(authUser!.id, 'WA_POLICY_ACK_REVOKED', null, getIp(request))
      appLog('info', `WA contract acknowledgement revoked by ${authUser!.email}`)
      return { ack: null }
    },
    { detail: { summary: 'Revoke WA contract acknowledgement', security: [{ cookieAuth: [] }] } },
  )
