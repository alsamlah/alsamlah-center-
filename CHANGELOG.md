# Changelog

## v2.3 (2026-04-06) - Shift Management

### Added
- **`ShiftView.tsx`** — full shift management screen (open/close shifts, cash float, live revenue, history)
- **`Shift` + `ShiftRecord`** interfaces in `supabase.ts`
- **Shift state** in `CashierSystem` — `currentShift`, `shiftHistory`, `openShift()`, `closeShift()`
- **Shift status badge** in main header — clickable, shows live green dot when shift is open
- **`🕐 المناوبة`** nav item — accessible to all roles
- **Shift summary** computed from history on close (cash/card/transfer/discount/debt/net)
- **localStorage keys** `als-shift` + `als-shift-history`
- **14 new i18n keys** in both `ar` and `en` for shift management

---

## v2.2 (2026-04-06) - Auth Flow Fixes

### Fixed
- **OAuth callback broken** — `route.ts` was calling `exchangeCodeForSession` server-side without access to PKCE code verifier (stored in browser localStorage). Now forwards code to `/auth/complete` client page
- **Auth flash** — brief `<AuthScreen needsSetup />` shown after Google login while tenant was loading. Fixed with `ctxLoading` flag in `AuthProvider`

### Added
- **`/auth/complete/page.tsx`** — client component that runs `exchangeCodeForSession` in the browser (PKCE verifier accessible)
- **`ctxLoading`** state in `auth-context.tsx` — exposed via `useAuth()`, blocks CashierSystem render until tenant context is loaded

---

## v2.1 (2026-04-06) - Multi-Device Realtime Sync

### Added
- **Realtime subscriptions** wired into `CashierSystem` — sessions, history, debts now sync across devices instantly
- **`loadDebts(tenantId)`** helper in `db.ts` — used by debts realtime callback to reload fresh state
- **`realtimeSkipRef`** — prevents infinite loop when debts realtime triggers the `syncDebts` effect
- Sessions: INSERT/UPDATE applies new session+orders; DELETE removes them
- History: INSERT prepends record with duplicate-ID guard (prevents own-device double-add)
- Debts: any change triggers full reload from Supabase + skip flag

---

## v2.0 (2026-04-05) - Multi-Tenant Supabase Phase

### Added
- **Supabase auth** — Google OAuth + email/password via `AuthScreen.tsx` and `auth-context.tsx`
- **`AuthProvider`** — wraps entire app in `layout.tsx`, provides `useAuth()` hook
- **Multi-tenant architecture** — `Tenant`, `Branch`, `TenantUser` interfaces in `supabase.ts`
- **`create_tenant_for_user` RPC** — Security Definer Supabase function for first-time tenant setup
- **`RoleSelectScreen.tsx`** — PIN-based role selection shown after Supabase auth
- **`BusinessProfile.tsx`** — Tenant name editing, logo management, branch CRUD
- **`db.ts`** — Full Supabase data layer: `loadTenantData`, sync functions, realtime subscriptions
- **Hybrid data strategy** — localStorage as instant cache, Supabase as source of truth
- **Realtime subscriptions** — sessions, history, debts all subscribe to Supabase realtime
- **`/auth/callback`** — Next.js route for Supabase OAuth redirect handling
- **Anti-flash script** in `layout.tsx` — applies theme+font before React hydrates
- **`system` theme** — auto-detects OS dark/light preference via `matchMedia`
- **`ROLE_ICONS` + `ROLE_LABELS`** constants in `defaults.ts`

### Changed
- Storage model: from 100% localStorage to hybrid (LS cache + Supabase source of truth)
- Auth model: from PIN-only to two-layer (Supabase auth → role PIN)
- `CashierSystem.tsx` — now reads from `useAuth()`, calls `loadTenantData()` on login, syncs all writes to Supabase

### Supabase Tables Added
`tenants`, `branches`, `tenant_users`, `floors`, `menu_items`, `active_sessions`, `history`, `debts`, `tenant_settings`, `invoice_counter`, `qr_orders`

---

## v1.0 (2026-04-05) - Project Initialized
- AI-first project structure bootstrapped from ScanTracker template
- Next.js 15 + React 19 + TypeScript + Tailwind CSS scaffold
- localStorage-based cashier system with PIN auth
- Session types: PS (hourly) + Match (fixed 50 SAR)
- Print system: thermal 80mm + A4 PDF
- QR order system with Supabase realtime
- SAR Symbol component (official SAMA SVG)
- Bilingual UI (Arabic RTL / English LTR)
- Theme system (dark/light)
