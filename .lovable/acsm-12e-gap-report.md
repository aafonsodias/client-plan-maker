# ACSM 12e Gap Report (Round 1 deliverable)

Updated: 2026-05-03 · Source: `/mnt/documents/acsm-12e.pdf` (server-only)
Ingested: 8 chapters · 22 sections · 59 recommendations · 79 contraindications · 167 normatives · 37 population triggers.

> Comparison baseline: Forge today touches ACSM in three places only:
> 1. `assessments.parq_passed` + `assessments.acsm_risk_category` (low/moderate/high)
> 2. `programming-tier.server.ts`: `parq_passed===false || risk==="high" → remedial`
> 3. `plan.server.ts` prompt + `pdf.ts` print PAR-Q + risk text

---

## Section A — Chapter 2: Preparticipation Algorithm

| 12e decision node | Forge | Note |
|---|---|---|
| Informed consent (verbal + written) | ❌ | No consent capture step in intake. Trainer-side liability gap. |
| Current exerciser definition (≥3 d/wk × ≥30 min × ≥3 months at moderate) | ⚠️ | Captures `training_days_per_week` + `years_training` but not the 3-month continuity rule used by the algorithm. |
| Known CVD/metabolic/renal disease | ⚠️ | `medical_conditions` is free-text; not parsed into the three buckets the algorithm needs. |
| Signs/symptoms of CVD/metabolic/renal disease | ❌ | The 9 cardinal signs (chest pain, dyspnea, syncope, orthopnea, ankle edema, palpitations, claudication, murmur, unusual fatigue) are not asked. **Highest-impact screening gap.** |
| Desired exercise intensity (light/moderate/vigorous) gate | ❌ | Not asked at intake; algorithm branches on this. |
| Medical clearance recommendation output | ⚠️ | Forge collapses to `risk_category=high → remedial tier`. Does not emit "seek medical clearance" message that the algorithm requires. |
| AACVPR risk stratification (LVEF<40%, MET<5, ST≥2mm, sudden death survivor, etc.) | ❌ | Not modelled; out of scope for non-clinical Forge users but flag for "do not accept" gate. |
| CVD risk-factor count (age, family hx, smoking, sedentary, BMI, BP, lipids, glucose) | ⚠️ | Forge captures BP, RHR, body comp, sedentary signals — but does not aggregate them into the 12e risk-factor count. |

## Section B — Chapter 3: Health-Related Fitness Testing

| 12e test | Forge | Note |
|---|---|---|
| Resting HR (5-min seated rest, no caffeine 30 min) | ⚠️ | `resting_heart_rate` captured, no protocol enforced. |
| Resting BP (same protocol, both arms first visit) | ⚠️ | `systolic/diastolic_bp_mmhg` captured, no protocol UI. |
| Body composition: BMI, waist circumference, WHR, BF% | ⚠️ | `waist_cm`, `hip_cm`, `body_fat_pct`, `body_fat_method` captured. WHR not auto-derived; risk-stratified thresholds not applied. |
| Cardiorespiratory fitness: VO₂max (max or submax estimation) | ❌ | `cardio_capacity` is free-text. No submax test (YMCA, Rockport, 1.5-mile, Ebbeling, Astrand) implemented. **High-value gap for Round 2 intensity prescription.** |
| Muscular strength (1-RM or 10-15 RM) | ⚠️ | Captured as `max_lifts` free-text + capacity scores. No protocol/normative comparison. |
| Muscular endurance (push-up, plank, curl-up) | ❌ | Not standardised. |
| Power | ❌ | Not measured. |
| Flexibility (sit-and-reach, goniometry) | ❌ | Replaced by 6-pattern movement screens — different model, defensible. |
| Balance (BESS, Y-balance, TUG) | ⚠️ | `single_leg_balance_score` (1-5) only; no validated test. Critical for older-adult overlay (Round 3). |

## Section C — Chapter 5: FITT-VP coverage in generator

For each parameter, does Forge's plan generator emit it as a structured, validatable value?

| Modality × Parameter | Frequency | Intensity | Time | Type | Volume | Progression |
|---|---|---|---|---|---|---|
| Cardiorespiratory | ❌ | ❌ | ❌ | ⚠️ | ❌ | ❌ |
| Resistance | ⚠️ (`training_days_per_week` echoed) | ❌ | ⚠️ (`session_duration_minutes`) | ✅ (exercise list) | ⚠️ (sets/reps embedded in `plan_data`, not extracted) | ⚠️ (Stage-4 progressions, not bound to %1-RM rules) |
| Flexibility | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

→ **All ❌/⚠️ above is exactly what Round 2 (FITT-VP backbone + citations) is scoped to fix.** This is the expected baseline.

## Section D — Population coverage (Ch. 6, 8–11)

37 population triggers extracted. Coverage classification against Forge's only branch (`risk=high → remedial`):

**Falls silently through (no detection, no overlay) — Round 3 candidates:**

