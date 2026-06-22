# DEPLOY_STG — Reference Appendix

Lihat juga: @docs/DEPLOY_STG.md (overview, arsitektur, 4 tool standar, checklist)

---

## Credential Scan — Pattern Regex

Scan berjalan otomatis di step **preflight** sebelum version bump. Pipeline
berhenti (`blocked_by: "credential_leak"` atau `"sensitive_file"`) jika ada
temuan — tidak ada commit yang dibuat.

### Pattern regex

| Nama pattern          | Regex (ringkas)                                        | Kategori                      |
| --------------------- | ------------------------------------------------------ | ----------------------------- |
| `anthropic_key`       | `sk-ant-[a-zA-Z0-9\-_]{20,}`                           | Anthropic API key             |
| `openai_key`          | `sk-[a-zA-Z0-9]{48}`                                   | OpenAI API key                |
| `stripe_key`          | `sk_(live\|test)_[a-zA-Z0-9]{24,}`                     | Stripe secret key             |
| `github_pat`          | `ghp_[a-zA-Z0-9]{36,}`                                 | GitHub PAT (classic)          |
| `github_oauth`        | `gho_[a-zA-Z0-9]{36,}`                                 | GitHub OAuth token            |
| `github_fine_grained` | `github_pat_[a-zA-Z0-9_]{22,}`                         | GitHub fine-grained PAT       |
| `slack_token`         | `xox[baprs]-[a-zA-Z0-9\-]{20,}`                        | Slack token                   |
| `google_api_key`      | `AIza[a-zA-Z0-9\-_]{35}`                               | Google API key                |
| `google_oauth_token`  | `ya29\.[a-zA-Z0-9\-_]{20,}`                            | Google OAuth access token     |
| `private_key_pem`     | `-----BEGIN [A-Z ]+ PRIVATE KEY-----`                  | PEM private key               |
| `bearer_hardcoded`    | `Bearer\s+[a-zA-Z0-9\-_\.]{20,}`                       | Bearer token di kode          |
| `db_url_with_creds`   | `(postgres\|mysql\|mongodb\|redis)://user:pass@`       | Database URL with credentials |
| `hardcoded_secret`    | `(password\|secret\|token)\s*[:=]\s*["'][^"']{8,}["']` | Credential hardcode           |

### File sensitif (diblok jika masuk diff)

| Pattern                            | Alasan                    |
| ---------------------------------- | ------------------------- |
| `.env`, `.env.*`                   | Environment variable      |
| `*.pem`, `*.key`, `*.p12`, `*.pfx` | Private key / certificate |
| `credentials.json`, `*.yaml`       | Credential file           |
| `service-account.json`             | GCP / AWS service account |
| `id_rsa`, `id_ed25519`             | SSH private key           |

### Cara scan

**Diff scan** — hanya baris baru (`+`), bukan seluruh codebase:

```bash
git diff origin/stg..HEAD -- . ":(exclude)*.lock" ":(exclude)package-lock.json" \
  | grep '^+' | grep -v '^+++'
```

**File scan** — cek nama file yang berubah di diff:

```bash
git diff --name-only origin/stg..HEAD
# → filter basename dengan regex SENSITIVE_FILE_PATTERNS
```

Nilai credential yang terdeteksi di-redact — hanya 20 karakter pertama + `***`:

```
✅ Benar: { type: "anthropic_key", sample: "sk-ant-api03-abc***", count: 1 }
❌ Salah: { type: "anthropic_key", sample: "sk-ant-api03-<full-key-leaked>" }
```

---

## Migration / Schema Check — Pola Adaptif

### Pola umum untuk ORM apapun

