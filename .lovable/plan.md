# Round 3 — Assessment Summary PDF (Deterministic)

A 2–3 page PDF built client-side from existing `assessment` + `client` data, generated via the same `jsPDF` stack already used for plans and trainer resources. Zero AI, zero server fns, zero schema.

---

## A. Current PDF architecture

| File | Purpose | Reuse? |
|---|---|---|
| `src/lib/pdf.ts` (1.7k LOC) | Workout plan PDF — jsPDF, fonts, headers, FORGE design tokens | **Reuse** colour/typography helpers only; do NOT extend this file |
| `src/lib/trainer-resource-pdf.ts` | Acquisition/retention info PDF — jsPDF, simple multi-section layout | **Reference** as the layout template (closest in spirit) |
| `src/lib/pdf-types.ts` | Shared types | Reuse |
| `src/lib/download-plan.ts` | Loads plan row + calls `pdf.ts` | Mirror its pattern (load → render → save) |
| `src/lib/compliance.ts` | Disclaimer text helpers | Reuse if a matching string exists; otherwise add new key |

**Do NOT touch** `pdf.ts` (huge, plan-specific) or any server fn.
**Library**: jsPDF (already a dependency, font-embedded).
**No new deps**.

---

## B. Data mapping

| PDF field | Source | Fallback if missing | Safety note |
|---|---|---|---|
| Client name | `clients.full_name` | "Cliente" | — |
| Date | `new Date()` (locale) | — | — |
| Trainer / business | `profiles.business_name` ?? `profiles.full_name` | — | white-label header |
| Goal | `assessment.smart_specific` | "—" | — |
| Goal measure | `assessment.smart_measurable` | omit row | — |
| Experience | `assessment.experience_level` | "—" | drives implications |
| Frequency | `assessment.training_days_per_week` | "—" | — |
| Session length | `assessment.session_duration_minutes` | "—" | — |
| Location | `assessment.training_location` | "—" | — |
| Equipment | `assessment.available_equipment[]` (count + first 6) | "Sem equipamento listado" | — |
| Years training | `assessment.years_training` | omit row | — |
| Self Intake status | `assessmentGroupCounts(a).selfIntake` | always present | from helper |
| Session status | `assessmentGroupCounts(a).session` | always present | from helper |
| Phase | `assessmentPhase(a)` | always present | — |
| PAR-Q yes-count | count `true` in `assessment.parq` | 0 | drives safety row |
| Risk category | `assessment.risk?.bmi_category` | omit | informational only |
| Med flags | `assessment.med_flags[]` | [] | beta_blocker / anticoagulant trigger rules |
| Medications free text | `assessment.medications` | omit | print verbatim, no interpretation |
| Injuries | `assessment.injuries[]` (label + side + severity) | "Sem lesões reportadas" | drives pattern caution |
| Pain notes | `assessment.pain_notes` | omit | — |
| Sleep | `assessment.sleep_quality` | "—" | poor → conservative |
| Stress | `assessment.stress_level` | "—" | high → conservative |
| Readiness stage | `assessment.readiness_stage` | "—" | precontemp/contemp → conservative |
| Daily steps / seated hrs | `ext_daily_steps` / `ext_hours_seated` | omit | low activity → conservative |
| Photos | NOT included | n/a | **excluded for privacy** |
| Missing Session sections | derived from `ASSESSMENT_SESSION_SECTION_IDS` + `isSectionCompleteForPhase` | always derivable | — |

All sources already loaded in `clients_.$clientId.tsx` cockpit — no extra fetch.

---

## C. Deterministic implication rules

Single pure function `buildAssessmentImplications(a, client)` returns `Implication[]`. No AI.

