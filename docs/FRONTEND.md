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
| `wa.tsx` | `waRoute` | `/wa` | ADMIN+SUPER_ADMIN, `validateSearch` for `?tab=` (connection\|account\|send\|messages\|policy\|verify\|sessions\|simulation). Tab `sessions` & `simulation` khusus SUPER_ADMIN |

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
- `WaConnectionPanel.tsx` — status koneksi + tombol Start/Restart/Terminate. Query `['wa','status']` GET `/api/wa/session/status`; selama state belum `CONNECTED` selalu polling 3s (transisi pairing bisa terjadi tanpa event WS final), setelah `CONNECTED` mengandalkan WS bila `wsReady` (fallback polling bila WS mati). Saat `CONNECTED` menampilkan kartu "Sesi Aktif" (`<WaAccountSummary>`) berisi nama/nomor/platform akun yang tertaut; saat belum `CONNECTED` kartu QR/pairing dengan `SegmentedControl` QR ↔ Nomor HP: mode QR menampilkan `GET /api/wa/session/qr/image`; mode Nomor HP kirim `POST /api/wa/session/pairing-code` lalu menampilkan kode pairing dengan tombol salin. (Kartu Sesi Aktif & kartu QR saling eksklusif via `connected`/`needsQr`.)
- `WaAccountSummary.tsx` — komponen bersama (dipakai tab Koneksi + tab Info Akun) yang menampilkan kartu ringkasan akun: query `['wa','account']` GET `/api/wa/account`, render Nama/Nomor/Platform. Prop `enabled?: boolean` (default `true`) menunda fetch sampai relevan. Query key sama dengan `WaAccountPanel` → TanStack Query dedup, tidak ada fetch ganda. Tipe `AccountResp` di sini (sumber tunggal).
- `src/frontend/lib/wa-pairing.ts` — helper murni (tanpa React) untuk flow pairing: `extractPairingCode` (baca varian bentuk respons container) dan `pairingCodeOrThrow` (lempar Error actionable saat container balas `HTTP 200 { success: false }`, mis. `session_not_found` — kalau tidak, kegagalan tertelan diam karena `apiFetch` hanya throw pada non-2xx). Dipakai sebagai `mutationFn` pairing agar error muncul di `pairing.error`/alert.

Tab `?tab=messages` ("Pesan", icon `TbMessages`):
- `WaMessagesPanel.tsx` — orchestrator. Query `['wa','chats']` GET `/api/wa/chats`, `['wa','verify','inbound']` GET `/api/wa/verify/inbound?limit=200`, `['wa','verify','supervisor']` GET `/api/wa/verify/supervisor`. Gabung chat+inbound via `mergeMessages`, filter klien-side via `filterMessages` (state `search` + dua `TextInput type="date"` dateFrom/dateTo). Badge `{filtered}/{total}`. Drill-down: state `activeChatId` → buka `WaChatHistoryModal`.
- `WaMessagesPollingInfo.tsx` — kartu state capture poller (prop `state: SupervisorState | undefined`): badge `running` → 'aktif'/'idle', sessionId, nomor server ter-mask, lastPollAt, lastError, pollIntervalMs. "informasi polling jika ada" — idle/null tampil status, bukan error.
- `WaMessagesList.tsx` — tabel terpadu (kolom Waktu, Sumber [badge Chat/WAV], Dari, Pesan). Baris `source:'chat'` dengan `chatId` klik → `onOpenChat`; baris WAV read-only.
- `WaChatHistoryModal.tsx` — Mantine modal riwayat satu chat. Query `['wa','messages',chatId]` GET `/api/wa/messages?chatId=` (enabled saat `chatId` ada), `messages = data?.messages ?? data?.result ?? []`. Loading + error (502) ditangani eksplisit.
- `wa-messages.types.ts` — tipe `ChatRow`, `ChatsResponse`, `ChatMessage`, `ChatMessagesResponse`, `SupervisorState`, `UnifiedMessage` (sumber tunggal, re-export `InboundLogRow`).
- `src/frontend/lib/wa-messages.ts` — helper murni (unit-testable, tanpa React): `mergeMessages(chats, inbound)` (normalisasi + urut desc, chat tanpa `lastMessage`/`t` di-skip; `lastMessage.t` epoch detik → ms) & `filterMessages(rows, { search, dateFrom, dateTo })` (search case-insensitive from+text, rentang tanggal inklusif).

