# Universal AI Development Lessons

Extracted from ScanTracker — a production platform built from zero coding
knowledge using AI-first development methodology.

These lessons apply to ANY project with ANY tech stack.
Add this file to your project's `.codex/skills/[project]-assistant/tasks/`
alongside your own `lessons.md`.

Last updated: 2026-03-25 | Source: ScanTracker v78.37

---

## HOW TO USE THIS FILE

Read this BEFORE starting any session.
These are real mistakes made by real AI agents on a real production project.
Every rule here cost time to learn — don't repeat them.

---

## WORKFLOW RULES

### Always Read Files Before Forming Any Opinion
- **Rule**: Always read the actual files on disk before making any architectural recommendation or plan. Never rely on memory context alone.
- **Why**: Initial plans based on memory miss the current state completely.

### Explain Architecture First — Code Never Comes First
- **Rule**: ALWAYS present the architectural plan and wait for approval before writing a single line of code. Non-negotiable.
- **Why**: Coding before approval wastes everyone's time and creates hard-to-undo changes.

### Read Implementation Files Before Writing Any Feature Code
- **Rule**: For ANY feature request, read the existing service, controller, and client files BEFORE writing anything. If it already exists, document and confirm — don't duplicate.
- **Why**: Large "implement X" requests often assume the feature doesn't exist. It usually does.

### Always Local Test Before Git Push
- **Rule**: All changes must be applied locally, built (0 errors), tested in browser, approved BEFORE any git push or deploy. Never push on build pass alone.
- **Why**: Browser verification catches UI issues that compile-only checks miss.

### Never Skip Commit Discipline
- **Rule**: Every commit MUST use Conventional Commits: `<type>(<scope>): <description>`. One logical change = one commit. Push after every session. Never accumulate 50+ uncommitted changes.
- **Why**: Bulk commits are impossible to rollback or review.

### Pre-Existing Test Failures Must Be Documented, Not Ignored
- **Rule**: When tests show a pre-existing failure unrelated to current changes, document it explicitly. Never claim "all tests pass" if any fail.
- **Why**: Hiding failures creates false confidence and blocks real debugging.

### Version Numbers Must Be Synced After Every Release
- **Rule**: After every release, run the version sync script. Never update version numbers manually in individual files.
- **Why**: Manual updates always miss at least one file, causing drift.

---

## DEBUGGING RULES

### Verify The Actual Data Before Implementing a Fix
- **Rule**: ALWAYS verify the actual data before implementing a fix. Never add defensive fallback code based on an unverified hypothesis.
- **Example**: "JWT sends wrong value" — decode the actual token first before adding workarounds.
- **Why**: Fixing the wrong diagnosis adds technical debt and wastes time.

### Cache Is the #1 Cause of "Fix Didn't Work"
- **Rule**: After ANY client-side code change, always instruct users to: (1) Log out, (2) Hard refresh `Ctrl+Shift+R`, (3) Clear cache `Ctrl+Shift+Delete`.
- **Why**: Browser/client cache serves stale assets and makes fixed code appear broken.

### Check Port Numbers Against Config, Never From Memory
- **Rule**: Always treat port numbers as potentially stale. Verify against config files before citing them.
- **Why**: Ports change during development and cached memory values cause wrong connections.

---

## CODING PATTERNS

### When Adding a New Property — Follow the Full Pipeline
- **Rule**: When adding a new field/property to a data model, follow the full checklist:
  1. Entity/model class
  2. DTO
  3. Database migration/schema
  4. Create mapping
  5. Update mapping
  6. Read/display mapping
  7. UI form field
  8. UI display/view
- **Why**: Missing any step causes the field to silently disappear at some point in the data flow.

### Search For ALL Instances Before Adding Another
- **Rule**: Before adding any UI element, search the entire file for existing renders of that same element first. Never add a duplicate without removing the original.
- **Why**: Duplicate renders (two images, two totals, two banners) confuse users and indicate incomplete changes.

### Check Nullability Before Formatting
- **Rule**: Before writing any `.ToString("format")` or formatted number call on a field, check if it's nullable. For nullable types use `(field ?? defaultValue).ToString("format")`.
- **Why**: Null format calls cause runtime exceptions that only appear in edge cases.

### When a Field Is Added to One Page — Check ALL Related Pages
- **Rule**: When adding a financial field, UI element, or business logic to one page, immediately check ALL related pages. Identical pages must stay structurally identical.
- **Why**: Features added to one page and not others cause inconsistent UX and data loss bugs.

