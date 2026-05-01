
## Problems observed on `/plans/:planId/blueprint`

1. **Brief context disappears below 1024px** with no hint. The `BriefContextRailMobile` collapsible exists but is hidden by `lg:hidden` only — it works under 1024px, **but** between ~1024–1280px the desktop rail squeezes the main table awkwardly, and at 1023px the rail vanishes silently with no toggle next to the title.
2. **Session archetypes** are a flat list of inputs — no drag-to-reorder, no search, and the Week × Day matrix uses `<select>` dropdowns showing only `id`s (e.g. `upper_push_strength`), which is hard to scan.
3. **No way to talk to the AI** about the blueprint (re-balance, swap, justify a choice). Today the only AI affordance is full "Regenerate" which throws away manual edits.
4. **Approve flow not always reliable** — `approveBlueprint` runs but if the user edited archetypes/map locally and the new state contains an `id` referenced in `week_to_session_map` that no longer exists, schema validation can silently send a stale shape. Need a pre-flight validator + clear "Approve & continue" CTA that navigates to `/microcycle` only after success.

## Goal

Make the Blueprint stage feel like a real planning surface: brief always reachable, archetypes editable with drag/search, an AI chat side-panel to discuss changes, and a bullet-proof Approve → Microcycle handoff.

---

## Plan (4 steps)

### Step 1 — Always-accessible Brief context

