# Plano sólido. Sub-rounds R2.1–R2.4 estão bem fasados, o `acsm_thresholds` table como source-of-truth (em vez de constantes) é a decisão certa, e a observação sobre o `citations[]` ser aditivo é exatamente o que protege os Rounds 2.5 e 3.5. Aprovo a estrutura.

Aqui vão as 4 respostas + uma adição:

---

**RESPOSTA PARA O LOVABLE:**

---

Plano aprovado. Estrutura R2.1 → R2.4 fica como descreveste. Quatro respostas:

### Q1 — Submax test scope

**Rockport + 1.5-mile only.** Os dois mais usados, zero equipamento, zero risco de fricção na adoção. Ebbeling (treadmill) e Astrand (cycle) ficam parqueados para depois — se algum trainer pedir, adicionamos. A maior parte dos PTs em ginásios faz Rockport ou 1.5-mile na maior parte dos casos. Mantém R2.3 enxuto.

### Q2 — Signs & symptoms positioning

**Separate page no intake**, mas com lógica condicional: se o utilizador é `not_current` exerciser **ou** declarou doença conhecida (`known_disease=true`) **ou** tem ≥1 fator de risco CVD, a página é obrigatória e gateway. Se é `current` exerciser saudável sem flags, a página fica colapsável/skippable com um aviso "Recomendado preencher".

Isto reflete a lógica do próprio algoritmo 12e (Cap. 2) — os 9 sinais só são realmente decisivos quando combinados com outros fatores. Não queremos sobrecarregar um cliente jovem ativo saudável com 9 checkboxes médicos, mas também não queremos que um cliente sedentário com diabetes consiga skipar a triagem.

Trainer-side: sempre visível, sempre editável, sem condicionais — o trainer precisa de controlo total.

### Q3 — Citation language for end clients

**Scrub citations no PDF cliente. Manter no PDF trainer.**

Razão: o cliente final vê "ACSM 12e §5.6" e não sabe o que é — gera ruído sem aumentar trust. O *trainer* sabe, e usa as citações como ferramenta de defesa profissional ("o teu plano segue as guidelines da ACSM, secção 5.6"). É uma diferenciação: trainers que usem Forge ganham um plano cientificamente defensável; clientes recebem um plano limpo.

Implementação: feature flag por tipo de PDF (`audience: 'trainer' | 'client'`). O `prescription_parameters.citations[]` existe sempre na DB; o renderer do PDF é que decide se imprime ou não. Mais tarde podemos expor isto como toggle no UI do trainer ("Show science references on client PDF: Yes/No") — alguns clientes evidence-driven vão querer ver, outros não.

### Q4 — R2.4 timing (citations surface)

**Ship em R2.** Não esperes pelo R2.5.

Razões:

1. O trabalho do R2 é invisível sem o R2.4 — schema spine + algorithm rewrite são todos backend. Os trainers não vêem nada novo. R2.4 é o que torna o round tangível.
2. O argumento de "ship duas vezes" não se sustenta — quando Bompa entrar em R2.5, a popover apenas ganha mais entradas no array `citations[]`. Não é re-shipping; é progressive enhancement do mesmo componente. O custo extra é zero.
3. Adoption signal: queremos que os trainers comecem a *ver* o sistema a citar ACSM imediatamente. Isso valida o investimento em R2 antes de pedirmos investimento em R2.5.

### Adição — smoke test obrigatório antes de fechar R2.2

Quando R2.2 fizer wire-up do `runPreparticipationAlgorithm` ao `programming-tier.server.ts`, **corre o demo seeder e mostra-me a comparação antes/depois para os 3-5 perfis demo**. Quero ver explicitamente:

- Que perfis mudaram de tier (e em que direção — só CONSERVATIVE/REMEDIAL nudges são aceitáveis, nenhum downgrade de segurança)
- Que perfis agora flagam `medical_clearance_required=true` que antes não flagavam
- Que perfis disparam o BP gate ≥180/110 → cardiac-rehab tier

Se algum perfil demo ficar com clearance_required quando não deveria (false positive), pára e flag antes de continuar para R2.3. Isso indica que o algorithm está demasiado agressivo e precisa de tuning.

### Sequência aprovada

