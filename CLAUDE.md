# مركز الصملة للترفيه — ALSAMLAH
## Project Context for Claude (Cowork / Claude Code)

---

## 📌 Project Identity

| Field | Value |
|---|---|
| **Name (AR)** | مركز الصملة للترفيه |
| **Name (EN)** | ALSAMLAH Entertainment Center |
| **Type** | Cashier & management system (internal web app) |
| **Framework** | Next.js 15 (App Router), React 19, TypeScript |
| **Styling** | Tailwind CSS + CSS custom properties (theme variables) |
| **Storage** | Hybrid: localStorage as instant cache + Supabase as source of truth |
| **Language** | Bilingual: Arabic (default, RTL) + English (LTR) |
| **Owner** | Adil — idxmac@gmail.com |

---

## 🗂️ File Structure

```
src/
  app/
    globals.css              ← CSS variables, utility classes, animations
    layout.tsx               ← Root layout, Google Fonts, AuthProvider wrapper
    page.tsx                 ← Renders <CashierSystem /> (dynamic, no SSR)
    order/[room]/page.tsx    ← Public QR order page for customers
    auth/callback/           ← Supabase OAuth redirect (forwards code to /auth/complete)
    auth/complete/           ← Client-side PKCE code exchange (browser has verifier)
  components/
    CashierSystem.tsx        ← ROOT component — all state lives here
    AuthScreen.tsx           ← Supabase login/signup/tenant-setup screen
    RoleSelectScreen.tsx     ← PIN-based role selection (after Supabase auth)
    LoginScreen.tsx          ← Legacy PIN login (kept for reference)
    DetailView.tsx           ← Active item view: timer, bill, orders, end session, print modal
    AdminView.tsx            ← Manager-only: prices, menu, pins, settings, logo, danger
    BusinessProfile.tsx      ← Tenant name, logo, branch management
    ShiftView.tsx            ← Shift management: open/close, cash float, history
    DebtsView.tsx            ← Debt management with partial payments + print
    StatsView.tsx            ← Revenue reports and analytics
    QrOrdersPanel.tsx        ← Real-time QR order monitoring (Supabase realtime)
    SarSymbol.tsx            ← Official SAMA SAR (﷼) symbol SVG component
  lib/
    supabase.ts              ← TypeScript interfaces + Supabase client
    auth-context.tsx         ← AuthProvider, useAuth hook, tenant context loading
    db.ts                    ← Supabase data layer (load, sync, realtime)
    defaults.ts              ← DEFAULT_FLOORS, DEFAULT_MENU, ROLE_ICONS, ROLE_LABELS, constants
    settings.ts              ← Themes, fonts, i18n (T object), SystemSettings
    utils.ts                 ← uid(), fmtTime(), fmtMoney(), fmtD(), fmtDate()
    printReceipt.ts          ← Thermal (80mm) + A4 PDF print templates
    defaultLogo.ts           ← Exports DEFAULT_LOGO_PATH = "/logo.png"
public/
  logo.png                   ← Built-in ALSAMLAH logo (1500×560px, PIL-generated)
CLAUDE.md                    ← This file (project context)
SAR_SYMBOL_LESSON.md         ← Lesson on using the official SAMA SAR SVG
NEXTJS15_CSS_LESSON.md       ← Lesson: CSS/Turbopack bug fix (Next.js 15.5 + Windows)
start-dev.bat                ← Windows dev server launcher (sets NODE_ENV=development)
```

---

## 🏗️ Architecture — State & Data Flow

