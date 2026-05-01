## What we're doing right now (status)

We just finished **Steps 3 & 4** of the planning-flow polish:
- **Microcycle**: Day 1 is the gate; remaining days are now generated **one at a time** via explicit "Generate Day N" buttons (no more silent batching / vanishing days). Each day is fully editable inline and edits persist via `updateDayContent`.
- **Progressions**: replaced the flat table with **per-exercise cards** that include SVG **sparklines** for load / reps / RPE trends across W1→W4.

Open thread you just raised — *"Microcycle regens but doesn't do it"*: I want to verify this is a real bug before fixing blindly. Likely cause is realtime not refreshing the day row after `generateDay` resolves. I'll add this to the next pass with reproduction steps.

---

## GOAL
Refresh the brand mark, clean up the auth screen, and remove the white scrollbar on the right rail.

## CONTEXT
- Logo lives in `src/components/Logo.tsx` and points to `src/assets/forge-logo.png`. New asset will replace it.
- Auth page is `src/routes/auth.tsx` — currently shows the logo + "FORGE" wordmark above a card, with the language switcher centered below. User says the symbol feels "dead" and wonders if it should be there at all.
- Right rail (`<aside>` in `plans.$planId.{microcycle,progressions,blueprint}.tsx`) uses `overflow-y-auto` which exposes the browser's white scrollbar.

## TASK

**1. Logo asset swap**
- Copy `user-uploads://fORGE.png` to `src/assets/forge-logo.png` (overwrite). No code change needed — every consumer (`Logo.tsx`, AppShell, auth page, etc.) inherits it.

**2. Auth page polish (`src/routes/auth.tsx`)**
- Replace the small Logo + wordmark row with a **larger, centered logo only** (h-14 w-14), a thin orange divider line beneath it, and the wordmark `FORGE` rendered with wider tracking + small caps as a single typographic mark. This matches the "ingot + flame seam" aesthetic of the new icon.
- Add subtle vertical breathing (more space above the card, slight glow behind the logo using a radial accent).
- Keep tabs / form / Google button untouched.
- Keep the language switcher at the bottom but smaller and lower-contrast so it doesn't compete with the form.

**3. Hide sidebar scrollbar (cross-browser)**
- Add a `.scrollbar-hide` utility in `src/styles.css`:
  ```css
  .scrollbar-hide::-webkit-scrollbar { display: none; }
  .scrollbar-hide { scrollbar-width: none; -ms-overflow-style: none; }
  ```
- Apply `scrollbar-hide` to the `<div>` wrapping `BriefContextRail` in:
  - `src/routes/plans.$planId.microcycle.tsx`
  - `src/routes/plans.$planId.progressions.tsx`
  - `src/routes/plans.$planId.blueprint.tsx` (if same pattern)

## CONSTRAINTS
- No unrelated changes; do **not** touch microcycle/progression logic in this turn.
- Do not modify any auth flow code (signIn / signUp / google handlers).
- Do not touch i18n keys.

## ACCEPTANCE
- New ingot icon visible in AppShell header AND on the auth page (just by replacing the asset file).
- Auth page: logo centered, larger, accent line under it, wordmark below; language switcher visibly de-emphasized at the bottom.
- Right rail in microcycle / progressions / blueprint pages no longer shows a white scrollbar; scroll still works.

## ROLLBACK
- Restore the previous `forge-logo.png` from git history.
- Revert `src/routes/auth.tsx` and remove the `.scrollbar-hide` utility + class usages.

## Next turn (pending your nod)
- Investigate the **microcycle "regen runs but UI doesn't update"** bug — most likely a stale realtime payload or missing `loadDays()` after `generateDay` resolves.
