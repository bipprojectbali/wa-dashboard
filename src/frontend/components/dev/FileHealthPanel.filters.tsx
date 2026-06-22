import { Button, Card, Group, SegmentedControl, Select, Stack } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { TbClipboardCheck, TbCopy } from 'react-icons/tb'
import type { FileHealth } from './FileHealthPanel.types'

interface FiltersCardProps {
  statusFilter: 'all' | FileHealth['status']
  setStatusFilter: (v: 'all' | FileHealth['status']) => void
  categoryFilter: string
  setCategoryFilter: (v: string) => void
  categories: string[]
  totalFiles: number
  filteredCount: number
  selectedCount: number
  selectedPaths: string[]
  filteredPaths: string[]
  counts: Record<string, number>
  exemptCount: number
  clearSelection: () => void
}

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

export function FiltersCard({
  statusFilter,
  setStatusFilter,
  categoryFilter,
  setCategoryFilter,
  categories,
  totalFiles,
  filteredCount,
  selectedCount,
  selectedPaths,
  filteredPaths,
  counts,
  exemptCount,
  clearSelection,
}: FiltersCardProps) {
  return (
    <Card withBorder radius="md" p="md">
      <Stack gap="sm">
        <Group justify="space-between" wrap="wrap" gap="sm">
          <SegmentedControl
            size="xs"
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as typeof statusFilter)}
            data={[
              { label: `All (${totalFiles})`, value: 'all' },
              { label: `OK (${counts.ok})`, value: 'ok' },
              { label: `Warn (${counts.warn})`, value: 'warn' },
              { label: `Critical (${counts.critical})`, value: 'critical' },
              { label: `Exempt (${exemptCount})`, value: 'exempt' },
            ]}
          />
          <Select
            size="xs"
            w={220}
            value={categoryFilter}
            onChange={(v) => setCategoryFilter(v ?? 'all')}
            data={categories.map((c) => ({ value: c, label: c === 'all' ? 'All categories' : c }))}
            clearable={false}
          />
        </Group>
        <Group gap="xs">
          <Button
            size="xs"
            variant="light"
            leftSection={<TbCopy size={14} />}
            disabled={selectedCount === 0}
            onClick={() => copyPaths(selectedPaths)}
          >
            Copy Selected ({selectedCount})
          </Button>
          <Button
            size="xs"
            variant="light"
            color="gray"
            leftSection={<TbCopy size={14} />}
            disabled={filteredCount === 0}
            onClick={() => copyPaths(filteredPaths)}
          >
            Copy All ({filteredCount})
          </Button>
          {selectedCount > 0 && (
            <Button size="xs" variant="subtle" color="gray" onClick={clearSelection}>
              Clear selection
            </Button>
          )}
        </Group>
      </Stack>
    </Card>
  )
}
