import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

// ─── API prefix detection ─────────────────────────────────────────────────────

export function detectApiPrefixes(targetRoot: string): string[] {
  const files: string[] = []

  function collectTs(dir: string) {
    if (!existsSync(dir)) return
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) collectTs(full)
      else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) files.push(full)
    }
  }

  for (const f of ['src/app.ts', 'src/app.tsx', 'src/index.ts', 'src/index.tsx']) {
    const p = join(targetRoot, f)
    if (existsSync(p)) files.push(p)
  }
  collectTs(join(targetRoot, 'src/routes'))

  const prefixes = new Set<string>()
  const RE = /\.(get|post|put|delete|patch|all|ws|mount)\s*\(\s*['"`]([^'"`]+)['"`]/g

  for (const file of files) {
    RE.lastIndex = 0
    const content = readFileSync(file, 'utf-8')
    let m
    while ((m = RE.exec(content)) !== null) {
      const p = m[2]
      if (!p.startsWith('/')) continue
      const parts = p.split('/').filter(Boolean)
      if (!parts.length || parts[0].startsWith(':')) continue
      prefixes.add(parts.length > 1 ? `/${parts[0]}/` : `/${parts[0]}`)
    }
  }

  prefixes.add('/health')
  return Array.from(prefixes).sort()
}

// ─── Colors ───────────────────────────────────────────────────────────────────

export const dim = (s: string) => `\x1b[2m${s}\x1b[0m`
export const bold = (s: string) => `\x1b[1m${s}\x1b[0m`
export const green = (s: string) => `\x1b[32m${s}\x1b[0m`
export const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`
export const red = (s: string) => `\x1b[31m${s}\x1b[0m`
export const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`

// ─── Output helpers ───────────────────────────────────────────────────────────

export function step(n: number, label: string) {
  console.log(bold(`Step ${n}: ${label}`))
}

export function copied(label: string) {
  console.log(`  ${green('✓')} ${label}`)
}

export function skipped(label: string, reason = 'already exists') {
  console.log(`  ${dim('⏭')}  ${label} — ${dim(reason)}`)
}

export function patched(label: string) {
  console.log(`  ${green('✓')} ${label}`)
}

export function fileStatus(exists: boolean, willOverwrite: boolean) {
  if (!exists) return dim('missing — will create')
  if (willOverwrite) return yellow('exists — will OVERWRITE (--force)')
  return yellow('exists — will SKIP (use --force to replace)')
}

// ─── File operations ──────────────────────────────────────────────────────────

export function copyFile(src: string, dest: string, label: string, force: boolean): boolean {
  if (existsSync(dest) && !force) {
    skipped(label)
    return false
  }
  mkdirSync(dirname(dest), { recursive: true })
  copyFileSync(src, dest)
  copied(label)
  return true
}

export function writeFile(dest: string, content: string, label: string, force: boolean): boolean {
  if (existsSync(dest) && !force) {
    skipped(label)
    return false
  }
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, content, 'utf-8')
  copied(label)
  return true
}

// ─── Report / Summary printers ────────────────────────────────────────────────

interface DetectResult {
  hasSrcLib: boolean
  hasScripts: boolean
  hasPrisma: boolean
  hasEnvLib: boolean
  hasAppEntry: boolean
  hasDockerfile: boolean
  hasServerProd: boolean
  hasMigrateLib: boolean
  hasMigrateScr: boolean
  [key: string]: boolean
}

export function printReport(
  TARGET: string,
  detect: DetectResult,
  warnings: string[],
  force: boolean,
  hasBuildCli: boolean,
  hasMcpScripts: boolean,
  lockFile: string | null,
) {
  console.log()
  console.log(`${bold('copy-migrate')} → ${cyan(TARGET)}`)
  console.log()
  console.log('  Detected:')
  console.log(`    src/lib/            ${detect.hasSrcLib ? green('✓') : dim('missing — will create')}`)
  console.log(`    scripts/            ${detect.hasScripts ? green('✓') : dim('missing — will create')}`)
  console.log(`    prisma/             ${detect.hasPrisma ? green('✓') : red('✗ not found')}`)
  console.log(
    `    src/lib/env.ts      ${detect.hasEnvLib ? green('✓') : red('✗ not found — server.prod.ts will fail to compile')}`,
  )
  console.log(
    `    src/app.ts          ${detect.hasAppEntry ? green('✓') : red('✗ not found — update createApp() import manually')}`,
  )
  console.log(`    bun.lock            ${lockFile ? green(`✓ (${lockFile})`) : red('✗ not found — run bun install first')}`)
  console.log(`    src/lib/migrate.ts  ${fileStatus(detect.hasMigrateLib, force)}`)
  console.log(`    scripts/migrate.ts  ${fileStatus(detect.hasMigrateScr, force)}`)
  console.log(`    Dockerfile          ${fileStatus(detect.hasDockerfile, force)}`)
  console.log(`    server.prod.ts      ${fileStatus(detect.hasServerProd, force)}`)
  console.log(`    build:cli           ${hasBuildCli ? green('✓ found') : dim('not found — omitted from Dockerfile')}`)
  console.log(`    scripts/mcp/        ${hasMcpScripts ? green('✓ found') : dim('not found — omitted from Dockerfile')}`)

  if (warnings.length) {
    console.log()
    console.log(yellow('  Warnings:'))
    for (const w of warnings) console.log(`    ${yellow('⚠')}  ${w}`)
  }
  console.log()
}

export function printSummary(warnings: string[]) {
  const line = '─'.repeat(52)
  console.log(line)
  if (warnings.length) {
    console.log(yellow(`⚠  ${warnings.length} warning(s) above need attention before building.`))
    console.log()
  }
  console.log(bold('✅ Done! Review & next steps:'))
  console.log()
  console.log(`${cyan('1. ENV vars')} to add in your compose.yml / .env:`)
  console.log('   MIGRATE_ON_STARTUP=true')
  console.log('   MIGRATE_DATABASE_URL=${DIRECT_URL}  # direct conn (bypass pooler)')
  console.log('   MIGRATE_DB_RETRIES=5               # optional, default 5')
  console.log()
  console.log(`${cyan('2. Review')} src/server.prod.ts:`)
  console.log('   • API_PREFIXES auto-detected — add any missing prefixes manually')
  console.log('   • Add startup tasks if needed (audit log cleanup, cron jobs, etc.)')
  console.log()
  console.log(`${cyan('3. Test locally:')}`)
  console.log('   bun run build:server')
  console.log('   DATABASE_URL=<your-db> ./server')
  console.log()
  console.log(`${cyan('4. Verify Prisma compatibility:')}`)
  console.log('   bunx prisma generate')
  console.log('   bun build src/server.prod.ts --compile --outfile /tmp/server-test')
  console.log(line)
  console.log()
}
