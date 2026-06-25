FROM oven/bun:1 AS base
WORKDIR /app

# ── Install deps ──────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ── Build ─────────────────────────────────────────────────────────────────────
FROM deps AS builder
COPY . .

# Generate Prisma client (pure TypeScript in v7 — no native binary or WASM).
# prisma.config.ts resolves env('DATABASE_URL') eagerly on load; generate never
# connects, so a throwaway placeholder satisfies the config without a real DB.
# Scoped to this RUN only — never persists to later steps or the runtime image.
RUN DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" \
      bunx prisma generate

# Frontend bundle (Vite → dist/)
RUN bun run build

# Compile migration binary — zero npm dependency at runtime
RUN bun build scripts/migrate.ts \
      --compile --target=bun-linux-x64 \
      --outfile migrate

# Compile server binary — bundles all npm deps including Prisma client
RUN bun build src/server.prod.ts \
      --compile --target=bun-linux-x64 \
      --outfile server

# ── Runtime (lean — no node_modules, no bun runtime needed) ──────────────────
# debian:bookworm-slim (~90MB) vs oven/bun:1 (~220MB) — binary is self-contained,
# only needs glibc + ca-certificates + libssl3 from the OS.
FROM debian:bookworm-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      libssl3 \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

# Compiled self-contained binaries
COPY --from=builder /app/migrate  ./migrate
COPY --from=builder /app/server   ./server

# Frontend static files
COPY --from=builder /app/dist     ./dist


# Migration SQL files (read from disk at server startup)
COPY --from=builder /app/prisma/migrations ./prisma/migrations
COPY --from=builder /app/scripts  ./scripts

EXPOSE 3000

CMD ["./server"]
