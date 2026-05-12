## Goal

Bring the client-link intake (`/intake/$token`) closer to the PT's richer in-app assessment, keep both sides bidirectionally in sync without losing the other's edits, force the slides into the visitor's language (PT/PT-BR → pt, anything else → en), and make missing required fields visually impossible to miss with a clear "go here" pointer.

## Current state (from the audit)

- `src/routes/intake.$token.tsx` runs a 17-slide flow covering: identity, mode, photo, SMART, readiness, training setup, equipment, injuries (already uses `InjuriesSlide` with the body map), PAR-Q, meds, sleep, stress, lifestyle, nutrition, reference photos, review.
- The PT-side assessment (`src/routes/clients_.$clientId.tsx`) has 15 sections; client-link is missing: training history (years_training / previous_program_style / max_lifts), anthropometry (height / weight / waist / hip), self-rated mobility (the 5 ext_mob_* scores), perceived posture / known imbalances, performance self-report.
- `src/server/intake.functions.ts` whitelists writeable fields and already has a `provenance` map ('client' vs 'trainer-edited') in `assessment.extended`. So merge logic is partially built.
- Conflict bug: on reopen, `setForm((cur) => ({ ...cur, ...localStorageDraft }))` blindly overrides the server-fresh form, so any PT edit made after the client started is silently overwritten on the next debounced save.
- i18n: locale is auto-applied from `navigator.language` slice(0,2), so `pt-BR` already maps to `pt`. But a stale `protocol.locale=en` in localStorage from a previous visit pins the client to EN.
- Missing-field UX on the intake side: nothing today. The Review slide just shows "—". The Next button greys out without saying which field is wrong.

## Scope (this round only)

Frontend + intake server-fn whitelist. No DB schema changes. No PT-side rewrites. No PDF changes.

## Plan

### 1. Lock intake locale to client's system language

In the intake page only (`src/routes/intake.$token.tsx`), before the first paint of slides:
- Read `navigator.language`. If it starts with `pt` (covers `pt`, `pt-PT`, `pt-BR`) → call `i18n.changeLanguage("pt")`. Else → `"en"`.
- Do NOT persist this choice to `localStorage` for the intake route — it's a per-visitor decision, not a global preference. We add an `intakeLocaleApplied` ref so we don't re-trigger on every render.
- This overrides any stale `protocol.locale` value from a previous Protocol visit on the same browser.

### 2. Bring richer PT sections into the intake slideshow

Add 5 new slides between current slide 15 (Nutrition) and the existing reference-photos slide. Each slide reuses i18n keys from `src/i18n/locales/{en,pt}/intake.json` (we'll add the missing ones; PT mirrors EN structure).

| New slide | Fields written | Notes |
|---|---|---|
| Training history | `years_training` (int 0–80), `previous_program_style` (free text, optional) | Both sliders + free text |
| Body metrics | `waist_cm`, `hip_cm`, `body_fat_pct` (all optional, all `extended.*` so no schema change risk) | Light explanation + tape-measure illustration (CSS only) |
| Mobility self-rating | 5 × 1–5 sliders for `ext_mob_squat`, `ext_mob_overhead`, `ext_mob_hip_hinge`, `ext_mob_hamstring`, `ext_mob_ankle` (stored in `extended`) | Inline rubric copied from PT side (`mobility_block.rubric`) so client and PT see the same wording |
| Perceived posture | `standing_posture_notes` + `known_imbalances` + `dominant_side` (`L/R/Both`), all to `extended` | Optional, with a 3-line explanation of why it matters |
| Performance self-report | `current_capacity_vs_pb` (1–10 slider, already validated server-side) + `max_lifts` free text (optional, to `extended`) | Slider explanation: "10 = best ever; 1 = the worst I've felt" |

Drawings = lightweight inline SVG/CSS (tape-measure for anthro, body silhouette for posture). No new image assets.

Server-fn whitelist (`ALLOWED_FIELDS` in `intake.functions.ts`) gets these new top-level columns: `years_training`, `waist_cm`, `hip_cm`, `body_fat_pct`, `current_capacity_vs_pb`. Everything else stays inside `extended` (already permitted). Add matching `FIELD_SCHEMAS` entries.

### 3. Fix bidirectional sync (no PT/client write-overs)

Server side (`saveIntake`):
- Already loads `existing.extended.provenance`. Extend the merge: build a per-field `provenance` for top-level columns too, not just sections. A column whose provenance is `trainer-edited` and whose value differs from `cleaned[k]` is **rejected for that field** (the trainer's value is preserved; we still save the rest). Logged but silent to the client.

Client side (`fromAssessment` / hydration):
- After `loadIntake`, also fetch `provenance` from `extended`. When merging localStorage draft over the server form, do NOT clobber any field whose provenance says `trainer-edited`. That is, draft is only allowed to set fields the server form has empty OR fields the client previously owned.
- Remove blind localStorage spread; replace with a per-field merge helper.

Result: PT can edit while the client has a draft open; on next client save, the trainer's edits survive, and the client only writes back fields they actually changed.

### 4. Missing-field high-attention guidance

Two layers:

**A. Per-slide inline:** when `Next` is disabled because `isValid()` fails, render below the body a one-line amber chip ("Falta preencher: <field name>") with a pulse animation. Re-uses the amber 500/30 border + 500/10 fill convention already in this file (PAR-Q warning, line 419/1353), so visual language stays consistent.

**B. Review slide:** turn each "—" row into an interactive button — when clicked, jumps the slideshow back to the originating step. Style empty rows with the amber palette + "Toca para preencher" CTA. Required-but-blank rows are amber; optional-but-blank stay muted grey. Reuse the `MissingItem` shape from `src/lib/assessment-completion.ts` for symmetry with the PT side (no import — just same naming so future merge is easy).

The Submit button on the last slide stays disabled until all *required* slides validate; tooltip on hover (and inline text on tap) lists the missing items by name.

### 5. i18n keys

Add to `src/i18n/locales/en/intake.json` and `src/i18n/locales/pt/intake.json`:
- `sections.history_*`, `sections.metrics_*`, `sections.mobility_*` (mirror PT `mobility_block.rubric`), `sections.posture_*`, `sections.performance_*`
- `validation.required`, `validation.go_fix`, `review.tap_to_fill`, `review.missing_count`

ES/HI fall back to EN per project policy (only `plan.json` and `common.json` are translated for those locales).

## Out of scope (call out, don't build)

- DB migration (no new columns; everything reuses existing `assessments` columns or `extended` JSON).
- PDF inclusion of the new fields (separate round).
- The PT-side route file (`clients_.$clientId.tsx`) — read-only reference for copy + rubric.
- Movement-screen self-test (5-criteria grids) — too high-friction for a self-serve form; PT does that in person.
- Auto-conflict resolution UI for the PT (today they just see the latest values; that's fine).

## Files touched

- `src/routes/intake.$token.tsx` — add 5 slides, locale-lock effect, missing-field UX, per-field merge.
- `src/server/intake.functions.ts` — extend `ALLOWED_FIELDS`, `FIELD_SCHEMAS`, and add per-field provenance logic.
- `src/i18n/locales/en/intake.json` and `src/i18n/locales/pt/intake.json` — new keys.

## Verification

- Build + typecheck.
- Manual smoke at 375px mobile: open intake link with `navigator.language=pt-BR` → slides render in PT.
- Simulate PT-edit-then-client-resume: PT updates `years_training`; client has stale draft; client saves; verify PT value survived.
- Try to advance with required field empty → amber inline message appears, Next stays disabled.
- Review slide: blank required row is amber + tappable, jumps back to that step.
