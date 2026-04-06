# Phase Execution Protocol

Purpose: execute every change as a controlled, bounded slice.

## Lifecycle For Every Slice
1. Read-only audit
2. Mini spec
3. Bounded implementation
4. Verification
5. Docs sync
6. Merge gate

## 1) Read-Only Audit
1. Re-read authority docs: PROJECT_SOURCE_OF_TRUTH.md, CHANGELOG.md, README.md
2. Confirm target boundary and what will be touched
3. Classify DB impact: none, read-only, write-required
4. Identify touched files and blast radius
5. Confirm no unrelated refactor is included

## 2) Mini Spec
1. Objective and non-goals
2. In-scope and out-of-scope list
3. Risk class: low, medium, or high
4. Validation commands
5. Docs that must be updated
6. Rollback plan

## 3) Bounded Implementation
1. Keep one objective per slice
2. Prefer additive change
3. Stop immediately if unplanned drift is discovered

## 4) Verification
1. Run mandatory slice gate
2. Record pass/fail with command output

## 5) Docs Sync
1. Update CHANGELOG.md for behavior changes
2. Update PROJECT_SOURCE_OF_TRUTH.md for contract changes
3. Update impacted docs/ai_memory/01_specs/ files

## 6) Merge Gate
1. Slice objective completed
2. Verification passed and recorded
3. Required docs updated
4. No out-of-scope edits

## Risk Classification
- Low: docs-only or tightly scoped non-contract internal change
- Medium: bounded behavior change, no schema/destructive action
- High: contract change, schema impact, security/auth impact

## Stop-And-Escalate Conditions
1. Scope expands beyond approved slice
2. Proof gates fail in unexpected way
3. Security or auth ambiguity appears