```
layout.tsx
└── AuthProvider (src/lib/auth-context.tsx)
    └── CashierSystem (root)
        ├── Checks supabaseReady + isAuthenticated
        ├── If not authenticated → <AuthScreen />
        ├── If authenticated but no user (role) → <RoleSelectScreen />
        ├── Loads TenantData from Supabase via loadTenantData()
        │
        ├── all useState lives here
        ├── syncs to localStorage + Supabase on every write
        │
        ├── DetailView           ← session, orders, calc, logo, getInvoiceNo, onEndSession...
        ├── AdminView            ← floors, menu, pins, settings, logo, setLogo
        │   └── BusinessProfile  ← tenant name, branches, logo management
        ├── ShiftView            ← currentShift, shiftHistory, onOpen, onClose, now
        ├── DebtsView            ← debts, setDebts, logo
        ├── StatsView            ← history, debts, sessions
        ├── QrOrdersPanel        ← standalone (uses Supabase realtime)
        └── history view         ← inline in CashierSystem, print buttons included
```

**Key rules:**
- No child component manages its own persistent state — all state is lifted to `CashierSystem`
- Every write goes to localStorage immediately (instant UI), then syncs to Supabase in background
- On load: Supabase data takes priority over localStorage

---

## 🔐 Auth System — Two-Layer Login

### Layer 1: Supabase Auth (`AuthScreen.tsx` + `auth-context.tsx`)
- Google OAuth or email/password via Supabase
- `AuthProvider` wraps the entire app in `layout.tsx`
- `useAuth()` hook exposes: `supabaseReady`, `isAuthenticated`, `appCtx`, `signOut`, `createTenant`, etc.
- First-time users: `AuthScreen` shows "setup" mode → calls `createTenant()` RPC
- `create_tenant_for_user` is a **Security Definer RPC** (bypasses RLS for new users who have no tenant yet)
- After auth: `loadAppContext()` fetches `tenant_users` → `tenants` → `branches` and builds `AppContext`

### Layer 2: Role PIN Login (`RoleSelectScreen.tsx`)
- After Supabase auth, user picks a role (cashier1 / cashier2 / manager) and enters PIN
- 3 roles: `cashier1`, `cashier2`, `manager` — PINs stored in `tenant_settings` on Supabase
- Manager-only features: AdminView, delete debts, clear history/debts
- Role session stored in `als-user` localStorage

### Auth Flow
```
App loads → AuthProvider checks Supabase session
  → not authenticated → AuthScreen (Google / email login / signup / first-time setup)
  → authenticated, no appCtx → AuthScreen (setup mode to create tenant)
  → authenticated + appCtx, no role → RoleSelectScreen (PIN entry)
  → authenticated + role selected → CashierSystem main UI
```

---

## 🗄️ Supabase Tables

| Table | Description |
|---|---|
| `tenants` | Business identity (name_ar, name_en, logo_url) |
| `branches` | Physical locations per tenant |
| `tenant_users` | Links Supabase user → tenant + branch + role |
| `floors` | Floor/zone/item structure per tenant (JSONB `data` column) |
| `menu_items` | Coffee shop menu per tenant (JSONB `data` column) |
| `active_sessions` | Live sessions per tenant, keyed by item_id |
| `history` | Completed sessions per tenant (JSONB `data` column) |
| `debts` | Debt records per tenant (JSONB `data` column) |
| `tenant_settings` | Pins, role_names, settings JSONB per tenant |
| `invoice_counter` | Auto-incrementing invoice number per tenant |
| `qr_orders` | Customer QR orders (room_id, item, qty, status) |

### Supabase RPC
- `create_tenant_for_user(p_name_ar, p_name_en)` — SECURITY DEFINER, creates tenant + branch + tenant_user atomically for new users

---

## 💾 localStorage Keys (Cache Layer)

| Key | Type | Description |
|---|---|---|
| `als-floors` | `Floor[]` | Floor/zone/item structure + prices |
| `als-menu` | `MenuItem[]` | Coffee shop menu |
| `als-sessions` | `Record<string, Session>` | Active sessions keyed by itemId |
| `als-orders` | `Record<string, OrderItem[]>` | Orders per item |
| `als-history` | `HistoryRecord[]` | Completed sessions |
| `als-debts` | `Debt[]` | Debt records |
| `als-pins` | `Record<UserRole, string>` | Login PINs (cache of tenant_settings) |
| `als-role-names` | `Record<UserRole, string>` | Display names (cache of tenant_settings) |
| `als-user` | `UserLogin` | Logged-in role within tenant |
| `als-settings` | `SystemSettings` | Theme, font, lang, fontSize (cache of tenant_settings) |
| `als-logo` | `string` (base64 data URL) | Logo image |
| `als-invoice-counter` | `string` (number) | Auto-incrementing invoice number (cache) |
| `als-shift` | `Shift \| null` | Currently open shift (id, openedAt, openedBy, cashFloat) |
| `als-shift-history` | `ShiftRecord[]` | Closed shift records with summaries |

