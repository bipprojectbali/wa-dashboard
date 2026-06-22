// ─── server.prod.ts template ──────────────────────────────────────────────────

export function makeServerProdTemplate(prefixesLiteral: string): string {
  return `/// <reference types="bun-types" />
/**
 * Production-only server entry point.
 * Compiled via: bun build src/server.prod.ts --compile --target=bun-linux-x64 --outfile server
 *
 * Omits Vite dev middleware so the bundle doesn't pull in devDependencies.
 * Dev workflow unchanged — use src/serve.ts as before.
 */

import fs from 'node:fs'
import path from 'node:path'
import { env } from './lib/env'
import { runMigrations } from './lib/migrate'

// ─── Route Classification ──────────────────────────────
// Auto-detected from src/app.ts + src/routes/**. Verify and add any missing prefixes.
const API_PREFIXES = [${prefixesLiteral}]

function isApiRoute(pathname: string): boolean {
  return API_PREFIXES.some(p =>
    p.endsWith('/') ? pathname.startsWith(p) : pathname === p || pathname.startsWith(p + '/')
  )
}

// ─── Frontend Serving (static files from dist/) ───────
async function serveFrontend(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const pathname = url.pathname
  const filePath = path.join('dist', pathname === '/' ? 'index.html' : pathname)

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const isHashed = pathname.startsWith('/assets/')
    return new Response(Bun.file(filePath), {
      headers: {
        'Cache-Control': isHashed
          ? 'public, max-age=31536000, immutable'
          : 'public, max-age=0, must-revalidate',
      },
    })
  }
  // SPA fallback
  const indexHtml = path.join('dist', 'index.html')
  if (fs.existsSync(indexHtml)) {
    return new Response(Bun.file(indexHtml), {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' },
    })
  }
  return new Response('Not Found', { status: 404 })
}

// ─── Database Migration ────────────────────────────────
if (process.env.MIGRATE_ON_STARTUP !== 'false') {
  await runMigrations()
}

// ─── TODO: Add project-specific startup tasks here ────
// Examples:
//   import { cleanupOldLogs } from './lib/cleanup'
//   cleanupOldLogs().catch(console.error)
//   setInterval(() => cleanupOldLogs().catch(console.error), 24 * 60 * 60 * 1000)

// ─── Elysia App ────────────────────────────────────────
import { createApp } from './app'

const app = createApp()
  .onRequest(async ({ request }) => {
    const pathname = new URL(request.url).pathname
    if (!isApiRoute(pathname)) {
      return serveFrontend(request)
    }
  })
  .listen(env.PORT)

console.log(\`Server running at http://localhost:\${app.server!.port}\`)
`
}

// ─── Dockerfile template ──────────────────────────────────────────────────────

export interface DockerfileOptions {
  resolvedLockFile: string
  cliBuildLine: string
  cliCopyLine: string
  publicCopyLine: string
  mcpCopyLine: string
}

export function makeDockerfileTemplate(opts: DockerfileOptions): string {
  const { resolvedLockFile, cliBuildLine, cliCopyLine, publicCopyLine, mcpCopyLine } = opts
  return `FROM oven/bun:1 AS base
WORKDIR /app

# ── Install deps ──────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json ${resolvedLockFile} ./
RUN bun install --frozen-lockfile

# ── Build ─────────────────────────────────────────────────────────────────────
FROM deps AS builder
COPY . .

# Generate Prisma client (pure TypeScript in v7 — no native binary or WASM)
RUN bunx prisma generate

# Frontend bundle (Vite → dist/)
RUN bun run build
${cliBuildLine}
# Compile migration binary — zero npm dependency at runtime
RUN bun build scripts/migrate.ts \\
      --compile --target=bun-linux-x64 \\
      --outfile migrate

# Compile server binary — bundles all npm deps including Prisma client
RUN bun build src/server.prod.ts \\
      --compile --target=bun-linux-x64 \\
      --outfile server

# ── Runtime (lean — no node_modules, no bun runtime needed) ──────────────────
# debian:bookworm-slim (~90MB) vs oven/bun:1 (~220MB) — binary is self-contained,
# only needs glibc + ca-certificates + libssl3 from the OS.
FROM debian:bookworm-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \\
      ca-certificates \\
      libssl3 \\
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

# Compiled self-contained binaries
COPY --from=builder /app/migrate  ./migrate
COPY --from=builder /app/server   ./server

# Frontend static files
COPY --from=builder /app/dist     ./dist
${publicCopyLine}

# Migration SQL files (read from disk at server startup)
COPY --from=builder /app/prisma/migrations ./prisma/migrations
${cliCopyLine}${mcpCopyLine}
EXPOSE 3000

CMD ["./server"]
`
}