---

## AI AGENT MEMORY RULES

### SKILL.md Is the Single Source of Truth for Agent Rules
- **Rule**: All project rules live in SKILL.md only. Never duplicate rules across multiple files (CLAUDE.md, README, etc.).
- **Why**: Duplicate rules drift apart and AI agents follow the wrong version.

### Read lessons.md At the Start of Every Session
- **Rule**: Before touching any code, read lessons.md fully and apply every rule listed there.
- **Why**: Lessons represent real mistakes. Ignoring them means repeating them.

### Write a Lesson After Every Correction
- **Rule**: After any correction from the project owner, immediately write a lesson entry BEFORE continuing. Format: Date / What went wrong / Why / Rule for next time / Category.
- **Why**: The lesson is only useful if written while the context is fresh. Delayed lessons get forgotten.

### Proof Pack Files Never Go in Root
- **Rule**: Generated proof/test output files always go in `docs/ai_memory/_generated/` — NEVER in the repo root.
- **Why**: Root-level generated files pollute the project structure and confuse git status.

### agent-brain Files Are Read-Only Mirrors
- **Rule**: Never edit `agent-brain/` files directly. Always edit `.codex/` originals. Run `sync-agent-brain.ps1` after editing.
- **Why**: Mirrors exist only for Obsidian visibility — editing them loses changes on next sync.

---

## SECURITY RULES

### Never Commit Credentials or Tokens
- **Rule**: `.gitignore` must include `.tmp_*`, `*.jwt.txt`, `.env`, `*.pfx`, `secrets.json`. Never commit authentication tokens, even expired ones.
- **Why**: Git history is permanent. Tokens committed once are exposed forever.

### Always Scope Data Queries by Owner/Tenant ID
- **Rule**: Every data query must be scoped by the current user's ownership boundary (userId, tenantId, businessId). No cross-user data access ever.
- **Why**: Missing scope checks are the most common data leakage bug in multi-user apps.

### Identity Normalization Must Be Content-Aware
- **Rule**: Identity normalization must detect the identifier type (email vs phone) before applying transformation. Never strip characters from an email thinking it's a phone number.
- **Why**: Wrong normalization blocks legitimate users from logging in.

---

## INFRASTRUCTURE RULES

### For VPS Deployments — Always Use IPv4 With Explicit Timeouts
- **Rule**: SSH/deploy commands: use `-4 -o ConnectTimeout=60 -o AddressFamily=inet`. Never rely on default IPv6 or un-timed connections.
- **Why**: IPv6 routing failures cause silent hangs that look like the deploy succeeded.

### Desktop Commander MCP Config — Backup After Install
- **Rule**: After installing Claude Desktop, immediately backup `%APPDATA%\Claude\claude_desktop_config.json`. After any reinstall, recreate it immediately.
- **Why**: Reinstall wipes the config, losing all MCP server connections.

---

## AI MEMORY ARCHITECTURE

### The 3-Layer Memory Model (Works for Any Project)
```
Layer 1 — Hot (read every session):
  SESSION_PRIMER.md     — ultra-compact fast boot
  SKILL.md              — all rules and guardrails
  lessons.md            — corrections and rules from past sessions

Layer 2 — Warm (read at session start):
  AI_CONTEXT.md         — project bootstrap and version
  LOAD_ORDER.md         — full agent boot sequence
  ARCHITECTURE_GUARDRAILS.md — hard constraints

Layer 3 — Cold (read when task requires it):
  docs/ai_memory/01_specs/  — technical deep dives
  deep-context.md           — entity and pipeline detail
```

### Agent Boot Entry Points
- Agents WITH file access: `SESSION_PRIMER.md` → `AI_CONTEXT.md` → `SKILL.md` → `lessons.md`
- Agents WITHOUT file access: copy-paste `AI_ONBOARDING_PROMPT.md`


---

## UI/UX RULES (added 2026-03-29)

### Settings Pages Must Use Visual Selectors, Not Just Dropdowns
- **Rule**: Theme mode, font family, and density settings should use visual preview cards (clickable mini-mockups), not plain dropdowns. Font size should use a slider with live preview. Auto-save on every change — no save button.
- **Why**: Every modern SaaS (Claude.ai, Notion, Slack, Linear) uses this pattern. Users need to SEE what they're picking, not read a label in a dropdown.

