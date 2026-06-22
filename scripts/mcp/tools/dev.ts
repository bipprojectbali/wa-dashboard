import { z } from 'zod'
import { jsonText, type ToolModule } from './shared'

interface RunResult {
  exitCode: number
  stdout: string
  stderr: string
  durationMs: number
  timedOut: boolean
}

async function run(cmd: string[], timeoutMs: number): Promise<RunResult> {
  const started = Date.now()
  const proc = Bun.spawn(cmd, {
    cwd: process.cwd(),
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, FORCE_COLOR: '0' },
  })
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    try { proc.kill() } catch {}
  }, timeoutMs)
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ])
  const exitCode = await proc.exited
  clearTimeout(timer)
  const truncate = (s: string) => (s.length > 80_000 ? `${s.slice(0, 80_000)}\n…(truncated)` : s)
  return {
    exitCode: exitCode ?? -1,
    stdout: truncate(stdout),
    stderr: truncate(stderr),
    durationMs: Date.now() - started,
    timedOut,
  }
}

export const devTools: ToolModule = {
  name: 'dev',
  scope: 'admin',
  register(server) {
    server.registerTool(
      'dev_typecheck',
      {
        title: 'TypeScript typecheck',
        description: 'Run `bun run typecheck` (tsc --noEmit)',
        inputSchema: z.object({
          timeoutMs: z.number().int().min(1000).max(600_000).default(120_000),
        }),
      },
      async ({ timeoutMs }) => jsonText(await run(['bun', 'run', 'typecheck'], timeoutMs)),
    )

    server.registerTool(
      'dev_lint',
      {
        title: 'Biome lint',
        description: 'Run `bun run lint` or `lint:fix`',
        inputSchema: z.object({
          fix: z.boolean().default(false),
          timeoutMs: z.number().int().min(1000).max(300_000).default(60_000),
        }),
      },
      async ({ fix, timeoutMs }) => jsonText(await run(['bun', 'run', fix ? 'lint:fix' : 'lint'], timeoutMs)),
    )

    server.registerTool(
      'dev_test',
      {
        title: 'Run tests',
        description: 'Run unit, integration, or all tests',
        inputSchema: z.object({
          scope: z.enum(['unit', 'integration', 'all']).default('all'),
          pattern: z.string().optional().describe('Test name pattern (passed as --test-name-pattern)'),
          timeoutMs: z.number().int().min(1000).max(600_000).default(180_000),
        }),
      },
      async ({ scope, pattern, timeoutMs }) => {
        const script = scope === 'all' ? 'test' : `test:${scope}`
        const args = ['bun', 'run', script]
        if (pattern) args.push('--', '--test-name-pattern', pattern)
        return jsonText(await run(args, timeoutMs))
      },
    )

    server.registerTool(
      'dev_db_migrate',
      {
        title: 'Prisma migrate dev',
        description: 'Create and apply a new Prisma migration',
        inputSchema: z.object({
          name: z.string().min(1).describe('Migration name (snake_case)'),
          timeoutMs: z.number().int().min(1000).max(300_000).default(120_000),
        }),
      },
      async ({ name, timeoutMs }) => jsonText(await run(['bunx', 'prisma', 'migrate', 'dev', '--name', name], timeoutMs)),
    )

    server.registerTool(
      'dev_db_seed',
      {
        title: 'Seed database',
        description: 'Run `bun run db:seed`',
        inputSchema: z.object({
          timeoutMs: z.number().int().min(1000).max(300_000).default(60_000),
        }),
      },
      async ({ timeoutMs }) => jsonText(await run(['bun', 'run', 'db:seed'], timeoutMs)),
    )

    server.registerTool(
      'dev_db_generate',
      {
        title: 'Generate Prisma client',
        description: 'Run `bunx prisma generate`',
        inputSchema: z.object({
          timeoutMs: z.number().int().min(1000).max(300_000).default(60_000),
        }),
      },
      async ({ timeoutMs }) => jsonText(await run(['bunx', 'prisma', 'generate'], timeoutMs)),
    )
  },
}
