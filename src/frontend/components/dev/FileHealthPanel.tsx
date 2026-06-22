import { ActionIcon, Card, Container, Group, SimpleGrid, Stack, Text, ThemeIcon, Title, Tooltip } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { TbClipboardCheck, TbRefresh, TbRuler2 } from 'react-icons/tb'
import { apiFetch } from '@/frontend/lib/apiFetch'
import { FiltersCard } from './FileHealthPanel.filters'
import { FileHealthTable } from './FileHealthPanel.table'
import { type FileHealth, type FileHealthResponse, fmtNumber, STATS } from './FileHealthPanel.types'

const QUERY_KEY = ['admin', 'file-health']

function copyPaths(paths: string[]) {
  navigator.clipboard.writeText(paths.join('\n'))
  notifications.show({
    title: 'Copied',
    message: paths.length === 1 ? paths[0] : `${paths.length} paths copied`,
    color: 'green',
    icon: <TbClipboardCheck size={16} />,
    autoClose: 2000,
  })
}

export function FileHealthPanel() {
  const queryClient = useQueryClient()
  const { data, isLoading, isFetching } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => apiFetch<FileHealthResponse>('/api/admin/file-health'),
    staleTime: 60_000,
  })

  const [statusFilter, setStatusFilter] = useState<'all' | FileHealth['status']>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const files = data?.files ?? []
  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const f of files) set.add(f.category)
    return ['all', ...Array.from(set).sort()]
  }, [files])

  const filtered = useMemo(
    () =>
      files.filter((f) => {
        if (statusFilter !== 'all' && f.status !== statusFilter) return false
        if (categoryFilter !== 'all' && f.category !== categoryFilter) return false
        return true
      }),
    [files, statusFilter, categoryFilter],
  )

  const allFilteredSelected = filtered.length > 0 && filtered.every((f) => selected.has(f.path))
  const someFilteredSelected = filtered.some((f) => selected.has(f.path))

  function toggleRow(path: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(path) ? next.delete(path) : next.add(path)
      return next
    })
  }

  function toggleAll() {
    if (allFilteredSelected) {
      setSelected((prev) => {
        const next = new Set(prev)
        for (const f of filtered) next.delete(f.path)
        return next
      })
    } else {
      setSelected((prev) => {
        const next = new Set(prev)
        for (const f of filtered) next.add(f.path)
        return next
      })
    }
  }

  const summary = data?.summary
  const counts: Record<string, number> = {
    totalFiles: summary?.totalFiles ?? 0,
    ok: summary?.byStatus.ok ?? 0,
    warn: summary?.byStatus.warn ?? 0,
    critical: summary?.byStatus.critical ?? 0,
  }

  return (
    <Container size="xl" px={{ base: 0, sm: 'md' }}>
      <Stack gap="lg">
        <Group justify="space-between" wrap="wrap">
          <Group gap="sm">
            <ThemeIcon size="lg" variant="light" color="orange">
              <TbRuler2 size={20} />
            </ThemeIcon>
            <div>
              <Title order={3}>File Health</Title>
              <Text size="xs" c="dimmed">
                Scan ukuran file project — rujukan: docs/FILE-HEALTH.md
              </Text>
            </div>
          </Group>
          <Tooltip label="Refresh scan">
            <ActionIcon
              variant="light"
              size="lg"
              onClick={() => queryClient.invalidateQueries({ queryKey: QUERY_KEY })}
              loading={isFetching}
            >
              <TbRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>

        <SimpleGrid cols={{ base: 2, sm: 4 }}>
          {STATS.map((s) => (
            <Card key={s.key} withBorder padding="lg" radius="md">
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>
                  {s.title}
                </Text>
                <ThemeIcon variant="light" color={s.color} size="sm">
                  <s.icon size={14} />
                </ThemeIcon>
              </Group>
              <Text fw={700} size="xl">
                {isLoading ? '—' : fmtNumber(counts[s.key])}
              </Text>
            </Card>
          ))}
        </SimpleGrid>

        {summary && (
          <Card withBorder radius="md" p="md">
            <Group gap="lg" wrap="wrap">
              <div>
                <Text size="xs" c="dimmed">
                  Total Lines
                </Text>
                <Text fw={600}>{fmtNumber(summary.totalLines)}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  Total Characters
                </Text>
                <Text fw={600}>{fmtNumber(summary.totalChars)}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  Hard Limit
                </Text>
                <Text fw={600}>
                  {summary.hardLimitLines} lines / {fmtNumber(summary.hardLimitChars)} chars
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  Exempt
                </Text>
                <Text fw={600}>{fmtNumber(summary.byStatus.exempt ?? 0)}</Text>
              </div>
            </Group>
          </Card>
        )}

        <FiltersCard
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
          categories={categories}
          totalFiles={files.length}
          filteredCount={filtered.length}
          selectedCount={selected.size}
          selectedPaths={[...selected]}
          filteredPaths={filtered.map((f) => f.path)}
          counts={counts}
          exemptCount={summary?.byStatus.exempt ?? 0}
          clearSelection={() => setSelected(new Set())}
        />

        <FileHealthTable
          filtered={filtered}
          isLoading={isLoading}
          selected={selected}
          onToggleRow={toggleRow}
          onToggleAll={toggleAll}
          allFilteredSelected={allFilteredSelected}
          someFilteredSelected={someFilteredSelected}
          onCopyPath={(path) => copyPaths([path])}
        />
      </Stack>
    </Container>
  )
}
