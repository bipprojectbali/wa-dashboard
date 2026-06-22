import { Button, Center, Stack, Text, Title } from '@mantine/core'
import { Link } from '@tanstack/react-router'
import { TbArrowLeft, TbError404 } from 'react-icons/tb'

export function NotFound() {
  return (
    <Center mih="100vh" px="md">
      <Stack align="center" gap="md">
        <TbError404
          style={{ width: 'clamp(48px, 15vw, 80px)', height: 'clamp(48px, 15vw, 80px)' }}
          color="var(--mantine-color-dimmed)"
        />
        <Title order={1} fz={{ base: 'xl', sm: '2xl', md: '3xl' }}>
          404
        </Title>
        <Text c="dimmed" size="lg" ta="center">
          Halaman tidak ditemukan
        </Text>
        <Button component={Link} to="/" leftSection={<TbArrowLeft size={18} />} variant="light">
          Kembali ke Beranda
        </Button>
      </Stack>
    </Center>
  )
}