---

## 🧩 TypeScript Interfaces (`src/lib/supabase.ts`)

```typescript
// Multi-tenant
interface Tenant { id, name_ar, name_en, logo_url, created_at, updated_at }
interface Branch { id, tenant_id, name, address, is_active, is_main, created_at }
interface TenantUser { id, tenant_id, branch_id, user_id, role, display_name, created_at }
interface AppContext { tenant: Tenant, branch: Branch | null, tenantUser: TenantUser, supabaseUser }

// Auth
type UserRole = "cashier1" | "cashier2" | "manager"

// Core data
interface Session { startTime, customerName, durationMins, graceMins, playerCount, sessionType? }
interface Zone { id, name, icon, pricePerHour, minCharge, items[] }
interface Floor { id, name, zones[] }
interface HistoryRecord { id, itemId, itemName, zoneName, customerName, startTime, endTime,
  duration, timePrice, orders, ordersTotal, total, payMethod, debtAmount, discount,
  graceMins, playerCount, cashier, sessionType? }
interface Debt { id, name, phone, amount, paidAmount, payments[], note, date, paid }
interface CalcResult { remaining, elapsed, progress, timePrice, ordersTotal, total,
  isOvertime, isOpen, graceMins }
interface QrOrder { id, room_id, room_name, item_name, item_icon, item_price, qty, status, customer_note, created_at }
```

---

## 🗃️ Data Layer (`src/lib/db.ts`)

Strategy: **localStorage as instant cache + Supabase as source of truth**

```typescript
// Load (Supabase first, localStorage fallback)
loadTenantData(tenantId, branchId): Promise<TenantData>

// Sync writes (LS immediately + Supabase in background)
syncFloors(tenantId, branchId, floors)
syncMenu(tenantId, branchId, menu)
syncSession(tenantId, branchId, itemId, session, orders)
deleteSession(tenantId, itemId)
addHistoryRecord(tenantId, branchId, record)
clearHistory(tenantId)
syncDebts(tenantId, branchId, debts)
syncSettings(tenantId, settings, pins, roleNames)
getAndIncrementInvoice(tenantId): Promise<number>

// Tenant/branch management
updateTenant(tenantId, updates)
getBranches(tenantId): Promise<Branch[]>
upsertBranch(tenantId, branch)
deleteBranch(branchId)

// Realtime subscriptions
subscribeToSessions(tenantId, cb)
subscribeToHistory(tenantId, cb)
subscribeToDebts(tenantId, cb)
```

---

## ⚙️ Key Constants (`src/lib/defaults.ts`)

```typescript
MATCH_PRICE   = 50          // Fixed SAR price for match sessions
MATCH_ZONE_ID = "rooms"     // Only zone that supports match sessions
ROOM_10_ID    = "room-10"   // Chairs room — coffee warning shown for match

DURATION_OPTS = [30, 60, 120, 180, 0]  // mins (0 = open)
PLAYER_COUNTS = [1, 2, 3, 4, 5, 6, 7, 8]
ROLE_ICONS    = { cashier1: "🎮", cashier2: "🕹️", manager: "👑" }
ROLE_LABELS   = { cashier1: "كاشير ١", cashier2: "كاشير ٢", manager: "مدير" }
```

**Default floors (cannot be deleted, only prices changed):**
- **الطابق الأول:** غرف (10 rooms, PS5), بلياردو (3), شطرنج (2), بلوت (1), بوكسينج (1)
- **الطابق الثاني:** بلياردو (2), تنس طاولة (4), بلوت (2), جلسة أرضية (2)

