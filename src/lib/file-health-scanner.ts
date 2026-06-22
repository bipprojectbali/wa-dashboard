interface CategoryRule {
  category: string
  match: (path: string) => boolean
  limitLines: number
  limitChars: number
}

export interface FileHealth {
  path: string
  category: string
  lines: number
  chars: number
  limitLines: number
  limitChars: number
  ratioLines: number
  ratioChars: number
  status: 'ok' | 'warn' | 'critical' | 'exempt'
  exempt: boolean
}

const CATEGORY_RULES: CategoryRule[] = [
  { category: 'test', match: (p) => p.startsWith('tests/'), limitLines: 400, limitChars: 16_000 },
  {
    category: 'frontend-route',
    match: (p) => p.startsWith('src/frontend/routes/'),
    limitLines: 500,
    limitChars: 20_000,
  },
  { category: 'frontend-hook', match: (p) => p.startsWith('src/frontend/hooks/'), limitLines: 200, limitChars: 8_000 },
  {
    category: 'frontend-component',
    match: (p) => p.startsWith('src/frontend/components/'),
    limitLines: 300,
    limitChars: 12_000,
  },
  { category: 'frontend', match: (p) => p.startsWith('src/frontend/'), limitLines: 300, limitChars: 12_000 },
  { category: 'route', match: (p) => p.startsWith('src/routes/'), limitLines: 150, limitChars: 6_000 },
  { category: 'lib', match: (p) => p.startsWith('src/lib/'), limitLines: 250, limitChars: 10_000 },
  { category: 'backend', match: (p) => p.startsWith('src/'), limitLines: 300, limitChars: 12_000 },
  { category: 'prisma', match: (p) => p.startsWith('prisma/'), limitLines: 500, limitChars: 20_000 },
  { category: 'script', match: (p) => p.startsWith('scripts/'), limitLines: 300, limitChars: 12_000 },
  { category: 'docs', match: (p) => p.startsWith('docs/'), limitLines: 500, limitChars: 20_000 },
]

const HARD_LIMIT_LINES = 500
const HARD_LIMIT_CHARS = 20_000

const EXEMPT_PATTERNS: RegExp[] = [/\.generated\./, /^prisma\/migrations\//, /\.seed\./, /__fixtures__/, /__mocks__/]

const SCAN_DIRS = ['src', 'prisma', 'tests', 'scripts', 'docs']
const SKIP_DIRS = new Set(['node_modules', 'dist', 'generated', '.git', '.next', 'build', 'coverage'])
const SCAN_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.prisma', '.md'])

function classify(path: string): CategoryRule {
  for (const rule of CATEGORY_RULES) {
    if (rule.match(path)) return rule
  }
  return { category: 'other', match: () => true, limitLines: HARD_LIMIT_LINES, limitChars: HARD_LIMIT_CHARS }
}

function isExempt(path: string): boolean {
  return EXEMPT_PATTERNS.some((re) => re.test(path))
}

function statusFor(ratio: number, exempt: boolean): FileHealth['status'] {
  if (exempt) return 'exempt'
  if (ratio > 1) return 'critical'
  if (ratio >= 0.8) return 'warn'
  return 'ok'
}

export async function scanFileHealth() {
  const fs = await import('node:fs')
  const path = await import('node:path')
  const root = process.cwd()
  const files: FileHealth[] = []

  function scan(dir: string) {
    const absDir = path.join(root, dir)
    if (!fs.existsSync(absDir)) return
    const entries = fs.readdirSync(absDir, { withFileTypes: true })
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue
      const rel = path.join(dir, entry.name).replace(/\\/g, '/')
      if (entry.isDirectory()) {
        scan(rel)
        continue
      }
      const ext = path.extname(entry.name)
      if (!SCAN_EXTS.has(ext)) continue
      try {
        const content = fs.readFileSync(path.join(root, rel), 'utf-8')
        const lines = content.split('\n').length
        const chars = content.length
        const rule = classify(rel)
        const exempt = isExempt(rel)
        const ratioLines = lines / rule.limitLines
        const ratioChars = chars / rule.limitChars
        const ratio = Math.max(ratioLines, ratioChars)
        files.push({
          path: rel,
          category: rule.category,
          lines,
          chars,
          limitLines: rule.limitLines,
          limitChars: rule.limitChars,
          ratioLines: Number(ratioLines.toFixed(3)),
          ratioChars: Number(ratioChars.toFixed(3)),
          status: statusFor(ratio, exempt),
          exempt,
        })
      } catch {
        /* skip unreadable */
      }
    }
  }

  for (const d of SCAN_DIRS) scan(d)

  files.sort((a, b) => {
    if (a.exempt !== b.exempt) return a.exempt ? 1 : -1
    return Math.max(b.ratioLines, b.ratioChars) - Math.max(a.ratioLines, a.ratioChars)
  })

  const byStatus: Record<string, number> = { ok: 0, warn: 0, critical: 0, exempt: 0 }
  const byCategory: Record<string, number> = {}
  let totalLines = 0
  let totalChars = 0
  for (const f of files) {
    byStatus[f.status] = (byStatus[f.status] ?? 0) + 1
    byCategory[f.category] = (byCategory[f.category] ?? 0) + 1
    totalLines += f.lines
    totalChars += f.chars
  }

  return {
    files,
    summary: {
      totalFiles: files.length,
      totalLines,
      totalChars,
      hardLimitLines: HARD_LIMIT_LINES,
      hardLimitChars: HARD_LIMIT_CHARS,
      byStatus,
      byCategory,
    },
    worstOffenders: files.filter((f) => !f.exempt).slice(0, 10),
  }
}
