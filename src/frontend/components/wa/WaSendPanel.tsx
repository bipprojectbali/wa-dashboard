import { Alert, Autocomplete, Button, Card, Stack, Text, Textarea, Title } from '@mantine/core'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { TbSend } from 'react-icons/tb'
import { apiFetch } from '@/frontend/lib/apiFetch'

interface SendResp {
  success: boolean
  result?: unknown
}

interface Contact {
  id?: { user?: string; _serialized?: string }
  name?: string
  pushname?: string
  number?: string
  isMyContact?: boolean
  isUser?: boolean
  isGroup?: boolean
}

interface ContactsResp {
  success: boolean
  contacts?: Contact[]
}

const CONTACT_LIMIT = 50

// chatId format: <number>@c.us (e.g. 6281234567890@c.us)
export function WaSendPanel() {
  const [chatId, setChatId] = useState('')
  const [content, setContent] = useState('')

  const contacts = useQuery({
    queryKey: ['wa', 'contacts'],
    queryFn: () => apiFetch<ContactsResp>('/api/wa/contacts'),
    staleTime: 60_000,
  })

  // Map chatId -> display info so the dropdown can show name/number while the
  // sent value stays the raw chatId. Free typing still works (Autocomplete).
  const { options, infoByChatId } = useMemo(() => {
    const list = (contacts.data?.contacts ?? []).filter((c) => c.isMyContact && c.isUser && !c.isGroup)
    const map = new Map<string, { name: string; number: string }>()
    for (const c of list) {
      const id = c.id?._serialized
      if (!id) continue
      if (!map.has(id)) {
        map.set(id, { name: c.name ?? c.pushname ?? '', number: c.number ?? c.id?.user ?? '' })
      }
    }
    return { options: Array.from(map.keys()), infoByChatId: map }
  }, [contacts.data])

  const send = useMutation({
    mutationFn: () =>
      apiFetch<SendResp>('/api/wa/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: chatId.trim(), content }),
      }),
  })

  const canSend = chatId.trim().length > 0 && content.trim().length > 0

  return (
    <Stack gap="md" maw={520}>
      <Title order={4}>Kirim Pesan Tes</Title>
      <Card withBorder padding="md">
        <Stack gap="sm">
          <Autocomplete
            label="Chat ID"
            placeholder="6281234567890@c.us"
            description="Pilih dari kontak atau ketik manual. Format: nomor diawali kode negara diakhiri @c.us, atau identifier @lid"
            data={options}
            value={chatId}
            onChange={setChatId}
            limit={CONTACT_LIMIT}
            maxDropdownHeight={280}
            filter={({ options: opts, search }) => {
              const q = search.trim().toLowerCase()
              if (!q) return opts
              return opts.filter((o) => {
                const id = 'value' in o ? o.value : ''
                const info = infoByChatId.get(id)
                return (
                  id.toLowerCase().includes(q) ||
                  (info?.name.toLowerCase().includes(q) ?? false) ||
                  (info?.number.toLowerCase().includes(q) ?? false)
                )
              })
            }}
            renderOption={({ option }) => {
              const info = infoByChatId.get(option.value)
              return (
                <Stack gap={0}>
                  <Text size="sm">{info?.name || option.value}</Text>
                  {info?.name && (
                    <Text size="xs" c="dimmed">
                      {option.value}
                    </Text>
                  )}
                </Stack>
              )
            }}
          />
          <Textarea
            label="Pesan"
            placeholder="Tulis pesan..."
            minRows={3}
            autosize
            value={content}
            onChange={(e) => setContent(e.currentTarget.value)}
          />
          <Button
            leftSection={<TbSend size={16} />}
            onClick={() => send.mutate()}
            loading={send.isPending}
            disabled={!canSend}
          >
            Kirim
          </Button>
          {send.isSuccess && (
            <Alert color="green" variant="light">
              Pesan terkirim.
            </Alert>
          )}
          {send.isError && (
            <Alert color="red" variant="light">
              <Text size="sm">{(send.error as Error).message}</Text>
            </Alert>
          )}
        </Stack>
      </Card>
    </Stack>
  )
}
