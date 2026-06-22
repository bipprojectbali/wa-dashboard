import { Container, Stack, Text, ThemeIcon, Title } from '@mantine/core'

function PlaceholderPanel({
  title,
  desc,
  icon: Icon,
}: {
  title: string
  desc: string
  icon: React.ComponentType<{ size: number }>
}) {
  return (
    <Container size="lg" px={{ base: 'md', sm: 'lg' }}>
      <Stack align="center" justify="center" gap="md" mih={{ base: 250, sm: 350, md: 400 }}>
        <ThemeIcon size={56} variant="light" color="gray" radius="xl">
          <Icon size={28} />
        </ThemeIcon>
        <Title order={3} fz={{ base: 'md', sm: 'lg' }}>
          {title}
        </Title>
        <Text c="dimmed" ta="center" maw={{ base: '100%', sm: 350, md: 400 }} fz={{ base: 'sm', sm: 'md' }}>
          {desc}
        </Text>
      </Stack>
    </Container>
  )
}

export { PlaceholderPanel }
