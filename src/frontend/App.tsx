import { createTheme, MantineProvider } from '@mantine/core'
import '@mantine/core/styles.css'
import { ModalsProvider } from '@mantine/modals'
import { Notifications } from '@mantine/notifications'
import '@mantine/notifications/styles.css'
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { WhatsNewModal } from './components/WhatsNewModal'
import { UnauthorizedError } from './lib/errors'
import { router } from './router'

export { UnauthorizedError }

const theme = createTheme({
  primaryColor: 'blue',
  fontFamily: 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif',
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, gcTime: 10 * 60_000, retry: 1 },
  },
  // Intercept 401 dari semua query/mutation — reset session agar route guards bereaksi
  queryCache: new QueryCache({
    onError: (err) => {
      if (err instanceof UnauthorizedError) {
        queryClient.setQueryData(['auth', 'session'], null)
      }
    },
  }),
})

export function App() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <Notifications position="top-right" />
      <QueryClientProvider client={queryClient}>
        <ModalsProvider>
          <WhatsNewModal />
          <RouterProvider router={router} context={{ queryClient }} />
        </ModalsProvider>
      </QueryClientProvider>
    </MantineProvider>
  )
}
