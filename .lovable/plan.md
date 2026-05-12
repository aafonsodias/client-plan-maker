
# Assessment screen refactor — mobile-first, low-credit pass

Narrow, surgical pass. No new design system, no route rewrite, no schema changes, no renaming of existing section ids. Minimal diffs, refactor existing components/tokens only.

**Critical correction vs previous plan:** "Lesões e dor" is **4/15**, immediately after Training/setup — NOT 1/15.

## 1. Step model — inject "injuries" at position 4

`SECTIONS` is module-level in `src/routes/clients_.$clientId.tsx`, so `t()` is unavailable. Use stable ids + `labelKey` at module level; resolve via `t(s.labelKey ?? s.label)` at render sites (stepper, desktop section header, mini-card, mobile header, Sheet step list).

Existing entries may either migrate mechanically to `labelKey`, or keep `label` plus `labelKey` and prefer `labelKey` when present.

**Final order (15 total):**
parq → risk → training → **injuries** → history → goal → meds → readiness → lifestyle → nutrition → anthro → mobility → posture → screen → performance

**Numbering:** PAR-Q+ = 1/15, Risco = 2/15, Treino = 3/15, **Lesões e dor = 4/15**.

Rules:
- Keep all existing ids stable. Do not rename.
- Add only `id: "injuries"` as the new fourth section.
- Move existing injuries/pain UI from the training block into a new `InjuriesSection` rendered immediately after Training/setup. Remove old rendering completely — exactly one visible injuries/pain section.
- Required (not in `OPTIONAL_SECTIONS`).
- Deep-links and stored progress must survive.

### `no_injuries` persistence (no schema changes)

Order of preference:
1. `assessment.no_injuries` if the assessment object is already flexible JSON.
2. Existing flexible JSON sub-object (`extended` / `meta` / `intake`) if patch path rejects unknown top-level keys.
3. Last resort: internal sentinel inside `injuries` field, never surfaced in any UI/PDF/AI prompt.

Update only app-level TypeScript types, form-state types, Zod/validation helpers, default assessment object, dirty-state logic, patch payload builders — enough to pass `bunx tsc --noEmit`. Never edit generated Supabase types.

**Completion rule:**
`injuries` text non-empty OR `pain_areas?.length > 0` OR `no_injuries === true` (optional-safe checks for legacy assessments).

### i18n

Add to `src/i18n/locales/pt/assessment.json` and `en/assessment.json`:
- `sections.injuries` label
- MobileStepHeader prefix:
  - PT: `Passo {{current}} de {{total}} · {{title}}`
  - EN: `Step {{current}} of {{total}} · {{title}}`

ES/HI fall back per existing policy.

## 2. Mobile shell (< 768px)

Above the first input, render only:
1. Back link
2. Minimum client identity strip — name + single invite/status chip (rendered explicitly in route, not extracted from hero)
3. Sticky `MobileStepHeader`
4. Content

Hide on mobile via route call-site responsive classes (`hidden md:block`):
- `ClientStageOneHero`
- "AUTO-AVALIAÇÃO DO CLIENTE" group header
- Horizontal step-chip strip
- Duplicate step/progress badge in upper mini-card
- Repeated section title on mobile only when sticky header already shows it

Desktop section titles and navigation untouched. Status appears **once** on mobile (in identity strip; nothing duplicated below).

**New file `src/components/MobileStepHeader.tsx`:** mobile-only, sticky, `h-11`, blurred surface, shows translated step prefix + title, kebab opens existing step Sheet, no desktop changes, i18n only.

`ClientStageOneHero.tsx` not modified unless absolutely necessary.

## 3. Status redundancy — single source of truth

When invite is unopened, show once: `Convite pendente · Ainda não aberto · expira em 14d`.

