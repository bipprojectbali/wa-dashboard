import { Badge, Button, Divider, List, Modal, Stack, Text, Title } from '@mantine/core'
import { useEffect, useState } from 'react'

interface ChangelogEntry {
  version: string | null
  date: string | null
  sections: Partial<Record<'Added' | 'Changed' | 'Fixed' | 'Removed', string[]>>
}

const STORAGE_KEY = 'last_seen_version'
const EVENT_NAME = 'whats-new:open'

const SECTION_COLOR: Record<string, string> = {
  Added: 'green',
  Changed: 'blue',
  Fixed: 'orange',
  Removed: 'red',
}

// Trigger modal dari mana saja tanpa prop drilling
export function openWhatsNew() {
  window.dispatchEvent(new Event(EVENT_NAME))
}

async function fetchEntry(): Promise<ChangelogEntry | null> {
  try {
    const res = await fetch('/api/changelog')
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export function WhatsNewModal() {
  const [entry, setEntry] = useState<ChangelogEntry | null>(null)
  const [open, setOpen] = useState(false)

  // Auto-show saat versi berubah
  useEffect(() => {
    async function check() {
      try {
        const verRes = await fetch('/api/version')
        if (!verRes.ok) return
        const { version } = await verRes.json()
        const seen = localStorage.getItem(STORAGE_KEY)
        if (seen === version) return

        const data = await fetchEntry()
        if (data?.version && data.version !== 'Unreleased') {
          setEntry(data)
          setOpen(true)
        }
      } catch {
        // silently ignore — fitur info, bukan kritis
      }
    }
    check()
  }, [])

  // Manual re-open via event
  useEffect(() => {
    async function handleOpen() {
      if (!entry) {
        const data = await fetchEntry()
        if (data?.version) setEntry(data)
      }
      setOpen(true)
    }
    window.addEventListener(EVENT_NAME, handleOpen)
    return () => window.removeEventListener(EVENT_NAME, handleOpen)
  }, [entry])

  function dismiss() {
    if (entry?.version) localStorage.setItem(STORAGE_KEY, entry.version)
    setOpen(false)
  }

  if (!entry) return null

  const sections = Object.entries(entry.sections).filter(([, items]) => items && items.length > 0)

  return (
    <Modal
      opened={open}
      onClose={dismiss}
      title={
        <Stack gap={4}>
          <Title order={4}>Pembaruan Aplikasi</Title>
          <Text size="sm" c="dimmed">
            Versi {entry.version}
            {entry.date ? ` — ${entry.date}` : ''}
          </Text>
        </Stack>
      }
      size="md"
      centered
    >
      <Stack gap="md">
        {sections.map(([section, items], i) => (
          <Stack key={section} gap="xs">
            {i > 0 && <Divider />}
            <Badge color={SECTION_COLOR[section] ?? 'gray'} variant="light" size="sm">
              {section}
            </Badge>
            <List size="sm" spacing={4}>
              {items!.map((item) => (
                <List.Item key={`${section}:${item}`}>{item}</List.Item>
              ))}
            </List>
          </Stack>
        ))}

        <Button onClick={dismiss} fullWidth mt="xs">
          Mengerti
        </Button>
      </Stack>
    </Modal>
  )
}
