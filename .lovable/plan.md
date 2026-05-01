# Round 2 — Corrections + Movement Competency Rework

Strict order. Typecheck after each step. **Stop after B4** and show the new Movement Screen + radar before continuing to Item 7.

---

## A1 — Replace snapshot card with inline link

In `src/routes/clients_.$clientId.tsx`:

- Delete the `<ClientSnapshotCard … />` render at line 1134 and the entire `function ClientSnapshotCard(...)` definition (line 2549). Drop unused props/imports.
- Next to the client name in the header, render a small inline element:
  - `Última avaliação · {DD/MM/YYYY of assessment.updated_at}` followed by an arrow button.
  - On click: `document.getElementById('sintese-da-avaliacao')?.scrollIntoView({ behavior: 'smooth' })`.
  - Hide the link if no assessment exists yet.
- Add `id="sintese-da-avaliacao"` to the wrapper around `<AssessmentSynthesisDashboard … />` (line ~1658).
- Format date via `new Intl.DateTimeFormat(i18n.language, { day: '2-digit', month: '2-digit', year: 'numeric' })`.

## A2 — Force locale re-analysis of cached AI outputs

**Migration** (new file `supabase/migrations/<ts>_section_analyses_locale.sql`):

```sql
alter table public.assessments
  add column if not exists section_analyses_locale jsonb not null default '{}'::jsonb;
```

**Server (`src/server/phased/pre-stage.functions.ts`)**:

- Extend `InputSchema` with optional `locale: z.string().default('pt-PT')`.
- On every successful write, also write `section_analyses_locale[section] = locale` alongside `section_analyses` and `sections_analysed_at`.
- Extend `getSectionAnalysisCoverage` to also return `analyses_locale: Record<string,string>`.

**Client (`clients_.$clientId.tsx`)**:

- After loading coverage, compare `i18n.language` (mapped to `'pt-PT'` or `'en-GB'`) vs `analyses_locale[sectionId]`. For mismatches: drop from local `sectionAnalyses` map and enqueue `analyzeAssessmentSection({ section, force: true, locale })` through the existing autosave / coverage refresh hook.
- Add a "Re-analisar avaliação" button in the assessment header next to Expand/Collapse:
  - Confirms via dialog (cost note ~€0.05).
  - Iterates the 14 sections sequentially, calls `analyzeAssessmentSection({ force: true, locale })`.
  - Shows progress `N/14` with `<Loader2 />`.
  - Disables Expand/Collapse during run; re-renders synthesis when done.

## A3 — Translate remaining English UI bleeds

Pure i18n sweep. Add missing keys to `src/i18n/locales/{pt,en}/{common,assessment}.json`. Replace literals in:

- `**IntakeLinkPanel.tsx**`: "Client intake link" → `intake.link_label` (`LINK DE AVALIAÇÃO DO CLIENTE`); "Generate intake link" → `Gerar link de avaliação`; helper text → `Envie um link ao seu cliente para preencher as secções de autoavaliação a partir do telemóvel.`; toasts ("Intake link ready", "Link copied", "Intake marked reviewed"); WhatsApp/email body templates → pt-PT formal ("Olá {nome}, …").
- `**StageCard.tsx**`: accept `regenerateLabel` / `generatingLabel` / `placeholderLabel` props; default still EN, but every call site in `clients_.$clientId.tsx` passes pt-PT (`Regenerar`, `Aprovar`, `A gerar…`, `Aparece aqui assim que a etapa anterior for aprovada.`, `Etapa N — {title}`).
- `**BriefEditor.tsx**`: All Card titles, Field labels, placeholders, "No red flags…" empty state → pt-PT keys. Equipment options, deload styles, splits, etc. read from a new `src/lib/brief-labels.ts`:
  ```ts
  export const PRIMARY_GOAL_LABELS_PT: Record<string,string> = {
    hypertrophy: 'Hipertrofia', strength: 'Força', conditioning: 'Condição física',
    mixed: 'Misto', fat_loss: 'Perda de gordura', general: 'Geral',
  };
  export const TRAINING_AGE_LABELS_PT = { beginner:'Iniciante', intermediate:'Intermédio', advanced:'Avançado' };
  export const TRAINING_SPLIT_LABELS_PT = { full_body:'Corpo inteiro', upper_lower:'Superior / Inferior', ppl:'Empurrar / Puxar / Pernas', pplc:'Empurrar / Puxar / Pernas / Core', ppl_x2:'PPL (×2/sem)', body_part_split:'Por grupo muscular', custom:'Personalizado' };
  export const DELOAD_FREQUENCY_LABELS_PT = { every_3_weeks:'A cada 3 semanas', every_4_weeks:'A cada 4 semanas', every_5_weeks:'A cada 5 semanas', every_6_weeks:'A cada 6 semanas', no_deload:'Sem deload' };
  export const DELOAD_STYLE_LABELS_PT = { volume_reduction:'Redução de volume (-30%)', intensity_reduction:'Redução de intensidade (-15% carga)', full_rest_week:'Semana de descanso total', mixed:'Misto (-15% carga e -30% volume)' };
  export const EXERCISE_BIAS_LABELS_PT = { compound_first:'Compostos primeiro', balanced:'Equilibrado', isolation_friendly:'Favorável a isolamento', bodyweight_friendly:'Favorável a peso corporal', equipment_flexible:'Flexível a equipamento' };
  export const INT_VOL_LABELS_PT = { high_int_low_vol:'Alta intensidade / baixo volume', moderate_moderate:'Moderado / moderado', moderate_int_high_vol:'Intensidade moderada / volume alto', low_int_very_high_vol:'Baixa intensidade / volume muito alto' };
  export const FLAG_STRATEGY_LABELS_PT = { AVOID:'Evitar', MODIFY:'Modificar', MONITOR:'Monitorizar', ACCOMMODATE:'Acomodar' };
  ```
  DB values stay canonical (e.g. `fat_loss`); only the visible `<option>` text uses the map.
- Sweep `clients_.$clientId.tsx` and `AppShell.tsx` for any remaining `"Brief preview"`, `"All clients"`, `"Approve brief"`, etc. and route through `t(...)`.

## A4 — Deterministic and AI insight mutually exclusive

In `clients_.$clientId.tsx` (the `SectionBlock` / per-section render):

- Compute `hasAiInsight = !!sectionAnalyses[sectionId]` (anything with at least one non-empty field).
- When `hasAiInsight`, do NOT render the deterministic stub (the `✓ Objetivo registado: …` snippet, etc.). Render only `<SectionAnalysisCard />`.
- When no AI insight (yet, or stripped by A2), keep the deterministic stub as fallback.

---

**A5 — Blood pressure measurement**

Critical gap: ACSM risk stratification requires measured BP, not just a toggle. The current "Hipertensão" toggle is self-reported and can mask stage-2 HTN where exercise clearance is mandatory.

Migration (new file `supabase/migrations/<ts>_blood_pressure.sql`):

sql

```sql
alter table public.assessments
  add column if not exists systolic_bp_mmhg int,
  add column if not exists diastolic_bp_mmhg int,
  add column if not exists bp_measured_at timestamptz;
```

Update `public.validate_assessment_ranges` to enforce: `systolic_bp_mmhg between 70 and 220`, `diastolic_bp_mmhg between 40 and 130` when present.

UI — in the Estratificação de Risco section, above the existing toggles, add a two-input row:

- "Pressão sistólica (mmHg)" — number input
- "Pressão diastólica (mmHg)" — number input
- Small "ⓘ Como medir" tooltip: cliente sentado, 5 min de descanso, braço apoiado ao nível do coração, 2 medições com 1 min de intervalo, registar a média.

Auto-categorize per AHA 2017 thresholds in a new `src/lib/blood-pressure.ts`:

ts