- Drop "Avaliação a decorrer" while unopened.
- Section title once: desktop section header on desktop, sticky mobile header on mobile.
- Global progress = stepper only.
- Current section progress = section header only.
- Remove third duplicate progress copy from mini-card.
- PAR-Q alert chip only when count > 0; never render "ALERTAS PAR-Q+: 0".
- Mobile: status not duplicated below identity strip.

## 4. Single vertical scroll

Audit assessment subtree by pattern (not line numbers): `overflow-y-auto`, `overflow-auto`, `h-screen`, `max-h-screen`, `ScrollArea`.

- Mobile: only document scrolls. No inner scrollbar in assessment content. No horizontal overflow.
- Add `overflow-x-hidden` at page root if missing.
- Replace `h-screen` cascades with `min-h-dvh` where they affect this page.
- Cards/forms use natural document flow, never internal scroll.
- Modal/Sheet `overflow-y-auto` allowed (only exception). Stepper Sheet scroll containers may remain.

## 5. ScrollCue — mobile only

**New file `src/components/ScrollCue.tsx`:**
- `fixed bottom-6` center, double chevron / elegant pill, soft bounce/fade loop
- `aria-hidden`, no text, `md:hidden`
- Hides when `window.scrollY > 8`
- Local state per mount (no sessionStorage); returns on every mount/reload, hides after first scroll within that mount
- `prefers-reduced-motion`: render static, no animation
- Must not overlap sticky bottom nav — position above it or hide once visible
- Reset predictably on route/client change; key by `clientId` or current section if needed

## 6. Theme polish — dark only

In `src/styles.css`, dark tokens only:
- `--background`: cooler charcoal
- `--surface` / `--card`: visibly lighter than background
- `--border`: lower opacity
- `--foreground`: higher contrast
- amber primary kept; success/warning/danger restrained

Light/medium themes untouched.

Visual cleanup in assessment route: remove redundant outlined chips inside already-bordered cards; `space-y-3` for section bodies; `mb-3` / `gap-3` between sections; reduce stacked labels before the first input.

## 7. Files expected to change

- `src/routes/clients_.$clientId.tsx`
- `src/components/MobileStepHeader.tsx` (new)
- `src/components/ScrollCue.tsx` (new)
- `src/styles.css`
- `src/i18n/locales/pt/assessment.json`
- `src/i18n/locales/en/assessment.json`
- App-level TS/Zod/form/patch helpers needed for `no_injuries` to typecheck

## 8. Out of scope

Light/medium theme redesign · backend/schema changes · migrations · generated DB type edits · renaming section ids · full route rewrite · desktop redesign · clinical logic beyond moving injuries/pain.

## 9. Acceptance checklist

- 390px: first input of active section visible within one short thumb scroll.
- 390px: same when active section is "Lesões e dor".
- 768px: layout still correct.
- Desktop nav intact.
- PAR-Q+ = 1/15, Risco = 2/15, Treino = 3/15, **Lesões e dor = 4/15** in stepper, header, progress count.
- Existing section ids stable.
- `no_injuries` toggle survives reload.
- `no_injuries` in relevant app-level TS/form/patch types without schema migration.
- Optional-safe checks prevent crashes on legacy assessments.
- Mobile keeps client identity + status chip even with hero hidden.
- Invite status appears once.
- "Avaliação a decorrer" gone when invite unopened.
- PAR-Q chip hidden when count = 0.
- Mobile step chips hidden.
- One vertical scrollbar; no horizontal overflow.
- ScrollCue: appears on fresh open, hides after first scroll, resets on route/client change, doesn't overlap bottom nav, respects `prefers-reduced-motion`.
- Dark theme has clear background/surface/border/text separation.
- `bunx tsc --noEmit` passes.
- No unrelated rewrites.

Final hardening: close all markdown fences, keep code in files (not nested markdown blocks), no fake local-state persistence, confirm old training/setup injuries rendering fully removed, manual smoke at 390px / 768px / desktop.

**Return:** files changed · acceptance checklist confirmation · remaining risks/TODOs.
