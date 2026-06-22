import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, extname, join, normalize } from 'node:path'

export interface CoverageSrcFile {
  path: string
  lines: number
  exports: string[]
  testedBy: string[]
  coverage: string
}

export interface CoverageTestFile {
  path: string
  lines: number
  type: string
  targets: string[]
}

export interface CoverageResult {
  sourceFiles: CoverageSrcFile[]
  testFiles: CoverageTestFile[]
  summary: {
    totalSource: number
    totalTests: number
    covered: number
    partial: number
    uncovered: number
    coveragePercent: number
  }
}

const EXTS = new Set(['.ts', '.tsx'])
const SKIP_DIRS = new Set(['node_modules', 'dist', 'generated', '.git'])

function scanDir(root: string, dir: string, collect: string[]) {
  const abs = join(root, dir)
  if (!existsSync(abs)) return
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue
    const rel = join(dir, entry.name).replace(/\\/g, '/')
    if (entry.isDirectory()) scanDir(root, rel, collect)
    else if (EXTS.has(extname(entry.name))) collect.push(rel)
  }
}

export function scanTestCoverage(root = process.cwd()): CoverageResult {
  const srcPaths: string[] = []
  scanDir(root, 'src', srcPaths)
  const srcFiltered = srcPaths.filter((f) => !f.includes('routeTree.gen'))

  const testPaths: string[] = []
  scanDir(root, 'tests', testPaths)
  const testFiltered = testPaths.filter((f) => f.includes('.test.'))

  const testFiles: CoverageTestFile[] = testFiltered.map((tp) => {
    const content = readFileSync(join(root, tp), 'utf-8')
    const lines = content.split('\n').length
    const type = tp.includes('/unit/') ? 'unit' : tp.includes('/integration/') ? 'integration' : 'other'
    const targets: string[] = []
    for (const m of content.matchAll(/from\s+['"]([^'"]*(?:src|lib)[^'"]*)['"]/g)) {
      let resolved = m[1].replace(/^.*?src\//, 'src/')
      if (resolved.startsWith('.')) {
        resolved = normalize(join(dirname(tp), resolved)).replace(/\\/g, '/')
      }
      for (const ext of ['', '.ts', '.tsx']) {
        const full = resolved + ext
        if (srcFiltered.includes(full)) {
          targets.push(full)
          break
        }
      }
    }
    if (/fetch\(['"`]\/api\//.test(content) || /createApp|createTestApp/.test(content)) {
      if (!targets.includes('src/app.ts')) targets.push('src/app.ts')
    }
    return { path: tp, lines, type, targets: [...new Set(targets)] }
  })

  const testedByMap: Record<string, string[]> = {}
  for (const tf of testFiles) {
    for (const target of tf.targets) {
      if (!testedByMap[target]) testedByMap[target] = []
      testedByMap[target].push(tf.path)
    }
  }

  const sourceFiles: CoverageSrcFile[] = srcFiltered.map((sp) => {
    const content = readFileSync(join(root, sp), 'utf-8')
    const lines = content.split('\n').length
    const exports: string[] = []
    for (const m of content.matchAll(
      /export\s+(?:default\s+)?(?:function|const|let|var|class|type|interface|enum)\s+(\w+)/g,
    )) {
      exports.push(m[1])
    }
    const tb = testedByMap[sp] || []
    const coverage = tb.length === 0 ? 'uncovered' : tb.some((f) => f.includes('/unit/')) ? 'covered' : 'partial'
    return { path: sp, lines, exports, testedBy: tb, coverage }
  })

  const covered = sourceFiles.filter((f) => f.coverage === 'covered').length
  const partial = sourceFiles.filter((f) => f.coverage === 'partial').length
  const uncovered = sourceFiles.filter((f) => f.coverage === 'uncovered').length

  return {
    sourceFiles,
    testFiles,
    summary: {
      totalSource: sourceFiles.length,
      totalTests: testFiles.length,
      covered,
      partial,
      uncovered,
      coveragePercent: Math.round(((covered + partial * 0.5) / sourceFiles.length) * 100),
    },
  }
}
