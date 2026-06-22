import {
  ActionIcon,
  AppShell,
  Badge,
  Box,
  Burger,
  Container,
  Divider,
  Group,
  Menu,
  NavLink,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
  useMantineColorScheme,
} from '@mantine/core'
import { useDisclosure, useMediaQuery } from '@mantine/hooks'
import { modals } from '@mantine/modals'
import { createRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import {
  TbCode,
  TbDotsVertical,
  TbLayoutDashboard,
  TbLayoutSidebarLeftCollapse,
  TbLayoutSidebarLeftExpand,
  TbLogout,
  TbMoon,
  TbShieldCheck,
  TbSun,
  TbUser,
} from 'react-icons/tb'
import { UserAvatar } from '@/frontend/components/UserAvatar'
import { useLogout, useSession } from '@/frontend/hooks/useAuth'
import { authClient } from '@/lib/auth-client'
import { rootRoute } from './__root'

export const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile',
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
  component: ProfilePage,
})

const roleBadgeColor: Record<string, string> = {
  USER: 'blue',
  QC: 'cyan',
  ADMIN: 'violet',
  SUPER_ADMIN: 'red',
}

function ProfilePage() {
  const { data } = useSession()
  const logout = useLogout()
  const { colorScheme, toggleColorScheme } = useMantineColorScheme()
  const user = data?.user
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure(false)
  const isMobile = useMediaQuery('(max-width: 48em)')
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('profile:sidebar') === 'collapsed')
  const toggleSidebar = () => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('profile:sidebar', next ? 'collapsed' : 'open')
      return next
    })
  }
  const confirmLogout = () =>
    modals.openConfirmModal({
      title: 'Logout',
      children: <Text size="sm">Are you sure you want to logout?</Text>,
      labels: { confirm: 'Logout', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => logout.mutate(),
    })

  const avatarColor =
    user?.role === 'SUPER_ADMIN' ? 'red' : user?.role === 'ADMIN' ? 'violet' : user?.role === 'QC' ? 'cyan' : 'blue'

  const canAccessDashboard = user?.role === 'ADMIN' || user?.role === 'QC' || user?.role === 'SUPER_ADMIN'

  const userMenuItems = (
    <>
      <Menu.Item
        leftSection={colorScheme === 'dark' ? <TbSun size={14} /> : <TbMoon size={14} />}
        onClick={() => toggleColorScheme()}
        closeMenuOnClick={false}
      >
        {colorScheme === 'dark' ? 'Light mode' : 'Dark mode'}
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item color="red" leftSection={<TbLogout size={14} />} onClick={confirmLogout}>
        Logout
      </Menu.Item>
    </>
  )

  return (
    <AppShell
      header={{ height: 56, collapsed: !isMobile }}
      navbar={{ width: collapsed ? 60 : 260, breakpoint: 'sm', collapsed: { mobile: !mobileOpened } }}
      padding={{ base: 'sm', sm: 'md' }}
    >
      <AppShell.Header px="md" hiddenFrom="sm">
        <Group h="100%" justify="space-between">
          <Group gap="xs">
            <Burger opened={mobileOpened} onClick={toggleMobile} size="sm" />
            <ThemeIcon size="md" variant="gradient" gradient={{ from: 'blue', to: 'violet' }}>
              <TbUser size={16} />
            </ThemeIcon>
            <Text fw={700} size="sm">
              Profile
            </Text>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p={collapsed ? 'xs' : 'md'}>
        <AppShell.Section>
          <Group gap="xs" mb="md" justify={collapsed ? 'center' : 'space-between'}>
            {collapsed ? (
              <Tooltip label="Expand sidebar" position="right">
                <ActionIcon variant="subtle" color="gray" size="lg" onClick={toggleSidebar}>
                  <TbLayoutSidebarLeftExpand size={18} />
                </ActionIcon>
              </Tooltip>
            ) : (
              <>
                <Group gap="xs">
                  <ThemeIcon size="lg" variant="gradient" gradient={{ from: 'blue', to: 'violet' }}>
                    <TbShieldCheck size={18} />
                  </ThemeIcon>
                  <div>
                    <Text fw={700} size="sm">
                      My Account
                    </Text>
                    <Text size="xs" c="dimmed">
                      {user?.role === 'SUPER_ADMIN'
                        ? 'Super Admin'
                        : user?.role === 'ADMIN'
                          ? 'Admin'
                          : user?.role === 'QC'
                            ? 'QC'
                            : 'User'}
                    </Text>
                  </div>
                </Group>
                <Tooltip label="Minimize sidebar">
                  <ActionIcon variant="subtle" color="gray" size="sm" onClick={toggleSidebar}>
                    <TbLayoutSidebarLeftCollapse size={18} />
                  </ActionIcon>
                </Tooltip>
              </>
            )}
          </Group>
        </AppShell.Section>

        <AppShell.Section grow>
          {collapsed ? (
            <Tooltip label="Profile" position="right">
              <ActionIcon variant="light" color="blue" size="lg" mb={4} style={{ width: '100%' }}>
                <TbUser size={18} />
              </ActionIcon>
            </Tooltip>
          ) : (
            <NavLink label="Profile" leftSection={<TbUser size={18} />} active variant="light" mb={4} />
          )}

          {canAccessDashboard && (
            <>
              {collapsed ? <Divider my={6} /> : <Divider my={6} label="Apps" labelPosition="left" />}
              {collapsed ? (
                <Tooltip label="Dashboard" position="right">
                  <ActionIcon
                    variant="subtle"
                    color="blue"
                    size="lg"
                    mb={4}
                    style={{ width: '100%' }}
                    component="a"
                    href="/dashboard"
                  >
                    <TbLayoutDashboard size={18} />
                  </ActionIcon>
                </Tooltip>
              ) : (
                <NavLink
                  label="Dashboard"
                  leftSection={<TbLayoutDashboard size={18} />}
                  component="a"
                  href="/dashboard"
                  variant="light"
                  mb={4}
                />
              )}
              {user?.role === 'SUPER_ADMIN' &&
                (collapsed ? (
                  <Tooltip label="Dev Console" position="right">
                    <ActionIcon
                      variant="subtle"
                      color="orange"
                      size="lg"
                      mb={4}
                      style={{ width: '100%' }}
                      component="a"
                      href="/dev"
                    >
                      <TbCode size={18} />
                    </ActionIcon>
                  </Tooltip>
                ) : (
                  <NavLink
                    label="Dev Console"
                    leftSection={<TbCode size={18} />}
                    component="a"
                    href="/dev"
                    variant="light"
                    mb={4}
                  />
                ))}
            </>
          )}
        </AppShell.Section>

        <AppShell.Section>
          <Box p={collapsed ? 'xs' : 'sm'} style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
            {collapsed ? (
              <Stack align="center" gap={0}>
                <Menu position="right-end" withArrow shadow="md">
                  <Menu.Target>
                    <Box style={{ cursor: 'pointer', display: 'inline-flex' }}>
                      <UserAvatar user={user} color={avatarColor} size="sm" />
                    </Box>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Label>{user?.name}</Menu.Label>
                    <Menu.Label c="dimmed">{user?.email}</Menu.Label>
                    <Menu.Divider />
                    {userMenuItems}
                  </Menu.Dropdown>
                </Menu>
              </Stack>
            ) : (
              <Group justify="space-between" wrap="nowrap">
                <Group gap="xs" wrap="nowrap" style={{ overflow: 'hidden', flex: 1 }}>
                  <div style={{ flexShrink: 0 }}>
                    <UserAvatar user={user} color={avatarColor} size="sm" />
                  </div>
                  <div style={{ overflow: 'hidden', flex: 1 }}>
                    <Text size="xs" fw={500} truncate>
                      {user?.name}
                    </Text>
                    <Text size="xs" c="dimmed" truncate>
                      {user?.email}
                    </Text>
                  </div>
                </Group>
                <Menu position="top-end" withArrow shadow="md">
                  <Menu.Target>
                    <ActionIcon variant="subtle" color="gray" size="sm" style={{ flexShrink: 0 }}>
                      <TbDotsVertical size={14} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>{userMenuItems}</Menu.Dropdown>
                </Menu>
              </Group>
            )}
          </Box>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        <Container size={'xl'} p={0}>
          <Stack gap="md" mx="auto">
            <Paper withBorder p={{ base: 'lg', sm: 'xl' }} radius="md">
              <Stack align="center" gap="md">
                <UserAvatar user={user} color={avatarColor} size={80} />
                <div style={{ textAlign: 'center' }}>
                  <Text fw={600} size="lg">
                    {user?.name}
                  </Text>
                  <Text c="dimmed" size="sm" style={{ wordBreak: 'break-all' }}>
                    {user?.email}
                  </Text>
                </div>
                <Badge color={roleBadgeColor[user?.role ?? 'USER']} variant="light" size="lg">
                  {user?.role}
                </Badge>
              </Stack>
            </Paper>

            <Paper withBorder p={{ base: 'md', sm: 'lg' }} radius="md">
              <Stack gap="sm">
                <Group gap="xs">
                  <TbUser size={16} />
                  <Text fw={500} size="sm">
                    Account Info
                  </Text>
                </Group>
                <Divider />
                {[
                  { label: 'Name', value: user?.name },
                  { label: 'Email', value: user?.email },
                  { label: 'Role', value: user?.role },
                ].map(({ label, value }) => (
                  <Group key={label} justify="space-between" wrap="nowrap" gap="xs">
                    <Text size="sm" c="dimmed" style={{ flexShrink: 0 }}>
                      {label}
                    </Text>
                    <Text size="sm" ta="right" style={{ wordBreak: 'break-all' }}>
                      {value}
                    </Text>
                  </Group>
                ))}
              </Stack>
            </Paper>
          </Stack>
        </Container>
      </AppShell.Main>
    </AppShell>
  )
}
