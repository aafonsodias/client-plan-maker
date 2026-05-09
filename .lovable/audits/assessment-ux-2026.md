# Assessment UX audit — 2026

Scope: 14 sections rendered inline in `src/routes/clients_.$clientId.tsx`
(lines ~1862–2651). Server consumption mapped via `src/server/phased/section-map.ts`
and `src/server/phased/stage1-brief.functions.ts`.

Legend: `keep` · `simplify` · `merge` · `remove`
Required-vs-optional column: **R** = required for Brief, **O** = optional.

---

## 0. Section-level summary

| # | Section | Fields | Est. time | Default state | Headline issues |
|---|---|--:|--:|---|---|
| 1 | PAR-Q+ | 7 yes/no | ~60s | open | Good shape. Just needs "Tudo Não" bulk action. |
| 2 | Risk stratification | 7 (1 toggle, 1 select, 1 chip, 1 derived BMI w/ inline H/W, 3 toggles) | ~90s | open | Height/Weight asked TWICE (here + Anthro "Dados base"). Merge. |
| 3 | Anthropometry | 4 base (sex/DOB/H/W) + 2 measure (waist/hip) + WHR (auto) + 2 advanced (BF%, BF method) | ~90s | open | Sex/DOB/H/W belong to client profile, not assessment. Already grouped — keep but de-dup with Risk. |
| 4 | Medications | 1 free text + 3 chip flags | ~30s | collapsed | Good. |
| 5 | SMART goal | 1 template select + 4 fields (specific/measurable/deadline/context) | ~120s | open | `primary_goal` (free text "context") duplicates `smart_specific` — collapse into one. |
| 6 | Readiness (TTM) | 1 chip group (5 stages) | ~10s | collapsed | Perfect. |
| 7 | Training setup | 1 slider + experience select + days/wk + session min + location (free text!) + plan length + equipment chips + 3 free-text (injuries / med cond / preferences) | ~180s | open | Location = chips. `medical_conditions` duplicates Meds section — remove here. `preferences` rarely consumed — collapse into Notes. |
| 8 | Lifestyle | 2 sliders (sleep/stress) + 5 fields (hours seated, daily steps, job type, energy, recovery) | ~120s | collapsed | `energy_levels` + `recovery_capacity` are subjective free-text duplicating sleep/stress sliders. Remove. `job_type` → chips. |
| 9 | Nutrition | 4 chip groups (meals, alcohol, processed, water) + legacy hydration_glasses (advanced) + notes | ~60s | collapsed | Good chip-first design. `hydration_glasses_per_day` is dead legacy — remove. |
| 10 | Mobility | 6 score rows (shoulder/hip/ankle/thoracic/wrist/knee) + notes | ~120s | open | Wrist + knee rarely scored by general PTs. Move to advanced. |
| 11 | Posture | 2 free-text + 1 dominant-side chip | ~60s | collapsed | `standing_posture_notes` and `known_imbalances` overlap. Merge into single "Notas posturais". |
| 12 | Movement screen | 6 patterns × (form criteria + capacity + not-assessed) | ~5–8 min | collapsed | This is the cognitive heart of the assessment. Keep — but the per-pattern card is dense and warrants its own future round. Out of scope for *simplification*. |
| 13 | Training history | years + previous style + max_lifts | ~60s | collapsed | Good. |
| 14 | Performance | RHR + cardio test select + (conditional) test result + grip strength modal + legacy cardio_capacity | ~60s | collapsed | `cardio_capacity` legacy free-text is dead. Remove. |

Totals (current):
- ~70 visible inputs across 14 sections.
- Median time on a returning trainer: ~12–15 min (target ≤ 8).
- Dead-or-duplicate fields identified for removal: **8** (see § Removals).

---

## 1. PAR-Q+ — verdict per field

| Field | Type | Used by | Verdict | Why |
|---|---|---|---|---|
| `parq.q1`–`q7` | yes/no × 7 | Stage 1 (`parq_passed`), pre-stage safety gate | **keep** | Required for ACSM gate. |
| (missing) "Tudo Não" bulk action | — | — | **add** | 90% of clients answer all No. Ergonomic 1-click. |

## 2. Risk stratification

| Field | Type | Used by | Verdict | Why |
|---|---|---|---|---|
| `risk.family_cvd` | toggle | ACSM risk calc | keep | R |
| `risk.smoking` | select 3 | ACSM risk calc | **simplify** → chip group (Pattern A). 3 chips beats a select for 3 options. |
| `risk.mvpa_min_per_week` | 4-bucket chip | ACSM risk calc | keep | Already chip; great pattern. |
| `risk.bmi_*` (auto from H/W) | derived + override | ACSM risk calc | keep | Pattern F applied. |
| Inline height/weight inputs | numeric | clients table | **merge** | Duplicates Anthro § "Dados base". One canonical input. |
| `risk.dyslipidemia` / `prediabetes` / `hypertension` | toggle × 3 | ACSM risk calc | keep |

