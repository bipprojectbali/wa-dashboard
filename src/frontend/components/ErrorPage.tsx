import { Button, Center, Code, Stack, Text, Title } from '@mantine/core'
import { TbAlertTriangle, TbRefresh } from 'react-icons/tb'

export function ErrorPage({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak terduga'

  return (
    <Center mih="100vh" px="md">
      <Stack align="center" gap="md" maw={{ base: '100%', sm: 480 }}>
        <TbAlertTriangle
          style={{ width: 'clamp(48px, 12vw, 80px)', height: 'clamp(48px, 12vw, 80px)' }}
          color="var(--mantine-color-red-6)"
        />
        <Title order={1} fz={{ base: 'xl', sm: '2xl', md: '3xl' }}>
          500
        </Title>
        <Text c="dimmed" size="lg" ta="center">
          Terjadi kesalahan pada server
        </Text>
        <Code block c="red" style={{ maxWidth: '100%', wordBreak: 'break-word' }}>
          {message}
        </Code>
        <Button onClick={() => window.location.reload()} leftSection={<TbRefresh size={18} />} variant="light">
          Muat Ulang
        </Button>
      </Stack>
    </Center>
  )
}