- Replace the "hidden below lg" rail with a **floating "Brief" button** in the page header (next to Regenerate / Approve) that is **always visible**.
- Behaviour:
  - ≥1280px: rail stays as a sticky right sidebar (current behaviour, but raise breakpoint from `lg` 1024 → `xl` 1280 so the table doesn't get crushed).
  - <1280px: clicking the "Brief" button opens a **right-side Sheet** (`@/components/ui/sheet`) containing `<BriefContextRail planId={planId} />`. Remove the `<details>` mobile collapsible (replaced by the Sheet).
- Add a small badge on the button showing the count of red flags (amber dot) so the user always knows there is unread context.

### Step 2 — Drag-and-drop + search for Session Archetypes

- Add `@dnd-kit/core` + `@dnd-kit/sortable` (already common in the stack; otherwise `react-aria` sortable). Use `dnd-kit`.
- Convert the archetypes list to a `SortableContext` with a drag handle (`GripVertical` icon) on each row.
- Reordering only changes the **display order** of archetypes; it does **not** touch `week_to_session_map`. Persist order locally in component state and include it when sending to `approveBlueprint` (the schema preserves array order).
- Add a **search input** above the list that filters archetypes by `id` or `focus`. While a search filter is active, drag is disabled (standard pattern) and a small note explains why.
- In the **Week × Day matrix**, replace the bare `<select>` showing `id` with a styled select that shows `focus` as the label and `id` as muted secondary text. Keep it as a native `<select>` for accessibility, but render the option as `"Upper — Push focus  ·  upper_push_strength"`.

### Step 3 — AI Assistant side-panel for the Blueprint

- Add a second header button "Ask AI" that opens a Sheet (left side, distinct from the Brief Sheet on the right) containing a chat panel.
- New server function `discussBlueprint` (in `src/server/phased/stage2-blueprint.functions.ts`):
  - Input: `{ planId, messages: [{role, content}], currentBlueprint }`.
  - System prompt: senior coach reviewing the current blueprint against the brief; can either **answer in plain text** or **propose a patch** by calling a tool `propose_blueprint_patch` whose schema is `Partial<Blueprint>` (same `BlueprintSchema` shape but all fields optional at the top level; `session_archetypes` and `week_to_session_map` replace whole if provided).
  - Reuses `callAnthropicWithSchema` plumbing but allows a free-text response (no tool call required).
- Client side:
  - Chat thread stored in component state (not persisted yet — keep scope tight).
  - When the AI returns a patch proposal, render a **diff preview card** with "Apply" / "Discard" buttons. Apply mutates the local `blueprint` state; user still has to hit "Approve" to persist.
  - Cost-safety: cap thread to last 10 messages sent to the model; show a small token/cost badge per turn (reuse `result.costUsd`).

### Step 4 — Reliable Approve → Microcycle

- Before calling `approveBlueprint`:
  - Run `BlueprintSchema.safeParse(blueprint)` (already done) **plus** a referential-integrity check: every id referenced in `week_to_session_map` must exist in `session_archetypes`. Show a single inline error banner listing the offending ids; disable Approve until fixed.
- After successful approve:
  - Already navigates to `/plans/$planId/microcycle`. Add `await load()` reset of `busy` in a `finally`, and ensure the toast "Blueprint approved — generating Day 1" only fires on `res.ok`.
- The Microcycle route already has the same rail layout — apply the same Step 1 layout fix there (and on `/progressions`) for consistency.

---

## Technical notes

- **Files to edit**: `src/routes/plans.$planId.blueprint.tsx`, `src/routes/plans.$planId.microcycle.tsx`, `src/routes/plans.$planId.progressions.tsx`, `src/server/phased/stage2-blueprint.functions.ts`.
- **Files to create**: `src/components/BlueprintArchetypesList.tsx` (sortable list + search), `src/components/BlueprintAiChat.tsx` (chat sheet), `src/components/BriefSheetButton.tsx` (header button + Sheet wrapper).
- **Deps to add**: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.
- **Breakpoint change**: `lg:flex` → `xl:flex`; rail visible at `xl:` only. Brief Sheet button visible at `<xl`.
- **No DB migration required.** `discussBlueprint` is stateless; chat is in-memory only this iteration.
- **Telemetry**: each `discussBlueprint` call writes a `generation_log` row with stage `stage2:blueprint:chat`.

---

## Acceptance criteria

- At any viewport ≥320px, a header control labelled "Brief" is always visible on `/blueprint`, `/microcycle`, `/progressions` and opens a Sheet showing the same content as the desktop rail.
- Session archetypes can be reordered by dragging their handle; the new order persists after Approve and reload.
- A search input filters archetypes in real time by id or focus substring (case-insensitive).
- The Week × Day matrix dropdowns show human-readable focus text, not just the snake_case id.
- An "Ask AI" button opens a chat panel where the user can ask for changes; the AI can either reply in text or surface an "Apply patch" card; clicking Apply updates the editable blueprint without saving.
- Clicking Approve runs schema + referential-integrity validation; if any `week_to_session_map` id is missing from `session_archetypes`, the user sees an inline error and Approve is disabled until fixed.
- After a successful Approve, the user is navigated to `/plans/:planId/microcycle` with no console errors.

## Rollback

- Each step is in its own file/component. To revert:
  - `git revert` the commit(s) — primarily touches `plans.$planId.blueprint.tsx`, the three new components, and the new `discussBlueprint` export.
  - The DB schema is unchanged, so no migration rollback is needed.
  - Removing `@dnd-kit/*` from `package.json` restores the previous dependency surface.

---

## Optimised prompt for future requests of this kind

```
GOAL:
Make the Blueprint stage usable at every viewport, editable by drag,
searchable, and conversational with the AI, with a reliable Approve→Microcycle handoff.

CONTEXT:
- Route: src/routes/plans.$planId.blueprint.tsx
- Brief rail today: src/components/BriefContextRail.tsx (hidden <lg, no toggle)
- Server fns: src/server/phased/stage2-blueprint.functions.ts
- Schema: BlueprintSchema in src/server/phased/schemas.ts
- Approve already navigates to /plans/$planId/microcycle on success

TASK:
1. Add an always-visible "Brief" header button that opens a Sheet
   containing BriefContextRail; raise sidebar breakpoint to xl.
2. Make SESSION ARCHETYPES sortable via @dnd-kit with a search input,
   and show focus text in the Week × Day selects.
3. Add an "Ask AI" Sheet with a chat panel calling a new
   discussBlueprint server fn that can reply in text or propose a
   Partial<Blueprint> patch the user can Apply locally.
4. Add referential-integrity check before approveBlueprint and
   confirm navigation to /microcycle on success.

CONSTRAINTS:
- No unrelated changes
- No refactors of unrelated files
- No DB migrations
- Reuse existing UI primitives (sheet, button) and Anthropic plumbing

ACCEPTANCE:
- Brief button visible at every viewport on /blueprint, /microcycle, /progressions
- Archetypes can be drag-reordered and searched
- AI chat can propose patches that user applies locally before Approve
- Approve blocked when week_to_session_map references missing ids
- Successful Approve navigates to /microcycle without console errors

ROLLBACK:
- git revert the feature commit(s); no migrations to undo;
  remove @dnd-kit/* from package.json to restore deps.
```
