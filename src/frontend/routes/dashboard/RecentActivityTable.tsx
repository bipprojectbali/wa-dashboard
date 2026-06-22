import { Avatar, Card, Group, Paper, Stack, Text } from '@mantine/core'

const activities = [
  { user: 'Budi S.', action: 'Membuat order baru', time: '2 menit lalu', color: 'blue' },
  { user: 'Siti R.', action: 'Update profil', time: '15 menit lalu', color: 'green' },
  { user: 'Andi P.', action: 'Pembayaran diterima', time: '1 jam lalu', color: 'teal' },
  { user: 'Dewi L.', action: 'Request refund', time: '3 jam lalu', color: 'orange' },
  { user: 'Reza M.', action: 'Register akun baru', time: '5 jam lalu', color: 'violet' },
]

export function RecentActivityTable() {
  return (
    <Card withBorder padding="lg" radius="md">
      <Text fw={600} mb="md">
        Recent Activity
      </Text>
      <Stack gap="sm">
        {activities.map((act) => (
          <Paper
            key={`${act.user}-${act.action}-${act.time}`}
            p="sm"
            radius="sm"
            bg="var(--mantine-color-default-hover)"
          >
            <Group justify="space-between">
              <Group gap="sm">
                <Avatar color={act.color} radius="xl" size="sm">
                  {act.user.charAt(0)}
                </Avatar>
                <div>
                  <Text size="sm" fw={500}>
                    {act.user}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {act.action}
                  </Text>
                </div>
              </Group>
              <Text size="xs" c="dimmed">
                {act.time}
              </Text>
            </Group>
          </Paper>
        ))}
      </Stack>
    </Card>
  )
}
