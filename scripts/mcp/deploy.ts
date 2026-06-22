/**
 * MCP Deploy Server — deploy ke STG via GitHub Actions + Portainer
 *
 * Pipeline: preflight → bump version → commit → push origin stg
 *           → gh workflow run publish.yml (build image) → poll
 *           → gh workflow run re-pull.yml (deploy ke Portainer) → poll
 *           → verify GET /api/version cocok
 *
 * Env vars: STACK_NAME, BASE_URL, ENV, GH_TOKEN, GH_REPO
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { execSync } from 'node:child_process'
import { z } from 'zod'
import { PACKAGE_JSON, createGhHelpers, runPreflight } from './deploy-helpers'
import { runDeployPipeline } from './deploy-pipeline'

// ─── Config ──────────────────────────────────────────────────────────────────

const STACK_NAME = process.env.STACK_NAME ?? 'wa-dashboard'
const BASE_URL = (process.env.BASE_URL ?? '').replace(/\/$/, '')
const ENV = process.env.ENV ?? 'stg'
const GH_TOKEN = process.env.GH_TOKEN ?? ''
const GH_REPO =
  process.env.GH_REPO ??
  (() => {
    try {
      const url = execSync('git remote get-url origin', { encoding: 'utf8' }).trim()
      const m = url.match(/github\.com[/:](.+?\/.+?)(?:\.git)?$/)
      if (m) return m[1]
    } catch {}
    return 'owner/repo'
  })()

const { ghRun, readVersion } = createGhHelpers(GH_TOKEN, GH_REPO, BASE_URL, PACKAGE_JSON)
const deployConfig = { ghToken: GH_TOKEN, ghRepo: GH_REPO, baseUrl: BASE_URL, stackName: STACK_NAME }

// ─── MCP Server ───────────────────────────────────────────────────────────────

const server = new McpServer({ name: 'deploy-stg', version: '0.1.0' })

server.registerTool(
  'preflight',
  {
    title: 'Preflight scan',
    description: 'Scan credential leak, sensitive files, dan migrasi — tanpa melakukan deploy.',
    inputSchema: z.object({ branch: z.string().default(ENV).describe('Branch target, default: stg') }),
  },
  async ({ branch }) => {
    const result = runPreflight(branch)
    const hintMap: Record<string, string> = {
      dirty_tree: 'Working tree kotor — commit atau stash perubahan dulu sebelum deploy',
      credential_leak: `Perbaiki credential leak sebelum deploy: ${result.credScan.issues.map((i) => i.type).join(', ')}`,
      sensitive_file: `File sensitif terdeteksi di diff: ${result.fileScan.files.join(', ')}`,
      migration_missing: result.migrationCheck.warnings.join('; '),
    }
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              deploy_safe: result.ok,
              blocked_by: result.blockedBy,
              hint: result.blockedBy ? hintMap[result.blockedBy] : null,
              tree_clean: result.treeClean,
              credential_scan: { ok: result.credScan.ok, issues: result.credScan.issues },
              sensitive_files: { ok: result.fileScan.ok, files: result.fileScan.files },
              migration_check: { ok: result.migrationCheck.ok, warnings: result.migrationCheck.warnings },
            },
            null,
            2,
          ),
        },
      ],
    }
  },
)

server.registerTool(
  'check_version',
  {
    title: 'Check version',
    description: 'Bandingkan versi lokal (package.json) vs versi live di STG (/api/version).',
    inputSchema: z.object({}),
  },
  async () => {
    const local = readVersion()
    let target: string | null = null
    let targetError: string | null = null
    if (BASE_URL) {
      try {
        const res = await fetch(`${BASE_URL}/api/version`, { signal: AbortSignal.timeout(8000) })
        const json = (await res.json()) as { version?: string }
        target = json.version ?? null
      } catch (e) {
        targetError = String(e)
      }
    } else {
      targetError = 'BASE_URL tidak di-set'
    }
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            { local, target, target_url: BASE_URL || null, target_error: targetError, in_sync: local === target },
            null,
            2,
          ),
        },
      ],
    }
  },
)

server.registerTool(
  'deploy_status',
  {
    title: 'Deploy status',
    description: 'Cek status workflow GitHub Actions terakhir (publish + re-pull).',
    inputSchema: z.object({ limit: z.number().int().min(1).max(10).default(3) }),
  },
  async ({ limit }) => {
    if (!GH_TOKEN) {
      return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'GH_TOKEN tidak di-set' }) }] }
    }
    const [publishRuns, repullRuns] = await Promise.all([
      ghRun(`gh run list --repo ${GH_REPO} --workflow publish.yml --limit ${limit} --json databaseId,displayTitle,status,conclusion,createdAt,url`),
      ghRun(`gh run list --repo ${GH_REPO} --workflow re-pull.yml --limit ${limit} --json databaseId,displayTitle,status,conclusion,createdAt,url`),
    ])
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              publish: publishRuns.ok ? JSON.parse(publishRuns.out || '[]') : { error: publishRuns.err },
              re_pull: repullRuns.ok ? JSON.parse(repullRuns.out || '[]') : { error: repullRuns.err },
            },
            null,
            2,
          ),
        },
      ],
    }
  },
)

server.registerTool(
  'deploy',
  {
    title: 'Deploy ke STG',
    description: [
      'Pipeline deploy end-to-end ke staging:',
      '1. Preflight (credential scan + migration check)',
      '2. Bump version di package.json',
      '3. Git commit + push origin stg',
      '4. Trigger gh workflow publish.yml (build Docker image)',
      '5. Poll sampai build selesai',
      '6. Trigger gh workflow re-pull.yml (deploy ke Portainer)',
      '7. Poll sampai deploy selesai',
      '8. Verify /api/version cocok dengan versi baru',
    ].join('\n'),
    inputSchema: z.object({
      bump: z.enum(['patch', 'minor', 'major']).default('patch').describe('Tipe version bump'),
      message: z.string().optional().describe('Custom commit message (opsional, default: chore: bump vX.X.X)'),
      skip_preflight: z.boolean().default(false).describe('Skip credential scan — gunakan hanya jika yakin aman'),
      branch: z.string().default(ENV).describe('Branch target, default: stg'),
    }),
  },
  async (params) => runDeployPipeline(params, deployConfig),
)

// ─── Start server ─────────────────────────────────────────────────────────────

if (!GH_TOKEN) {
  process.stderr.write('WARNING: GH_TOKEN tidak di-set — tools deploy/deploy_status tidak akan berfungsi\n')
}

const transport = new StdioServerTransport()
await server.connect(transport)