| Condition | Copy (PT) | Severity | Source field | Disclaimer phrasing |
|---|---|---|---|---|
| any PAR-Q `true` | "Existe ≥1 resposta PAR-Q positiva. Recomenda-se confirmação clínica antes de progredir intensidade." | danger | `parq` | "não constitui diagnóstico" |
| `bmi_category` = obese / `risk` high | "Iniciar com tier conservador (MEV) e progressão gradual." | warn | `risk` | — |
| `med_flags` includes `beta_blocker` | "FC pode estar atenuada — preferir RPE/talk test sobre zonas de FC." | warn | `med_flags` | — |
| `med_flags` includes `anticoagulant` | "Cautela com quedas, contacto e impacto. Evitar exercícios de risco." | warn | `med_flags` | — |
| `med_flags` includes `insulin`/`hypoglycemic` | "Atenção a hipoglicemia em sessões longas." | warn | `med_flags` | — |
| `injuries.length > 0` | "Modificar/monitorizar padrões afectados: <patterns list>." | warn | `injuries[*].region` | — |
| `pain_notes` non-empty | "Cliente reportou dor activa — rever antes de carregar padrão." | warn | `pain_notes` | — |
| `sleep_quality === "poor"` OR `stress_level === "high"` | "Recuperação reduzida — começar com tecto RPE conservador (≤7.5) e adiar progressões." | neutral | `sleep_quality`/`stress_level` | — |
| `readiness_stage` ∈ {precontemplation, contemplation} | "Prontidão comportamental baixa — priorizar adesão sobre carga." | neutral | `readiness_stage` | — |
| `experience_level` ∈ {beginner, novice} | "RPE inicial 6.5–7.5, ênfase técnica e padrões base." | neutral | `experience_level` | — |
| `available_equipment.length === 0` | "Sem equipamento — selecção restrita a peso corporal." | neutral | `available_equipment` | — |
| `training_days_per_week ≤ 2` | "Frequência baixa — preferir corpo inteiro por sessão." | neutral | `training_days_per_week` | — |
| `session_duration_minutes < 40` | "Sessões curtas — limitar acessórios, manter padrões principais." | neutral | `session_duration_minutes` | — |
| no conditions match | "Sem cautelas particulares identificadas. Aplicar parâmetros standard de iniciação." | success | — | — |

Severity → colour token (status-tone palette): danger=red, warn=amber, neutral=muted, success=emerald. **Each row prints "Implicação para a prescrição:" — never "diagnóstico" / "tratamento" / "patologia".**

---

## D. UI placement

