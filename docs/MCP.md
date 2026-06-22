# MCP Server

Local MCP server lets Claude drive the app remotely via `.mcp.json`.
Registers `app-mcp` (runs `scripts/mcp/server.ts`) alongside `playwright`.

## Auth

- `MCP_SECRET` — readonly access
- `MCP_SECRET_ADMIN` — full write/dev access

## Entry Points

- `scripts/mcp/server.ts` — MCP server factory
- `scripts/mcp/test-client.ts` — manual test client

## Tool Modules (`scripts/mcp/tools/`)

`admin`, `code`, `db`, `dev`, `health`, `logs`, `presence`, `project`, `redis`, `tickets`, `shared`

## Project Tools (readonly)

`project_routes`, `project_schema`, `project_dependencies`, `project_migrations`,
`project_env_map`, `project_structure`, `project_file_health`

`project_file_health` — scan src/, prisma/, tests/, scripts/, docs/ dan laporkan
file yang mendekati / melebihi batas di `docs/FILE-HEALTH.md`. Status:
`ok` (<80%), `warn` (80–100%), `critical` (>100%), `exempt` (migration/seed/generated).

## Ticket Tools

`list`, `get`, `claim`, `comment`, `add_evidence`, `ready_for_qc`, `create`, `close`, `reopen`, `update`

## HTTP Fallback

`POST /mcp` — readonly with `MCP_SECRET` bearer, full with `MCP_SECRET_ADMIN`
