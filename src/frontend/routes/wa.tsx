import {
  ActionIcon,
  AppShell,
  Box,
  Burger,
  Divider,
  Group,
  Menu,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
  useMantineColorScheme,
} from '@mantine/core'
import { useDisclosure, useMediaQuery } from '@mantine/hooks'
import { modals } from '@mantine/modals'
import { createRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import {
  TbAddressBook,
  TbBrandWhatsapp,
  TbChevronRight,
  TbCode,
  TbDotsVertical,
  TbLayoutDashboard,
  TbLayoutSidebarLeftCollapse,
  TbLayoutSidebarLeftExpand,
  TbLogin2,
  TbLogout,
  TbMessages,
  TbMoon,
  TbPlugConnected,
  TbSend,
  TbServer,
  TbShieldCheck,
  TbShieldLock,
  TbSparkles,
  TbSun,
  TbUser,
} from 'react-icons/tb'
import { WaSessionsPanel } from '@/frontend/components/dev/WaSessionsPanel'
import { SimLoginPanel } from '@/frontend/components/sim/SimLoginPanel'
import { UserAvatar } from '@/frontend/components/UserAvatar'
import { openWhatsNew } from '@/frontend/components/WhatsNewModal'
import { WaAccountPanel } from '@/frontend/components/wa/WaAccountPanel'
import { WaConnectionPanel } from '@/frontend/components/wa/WaConnectionPanel'
import { WaMessagesPanel } from '@/frontend/components/wa/WaMessagesPanel'
import { WaPolicyPanel } from '@/frontend/components/wa/WaPolicyPanel'
import { WaSendPanel } from '@/frontend/components/wa/WaSendPanel'
import { WaVerifyPanel } from '@/frontend/components/wa/WaVerifyPanel'
import { useLogout, useSession } from '@/frontend/hooks/useAuth'
import { useWaRealtime } from '@/frontend/hooks/useWaRealtime'
import { authClient } from '@/lib/auth-client'
import { rootRoute } from './__root'

const validTabs = ['connection', 'account', 'send', 'messages', 'policy', 'verify', 'sessions', 'simulation'] as const
type WaTab = (typeof validTabs)[number]

export const waRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/wa',
  validateSearch: (search: Record<string, unknown>) => ({
    tab: (validTabs.includes(search.tab as WaTab) ? search.tab : 'connection') as WaTab,
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
      if (data.user.blocked) throw redirect({ to: '/blocked' })
      if (!['ADMIN', 'SUPER_ADMIN'].includes(data.user.role ?? '')) throw redirect({ to: '/profile' })
    } catch (e) {
      if (e instanceof Error) throw redirect({ to: '/login' })
      throw e
    }
  },
  component: WaPage,
})

const navItems = [
  { key: 'connection', label: 'Koneksi', icon: TbPlugConnected },
  { key: 'account', label: 'Akun & Kontak', icon: TbAddressBook },
  { key: 'send', label: 'Kirim Pesan', icon: TbSend },
  { key: 'messages', label: 'Pesan', icon: TbMessages },
  { key: 'policy', label: 'Aturan & Kontrak', icon: TbShieldLock },
  { key: 'verify', label: 'Verifikasi Nomor', icon: TbShieldCheck },
] as const

// Tab khusus operator SUPER_ADMIN — WA Sessions (operator view semua sesi container)
// & Simulation (uji alur WAV end-to-end). Digabung ke sidebar /wa agar semua fitur
// WhatsApp berada dalam satu menu.
const adminNavItems = [
  { key: 'sessions', label: 'WA Sessions', icon: TbServer },
  { key: 'simulation', label: 'Simulasi WAV', icon: TbLogin2 },
] as const

type SideLink = {
  label: string
  icon: typeof TbCode
  color: string
  onClick: () => void
}

