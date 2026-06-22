export interface EnvDef {
  name: string
  envKey: string
  required: boolean
  default: string | null
  category: string
  description: string
}

export const ENV_DEFS: EnvDef[] = [
  {
    name: 'DATABASE_URL',
    envKey: 'DATABASE_URL',
    required: true,
    default: null,
    category: 'database',
    description: 'PostgreSQL connection string',
  },
  {
    name: 'REDIS_URL',
    envKey: 'REDIS_URL',
    required: true,
    default: null,
    category: 'cache',
    description: 'Redis connection string',
  },
  {
    name: 'GOOGLE_CLIENT_ID',
    envKey: 'GOOGLE_CLIENT_ID',
    required: true,
    default: null,
    category: 'auth',
    description: 'Google OAuth client ID',
  },
  {
    name: 'GOOGLE_CLIENT_SECRET',
    envKey: 'GOOGLE_CLIENT_SECRET',
    required: true,
    default: null,
    category: 'auth',
    description: 'Google OAuth client secret',
  },
  {
    name: 'BETTER_AUTH_SECRET',
    envKey: 'BETTER_AUTH_SECRET',
    required: true,
    default: null,
    category: 'auth',
    description: 'Better Auth encryption secret (min 32 chars)',
  },
  {
    name: 'BETTER_AUTH_URL',
    envKey: 'BETTER_AUTH_URL',
    required: false,
    default: 'http://localhost:3000',
    category: 'auth',
    description: 'Better Auth base URL (production URL)',
  },
  {
    name: 'SUPER_ADMIN_EMAIL',
    envKey: 'SUPER_ADMIN_EMAIL',
    required: false,
    default: '(empty)',
    category: 'auth',
    description: 'Comma-separated emails to auto-promote to SUPER_ADMIN',
  },
  {
    name: 'PORT',
    envKey: 'PORT',
    required: false,
    default: '3000',
    category: 'app',
    description: 'Server port',
  },
  {
    name: 'HMR_PORT',
    envKey: 'HMR_PORT',
    required: false,
    default: '24678',
    category: 'app',
    description: 'Vite HMR WebSocket port (dev only)',
  },
  {
    name: 'NODE_ENV',
    envKey: 'NODE_ENV',
    required: false,
    default: 'development',
    category: 'app',
    description: 'Environment mode',
  },
  {
    name: 'REACT_EDITOR',
    envKey: 'REACT_EDITOR',
    required: false,
    default: 'code',
    category: 'app',
    description: 'Editor for click-to-source',
  },
  {
    name: 'AUDIT_LOG_RETENTION_DAYS',
    envKey: 'AUDIT_LOG_RETENTION_DAYS',
    required: false,
    default: '90',
    category: 'app',
    description: 'Days to keep audit logs',
  },
]

export const ENV_SOURCE_FILES = [
  'src/lib/env.ts',
  'src/lib/db.ts',
  'src/lib/redis.ts',
  'src/lib/applog.ts',
  'src/lib/auth.ts',
  'src/app.ts',
  'src/index.tsx',
  'src/vite.ts',
]
