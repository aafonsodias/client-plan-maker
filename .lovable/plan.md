
# Five fixes to take Forge from "demo" to "vertically integrated"

Scope: four shippable fixes (1-4) + one strategic checklist (5). All in pt-PT, formal address.

---

## 1. PDF: writable "log column" on the A4 (the placa)

**Problem.** The exported PDF (the one you print and stick on the placa) shows W1/W2/W3/W4 prescriptions but no place to write what actually happened in the gym. The trainer/client has to memorise or scribble in the margins.

**Fix.** Add a **"REGISTO"** zone on every per-archetype page in `src/lib/pdf.ts`:

```text
EXERCISE         SETS REPS REST RPE TEMPO  │ W2  W3  W4 │ REGISTO (escrever no ginásio)
                                           │             │ Set 1: __×__ @__   Set 2: __×__ @__   Set 3: __×__ @__   Notas: ____
```

Two render modes via a `pdfMode: "training" | "logsheet"` toggle in the Export PDF button:
- **Training sheet** (current): mesocycle prescription, no log column.
- **Folha de registo (week N)**: collapses W2..W4 deltas, expands a wide right-hand column with one row of blanks per prescribed set (using `sets` × `reps`). Header has `Cliente: Marta Q.   Semana: __   Data: __   Sessão: ___`. One page per session-archetype, one column block per set.

Plus a small "Importar registo" button next to "Exportar PDF" that opens a dialog where the trainer types/pastes the values back into `workout_sessions.entries` for that day (manual mirror of the future OCR path).

**Files:** `src/lib/pdf.ts` (add `renderLogsheet`), `src/routes/plans.$planId.tsx` (Export dropdown: Training / Folha de registo), new `src/components/ImportLogDialog.tsx`.

---

## 2. "Plano concluído" lifecycle + Block N → N+1 handoff

**Problem.** Marta logged everything; the plan still shows the same buttons and never says "this is over, what's next?". Currently `completion_state` exists but no UI surfaces it from the *plan view*.

**Fix.** Three states surfaced on the plan header chip (uses existing `toneChip`):

| State | Trigger | Header chip | CTA |
|---|---|---|---|
| `in_progress` | sessions logged < scheduled | "EM CURSO · X/Y sessões" | (none — show progress) |
| `ready_to_close` | ≥ 80% sessions logged **or** trainer clicks "Marcar como concluído" | amber "PRONTO PARA FECHAR" | **Concluir bloco e iniciar Bloco N+1** |
| `finished_logging` | trainer confirmed | emerald "BLOCO CONCLUÍDO · 02/05/2026" | **Desenhar Bloco N+1 (manual)** primary, **Evoluir do último (IA)** secondary if demo |

Mechanics:
- Add `markPlanFinished(planId)` server fn (writes `completion_state='finished_logging'`, sets `status='archived'`, snapshots adherence/RPE drift into `block_transition_summary` so the dialog has defaults).
- Add a "Concluir plano" button next to the existing "Concluir bloco" CTA — same dialog (`BlockTransitionDialog`) but defaults to **Manual** path (your stated rule: manual is the canonical path; AI is the demo shortcut).
- On the **client page**, when `finished_logging`, the section header changes from "Plano em curso" to "Último bloco concluído · 02/05/2026" (collapsed), and a prominent **"+ Desenhar Bloco 2 (manual)"** appears on top.
- Logbook keeps showing prior sessions; new sessions roll under the new plan.

This makes results "keep going" because the Bloco 2 plan is created with `prior_plan_id` pointing back, and `ResultsPanel` already aggregates across blocks via `prior_plan_id`.

**Files:** `src/server/blocks-manual.functions.ts` (add `markPlanFinished`), `src/routes/plans.$planId.tsx` (header chip + new CTAs), `src/routes/clients_.$clientId.tsx` (collapsed "último bloco" + new Bloco N+1 CTA), `src/components/PlanStatusChip.tsx` (new — single source for chip rendering), `src/i18n/locales/pt/plan.json` (strings).

---

## 3. Fix the empty validation report + the lazy summary

**A. The "AI validation report will appear here…" placeholder is permanent.**

Root cause: `generation_meta` for Marta only has `tier` / `tier_guidelines` — no `validation` block was ever written. The phased pipeline never persists the validation/critic output to `generation_meta.validation`.

**Fix.** In `src/server/phased/stage3-microcycle.functions.ts` and `stage4-progressions.functions.ts`, after each critic pass, merge the per-day verdicts into `generation_meta.validation` with shape `{ verdict_counts, unresolved_issues, escalated_days, total_cost_usd, finalized_at }`. Update on `complete`. Also: when no critic ran (legacy plan), show a different message than "will appear" — show **"Sem relatório de validação para este plano (gerado antes do auditor IA). Re-gere para activar."** with a regenerate link.

**B. The brief summary reads like a bot apologising.**

Root cause: when the assessment has no per-section analyses (Marta is a stub demo client), Stage 1 prompt outputs the "Sem análises por secção fornecidas. Estabeleça avaliações…" boilerplate. That's fine as an *internal* `notes_for_next_stage`, but it leaks into the user-visible Summary because `plan.summary` falls back to it.

**Fix.**
- Stage 1 brief prompt (`stage1-brief.functions.ts`): require `notes_for_next_stage` to be a *programming-relevant* sentence (volume target, tier rationale, deload posture) — never a meta-complaint about missing data. Add a guardrail: if model returns the "Sem análises…" string, post-process to a useful default like "Iniciante sem PRs registados; arrancar com tier remedial, RPE 5–6, foco em padrões básicos com máquinas e bandas; reavaliar competência ao fim do bloco."
- **Plan summary** (`plan.summary`) must come from the **microcycle stage's** new `program_summary` field (one paragraph: split, intensity logic, deload week), NOT from brief notes. Add to Stage 3 schema + prompt.
- ValidationReport empty-state copy: replace with **"Validação automática indisponível para este plano. Carregue 'Re-gerar' para correr o auditor."**

