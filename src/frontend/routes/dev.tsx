import {
  ActionIcon,
  AppShell,
  Box,
  Burger,
  Divider,
  Group,
  Menu,
  NavLink,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
  useMantineColorScheme,
} from '@mantine/core'
import { useDisclosure, useMediaQuery } from '@mantine/hooks'
import { createRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import '@xyflow/react/dist/style.css'
import { modals } from '@mantine/modals'
import {
  TbApi,
  TbBrandWhatsapp,
  TbBug,
  TbChevronRight,
  TbCode,
  TbDatabase,
  TbDotsVertical,
  TbFileText,
  TbLayoutDashboard,
  TbLayoutSidebarLeftCollapse,
  TbLayoutSidebarLeftExpand,
  TbLogout,
  TbMoon,
  TbRuler2,
  TbServer,
  TbSettings,
  TbSitemap,
  TbSparkles,
  TbSun,
  TbUser,
  TbUserSearch,
  TbUsers,
} from 'react-icons/tb'
import { ApiDocsPanel } from '@/frontend/components/dev/ApiDocsPanel'
import { AppLogsPanel } from '@/frontend/components/dev/AppLogsPanel'
import { DatabasePanel } from '@/frontend/components/dev/DatabasePanel'
import { FileHealthPanel } from '@/frontend/components/dev/FileHealthPanel'
import { OverviewPanel } from '@/frontend/components/dev/OverviewPanel'
import { PlaceholderPanel } from '@/frontend/components/dev/PlaceholderPanel'
import { ProjectPanel } from '@/frontend/components/dev/ProjectPanel'
import { UserLogsPanel } from '@/frontend/components/dev/UserLogsPanel'
import { UsersPanel } from '@/frontend/components/dev/UsersPanel'
import { TicketsPanel } from '@/frontend/components/TicketsPanel'
import { UserAvatar } from '@/frontend/components/UserAvatar'
import { openWhatsNew } from '@/frontend/components/WhatsNewModal'
import { useLogout, useSession } from '@/frontend/hooks/useAuth'
import { authClient } from '@/lib/auth-client'
import { rootRoute } from './__root'

const validTabs = [
  'overview',
  'users',
  'tickets',
  'app-logs',
  'user-logs',
  'database',
  'project',
  'file-health',
  'api-docs',
  'settings',
] as const

export const devRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dev',
  validateSearch: (search: Record<string, unknown>) => ({
    tab: validTabs.includes(search.tab as any) ? (search.tab as string) : 'overview',
  }),
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
      if (user.role !== 'SUPER_ADMIN') throw redirect({ to: '/profile' })
    } catch (e) {
      if (e instanceof Error) throw redirect({ to: '/login' })
      throw e
    }
  },
  component: DevPage,
})

const navItems = [
  { label: 'Overview', icon: TbLayoutDashboard, key: 'overview' },
  { label: 'Users', icon: TbUsers, key: 'users' },
  { label: 'Tickets', icon: TbBug, key: 'tickets' },
  { label: 'App Logs', icon: TbServer, key: 'app-logs' },
  { label: 'User Logs', icon: TbUserSearch, key: 'user-logs' },
  { label: 'Database', icon: TbDatabase, key: 'database' },
  { label: 'Project', icon: TbSitemap, key: 'project' },
  { label: 'File Health', icon: TbRuler2, key: 'file-health' },
  { label: 'API Docs', icon: TbApi, key: 'api-docs' },
  { label: 'Settings', icon: TbSettings, key: 'settings' },
]

