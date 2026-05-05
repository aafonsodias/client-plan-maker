## What you're asking

Take the header strip from `/clients/$clientId` (avatar · name · phase pill · ACSM/recovery chips · ProtocolRail · plan title/block/week · PDF · compliance · last block summary) and fold it into the dashboard player card so the list itself becomes the cockpit. No mandatory extra page just to read where a client stands.

## Honest redteam first

The detail route is ~4,200 lines. It hosts:
- Assessment form (PAR-Q, SMART, movement screens, measurements, photos)
- BriefEditor, BlueprintEditorPanel, MicrocyclePanel, ProgressionsPanel
- Logbook timeline, ClientDocuments, IntakeLinkPanel, reassessment sheet
- Block transition + next-block flow

Cramming all of that into a card on `/dashboard` is dishonest — the page would scroll forever and the list stops being scannable. So the plan is **two-tier**:

1. **Player card becomes the read-mode cockpit** — everything in your screenshot (protocol rail, plan header, PDF, compliance, reassessment chip) lives inline on the dashboard, expanded on click. No need to leave the list to *check* a client.
2. **Detail route stays as the build/edit surface** — opened only when actively editing assessment, brief, blueprint, microcycle, progressions, or logging. Linked from the card as "Abrir editor" rather than the default destination.

That keeps your "1 protocol, 1 page" principle for **viewing**, and avoids pretending we shrunk a 4k-line builder into 200px.

## What ships this round

### 1. Expand `ClientPlayerCard` into an accordion item

`src/components/ClientPlayerCard.tsx`:
- Wrap the existing row in a `<Collapsible>` (shadcn). Click the row to expand instead of navigate. Avatar/name/phase pill/status line stay in the **always-visible header**.
- Add a chevron on the right (replacing the current `ArrowRight`).
- When expanded, render a new `<ClientCockpit>` block underneath.

### 2. New `src/components/ClientCockpit.tsx` (read-mode mirror)

Pure presentational. Props: `{ client, phase, plan, latestSession, assessmentPct, lastAssessmentAt, recoveryScore, acsmRisk, briefApproved, blueprintApproved, microcycleApproved, progressionsApproved }`.

Renders, in order:
- ACSM + Recovery chips (reuse existing components from detail page — extract if inline)
- `<ProtocolRail bare />` (already supports `bare` mode — just feed props)
- Plan header strip: `Bloco N · Semana X de Y · FASE` + PDF download button (reuse `downloadPlanById`)
- `<ComplianceDashboard planId=… compact />` — add a `compact` prop that hides headings and shrinks padding
- Last block transition summary (when `block_number > 1`)
- Action row (right-aligned, quiet): `Abrir editor` (→ `/clients/$clientId`), `Logbook` (→ `/clients/$clientId/year`), `Reavaliar` (opens `<ReassessmentSheet>` inline), `Mais ações` dropdown

No editing surfaces. No StageCards. No BriefEditor. Those stay on the detail route.

### 3. Dashboard loader additions

`src/routes/dashboard.tsx`:
- Already loads `planByClient` and `logsByClient`. Extend the load to also fetch per client:
  - latest `assessments` row → `assessmentPct` (reuse existing helper) + `lastAssessmentAt`
  - `recoveryScore` (latest from wherever the detail page reads it — locate via `rg`)
  - `acsmRisk` (derive from BMI/BP — reuse `src/lib/blood-pressure.ts` + assessment fields)
  - approval flags: `brief_approved_at`, `blueprint_approved_at`, `microcycle_approved_at`, `progressions_approved_at` from `workout_plans`
- Pass into `<ClientPlayerCard>` → `<ClientCockpit>`.
- Cap eager-fetch: only fetch cockpit data for cards that are expanded (lazy on first open) to keep the list snappy. Track expanded state in dashboard component.

### 4. Detail route: lower its profile

`src/routes/clients_.$clientId.tsx`:
- Header strip (the part now duplicated on the dashboard card) collapses by default into a thin "Voltar à lista" + name + phase pill bar. The page becomes the **builder/editor**, scrolling straight to the stage that needs work.
- No content removed — just header chrome trimmed so the route stops competing with the cockpit. Zero risk to existing flows.

### 5. i18n

Add to `src/i18n/locales/{pt,en}/common.json` under `clients.cockpit.*`:
- `open_editor`, `open_logbook`, `more_actions`, `reassess`, `pdf`, `last_block_summary`

PT in "você" voice, EN neutral.

## Explicit NOTs

- No new route. No `/clients/$id/cockpit`.
- No moving BriefEditor/Blueprint/Microcycle/Progressions/Assessment into the card. Builders stay on the detail page until they're individually refactored into sheets (separate future round).
- No removing the detail route. Just demoting it from "default destination" to "editor".
- No new DB columns.

## Files

Created:
- `src/components/ClientCockpit.tsx`

Edited:
- `src/components/ClientPlayerCard.tsx` (accordion + cockpit slot)
- `src/routes/dashboard.tsx` (loader extensions + expanded-state tracking)
- `src/routes/clients_.$clientId.tsx` (header trim only)
- `src/components/ComplianceDashboard.tsx` (add `compact` prop)
- `src/i18n/locales/pt/common.json`, `src/i18n/locales/en/common.json`

## Acceptance

- `/dashboard` row click → expands in place, shows protocol rail + plan header + PDF + compliance, mirroring the screenshot.
- Reassessment chip in the rail still works (opens sheet inline from the card).
- "Abrir editor" link still goes to detail page for actually editing.
- Mobile 375px: cockpit stacks cleanly, no horizontal scroll.
- All copy through `t()`.
