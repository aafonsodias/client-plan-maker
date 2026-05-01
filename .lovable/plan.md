
## Goal

Make the `pt | en` switcher actually change every visible string across the rest of the app, starting with the page you're on right now (client detail → Assessment → PAR-Q+), and continuing through plan generation, plan view/edit, session log, and the remaining secondary routes.

## Scope (what's still hardcoded)

Confirmed by scan — these files have no `useTranslation` yet:

Primary (what you explicitly named):
1. `src/routes/clients_.$clientId.tsx` (1783 lines) — client detail + **Assessment** (PAR-Q+, risk strat., anthropometrics, goals, readiness, training prefs, mobility, lifestyle, nutrition), plus the **Generate plan draft** flow, plan list, intake panel.
2. `src/routes/plans.$planId.tsx` (1285 lines) — plan **view/edit** (week/day grid, exercise rows, set editor, sticky header, export PDF, regenerate, status pills).
3. `src/routes/plans.$planId.sessions.tsx` + `src/components/SessionDayView.tsx` — session detail used by trainer.
4. `src/routes/log.$token.tsx` — client-facing **log session** page.

Secondary (so the switcher is consistent everywhere):
5. `src/routes/plans.index.tsx`, `src/routes/settings.tsx`, `src/routes/billing.tsx`.
6. `src/components/ComplianceDashboard.tsx`, `src/components/DropoffAlerts.tsx`, `src/components/ValidationReport.tsx`, `src/components/IntakeLinkPanel.tsx`.

Out of scope this round: PDF locale (separate task already discussed), DB `preferred_locale` column, server-side emails.

## Approach

### 1. Namespace layout

Add three new namespaces alongside the existing `common` / `plan` / `intake`:

- `assessment` — PAR-Q+ questions, risk factor labels, anthropometrics, mobility, lifestyle, nutrition, readiness. Keys mirror the section IDs already in the code (`parq`, `risk`, `anthro`, `goal`, `readiness`, `training`, `mobility`, `lifestyle`, `nutrition`).
- `client_detail` — client header, tabs, plan list, "Generate plan draft" CTA, draft-status banners, intake link panel, compliance widgets, dropoff alerts.
- `plan_editor` — plan view/edit, sessions, set log, export, validation report.

Register them in `src/i18n/index.ts` (add to `ns` array + `resources`). Keep EN as source of truth; PT JSON sparse + falls back to EN.

### 2. Per-file edits

For every file in scope:
- Add `const { t } = useTranslation("<ns>")` (and `useTranslation(["<ns>", "common"])` where shared keys like `actions.save`, `actions.cancel`, `status.*` are needed).
- Replace literal JSX text, `placeholder=`, `aria-label=`, `title=`, `label=`, and toast strings with `t("...")`.
- For dynamic phrases like `"Week 5 of 8"` use interpolation: `t("plan.week_of", { current: 5, total: 8 })`.
- For arrays of constants (PAR-Q questions, equipment, risk factors, mobility tests) keep the **stable ID array** in code and resolve labels via `t()` at render — same pattern already used in `intake.$token.tsx`.
- Reuse `assessment.parq.q1..q7` and `intake.equipment.*` keys where the wording is identical to avoid duplication; otherwise create a new key under the right namespace.

### 3. PT translations

Draft PT for every new EN key, in tone consistent with what's already in `pt/intake.json` (informal "tu", short, trainer-facing where applicable). Keep PT JSON sparse — anything not yet translated falls back to EN automatically.

### 4. Layout safety (your constraint)

PT phrases run ~15-25% longer than EN. To prevent breakage:
- Audit buttons/pills/tabs that currently rely on a fixed width — add `whitespace-nowrap` only where overflow is acceptable, otherwise let them wrap.
- For the sticky section nav in the assessment ("PAR-Q+ · Risk strat. · Anthro · Goal · Readiness · Training · Mobility · Lifestyle · Nutrition") shorten the PT labels (e.g. "Risco", "Antropo.", "Mobilidade") and allow horizontal scroll on small viewports (already structured that way).
- For stat cards in compliance/dashboard, switch labels to `text-xs` truncation with `title=` tooltip if the PT string is too long.
- Test at the current viewport (555px) — that's where overflow shows up first.

### 5. Switcher fix verification

After each batch, confirm clicking `pt` immediately re-renders without reload (it already does for the wired pages — the issue on assessment is purely missing `t()` calls, not a switcher bug).

## Technical notes

- Don't reintroduce a second `i18n.init()`. Only `src/i18n/index.ts` initializes.
- Keep `useSuspense: false` so route components don't need a Suspense boundary.
- Where a constant array drives a `<Select>`, store IDs in a `const FOO_IDS = [...] as const` and render `t(\`assessment.foo.${id}\`)` for the label — keeps the value stable for DB writes.
- Toast messages (`toast.success(...)`, `toast.error(...)`) must also go through `t()`.
- Don't translate exercise names that are technical proper nouns (e.g. "Back Squat", "RDL") unless you already have a PT term in `plan.json` — the audit calls these out as keep-as-is.

## Execution order (per-feature commits, so partial rollback is possible)

1. Add the three namespaces + register in `i18n/index.ts` + skeleton EN/PT JSON files.
2. Wire `clients_.$clientId.tsx` Assessment sections (PAR-Q first, then risk, anthro, goal, readiness, training, mobility, lifestyle, nutrition).
3. Wire the rest of `clients_.$clientId.tsx` (header, tabs, plan list, generate-draft flow, IntakeLinkPanel, ComplianceDashboard, DropoffAlerts).
4. Wire `plans.$planId.tsx` (header, week/day grid, set editor, export, ValidationReport).
5. Wire `plans.$planId.sessions.tsx` + `SessionDayView.tsx` + `log.$token.tsx`.
6. Wire secondary routes: `plans.index.tsx`, `settings.tsx`, `billing.tsx`.

Each step is an independent commit touching only its own files + the matching JSON additions, so any single step can be reverted without affecting the others.

## Acceptance

- On `/clients/:id`, switching to `pt` translates every section header, every PAR-Q question, every risk-factor toggle, every anthropometrics field, every readiness option, the "Generate plan draft" button, and all toasts.
- On `/plans/:id`, every visible string toggles language; layout doesn't break at 555px viewport.
- On `/log/:token` (client-facing), every visible string toggles.
- `<html lang>` and `localStorage["forge.locale"]` already update — unchanged.
- Dev console shows no `[i18n] missing key` warnings on the visited pages.

## Rollback

Per-step commits as listed above. Reverting any one commit removes only that surface's i18n wiring; the rest keeps working because EN fallback is the source of truth and unrelated namespaces stay registered. Worst-case full rollback = revert commits 2–6 (keeps the three namespaces registered but inert) or revert commit 1 too (removes the namespaces entirely).
