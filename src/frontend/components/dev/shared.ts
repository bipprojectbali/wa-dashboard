export * from './shared.types'

// ─── Constants ─────────────────────────────────────────────────────────────

export const PAGE_SIZE = 25

export const roleBadge: Record<string, { color: string; label: string }> = {
  USER: { color: 'blue', label: 'User' },
  QC: { color: 'cyan', label: 'QC' },
  ADMIN: { color: 'violet', label: 'Admin' },
  SUPER_ADMIN: { color: 'red', label: 'Super Admin' },
}

export const levelBadge: Record<string, { color: string }> = {
  info: { color: 'blue' },
  warn: { color: 'yellow' },
  error: { color: 'red' },
}

export const actionBadge: Record<string, { color: string; label: string }> = {
  LOGIN: { color: 'green', label: 'Login' },
  LOGOUT: { color: 'gray', label: 'Logout' },
  LOGIN_FAILED: { color: 'orange', label: 'Login Failed' },
  LOGIN_BLOCKED: { color: 'red', label: 'Login Blocked' },
  ROLE_CHANGED: { color: 'violet', label: 'Role Changed' },
  BLOCKED: { color: 'red', label: 'Blocked' },
  UNBLOCKED: { color: 'teal', label: 'Unblocked' },
  TICKET_CREATED: { color: 'blue', label: 'Ticket Created' },
  TICKET_UPDATED: { color: 'indigo', label: 'Ticket Updated' },
}

export const METHOD_COLORS: Record<string, string> = {
  GET: 'blue',
  POST: 'green',
  PUT: 'orange',
  PATCH: 'yellow',
  DELETE: 'red',
  WS: 'violet',
  ALL: 'gray',
  PAGE: 'teal',
}

export const AUTH_COLORS: Record<string, string> = {
  public: 'gray',
  authenticated: 'blue',
  superAdmin: 'red',
  admin: 'violet',
  qcOrAdmin: 'cyan',
  secret: 'orange',
}

export const CATEGORY_COLORS: Record<string, string> = {
  frontend: 'blue',
  auth: 'green',
  admin: 'violet',
  tickets: 'orange',
  utility: 'gray',
  mcp: 'yellow',
  realtime: 'teal',
}

export const COVERAGE_COLORS: Record<string, string> = {
  covered: 'green',
  partial: 'yellow',
  uncovered: 'red',
}

export type LayoutType = 'horizontal' | 'vertical' | 'radial' | 'force'

export const projectSubViews = [
  { group: 'Architecture', value: 'api-routes', label: 'API Routes' },
  { group: 'Architecture', value: 'file-structure', label: 'File Structure' },
  { group: 'Architecture', value: 'user-flow', label: 'User Flow' },
  { group: 'Architecture', value: 'data-flow', label: 'Data Flow' },
  { group: 'DevOps', value: 'env-map', label: 'Env Variables' },
  { group: 'DevOps', value: 'test-coverage', label: 'Test Coverage' },
  { group: 'DevOps', value: 'dependencies', label: 'Dependencies' },
  { group: 'DevOps', value: 'migrations', label: 'Migrations' },
  { group: 'Live', value: 'sessions', label: 'Sessions' },
  { group: 'Live', value: 'live-requests', label: 'Live Requests' },
] as const

export type ProjectSubView = (typeof projectSubViews)[number]['value']
