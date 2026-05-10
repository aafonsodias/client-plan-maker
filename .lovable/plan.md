## Goal

Continue the assessment work in two coordinated cuts: (1) low-credit cleanup of footer + per-section title bloat, (2) scaffolding for the post-conclude flow described in the founder doc (animation → client dashboard / trainer cockpit). Cut 1 ships fully; Cut 2 ships the smallest honest first slice and parks the heavy parts for dedicated rounds.

## Cut 1 — Conclude footer + 3-titles merge (low credits, high impact)

### 1.1 "Concluir" becomes the canonical action; kill "Gerar rascunho do plano"

In `src/routes/clients_.$clientId.tsx`:

- **Mobile sticky stepper footer** (line 4618–4632): on the last section `Concluir` is currently `disabled={isLast}` and does nothing useful. Wire it to the same `guard(...)` path used by `showGenerateCta` (lines 3264–3297): if the assessment is incomplete, opens the existing `incompleteWarnOpen` dialog; if PARQ-yes / ACSM-high, opens the existing safety dialog; otherwise calls `runPhasedStart()` (or `generate()` when `phasedEnabled` is false). On non-last sections, `Concluir` keeps being `goNext`.
- Remove the standalone `<Button>{t("generate.button")}</Button>` CTA block on mobile. The whole `showGenerateCta` block (lines 3141–3303) should only render on desktop (or behind `!isMobileStepper`). The "Plano pronto · ver" success state stays visible everywhere — it's not noise, it's a status link.
- Reuse `t("finish")` label as-is. No copy change.

### 1.2 Merge "3 títulos" per section into one card

Today every completed section can render up to three stacked blocks:
1. `CompletionStrip` ("Concluído · summary")
2. `SectionAnalysisCard` ("Insight" header with Sparkles)
3. `RxImplications` ("Implicações para a prescrição" + ACSM chip)

Collapse them into a single `<details>` block titled **"Implicações para a prescrição"** with the ACSM chip on the right and ordered by gravity (founder's words: "ordenado por gravidade de informação com os detalhes por último"):

```text
[chevron] Implicações para a prescrição           [ACSM: low/mod/high]   N regras
  ├─ summary line (was CompletionStrip)
  ├─ AI insight (was SectionAnalysisCard, when present)
  └─ rule cards (was RxImplications)
```

Implementation:
- Extend `RxImplications` to accept optional `summary` (string) and `insight` (string + analysing flag) props and render them inside the same `<details>` as a subtle top strip + insight blockquote, before the rule cards.
- In `SectionBlock`, stop rendering `footer` (CompletionStrip) and `SectionAnalysisCard` automatically. Pass that data into the per-section `<RxImplications>` call instead.
- Touch every `SectionBlock` call (parq, risk, training, history, goal, meds, anthro, readiness, lifestyle, nutrition, mobility, posture, screen, performance) to move the existing `CompletionStrip` text + `analysingSections[id]` + `sectionAnalyses[id]` into the new `RxImplications` props. Sections that don't have an `RxImplications` today (history, meds, mobility, posture) get one stubbed (just summary + insight, no rule cards) so the pattern is uniform.

i18n: title key already exists implicitly (hardcoded "Implicações para a prescrição"). No new strings; we reuse `summary`, `insight`, `acsm` chips that are already in `assessment.json`.

## Cut 2 — Post-conclude flow, first honest slice

### 2.1 Conclude animation → route split

After successful `runPhasedStart()` (or `generate()`), instead of dropping the trainer back into the same dense client page, navigate to a new lightweight route that plays the "what we learned" reveal:

- New route `src/routes/clients_.$clientId.synthesis.tsx`. It loads the most recent assessment + `sectionAnalyses` (already saved server-side) and renders the existing `AssessmentSynthesisDashboard` inside a staged reveal (3 framer-motion fades: red flags → goal + capacities → next step). Bottom CTA: **"Ir para o cockpit"** (trainer) which routes to `/plans/$planId`.
- Reuse the existing `AssessmentSynthesisDashboard` component verbatim — no new dashboard yet. The animation is the only new layer.

### 2.2 Client-side dashboard already exists

`/me` (`src/routes/me.tsx`) is the client dashboard per the Core memory rule. After conclude, when the trigger comes from a client-token intake (not the trainer-on-PT path), redirect to `/me` instead of `/clients/$id/synthesis`. Detection: `interface_mode === "client"` (already in `src/lib/interface-mode.ts`).

### 2.3 Trainer cockpit (microciclo + mesociclo table with side controls)

The full cockpit described in the founder doc (live table + paint-bucket setting copy + circuit grouping + lock-and-print) is a multi-round build. Out of scope for this round. We only ship the navigation entry point: the `Ir para o cockpit` CTA above lands on the existing `/plans/$planId/microcycle` route, which already has the table and progressions — it's the closest existing surface and gives the user a real continuation.

A dedicated **Round J — Trainer Cockpit** is the natural home for the live-edit table, paint-bucket, circuit grouping, and lock-and-print PDF. We park it explicitly in `.lovable/backlog.md` so the work isn't lost.

## Out of scope (deferred, parked in backlog)

- Live in-cell edit of microcycle table + side-rail sliders for sets/reps/RPE per micro/session/exercise — Round J.
- Paint-bucket "copy settings between exercises" tool — Round J.
- Lock & print microcycle PDF as commit — Round J.
- Logbook upgraded view with graphs and metric fusion — Round K.
- Body maps for injuries / mobility limitations — Round F proper.
- Drawings everywhere — Round F proper.
- PDF "livro de bons costumes" — Round H.

## Files touched (estimated)

- `src/routes/clients_.$clientId.tsx` — wire Concluir to guard + generation; hide standalone CTA on mobile; rewire all `SectionBlock` calls to pass `summary` + `insight` into `RxImplications`; remove `footer` + `SectionAnalysisCard` auto-render in `SectionBlock`.
- New `src/routes/clients_.$clientId.synthesis.tsx` — staged reveal of `AssessmentSynthesisDashboard`.
- Light edit to `runPhasedStart` callsite in `clients_.$clientId.tsx` to navigate to synthesis (or `/me` for client mode) on success.
- `.lovable/backlog.md` — append Round J / Round K parking notes.

No DB migrations. No new server functions. No i18n drift in this round (Cut 1 reuses existing strings; Cut 2 adds 3 short keys to `assessment.json` for the reveal copy).

## Why this is the right pick

You asked to keep doing assessment work cheaply but to also unblock the post-conclude direction. Cut 1 closes two visible regressions (broken Concluir + 3-title clutter) using only file-local refactors — minimal credit cost, immediately verifiable on mobile 390px. Cut 2 builds the cheapest scaffolding that makes the founder vision navigable end-to-end without faking the cockpit; it also forces an honest backlog entry for Rounds J/K so the heavy work has a home.
