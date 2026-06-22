import {
  ActionIcon,
  Card,
  Container,
  Group,
  Progress,
  RingProgress,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core'
import { TbActivity, TbArrowDownRight, TbArrowUpRight, TbBell, TbClipboardList, TbCoin, TbUsers } from 'react-icons/tb'
import { RecentActivityTable } from './RecentActivityTable'

const statsData = [
  { title: 'Revenue', value: '$13,456', diff: 34, icon: TbCoin, color: 'teal' },
  { title: 'Users', value: '1,234', diff: 13, icon: TbUsers, color: 'blue' },
  { title: 'Orders', value: '456', diff: -8, icon: TbClipboardList, color: 'violet' },
  { title: 'Activity', value: '89%', diff: 5, icon: TbActivity, color: 'orange' },
]

export function OverviewPanel() {
  return (
    <Container size="lg" px={{ base: 0, sm: 'md' }}>
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={3} fz={{ base: 'lg', sm: 'xl' }}>
            Overview
          </Title>
          <Group gap="xs">
            <Tooltip label="Notifications">
              <ActionIcon variant="subtle" color="gray">
                <TbBell size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }}>
          {statsData.map((stat) => (
            <Card key={stat.title} withBorder padding="lg" radius="md">
              <Group justify="space-between" mb="xs">
                <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                  {stat.title}
                </Text>
                <ThemeIcon variant="light" color={stat.color} size="sm" radius="xl">
                  <stat.icon size={14} />
                </ThemeIcon>
              </Group>
              <Text fw={700} size="xl">
                {stat.value}
              </Text>
              <Group gap={4} mt={4}>
                {stat.diff > 0 ? (
                  <TbArrowUpRight size={14} color="var(--mantine-color-teal-6)" />
                ) : (
                  <TbArrowDownRight size={14} color="var(--mantine-color-red-6)" />
                )}
                <Text size="xs" c={stat.diff > 0 ? 'teal' : 'red'} fw={500}>
                  {Math.abs(stat.diff)}%
                </Text>
                <Text size="xs" c="dimmed">
                  vs bulan lalu
                </Text>
              </Group>
            </Card>
          ))}
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, md: 2 }}>
          <Card withBorder padding="lg" radius="md">
            <Text fw={600} mb="md">
              Traffic Source
            </Text>
            <Stack gap="sm">
              {[
                { label: 'Direct', value: 45, color: 'blue' },
                { label: 'Organic Search', value: 30, color: 'teal' },
                { label: 'Social Media', value: 15, color: 'violet' },
                { label: 'Referral', value: 10, color: 'orange' },
              ].map((item) => (
                <div key={item.label}>
                  <Group justify="space-between" mb={4}>
                    <Text size="sm">{item.label}</Text>
                    <Text size="sm" fw={500}>
                      {item.value}%
                    </Text>
                  </Group>
                  <Progress value={item.value} color={item.color} size="sm" radius="xl" />
                </div>
              ))}
            </Stack>
          </Card>

          <Card withBorder padding="lg" radius="md">
            <Text fw={600} mb="md">
              Performance
            </Text>
            <Group justify="center" gap="xl">
              {[
                { value: 72, color: 'blue', label: 'Completion' },
                { value: 89, color: 'teal', label: 'Uptime' },
                { value: 56, color: 'orange', label: 'Efficiency' },
              ].map((item) => (
                <div key={item.label} style={{ textAlign: 'center' }}>
                  <RingProgress
                    size={100}
                    thickness={10}
                    roundCaps
                    sections={[{ value: item.value, color: item.color }]}
                    label={
                      <Text ta="center" fw={700} size="lg">
                        {item.value}%
                      </Text>
                    }
                  />
                  <Text size="xs" c="dimmed" mt={4}>
                    {item.label}
                  </Text>
                </div>
              ))}
            </Group>
          </Card>
        </SimpleGrid>

        <RecentActivityTable />
      </Stack>
    </Container>
  )
}
