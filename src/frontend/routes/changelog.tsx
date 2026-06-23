import {
  Badge,
  Box,
  Center,
  Container,
  Divider,
  Group,
  Loader,
  Stack,
  Text,
  ThemeIcon,
  Timeline,
  Title,
} from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { createRoute, redirect, useRouter } from '@tanstack/react-router'
import { TbArrowLeft, TbSparkles } from 'react-icons/tb'
import { authClient } from '@/lib/auth-client'
import { rootRoute } from './__root'

export const changelogRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/changelog',
  beforeLoad: async ({ context }) => {
    try {
      const data = await context.queryClient.ensureQueryData({
        queryKey: ['auth', 'session'],
        queryFn: async () => {
          const session = await authClient.getSession()
          return session.data ? { user: session.data.user } : { user: null }
        },
      })
      if (!data?.user) throw redirect({ to: '/login' })
      const user = data.user
      if (user.blocked) throw redirect({ to: '/blocked' })
    } catch (e) {
      if (e instanceof Error) throw redirect({ to: '/login' })
      throw e
    }
  },
  component: ChangelogPage,
})

interface ChangelogEntry {
  version: string
  date: string | null
  sections: Partial<Record<'Added' | 'Changed' | 'Fixed' | 'Removed', string[]>>
}

const SECTION_COLOR: Record<string, string> = {
  Added: 'green',
  Changed: 'blue',
  Fixed: 'orange',
  Removed: 'red',
}

function ChangelogPage() {
  const router = useRouter()

  const { data, isLoading, isError } = useQuery<ChangelogEntry[]>({
    queryKey: ['changelog', 'all'],
    queryFn: async () => {
      const res = await fetch('/api/changelog?all=true')
      if (!res.ok) throw new Error('Failed to fetch changelog')
      return res.json()
    },
    staleTime: 5 * 60_000,
  })

  const entries = (data ?? []).filter((e) => e.version !== 'Unreleased')

  return (
    <Box mih="100vh" py="xl">
      <Container size="sm">
        <Stack gap="xl">
          <Group gap="xs" style={{ cursor: 'pointer' }} onClick={() => router.history.back()}>
            <TbArrowLeft size={16} />
            <Text size="sm" c="dimmed">
              Kembali
            </Text>
          </Group>

          <Group gap="sm">
            <ThemeIcon size="lg" variant="light" color="blue" radius="md">
              <TbSparkles size={18} />
            </ThemeIcon>
            <div>
              <Title order={2}>Pembaruan Aplikasi</Title>
              <Text size="sm" c="dimmed">
                Riwayat perubahan semua versi
              </Text>
            </div>
          </Group>

          <Divider />

          {isLoading && (
            <Center py="xl">
              <Loader size="sm" />
            </Center>
          )}

          {isError && (
            <Text c="red" size="sm">
              Gagal memuat changelog.
            </Text>
          )}

          {!isLoading && !isError && entries.length === 0 && (
            <Text c="dimmed" size="sm">
              Belum ada entri changelog.
            </Text>
          )}

          {entries.length > 0 && (
            <Timeline active={0} bulletSize={24} lineWidth={2}>
              {entries.map((entry, i) => {
                const sections = Object.entries(entry.sections).filter(([, items]) => items && items.length > 0)
                return (
                  <Timeline.Item
                    key={entry.version}
                    bullet={<TbSparkles size={12} />}
                    title={
                      <Group gap="xs" mb={4}>
                        <Text fw={600}>v{entry.version}</Text>
                        {i === 0 && (
                          <Badge size="xs" color="blue" variant="filled">
                            Terbaru
                          </Badge>
                        )}
                        {entry.date && (
                          <Text size="xs" c="dimmed">
                            {entry.date}
                          </Text>
                        )}
                      </Group>
                    }
                  >
                    <Stack gap="sm" mt="xs">
                      {sections.map(([section, items]) => (
                        <Box key={section}>
                          <Badge color={SECTION_COLOR[section] ?? 'gray'} variant="light" size="xs" mb={6}>
                            {section}
                          </Badge>
                          <Stack gap={2}>
                            {items!.map((item) => (
                              <Group key={`${section}:${item}`} gap="xs" align="flex-start" wrap="nowrap">
                                <Text size="xs" c="dimmed" mt={2} style={{ flexShrink: 0 }}>
                                  •
                                </Text>
                                <Text size="sm">{item}</Text>
                              </Group>
                            ))}
                          </Stack>
                        </Box>
                      ))}
                    </Stack>
                  </Timeline.Item>
                )
              })}
            </Timeline>
          )}
        </Stack>
      </Container>
    </Box>
  )
}
