
# Phase 2 — Polish, bot realism, and guide AI

Five focused workstreams. All are additive; no schema breakages. We keep tone consistent (status palette, emerald = ready, amber = warn) and reuse existing components.

## 1. "Assessment" drawer on the plan page

On `/plans/$planId`, add a header button **"Avaliação"** next to Share / Export PDF / Branding. It opens a side `Sheet` showing the latest assessment for the plan's client — read-only, scrollable, summarized like the maquette tab:

- Persona chip if it's a demo client (reads `assessments.extended.demo_meta.archetype`)
- Risk category + ACSM tier pill (reuse `riskCategory` logic from client page; extract to `src/lib/assessment-summary.ts`)
- Goal, experience, days/week, session minutes, equipment chips, injuries, meds, PAR-Q+ flags
- "Open full assessment" link → `/clients/{clientId}` anchored to the assessment section

New file: `src/components/PlanAssessmentSheet.tsx`. Wire it in the plan header (`src/routes/plans.$planId.tsx` around the Share/Export row).

## 2. Collapse the post-finalization assessment + kill the redundant red button

Today, after the plan is `ready`, the client page still shows the full assessment form and the prominent "Generate" button. We change that:

- When a finalized plan exists for the client (any `workout_plans.status = 'ready'`), replace the entire assessment block + generate button with a single collapsed line:
  - `Avaliação · 12 May 2026 · ACSM moderate · Goal: hypertrophy · 4×/week · [Persona: cardiac_rehab if demo]`
  - Right-aligned: `Open plan →` and a chevron to expand the read-only assessment inline
- Remove the "Regenerate" / red destructive button entirely from this collapsed state. (Re-generation lives only on the plan page via the existing "Regenerate with feedback" dialog.)
- Expanded view = current form, but rendered read-only (`disabled` inputs) with an "Edit assessment" toggle that re-enables fields. No silent data loss.

Implementation: a `<FinalizedAssessmentSummary />` component gated on `hasReadyPlan`, mounted at the top of the assessment section in `src/routes/clients_.$clientId.tsx`. The existing form stays mounted but collapsed inside a `<Collapsible>`.

## 3. Richer demo-bot session logs (weight + RPE + 1 complaint)

Current `fabricateEntry` only writes weight + RPE-as-note. We upgrade it so each demo session looks like a real client used the log:

- Always populate `actual.weight` (kg), `actual.reps`, `actual.rpe` (separate field, not just notes)
- Distance/time fields filled when the planned exercise is `cardio | conditioning | carry`
- 1 in 3 sessions includes a `client_feedback` entry with one of:
  - **Question** — "Posso trocar X por Y? Doi-me o ombro nesta semana."
  - **Complaint** — "Última série não consegui acabar, RPE 10."
  - **Stress signal** — "Dormi mal, sessão pesada."
- These go into a new JSONB column `workout_sessions.client_feedback` (nullable) so we can render them in the trainer inbox later.

Migration: `ALTER TABLE workout_sessions ADD COLUMN client_feedback JSONB NULL;`

Files touched:
- `src/server/demo-sessions.functions.ts` — expand `fabricateEntry`, add `maybeFeedback(persona)` helper. Persona pulled from latest assessment's `extended.demo_meta.archetype` so a `cardiac_rehab` bot complains about chest tightness while a `powerlifter` complains about elbow tendinopathy.
- `src/server/demo-oneshot.functions.ts` — also call the upgraded seeder.
- New `src/lib/demo-personas.ts` — shared archetype → feedback templates.

Trainer inbox surface: tiny badge on the client row (`clients.tsx`) when any of their sessions has `client_feedback IS NOT NULL`. Click → `/clients/{id}` opens a "Mensagens do cliente" panel listing them. Minimal — just enough to *force us to build a reply UI later*.

## 4. "Live log → table" collapsed view

When a session is logged (status = `done`), the giant log card in `/plans/$planId` collapses to a single row mirroring the table view:

```
✓ W2 D1  Full-Body A   8 ex · 24 sets · avg RPE 7.8   12 May  ⌄
```

Click expands to the current detailed view. New component `<LoggedSessionCollapsed />` rendered inside the existing log list. Only `done` sessions collapse; `partial`/`missed` stay expanded so they catch the eye.

## 5. In-app guide AI ("Concierge")

A floating `?` button (bottom-left, mirror of demo HUD) opens a small chat dock. Goals:

- Answer free-text questions about the app
- Point to concrete routes — replies can include `<go to="/plans/new">` tags that render as clickable chips
- Aware of current route (`useLocation`) so "where do I generate a plan?" gives a deep link

Implementation:
- New edge function `supabase/functions/concierge/index.ts` calling Lovable AI Gateway (`google/gemini-3-flash-preview`)
- System prompt embeds a compact route map: every `/route` + 1-line purpose, generated from a hand-curated `src/lib/concierge-routes.ts` (we don't auto-scan)
- Tool-calling: `navigate(path)`, `highlight(selector)` so it can return structured pointers
- Client component `src/components/ConciergeDock.tsx` mounted in `AppShell`. Uses `react-markdown` for replies; honours the markdown rule from chatbot best practices.
- Conversation memory kept in `localStorage` per session (no DB table yet — defer until users ask)

Founder-only at first (`aafonsodias@gmail.com`) so we can iterate without misleading early users.

## Technical notes

- All new components follow the **status palette** (emerald = done, amber = warn, red = blocked), via `toneChip`/`toneDot` helpers in `src/lib/status-tone.ts`.
- Markdown rendering: install `react-markdown` if not present (`bun add react-markdown`).
- DB migration is non-destructive: add nullable `client_feedback JSONB` to `workout_sessions`. No RLS change required (existing policies cover it).
- Concierge edge function added with `verify_jwt = false` since it only needs the user's question + route, no PII.

## Out of scope (next phase)

- Cron-driven simulation tick (still on-demand via Demo Lab button)
- Real friend graph in Forge
- Concierge for non-founder users

---

## Parallel task prompt for Opus 4.7

Paste this to your other agent — it's tedious cleanup unrelated to the above:

> **Task: i18n audit and extraction for `src/routes/clients_.$clientId.tsx`**
>
> The file is 3343 lines and mixes hard-coded Portuguese strings with `t()` calls from `react-i18next`. Goals:
> 1. Find every JSX text node and `toast.*` / `aria-label` / `title` string that is **not** wrapped in `t()`.
> 2. For each, propose a stable key under the `assessment` namespace (existing file: `src/i18n/locales/{en,pt}/assessment.json`) and produce a unified diff that:
>    - replaces the string with `t("…")`
>    - adds the EN + PT entries to both JSON files
> 3. Skip strings that are clearly developer-only (console.error, dev panel labels gated on `aafonsodias@gmail.com`).
> 4. Output as a single PR-style patch with a short summary table: `key | EN | PT | line`.
>
> Constraints: do not change any logic, only string extraction. Do not touch `src/components/DemoLabPanel.tsx` or anything under `src/server/`. Preserve existing `t()` calls verbatim.

When Opus returns the patch, I'll apply it on top of the work above.