**Files:** `stage1-brief.functions.ts`, `stage3-microcycle.functions.ts` (add `program_summary` to schema + persist to `workout_plans.summary`), `schemas.ts`, `ValidationReport.tsx`.

---

## 4. Honest progression curve — push the 38-year-old beginner

**Problem.** Plan shows W1→W2 = +1 rep at RPE 6 → "+0.5rpe" tags. That's a tickle, not a stimulus. A healthy 38-year-old beginner needs ~5–10% weekly progression to actually adapt; deload only at W4.

**Fix in `src/server/phased/stage4-progressions.functions.ts`** (and `programming-defaults.ts`):

- Replace the current "+1 rep / +0.5 RPE" default with a **tier-aware progression policy**:
  - `remedial` (true rehab): +0 to +1 rep OR +2.5% load, RPE 5→5.5→6→deload
  - `beginner_general` (Marta): **+1–2 reps OR +2.5–5% load, RPE 6→7→7.5→deload (RPE 5)**. W3 should hit RPE 7.5, not 5.4 (!).
  - `intermediate`: +5% load or +1 rep at top set, RPE 7→7.5→8→deload
  - `advanced`: undulating; +2.5% top set, drop volume on accessories
- Hard-stop the bug where every week shows the same RPE target ("RPE alvo 5.4" for W1–W4 in the screenshot is wrong — W4 is supposed to be the deload).
- Surface the curve on the plan header: a 4-bar mini-chart "Carga semanal: ▁▃▆▂" so the trainer can spot a flat plan in 1 second.
- Add a setting on the brief: **"Apetite de intensidade"**: `conservador` / `padrão` / `agressivo` — defaults to `padrão`. Marta would have been on `padrão`; demo currently behaves like `conservador`.

**Files:** `programming-defaults.ts`, `stage4-progressions.functions.ts`, `stage1-brief.functions.ts` (new field), `BriefEditor.tsx`, `MesocycleTableView.tsx` (mini-chart), `pt/plan.json`.

---

## 5. What's missing to be "vertically integrated, golden standard"

Direct answer to your last question. This is a checklist, not a build target for this turn — pick what to attack next.

**a. Closed loop: gym → app**
- ✅ (this PR) Folha de registo printable.
- Soon: photo-of-the-sheet → OCR → suggested log entries (Lovable AI Vision).
- Soon: phone web app for the *client* to tick reps live — share token already exists; needs a "Tocar para registar" mode.

**b. Closed loop: results → next plan**
- (this PR) Bloco N → Bloco N+1 with adherence + RPE drift baked into transition note.
- Missing: **trend dashboard per exercise** across blocks (1RM estimate via Epley from logs, volume tonnage line). The data is there in `workout_sessions.entries`; needs a `<ExerciseTrendChart>` on the client page.
- Missing: **auto-deload trigger**: if average RPE > prescribed +1 for 2 consecutive weeks, suggest a deload week.

**c. Closed loop: client perception**
- Daily metrics (already migrated: `client_measurements`) need a **client-facing micro-form** (1 minute: HRV/sleep/peso/dor) so the data actually flows in. Right now only the trainer can input.
- Tie those into the next-plan generator: a week of bad sleep → drop intensity 5%.

**d. Money & ops**
- Invoicing exists; missing: **automatic invoice on plan finalisation** (one click).
- Missing: client portal showing remaining sessions / next assessment date.

**e. Knowledge & defensibility**
- Bancada is good entertainment; promote it: every new exercise added to a plan offers "Ver estudos" (PubMed query auto-built from exercise + topic).
- Library of trainer-authored notes attached to `exercises_catalog` so cues compound over time.

**f. Trust**
- ValidationReport (fixed in this PR) is the *credibility wedge*. Once every plan ships with "Auditor IA: 12/12 dias verificados", trainers stop second-guessing.
- Add a **"Diferença vs último bloco"** auto-summary on every Bloco N+1 (volume %, intensity %, novelty).

---

## What this PR ships (1–4)

```text
src/lib/pdf.ts                                  + log-sheet renderer
src/routes/plans.$planId.tsx                    plan completion chip + CTAs + PDF dropdown
src/routes/clients_.$clientId.tsx               collapsed "último bloco" + Bloco N+1 CTA
src/components/PlanStatusChip.tsx               NEW — single chip source
src/components/ImportLogDialog.tsx              NEW — paste back from sheet
src/components/ValidationReport.tsx             empty-state copy
src/server/blocks-manual.functions.ts           + markPlanFinished
src/server/phased/stage1-brief.functions.ts     useful notes_for_next_stage + apetite intensidade
src/server/phased/stage3-microcycle.functions.ts persist program_summary → plan.summary
src/server/phased/stage4-progressions.functions.ts tier-aware progression curve
src/server/phased/programming-defaults.ts       intensity table by tier
src/server/phased/schemas.ts                    + program_summary, + intensity_appetite
src/components/MesocycleTableView.tsx           weekly load mini-chart
src/components/BriefEditor.tsx                  apetite intensidade picker
src/i18n/locales/pt/plan.json                   strings
```

No DB migrations needed — `completion_state`, `block_number`, `prior_plan_id`, `block_transition_summary` already exist.

---

Reply **"continua"** para implementar 1–4. Item 5 fica como mapa para os próximos sprints.