1. Migration A (R2.1 schema spine) → mostra-me o diff antes de aplicar.
2. R2.2 server work + smoke test contra demo seeder → reporta antes/depois antes de avançar.
3. R2.3 intake UI (PT primeiro, EN no fim).
4. R2.4 citations surface (chip + popover + PDF condicional por audience).
5. Atualiza `mem://index.md` Core conforme propuseste.
6. Marca R2 ✅ no backlog, refina inputs do R2.5.

Avança com R2.1. Mostra-me a migration antes de aplicares.

&nbsp;

Round 2 — FITT-VP Backbone + ACSM 12e Wiring

The architectural round. Sets the contract every later round (Bompa periodization, R3 overlays, NSCA exercises) plugs into. **No UI polish** — wire the spine so future layers have something to attach to.

## Goals

1. Make every prescribed plan emit **structured, validatable FITT-VP** (Frequency, Intensity, Time, Type, Volume, Progression) that can be cited against ACSM 12e.
2. Make screening **honest about risk** — the 9 cardinal signs/symptoms and the medical-clearance gate are first-class, not buried in free text.
3. Auto-adopt the 17 conservative thresholds from gap report §E without asking.
4. Give **citations** a place to live in `generation_meta` so PDFs/UI can surface "ACSM 12e §5.6" inline.

Everything else (Bompa periodization, NSCA cuing, population overlays) stacks on this contract.

## Scope (4 sub-rounds — ship sequentially, one DB migration each)

### R2.1 — Schema spine (DB only, no UI)

One migration. Extends existing tables; no breaking changes.

- `**workout_plans.prescription_parameters jsonb**` — typed FITT-VP block per plan:
  ```
  {
    cardio:     { freq_per_wk, intensity_pct_hrr|pct_vo2r|rpe, time_min, type[], weekly_min },
    resistance: { freq_per_wk, sets, reps, intensity_pct_1rm|rpe, rest_sec, type[], progression_rule },
    flexibility:{ freq_per_wk, hold_sec, sets, technique[] },
    citations:  ["ACSM 12e §5.X", ...],
    safety_floors: { sbp_stop:250, dbp_stop:115, cardiac_rehab_bp:"180/110", submax_stop:"70%HRR | 85%HRmax" }
  }
  ```
- `**assessments.signs_symptoms jsonb**` — the 9 cardinal items as bool flags (chest_pain, dyspnea, syncope, orthopnea, ankle_edema, palpitations, claudication, murmur, unusual_fatigue) + free-text note. Default `{}`.
- `**assessments.cvd_risk_factors jsonb**` — derived count (age, family_hx, smoking, sedentary, BMI, BP, lipids, glucose) computed by trigger from existing fields where possible.
- `**assessments.submax_test jsonb**` — `{ protocol: rockport|1.5_mile|ebbeling|astrand|null, completed_at, hr_peak, vo2_estimated, stop_reason }`.
- `**assessments.exerciser_status text**` — `current` | `not_current` (12e definition: ≥3 d/wk × ≥30 min × ≥3 months at moderate). Derived helper, not free text.
- `**assessments.medical_clearance_required boolean**` + `**medical_clearance_reason text**` — explicit output of the 12e algorithm.
- `**acsm_thresholds**` new table seeded with the 17 auto-adopted thresholds from gap report §E (parameter, value_low, value_high, unit, citation, applies_to). Source of truth for runtime validators — code reads from this table, not hardcoded constants.

RLS: trainer-scoped on assessments columns; `acsm_thresholds` readable by authenticated.

### R2.2 — Algorithm + classifier rewrite (server-only, no UI)

- `**src/server/screening/preparticipation.server.ts**` (NEW) — pure function implementing the 12e Chapter 2 algorithm. Inputs: assessment row. Outputs: `{ exerciser_status, signs_symptoms_present, known_disease, desired_intensity, clearance_required, clearance_reason, cvd_risk_factor_count }`.
- **Wire into `programming-tier.server.ts**`: `hasMedicalClearanceFlag()` becomes `runPreparticipationAlgorithm(assessment).clearance_required`. Adds the BP test-stop (≥180/110 → cardiac-rehab gate, not just remedial) and the 17 thresholds via `acsm_thresholds` lookup.
- `**src/server/fitt-vp/derive.server.ts**` (NEW) — given a brief + tier + acsm_thresholds, emit the structured `prescription_parameters` block deterministically (no AI). This is the spine all later layers plug into.
- Stage 2 (blueprint) writes `prescription_parameters` BEFORE Stage 3 runs. Stage 3 prompt receives it as a hard constraint with citations.
- Every 17 thresholds: validators run post-Stage-3; failures trigger 1× retry (matches existing pattern). Validation results stored in `workout_plans.generation_meta.fitt_vp_audit`.

