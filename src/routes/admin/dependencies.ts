import { Elysia } from 'elysia'
import { betterAuthPlugin } from '../../lib/auth-middleware'
import { guardSuperAdmin } from '../../lib/route-helpers'

export const adminDependenciesRouter = new Elysia({ tags: ['Admin — Info'] })
  .use(betterAuthPlugin)

  .get(
    '/api/admin/dependencies',
    async ({ authUser }) => {
      const guard = guardSuperAdmin(authUser)
      if (guard) return guard
      const fs = await import('node:fs')
      const pathMod = await import('node:path')
      const root = process.cwd()
      const pkgPath = pathMod.join(root, 'package.json')
      if (!fs.existsSync(pkgPath)) return { error: 'package.json not found' }

      const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
      const deps: Record<string, string> = pkgJson.dependencies || {}
      const devDeps: Record<string, string> = pkgJson.devDependencies || {}

      const catMap: Record<string, string> = {
        elysia: 'server',
        '@elysiajs/cors': 'server',
        '@elysiajs/html': 'server',
        '@elysiajs/swagger': 'server',
        'better-auth': 'auth',
        react: 'ui',
        'react-dom': 'ui',
        '@mantine/core': 'ui',
        '@mantine/hooks': 'ui',
        '@tanstack/react-router': 'ui',
        '@tanstack/react-query': 'ui',
        '@xyflow/react': 'ui',
        'react-icons': 'ui',
        '@prisma/client': 'database',
        prisma: 'database',
        vite: 'build',
        typescript: 'build',
        '@biomejs/biome': 'build',
        '@vitejs/plugin-react': 'build',
      }

      const srcFiles: string[] = []
      function scanSrc(dir: string) {
        const abs = pathMod.join(root, dir)
        if (!fs.existsSync(abs)) return
        for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
          if (['node_modules', 'dist', 'generated', '.git'].includes(e.name)) continue
          const rel = pathMod.join(dir, e.name).replace(/\\/g, '/')
          if (e.isDirectory()) scanSrc(rel)
          else if (/\.(ts|tsx)$/.test(e.name)) srcFiles.push(rel)
        }
      }
      scanSrc('src')

      const fileContents: Record<string, string> = {}
      for (const f of srcFiles) {
        fileContents[f] = fs.readFileSync(pathMod.join(root, f), 'utf-8')
      }

      const allPkgs: { name: string; version: string; type: string; category: string; usedBy: string[] }[] = []

      for (const [name, version] of Object.entries(deps)) {
        const usedBy: string[] = []
        const importPattern = new RegExp(`from\\s+['"]${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
        for (const [file, content] of Object.entries(fileContents)) {
          if (importPattern.test(content)) usedBy.push(file)
        }
        allPkgs.push({ name, version, type: 'runtime', category: catMap[name] || 'other', usedBy })
      }

      for (const [name, version] of Object.entries(devDeps)) {
        allPkgs.push({ name, version, type: 'dev', category: catMap[name] || 'build', usedBy: [] })
      }

      const byCategory: Record<string, number> = {}
      let runtime = 0,
        dev = 0
      for (const p of allPkgs) {
        byCategory[p.category] = (byCategory[p.category] || 0) + 1
        if (p.type === 'runtime') runtime++
        else dev++
      }

      return { packages: allPkgs, summary: { total: allPkgs.length, runtime, dev, byCategory } }
    },
    {
      detail: {
        summary: 'NPM dependency graph',
        description:
          'Lists all runtime and dev dependencies from package.json with version, category, and which source files import them.',
        security: [{ cookieAuth: [] }],
        responses: {
          200: { description: 'Dependency list with summary' },
          401: { description: 'Unauthenticated' },
          403: { description: 'Forbidden — requires SUPER_ADMIN' },
        },
      },
    },
  )
