import { createRoute, redirect } from '@tanstack/react-router'
import { getDefaultRoute, type Role } from '@/frontend/hooks/useAuth'
import { authClient } from '@/lib/auth-client'
import { rootRoute } from './__root'
import { HomePage } from './index/HomePage'

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: async ({ context }) => {
    try {
      const data = await context.queryClient.ensureQueryData({
        queryKey: ['auth', 'session'],
        queryFn: async () => {
          const session = await authClient.getSession()
          return session.data ? { user: session.data.user } : { user: null }
        },
      })
      if (data?.user) {
        const role = (data.user.role ?? 'USER') as Role
        throw redirect({ to: getDefaultRoute(role) })
      }
    } catch (e) {
      if (e instanceof Error) return
      throw e
    }
  },
  component: HomePage,
})
