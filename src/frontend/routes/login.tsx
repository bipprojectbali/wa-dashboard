import {
  Alert,
  Badge,
  Box,
  Button,
  Divider,
  Grid,
  Group,
  List,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  useMantineColorScheme,
} from '@mantine/core'
import { createRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { FcGoogle } from 'react-icons/fc'
import { TbAlertCircle, TbCheck, TbClock, TbLock, TbLogin, TbMail, TbShieldCheck, TbUsers } from 'react-icons/tb'
import { Background3D } from '@/frontend/components/Background3D'
import { ThemeToggle } from '@/frontend/components/ThemeToggle'
import { getDefaultRoute, type Role } from '@/frontend/hooks/useAuth'
import { authClient } from '@/lib/auth-client'
import { rootRoute } from './__root'

export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: (search: Record<string, unknown>): { error?: string } => {
    const error = typeof search.error === 'string' ? search.error : undefined
    return error ? { error } : {}
  },
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
  component: LoginPage,
})

function LoginPage() {
  const { error: searchError } = loginRoute.useSearch()
  const { colorScheme } = useMantineColorScheme()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setLoginError(null)

    const result = await authClient.signIn.email({ email, password })

    if (result.error) {
      setLoginError(result.error.message ?? 'Email atau password salah')
      setIsLoading(false)
      return
    }

    const user = result.data?.user
    if (user) {
      window.location.href = getDefaultRoute((user.role ?? 'USER') as Role)
    }
    setIsLoading(false)
  }

  const handleGoogleLogin = () => {
    authClient.signIn.social({ provider: 'google', callbackURL: '/' })
  }

  return (
    <Background3D>
      <Box
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header with theme toggle */}
        <Box
          px={{ base: 'md', sm: 'xl', lg: '2xl' }}
          py="md"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <Title order={3} size="h4" style={{ fontWeight: 700 }}>
            Your App
          </Title>
          <ThemeToggle />
        </Box>

        {/* Main Content: Two Column Layout */}
        <Box
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Grid w="100%" m={0} gutter={0} style={{ maxWidth: 1400 }}>
            {/* Left Section - Information (Hidden on mobile) */}
            <Grid.Col
              span={{ base: 12, md: 7, lg: 8 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
              p={{ base: 'md', sm: 'xl', lg: '3xl' }}
              visibleFrom="md"
            >
              <Stack gap="xl">
                <Box>
                  <Badge size="lg" variant="light" color="blue" mb="md">
                    Welcome Back
                  </Badge>
                  <Title order={1} size="h1" fw={800} mb="md">
                    Selamat Datang di Platform Kami
                  </Title>
                  <Text size="lg" c="dimmed" maw={600}>
                    Solusi manajemen komprehensif untuk meningkatkan produktivitas dan kolaborasi tim Anda. Login untuk
                    mengakses semua fitur yang tersedia.
                  </Text>
                </Box>

                <Stack gap="lg" mt="md">
                  <Group gap="md" wrap="nowrap" align="flex-start">
                    <ThemeIcon size={48} radius="md" variant="light" color="blue">
                      <TbShieldCheck size={28} />
                    </ThemeIcon>
                    <Box>
                      <Text fw={600} size="lg" mb={4}>
                        Keamanan Terjamin
                      </Text>
                      <Text c="dimmed" size="sm">
                        Data Anda dilindungi dengan enkripsi tingkat enterprise dan autentikasi multi-factor
                      </Text>
                    </Box>
                  </Group>

                  <Group gap="md" wrap="nowrap" align="flex-start">
                    <ThemeIcon size={48} radius="md" variant="light" color="green">
                      <TbClock size={28} />
                    </ThemeIcon>
                    <Box>
                      <Text fw={600} size="lg" mb={4}>
                        Akses 24/7
                      </Text>
                      <Text c="dimmed" size="sm">
                        Kelola bisnis Anda kapan saja, di mana saja dengan platform cloud kami
                      </Text>
                    </Box>
                  </Group>

                  <Group gap="md" wrap="nowrap" align="flex-start">
                    <ThemeIcon size={48} radius="md" variant="light" color="grape">
                      <TbUsers size={28} />
                    </ThemeIcon>
                    <Box>
                      <Text fw={600} size="lg" mb={4}>
                        Kolaborasi Tim
                      </Text>
                      <Text c="dimmed" size="sm">
                        Tingkatkan produktivitas dengan fitur kolaborasi real-time untuk seluruh tim
                      </Text>
                    </Box>
                  </Group>
                </Stack>

                <Box mt="md">
                  <Text size="sm" fw={600} mb="sm">
                    Demo Accounts:
                  </Text>
                  <List
                    spacing="xs"
                    size="sm"
                    c="dimmed"
                    icon={
                      <ThemeIcon size={20} radius="xl" variant="light">
                        <TbCheck size={14} />
                      </ThemeIcon>
                    }
                  >
                    <List.Item>
                      <Text component="span" inherit>
                        Super Admin:{' '}
                      </Text>
                      <Text component="span" inherit fw={500}>
                        superadmin@example.com
                      </Text>
                      <Text component="span" inherit>
                        {' '}
                        /{' '}
                      </Text>
                      <Text component="span" inherit fw={500}>
                        superadmin123
                      </Text>
                    </List.Item>
                    <List.Item>
                      <Text component="span" inherit>
                        Admin:{' '}
                      </Text>
                      <Text component="span" inherit fw={500}>
                        admin@example.com
                      </Text>
                      <Text component="span" inherit>
                        {' '}
                        /{' '}
                      </Text>
                      <Text component="span" inherit fw={500}>
                        admin123
                      </Text>
                    </List.Item>
                    <List.Item>
                      <Text component="span" inherit>
                        User:{' '}
                      </Text>
                      <Text component="span" inherit fw={500}>
                        user@example.com
                      </Text>
                      <Text component="span" inherit>
                        {' '}
                        /{' '}
                      </Text>
                      <Text component="span" inherit fw={500}>
                        user123
                      </Text>
                    </List.Item>
                  </List>
                </Box>
              </Stack>
            </Grid.Col>

            {/* Right Section - Login Form */}
            <Grid.Col
              span={{ base: 12, md: 5, lg: 4 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              p={{ base: 'md', sm: 'xl' }}
            >
              <Paper
                p={{ base: 'lg', sm: 'xl' }}
                radius="lg"
                w="100%"
                maw={480}
                withBorder
                bg={colorScheme === 'dark' ? 'dark.6' : 'white'}
              >
                <form onSubmit={handleSubmit}>
                  <Stack gap="lg">
                    <Box>
                      <Title order={2} ta="left" mb="xs">
                        Login ke Akun Anda
                      </Title>
                      <Text c="dimmed" size="sm">
                        Masukkan kredensial Anda untuk melanjutkan
                      </Text>
                    </Box>

                    {(loginError || searchError) && (
                      <Alert icon={<TbAlertCircle size={16} />} color="red" variant="light">
                        {loginError ?? 'Login dengan Google gagal, coba lagi.'}
                      </Alert>
                    )}

                    <Stack gap="md">
                      <TextInput
                        label="Email"
                        placeholder="email@example.com"
                        leftSection={<TbMail size={18} />}
                        value={email}
                        onChange={(e) => setEmail(e.currentTarget.value)}
                        size="md"
                        required
                      />

                      <PasswordInput
                        label="Password"
                        placeholder="Masukkan password"
                        leftSection={<TbLock size={18} />}
                        value={password}
                        onChange={(e) => setPassword(e.currentTarget.value)}
                        size="md"
                        required
                      />
                    </Stack>

                    <Button type="submit" fullWidth size="md" leftSection={<TbLogin size={18} />} loading={isLoading}>
                      Masuk
                    </Button>

                    <Divider label="atau lanjutkan dengan" labelPosition="center" />

                    <Button
                      onClick={handleGoogleLogin}
                      fullWidth
                      size="md"
                      variant="default"
                      leftSection={<FcGoogle size={18} />}
                      type="button"
                    >
                      Login dengan Google
                    </Button>

                    {/* Mobile-only demo accounts */}
                    <Box hiddenFrom="md" mt="md">
                      <Divider mb="md" />
                      <Text size="xs" fw={600} mb="xs">
                        Demo Accounts:
                      </Text>
                      <Stack gap={4}>
                        <Text size="xs" c="dimmed">
                          Super Admin: <strong>superadmin@example.com</strong> / <strong>superadmin123</strong>
                        </Text>
                        <Text size="xs" c="dimmed">
                          Admin: <strong>admin@example.com</strong> / <strong>admin123</strong>
                        </Text>
                        <Text size="xs" c="dimmed">
                          User: <strong>user@example.com</strong> / <strong>user123</strong>
                        </Text>
                      </Stack>
                    </Box>
                  </Stack>
                </form>
              </Paper>
            </Grid.Col>
          </Grid>
        </Box>
      </Box>
    </Background3D>
  )
}
