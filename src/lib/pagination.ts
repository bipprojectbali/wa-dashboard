export function parsePagination(query: Record<string, unknown>, defaultLimit = 50, maxLimit = 200) {
  const raw = Number(query.limit)
  const limit = raw > 0 ? Math.min(raw, maxLimit) : defaultLimit
  return {
    limit,
    offset: Math.max(0, Number(query.offset) || 0),
  }
}