```ts
export function categorizeBp(sbp: number | null, dbp: number | null):
  'normal' | 'elevated' | 'stage1' | 'stage2' | 'crisis' | null {
  if (sbp == null || dbp == null) return null;
  if (sbp > 180 || dbp > 120) return 'crisis';
  if (sbp >= 140 || dbp >= 90) return 'stage2';
  if (sbp >= 130 || dbp >= 80) return 'stage1';
  if (sbp >= 120 && dbp < 80) return 'elevated';
  return 'normal';
}
```

Render category as a pill below the inputs (colours: normal=green, elevated=amber, stage1=orange, stage2=red, crisis=red+pulsing).

If category is `stage1` or higher: auto-toggle the existing `risk.hypertension` flag (cannot be unchecked while measured BP indicates HTN).

If category is `crisis`: render a red banner across the section: **"⚠ URGENTE — encaminhar para serviço médico antes de qualquer atividade física. Não prosseguir com a avaliação até clearance."** Block the "Gerar rascunho do plano" button while crisis is active.

Update `src/server/phased/risk-stratification.ts` (or wherever ACSM category is computed) to use measured BP when present, fall back to toggle otherwise.

`pickSectionPayload('risk', a)` adds `systolic_bp_mmhg`, `diastolic_bp_mmhg`, `bp_category` (computed).

Synthesis dashboard: add BP to the ACSM stat card subtitle when measured ("Sem necessidade de clearance · TA 118/76").

Brief AI prompt (in `synthesizeBrief`): "If `bp_category === 'stage2'`, recommend cardiology clearance and prescribe RPE ≤ 7 for first 2 weeks. If `crisis`, refuse to generate a plan and output a clearance-required brief instead."

&nbsp;

## B — Movement competency objectivity rework

### B1 — Form criteria (checkboxes)

**Migration** (single file with B2):

```sql
alter table public.assessments
  add column if not exists squat_form_criteria  jsonb default '{}'::jsonb,
  add column if not exists hinge_form_criteria  jsonb default '{}'::jsonb,
  add column if not exists push_form_criteria   jsonb default '{}'::jsonb,
  add column if not exists pull_form_criteria   jsonb default '{}'::jsonb,
  add column if not exists carry_form_criteria  jsonb default '{}'::jsonb,
  add column if not exists lunge_form_criteria  jsonb default '{}'::jsonb,
  add column if not exists squat_capacity  jsonb default '{}'::jsonb,
  add column if not exists hinge_capacity  jsonb default '{}'::jsonb,
  add column if not exists push_capacity   jsonb default '{}'::jsonb,
  add column if not exists pull_capacity   jsonb default '{}'::jsonb,
  add column if not exists carry_capacity  jsonb default '{}'::jsonb,
  add column if not exists lunge_capacity  jsonb default '{}'::jsonb,
  add column if not exists screen_not_assessed jsonb default '{}'::jsonb;
  -- screen_not_assessed: { squat: true, ... }
```

New file `src/lib/movement-criteria.ts` exporting per-pattern arrays of `{ key, label_pt, tooltip_pt }`, exactly the 30 criteria from the prompt (5×6).

New component `src/components/MovementPatternCard.tsx`: for one pattern, renders:

- Header with pattern label + computed `Forma: N/5`.
- 5 checkboxes with `ⓘ` Tooltip per line.
- "Ainda não avaliado" toggle (writes `screen_not_assessed[pattern] = true`, disables checkboxes & capacity).
- Capacity sub-section (B2).

In `clients_.$clientId.tsx`, replace the current `screen` section body (the 4 `<ScreenItem … />` block at ~line 1425) with `<MovementPatternCard pattern="squat" … />` × 6. Drop the legacy `squat_depth_score / overhead_reach_score / hip_hinge_score / single_leg_balance_score` rendering (keep DB columns, do not read them anymore).

`PROV_SECTION_FIELDS.screen` updated to the 12 new fields + `screen_not_assessed`.

### B2 — Capacity fields

Same `MovementPatternCard` renders, below the criteria block, two optional inputs per pattern:


| Pattern | Field A                        | Field B                 |
| ------- | ------------------------------ | ----------------------- |
| squat   | reps até falha (peso corporal) | 1RM (kg)                |
| hinge   | KB swings em 60s               | RDL 1RM (kg)            |
| push    | flexões estritas até falha     | Shoulder press 1RM (kg) |
| pull    | dead hang (s)                  | pull-ups (reps)         |
| carry   | carga (kg)                     | distância (m)           |
| lunge   | walking lunge reps por lado    | —                       |


Stored as e.g. `squat_capacity = { reps_to_failure: 12, one_rm_kg: null }`. Schema for keys defined in `src/lib/movement-criteria.ts`.

`pickSectionPayload('screen', a)` in `src/server/phased/section-map.ts` now returns:

```ts
{
  squat_form_criteria: a.squat_form_criteria, squat_capacity: a.squat_capacity,
  hinge_form_criteria: …, hinge_capacity: …,
  push_form_criteria:  …, push_capacity:  …,
  pull_form_criteria:  …, pull_capacity:  …,
  carry_form_criteria: …, carry_capacity: …,
  lunge_form_criteria: …, lunge_capacity: …,
  not_assessed: a.screen_not_assessed,
}
```

Update `SECTION_BRIEF_CONTRIBUTIONS.screen` to also include `notes_for_next_stage` so the AI can comment on capacity gaps.  
  


---

**Append to B2 — lunge needs Field B**

Lunge currently has only one capacity field. Add Field B: **Bulgarian split squat 1RM (kg)**.

Update the table:

| lunge | walking lunge reps por lado | Bulgarian split squat 1RM (kg) |

Stored as `lunge_capacity = { walking_lunge_reps_per_side, bulgarian_one_rm_kg }`. Already covered by the threshold function above.

### B3 — `current_capacity_vs_pb` global field

**Migration** (append to the same file):

```sql
alter table public.assessments
  add column if not exists current_capacity_vs_pb int;

-- Validate via existing validate_assessment_ranges trigger:
-- extend the function to enforce 1..10
```

Update `public.validate_assessment_ranges` to also raise if `current_capacity_vs_pb` is outside 1..10.

UI: in the **Setup** section ("training" id), add a slider 1–10 above split/equipment with the rebuild copy from the prompt. Tooltip text included verbatim. Persisted via existing autosave path.

`pickSectionPayload('training', …)` adds `current_capacity_vs_pb`.

In `src/server/phased/stage1-brief.functions.ts` `synthesizeBrief` system prompt, append the rebuild/moderate/normal block from the prompt.

`BriefSchema` (in `src/server/phased/schemas.ts`): add

```ts
current_capacity_vs_pb: z.number().int().min(1).max(10).nullable().default(null),
```

and surface it in `BriefEditor` "Schedule & emphasis" card as an inline pill ("Capacidade actual: 4/10 — modo reconstrução").

### B4 — Update `MovementCompetencyRadar`

In `clients_.$clientId.tsx` (component at ~line 2618):

- Read **form** scores from `*_form_criteria`: count truthy values / 5, scaled to 0..1.
- Read **capacity** scores via a new file `src/lib/capacity-thresholds.ts`:
  ```ts
  // Each entry maps a measured value to a 0..1 score using piecewise thresholds.
  export function squatCapacityScore(c: any): number | null { /* reps & 1RM rules */ }
  // …one per pattern. Returns null if no measurement provided.
  ```
- For each axis decide: `notAssessed` (toggle on, OR no form data + no capacity data) → render dashed grey radial line, no dot.
- Render two polygons: solid orange (form), dashed grey (capacity). Skip dashed polygon if zero capacity points.
- Caption below: `Forma vs Capacidade · {N}/6 padrões avaliados` where N counts patterns with at least one of the two layers.

**Append to B4 — capacity threshold spec**

