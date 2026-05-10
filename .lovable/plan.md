## Goal

Turn `assessment-{client}.pdf` from a flat field dump into the **single document a trainer can hand the client** that explains both:

1. **What we found** (synthesis: risk class, recovery, body comp, movement readouts, red flags)
2. **What it means for your training** (programming impact: RPE ceiling, wave model, deload frequency, exercise accommodations — each line tied back to the finding that drove it)

## Why now

Today's PDF (per the screenshot) shows ~10 labels with "—" values, garbled SMART text (`f r o m   c u r r e n t   7 2 ! '   d   5 8`) and zero interpretation. The synthesis dashboard already exists in-app (`AssessmentSynthesisDashboard`); the PDF just isn't using any of it.

## Plan

### 1. Extend `renderAssessmentPdf` signature

`src/lib/pdf.ts`:

```ts
type RenderAssessmentArgs = {
  assessment: any;
  client: { full_name?: string | null; email?: string | null } | null;
  plan?: {                                  // NEW
    title?: string | null;
    programming_variables?: any | null;
    red_flag_accommodations?: Array<{ flag: string; strategy: string; rationale?: string; substitution?: string }> | null;
  } | null;
  sectionAnalyses?: Record<string, { summary?: string | null; red_flags?: string[] } | null>;  // NEW
  t?: (key: string, opts?: any) => string;
};
```

### 2. Add a tiny ASCII sanitiser (fixes the garbled SMART text)

```ts
function ascii(s: string): string {
  return s
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2192/g, "->")
    .replace(/\u2191/g, "↑→up").replace(/\u2191/g, "up")
    .replace(/[^\x00-\xFF]/g, "");
}
```

Wrap every `doc.text(...)` value through `ascii()` (or do it inside a thin `text()` helper used everywhere in this function). Future-proofs against any Unicode the trainer types.

### 3. New page structure

```
┌─────────────────────────────────────────────┐
│ PAGE 1 — SÍNTESE                            │
│  Header (existing, kept)                    │
│  ─ 3 tiles: ACSM Risk · Recovery · BodyComp │
│  ─ Triagem de movimento (radar-as-list):    │
│     Agachamento  4/5 ✓ cleared              │
│     Hip hinge    2/5 ⚠ needs work           │
│     ...                                     │
│  ─ Sinais de alerta (red flags):            │
│     • Lombalgia recorrente   [MODIFY]       │
│     • PA elevada              [MONITOR]     │
├─────────────────────────────────────────────┤
│ PAGE 2 — IMPACTO NA PRESCRIÇÃO              │
│  ─ Variáveis programadas (5 knobs):         │
│     RPE máx        7   "porque sono 5/10 +  │
│                         lombalgia"          │
│     Modelo de onda step  "estabilizar antes │
│                           de wave clássica" │
│     Deload         a cada 4 sem             │
│     Vol↔Int        volume-leaning           │
│  ─ Acomodações por red flag:                │
│     Lombalgia → MODIFY · evitar agachamento │
│       de costas; usar hex-bar; RPE máx 7    │
│     Hipertensão → MONITOR · pausar isométr. │
│  ─ Intenção programática (notes_for_next_…) │
│  ─ Objetivo SMART                           │
├─────────────────────────────────────────────┤
│ PAGE 3 — DADOS BRUTOS (only if not empty)   │
│  Demographics · Lifestyle · Anthropometrics │
│  (existing kv tables, but skip rows with —) │
└─────────────────────────────────────────────┘
```

Footer (existing) kept.

### 4. Helper additions inside `renderAssessmentPdf`

- `tile(label, value, caption, tone)` — renders one of the three synthesis tiles in a row (3-col grid spanning content width)
- `flagRow(flag, strategy, rationale)` — bullet + AVOID/MODIFY/MONITOR/ACCOMMODATE pill (reuse the colour map from `AssessmentSynthesisDashboard`: AVOID=red, MODIFY=amber, MONITOR=teal, ACCOMMODATE=muted)
- `kvWithReason(label, value, reason)` — programming variable + small italic muted "porque …" line below
- `skipIfEmpty(rows)` — only render kv rows where value is not "—" / null

### 5. Movement screen → readout

Pull from `assessment.{pattern}_form_criteria` for each of the 7 patterns and compute `formScore()` (helper already in the route file — extract to a shared `src/lib/assessment-scoring.ts` to use from both places). Render as a 2-column list with `n/5` and a ✓ (≥3) or ⚠ (<3) marker. No actual radar SVG — keeps it simple and readable in print.

### 6. Programming-impact narrative

For each of the 5 knobs in `programming_variables`, render the value plus a short rationale. The rationale comes from a small static lookup (NOT another AI call):

```ts
function rpeReason(pv, a): string {
  if (pv.rpe_ceiling <= 7 && (a.sleep_quality ?? 10) <= 5) return "sono baixo limita intensidade";
  if (pv.rpe_ceiling <= 7 && (a.stress_level ?? 0) >= 7)    return "stress elevado limita intensidade";
  if (pv.rpe_ceiling <= 7) return "primeiro bloco — margem de segurança";
  return "atleta tolera carga próxima do máximo";
}
// similar pure helpers for wave_model, deload_frequency, intensity_volume_tradeoff
```

This keeps the document deterministic and auditable.

### 7. Wire data through at call site

`src/routes/clients_.$clientId.tsx` — both call sites of `renderAssessmentPdf` (the dropdown `Documentos → Download PDF` and the new `Avaliação · PDF` chip) need to pass:

```ts
renderAssessmentPdf({
  assessment,
  client,
  plan: heroPlan
    ? {
        title: heroPlan.title,
        programming_variables: planRow?.programming_variables ?? null,
        red_flag_accommodations: inlineBrief?.accommodations ?? null,
      }
    : null,
  sectionAnalyses,
  t: t as any,
});
```

### 8. Skip-if-empty everywhere

The current PDF prints `—` in every empty cell, which is what made the screenshot look broken. Change `kv()` to filter out rows whose value is empty before deciding row count. If a whole section has no non-empty values, skip the section title too.

## Files touched

- `src/lib/pdf.ts` — bulk of the work (≈250 LoC added in `renderAssessmentPdf`, plus `ascii()` helper).
- `src/lib/assessment-scoring.ts` (NEW, ≈30 LoC) — extracted `formScore` + `PATTERN_IDS` + `parqFlagCount` so both PDF and route share one source of truth.
- `src/routes/clients_.$clientId.tsx` — update both `renderAssessmentPdf(...)` call sites with the extended args; replace local `formScore`/`PATTERN_IDS` imports with the shared module.

No DB migration. No new translations required (PDF text already goes through `tr(key, fallback)`); new keys default-fallback to PT-PT strings.

## Out of scope

- A separate PDF for the plan (already exists via `generatePlanPdf`).
- Real radar SVG in PDF (list readout is enough; can revisit if a trainer asks).
- Re-running stage1 to backfill missing fields — this is a presentation fix, not a generation fix.
- Adding a header logo / white-label (PDF spec already kept logo-less per memory).

## QA checklist before declaring done

1. Render with the same client from the screenshot (Aspiringbaconeer) — confirm SMART measurable shows correctly (`from current 72 -> 58`).
2. Render with a client that has no plan yet — Page 2 must gracefully say "Plano ainda não gerado" instead of crashing.
3. Render with a client with 0 red flags — Red-flags block hidden, not "0 alerts".
4. PDF stays ≤ 3 pages for the typical trainer.
5. Convert to image with `pdftoppm` and visually confirm no overflow / clipping (mandatory PDF-skill QA).

Estimate: ~10–12 credits.