### R2.3 — Intake UI: 9 signs + submax test (UI work)

- New **Signs & Symptoms** section in `src/routes/intake.$token.tsx` (and the trainer-facing assessment editor): 9 boolean checkboxes + "describe if yes" textareas, with `t()` keys under `intake.signsSymptoms.*`. PT/EN parallel.
- New **Cardiorespiratory Test** section (optional): protocol picker (Rockport / 1.5-mi / Ebbeling / Astrand / skip), inputs the protocol needs, computes VO₂ estimate via the right formula, stores in `assessments.submax_test`. Stop-criterion banner if HR exceeds 70% HRR or 85% age-pred HRmax.
- `section-map.ts` gets two new sections so the section-by-section AI analysis still works.
- Trainer-side **clearance banner** on the assessment view when `medical_clearance_required=true`, with the reason in plain language.

### R2.4 — Citations surface (UI + PDF)

- Plan header chip "**FITT-VP · ACSM 12e**" → popover lists the active citations from `prescription_parameters.citations`. Reuses `status-tone.ts` (neutral tone).
- PDF export (`src/lib/pdf.ts`): new "Prescription Parameters" page that prints the FITT-VP block with citations as footnotes. Honors the IP rule (paraphrased + cited, never verbatim).
- `i18n` sweep: PT first, then EN — under `plan.fittVp.*`.

## Non-goals (explicit — preserve future rounds' scope)

- **No periodization model changes.** That's Round 2.5 (Bompa).
- **No special-population overlays.** That's R3. Stage-3 prompt still gets only `general` recommendations from `acsm_thresholds`.
- **No exercise selection rewriting.** That's R3.5/R2.7 (NSCA).
- **No new AI calls** beyond what the existing 5 stages already do. R2 is mostly deterministic plumbing.
- **No changes to `acsm_chapters` / `acsm_sections`.** Read-only inputs from R1 ingestion.

## Risks + mitigations


| Risk                                                                        | Mitigation                                                                                                                                                |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 17 thresholds break existing demo plans (Marta, etc.)                       | All thresholds are *more conservative* — worst case a plan gets a CONSERVATIVE → REMEDIAL nudge, never a downgrade in safety. Smoke test the demo seeder. |
| 9-signs UI bloats already-long intake                                       | Keep collapsed by default; only expand if user clicks "Add health screening". Trainer can also fill on the trainer side.                                  |
| FITT-VP block diverges from what Stage 3 actually generates                 | Validators in R2.2 catch this with a 1× retry — same pattern as existing rotation validator.                                                              |
| Cross-source schema (R2.5/R3.5) needs different shape than what we ship now | `prescription_parameters.citations` is already an array → adding `bompa_6e` / `nsca_3e` later is additive, not breaking.                                  |


## Open questions for you (decide before R2.1 ships)

1. **Submax test**: ship Rockport + 1.5-mile only (cheapest, no equipment), or include Ebbeling (treadmill) + Astrand (cycle)? Smaller scope = faster R2.3.
2. **Signs & symptoms positioning**: separate page in intake (more honest, slower) or collapsible block on existing health page (faster, easier to skip)?
3. **Citation language for end clients**: trainer-facing PDF shows "ACSM 12e §5.6" as a footnote — show the same in the *client-facing* PDF, or scrub citations for clients (cleaner)?
4. **R2.4 (citations surface) timing**: ship in R2 to make the work visible immediately, or hold until R2.5 (so periodization citations land at the same time and we don't ship the chip twice)?

## Sequence of work (when you say go)

1. Answer the 4 open questions.
2. Migration A (schema spine) → approval → apply.
3. R2.2 server work (algorithm + derive + classifier wire-up). Smoke test against demo seeder.
4. R2.3 intake UI (PT first, EN sweep at end).
5. R2.4 citations surface (only if Q4 says ship-now).
6. Update `mem://index.md` Core: "FITT-VP block stored on `workout_plans.prescription_parameters`; thresholds live in `acsm_thresholds` table; preparticipation algorithm in `src/server/screening/preparticipation.server.ts`. All later sources (Bompa, NSCA) stack via the `citations[]` array."
7. Update `.lovable/backlog.md`: mark R2 ✅, refine R2.5 inputs.

Ready when you are. Don't kick off until the 4 answers are in.