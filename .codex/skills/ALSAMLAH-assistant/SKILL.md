# ALSAMLAH — AI Agent Operating Manual

---
name: ALSAMLAH-assistant
description: >
  Operational knowledge for ALSAMLAH Entertainment Center cashier system.
  Version v2.0. Stack: Next.js 15 + React 19 + TypeScript + Tailwind + Supabase.
  Use this skill for any task related to this project.
---

## Read First

Before writing code or changing docs, read in this order:

1. `AI_CONTEXT.md` — project bootstrap, version, key files
2. `SESSION_PRIMER.md` — 3 rules, key paths, auth flow
3. `CLAUDE.md` — full architecture reference
4. `tasks/lessons.md` — project-specific corrections from past sessions
5. `tasks/universal-lessons.md` — universal rules (any project)
6. This file

---

## Project Identity

| Key | Value |
| --- | --- |
| Version | v2.0 |
| Status | In development — Supabase multi-tenant phase |
| Dev URL | http://localhost:3001 |
| Start cmd | `start-dev.bat` (required — sets NODE_ENV=development) |
| DB | Supabase — darabijgoghrambaiumu.supabase.co |
| Root | `C:\Users\USER\OneDrive\Documents\alsamlah` |
| Stack | Next.js 15, React 19, TypeScript, Tailwind CSS, Supabase |

---

## Architecture

```
layout.tsx → AuthProvider (auth-context.tsx)
  └── page.tsx → CashierSystem (root state + Supabase sync)
        ├── AuthScreen        (Supabase login/signup/first-time setup)
        ├── RoleSelectScreen  (PIN entry for cashier1/cashier2/manager)
        ├── DetailView        (active session UI)
        ├── AdminView → BusinessProfile
        ├── DebtsView
        ├── StatsView
        └── QrOrdersPanel     (standalone Supabase realtime)
```

**Data flow:** State lives in CashierSystem → written to localStorage immediately → synced to Supabase async via `db.ts`

**Auth layers:**
1. Supabase (Google OAuth / email) via `auth-context.tsx`
2. Role PIN (cashier1/cashier2/manager) via `RoleSelectScreen.tsx`

---

## Guardrails — DO NOT VIOLATE

1. **Never bypass tenant isolation** — every Supabase query must have `.eq("tenant_id", tenantId)`
2. **Never block UI on Supabase** — write to localStorage first, sync async
3. **State only in CashierSystem** — no child component writes to localStorage or Supabase directly
4. **Never use ر.س or SAR text** — always use `<SarSymbol />` component
5. **Never hardcode hex colors** — always use CSS variables (`var(--accent)`, etc.)
6. **Never use `@import url()` in globals.css** — Google Fonts only via `<link>` in `layout.tsx`
7. **New translations must go in BOTH `ar` and `en`** in `settings.ts`
8. **Dev server: always `start-dev.bat`** — never `next dev` directly on Windows

---

## Dev Commands

```bash
# Start dev server (Windows — REQUIRED)
C:\Users\USER\OneDrive\Documents\alsamlah\start-dev.bat

# TypeScript check
node node_modules\typescript\bin\tsc --noEmit --project tsconfig.json

# Production build
node node_modules\next\dist\bin\next build
```

---

## Git Commit Convention (ENFORCED — ALL AGENTS)

Every commit MUST follow Conventional Commits format:
`<type>(<scope>): <description>`

Types: feat, fix, docs, chore, refactor, style, test, ci, perf
- Max 72 characters
- Lowercase only
- No period at end
- Never: "update", "fix stuff", "WIP", "changes"

---

## AI Memory Architecture Rules

- Proof outputs → `docs/ai_memory/_generated/` — NEVER in root
- Lessons → `tasks/lessons.md` — after every correction
- CLAUDE.md is the full reference — keep it current after every architectural change
- Dead file references removed immediately when file is deleted

---

## Self-Learning System

After any correction, append to `tasks/lessons.md`:

```
## 2026-04-05 — [SHORT TITLE]
- What went wrong: [description]
- Why it happened: [root cause]
- Rule for next time: [exact rule]
- Triggered by: [what was said]
- Category: [ARCHITECTURE|WORKFLOW|PATTERN|DOMAIN|PREFERENCE|TOOLING|UI]
- Weight: [HIGH|MEDIUM|LOW]
```

Read `tasks/lessons.md` at the start of EVERY session before touching code.
