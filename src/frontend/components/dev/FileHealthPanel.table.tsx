import { ActionIcon, Badge, Card, Checkbox, Group, Pagination, Progress, Table, Text, Tooltip } from '@mantine/core'
import { useEffect, useState } from 'react'
import { TbCopy } from 'react-icons/tb'
import { type FileHealth, fmtNumber, ratioColor, STATUS_META } from './FileHealthPanel.types'
import { PAGE_SIZE } from './shared'

interface Props {
  filtered: FileHealth[]
  isLoading: boolean
  selected: Set<string>
  onToggleRow: (path: string) => void
  onToggleAll: () => void
  allFilteredSelected: boolean
  someFilteredSelected: boolean
  onCopyPath: (path: string) => void
}

export function FileHealthTable({
  filtered,
  isLoading,
  selected,
  onToggleRow,
  onToggleAll,
  allFilteredSelected,
  someFilteredSelected,
  onCopyPath,
}: Props) {
  const [page, setPage] = useState(1)
  useEffect(() => {
    setPage(1)
  }, [filtered])
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <Card withBorder radius="md" p={0}>
      <Table.ScrollContainer minWidth={720}>
        <Table highlightOnHover striped="even">
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={36}>
                <Checkbox
                  size="xs"
                  checked={allFilteredSelected}
                  indeterminate={someFilteredSelected && !allFilteredSelected}
                  onChange={onToggleAll}
                  disabled={filtered.length === 0}
                />
              </Table.Th>
              <Table.Th>Path</Table.Th>
              <Table.Th>Category</Table.Th>
              <Table.Th ta="right">Lines</Table.Th>
              <Table.Th ta="right">Chars</Table.Th>
              <Table.Th style={{ minWidth: 180 }}>Usage</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th w={40} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {isLoading && (
              <Table.Tr>
                <Table.Td colSpan={8}>
                  <Text ta="center" c="dimmed" py="md">
                    Scanning project files...
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={8}>
                  <Text ta="center" c="dimmed" py="md">
                    No files match the current filter.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
            {paged.map((f) => {
              const meta = STATUS_META[f.status]
              const worst = Math.max(f.ratioLines, f.ratioChars)
              const pct = Math.min(worst * 100, 200)
              const isSelected = selected.has(f.path)
              return (
                <Table.Tr key={f.path} bg={isSelected ? 'var(--mantine-color-blue-light)' : undefined}>
                  <Table.Td>
                    <Checkbox size="xs" checked={isSelected} onChange={() => onToggleRow(f.path)} />
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" ff="monospace">
                      {f.path}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" size="xs" color="gray">
                      {f.category}
                    </Badge>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm">
                      {fmtNumber(f.lines)}
                      <Text span size="xs" c="dimmed">
                        {' '}
                        / {f.limitLines}
                      </Text>
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm">
                      {fmtNumber(f.chars)}
                      <Text span size="xs" c="dimmed">
                        {' '}
                        / {fmtNumber(f.limitChars)}
                      </Text>
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Tooltip label={`${Math.round(worst * 100)}% of limit (worst of lines/chars)`}>
                      <Progress
                        value={Math.min(pct, 100)}
                        color={ratioColor(worst, f.exempt)}
                        size="md"
                        radius="xl"
                        striped={f.status === 'critical'}
                        animated={f.status === 'critical'}
                      />
                    </Tooltip>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={meta.color} variant={f.status === 'critical' ? 'filled' : 'light'} size="sm">
                      <Group gap={4} wrap="nowrap">
                        <meta.icon size={10} />
                        {meta.label}
                      </Group>
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Tooltip label="Copy path" withArrow>
                      <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => onCopyPath(f.path)}>
                        <TbCopy size={13} />
                      </ActionIcon>
                    </Tooltip>
                  </Table.Td>
                </Table.Tr>
              )
            })}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      {totalPages > 1 && (
        <Group
          justify="space-between"
          align="center"
          px="md"
          py="xs"
          style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
        >
          <Text size="xs" c="dimmed">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </Text>
          <Pagination value={page} onChange={setPage} total={totalPages} size="sm" />
        </Group>
      )}
    </Card>
  )
}
