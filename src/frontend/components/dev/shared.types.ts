import type { Role } from '@/frontend/hooks/useAuth'

// ─── Domain Types ──────────────────────────────────────────────────────────

export interface AdminUser {
  id: string
  name: string
  email: string
  role: Role
  blocked: boolean
  createdAt: string
  image?: string | null
}

export interface AppLogEntry {
  id: number
  level: 'info' | 'warn' | 'error'
  message: string
  detail?: string
  timestamp: string
}

export interface AuditLogEntry {
  id: string
  userId: string | null
  action: string
  detail: string | null
  ip: string | null
  createdAt: string
  user: { name: string; email: string } | null
}

export interface SchemaField {
  name: string
  type: string
  isId: boolean
  isUnique: boolean
  isOptional: boolean
  isList: boolean
  isRelation: boolean
  default?: string
}

export interface SchemaModel {
  name: string
  tableName: string
  fields: SchemaField[]
}

export interface SchemaEnum {
  name: string
  values: string[]
}

export interface SchemaRelation {
  from: string
  fromField: string
  to: string
  toField: string
  onDelete?: string
}

export interface ParsedSchema {
  models: SchemaModel[]
  enums: SchemaEnum[]
  relations: SchemaRelation[]
}

export interface RouteInfo {
  method: string
  path: string
  auth: string
  category: string
  description: string
}

export interface RoutesData {
  routes: RouteInfo[]
  summary: {
    total: number
    byMethod: Record<string, number>
    byAuth: Record<string, number>
    byCategory: Record<string, number>
  }
}

export interface FileInfo {
  path: string
  category: string
  lines: number
  exports: string[]
  imports: { from: string; names: string[] }[]
}

export interface ProjectData {
  files: FileInfo[]
  directories: { path: string; category: string; fileCount: number }[]
  summary: {
    totalFiles: number
    totalLines: number
    totalExports: number
    totalImports: number
    byCategory: Record<string, number>
  }
}

export interface EnvVar {
  name: string
  required: boolean
  isSet: boolean
  default: string | null
  category: string
  description: string
  usedBy: string[]
}

export interface EnvMapData {
  variables: EnvVar[]
  summary: { total: number; set: number; unset: number; required: number; byCategory: Record<string, number> }
}

export interface TestCoverageData {
  sourceFiles: { path: string; lines: number; exports: string[]; testedBy: string[]; coverage: string }[]
  testFiles: { path: string; lines: number; type: string; targets: string[] }[]
  summary: {
    totalSource: number
    totalTests: number
    covered: number
    partial: number
    uncovered: number
    coveragePercent: number
  }
}

export interface DepData {
  packages: { name: string; version: string; type: string; category: string; usedBy: string[] }[]
  summary: { total: number; runtime: number; dev: number; byCategory: Record<string, number> }
}

export interface MigrationData {
  migrations: { name: string; folder: string; createdAt: string; changes: string[]; sql: string }[]
  summary: {
    totalMigrations: number
    firstMigration: string | null
    lastMigration: string | null
    totalChanges: number
  }
}

export interface SessionData {
  sessions: {
    id: string
    userId: string
    userName: string
    userEmail: string
    userRole: string
    userBlocked: boolean
    isOnline: boolean
    createdAt: string
    expiresAt: string
    isExpired: boolean
  }[]
  summary: {
    totalSessions: number
    activeSessions: number
    expiredSessions: number
    onlineUsers: number
    byRole: Record<string, number>
  }
}

export interface RequestEvent {
  type: 'request'
  method: string
  path: string
  status: number
  duration: number
  timestamp: string
}
