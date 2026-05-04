## Round 40 — Close R39 carry-overs (PDF richness footer + small polish)

The remaining open items split into "real round" (WeekMatrix desktop, adaptive repeat assessments, backend verified pipeline) and "shippable now". This round ships the now-items and parks the rest honestly.

### Ship this round

1. **PDF richness footer** (R36 carry-over)
   - `PdfMeta.assessment_completion_pct` (already persisted on `workout_plans`).
   - `download-plan.ts` passes it through.
   - `generatePlanPdf` cover footer line: `Avaliação: 86% · gerado 04 Mai 2026` so the trainer sees how solid the inputs were before they print.
   - Tonal hint: <60% muted/red, 60–80% amber, ≥80% emerald.

2. **PDF "Esta semana" honesty when only Week 1 exists**
   - When `selectedWeekN > totalWeeksInPlan`, fall back to `weeksMap.get(1)` and show an amber "Mostrando Semana 1 — semanas seguintes ainda não geradas" banner on the cover. No silent empty PDFs.

3. **Plano final row — current-week default**
   - Default the per-week select to the latest week with any `approved_at` day; fall back to W1.
   - Tiny `useMemo` over `workout_plan_days` already loaded for the plan row.

4. **i18n: PDF strings**
   - Move new copy (`BLOCO N · SEMANA W DE T`, `ESTA SEMANA`, footer richness label, week-tags `base/+load/+reps/deload`) into `pdf.weekly.*` keys in `pt/plan.json` + `en/plan.json`. Default still PT.

5. **Backlog housekeeping**
   - Mark R39 closed.
   - Re-park: WeekMatrix desktop view, adaptive repeat assessments, backend verified pipeline — each is a real round, called out as such.
   - Open R40 closed list with the four items above.

### Out of scope (parked, called out in backlog)

- WeekMatrix desktop view — full grid surface, not a small polish.
- Adaptive repeat assessments — needs schema design (assessment versions, context-aware question sets).
- Real verified/cert backend (currently founder-email gate).

### Files touched

- `src/lib/pdf.ts` — richness footer, "Mostrando Semana 1" fallback banner, i18n hooks.
- `src/lib/download-plan.ts` — pass `assessment_completion_pct`.
- `src/routes/clients_.$clientId.tsx` — default-week computation in Plano final row.
- `src/i18n/locales/{pt,en}/plan.json` — new `pdf.weekly.*` keys.
- `.lovable/backlog.md` — R40 closed + re-parked items.

### Expected result

Single-week PDF cover now answers three questions at a glance: where this week sits in the meso (chip strip), how rich the assessment was (footer richness chip), and whether the rest of the plan really exists (honest banner if only W1 is generated). Plano final row defaults to the most useful week instead of always W1.
