# ALSAMLAH — Session Primer

Version: v2.0 | Status: In Development | Updated: 2026-04-05

---

## What Is This Project

مركز الصملة للترفيه — Entertainment center cashier & management system (internal web app).
Stack: Next.js 15 + React 19 + TypeScript + Tailwind CSS + Supabase

---

## The 3 Rules You Must Never Break

1. **Never write directly to Supabase from UI** — always update localStorage first, then sync async via `db.ts` functions
2. **Never bypass multi-tenant isolation** — every Supabase query must be scoped by `tenant_id`
3. **All persistent state lives in CashierSystem** — child components receive props only, never manage their own localStorage/Supabase state

---

## Before You Write One Line of Code

- [ ] Read `.codex/skills/ALSAMLAH-assistant/SKILL.md`
- [ ] Read `.codex/skills/ALSAMLAH-assistant/tasks/lessons.md`
- [ ] Read `CLAUDE.md` for full architecture reference
- [ ] Explain your approach and get approval first
- [ ] Follow implementation sequence defined in SKILL.md

---

## Key Paths

| What | Where |
| --- | --- |
| App (dev) | http://localhost:3001 |
| DB | Supabase — darabijgoghrambaiumu.supabase.co |
| Root | `C:\Users\USER\OneDrive\Documents\alsamlah` |
| Start cmd | `start-dev.bat` (sets NODE_ENV=development — required on Windows) |
| Operating manual | `.codex/skills/ALSAMLAH-assistant/SKILL.md` |
| Lessons | `.codex/skills/ALSAMLAH-assistant/tasks/lessons.md` |
| Full context | `CLAUDE.md` |

---

## Auth Flow (Two Layers)

```
Supabase auth (Google OAuth / email) → tenant role PIN → main app
```

- `AuthScreen.tsx` handles Supabase login/signup/first-time tenant setup
- `RoleSelectScreen.tsx` handles PIN entry for cashier1 / cashier2 / manager
- `auth-context.tsx` — `AuthProvider` + `useAuth()` hook
- `create_tenant_for_user` — Security Definer RPC for new users

## Data Layer

- `db.ts` — all Supabase reads/writes + realtime subscriptions
- `loadTenantData(tenantId, branchId)` — called on login, Supabase first / LS fallback
- All sync functions: `syncFloors`, `syncMenu`, `syncSession`, `syncDebts`, `syncSettings`, etc.

---

## Before Every Commit

Format: `<type>(<scope>): <description>`
Types: feat, fix, docs, chore, refactor, style, test, ci, perf
Never: "update", "fix stuff", "WIP", "changes"

## Before Every Merge

```bash
node node_modules\typescript\bin\tsc --noEmit --project tsconfig.json
node node_modules\next\dist\bin\next build
```

---

## After Every Change

- [ ] Update `CHANGELOG.md`
- [ ] Update `CLAUDE.md` if architecture changed
- [ ] Update `PROJECT_SOURCE_OF_TRUTH.md` if DB schema/contracts changed
- [ ] Proof outputs go in `docs/ai_memory/_generated/` — NEVER in root
