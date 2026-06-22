import { existsSync, readFileSync, statSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { z } from 'zod'
import { jsonText, type ToolModule } from './shared'

function assertInsideRoot(target: string): string {
  const root = process.cwd()
  const full = isAbsolute(target) ? target : resolve(root, target)
  const rel = relative(root, full)
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error('Path is outside project root')
  }
  return full
}

export const codeTools: ToolModule = {
  name: 'code',
  scope: 'readonly',
  register(server) {
    server.registerTool(
      'code_read_file',
      {
        title: 'Read file',
        description: 'Read a project file by relative path (limited to project root). Returns contents with line range support.',
        inputSchema: z.object({
          path: z.string().describe('Relative path from project root'),
          offset: z.number().int().min(1).optional().describe('1-based line to start at'),
          limit: z.number().int().min(1).max(5000).optional(),
        }),
      },
      async ({ path: rel, offset, limit }) => {
        try {
          const full = assertInsideRoot(rel)
          if (!existsSync(full)) return jsonText({ error: 'File not found' })
          const st = statSync(full)
          if (!st.isFile()) return jsonText({ error: 'Not a regular file' })
          if (st.size > 2_000_000) return jsonText({ error: `File too large (${st.size} bytes)` })
          const text = readFileSync(full, 'utf-8')
          const lines = text.split('\n')
          const start = (offset ?? 1) - 1
          const end = limit ? start + limit : lines.length
          const slice = lines.slice(start, end)
          return jsonText({
            path: rel,
            totalLines: lines.length,
            range: { start: start + 1, end: Math.min(end, lines.length) },
            content: slice.join('\n'),
          })
        } catch (e) {
          return jsonText({ error: (e as Error).message })
        }
      },
    )

    server.registerTool(
      'code_grep',
      {
        title: 'Grep project',
        description: 'Search files for a regex pattern inside the project. Uses ripgrep if available, falls back to Bun subprocess.',
        inputSchema: z.object({
          pattern: z.string(),
          glob: z.string().optional().describe('Glob filter, e.g. src/**/*.ts'),
          maxResults: z.number().int().min(1).max(500).default(100),
          caseInsensitive: z.boolean().default(false),
        }),
      },
      async ({ pattern, glob, maxResults, caseInsensitive }) => {
        const args = ['--json', '--max-count', '5', '-n', '--max-filesize', '1M']
        if (caseInsensitive) args.push('-i')
        if (glob) args.push('--glob', glob)
        args.push(pattern)
        try {
          const proc = Bun.spawn(['rg', ...args], {
            cwd: process.cwd(),
            stdout: 'pipe',
            stderr: 'pipe',
          })
          const out = await new Response(proc.stdout).text()
          await proc.exited
          const matches: { path: string; line: number; text: string }[] = []
          for (const raw of out.split('\n')) {
            if (!raw.trim()) continue
            try {
              const j = JSON.parse(raw)
              if (j.type === 'match') {
                matches.push({
                  path: j.data.path.text,
                  line: j.data.line_number,
                  text: j.data.lines.text.replace(/\n$/, ''),
                })
                if (matches.length >= maxResults) break
              }
            } catch {}
          }
          return jsonText({ matches: matches.length, results: matches })
        } catch (e) {
          return jsonText({ error: `ripgrep unavailable: ${(e as Error).message}` })
        }
      },
    )

    server.registerTool(
      'code_stat',
      {
        title: 'Stat file',
        description: 'Return size, line count, and mtime for a file',
        inputSchema: z.object({ path: z.string() }),
      },
      async ({ path: rel }) => {
        try {
          const full = assertInsideRoot(rel)
          if (!existsSync(full)) return jsonText({ error: 'File not found' })
          const st = statSync(full)
          const lines = st.isFile() && st.size < 2_000_000
            ? readFileSync(full, 'utf-8').split('\n').length
            : null
          return jsonText({
            path: rel,
            isFile: st.isFile(),
            isDirectory: st.isDirectory(),
            size: st.size,
            lines,
            modifiedAt: st.mtime.toISOString(),
          })
        } catch (e) {
          return jsonText({ error: (e as Error).message })
        }
      },
    )
  },
}
