import { useCallback, useMemo, useState } from 'react'

// Pilihan baris untuk bulk-delete di panel WAV. Hook tipis di atas Set<id>,
// dipakai bersama tiga panel (consumers/requests/inbound) agar logika checkbox tak diduplikasi.
export interface RowSelection {
  selected: Set<string>
  count: number
  isSelected: (id: string) => boolean
  toggleRow: (id: string) => void
  togglePage: (pageIds: string[]) => void
  clear: () => void
  allOnPageSelected: (pageIds: string[]) => boolean
  someOnPageSelected: (pageIds: string[]) => boolean
}

export function useRowSelection(): RowSelection {
  const [selected, setSelected] = useState<Set<string>>(() => new Set())

  const toggleRow = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Pilih/lepas semua id di halaman saat ini. Jika semua sudah terpilih → lepas semuanya;
  // selain itu → tambahkan semua.
  const togglePage = useCallback((pageIds: string[]) => {
    setSelected((prev) => {
      const next = new Set(prev)
      const allSelected = pageIds.length > 0 && pageIds.every((id) => next.has(id))
      if (allSelected) for (const id of pageIds) next.delete(id)
      else for (const id of pageIds) next.add(id)
      return next
    })
  }, [])

  const clear = useCallback(() => setSelected(new Set()), [])

  return useMemo<RowSelection>(
    () => ({
      selected,
      count: selected.size,
      isSelected: (id) => selected.has(id),
      toggleRow,
      togglePage,
      clear,
      allOnPageSelected: (pageIds) => pageIds.length > 0 && pageIds.every((id) => selected.has(id)),
      someOnPageSelected: (pageIds) => pageIds.some((id) => selected.has(id)),
    }),
    [selected, toggleRow, togglePage, clear],
  )
}
