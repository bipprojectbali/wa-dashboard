import { Card, Container, Group, Stack, Table, Text, Title } from '@mantine/core'
import { TbArrowDownRight, TbArrowUpRight } from 'react-icons/tb'

export function AnalyticsPanel() {
  return (
    <Container size="lg" px={{ base: 0, sm: 'md' }}>
      <Stack gap="md">
        <Title order={3} fz={{ base: 'lg', sm: 'xl' }}>
          Analytics
        </Title>

        <Stack gap="md">
          <Group grow>
            {[
              { label: 'Page Views', value: '24,521', diff: 12 },
              { label: 'Bounce Rate', value: '32.4%', diff: -3 },
              { label: 'Avg. Session', value: '4m 23s', diff: 8 },
            ].map((stat) => (
              <Card key={stat.label} withBorder padding="lg" radius="md">
                <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                  {stat.label}
                </Text>
                <Text fw={700} size="xl" mt={4}>
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
                </Group>
              </Card>
            ))}
          </Group>

          <Card withBorder padding="lg" radius="md">
            <Text fw={600} mb="md">
              Top Pages
            </Text>
            <Table.ScrollContainer minWidth={400}>
              <Table highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Page</Table.Th>
                    <Table.Th ta="right">Views</Table.Th>
                    <Table.Th ta="right">Unique</Table.Th>
                    <Table.Th ta="right">Bounce</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {[
                    { page: '/home', views: '8,234', unique: '5,120', bounce: '28%' },
                    { page: '/products', views: '5,678', unique: '3,456', bounce: '35%' },
                    { page: '/pricing', views: '3,912', unique: '2,890', bounce: '22%' },
                    { page: '/about', views: '2,345', unique: '1,780', bounce: '41%' },
                    { page: '/contact', views: '1,567', unique: '1,230', bounce: '38%' },
                  ].map((row) => (
                    <Table.Tr key={row.page}>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {row.page}
                        </Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text size="sm">{row.views}</Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text size="sm">{row.unique}</Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text size="sm">{row.bounce}</Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Card>
        </Stack>
      </Stack>
    </Container>
  )
}