**Default prices (SAR/hour):**
- غرف PS5: 20 | بلياردو: 40 | شطرنج: 15 | بلوت: 20 | بوكسينج: 25 | تنس: 25 | جلسة أرضية: 30

---

## 🎮 Session Types

### PlayStation Session (`sessionType: "ps"`)
- Hourly pricing: `Math.ceil((billMins / 60) * pricePerHour)`
- Minimum charge applies (`minCharge` in minutes)
- Duration options: 30m / 1h / 2h / 3h / مفتوح (open)
- Grace minutes: cashier can add +5/+10/+15 free mins
- Progress bar shows time remaining

### Match Session (`sessionType: "match"`)
- Fixed price: **50 SAR** flat (regardless of duration)
- Always open-ended — cashier closes manually
- Available only in **غرف zone** (`id: "rooms"`)
- No progress bar shown
- Timer counts up (green color)
- Room 10 (`room-10`) → shows yellow warning: "تنبيه: اشتراط طلب من الكوفي شوب"
- Player count tracked (updatable mid-session)

### `calcTotal(itemId)` Logic
```typescript
if (sess.sessionType === "match") {
  return { timePrice: MATCH_PRICE, isOpen: true, progress: -1, ... }
}
// else: hourly calculation with grace, minCharge, overtime
```

---

## 🎨 Theming System (`src/lib/settings.ts` + `globals.css`)

All colors use CSS custom properties set on `document.documentElement`:

```css
var(--bg)         /* page background */
var(--surface)    /* card background */
var(--accent)     /* primary brand color (blue-purple) */
var(--green)      /* success, match sessions */
var(--red)        /* danger, overtime */
var(--yellow)     /* warnings */
var(--blue)       /* player count, info */
var(--text)       /* primary text */
var(--text2)      /* secondary/muted text */
var(--border)     /* borders */
var(--input-bg)   /* input fields background */
var(--nav-bg)     /* nav background (with blur) */
```

Themes: `dark` | `light` | `system` (auto-detects OS preference via `matchMedia`).
Set via `document.documentElement.setAttribute("data-theme", ...)`.
Font scale set via `--font-scale` CSS variable (0.9 / 1.0 / 1.1).

Anti-flash script in `layout.tsx` applies theme+font BEFORE React hydrates.

---

## 🌐 i18n (`src/lib/settings.ts` → `T` object)

```typescript
const t = T[settings.lang]   // "ar" | "en"
const isRTL = settings.lang === "ar"
```

All user-facing strings come from `t.keyName`. Both `ar` and `en` must have the same keys. When adding new features, always add translations to **both** language objects.

---

## 🖨️ Print System (`src/lib/printReceipt.ts`)

```typescript
import { printSession, printDebt, type PrintType } from "@/lib/printReceipt"
type PrintType = "thermal" | "a4"
printSession(data: SessionPrintData, type: PrintType)
printDebt(data: DebtPrintData, type: PrintType)
```

**How it works:** Opens a new `window.open()` popup, writes full HTML string, calls `window.print()` after 700ms delay. Thermal = 80mm receipt, A4 = professional invoice.

**Print triggers:**
1. **End session** → print modal appears (thermal / A4 / skip), then `onEndSession()` is called
2. **History cards** → 🖨️ thermal + 📄 A4 buttons
3. **Debt cards** → 🖨️ + 📄 buttons in expanded debt view

---

## 🪙 SAR Symbol (`src/components/SarSymbol.tsx`)

Official SAMA Saudi Riyal symbol. **Never use ر.س or text substitutes.**

```tsx
<SarSymbol size={16} className="..." />
```

- ViewBox: `0 0 1124.14 1256.39` (official SAMA paths)
- Width calculated as `size * (1124.14 / 1256.39)` to maintain aspect ratio
- Use `verticalAlign: "-0.15em"` for inline alignment

---

## 🖼️ Logo System

