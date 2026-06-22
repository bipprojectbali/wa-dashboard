export function getAllowedStatusTransitions(current: string, role: 'QC' | 'ADMIN' | 'SUPER_ADMIN'): string[] {
  const isQc = role === 'QC' || role === 'SUPER_ADMIN'
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN'
  const matrix: Record<string, { qc: string[]; admin: string[] }> = {
    OPEN: { qc: ['CLOSED'], admin: ['IN_PROGRESS'] },
    IN_PROGRESS: { qc: ['CLOSED'], admin: ['READY_FOR_QC'] },
    READY_FOR_QC: { qc: ['CLOSED', 'REOPENED'], admin: [] },
    REOPENED: { qc: ['CLOSED'], admin: ['IN_PROGRESS'] },
    CLOSED: { qc: ['REOPENED'], admin: [] },
  }
  const entry = matrix[current]
  if (!entry) return []
  const out = new Set<string>()
  if (isQc) for (const s of entry.qc) out.add(s)
  if (isAdmin) for (const s of entry.admin) out.add(s)
  return [...out]
}
