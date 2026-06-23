# Frontend

React 19 + Vite 8 (middleware mode in dev). Static (code-based) TanStack Router — no codegen, no generated files.

## Entry Points

- `src/frontend.tsx` — renders App, removes splash screen, DevInspector in dev
- `src/frontend/App.tsx` — MantineProvider (auto color scheme), ModalsProvider, QueryClientProvider, RouterProvider
- `src/frontend/router.ts` — assembles routeTree, creates router, registers `Register` type. **Single source of truth for navigation.**

## Routes (`src/frontend/routes/`)

Each file exports a named `*Route` const via `createRoute`. Never use `createFileRoute`.

| File | Export | Path | Auth |
|------|--------|------|------|
| `__root.tsx` | `rootRoute` | — | — |
| `index.tsx` | `indexRoute` | `/` | public |
| `login.tsx` | `loginRoute` | `/login` | public, `validateSearch` for `?error=` |
| `dev.tsx` | `devRoute` | `/dev` | SUPER_ADMIN, `validateSearch` for `?tab=` |
| `dashboard.tsx` | `dashboardRoute` | `/dashboard` | ADMIN+QC, `validateSearch` for `?tab=` |
| `profile.tsx` | `profileRoute` | `/profile` | authenticated |
| `blocked.tsx` | `blockedRoute` | `/blocked` | authenticated |
| `changelog.tsx` | `changelogRoute` | `/changelog` | authenticated — full version history from `GET /api/changelog?all=true` |
| `wa.tsx` | `waRoute` | `/wa` | ADMIN+SUPER_ADMIN, `validateSearch` for `?tab=` (connection\|account\|send\|policy) |

**Rule:** new route → (1) create file, (2) export `*Route` via `createRoute`, (3) add to `router.ts` `addChildren([...])`.

## Hooks

- `src/frontend/hooks/useAuth.ts` — `useSession()`, `useLogin()`, `useLogout()`, `getDefaultRoute(role)`
  - Uses Better Auth React client (`src/lib/auth-client.ts`)
  - `beforeLoad` in each route calls `authClient.getSession()` via `queryClient.ensureQueryData`
- `src/frontend/hooks/usePresence.ts` — WebSocket auto-connect, exposes `onlineUserIds`
- `src/frontend/hooks/useWaRealtime.ts` — connect `/ws/wa`, invalidate query `['wa','status']`/`['wa','qr']` saat event masuk, expose `wsReady` (panel pakai ini untuk fallback polling)

## Components (`src/frontend/components/`)

- `ThemeToggle.tsx` — dark/light toggle, used across all pages
- `TicketsPanel.tsx` — shared between `/dev` and `/dashboard`, QC-scoped when role=QC
- `WhatsNewModal.tsx` — "What's New" modal shown on app load when version changes. Compares `/api/version` vs `localStorage.last_seen_version`; fetches `/api/changelog` and shows a Mantine modal with Added/Changed/Fixed/Removed sections. Dismissed version is saved to `localStorage`.
- `NotFound.tsx` — 404 page
- `ErrorPage.tsx` — error boundary

### WA panels (`src/frontend/components/wa/`)

Tab `?tab=connection` ("Koneksi"):
- `WaConnectionPanel.tsx` — status koneksi + tombol Start/Restart/Terminate. Query `['wa','status']` GET `/api/wa/session/status`; selama state belum `CONNECTED` selalu polling 3s (transisi pairing bisa terjadi tanpa event WS final), setelah `CONNECTED` mengandalkan WS bila `wsReady` (fallback polling bila WS mati). Kartu pairing punya `SegmentedControl` QR ↔ Nomor HP: mode QR menampilkan `GET /api/wa/session/qr/image`; mode Nomor HP kirim `POST /api/wa/session/pairing-code` lalu menampilkan kode pairing dengan tombol salin.
- `src/frontend/lib/wa-pairing.ts` — helper murni (tanpa React) untuk flow pairing: `extractPairingCode` (baca varian bentuk respons container) dan `pairingCodeOrThrow` (lempar Error actionable saat container balas `HTTP 200 { success: false }`, mis. `session_not_found` — kalau tidak, kegagalan tertelan diam karena `apiFetch` hanya throw pada non-2xx). Dipakai sebagai `mutationFn` pairing agar error muncul di `pairing.error`/alert.

