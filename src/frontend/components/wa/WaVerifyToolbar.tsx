import { ActionIcon, Button, Group, TextInput, Tooltip } from '@mantine/core'
import type { ReactNode } from 'react'
import { TbRefresh, TbSearch, TbTrash } from 'react-icons/tb'

interface Props {
  search: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  filters?: ReactNode
  selectedCount: number
  total: number
  canEdit: boolean
  onDeleteSelected: () => void
  onDeleteAll: () => void
  onRefresh: () => void
  refreshing?: boolean
  deleting?: boolean
}

// Toolbar bersama tiga panel WAV: search + slot filter + aksi bulk-delete + refresh.
// Tombol hapus hanya muncul bila canEdit (SUPER_ADMIN).
export function WaVerifyToolbar({
  search,
  onSearchChange,
  searchPlaceholder = 'Cari…',
  filters,
  selectedCount,
  total,
  canEdit,
  onDeleteSelected,
  onDeleteAll,
  onRefresh,
  refreshing,
  deleting,
}: Props) {
  return (
    <Group justify="space-between" align="flex-end" wrap="wrap" gap="xs">
      <Group align="flex-end" gap="xs" wrap="wrap">
        <TextInput
          size="xs"
          leftSection={<TbSearch size={14} />}
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => onSearchChange(e.currentTarget.value)}
          style={{ minWidth: 200 }}
        />
        {filters}
      </Group>
      <Group gap="xs" wrap="wrap">
        {canEdit && selectedCount > 0 && (
          <Button
            size="xs"
            color="red"
            variant="light"
            leftSection={<TbTrash size={14} />}
            onClick={onDeleteSelected}
            loading={deleting}
          >
            Hapus terpilih ({selectedCount})
          </Button>
        )}
        {canEdit && (
          <Button
            size="xs"
            color="red"
            variant="outline"
            leftSection={<TbTrash size={14} />}
            onClick={onDeleteAll}
            disabled={total === 0}
            loading={deleting}
          >
            Hapus semua
          </Button>
        )}
        <Tooltip label="Muat ulang">
          <ActionIcon variant="subtle" color="gray" onClick={onRefresh} loading={refreshing}>
            <TbRefresh size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Group>
  )
}
