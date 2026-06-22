# SCALING — Panduan Ringkas untuk AI

Intisari dari pengalaman nyata men-scale project Bun + Elysia + Prisma + React.
Aturan konkret yang langsung diterapkan di project ini — bukan teori.

---

## Prinsip Utama

1. **Jangan lewati urutan.** Fondasi dulu, baru reliability, baru optimasi performa.
2. **Tidak ada rewrite total.** Semua perubahan adalah reorganisasi atau additive.
3. **Ukur sebelum optimasi.** Jangan implement infinite scroll sebelum ada data yang menunjukkan lambat.
4. **Satu domain per commit.** Setiap pemecahan file dilakukan bertahap, bukan sekaligus.

---

## Phase 1 — Fondasi

> Lakukan ini sebelum menambah fitur besar apapun.

### 1A. Pecah backend monolith

`src/app.ts` saat ini **1800+ baris** — sudah melewati batas. Saat menambah domain baru, pecah ke sub-router:

```
src/
  app.ts              ← orchestrator, cuma .use() sub-router
  routes/
    auth.ts           ← Better Auth handler + dev-auth
    admin/
      users.ts
      logs.ts
      schema.ts
      sessions.ts
    tickets.ts
  lib/
    auth-middleware.ts  ← betterAuthPlugin + guardSuperAdmin/guardQcOrAdmin/guardAuth (sudah ada)
    db.ts               ← Prisma singleton (sudah ada)
    cache.ts            ← withCache/invalidateCache (belum ada — buat saat dibutuhkan)
    pagination.ts       ← parsePagination() (belum ada — buat saat dibutuhkan)
```

Aturan ukuran: route file max 500 baris. Jika lebih, pecah lagi.

### 1B. Centralize auth middleware

**Sudah diimplementasi.** `src/lib/auth-middleware.ts` menyediakan `betterAuthPlugin` (Elysia derive)
dan `src/app.ts` punya `guardSuperAdmin`, `guardQcOrAdmin`, `guardAuth`. Jangan buat duplikasi baru.

Pattern yang sudah berjalan:
```typescript
// Di handler
const guard = guardSuperAdmin(authUser)
if (guard) return guard
```

### 1C. Prisma transaction di operasi kritis

Operasi multi-step harus atomic. Contoh yang sudah ada di project (block user):

```typescript
// Benar — atomic
await prisma.$transaction([
  prisma.user.update({ where: { id }, data: { blocked: true } }),
  prisma.session.deleteMany({ where: { userId: id } }),
])

// Salah — tidak atomic, bisa korup jika tengah-tengah gagal
await prisma.user.update(...)
await prisma.session.deleteMany(...)
```

Kapan wajib `$transaction`: update + delete bersamaan, create + relasi, bulk upsert yang harus konsisten.


### 1D. Pagination default di semua findMany

Tidak boleh ada `findMany` tanpa `take`. Helper yang direkomendasikan:

```typescript
// src/lib/pagination.ts
export function parsePagination(query: Record<string, unknown>, defaultLimit = 50, maxLimit = 200) {
  return {
    limit: Math.min(Number(query.limit) || defaultLimit, maxLimit),
    offset: Number(query.offset) || 0,
  }
}
```

Limit yang direkomendasikan: list umum 50, audit log 100, search results 20.

---

## Phase 2 — Reliability

> Lakukan ini setelah Phase 1 selesai.

### 2A. Integration test minimal per endpoint

**Sudah ada pattern-nya** di project ini via `tests/helpers.ts` + `tests/integration/`.

Setiap endpoint wajib punya minimal 3 test:
1. Happy path (berhasil)
2. Unauthorized (tanpa/invalid auth)
3. Invalid input atau not found

Pattern test dengan Elysia (tanpa server yang jalan — sudah dipakai):
```typescript
const app = createTestApp()
const res = await app.handle(new Request('http://localhost/api/...', {
  method: 'POST',
  headers: { cookie: `better-auth.session_token=${signedToken}` },
  body: JSON.stringify({ ... }),
}))
expect(res.status).toBe(200)
```

Target coverage: endpoint kritis (auth, admin, tickets) 60–100%. Total minimal 40%.

### 2B. Redis cache untuk query berulang

Redis sudah ada di project (`src/lib/redis.ts`). Buat wrapper saat ada query yang terbukti lambat:

```typescript
// src/lib/cache.ts (buat saat dibutuhkan)
export async function withCache<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
  try {
    const cached = await redis.get(key)
    if (cached) return JSON.parse(cached) as T
  } catch {}
  const data = await fetcher()
  if (data != null) redis.set(key, JSON.stringify(data), 'EX', ttlSeconds).catch(() => {})
  return data
}

export async function invalidateCache(...keys: string[]) {
  if (keys.length === 0) return
  redis.del(...keys).catch(() => {})
}
```

TTL yang direkomendasikan: user list 60s, audit logs 30s.
**Jangan cache:** session (dihandle Better Auth via `ba:kv:*`), data sensitif.

Setiap mutasi harus invalidate cache yang relevan.

### 2C. Soft delete untuk data penting

Tambah `deletedAt DateTime?` ke model yang tidak boleh di-hard-delete (Ticket, User jika perlu):

```typescript
// src/lib/db-helpers.ts (buat saat dibutuhkan)
export const notDeleted = { deletedAt: null } as const
export function softDelete() { return { deletedAt: new Date() } }
```

> Project ini saat ini pakai hard delete. Terapkan soft delete saat ada kebutuhan audit trail
> atau recovery data.

### 2D. API versioning

Buat `/api/v1/` saat ada breaking change pertama. Additive changes (tambah field, tambah endpoint) tidak perlu bump versi — sesuai `docs/AI_CONTRACT.md`.