Tab `?tab=policy` di `/wa` ("Aturan & Kontrak", icon `TbShieldLock`):
- `WaPolicyPanel.tsx` — orchestrator, query `['wa','policy']` GET `/api/wa/policy`. Banner oranye saat `allowFirstContact=true` (mode OTP aktif).
- `WaContractView.tsx` — render teks kontrak + tombol "Saya setuju & paham risikonya" → POST `/api/wa/policy/ack`. Saat sudah disetujui, muncul tombol "Batalkan persetujuan" (modal konfirmasi) → DELETE `/api/wa/policy/ack`.
- `WaPolicyUsage.tsx` — progress bar kuota menit/jam/hari.
- `WaPolicySettings.tsx` — form editable (SUPER_ADMIN saja, `canEdit`) → PUT `/api/wa/policy`.
- `wa-policy.types.ts` — tipe `WaPolicy`, `UsageSnapshot`, `PolicyResponse`, `PolicyEditable`.

Tab `?tab=account` ("Info Akun"):
- `WaAccountPanel.tsx` — info akun + tabel kontak dengan search box (nama/nomor) dan kolom "Foto".
- `WaContactAvatar.tsx` — avatar lazy per kontak. `IntersectionObserver` (`rootMargin: '100px'`) menunda fetch sampai baris masuk viewport, lalu query `['wa','avatar',contactId]` GET `/api/wa/avatar`. Mantine `<Avatar>` fallback ke inisial nama bila `url` null.

## Data Fetching

- `src/frontend/lib/apiFetch.ts` — `apiFetch<T>(path, init?)` wrapper di atas `fetch`. Selalu `credentials: 'include'`; **otomatis menyetel `Content-Type: application/json` saat `init.body` ada** (header eksplisit dari caller tetap menang) — caller cukup `body: JSON.stringify(...)` tanpa perlu set header manual. Melempar `UnauthorizedError` (dari `src/frontend/lib/errors.ts`) pada 401 agar `QueryCache` global mereset session; pada non-ok lain melempar `Error` dengan pesan dari field `error` body.

## UI Conventions

- Mantine v8 + `@mantine/modals`, react-icons
- AppShell layout for `/dev` and `/dashboard`
- Sidebar: collapsible (260px → 60px icon-only). State in `localStorage`.
- Logout: `modals.openConfirmModal` on dev/dashboard/profile. `/blocked` logs out directly.
- Color scheme: `index.html` reads `localStorage` before paint (no flash). Mantine persists toggle.
- Tab state: persisted in URL `?tab=` search param.

## Dev Console (`/dev`) Panels

Database tab: interactive ER diagram via `@xyflow/react`. Positions/viewport auto-saved to `localStorage`.

Project tab — 10 sub-views (grouped Select):
- **Architecture:** API Routes, File Structure, User Flow (static), Data Flow (static)
- **DevOps:** Env Variables, Test Coverage, Dependencies, Migrations
- **Live:** Sessions (auto-refresh 10s), Live Requests (WS broadcast, pause/clear)

Each sub-view: independent auto-save via `useFlowAutoSave(key)`. File nodes: double-click to open in editor.

File Health tab (`?tab=file-health`): scan seluruh file project, hitung line/char count vs limit di
`docs/FILE-HEALTH.md`, tampilkan status (ok/warn/critical/exempt) + worst offenders + progress bar.
Component: `src/frontend/components/dev/FileHealthPanel.tsx`. Endpoint: `GET /api/admin/file-health`.

## Dev Tools

- Click-to-source: `Ctrl+Shift+Cmd+C` — custom Vite plugin (`src/vite.ts`) injects `data-inspector-*` attrs
- Editor: `REACT_EDITOR` env var. `zed`/`subl` use `file:line:col`, others use `--goto file:line:col`
- HMR: Vite 8 + `@vitejs/plugin-react` v6. `dedupeRefreshPlugin` fixes double React Refresh injection