function DevPage() {
  const { data } = useSession()
  const logout = useLogout()
  const { colorScheme, toggleColorScheme } = useMantineColorScheme()
  const user = data?.user
  const { tab: active } = devRoute.useSearch()
  const navigate = useNavigate()
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] = useDisclosure(false)
  const isMobile = useMediaQuery('(max-width: 48em)')
  const setActive = (key: string) => {
    navigate({ to: '/dev', search: { tab: key } })
    closeMobile()
  }
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('dev:sidebar') === 'collapsed')
  const toggleSidebar = () => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('dev:sidebar', next ? 'collapsed' : 'open')
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

  return (
    <AppShell
      header={{ height: 56, collapsed: !isMobile }}
      navbar={{
        width: collapsed ? 60 : 260,
        breakpoint: 'sm',
        collapsed: { mobile: !mobileOpened },
      }}
      padding={{ base: 'sm', sm: 'md' }}
    >
      <AppShell.Header px="md" hiddenFrom="sm">
        <Group h="100%" justify="space-between">
          <Group gap="xs">
            <Burger opened={mobileOpened} onClick={toggleMobile} size="sm" />
            <ThemeIcon size="md" variant="gradient" gradient={{ from: 'red', to: 'orange' }}>
              <TbCode size={16} />
            </ThemeIcon>
            <Text fw={700} size="sm">
              Dev Console
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
                  <ThemeIcon size="lg" variant="gradient" gradient={{ from: 'red', to: 'orange' }}>
                    <TbCode size={18} />
                  </ThemeIcon>
                  <div>
                    <Text fw={700} size="sm">
                      Dev Console
                    </Text>
                    <Text size="xs" c="dimmed">
                      Super Admin
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
          {navItems.map((item) =>
            collapsed ? (
              <Tooltip key={item.key} label={item.label} position="right">
                <ActionIcon
                  variant={active === item.key ? 'light' : 'subtle'}
                  color={active === item.key ? 'blue' : 'gray'}
                  size="lg"
                  onClick={() => setActive(item.key)}
                  mb={4}
                  style={{ width: '100%' }}
                >
                  <item.icon size={18} />
                </ActionIcon>
              </Tooltip>
            ) : (
              <NavLink
                key={item.key}
                label={item.label}
                leftSection={<item.icon size={18} />}
                rightSection={<TbChevronRight size={14} />}
                active={active === item.key}
                onClick={() => setActive(item.key)}
                variant="light"
                mb={4}
              />
            ),
          )}

          {collapsed ? <Divider my={6} /> : <Divider my={6} label="Apps" labelPosition="left" />}

          {collapsed ? (
            <Tooltip label="Dashboard" position="right">
              <ActionIcon
                variant="subtle"
                color="blue"
                size="lg"
                mb={4}
                style={{ width: '100%' }}
                onClick={() => navigate({ to: '/dashboard', search: { tab: 'dashboard' } })}
              >
                <TbLayoutDashboard size={18} />
              </ActionIcon>
            </Tooltip>
          ) : (
            <NavLink
              label="Dashboard"
              leftSection={<TbLayoutDashboard size={18} />}
              rightSection={<TbChevronRight size={14} />}
              onClick={() => navigate({ to: '/dashboard', search: { tab: 'dashboard' } })}
              variant="light"
              mb={4}
            />
          )}

          {collapsed ? (
            <Tooltip label="WhatsApp" position="right">
              <ActionIcon
                variant="subtle"
                color="green"
                size="lg"
                mb={4}
                style={{ width: '100%' }}
                onClick={() => navigate({ to: '/wa', search: { tab: 'connection' } })}
              >
                <TbBrandWhatsapp size={18} />
              </ActionIcon>
            </Tooltip>
          ) : (
            <NavLink
              label="WhatsApp"
              leftSection={<TbBrandWhatsapp size={18} />}
              rightSection={<TbChevronRight size={14} />}
              onClick={() => navigate({ to: '/wa', search: { tab: 'connection' } })}
              variant="light"
              mb={4}
            />
          )}

          {collapsed ? (
            <Tooltip label="Pembaruan" position="right">
              <ActionIcon
                variant="subtle"
                color="teal"
                size="lg"
                mb={4}
                style={{ width: '100%' }}
                component={Link}
                to="/changelog"
              >
                <TbSparkles size={18} />
              </ActionIcon>
            </Tooltip>
          ) : (
            <NavLink
              label="Pembaruan"
              leftSection={<TbSparkles size={18} />}
              rightSection={<TbChevronRight size={14} />}
              component={Link}
              to="/changelog"
              variant="light"
              mb={4}
            />
          )}

          {collapsed ? (
            <Tooltip label="llms.txt" position="right">
              <ActionIcon
                variant="subtle"
                color="grape"
                size="lg"
                mb={4}
                style={{ width: '100%' }}
                component="a"
                href="/llms.txt"
                target="_blank"
                rel="noopener noreferrer"
              >
                <TbFileText size={18} />
              </ActionIcon>
            </Tooltip>
          ) : (
            <NavLink
              label="llms.txt"
              description="Ringkasan project untuk LLM"
              leftSection={<TbFileText size={18} />}
              rightSection={<TbChevronRight size={14} />}
              component="a"
              href="/llms.txt"
              target="_blank"
              rel="noopener noreferrer"
              variant="light"
              mb={4}
            />
          )}
        </AppShell.Section>

        <AppShell.Section>
          <Box p={collapsed ? 'xs' : 'sm'} style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
            {collapsed ? (
              <Stack align="center" gap={0}>
                <Menu position="right-end" withArrow shadow="md">
                  <Menu.Target>
                    <Box style={{ cursor: 'pointer', display: 'inline-flex' }}>
                      <UserAvatar user={user} color="red" size="sm" />
                    </Box>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Label>{user?.name}</Menu.Label>
                    <Menu.Label c="dimmed">{user?.email}</Menu.Label>
                    <Menu.Divider />
                    <Menu.Item
                      leftSection={colorScheme === 'dark' ? <TbSun size={14} /> : <TbMoon size={14} />}
                      onClick={() => toggleColorScheme()}
                      closeMenuOnClick={false}
                    >
                      {colorScheme === 'dark' ? 'Light mode' : 'Dark mode'}
                    </Menu.Item>
                    <Menu.Item leftSection={<TbUser size={14} />} component="a" href="/profile">
                      Profile
                    </Menu.Item>
                    <Menu.Item leftSection={<TbSparkles size={14} />} onClick={openWhatsNew}>
                      Apa yang baru?
                    </Menu.Item>
                    <Menu.Divider />
                    <Menu.Item color="red" leftSection={<TbLogout size={14} />} onClick={confirmLogout}>
                      Logout
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Stack>
            ) : (
              <Group justify="space-between" wrap="nowrap">
                <Group gap="xs" wrap="nowrap" style={{ overflow: 'hidden', flex: 1 }}>
                  <div style={{ flexShrink: 0 }}>
                    <UserAvatar user={user} color="red" size="sm" />
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
                  <Menu.Dropdown>
                    <Menu.Item
                      leftSection={colorScheme === 'dark' ? <TbSun size={14} /> : <TbMoon size={14} />}
                      onClick={() => toggleColorScheme()}
                      closeMenuOnClick={false}
                    >
                      {colorScheme === 'dark' ? 'Light mode' : 'Dark mode'}
                    </Menu.Item>
                    <Menu.Item leftSection={<TbUser size={14} />} component="a" href="/profile">
                      Profile
                    </Menu.Item>
                    <Menu.Item leftSection={<TbSparkles size={14} />} onClick={openWhatsNew}>
                      Apa yang baru?
                    </Menu.Item>
                    <Menu.Divider />
                    <Menu.Item color="red" leftSection={<TbLogout size={14} />} onClick={confirmLogout}>
                      Logout
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Group>
            )}
          </Box>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        {active === 'overview' && <OverviewPanel />}
        {active === 'users' && <UsersPanel />}
        {active === 'tickets' && <TicketsPanel />}
        {active === 'app-logs' && <AppLogsPanel />}
        {active === 'user-logs' && <UserLogsPanel />}
        {active === 'database' && <DatabasePanel />}
        {active === 'project' && <ProjectPanel />}
        {active === 'file-health' && <FileHealthPanel />}
        {active === 'api-docs' && <ApiDocsPanel />}
        {active === 'settings' && (
          <PlaceholderPanel title="Settings" desc="System configuration akan ditampilkan di sini." icon={TbSettings} />
        )}
      </AppShell.Main>
    </AppShell>
  )
}
