import { Alert, Box, Button, Paper, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { createRoute } from '@tanstack/react-router'
import { TbAlertTriangle, TbLogout, TbShieldOff } from 'react-icons/tb'
import { Background3D } from '@/frontend/components/Background3D'
import { ThemeToggle } from '@/frontend/components/ThemeToggle'
import { useLogout } from '@/frontend/hooks/useAuth'
import { rootRoute } from './__root'

export const blockedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/blocked',
  component: BlockedPage,
})

function BlockedPage() {
  const logout = useLogout()

  return (
    <Background3D>
      <Box style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
        {/* Header with theme toggle */}
        <Box
          px={{ base: 'md', sm: 'xl' }}
          py="sm"
          style={{ display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}
        >
          <ThemeToggle />
        </Box>

        {/* Centered blocked card */}
        <Box
          px={{ base: 'md', xs: 'lg', sm: 0 }}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            paddingBottom: 'env(safe-area-inset-bottom, 16px)',
          }}
        >
          <Paper
            shadow="md"
            p={{ base: 'lg', sm: 'xl' }}
            radius="md"
            w={{ base: '100%', xs: 460 }}
            maw={460}
            withBorder
          >
            <Stack align="center" gap="md">
              <ThemeIcon color="red" size={56} radius="xl" variant="light">
                <TbShieldOff size={32} />
              </ThemeIcon>

              <Title order={2} ta="center" fz={{ base: 'xl', sm: '2xl' }}>
                Akun Diblokir
              </Title>

              <Text c="dimmed" ta="center" size="sm">
                Akun Anda telah diblokir oleh administrator. Anda tidak dapat mengakses halaman manapun di aplikasi ini
                sampai akun Anda dibuka kembali.
              </Text>

              <Alert icon={<TbAlertTriangle size={18} />} color="red" variant="light" w="100%">
                <Text size="sm">
                  <strong>Apa yang terjadi?</strong>
                  <br />
                  Administrator telah menonaktifkan akses Anda. Ini bisa terjadi karena pelanggaran ketentuan penggunaan
                  atau alasan keamanan lainnya.
                </Text>
              </Alert>

              <Alert icon={<TbAlertTriangle size={18} />} color="blue" variant="light" w="100%">
                <Text size="sm">
                  <strong>Apa yang harus dilakukan?</strong>
                  <br />
                  Hubungi administrator untuk informasi lebih lanjut atau untuk mengajukan pembukaan blokir akun Anda.
                </Text>
              </Alert>

              <Button
                fullWidth
                size="md"
                color="red"
                variant="light"
                leftSection={<TbLogout size={18} />}
                onClick={() => logout.mutate()}
                loading={logout.isPending}
              >
                Logout
              </Button>
            </Stack>
          </Paper>
        </Box>
      </Box>
    </Background3D>
  )
}