Tab `?tab=policy` di `/wa` ("Aturan & Kontrak", icon `TbShieldLock`):
- `WaPolicyPanel.tsx` — orchestrator, query `['wa','policy']` GET `/api/wa/policy`. Banner oranye saat `allowFirstContact=true` (mode OTP aktif).
- `WaContractView.tsx` — render teks kontrak + tombol "Saya setuju & paham risikonya" → POST `/api/wa/policy/ack`. Saat sudah disetujui, muncul tombol "Batalkan persetujuan" (modal konfirmasi) → DELETE `/api/wa/policy/ack`.
- `WaPolicyUsage.tsx` — progress bar kuota menit/jam/hari.
- `WaPolicySettings.tsx` — form editable (SUPER_ADMIN saja, `canEdit`) → PUT `/api/wa/policy`. Termasuk kartu "Balas otomatis saat verifikasi berhasil": `Switch` (`verifyReplyEnabled`) + `Textarea` teks balasan (`verifyReplyMessage`, placeholder = teks default, disabled saat switch off) + tombol "Kembalikan ke default" (set message → `null`). Textarea kosong dikirim sebagai `null` (server pakai default).
- `wa-policy.types.ts` — tipe `WaPolicy`, `UsageSnapshot`, `PolicyResponse`, `PolicyEditable`.

Tab `?tab=account` ("Info Akun"):
- `WaAccountPanel.tsx` — kartu info akun (via `<WaAccountSummary>`) + tabel kontak dengan search box (nama/nomor) dan kolom "Foto". Query kontak `['wa','contacts']` tetap eksklusif di sini.
- `WaContactAvatar.tsx` — avatar lazy per kontak. `IntersectionObserver` (`rootMargin: '100px'`) menunda fetch sampai baris masuk viewport, lalu query `['wa','avatar',contactId]` GET `/api/wa/avatar`. Mantine `<Avatar>` fallback ke inisial nama bila `url` null.

Tab `?tab=verify` ("Verifikasi Nomor", icon `TbShieldCheck`, ADMIN+SUPER_ADMIN):
- `WaVerifyPanel.tsx` — orchestrator. Hanya baca `isSuperAdmin` dari `useSession` (tak lagi fetch consumers — tiap panel self-fetch). Render `WaVerifyGuide` + `WaVerifyConsumers` + `WaVerifyLogs` (`canEdit={isSuperAdmin}`); `WaVerifyInbound` hanya untuk SUPER_ADMIN (gate `isSuperAdmin`).
- `WaVerifyGuide.tsx` — kartu panduan statis (tanpa data fetch): menjelaskan cara kerja WAV sebagai langkah berurutan (daftar consumer → start → user kirim token → server cocokkan → app terima hasil via polling/webhook) + penjelasan mode Login vs Discovery. Ringkasan dari `docs/WA-VERIFY.md`.
- `WaVerifyConsumers.tsx` — **self-fetch** (query `['wa','verify','consumers', { search, activeFilter, page }]` GET `/api/wa/verify/consumers` dengan `limit=PAGE_SIZE&offset&search&active`) + CRUD + toolbar/pagination/bulk-select. `<WaVerifyToolbar>`: search nama (debounce 300ms) + `SegmentedControl` aktif (Semua/Aktif/Nonaktif) di slot `filters`. Kolom checkbox (header `togglePage`, baris `toggleRow` via `useRowSelection`). `<Pagination>` saat `total > PAGE_SIZE`. Bulk-delete (POST `/api/wa/verify/consumers/bulk-delete`): "Hapus terpilih (N)" kirim `{ ids }`, "Hapus semua" kirim `{ all: true }`, keduanya `modals.openConfirmModal` merah; delete single = `bulkDelete.mutate({ ids: [c.id] })`. CRUD: ikon **edit** (`TbPencil`) buka `openEditConsumerModal` (`WaVerifyConsumerEditModal.tsx`) PUT `/api/wa/verify/consumers/:id`. **Regenerate = ambil ulang full key** (server simpan hash, recopy mustahil): tombol `TbKey` confirm → POST `.../regenerate-key` → key baru sekali. Modal apiKey **once-only** + reveal webhook secret (`TbEye` → GET `.../reveal-secret`) + modal gabungan saat create. Modal & `SecretField` diekstrak ke `WaVerifyConsumerModals.tsx` (`showApiKeyModal`/`showCreatedModal`/`showSecretModal`).
- `WaVerifyLogs.tsx` — props `{ canEdit }`. Self-fetch `['wa','verify','requests', { search, status, delivery, page }]` (`refetchInterval` 30s). `<WaVerifyToolbar>`: search nama consumer + dua `Select` (status PENDING/VERIFIED/EXPIRED, delivery PENDING/DELIVERED/FAILED/DISABLED). Kolom checkbox + Aksi (replay) gated `canEdit`. Badge `STATUS_COLOR` + `DELIVERY_COLOR`, replay (`canReplay`) → POST `.../replay`. Bulk-delete POST `/api/wa/verify/requests/bulk-delete` (`{ ids }`/`{ all }`). `<Pagination>`. Nomor ter-mask dari server.
- `WaVerifyInbound.tsx` — raw inbound log (SUPER_ADMIN saja, no props → toolbar selalu `canEdit`). Self-fetch `['wa','verify','inbound', { search, matched, page }]`. `<WaVerifyToolbar>`: search dari/token + `SegmentedControl` cocok (Semua/Cocok/Tidak). Kolom checkbox + Pagination. Bulk-delete POST `/api/wa/verify/inbound/bulk-delete`. Nomor ter-mask, token terdeteksi, kolom cocok ya/tidak.
- `WaVerifyToolbar.tsx` — toolbar generik dipakai ketiga panel: `TextInput` search (`TbSearch`), slot `filters?: ReactNode`, tombol "Hapus terpilih (N)" (saat `canEdit && selectedCount>0`) + "Hapus semua" (`canEdit`, disabled saat `total===0`), `ActionIcon` refresh. Props: search/onSearchChange/searchPlaceholder/filters/selectedCount/total/canEdit/onDeleteSelected/onDeleteAll/onRefresh/refreshing/deleting.
- `WaVerifyConsumerModals.tsx` — `SecretField` + `showApiKeyModal`/`showCreatedModal`/`showSecretModal` (diekstrak dari `WaVerifyConsumers` agar tetap di bawah batas ukuran).
- `src/frontend/lib/wa-verify-selection.ts` — hook `useRowSelection()` (Set id): `selected`, `count`, `isSelected`, `toggleRow`, `togglePage(pageIds)`, `clear`, `allOnPageSelected`/`someOnPageSelected`. Dipakai ketiga panel untuk checkbox bulk-select (tanpa duplikasi logika).
- `wa-verify.types.ts` — tipe `Consumer`, `ConsumersResponse`, `VerifyRequest`, `RequestsResponse`, `InboundResponse` (ketiganya kini punya `total`), const `PAGE_SIZE`.

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

