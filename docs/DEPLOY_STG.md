# MCP Deploy Server — Pola Umum

Panduan agnostik untuk membangun MCP server deploy otomatis di project
apa pun. Tidak terikat stack tertentu — bisa Docker, VPS, serverless,
atau platform lain.

Detail pattern regex, adaptasi ORM, dan variasi deploy target: @docs/DEPLOY_STG_REFERENCE.md

---

## `.mcp.json` — Apa & Bagaimana

### Apa itu `.mcp.json`?

File konfigurasi di root project yang mendaftarkan **MCP (Model Context
Protocol) server**. Claude Code membaca file ini saat startup dan
me-register semua server — sehingga tool-tool yang disediakan server
muncul di sesi dengan prefix namespace.

Satu file bisa mendaftarkan banyak server sekaligus. Tidak ada batasan
jumlah server maupun jumlah tool per server.

### Format

```json
{
  "mcpServers": {
    "<nama-server>": {
      "command": "<runtime>",
      "args": ["<entry-point>"],
      "env": { "KEY": "value" },
      "description": "..."
    }
  }
}
```

### Dua jenis transport

| Jenis     | Key                    | Cara kerja                                                      | Cocok untuk                              |
| --------- | ---------------------- | --------------------------------------------------------------- | ---------------------------------------- |
| **stdio** | `command` + `args`     | Claude Code spawn process, komunikasi via stdin/stdout JSON-RPC | Tool lokal (git, file system, CLI)       |
| **HTTP**  | `type: "http"` + `url` | Claude Code HTTP POST ke endpoint, Bearer auth opsional         | Tool remote (API staging, DB production) |

```json
// Contoh: stdio server (process lokal)
{
  "deploy-stg": {
    "command": "bun",
    "args": ["run", "scripts/mcp/deploy.ts"],
    "env": {
      "STACK_NAME": "my-app",
      "BASE_URL": "https://my-app.example.com",
      "ENV": "stg",
      "GH_TOKEN": "${GH_TOKEN}",
      "GH_REPO": "owner/repo"
    },
    "description": "Deploy pipeline ke staging"
  }
}

// Contoh: HTTP server (remote)
{
  "staging-api": {
    "type": "http",
    "url": "https://staging.example.com/mcp",
    "headers": { "Authorization": "Bearer ${AUTH_TOKEN}" }
  }
}
```

### Cara Claude Code membaca `.mcp.json`

1. Saat sesi dimulai di direktori project, Claude Code mencari `.mcp.json` di root
2. Setiap server stdio di-spawn sebagai child process
3. Komunikasi dua arah via **JSON-RPC 2.0** (request → response)
4. Server HTTP dipanggil via HTTP POST dengan body JSON-RPC
5. Semua tool dari semua server muncul di sesi dengan prefix namespace:
   - `mcp__<nama-server>__<nama-tool>`
   - Contoh: `mcp__deploy-stg__deploy`, `mcp__my-app__check_version`

### Environment variable interpolation

Nilai `${VAR}` di `.mcp.json` di-interpolasi dari environment variable
Claude Code session. Berguna untuk menyuntikkan token/auth tanpa hardcode.

```json
"env": {
  "AUTH_TOKEN": "${AUTH_TOKEN}"
}
```

> **Catatan**: `.mcp.json` hanya berisi deklarasi server — bukan
> environment variable project. Variable sensitif tetap disimpan di
> `.env` dan di-passing oleh Claude Code ke child process.

> **Commit atau ignore?** `.mcp.json` **harus di-commit** ke repo.
> File ini adalah konfigurasi tooling project (seperti `.eslintrc`,
> `tsconfig.json`) — bukan secret. Dengan men-commit-nya, semua
> contributor langsung punya MCP server yang sama saat clone.
> Yang perlu di-ignore hanya file yang mengandung credential atau
> bersifat lokal murni (`.env`, `*.pem`, output build).

### Konfigurasi per-project via env

Daripada hardcode konstanta di script, baca dari `process.env` dengan
fallback. Pola ini membuat **satu script bisa dipakai di banyak project**
hanya dengan beda konfigurasi di `.mcp.json`.

```typescript
// ❌ Hardcode — tidak bisa dikonfigurasi ulang
const STACK_NAME = "my-app";
const STACK_ENV = "stg";
const STAGING_URL = "https://my-app.example.com";

// ✅ Env-driven dengan fallback
const STACK_NAME = process.env.STACK_NAME ?? "my-app";
const STACK_ENV = process.env.ENV ?? "stg";
const STAGING_URL = process.env.BASE_URL ?? "https://my-app.example.com";
```