function WaPage() {
  const { data } = useSession()
  const logout = useLogout()
  const { colorScheme, toggleColorScheme } = useMantineColorScheme()
  const user = data?.user
  const { tab: active } = waRoute.useSearch()
  const navigate = useNavigate()
  const { wsReady } = useWaRealtime()
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] = useDisclosure(false)
  const isMobile = useMediaQuery('(max-width: 48em)')
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('wa:sidebar') === 'collapsed')

  const setActive = (key: WaTab) => {
    navigate({ to: '/wa', search: { tab: key } })
    closeMobile()
  }
  const toggleSidebar = () => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('wa:sidebar', next ? 'collapsed' : 'open')
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

  const appLinks: SideLink[] = [
    ...(user?.role === 'SUPER_ADMIN'
      ? [
          {
            label: 'Dev Console',
            icon: TbCode,
            color: 'red',
            onClick: () => navigate({ to: '/dev', search: { tab: 'overview' } }),
          },
        ]
      : []),
    {
      label: 'Dashboard',
      icon: TbLayoutDashboard,
      color: 'blue',
      onClick: () => navigate({ to: '/dashboard', search: { tab: 'dashboard' } }),
    },
    { label: 'Pembaruan', icon: TbSparkles, color: 'teal', onClick: () => navigate({ to: '/changelog' }) },
  ]

  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  const renderTabItem = (item: { key: WaTab; label: string; icon: typeof TbCode }) =>
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
    )

  const renderSideLink = (item: SideLink) =>
    collapsed ? (
      <Tooltip key={item.label} label={item.label} position="right">
        <ActionIcon
          variant="subtle"
          color={item.color}
          size="lg"
          mb={4}
          style={{ width: '100%' }}
          onClick={item.onClick}
        >
          <item.icon size={18} />
        </ActionIcon>
      </Tooltip>
    ) : (
      <NavLink
        key={item.label}
        label={item.label}
        leftSection={<item.icon size={18} />}
        rightSection={<TbChevronRight size={14} />}
        onClick={item.onClick}
        variant="light"
        mb={4}
      />
    )

  const userMenuItems = (
    <>
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
            <ThemeIcon size="md" variant="gradient" gradient={{ from: 'teal', to: 'green' }}>
              <TbBrandWhatsapp size={16} />
            </ThemeIcon>
            <Text fw={700} size="sm">
              WhatsApp Dashboard
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
                  <ThemeIcon size="lg" variant="gradient" gradient={{ from: 'teal', to: 'green' }}>
                    <TbBrandWhatsapp size={18} />
                  </ThemeIcon>
                  <div>
                    <Text fw={700} size="sm">
                      WhatsApp
                    </Text>
                    <Text size="xs" c="dimmed">
                      Dashboard
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

        <AppShell.Section grow component={ScrollArea} type="scroll">
          {navItems.map(renderTabItem)}

          {isSuperAdmin && (
            <>
              {collapsed ? <Divider my={6} /> : <Divider my={6} label="Operator" labelPosition="left" />}
              {adminNavItems.map(renderTabItem)}
            </>
          )}

          {collapsed ? <Divider my={6} /> : <Divider my={6} label="Navigasi" labelPosition="left" />}
          {appLinks.map(renderSideLink)}
        </AppShell.Section>

        <AppShell.Section>
          <Box p={collapsed ? 'xs' : 'sm'} style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
            {collapsed ? (
              <Stack align="center" gap={0}>
                <Menu position="right-end" withArrow shadow="md">
                  <Menu.Target>
                    <Box style={{ cursor: 'pointer', display: 'inline-flex' }}>
                      <UserAvatar user={user} color={user?.role === 'SUPER_ADMIN' ? 'red' : 'violet'} size="sm" />
                    </Box>
                  </Menu.Target>
                  <Menu.Dropdown>{userMenuItems}</Menu.Dropdown>
                </Menu>
              </Stack>
            ) : (
              <Group justify="space-between" wrap="nowrap">
                <Group gap="xs" wrap="nowrap" style={{ overflow: 'hidden', flex: 1 }}>
                  <div style={{ flexShrink: 0 }}>
                    <UserAvatar user={user} color={user?.role === 'SUPER_ADMIN' ? 'red' : 'violet'} size="sm" />
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
        {active === 'connection' && <WaConnectionPanel wsReady={wsReady} />}
        {active === 'account' && <WaAccountPanel />}
        {active === 'send' && <WaSendPanel />}
        {active === 'messages' && <WaMessagesPanel />}
        {active === 'policy' && <WaPolicyPanel />}
        {active === 'verify' && <WaVerifyPanel />}
        {active === 'sessions' && isSuperAdmin && <WaSessionsPanel />}
        {active === 'simulation' && isSuperAdmin && <SimLoginPanel />}
      </AppShell.Main>
    </AppShell>
  )
}