## 3. Anthropometry

| Field | Type | Used by | Verdict | Why |
|---|---|---|---|---|
| `clients.sex` | select | brief, BMR, %BF heuristics | keep |
| `clients.date_of_birth` | date | age calc | keep |
| `clients.height_cm` | num | BMI, BMR | keep (canonical here) |
| `clients.weight_kg` | num | BMI, BMR | keep (canonical here) |
| `assessment.waist_cm` | num | WHR, risk | keep |
| `assessment.hip_cm` | num | WHR | keep |
| WHR (derived) | display | risk | keep · Pattern F |
| `body_fat_pct` | num (advanced) | optional | keep · Pattern E (already collapsed) |
| `body_fat_method` | select 5 | display | **simplify** → chip group |

## 4. Medications

| Field | Type | Used by | Verdict |
|---|---|---|---|
| `medications` (free text) | text | Stage 1 safety prompt | keep |
| `med_flags[]` (beta/statin/anticoag) | chip group | safety gate | keep |

## 5. SMART goal

| Field | Type | Used by | Verdict | Why |
|---|---|---|---|---|
| Template select | select | autofill | keep |
| `smart_specific` | text | brief | keep · R |
| `smart_measurable` | text | brief | keep |
| `smart_deadline` | date | brief | keep |
| `primary_goal` ("contexto") | textarea | nothing distinct (Stage 1 mostly reads `smart_specific`) | **remove** | Duplicates `smart_specific`. The goal taxonomy is enforced by AI from the Specific text; the textarea adds noise. |

## 6. Readiness — keep entirely.

## 7. Training setup

| Field | Type | Used by | Verdict |
|---|---|---|---|
| `current_capacity_vs_pb` slider | 1–10 | Stage 1 (load entry tier) | keep |
| `experience_level` | select 3 | Stage 1 tier | **simplify** → chip group (3 options) |
| `training_days_per_week` | num | brief, blueprint | keep |
| `session_duration_minutes` | num | blueprint | keep |
| `training_location` | **free text** | brief | **simplify** → chip group: home / gym / outdoor / hybrid (Pattern A) |
| `duration` (plan length, weeks) | num | local pipeline | keep |
| `available_equipment[]` | chip group | blueprint | keep |
| `injuries` | textarea | brief, safety | keep |
| `medical_conditions` | textarea | brief safety | **remove from here** (already in Medications free-text + flags) |
| `preferences` | textarea | rarely consumed | **merge** into a single "Notas adicionais" (collapse with `injuries` notes) |

## 8. Lifestyle

| Field | Type | Used by | Verdict |
|---|---|---|---|
| `sleep_quality` slider | 1–10 | recovery heuristic | keep |
| `stress_level` slider | 1–10 | recovery heuristic | keep |
| `ext_hours_seated` | num | brief lifestyle line | keep |
| `ext_daily_steps` | num | brief lifestyle line | keep |
| `ext_job_type` | **free text** | display only | **simplify** → chips: sentado / em pé / fisicamente exigente / misto |
| `energy_levels` | textarea | display only | **remove** (subjective; sleep/stress sliders already capture it) |
| `recovery_capacity` | textarea | display only | **remove** (same — duplicates sleep/stress) |

## 9. Nutrition

| Field | Type | Used by | Verdict |
|---|---|---|---|
| `ext_meals_per_day` chips | chips 5 | brief | keep |
| `ext_alcohol_units_week` chips | chips 4 | brief | keep |
| `ext_processed_food_freq` chips | chips 5 | brief | keep |
| `ext_water_l_per_day` chips | chips 5 | brief | keep |
| `hydration_glasses_per_day` (legacy advanced) | num | superseded by water chips | **remove** |
| `nutrition_habits` notes | textarea | brief | keep |

## 10. Mobility

| Field | Type | Used by | Verdict |
|---|---|---|---|
| `ext_mob_shoulder` | score 1–3 | brief | keep |
| `ext_mob_hip` | score | brief | keep |
| `ext_mob_ankle` | score | brief | keep |
| `ext_mob_thoracic` | score | brief | keep |
| `ext_mob_wrist` | score | rarely consumed | **simplify** → move to advanced collapsed group (Pattern E) |
| `ext_mob_knee` | score | rarely consumed | **simplify** → advanced |
| `mobility_limitations` notes | textarea | brief | keep |

## 11. Posture

| Field | Type | Used by | Verdict |
|---|---|---|---|
| `standing_posture_notes` | textarea | brief | **merge** with `known_imbalances` into single "Notas posturais" |
| `known_imbalances` | textarea | brief | **merge** (see above) |
| `dominant_side` | chip 3 | brief | keep |

## 12. Movement screen — out of scope for this round (own audit later). Keep all.