**Primary (MVP)**: small ghost icon button **"Resumo da avaliação (PDF)"** in the assessment section header on `/clients/$clientId`, next to the existing collapse toggle. Visible whenever `assessment.id` exists, regardless of phase (the PDF itself shows what's missing).

**Secondary**: same action exposed inside the Pre-Plan Review Sheet under "Resumo opcional" — single text link, no big button. Lets the PT export right before generation.

**Excluded for MVP**: `/me` client page (privacy review needed first), no global header menu, no plan-page button. Not added to BMV sheet (would clutter a focused dialog).

Avoid stealing focus from the main "Criar briefing inicial" CTA — both placements use ghost/text styling.

---

## E. Implementation strategy (smallest safe Build)

New files only:
1. `src/lib/pdf-assessment-summary.ts` — pure renderer:
   - `export async function downloadAssessmentSummary({ assessment, client, trainer, locale }): Promise<void>`
   - Internally uses `jsPDF`, mirrors `trainer-resource-pdf.ts` page/section pattern.
   - Calls a new pure helper `buildAssessmentImplications(a)` → `Implication[]`.
   - Calls existing `assessmentGroupCounts` / `assessmentPhase` from `assessment-phase.ts`.
   - Page 1: header + client/goal/training table + status badges.
   - Page 2: implications list (icons via Unicode bullets, tone-coloured chips).
   - Page 3 (conditional): missing-Session checklist OR "Sessão completa" panel.
   - Footer on every page: "Documento de apoio à prescrição. Não constitui diagnóstico nem clearance médico." + page N/M.
2. `src/lib/assessment-implications.ts` — exports `Implication` type + `buildAssessmentImplications`. Pure, unit-testable.

Edits:
3. `src/routes/clients_.$clientId.tsx` — wire button in assessment section header (1 import + 1 onClick handler, ~10 LOC).
4. `src/components/plan/PrePlanReviewSheet.tsx` — optional ghost link "Exportar resumo (PDF)" in footer (passes `assessment` already in scope).
5. `src/i18n/locales/{pt,en}/assessment.json` — new `summary_pdf.*` namespace (titles, section labels, all implication copy, disclaimer).

Not touched: `pdf.ts`, `download-plan.ts`, server fns, schema, RLS, `me.tsx`, plan flow, BriefEditor.

---

## F. i18n strategy

- New namespace block: `assessment.summary_pdf.*`
- PT-PT: full coverage, "você" voice (per memory).
- EN: full coverage, neutral 2nd person.
- ES/HI: fall back to EN per project convention (`assessment.json` is not in the LLM-translated set). Add stubs only if strings are short labels.
- Implication copy: each rule key = `summary_pdf.implications.<rule_id>` so future tone tweaks don't touch code.
- Filename: `Resumo_Avaliacao_<ClientName>_<YYYY-MM-DD>.pdf` (PT) / `Assessment_Summary_...` (EN).

---

## G. Risks

| Risk | Mitigation |
|---|---|
| Overclaiming medical meaning | Mandatory footer disclaimer on every page; rule copy banned from "diagnóstico/tratamento/patologia"; review checklist before merge |
| Too much text | Hard cap: 3 pages; implications max 12 rows; truncate equipment list to 6 + "+N more" |
| Layout complexity | Mirror `trainer-resource-pdf.ts` (proven simple pattern); no tables-with-borders; bullet rows + section dividers only |
| Missing data | Every field has a fallback in §B; PDF is always renderable from an empty `assessment` row (will show "Avaliação por concluir" + missing checklist) |
| Photo privacy | Photos explicitly **excluded** in MVP (documented in code comment) |
| Duplicate PDF logic | New file is small (<400 LOC), independent; does not import from `pdf.ts`; future shared header helper extraction noted in backlog only |
| Filename PII in download | Sanitised via existing slug helper if available; otherwise inline `replace(/[^a-z0-9]+/gi,'_')` |
| jsPDF font glyph gaps for accented PT chars | Use jsPDF's Helvetica (already handles Latin-1); verified working in `trainer-resource-pdf.ts` |

---

## H. Build Mode prompt (next round)

```
Build Mode.

Implement Round 3 only: a deterministic Assessment Summary PDF.

Do not call AI. Do not change schema. Do not touch backend, RLS,
billing, quota, plan generation, BriefEditor, logbook, schedule,
dashboard, /me, or src/lib/pdf.ts.

Create:

1. src/lib/assessment-implications.ts
   - export type Implication = { id: string; severity: "danger"|"warn"|"neutral"|"success"; copyKey: string; copyVars?: Record<string,string|number> }
   - export function buildAssessmentImplications(a: any): Implication[]
   - Rules per Round 3 plan §C, in that exact order.
   - If no rule matches, return [{id:"none", severity:"success", copyKey:"summary_pdf.implications.none"}].
   - Pure function, no I/O.

2. src/lib/pdf-assessment-summary.ts
   - import jsPDF from "jspdf"
   - export async function downloadAssessmentSummary(args: {
       assessment: any; client: any; trainer?: any; locale?: "pt"|"en"; t: (k:string,o?:any)=>string
     }): Promise<void>
   - 2–3 pages max, layout per Round 3 plan §E.
   - Use status-tone colours: danger #ef4444, warn #f59e0b, neutral #94a3b8, success #10b981.
   - Footer on every page with disclaimer + "Página X de Y".
   - Filename: Resumo_Avaliacao_<sanitised name>_<YYYY-MM-DD>.pdf
   - Include assessmentGroupCounts + assessmentPhase from src/lib/assessment-phase.ts
   - Include missing-section checklist using ASSESSMENT_SESSION_SECTION_IDS + isSectionCompleteForPhase.
   - Photos: NOT included (add code comment).

3. Wire one button in src/routes/clients_.$clientId.tsx
   - Ghost icon button "Resumo da avaliação (PDF)" in the assessment
     section header. Show whenever assessment?.id exists.
   - onClick: downloadAssessmentSummary({assessment, client, trainer:profile, locale, t})
   - Wrap in try/catch with toast.error fallback.

4. Wire one optional text link in src/components/plan/PrePlanReviewSheet.tsx
   - Footer left side, ghost variant, "Exportar resumo (PDF)".
   - Same handler. Must NOT trigger any server call.

5. i18n keys under assessment.summary_pdf.* in pt + en
   - title, subtitle, sections.{profile,training,status,implications,session_checklist}
   - phase.{self_intake_pending,session_pending,complete}
   - implications.* for every rule id in §C
   - disclaimer, footer_page
   - Add minimal stubs in es + hi (fallback OK).

Constraints:
- No new npm deps (jsPDF already installed).
- Do NOT edit src/lib/pdf.ts.
- Do NOT add a server fn.
- Do NOT include client photos.
- Do NOT add any AI/LLM call.
- Disclaimer present on every page; copy never uses
  "diagnóstico", "tratamento", "patologia", "clearance médico" except
  inside the disclaimer string itself.

Verify:
- bunx tsc --noEmit passes
- Manually trigger download from cockpit; open the resulting PDF and
  inspect 2–3 pages for clipping, overflow, missing glyphs (PT accents).
- Confirm zero network requests fire when the button is clicked.
- 390px mobile: button doesn't overflow header; click works.

Report:
- files created/edited
- screenshots/QA notes for the rendered PDF (3 pages)
- typecheck result
- whether Round 3 can be considered complete
```

---

## Acceptance criteria (recap)

- Deterministic PDF, no AI.
- No schema changes, no server fns.
- 2–3 pages, includes prescription implications + disclaimer.
- Available from PT cockpit (and optional link in Pre-Plan Review Sheet).
- `bunx tsc --noEmit` passes.
- Photos excluded.
- Every page footer carries the no-diagnosis disclaimer.
