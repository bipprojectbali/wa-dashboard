import { Alert, Card, Group, Loader, ScrollArea, Stack, Table, Text, TextInput, Title } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { TbSearch } from 'react-icons/tb'
import { apiFetch } from '@/frontend/lib/apiFetch'
import { WaContactAvatar } from './WaContactAvatar'

interface AccountResp {
  success: boolean
  sessionInfo?: { pushname?: string; wid?: { user?: string }; platform?: string }
}

interface Contact {
  id?: { user?: string; _serialized?: string }
  name?: string
  pushname?: string
  number?: string
  isMyContact?: boolean
}

interface ContactsResp {
  success: boolean
  contacts?: Contact[]
}

const CONTACT_LIMIT = 100

export function WaAccountPanel() {
  const [search, setSearch] = useState('')
  const account = useQuery({
    queryKey: ['wa', 'account'],
    queryFn: () => apiFetch<AccountResp>('/api/wa/account'),
    staleTime: 60_000,
  })
  const contacts = useQuery({
    queryKey: ['wa', 'contacts'],
    queryFn: () => apiFetch<ContactsResp>('/api/wa/contacts'),
    staleTime: 60_000,
  })

  const info = account.data?.sessionInfo
  const myContacts = useMemo(() => {
    const all = (contacts.data?.contacts ?? []).filter((c) => c.isMyContact)
    const q = search.trim().toLowerCase()
    const filtered = q
      ? all.filter(
          (c) =>
            (c.name ?? c.pushname ?? '').toLowerCase().includes(q) ||
            (c.number ?? c.id?.user ?? '').toLowerCase().includes(q),
        )
      : all
    return filtered.slice(0, CONTACT_LIMIT)
  }, [contacts.data, search])

  return (
    <Stack gap="md">
      <Title order={4}>Info Akun</Title>
      {account.isError && (
        <Alert color="red" variant="light">
          {(account.error as Error).message}
        </Alert>
      )}
      <Card withBorder padding="md">
        {account.isLoading ? (
          <Loader size="sm" />
        ) : (
          <Stack gap={4}>
            <Group gap="xs">
              <Text size="sm" fw={600}>
                Nama:
              </Text>
              <Text size="sm">{info?.pushname ?? '—'}</Text>
            </Group>
            <Group gap="xs">
              <Text size="sm" fw={600}>
                Nomor:
              </Text>
              <Text size="sm">{info?.wid?.user ?? '—'}</Text>
            </Group>
            <Group gap="xs">
              <Text size="sm" fw={600}>
                Platform:
              </Text>
              <Text size="sm">{info?.platform ?? '—'}</Text>
            </Group>
          </Stack>
        )}
      </Card>

      <Group justify="space-between">
        <Title order={5}>Kontak ({myContacts.length})</Title>
        {contacts.isLoading && <Loader size="xs" />}
      </Group>
      <TextInput
        placeholder="Cari nama atau nomor…"
        leftSection={<TbSearch size={16} />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
      />
      <ScrollArea h={360}>
        <Table stickyHeader highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={48}>Foto</Table.Th>
              <Table.Th>Nama</Table.Th>
              <Table.Th>Nomor</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {myContacts.map((c) => {
              const contactId = c.id?._serialized ?? (c.id?.user ? `${c.id.user}@c.us` : '')
              return (
                <Table.Tr key={c.id?._serialized ?? c.id?.user}>
                  <Table.Td>
                    <WaContactAvatar contactId={contactId} name={c.name ?? c.pushname} />
                  </Table.Td>
                  <Table.Td>{c.name ?? c.pushname ?? '—'}</Table.Td>
                  <Table.Td>{c.number ?? c.id?.user ?? '—'}</Table.Td>
                </Table.Tr>
              )
            })}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Stack>
  )
}
