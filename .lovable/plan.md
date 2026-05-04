
# Polish Round — Client Workspace + Stage Flow

This is a wide round. Grouped into 6 themes, ordered by impact. Each theme is independently shippable so you can stop me mid-way if priorities shift.

---

## Theme 1 — Stage cards: one box per stage, clean transitions (P0)

**Problem:** Stage 2 currently shows two stacked boxes ("View draft" header + the actual editor below). Transition Blueprint → Microcycle collapses the editor with a generic spinner instead of advancing the stage.

**Changes:**
- `src/components/StageCard.tsx`: when `expandedStage === stage.id`, render the inline panel **inside** the same card, not as a sibling. Header keeps title + status chip; primary action moves to the bottom of the expanded body.
- `src/routes/clients_.$clientId.tsx`: drop the duplicate StageCard wrapper around `BlueprintEditorPanel` — it lives inside Stage 2's card now.
- On approve success: set Stage 2 status → `ready` (emerald), auto-collapse Stage 2, set `expandedStage = "microcycle"`, and scroll to it. No full-page spinner.
- Same pattern applied to Stage 1 (Brief), Stage 3 (Microcycle), Stage 4 (Progressions) for visual consistency — one card, expandable, primary CTA at bottom.

## Theme 2 — Approve buttons + loading feel (P0)

**Approve buttons:**
- Move primary "Approve → next stage" CTA to the **bottom** of the expanded body (after the user has read everything), full-width on mobile, amber→emerald gradient with check icon. The toolbar at the top keeps only Brief / Ask AI / Regenerate / Full page.
- File: `src/components/BlueprintEditorPanel.tsx` (and the Brief/Microcycle/Progressions equivalents).

**Loading feel:**
- Replace the right-aligned white spinner box with an inline progress strip across the top of the active card: thin amber bar + the live stage label (e.g. "A escrever Day 1 — 4 / 8 exercícios"). Reuses the telemetry stream we already have.
- Component: `src/components/StageProgressStrip.tsx` (new).

## Theme 3 — AI telemetry panel relocation (P0)

**Now:** Floating panel obscures content.
**Plan:** Dock it under the left "Sections" rail as a collapsible "AI spend" tray. On mobile it becomes a tiny pill in the bottom-left that expands to a sheet on tap. Founder-only (already gated). File: `src/components/FounderAiTelemetryPanel.tsx` + mount point in `clients_.$clientId.tsx`.

## Theme 4 — Copy + visual polish across the assessment (P1)

**Brand rename:**
- "Your Workshop" → **"AI Workbench"** with a small ⚒ glyph styled like the brand mark (amber under-glow). Search + replace across i18n + headers.

**Programming Tier card:**
- Bigger type (text-base instead of text-xs), tier name as the headline, plain-language one-liner, and the swap chips (Remedial / Conservative) become full buttons with their colour. Replace `lower_metabolic` style ids with human labels everywhere user-facing — keep the snake_case only in dev tools / generation_log.

**Session archetypes mobile drag:**
- Increase the drag-handle hit area to 44×44px, switch `PointerSensor` activation from `distance: 4` to `delay: 150, tolerance: 5` so a long-press starts the drag without competing with scroll. File: `src/components/BlueprintArchetypesList.tsx`.

**Client-touched fields legend:**
- Add `source: "client" | "trainer"` indicator on intake answers. Arrows / checkmarks rendered in cyan when `source === "client"`, amber when `trainer`. Legend chip at the top of the Sections rail explaining the colour code. Requires a small migration to record `last_edited_by` on `intake_answers` (or read from existing audit fields if present — I'll check first).

**Assessment Synthesis upgrade:**
- Add: VO2max estimate + percentile vs age/sex (when Rockport / step test present), all-cause mortality risk band (Mandsager 2018 reference table), grip-strength percentile if recorded, recovery vs training-load mismatch flag, top 3 movement-pattern weaknesses with one-line "what to train" suggestion.
- Layout: 2×3 grid of "insight cards" with sparkline / dial visuals.

**Movement Screen field mode:**
- New compact layout for ≤ 768px: one pattern per swipeable card, big radio buttons, capacity field collapses by default. Desktop layout unchanged. File: `src/components/MovementScreenField.tsx` (new).

## Theme 5 — Documents corner card + intake-link state (P1)

**Documents widget:**
- Demote from full-width section to a sleek 220×140 corner card top-right of the client header: caduceus glyph, count badge, "Carregar" on hover, opens existing dialog. File: `src/components/ClientDocumentsCard.tsx` (replaces inline list).

**Intake link card:**
- When `intake_submissions.submitted_at` exists: collapse to "✓ Intake completo · ver respostas" with a soft emerald border. Hide the WhatsApp/email/Generate-new-link controls behind a "..." menu. The state was already in the DB — the UI just wasn't reading it.

## Theme 6 — Referrals, progression models, health vs performance, manual audit (P2)

**Referrals:**
- New table `referrals(referrer_id, referred_id, redeemed_at, reward_kind)`. Each account gets a `/r/{code}` link in Settings. Reward (mvp): both accounts get +1 plan_limit on redemption. RLS: trainers see only own referrals. Surfaces in `/me` and the welcome email.

**Progression Models picker (Bompa-aware):**
- Replace the three flat cards with: Linear, Undulating (DUP), Block, Conjugate. Each card gets a hand-drawn-style SVG of the actual loading curve (week-by-week intensity), a 1-line "best for", a "evidence" footnote (Bompa 6e + ACSM ref), and a 🩺 **Health mode** toggle that swaps the proposal toward sub-maximal RPE 5–7 caps and inserts a deload every 3rd week regardless of model. Files: `src/components/ProgressionModelPicker.tsx` + 4 new SVGs in `src/assets/progression/`.

**Manual + copy audit:**
- Sweep `src/i18n/locales/{pt,en}/*.json` for jargon (`lower_metabolic`, `archetype`, `bulkfill`, `microcycle` only where unavoidable). Replace with everyday PT/EN. Add tooltips for the few technical terms we keep. Update `/manual` page accordingly.

---

## Suggested execution order

1. **Theme 1 + 2** in one shipment — fixes the visible bug you're stuck on.
2. **Theme 3** — gets the telemetry out of the way.
3. **Theme 4** — biggest perceived-quality jump; ship Programming Tier + mobile drag + Synthesis first, Movement Screen field mode after.
4. **Theme 5** — documents card + intake-state are quick wins.
5. **Theme 6** — referrals & progression-model rework are bigger; do last.

## Out of scope for this round (call out if you want them in)

- Rockport → VO2max → mortality calculator math (I'll wire the UI; the formula table goes in a follow-up so we can review the references together).
- Reworking the demo personas to exercise the new field-mode layouts.
- Touch of Stage 5 (bulkfill) — it's not in the screenshots and you didn't mention it.

## Risks

- Stage-card refactor touches `clients_.$clientId.tsx` which is large — I'll snapshot before editing and run the 375px Mobile Safari smoke after.
- Referrals table needs a migration; I'll back up before applying.
- Renaming "Your Workshop" → "AI Workbench" hits many keys; I'll grep first to avoid stale strings.