Lima var standar untuk deploy server:

| Env Var      | Keterangan                                        | Contoh                                |
| ------------ | ------------------------------------------------- | ------------------------------------- |
| `STACK_NAME` | Nama stack di Portainer / nama service / app name | `my-app`                              |
| `BASE_URL`   | URL target untuk verifikasi versi live            | `https://my-app.example.com`          |
| `ENV`        | Environment label (`stg`, `prod`, `preview`)      | `stg`                                 |
| `GH_TOKEN`   | GitHub PAT / token untuk `gh` CLI dan `git push`  | nilai dari environment host           |
| `GH_REPO`    | `owner/repo` GitHub untuk trigger workflow        | `owner/repo`                          |

`GH_TOKEN` wajib untuk operasi tulis GitHub (`git push`, `gh workflow run`).
Tanpa token, server hanya bisa melakukan operasi baca (scan, check version).
Token di-passing dari environment host ke child process MCP via `${GH_TOKEN}`
interpolation di `.mcp.json` — **tidak pernah di-hardcode di file**.

`GH_REPO` bersifat opsional — jika tidak diset, server membaca otomatis
dari `git remote get-url origin`:

```typescript
const REPO =
  process.env.GH_REPO ??
  (() => {
    try {
      const url = execSync("git remote get-url origin", { encoding: "utf8" }).trim()
      const m = url.match(/github\.com[/:](.+?\/.+?)(?:\.git)?$/)
      if (m) return m[1]
    } catch {}
    return "owner/repo"
  })()
```

---

## Arsitektur MCP Deploy Server

### Prinsip desain

```
┌──────────────────────────────────────────────────┐
│  Claude Code Session                             │
│                                                  │
│  User: "deploy ke staging"                       │
│       │                                          │
│       ▼                                          │
│  Claude memutuskan tool call:                    │
│  mcp__<nama-server>__deploy({ bump: "patch" })   │
│       │                                          │
│       ▼                                          │
│  JSON-RPC Request → stdin                        │
│       │                                          │
│       ▼                                          │
│  ┌────────────────────────────────┐              │
│  │  MCP Server (process lokal)    │              │
│  │                                │              │
│  │  Runtime: Bun / Node / Python  │              │
│  │  SDK: @modelcontextprotocol   │              │
│  │  Transport: StdioServer        │              │
│  │                                │              │
│  │  Tools:                        │              │
│  │  ├── deploy                    │              │
│  │  ├── check_version             │              │
│  │  ├── deploy_status             │              │
│  │  └── preflight                 │              │
│  │                                │              │
│  │  Dependensi eksternal:         │              │
│  │  ├── git (branch, diff, push)  │              │
│  │  ├── gh CLI (workflow trigger) │              │
│  │  ├── Tool stack (migrasi, dll) │              │
│  │  └── HTTP ke staging (verify)  │              │
│  └────────────────────────────────┘              │
│       │                                          │
│       ▼                                          │
│  JSON-RPC Response ← stdout                      │
│       │                                          │
│       ▼                                          │
│  Claude menampilkan hasil ke user                │
└──────────────────────────────────────────────────┘
```

### Mengapa MCP server terpisah, bukan skill?

| Aspek        | MCP Server (stdio)                                | Skill (Markdown prompt)                       |
| ------------ | ------------------------------------------------- | --------------------------------------------- |
| Eksekusi     | Kode nyata — akses file system, network, CLI      | Hanya instruksi teks ke Claude                |
| Kecepatan    | Deterministik, instant                            | Bergantung pada Claude membaca + mengeksekusi |
| Kompleksitas | Bisa kompleks (loop, retry, parse)                | Terbatas pada yang Claude bisa lakukan        |
| Output       | JSON terstruktur                                  | Teks bebas                                    |
| Reusabilitas | Framework-agnostic, bisa dipanggil dari mana saja | Hanya di sesi Claude                          |

**Rule of thumb**: jika pipeline melibatkan polling, retry, timeout,
parsing output CLI, atau akses sistem yang presisi → **MCP server**.
Jika hanya instruksi naratif ke Claude → **skill**.

### Server harus standalone

MCP server stdio TIDAK boleh mengimpor dari kode project. Alasannya:

- Server di-spawn sebagai process terpisah — import dari `src/` bisa
  menarik dependensi besar dan lambat startup
- Server harus berjalan bahkan saat project dalam state broken (gagal
  build, missing dependency)
- Isolasi mencegah side-effect (koneksi DB terbuka, log file terkunci)

Server hanya boleh bergantung pada: SDK MCP itu sendiri, runtime
standard library, dan CLI tools eksternal (`git`, `gh`, `docker`, dll).

