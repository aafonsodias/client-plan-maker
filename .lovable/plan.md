## Goal

Turn the demo client into a self-running showcase. When the trainer scrolls down on a `?demo=play` client, each section auto-collapses, turns golden ("approved"), the next gate auto-runs, and we keep going through Brief → Blueprint → Microcycle → Progressions → Finalize. The journey ends with a popup showing the plan as a `MesocycleTableView` maquette plus developer/client-friendly reasoning notes.

## Activation

- Entry: `/clients/{id}?demo=play` (the "+ Cliente demo" button now navigates with this query) OR a new "▶ Reproduzir demo" button on demo clients (detected via `extended.demo_meta.archetype`).
- Strictly opt-in. Without `?demo=play` everything behaves as today.

## Stage flow (gate-by-gate)

For each gate the orchestrator does:
1. Wait until the gate's anchor scrolls into the viewport (IntersectionObserver, threshold ~0.4).
2. Pulse a soft amber ring on the active card (visual "this is being reviewed").
3. Run the gate's action.
4. On success → collapse the section, mark it golden ("approved" tone via `toneChip("success")`).
5. Auto-scroll just enough to bring the next gate into view, then resume.

Gates, in order:
1. **Assessment review** — auto-mark `intake_status = "reviewed"` if not already, scroll past the intake panel.
2. **Synthesis dashboard** — no action, just dwell ~600ms so the trainer reads it, then collapse.
3. **Generate Brief** — call `runPhasedStart()` (existing). Wait for `inlineBrief` to populate.
4. **Approve Brief** — call the existing `approveBriefFn` path (the one wired in `StageCard.onApprove`).
5. **Blueprint** — `runStage("blueprint", false)` then auto-approve once draft exists.
6. **Microcycle** — same pattern via `generateMicrocycleDaysFn` then approve.
7. **Progressions** — `proposeProgressionsFn` then approve.
8. **Finalize** — call `finalizePlanFn` so the plan flips to "ready".

Each step has a 60s timeout and surfaces a toast on failure (so we learn where the flow broke — that *is* the QA signal).

## Theatrical details

- A small floating HUD (bottom-right): "Demo · Stage 3/7 · Microcycle" + Pause / Skip buttons. Pause stops the orchestrator; Skip jumps to the next gate.
- Sections being processed get `ring-2 ring-amber-400/40 animate-pulse`; once done they switch to `tone="success"` chip + collapsed state.
- A sidebar "trail" shows ✓ for completed gates and ⟳ for the active one — uses the existing `toneDot` helper from `src/lib/status-tone.ts`.
- `prefers-reduced-motion`: skip the pulse animation, keep instant collapses.

## Final maquette popup

When `finalizePlan` resolves, open a large `Dialog` with:
- **Header**: persona archetype + expected red flags as chips (read from `assessment.extended.demo_meta`).
- **Plan tab** (default): `<MesocycleTableView planId={...} />` — the existing main table view, embedded.
- **Reasoning tab**: rendered from a new server function `judgeDemoRun(planId)` that uses Lovable AI Gateway (`google/gemini-3-flash-preview`, tool-calling for structured output) to produce:
  - `safety_violations[]` (e.g. "Prescribed back squat despite no_axial_loading flag")
  - `progression_realism` (A–F + 1-line note)
  - `equipment_adherence` (A–F + note)
  - `volume_balance` (agonist/antagonist comment, picking up on the user's earlier feedback)
  - `top_friction_points[]` (max 3, dev-facing)
  - `client_summary` (2 sentences a client could read)
- **Notes tab**: raw archetype JSON + the brief/blueprint/microcycle/progressions JSONs, collapsible — useful when iterating on prompts.
- Result is persisted to `workout_plans.demo_critique` (column already exists from prior migration) so reopening the dialog doesn't re-bill the AI call.
- "Recriar avaliação" button → calls `judgeDemoRun({ force: true })`.

## Files to add / change

New:
- `src/components/DemoOrchestrator.tsx` — the controller hook + HUD. Exposes `useDemoOrchestrator({ enabled, gates })`.
- `src/components/DemoMaquetteDialog.tsx` — the final popup with tabs.
- `src/server/demo-judge.functions.ts` — `judgeDemoRun` server fn (Lovable AI Gateway, tool-calling schema, persists to `workout_plans.demo_critique`).

Edit:
- `src/routes/clients_.$clientId.tsx` — add data attributes (`data-demo-gate="brief"` etc.) on each section/StageCard, mount `<DemoOrchestrator>` when `search.demo === "play"`, and open `<DemoMaquetteDialog>` once finalize resolves.
- `src/routes/clients.tsx` — make the "+ Cliente demo" navigation append `?demo=play`.
- `src/i18n/locales/{en,pt}/plan.json` — strings for HUD, dialog tabs, judge labels.

No DB migration needed (`demo_critique` column already in place).

## Out of scope (for this pass)

- Fabricating historical logbook data (Phase D from the earlier plan).
- Running the orchestrator on non-demo clients.
- Persisting orchestrator progress across reloads — refresh restarts from the current gate state.

## Acceptance

- Creating a demo client lands on `/clients/{id}?demo=play` and, on first scroll, the assessment collapses → brief generates → brief approves → blueprint → microcycle → progressions → finalize, all without manual clicks.
- A failure at any stage stops the run, shows the gate name in the HUD, and surfaces the error toast (so we can iterate).
- Final popup shows the mesocycle table and the AI judge's grade card, including at least one concrete note tied to the persona's `expected_red_flags`.