## 13. Training history

| Field | Type | Used by | Verdict |
|---|---|---|---|
| `years_training` | num | brief | keep |
| `previous_program_style` | text | brief | keep |
| `max_lifts` | text | brief, blueprint | keep |

## 14. Performance

| Field | Type | Used by | Verdict |
|---|---|---|---|
| `resting_heart_rate` | num | brief, ACSM | keep · **Pattern B** add placeholder `65` |
| `ext_cardio_test` | select 4 | display | **simplify** → chip 4 |
| `ext_cardio_value` | text (conditional) | display | keep |
| Grip strength modal (Jamar) | modal | display | keep · already collapsed |
| `cardio_capacity` (legacy advanced free-text) | textarea | nothing | **remove** |

---

## Removals consolidated (8 fields)

1. `primary_goal` (textarea "contexto" — duplicates `smart_specific`)
2. `medical_conditions` from Training section (kept only in Medications)
3. `energy_levels` (duplicates sleep/stress)
4. `recovery_capacity` (duplicates sleep/stress)
5. `hydration_glasses_per_day` (legacy, replaced by water chips)
6. `cardio_capacity` (legacy, replaced by `ext_cardio_test`/`value`)
7. `ext_mob_wrist` — kept but moved to advanced collapsed
8. `ext_mob_knee` — kept but moved to advanced collapsed

(Net DB columns proposed for deprecation: 6. The other 2 stay in DB but move to a collapsed "Avançado" panel — no schema change.)

---

## Pattern application map

| Pattern | Applied to |
|---|---|
| **A** chip groups vs free text | risk.smoking, body_fat_method, experience_level, training_location, ext_job_type, ext_cardio_test |
| **B** sensible defaults pre-filled | resting_heart_rate (65), sleep_quality (7), training_days_per_week (3), session_duration_minutes (60) |
| **C** units inline | already done (kg/cm/bpm chips) — extend to RHR + steps |
| **D** group related fields with `bg-muted/30` | merge `standing_posture_notes` + `known_imbalances` into one tonal block; merge injuries/preferences notes |
| **E** collapsible advanced | wrist/knee mobility, body_fat (already), nutrition legacy (already), performance legacy (already) |
| **F** auto-derived | BMI (done), WHR (done) — no new candidates |
| **G** keyboard-first numeric | enforce `inputMode="decimal"` + `tabular-nums` on all `MeasureField` and `Field type="number"` instances |
| **H** remove dead fields | 6 columns + 2 demoted (see Removals) |

At least 5 patterns will land in Step 2.

---

## Required-vs-optional dot

Required for Stage 1 brief generation (subtle dot before label):
- PAR-Q+ all 7
- `clients.sex`, `clients.date_of_birth`, `clients.height_cm`, `clients.weight_kg`
- `smart_specific`, `smart_deadline`
- `experience_level`, `training_days_per_week`, `session_duration_minutes`, `training_location`, `available_equipment`
- `current_capacity_vs_pb`

Everything else: optional (no dot).

---

## Save behavior changes (Step 4)

- Currently many fields auto-save on blur via `setAssessment` + parent debounced flush; some (`clients.height_cm` etc.) save inline. Keep that.
- Replace any toast position `center` with top-of-section subtle "Saved" pill (use existing `CompletionStrip` chrome).
- "Discard draft" button currently lives next to generate CTA → move into a `•••` menu in section header.
- No modal warnings about unsaved changes — confirmed none currently exist beyond the Discard dialog (which stays, hidden behind menu).

---

## Risks for Step 2

1. Removing `primary_goal` requires Stage 1 prompt fallback to `smart_specific` (verify: `stage1-brief.functions.ts:197` already lists `primary_goal` in fields). Need to either (a) keep DB column and stop showing input (deriving from `smart_specific`), or (b) drop column. Recommend (a) for safety.
2. Removing `cardio_capacity` and `hydration_glasses_per_day`: confirm no read in pre-stage analysis (grep showed no consumers). Safe.
3. Movement screen kept untouched — accepts that remains the longest section. Future round.
4. i18n cleanup: en/pt/es/hi keys for removed fields — leave fallback strings to avoid hard misses; mark with `// deprecated` comment.

---

## Acceptance pre-check (what Step 2 still has to deliver)

- [ ] Visual diffs for PAR-Q+ / Anthropometry / Movement screen (before-after) in `.lovable/design/assessment-before-after/`
- [ ] Required-dot rendering on the 13 fields above
- [ ] Top-of-section "Saved" strip (no center toast)
- [ ] Discard moved to `•••` menu
- [ ] 375px Mobile Safari smoke
- [ ] `verify-capacity-i18n.ts` still passes
- [ ] Stage 1 brief generates against the simplified shape (regression test on demo client)

End of audit. Awaiting go-ahead before applying Step 2.