- **Built-in logo:** `/public/logo.png` (1500×560px, magenta/gold gradient)
- **AdminView → BusinessProfile tab:** Upload custom / use built-in / clear
- **Storage:** Base64 data URL in `als-logo` localStorage key; `logo_url` on tenant row in Supabase
- **Display:** Shown in sidebar header + main header when set; embedded in print receipts

---

## 📱 QR Order System

- Customer-facing page: `/order/[room]` (no login required)
- Uses **Supabase** realtime subscription for live order updates
- Table: `qr_orders` with fields: `room_id`, `room_name`, `item_name`, `item_icon`, `item_price`, `qty`, `status`, `customer_note`
- Statuses: `pending` → `accepted` / `rejected` → `delivered`
- `QrOrdersPanel.tsx` shows incoming orders for cashier to approve

---

## 🎨 CSS Utility Classes (`globals.css`)

```css
.btn            ← Base button (border, padding, transition)
.btn-primary    ← Accent colored
.btn-success    ← Green
.btn-danger     ← Red
.btn-ghost      ← Subtle
.card           ← Rounded panel with border + background
.card-active    ← Green-tinted card (active session)
.card-danger    ← Red-tinted card (overtime)
.input          ← Styled input/select
.badge          ← Small inline label
.progress-bar   ← Track div
.progress-fill  ← Fill div
.anim-fade      ← Fade in animation
.anim-fade-up   ← Fade + slide up
.anim-scale     ← Scale in
.anim-pulse     ← Pulsing dot
.app-shell      ← Grid layout (nav + main)
.app-nav        ← Desktop sidebar
.app-main       ← Main content area
.mobile-nav     ← Bottom nav (hidden on desktop via @media)
```

---

## 🧮 Utility Functions (`src/lib/utils.ts`)

```typescript
uid()                    → random string ID
fmtTime(timestamp)       → "٠٩:٣٠ م" (Arabic locale time)
fmtDate(timestamp)       → "٥ أبريل ٢٠٢٦"
fmtMoney(amount)         → number formatted (no decimals if whole)
fmtD(milliseconds)       → "٠١:٢٣:٤٥" duration HH:MM:SS
```

---

## ⚠️ Important Rules & Conventions

1. **Always use `SarSymbol` component** — never type ر.س or SAR text
2. **All new translations** must be added to BOTH `ar` and `en` in `T` object in `settings.ts`
3. **State lives in CashierSystem** — children receive props, never create their own persistent state
4. **RTL/LTR**: Use `isRTL` variable + `dir={isRTL ? "rtl" : "ltr"}` on containers
5. **Colors**: Always use CSS variables (`var(--accent)`) — never hardcode hex
6. **color-mix()** for tinted backgrounds: `color-mix(in srgb, var(--accent) 12%, transparent)`
7. **TypeScript**: Run `node node_modules\typescript\bin\tsc --noEmit` to verify
8. **Match sessions**: `durationMins: 0`, `sessionType: "match"`, fixed 50 SAR, no grace buttons, no progress bar
9. **Print popups**: May be blocked by browser — user needs to allow popups
10. **Logo**: Never hardcode — always load from `als-logo` localStorage or fetch `/logo.png` at runtime
11. **Google Fonts**: Never use `@import url(...)` in `globals.css` — always load via `<link>` in `layout.tsx`
12. **Dev server**: Always run via `start-dev.bat` — never run `next dev` directly on this Windows machine
13. **Supabase writes**: Always write to localStorage first, then Supabase async — never block UI on Supabase
14. **New tenant users**: Must use `create_tenant_for_user` RPC — never insert directly (RLS blocks it)
15. **appCtx**: Always check `appCtx` is non-null before calling any `db.ts` function
16. **Realtime sync is MANDATORY**: Every new feature that stores data MUST have full realtime sync (see pattern below). The manager monitors everything remotely — any data that doesn't sync is invisible and broken.
17. **Skip flags prevent race conditions**: Every realtime subscription callback must set `realtimeSkipRef.current.feature = true` before `setState`, and every sync useEffect must check this flag. Without this, saves disappear within milliseconds.