The new `src/lib/capacity-thresholds.ts` MUST use these explicit thresholds, not Lovable's guess (otherwise the radar will inflate again). Use piecewise linear interpolation:

ts

```ts
// Each function returns 0..1 or null. Tunable per population later.
export function squatCapacityScore(c: any): number | null {
  const reps = c?.reps_to_failure;
  const oneRm = c?.one_rm_kg;
  if (reps != null) return clamp01(reps / 30); // 30 BW reps = 1.0
  if (oneRm != null) return clamp01((oneRm / 100) * 0.6); // 100kg ≈ 0.6 (intermediate baseline)
  return null;
}
export function hingeCapacityScore(c: any): number | null {
  if (c?.kb_swings_60s != null) return clamp01(c.kb_swings_60s / 40);
  if (c?.rdl_one_rm_kg != null) return clamp01((c.rdl_one_rm_kg / 120) * 0.6);
  return null;
}
export function pushCapacityScore(c: any): number | null {
  if (c?.strict_pushups != null) return clamp01(c.strict_pushups / 30);
  if (c?.shoulder_press_one_rm_kg != null) return clamp01((c.shoulder_press_one_rm_kg / 60) * 0.6);
  return null;
}
export function pullCapacityScore(c: any): number | null {
  if (c?.pullups != null) return clamp01(c.pullups / 15);
  if (c?.dead_hang_seconds != null) return clamp01(c.dead_hang_seconds / 60);
  return null;
}
export function carryCapacityScore(c: any): number | null {
  // Combined: load (kg) × distance (m) normalized
  if (c?.load_kg != null && c?.distance_m != null) {
    const work = c.load_kg * c.distance_m;
    return clamp01(work / 2400); // 60kg × 40m = baseline 1.0
  }
  return null;
}
export function lungeCapacityScore(c: any): number | null {
  if (c?.walking_lunge_reps_per_side != null) return clamp01(c.walking_lunge_reps_per_side / 20);
  if (c?.bulgarian_one_rm_kg != null) return clamp01((c.bulgarian_one_rm_kg / 50) * 0.6);
  return null;
}
function clamp01(n: number) { return Math.max(0, Math.min(1, n)); }
```

These are intermediate/general-population baselines. Document at top of file: "Thresholds calibrated for general adult fitness — adjust factors in `CAPACITY_BASELINES` map for athletic populations later."

---

## ⏸ STOP — show preview here

Acceptance for stop point:
(a) snapshot card gone, arrow link in header scrolls to synthesis;
(b) page renders fully in pt-PT after re-analysis;
(c) Stage card buttons say `Regenerar` / `Aprovar`;
(d) Movement Screen shows checkboxes per pattern, no 1–5 sliders;
(e) capacity fields render below criteria;
(f) `current_capacity_vs_pb` slider in Setup;
(g) radar shows form (solid) + capacity (dashed) layers.

---

## Item 7 (reduced) — `HowToAssess` for non-screen sections only

After approval of B4 preview:

- Build `src/components/HowToAssess.tsx` (collapsible "Como avaliar" panel).
- Render only on: **Mobilidade** (shoulder/hip/ankle 1–5 rubric), **Postura & Alinhamento** (plumbline + common deviations), **Antropometria** (waist narrowest end-exhalation, hip greater trochanter, BF SOPs).
- Do NOT render on the Movement Screen — the criterion checkboxes are the SOPs.

Items 8–13 from the previous round resume after Item 7 and are not re-planned here.

---

## Technical notes

- All migrations use `add column if not exists` to be re-runnable.
- Locale strings in PT use European Portuguese formal "você" (`o seu`, `a sua`).
- New AI calls (`analyzeAssessmentSection` with `locale: 'pt-PT'`) reuse the existing prompt — the prompt already enforces pt-PT (added in round 1); we are now invalidating stale cache so it actually takes effect.
- No changes to `src/integrations/supabase/client.ts` or `types.ts` (auto-generated).
- Typecheck after A1, A2, A3, A4, B1, B2, B3, B4.

&nbsp;