---

## Pola Pipeline: Preflight → Mutate → Push → Deploy → Verify

### Flow umum

```
START
  │
  ▼
┌─────────────────────┐
│ 1. Pre-checks       │
│  ├─ Branch target   │  harus di branch yang benar
│  └─ Working tree    │  harus clean
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ 2. Preflight scan   │  ← JALANKAN SEBELUM mutasi apapun
│  ├─ Credential leak │  BLOCK jika terdeteksi
│  └─ Migration check │  BLOCK jika drift (optional)
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ 3. Version bump     │  patch | minor | major
│    (package.json)   │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ 4. Git commit       │  chore: bump X.X.X
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ 5. Git push         │  origin/<branch>
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ 6. Trigger deploy   │  CI/CD, Docker, script remote
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ 7. Wait + verify    │  Poll sampai versi target live
└──────────┬──────────┘
           ▼
         DONE
```

### Prinsip kunci: preflight sebelum mutasi

```
❌ SALAH: bump → commit → scan → BLOCKED
   └─ commit version bump sudah ada, harus di-undo

✅ BENAR: scan → BLOCKED? stop → baru bump → commit
   └─ tidak ada yang perlu di-undo, user tinggal perbaiki
```

Commit version bump yang gagal deploy menyisakan noise di history dan
harus di-reset manual. Dengan preflight di depan, pipeline berhenti
sebelum menyentuh file apapun.

---

## Empat Tool Standar

### 1. `deploy` — Deploy penuh

```typescript
// Input schema
{
  bump: "patch" | "minor" | "major",  // default: patch
  message: string,                     // opsional, auto-generate
  skip_commit: boolean                 // skip bump+commit
}

// Output sukses
{
  success: true,
  version: "1.2.3",
  target_url: "https://staging.example.com",
  steps: [
    { step: "credential_scan", status: "ok" },
    { step: "bump_version", status: "ok", detail: "1.2.2 → 1.2.3" },
    { step: "commit", status: "ok" },
    { step: "push", status: "ok" },
    { step: "deploy_triggered", status: "ok" },
    { step: "verify", status: "ok", detail: "https://... → 1.2.3" }
  ]
}
```

### 2. `check_version` — Bandingkan versi lokal vs target

```json
{ "local": "1.2.3", "target": "1.2.2", "target_url": "https://...", "in_sync": false }
```

### 3. `deploy_status` — Cek status CI/CD terakhir

```json
{ "workflows": [{ "id": 123, "name": "deploy", "status": "completed", "conclusion": "success" }] }
```

### 4. `preflight` — Scan tanpa deploy

```json
{ "credential_scan": { "ok": true, "issues": [] }, "migration_check": { "ok": true, "warnings": [] }, "deploy_safe": true }
```

---

## Keamanan

- **Environment variable, bukan hardcode** — semua token/secret dari `process.env`
- **Redact credential di output** — jangan tampilkan nilai penuh, cukup 20 char + `***`
- **Scan diff, bukan seluruh codebase** — lebih cepat dan minim false positive
- **Preflight sebelum mutasi** — tidak meninggalkan artifact setengah jalan
- **Server standalone** — tidak import dari `src/`, tidak ada side-effect
- **Jangan log credential** — gunakan `console.error` untuk log internal,
  bedakan dari `stdout` yang digunakan JSON-RPC
- **GH_TOKEN via `.mcp.json` interpolation** — token di-passing dari host env
  ke child process via `${GH_TOKEN}`, tidak pernah ditulis ke file

---

## Checklist Implementasi

Saat membangun MCP deploy server untuk project baru, jawab pertanyaan ini:

- [ ] Runtime apa? (Bun, Node, Python, Go)
- [ ] Branch target deploy? (`stg`, `main`, `production`)
- [ ] Version bump: semver atau timestamp?
- [ ] ORM apa? Code-first atau SQL-first? (lihat @docs/DEPLOY_STG_REFERENCE.md)
- [ ] Di mana schema file dan migration dir?
- [ ] Deploy target: Docker + GHA, SSH, PaaS, serverless? (lihat @docs/DEPLOY_STG_REFERENCE.md)
- [ ] Bagaimana cara trigger deploy? (CLI command, API call)
- [ ] Bagaimana cara cek status deploy? (poll workflow, cek container)
- [ ] Endpoint verifikasi? (`/api/version`, `/health`)
- [ ] Token/auth apa yang dibutuhkan untuk akses staging/production?
- [ ] GH_TOKEN: sudah di-set di environment host? Sudah di-passing via `.mcp.json` `"${GH_TOKEN}"`?
