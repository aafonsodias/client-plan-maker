## Goal

On `/clients/$id`, the plan card (`ThisWeekHero`) should expose the same tabs as the dedicated plan editor — **View · Logbook · Results · Progress** — so the trainer never has to leave the client page to consult or edit the active block.

Today only two CTAs render ("Abrir editor" → `/plans/$planId`, "Abrir logbook do cliente" → `/log/$token`). The user wants those collapsed into an inline tabbed surface right under the hero.

## Constraint

`PlanEditor` in `src/routes/plans.$planId.tsx` is ~1960 lines, owns its own data loading, save handlers, dialogs, and stage-redirect logic. Inlining it verbatim would balloon `clients_.$clientId.tsx` (already 6414 lines) and duplicate state. We must extract first.

## Plan

### Step 1 — Extract `<PlanEditorSurface />`

- Move the inner `PlanEditor` body (everything after the route wrapper at line 80) into a new file `src/components/PlanEditorSurface.tsx`.
- Accept `planId: string` as a prop instead of reading from `Route.useParams()`.
- Optional `embedded?: boolean` prop:
  - `true` → omit `<AppShell back=…>`, omit the page-level "Back to all plans" header, render only the tabbed editor (the `view | edit | log | results | progress` switcher already lives inside).
  - `false` (default) → behaves exactly as today.
- Stage-in-progress redirect (`brief/blueprint/microcycle/...`) stays inside the surface so embedding still respects it; in embedded mode it renders an inline notice + link instead of `navigate({ replace: true })`.

### Step 2 — Update `/plans/$planId` route

Replace the 80-line PlanEditor scaffolding with:
```tsx
function PlanPage() {
  const { planId } = Route.useParams();
  return (
    <AppShell back={{ to: "/plans", label: "All plans" }}>
      <PlanEditorSurface planId={planId} />
    </AppShell>
  );
}
```
Pure refactor — no behavior change for the standalone route.

### Step 3 — Embed on `/clients/$id`

In `src/routes/clients_.$clientId.tsx`, right after the `<ThisWeekHero …/>` block (around line 2015) and only when `allApprovedLocal && heroPlan`:

```tsx
<section className="mt-6">
  <PlanEditorSurface planId={heroPlan.id} embedded />
</section>
```

### Step 4 — Simplify the hero CTAs

Now that the editor is inline, the redundant "Abrir editor" CTA disappears. Keep:
- **Primary**: "Abrir logbook do cliente" → `/log/$token` (the only action that genuinely leaves the page).
- **Secondary**: removed (or kept as "Ver no editor dedicado" pointing to `/plans/$planId` for the trainer who wants the full-screen view — optional).

### Step 5 — Smoke

- `/plans/$planId` renders identically (View · Edit · Log · Results · Progress, save, dialogs).
- `/clients/$id` for Aspiringbaconeer shows the hero, then the same tab bar inline; switching tabs doesn't navigate away; the URL stays `/clients/<id>`.
- In-progress phased plans (stage ≠ complete) still redirect to the stage editor when opened standalone, and show an inline "Continue briefing →" link when embedded.
- Mobile 375px: tab bar wraps, no horizontal overflow.

## Files touched

```
NEW   src/components/PlanEditorSurface.tsx       (~1880 lines — moved verbatim from plans.$planId.tsx)
EDIT  src/routes/plans.$planId.tsx               (collapses to ~30 lines)
EDIT  src/routes/clients_.$clientId.tsx          (import + 1 inline render + CTA cleanup)
```

No DB / migration / i18n changes.

## Out of scope

- Refactoring PlanEditor's internal state (state lives where it always lived; we just relocate the component).
- Tab-state syncing to URL (`?mode=results`) — can come later if useful.
- Changing the actual tabs or their content.

## Risk

Medium. Move is mechanical but the file is large; one missed import or hook call breaks the route. Mitigation: do the extract in a single `git mv`-style copy + delete, keep imports alphabetised, run typecheck before wiring it into `/clients/$id`.

Estimate: ~10–15 credits.
