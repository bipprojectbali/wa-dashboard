function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback
}

function required(key: string): string {
  const value = process.env[key]
  if (!value) throw new Error(`Missing required environment variable: ${key}`)
  return value
}

export const env = {
  PORT: parseInt(optional('PORT', '3000'), 10),
  HMR_PORT: parseInt(optional('HMR_PORT', '24678'), 10),
  NODE_ENV: optional('NODE_ENV', 'development'),
  REACT_EDITOR: optional('REACT_EDITOR', 'code'),
  DATABASE_URL: required('DATABASE_URL'),
  REDIS_URL: required('REDIS_URL'),
  GOOGLE_CLIENT_ID: required('GOOGLE_CLIENT_ID'),
  GOOGLE_CLIENT_SECRET: required('GOOGLE_CLIENT_SECRET'),
  BETTER_AUTH_SECRET: required('BETTER_AUTH_SECRET'),
  BETTER_AUTH_URL: optional('BETTER_AUTH_URL', ''),
  SUPER_ADMIN_EMAILS: optional('SUPER_ADMIN_EMAIL', '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean),
  AUDIT_LOG_RETENTION_DAYS: parseInt(optional('AUDIT_LOG_RETENTION_DAYS', '90'), 10),
  MCP_SECRET: optional('MCP_SECRET', ''),
  MCP_SECRET_ADMIN: optional('MCP_SECRET_ADMIN', ''),
  WA_API_BASE_URL: optional('WA_API_BASE_URL', '').replace(/\/$/, ''),
  WA_API_KEY: optional('WA_API_KEY', ''),
} as const