Sidebar `/dev` punya satu NavLink **"WhatsApp"** (divider "WhatsApp", `navigate` →
`/wa?tab=connection`, icon `TbBrandWhatsapp`) sebagai entry-point tunggal ke seluruh fitur
WhatsApp — panel operator (WA Sessions) & Simulasi kini jadi tab di dalam `/wa`, bukan lagi
item terpisah di `/dev`.

## Tab operator SUPER_ADMIN di `/wa`

Selain 6 tab dasar (connection/account/send/messages/policy/verify), sidebar `/wa`
menampilkan dua tab tambahan **khusus SUPER_ADMIN** di bawah divider **"Operator"**
(gated `isSuperAdmin`, di-render via `adminNavItems` + `renderTabItem`; grow section
memakai `component={ScrollArea}` agar muat saat sidebar penuh):

WA Sessions tab (`?tab=sessions`, icon `TbServer`): panel operator SUPER_ADMIN
untuk melihat **semua** sesi raw di container WhatsApp (termasuk sesi orphan) + terminate
manual per sesi. Query `['admin','wa-sessions']` GET `/api/admin/wa-sessions` (refetch 10s).
Tabel: Session ID (truncate + tooltip, monospace), Status (badge hijau bila connected),
Nomor (sudah ter-mask dari server), Nama, Mapped (badge oranye `orphan` atau email user),
Aksi Terminate (`modals.openConfirmModal` merah → POST `/api/admin/wa-sessions/:id/terminate`).
Badge ringkasan total/connected/orphan. Baris milik operator yang sedang login (sessionId =
`useSession().data.user.id`) ditandai highlight biru + badge "Sesi Anda". Component:
`src/frontend/components/dev/WaSessionsPanel.tsx`.

### Tab Simulasi Login WAV (`?tab=simulation`, `src/frontend/components/sim/`)

Tab SUPER_ADMIN di `/wa` untuk menguji alur WAV end-to-end lewat browser sebelum rilis.
Proxy server-side (API key tak ke browser); datanya juga muncul di panel Requests `/wa?tab=verify`.

- `SimLoginPanel.tsx` — orchestrator. Kartu "halaman login palsu" (input nomor = `expectedPhone`,
  tombol "Login via WhatsApp"). `useMutation` POST `/api/wa/verify/sim/start`; tampilkan QR
  (`<Image src="/api/wa/verify/sim/:id/qr">`) + tombol "Buka di WhatsApp" (`waMeUrl`) + salin token.
  `useQuery` poll `/api/wa/verify/sim/:id` `refetchInterval` 3s selama `PENDING`, `false` saat
  terminal. Banner VERIFIED (matchedPhone ter-mask) / EXPIRED. Alert jujur: deep-link hanya
  pre-fill, operator tetap tap kirim. Render `<SimEventLog>`.
- `SimEventLog.tsx` — timeline berstempel waktu tiap langkah + raw JSON per langkah + durasi total
  (log untuk developer).
- `sim.types.ts` — `SimStartResp`, `SimStatusResp`, `SimLogEntry` (sumber tunggal).
- `src/frontend/lib/sim-log.ts` — builder murni `appendLog(entries, label, data?)` + `fmtDuration(ms)`
  (unit-testable, tanpa React).

## Dev Tools

- Click-to-source: `Ctrl+Shift+Cmd+C` — custom Vite plugin (`src/vite.ts`) injects `data-inspector-*` attrs
- Editor: `REACT_EDITOR` env var. `zed`/`subl` use `file:line:col`, others use `--goto file:line:col`
- HMR: Vite 8 + `@vitejs/plugin-react` v6. `dedupeRefreshPlugin` fixes double React Refresh injection