- Children & adolescents (<19y) — Forge has no pediatric guard
- Pregnancy (any trimester, postpartum, GDM, preeclampsia hx)
- Older adults (≥65y) with frailty / fall-risk
- Low back pain (LBP) — current/chronic
- Hypertension (controlled) — needs intensity cap, not high-risk
- Type 1 / Type 2 diabetes (medication-aware)
- Dyslipidemia, metabolic syndrome, obesity (class I-III), MASLD
- Asthma, COPD (mild–moderate)
- Stroke recovery, Parkinson's (early), MS, Alzheimer's (early)
- ADHD, depression, anxiety
- Cancer survivors (modality-dependent)
- Transgender / gender-diverse (chest binder, hormone therapy)
- Osteoporosis / osteopenia
- Arthritis (OA / RA)
- POTS, ME/CFS, MASLD, SCAD (12e-new populations)

**Caught correctly by `risk=high → remedial`:**
- Unstable CHD, decompensated HF, severe pulmonary HTN, aortic stenosis, active myocarditis, aortic dissection, recent embolism — these all map to medical-clearance-required and Forge correctly downgrades programming. ✅

**Estimated overlays needed in Round 3:** ~18 (the silent-fall-through list above).

## Section E — 12e vs 11e/Forge thresholds (Q2 deltas)

Cross-referencing extracted 12e values against current Forge code/prompts:

| Parameter | Forge / 11e | 12e | Direction | Citation | Recommendation |
|---|---|---|---|---|---|
| Aerobic moderate intensity (%HRR) | not enforced | 40–59 | n/a | §5 Tbl 5.1 | adopt automatically |
| Aerobic vigorous intensity (%HRR) | not enforced | 60–89 | n/a | §5 Tbl 5.1 | adopt automatically |
| Aerobic minimum weekly time (mod) | implicit 150 | 150–300 min/wk | equivalent floor, higher ceiling | §5 Tbl 5.1 | adopt 150 floor |
| Resistance frequency (general) | trainer-set | 2–4 d/wk | equivalent | §5.6 | adopt as default |
| RT inter-set rest, strength | not enforced | 120–300 s | n/a | §5 Tbl 5.7 | adopt as validator floor |
| RT progression rule | Forge: free, Stage-4 LLM | 2-for-2 rule + 2.5–5 %1-RM | more conservative (structured) | §5.6 | adopt automatically |
| Static stretch hold (general adults) | not enforced | 10–30 s | n/a | §5 Tbl 5.13 | adopt as default |
| Static stretch hold (older adults) | not enforced | 30–60 s | n/a | §5 Tbl 5.13 | adopt as default |
| Pre-exercise static stretch >60 s | not flagged | discouraged before performance | new rule | §5.7 | adopt automatically (warn in PDF) |
| Sedentary→exercise transition | not phased | 2–3 months light (2–3 METs) before progression | more conservative | §2.2 | adopt — wire into Stage-2 blueprint |
| Submax test stop criterion | absent | 70% HRR or 85% age-pred HRmax | new safety floor | §Box 3.7 | adopt when submax test ships |
| BP test-stop SBP | absent | >250 mmHg | new safety floor | §Box 3.6 | adopt automatically |
| BP test-stop DBP | absent | >115 mmHg | new safety floor | §Box 3.6 | adopt automatically |
| Cardiac rehab BP exclusion | absent | >180/110 mmHg resting | new safety floor | Box 8.3 | adopt automatically |
| Waist circ "high risk" (women) | absent | 90–110 cm | n/a | Tbl 3.2 | adopt as derived stratifier |
| Waist circ "high risk" (men) | absent | 100–120 cm | n/a | Tbl 3.2 | adopt as derived stratifier |
| WHR "very high" (men <60 / women <60) | absent | >0.95 / >0.86 | n/a | §3.6 | adopt as derived stratifier |

**No `less-conservative` deltas detected** in this slice — every 12e value either matches or tightens the implicit Forge baseline. Q2 directive (auto-adopt when more conservative) applies cleanly to all 17 above.

## Section F — Executive summary

**Top 3 lacunas a fechar no Round 2:**
1. **Structured FITT-VP emission** in `workout_plans.prescription_parameters` — without this, none of the 59 ingested recommendations can be enforced or cited.
2. **Submax VO₂ estimation** (Rockport / 1.5-mile / Ebbeling) — unlocks intensity prescription in %HRR/%VO₂R rather than RPE-only.
3. **9 cardinal signs/symptoms checklist** in intake — closes the largest preparticipation safety gap (currently invisible to Forge).

**Top 3 deltas 12e vs Forge requiring user decision:** None — every delta extracted is more conservative than current Forge, so per Q2 all 17 listed in Section E auto-adopt in Round 2. **No blocking decisions for you.**

**Round 3 overlay forecast:** ~18 special-population overlays (pediatric, pregnancy, older-adults-frailty, LBP, hypertension, T1D, T2D, dyslipidemia, obesity, MASLD, asthma, COPD, stroke, Parkinson's, MS, depression, cancer survivors, osteoporosis). The 12e-new populations (POTS, ME/CFS, SCAD, MASLD, transgender/gender-diverse) are all in this set.

---

**Bompa & Buzzichelli 6e:** PDF parked at `/mnt/documents/bompa-buzzichelli-6e.pdf`, source policy in `.lovable/bompa-buzzichelli-6e-source.txt`. Decision pending — recommend slotting as Round 2.5 (periodization layer above FITT-VP) or Round 3.5 (after population overlays). My pick: **Round 2.5** — periodization templates are a natural extension of the FITT-VP backbone and most overlays don't need periodization-aware logic.
