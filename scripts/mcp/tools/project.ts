import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { z } from 'zod'
import { scanFileHealth } from '../../../src/lib/file-health-scanner'
import { ROUTES_CATALOG } from '../../../src/lib/routes-catalog'
import { parseSchema } from '../../../src/lib/schema-parser'
import { jsonText, type ToolModule } from './shared'

export const projectTools: ToolModule = {
  name: 'project',
  scope: 'readonly',
  register(server) {
    server.registerTool(
      'project_routes',
      {
        title: 'Project routes',
        description: 'All HTTP + WS + frontend routes with auth level and category',
        inputSchema: z.object({}),
      },
      async () => {
        const byMethod: Record<string, number> = {}
        const byAuth: Record<string, number> = {}
        const byCategory: Record<string, number> = {}
        for (const r of ROUTES_CATALOG) {
          byMethod[r.method] = (byMethod[r.method] ?? 0) + 1
          byAuth[r.auth] = (byAuth[r.auth] ?? 0) + 1
          byCategory[r.category] = (byCategory[r.category] ?? 0) + 1
        }
        return jsonText({
          routes: ROUTES_CATALOG,
          summary: { total: ROUTES_CATALOG.length, byMethod, byAuth, byCategory },
        })
      },
    )

    server.registerTool(
      'project_schema',
      {
        title: 'Prisma schema',
        description: 'Parsed Prisma schema (models, enums, relations)',
        inputSchema: z.object({}),
      },
      async () => {
        const path = join(process.cwd(), 'prisma/schema.prisma')
        if (!existsSync(path)) return jsonText({ error: 'schema.prisma not found' })
        const raw = readFileSync(path, 'utf-8')
        return jsonText({ schema: parseSchema(raw) })
      },
    )

    server.registerTool(
      'project_dependencies',
      {
        title: 'NPM dependencies',
        description: 'Runtime and dev dependencies from package.json',
        inputSchema: z.object({}),
      },
      async () => {
        const pkgPath = join(process.cwd(), 'package.json')
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
        const runtime = Object.entries(pkg.dependencies ?? {}).map(([name, version]) => ({
          name,
          version,
          type: 'runtime' as const,
        }))
        const dev = Object.entries(pkg.devDependencies ?? {}).map(([name, version]) => ({
          name,
          version,
          type: 'dev' as const,
        }))
        const all = [...runtime, ...dev]
        return jsonText({ name: pkg.name, version: pkg.version, runtime: runtime.length, dev: dev.length, total: all.length, dependencies: all })
      },
    )

    server.registerTool(
      'project_migrations',
      {
        title: 'Prisma migrations',
        description: 'Timeline of Prisma migrations with SQL snippet',
        inputSchema: z.object({}),
      },
      async () => {
        const dir = join(process.cwd(), 'prisma/migrations')
        if (!existsSync(dir)) return jsonText({ migrations: [], total: 0 })
        const entries = readdirSync(dir, { withFileTypes: true })
          .filter((d) => d.isDirectory() && /^\d{14}_/.test(d.name))
          .sort((a, b) => a.name.localeCompare(b.name))
        const migrations = entries.map((d) => {
          const sqlPath = join(dir, d.name, 'migration.sql')
          const sql = existsSync(sqlPath) ? readFileSync(sqlPath, 'utf-8') : ''
          const ts = d.name.slice(0, 14)
          const iso = `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}T${ts.slice(8, 10)}:${ts.slice(10, 12)}:${ts.slice(12, 14)}Z`
          const lines = sql.split('\n').filter((l) => l.trim() && !l.trim().startsWith('--'))
          return {
            name: d.name,
            createdAt: iso,
            sqlPreview: lines.slice(0, 20).join('\n'),
            statementCount: sql.split(';').filter((s) => s.trim()).length,
            bytes: sql.length,
          }
        })
        return jsonText({ total: migrations.length, migrations })
      },
    )

    server.registerTool(
      'project_env_map',
      {
        title: 'Environment variables',
        description: 'Environment variables referenced in src/lib/env.ts with set/unset status',
        inputSchema: z.object({}),
      },
      async () => {
        const envTs = readFileSync(join(process.cwd(), 'src/lib/env.ts'), 'utf-8')
        const required = [...envTs.matchAll(/required\(['"](\w+)['"]\)/g)].map((m) => m[1])
        const optional = [...envTs.matchAll(/optional\(['"](\w+)['"],\s*['"]([^'"]*)['"]\)/g)].map((m) => ({
          name: m[1],
          default: m[2],
        }))
        const known = [
          ...required.map((name) => ({
            name,
            kind: 'required' as const,
            default: undefined as string | undefined,
            isSet: !!process.env[name],
          })),
          ...optional.map((o) => ({
            name: o.name,
            kind: 'optional' as const,
            default: o.default,
            isSet: !!process.env[o.name],
          })),
        ]
        return jsonText({ total: known.length, variables: known })
      },
    )

    server.registerTool(
      'project_file_health',
      {
        title: 'File health scan',
        description:
          'Scan project files (src/, prisma/, tests/, scripts/, docs/) and report line/char counts vs limits in docs/FILE-HEALTH.md. Returns status (ok/warn/critical/exempt) per file plus worst offenders. Use this to detect files that should be split.',
        inputSchema: z.object({}),
      },
      async () => {
        const result = await scanFileHealth()
        return jsonText({
          ...result,
          worstOffenders: result.files.filter((f) => !f.exempt).slice(0, 15),
        })
      },
    )

    server.registerTool(
      'project_structure',
      {
        title: 'Project file structure',
        description: 'Scan src/ prisma/ tests/ directories; return file list with line counts',
        inputSchema: z.object({}),
      },
      async () => {
        const root = process.cwd()
        const scanDirs = ['src', 'prisma', 'tests']
        const skipDirs = new Set(['node_modules', 'dist', 'generated', '.git', '.next'])
        const exts = new Set(['.ts', '.tsx', '.prisma'])
        const files: { path: string; lines: number; bytes: number }[] = []
        function walk(dir: string) {
          if (!existsSync(dir)) return
          for (const entry of readdirSync(dir, { withFileTypes: true })) {
            if (skipDirs.has(entry.name)) continue
            const full = join(dir, entry.name)
            if (entry.isDirectory()) { walk(full); continue }
            const dot = entry.name.lastIndexOf('.')
            if (dot < 0 || !exts.has(entry.name.slice(dot))) continue
            try {
              const content = readFileSync(full, 'utf-8')
              const st = statSync(full)
              files.push({ path: relative(root, full), lines: content.split('\n').length, bytes: st.size })
            } catch {}
          }
        }
        for (const d of scanDirs) walk(join(root, d))
        return jsonText({
          total: files.length,
          totalLines: files.reduce((s, f) => s + f.lines, 0),
          totalBytes: files.reduce((s, f) => s + f.bytes, 0),
          files,
        })
      },
    )
  },
}