### User Preferences Must Apply Before App Boot
- **Rule**: Any visual preference (font size, font family, theme, layout density) must be read from localStorage and applied to `<html>` CSS custom properties BEFORE the app framework boots. Use an inline `<script>` in index.html.
- **Why**: Without this, users see a flash of default styling on every page load before their preferences kick in.

### File Import Is the #1 Integration Pattern — Not Manual Row Entry
- **Rule**: For any data import page, lead with file upload (CSV/Excel drag-and-drop) with column auto-mapping and row validation. Manual row entry is a secondary option, collapsed by default.
- **Why**: Users already have their data in spreadsheets. Retyping it row-by-row is slower than the app's own data entry forms and adds zero value.

---

## BLAZOR/MUDBLAZOR RULES (added 2026-03-29)

### MudBlazor Inline MudDialog Needs Overlay Wrapper
- **Rule**: `<MudDialog>` inside `@if (showFlag)` does NOT auto-create a modal overlay. Use `IDialogService.ShowAsync<T>()` or wrap in `<MudOverlay>` with dark background and stopPropagation on inner content.
- **Why**: Bare inline MudDialog renders in the DOM but has no backdrop, centering, or z-index management. Users see nothing when the dialog "opens".

---

## AUDIT/REPORTING RULES (added 2026-03-29)

### Never Hardcode Placeholder Values in Audit Query Services
- **Rule**: When building audit/reporting services, map every display field to its actual data source. Never use `Confidence = 0` or `Details = "Event processed"` as placeholders that ship to production.
- **Why**: Placeholder values that look like real data are invisible bugs — the page appears to work but shows meaningless information. Users lose trust in the entire audit surface.

### Audit Pages Must Cover All Active Data Layers
- **Rule**: If a system has multiple processing layers (e.g., a 6-layer learning loop), the audit page must query all layers that have production data. After implementing a new layer, immediately update the audit query service.
- **Why**: Showing data from only 2 of 6 layers gives an incomplete and misleading picture of system activity.

---

## SIDEBAR/NAVIGATION RULES (added 2026-03-29)

### Sidebar Restructures Must Diff Before/After Item Lists
- **Rule**: When restructuring navigation (sidebar, menu config), dump the full item list before AND after, then diff. Any dropped items = broken navigation to working pages.
- **Why**: Rewriting navigation from scratch instead of migrating items silently drops pages. The code, controllers, and services still work — but users can't reach them.

---

## SELF-EVOLVING SKILL SYSTEM (Memento-Style) (added 2026-03-29)

### Every Lesson Gets a Weight
- **Rule**: Every lesson entry must have `Weight: HIGH|MEDIUM|LOW`. HIGH = data loss, deploy failure, or 1+ hour wasted. MEDIUM = user-visible bug or 30+ min wasted. LOW = cosmetic or process improvement.
- **Why**: Weight lets agents prioritize which lessons to read first. A 700-line lessons.md with 10 HIGH-weight entries at the top is more useful than reading all 700 lines.

### Superseded Lessons Must Be Marked
- **Rule**: When a new lesson replaces or improves an older one, mark the old one with `Superseded by: [date] [title]`. Search tools skip superseded lessons by default.
- **Why**: Following an outdated rule is worse than following no rule. Supersession prevents agents from acting on stale corrections.

### Category Index Must Exist at Top of lessons.md
- **Rule**: lessons.md must have a machine-readable category index at the top showing counts, latest dates, and HIGH-weight counts per category. Regenerate with `evolve-skills.ps1 -IndexOnly`.
- **Why**: A flat chronological list forces agents to read everything. A category index lets them jump to relevant sections.

### Auto-Reflect After Every Commit
- **Rule**: Install a git post-commit hook that runs reflect.ps1. It checks changed files against lessons and flags relevant rules. Also runs manually with `-Deep` for comprehensive review.
- **Why**: The Memento REFLECT step catches violations early. A human might forget to check lessons; the hook never forgets.

### SKILL.md Evolves From Lessons
- **Rule**: After every 5 new lessons, run `evolve-skills.ps1` to generate a SKILL.md update prompt. Review and approve the changes. The system learns from its own corrections.
- **Why**: This is the Memento WRITE step. Skills that never update from experience stay static. The best rules are the ones extracted from real failures.
