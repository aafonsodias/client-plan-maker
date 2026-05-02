# Plan — Status colour system + Assessment date + Assessment PDF

Three focused fixes. No scope creep into the other waves still pending.

---

## 1. Unify status colours across the app

**Problem.** "Ready / Pronto" is amber (yellow) — same colour we use everywhere else for *warnings* and *attention needed* (intake alerts, validation flags, brief warnings). That makes "ready" look like a problem instead of a success.

**New colour semantics (single source of truth):**

| Meaning | Colour | Used for |
|---|---|---|
| Success / done / ready | **Emerald (green)** | Plan ready, plan finalised, intake submitted, checks passed |
| In progress / neutral stage | **Slate (muted)** | Brief / Blueprint / Microcycle / Progressions stage chips, Draft |
| Attention / warning | **Amber (yellow)** | Red-flag accommodations, validation issues, trial expiring, unresolved alerts |
| Critical / error | **Red** | Hard errors, destructive actions |

**Changes:**

- `src/lib/plan-status.ts` — flip `ready` from amber → emerald (lighter shade than `finalized` so the two are still distinguishable). `finalized` stays emerald but slightly bolder/with a check-style border. `draft` and stage chips stay neutral.
- Audit and align: `IntakeLinkPanel`, `ClientPhasePill`, `BriefSheetButton` badge, `BriefContextRail` warn tone, `AppShell` trial banner, `billing.tsx`, `DropoffAlerts`, `ValidationReport`. Anything that means "good / done" → emerald. Anything that means "watch out" → amber. Nothing in between.
- Add a tiny helper `src/lib/status-tone.ts` exporting `toneClasses({ tone: "success" | "neutral" | "warn" | "danger" })` so future code uses the palette by intent, not by colour name.

---

## 2. Assessment date

**Problem.** Today the only timestamp on an assessment is `created_at` (when the row was inserted). The user wants to record **when the assessment was actually performed** (which can differ — e.g. trainer logs it days later).

**Changes:**

- DB migration: add `assessments.performed_on date` (nullable; backfill with `created_at::date` for existing rows).
- `clients_.$clientId.tsx` assessment header: add a date picker (shadcn `Calendar` in a `Popover`, with `pointer-events-auto`) labelled "Assessment date / Data da avaliação", defaulting to today on new assessments. Save inline (debounced) like the other assessment fields.
- Show the date prominently on the assessment summary card, on the brief context rail, and on the PDF.
- i18n keys in `assessment.json` (EN/PT).

---

## 3. Downloadable assessment report (PDF)

**Problem.** Assessments live only in the app — trainers can't share or archive them.

**Scope.** A clean, brand-aware **2-page max** PDF. Not a dump of every field.

**Layout:**

```text
Page 1 — Snapshot
  Header: Logo · Client name · Assessment date · Trainer
  Block 1 (3 cols): Demographics | Goals (SMART) | Readiness/PAR-Q
  Block 2 (2 cols): Lifestyle (sleep/stress/nutrition/hydration) | Cardio & BP
  Block 3: Movement screen — 4 small score chips (squat, hinge, overhead, SL balance) with notes truncated
  Block 4: Capacity snapshot — squat / hinge / push / pull / carry / lunge as compact rows

Page 2 (only if needed)
  Red flags & accommodations
  Section AI analyses (collapsed to bullet summaries, not full paragraphs)
  Footer: generated date · trainer business name · "Confidential"
```

**Implementation:**

- Add `renderAssessmentPdf(assessment, client, profile, t)` to `src/lib/pdf.ts` (reuse existing jsPDF setup, fonts, brand-colour helpers).
- "Download PDF" button on the assessment header in `clients_.$clientId.tsx`, next to the existing intake controls.
- Filename: `assessment-{client-slug}-{YYYY-MM-DD}.pdf`.
- Locale-aware (EN/PT) labels.
- QA: render once, screenshot to JPEG, eyeball for overflow / clipped text / missing glyphs before shipping.

---

## Out of scope (still queued from earlier waves)
Wave 1 PlanCompactTable, Wave 2 plan-PDF rewrite, Wave 4 blueprint volume caps & exercise editing, Wave 5 daily steps + Concorrente split. Reply if you want any of those folded in; otherwise they stay queued.

---

## Technical notes

- Migration is small (one column + backfill), no RLS changes needed (existing `trainers manage own assessments` policy covers it). Types regenerate automatically.
- New `status-tone.ts` is additive — existing code keeps working until callers migrate. We migrate the high-traffic spots in this pass; the long tail can follow later without breakage.
- PDF reuses `jspdf` already in the bundle — no new deps.
