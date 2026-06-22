#!/usr/bin/env bun
/**
 * copy-migrate — Copies the custom Prisma migrator to any Bun/Elysia project.
 *
 * Copies:
 *   • src/lib/migrate.ts      — core migrator (zero npm dep, zero modification needed)
 *   • scripts/migrate.ts      — standalone CLI wrapper
 *   • src/server.prod.ts      — production binary entry (skipped if exists)
 *   • Dockerfile              — multi-stage lean image (skipped if exists)
 *   • package.json            — patches build:migrate + build:server scripts
 *
 * Usage:
 *   bun scripts/copy-migrate.ts <target-path>
 *   bun scripts/copy-migrate.ts <target-path> --force    # overwrite existing files
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  bold,
  copyFile,
  cyan,
  detectApiPrefixes,
  dim,
  fileStatus,
  green,
  patched,
  printReport,
  printSummary,
  red,
  skipped,
  step,
  writeFile,
  yellow,
} from './copy-migrate-helpers'
import { makeDockerfileTemplate, makeServerProdTemplate } from './copy-migrate-templates'

// ─── Args ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const force = args.includes('--force')
const targetArg = args.find((a) => !a.startsWith('-'))

if (!targetArg) {
  console.error('Usage: bun scripts/copy-migrate.ts <target-project-path> [--force]')
  process.exit(1)
}

const SOURCE_ROOT = resolve(import.meta.dir, '..')
const TARGET = resolve(targetArg)

// ─── Validate source files ────────────────────────────────────────────────────

const SOURCE_MIGRATE_LIB = join(SOURCE_ROOT, 'src/lib/migrate.ts')
const SOURCE_MIGRATE_SCR = join(SOURCE_ROOT, 'scripts/migrate.ts')

if (!existsSync(SOURCE_MIGRATE_LIB)) {
  console.error(`✗ Source file not found: ${SOURCE_MIGRATE_LIB}`)
  console.error('  Run this script from the envman project root.')
  process.exit(1)
}
if (!existsSync(SOURCE_MIGRATE_SCR)) {
  console.error(`✗ Source file not found: ${SOURCE_MIGRATE_SCR}`)
  process.exit(1)
}

// ─── Validate target ──────────────────────────────────────────────────────────

if (!existsSync(join(TARGET, 'package.json'))) {
  console.error(`✗ Not a valid project — no package.json at: ${TARGET}`)
  process.exit(1)
}
if (resolve(TARGET) === resolve(SOURCE_ROOT)) {
  console.error('✗ Target cannot be the same as the source (envman) project.')
  process.exit(1)
}

// ─── Detect Target ────────────────────────────────────────────────────────────

const detect = {
  hasSrcLib: existsSync(join(TARGET, 'src/lib')),
  hasScripts: existsSync(join(TARGET, 'scripts')),
  hasDockerfile: existsSync(join(TARGET, 'Dockerfile')),
  hasPrisma: existsSync(join(TARGET, 'prisma/schema.prisma')),
  hasServerProd: existsSync(join(TARGET, 'src/server.prod.ts')),
  hasMigrateLib: existsSync(join(TARGET, 'src/lib/migrate.ts')),
  hasMigrateScr: existsSync(join(TARGET, 'scripts/migrate.ts')),
  hasEnvLib: existsSync(join(TARGET, 'src/lib/env.ts')) || existsSync(join(TARGET, 'src/lib/env.js')),
  hasAppEntry: existsSync(join(TARGET, 'src/app.ts')) || existsSync(join(TARGET, 'src/app.tsx')),
  hasPublicDir: existsSync(join(TARGET, 'public')),
}

const lockFile = existsSync(join(TARGET, 'bun.lock'))
  ? 'bun.lock'
  : existsSync(join(TARGET, 'bun.lockb'))
    ? 'bun.lockb'
    : null

let rawPkg: string
try {
  rawPkg = readFileSync(join(TARGET, 'package.json'), 'utf-8')
} catch (e) {
  console.error(`✗ Cannot read package.json: ${e}`)
  process.exit(1)
}

let pkg: any
try {
  pkg = JSON.parse(rawPkg)
} catch (e) {
  console.error(`✗ Invalid JSON in package.json: ${e}`)
  process.exit(1)
}

if (!pkg.scripts || typeof pkg.scripts !== 'object') pkg.scripts = {}

const hasBuildCli = !!pkg.scripts['build:cli']
const hasMcpScripts = existsSync(join(TARGET, 'scripts/mcp'))

// ─── Warnings ─────────────────────────────────────────────────────────────────

const warnings: string[] = []

if (!detect.hasPrisma) warnings.push('prisma/schema.prisma not found — add migrations manually after setup')
if (!detect.hasEnvLib)
  warnings.push("src/lib/env.ts not found — server.prod.ts imports './lib/env'; create it or update the import")
if (!detect.hasAppEntry)
  warnings.push("src/app.ts not found — server.prod.ts imports './app'; update the import to match your entry file")
if (!lockFile)
  warnings.push(
    "No bun.lock / bun.lockb found — Dockerfile will use 'bun.lock' but it doesn't exist yet; run 'bun install' first",
  )

// ─── Report ───────────────────────────────────────────────────────────────────

printReport(TARGET, detect, warnings, force, hasBuildCli, hasMcpScripts, lockFile)

// ─── Step 1: src/lib/migrate.ts ───────────────────────────────────────────────

step(1, 'Core migrator module')
copyFile(SOURCE_MIGRATE_LIB, join(TARGET, 'src/lib/migrate.ts'), 'src/lib/migrate.ts', force)
console.log()

// ─── Step 2: scripts/migrate.ts ───────────────────────────────────────────────

step(2, 'CLI wrapper')
copyFile(SOURCE_MIGRATE_SCR, join(TARGET, 'scripts/migrate.ts'), 'scripts/migrate.ts', force)
console.log()

// ─── Step 3: Patch package.json ───────────────────────────────────────────────

step(3, 'package.json scripts')
let pkgDirty = false

if (!pkg.scripts['build:migrate']) {
  pkg.scripts['build:migrate'] =
    'bun build scripts/migrate.ts --compile --target=bun-linux-x64 --outfile migrate'
  patched('Added build:migrate')
  pkgDirty = true
} else {
  skipped('build:migrate')
}

if (!pkg.scripts['build:server']) {
  pkg.scripts['build:server'] =
    'bun build src/server.prod.ts --compile --target=bun-linux-x64 --outfile server'
  patched('Added build:server')
  pkgDirty = true
} else {
  skipped('build:server')
}

if (pkgDirty) {
  writeFileSync(join(TARGET, 'package.json'), JSON.stringify(pkg, null, 2) + '\n', 'utf-8')
  patched('Saved package.json')
}
console.log()

// ─── Step 4: src/server.prod.ts ───────────────────────────────────────────────

step(4, 'Production server entry')

const detectedPrefixes = detectApiPrefixes(TARGET)
const prefixesLiteral = detectedPrefixes.map((p) => `'${p}'`).join(', ')

if (detectedPrefixes.length <= 1) {
  console.log(
    `  ${yellow('⚠')}  API_PREFIXES only has ${yellow('/health')} — no routes detected in src/app.ts or src/routes/`,
  )
  console.log(`     Update API_PREFIXES manually in src/server.prod.ts after creation.`)
} else {
  console.log(`  ${green('✓')} Detected API prefixes: ${cyan(prefixesLiteral)}`)
}

writeFile(join(TARGET, 'src/server.prod.ts'), makeServerProdTemplate(prefixesLiteral), 'src/server.prod.ts', force)
console.log()

// ─── Step 5: Dockerfile ───────────────────────────────────────────────────────

step(5, 'Dockerfile')

if (detect.hasDockerfile && !force) {
  skipped('Dockerfile', 'already exists — run with --force to replace')
  console.log()
} else {
  const resolvedLockFile = lockFile ?? 'bun.lock'
  const cliBuildLine = hasBuildCli ? '\n# CLI binaries\nRUN bun run build:cli\n' : ''
  const cliCopyLine = hasBuildCli ? '\nCOPY --from=builder /app/dist/cli  ./dist/cli\n' : ''
  const publicCopyLine = detect.hasPublicDir ? '\nCOPY --from=builder /app/public   ./public' : ''
  const mcpCopyLine = hasMcpScripts ? 'COPY --from=builder /app/scripts  ./scripts\n' : ''

  writeFile(
    join(TARGET, 'Dockerfile'),
    makeDockerfileTemplate({ resolvedLockFile, cliBuildLine, cliCopyLine, publicCopyLine, mcpCopyLine }),
    'Dockerfile',
    force,
  )
  console.log()
}

// ─── Summary ──────────────────────────────────────────────────────────────────

printSummary(warnings)