```
1. Deteksi perubahan schema file
   → git diff origin/<branch>..HEAD -- <schema-file>

2. Deteksi file migrasi baru
   → git diff origin/<branch>..HEAD --name-only -- <migrations-dir>

3. Jika schema berubah tapi tidak ada migrasi → BLOCK
   → "Schema changed without migration"

4. Jika ada migrasi baru → WARNING (informatif)

5. Cek migrasi unstaged → WARNING
   → git ls-files --others --exclude-standard <migrations-dir>

6. Cek drift (schema vs applied migrations) → WARNING
   → <orm-cli> migrate diff
```

### Adaptasi per ORM

| ORM/Tool | Schema file                     | Migration dir         | Drift check CLI                 |
| -------- | ------------------------------- | --------------------- | ------------------------------- |
| Prisma   | `prisma/schema.prisma`          | `prisma/migrations/`  | `prisma migrate diff`           |
| Drizzle  | `drizzle/schema.ts`             | `drizzle/migrations/` | `drizzle-kit check`             |
| Knex     | `knexfile.ts` + migration files | `migrations/`         | Manual (bandingkan hash)        |
| TypeORM  | `src/entities/*.ts`             | `src/migrations/`     | `typeorm migration:generate`    |
| Alembic  | `models/*.py`                   | `alembic/versions/`   | `alembic check`                 |
| Goose    | N/A (SQL-first)                 | `migrations/`         | N/A (SQL-first, no schema file) |
| Atlas    | `schema.sql` + `atlas.hcl`      | `migrations/`         | `atlas migrate diff`            |

SQL-first (Goose, Atlas): cukup cek apakah file `.sql` baru ada di diff — tidak ada schema file yang bisa di-drift-check.
Code-first (Prisma, Drizzle, TypeORM): cek schema file + migration dir + drift.

---

## Deploy Target — Pola Adaptif

### Docker + GitHub Actions (pola referensi, dipakai di project ini)

```bash
# Auth: set GH_TOKEN di environment, gh CLI otomatis membacanya
export GH_TOKEN=<your-github-pat>

# Git push pakai token (tanpa perlu gh auth login)
git push https://oauth2:${GH_TOKEN}@github.com/<owner>/<repo>.git <branch>

# Trigger build
gh workflow run publish.yml --ref <branch> -f stack_env=stg

# Trigger deploy
gh workflow run re-pull.yml --ref <branch> -f stack_env=stg -f stack_name=<name>

# Poll status
gh run view <run_id> --json status,conclusion
```

> **Kenapa tidak pakai `gh auth login`?** Butuh browser (device flow), tidak cocok
> untuk MCP server yang berjalan di background tanpa terminal interaktif.

### Docker + SSH (VPS manual)

```bash
docker build -t <registry>/<app>:<version> .
docker push <registry>/<app>:<version>
ssh <host> "docker pull <registry>/<app>:<version> && docker compose up -d"
```

### VPS langsung (no Docker)

```bash
# Git push ke remote khusus
git remote add production ssh://<host>/path/to/repo
git push production <branch>

# Atau rsync + restart
rsync -avz --exclude node_modules ./ <host>:/path/to/app
ssh <host> "cd /path/to/app && npm install && pm2 restart app"
```

### Platform as a Service

```bash
vercel deploy --prod   # Vercel
railway up             # Railway
flyctl deploy          # Fly.io
wrangler deploy        # Cloudflare Workers
serverless deploy      # AWS Lambda
```

### Pola verifikasi umum

```typescript
async function verifyVersion(expected: string, url: string, timeoutMs = 120_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/version`)
      const { version } = await res.json()
      if (version === expected) return true
    } catch { /* retry */ }
    await sleep(5_000)
  }
  return false
}
```

### Timeout rekomendasi

| Tahap          | Timeout  | Interval | Alasan                             |
| -------------- | -------- | -------- | ---------------------------------- |
| Build image    | 300-600s | 5-10s    | Docker build bisa 3-10 menit       |
| Deploy/restart | 120-300s | 5s       | Pull + container start             |
| Verify version | 120-180s | 5s       | Tunggu app sehat + health check OK |
| Health check   | 60s      | 2s       | Jika ada endpoint `/health`        |
