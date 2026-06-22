import { Elysia } from 'elysia'
import { auth } from './auth'

export type AuthUser = {
  id: string
  email: string
  name: string
  role: string
  blocked: boolean
}

type BetterAuthUser = typeof auth.$Infer.Session.user

// Mount Better Auth handler + derive authUser from session cookie on every request
export const betterAuthPlugin = new Elysia({ name: 'better-auth' })
  .mount(auth.handler)
  .derive({ as: 'global' }, async ({ request: { headers } }) => {
    const session = await auth.api.getSession({ headers })
    if (!session) return { authUser: null as AuthUser | null }
    const u = session.user as BetterAuthUser
    return {
      authUser: {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role ?? 'USER',
        blocked: u.blocked ?? false,
      } as AuthUser | null,
    }
  })
