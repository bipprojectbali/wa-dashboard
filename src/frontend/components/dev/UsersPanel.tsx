import { Badge, Card, Container, Group, Stack, Table, Text, Title } from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/frontend/hooks/useAuth'
import { usePresence } from '@/frontend/hooks/usePresence'
import { apiFetch } from '@/frontend/lib/apiFetch'
import type { AdminUser } from './shared'
import { UserRow } from './UsersPanel.row'

export function UsersPanel() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => apiFetch<{ users: AdminUser[] }>('/api/admin/users'),
  })
  const { data: sessionData } = useSession()
  const currentUserId = sessionData?.user?.id
  const { onlineUserIds } = usePresence()

  const USERS_KEY = ['admin', 'users']

  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      apiFetch(`/api/admin/users/${id}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      }),
    onMutate: async ({ id, role }) => {
      await queryClient.cancelQueries({ queryKey: USERS_KEY })
      const previous = queryClient.getQueryData<{ users: AdminUser[] }>(USERS_KEY)
      queryClient.setQueryData<{ users: AdminUser[] }>(USERS_KEY, (old) => ({
        users: (old?.users ?? []).map((u) => (u.id === id ? { ...u, role: role as AdminUser['role'] } : u)),
      }))
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(USERS_KEY, ctx.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: USERS_KEY }),
  })

  const toggleBlock = useMutation({
    mutationFn: ({ id, blocked }: { id: string; blocked: boolean }) =>
      apiFetch(`/api/admin/users/${id}/block`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocked }),
      }),
    onMutate: async ({ id, blocked }) => {
      await queryClient.cancelQueries({ queryKey: USERS_KEY })
      const previous = queryClient.getQueryData<{ users: AdminUser[] }>(USERS_KEY)
      queryClient.setQueryData<{ users: AdminUser[] }>(USERS_KEY, (old) => ({
        users: (old?.users ?? []).map((u) => (u.id === id ? { ...u, blocked } : u)),
      }))
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(USERS_KEY, ctx.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: USERS_KEY }),
  })

  const users = data?.users ?? []

  return (
    <Container size="lg" px={{ base: 0, sm: 'md' }}>
      <Stack gap="lg">
        <Group justify="space-between">
          <Title order={3}>User Management</Title>
          <Badge variant="light" size="lg">
            {users.length} users
          </Badge>
        </Group>

        <Card withBorder radius="md" p={0}>
          <Table.ScrollContainer minWidth={480}>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>User</Table.Th>
                  <Table.Th>Role</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th ta="right">Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {isLoading && (
                  <Table.Tr>
                    <Table.Td colSpan={4}>
                      <Text ta="center" c="dimmed" py="md">
                        Loading...
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
                {users.map((u) => (
                  <UserRow
                    key={u.id}
                    u={u}
                    isSelf={u.id === currentUserId}
                    isOnline={onlineUserIds.includes(u.id)}
                    onChangeRole={(id, role) => changeRole.mutate({ id, role })}
                    onToggleBlock={(id, blocked) => toggleBlock.mutate({ id, blocked })}
                  />
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      </Stack>
    </Container>
  )
}
