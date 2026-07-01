import type { QueryClient } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'
import { rootRoute } from './routes/__root'
import { blockedRoute } from './routes/blocked'
import { changelogRoute } from './routes/changelog'
import { dashboardRoute } from './routes/dashboard'
import { devRoute } from './routes/dev'
import { indexRoute } from './routes/index'
import { loginRoute } from './routes/login'
import { profileRoute } from './routes/profile'
import { waRoute } from './routes/wa'

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  devRoute,
  dashboardRoute,
  profileRoute,
  blockedRoute,
  changelogRoute,
  waRoute,
])

export const router = createRouter({
  routeTree,
  context: { queryClient: undefined as unknown as QueryClient },
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