---

## 🔄 Common Development Patterns

### ⚡ Adding a new synced data type (CRITICAL — follow every step)

Every new data type MUST include full realtime sync. Incomplete sync = broken feature.

1. **Supabase table**: Create with RLS + `ALTER PUBLICATION supabase_realtime ADD TABLE {table}`
2. **`supabase.ts`**: Add TypeScript interface
3. **`db.ts`**: Add `sync{Feature}()`, `load{Feature}()`, `subscribeTo{Feature}()`
4. **`CashierSystem.tsx`**:
   a. `useState` + `localStorage` restore in init useEffect
   b. Set from `loadTenantData()` response
   c. `saveLS` useEffect for localStorage cache
   d. Sync useEffect with **skip flag check**:
      ```typescript
      useEffect(() => {
        if (!tenantId || dbLoading) return;
        if (realtimeSkipRef.current.feature) { realtimeSkipRef.current.feature = false; return; }
        syncFeature(tenantId, branchId, data).catch(() => {});
      }, [data, tenantId]);
      ```
   e. Subscription in realtime useEffect with **skip flag set**:
      ```typescript
      const sub = subscribeToFeature(tenantId, () => {
        loadFeature(tenantId).then((fresh) => {
          realtimeSkipRef.current.feature = true;
          setFeature(fresh);
        }).catch(() => {});
      });
      ```
   f. Add `sub.unsubscribe()` to cleanup
   g. Add key to `realtimeSkipRef` initial value
5. **Test**: Change on device A → appears on device B within 1-2 seconds

### Adding a new view/tab in AdminView
1. Add tab to `tabs` array with `{ id: "...", label: "emoji label" }`
2. Add `{tab === "..." && (<div>...</div>)}` block
3. Add translation keys to both `ar` and `en` in `settings.ts`

### Adding a new session field
1. Add to `Session` interface in `supabase.ts`
2. Set in `startSession()` in `CashierSystem.tsx`
3. Save in `setHistory()` call inside `endSession()`
4. Display in `DetailView.tsx` active session view

### Adding a new Supabase sync
1. Add write function to `db.ts` (LS first, then Supabase)
2. Call from `CashierSystem` after state update
3. Add to `loadTenantData()` for initial load

---

## 📦 Package Info

```json
{
  "next": "^15",
  "react": "^19",
  "@supabase/supabase-js": "latest",
  "tailwindcss": "^3"
}
```

**Dev commands:**
```bash
# ✅ Start dev server (Windows — sets NODE_ENV=development)
C:\Users\USER\OneDrive\Documents\alsamlah\start-dev.bat

# TypeScript check
node node_modules\typescript\bin\tsc --noEmit --project tsconfig.json

# Production build
node node_modules\next\dist\bin\next build
```

> ⚠️ **مهم:** لا تستخدم `npm run dev` مباشرة — PowerShell يمنع تشغيل `.ps1`.
> راجع `NEXTJS15_CSS_LESSON.md` لفهم سبب ضرورة `NODE_ENV=development`.

---

## 🔮 Future / Planned Features

- [x] ~~Supabase DB sync (replace localStorage)~~ ✅ DONE — hybrid sync in db.ts
- [x] ~~Multi-tenant architecture~~ ✅ DONE — tenants/branches/tenant_users
- [x] ~~Multi-device real-time sync~~ ✅ DONE — sessions/history/debts realtime subscriptions wired in CashierSystem
- [x] ~~Shift management~~ ✅ DONE — ShiftView.tsx, open/close/history, manager-only close
- [x] ~~WhatsApp receipt sharing~~ ✅ DONE — share button in end-session modal (DetailView)
- [ ] Barcode/QR scanner for quick item selection
- [ ] Customer loyalty system

---

*Last updated: 2026-04-06 | Project root: `C:\Users\USER\OneDrive\Documents\alsamlah` | Dev port: 3001*