---

## Phase 3 — Performance & Scale

> Lakukan hanya saat ada data nyata yang menunjukkan bottleneck.

### 3A. HTTP Cache-Control untuk static assets

**Sudah diimplementasi** di `src/index.tsx`:
```typescript
const isHashed = pathname.startsWith('/assets/')
'Cache-Control': isHashed ? 'public, max-age=31536000, immutable' : 'public, max-age=3600'
```

Pertahankan pattern ini. Jangan ubah ke `no-cache` global.

### 3B. Query tuning di TanStack Query

Gunakan nilai yang tepat per tipe data, bukan default global untuk semua:

```typescript
// Data stabil (user list, config)
{ staleTime: 5 * 60_000, refetchInterval: 5 * 60_000, refetchIntervalInBackground: false }

// Data semi real-time (session, presence)
{ staleTime: 30_000, refetchInterval: 60_000, refetchIntervalInBackground: false }

// Data yang berubah sering (ticket status, logs)
{ staleTime: 10_000, refetchOnWindowFocus: true }

// Data static (schema, routes metadata)
{ staleTime: Infinity, refetchInterval: false }
```

### 3C. Optimistic updates untuk mutasi yang sering

Pattern standar untuk toggle/update yang sering (misal: role change, block/unblock):

```typescript
const mutation = useMutation({
  mutationFn: (data) => apiFetch('/api/...', { method: 'PATCH', body: JSON.stringify(data) }),
  onMutate: async (data) => {
    await qc.cancelQueries({ queryKey: KEY })
    const previous = qc.getQueryData(KEY)
    qc.setQueryData(KEY, (old: any) => ({ ...old, /* update optimistis */ }))
    return { previous }
  },
  onError: (_err, _data, context) => {
    if (context?.previous) qc.setQueryData(KEY, context.previous)  // rollback
  },
  onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
})
```

Kapan pakai: toggle (block/unblock, active), update name/role.
Kapan tidak pakai: bulk operation, create baru, operasi jarang.

### 3D. Cursor-based pagination untuk list panjang

Gunakan saat offset pagination terbukti lambat (biasanya list > 10k rows).

Backend:
```typescript
// GET /api/resource?cursor=<lastId>&limit=20
const limit = Math.min(Number(query.limit) || 20, 100)
const items = await prisma.resource.findMany({
  take: limit + 1,
  ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  orderBy: { createdAt: 'desc' },
})
const hasMore = items.length > limit
return {
  items: hasMore ? items.slice(0, limit) : items,
  nextCursor: hasMore ? items[limit - 1]?.id : undefined,
}
```

Frontend — pakai `useInfiniteQuery` + IntersectionObserver untuk auto-load saat scroll.

### 3E. Pecah frontend component besar

Aturan: file > 500 baris = perlu dievaluasi, > 1000 baris = wajib pecah.

**Status saat ini:**
- `src/frontend/routes/dev.tsx` — **3600+ baris** → kandidat utama untuk dipecah
- `src/frontend/routes/dashboard.tsx` — **718 baris** → mendekati batas

Pattern yang direkomendasikan untuk `dev.tsx`:
```
routes/
  dev.tsx                     ← orchestrator (AppShell + tab routing saja)
  dev/
    OverviewPanel.tsx
    UsersPanel.tsx
    AppLogsPanel.tsx
    UserLogsPanel.tsx
    DatabasePanel.tsx
    ProjectPanel.tsx
```

Gunakan `memo()` di component yang props-nya jarang berubah.

---

## Session Expiry & Auto-Redirect

Implementasikan dua layer:

**Layer 1 — Polling**: `useSession` di `src/frontend/hooks/useAuth.ts` dengan `refetchInterval`.
Saat session hilang, redirect ke `/login`.

**Layer 2 — 401 interceptor**: Di `QueryCache` global, tangkap error dari semua query/mutation:

```typescript
// Di src/frontend/App.tsx — QueryClient setup
new QueryClient({
  queryCache: new QueryCache({
    onError: (err) => {
      if (err instanceof UnauthorizedError) {
        queryClient.setQueryData(['auth', 'session'], null)
      }
    }
  })
})
```

---

## Code Splitting (Frontend)

Vendor splitting di `vite.config.ts` (tambahkan saat bundle size > 1MB):
```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks: (id) => {
        if (id.includes('node_modules/react')) return 'react'
        if (id.includes('node_modules/@mantine')) return 'mantine'
        if (id.includes('node_modules/@tanstack')) return 'tanstack'
        if (id.includes('node_modules/react-icons')) return 'icons'
        if (id.includes('node_modules/@xyflow')) return 'xyflow'
        if (id.includes('node_modules/')) return 'vendor'
      }
    }
  }
}
```

---

## Anti-Pattern yang Harus Dihindari

| ❌ Jangan | ✅ Gantinya |
|---|---|
| `findMany` tanpa `take` | Selalu set limit, gunakan `parsePagination()` |
| Auth check copy-paste di setiap route | Pakai `guardSuperAdmin/guardQcOrAdmin/guardAuth` yang sudah ada |
| Multi-step DB tanpa `$transaction` | Bungkus dengan `prisma.$transaction([...])` |
| Hard delete data penting tanpa audit | Soft delete dengan `deletedAt` |
| `refetchInterval` sama untuk semua query | Sesuaikan per tipe data |
| Component > 1000 baris (terutama `dev.tsx`) | Pecah ke sub-components per panel |
| Catch error tanpa feedback ke user | Selalu tampilkan notifikasi error |
| Optimistic update tanpa rollback | Selalu sertakan `onError` dengan context rollback |
| Cache data tapi lupa invalidate di mutasi | Audit semua mutasi yang ubah data yang di-cache |
