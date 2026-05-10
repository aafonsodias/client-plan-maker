## Resumo da investigação

Há **dois pipelines paralelos** a gerar planos. Um respeita as regras (Stage 3 + 4 + 5). O outro — o **Regenerate** — viola-as. Foi este que produziu o ecrã com "(SWAPPED → TRAP BAR DEADLIFT)" em W2/W3/W4.

---

## 1. Porque é que aparecem "novos microciclos" todas as semanas

### Pipeline correcto (criação inicial — phased generator)

```text
Stage 3 (AI)         → gera apenas Semana 1
Stage 4 (determ.)    → calcula deltas de carga/reps/RPE por categoria (Bompa+NSCA)
Stage 5 (determ.)    → CLONA W1 para W2..Wn e aplica os deltas, sem tocar em ex.name
```

Confirmado em `src/server/phased/stage5-bulkfill.functions.ts:144-157`: percorre `baseExercises` (W1) e só aplica `applyDelta` a `notes/reps/sets/rpe`. **O nome do exercício nunca muda.**

### Pipeline partido (Regenerate — botão "Regenerar este mesociclo")

`src/components/PlanEditorSurface.tsx:1781-1810` faz fan-out de **uma chamada AI por semana** (`POOL=3`):

```text
generatePlanWeek(week=1) ─┐
generatePlanWeek(week=2) ─┼─► persistRegeneratedPlan() ─► workout_plan_days (wipe + insert)
generatePlanWeek(week=3) ─┤
generatePlanWeek(week=4) ─┘
```

E o system prompt (`plan.functions.ts:840-854`) diz literalmente ao AI:

> WEEK FOCUS — Early weeks: introduce patterns, slightly lower RPE… Middle weeks: accumulation, higher volume. Final week of a 4-week block: deload OR peak.

→ O AI escolhe livremente exercícios diferentes por semana porque cada chamada é independente e a instrução pede variação.

`persistRegeneratedPlan` (`plan.functions.ts:1611-1647`) faz wipe total dos `workout_plan_days` e insere os exercícios verbatim que o AI devolveu — **sem clonar W1, sem aplicar a wave determinística, sem o tier guardrail**.

`MesocycleTableView` (linha 80-83 + 584) alinha linhas por `name` (com fallback ao índice) → quando o nome em W2 difere de W1 mostra **"(swapped → X)"**. Não é um bug visual, é a tabela a refletir honestamente que o AI gerou exercícios diferentes em cada semana.

**Conclusão:** Regenerate viola a regra "AI nunca gera mais que 1 microciclo" registada em `mem://index.md`. Toda a regen está a destruir a periodização Bompa que o Stage 4 tinha calculado.

---

## 2. Como é estabelecido o volume/intensidade inicial

### O que JÁ é puxado da avaliação (path phased)

| Sinal da avaliação | Onde é usado |
|---|---|
| `training_age_band` + `red_flags.length` | `deriveStartingFloor` → `rpe_floor`/`rpe_ceiling`/volume_tier |
| Movement screen (squat/hinge/push/pull/carry/lunge form_criteria) | `countMovementScreenFailures` → ≥5 = remedial, ≥2 = conservative |
| `parq_passed`, `acsm_risk_category`, BP, `med_flags` | `runPreparticipationAlgorithm` → clearance gate |
| `stress_level`, `sleep_quality`, `extended.sleep_hours`, `cannabis_use` | `isRecoveryCompromised` → força conservative |
| `intensity_appetite` | `rpeFloors(tier, appetite)` matriz 3×3 com floors por papel (main/accessory/carry) |
| `assessment_injuries` zona+severidade | `injuryBans` injectados no Stage 3 (C2-lite) |
| Equipamento, sessões/semana | `tierGuidelines` |

### O que NÃO está a ser usado (gaps)

- `current_capacity_vs_pb` (1-10) — o sinal mais óbvio para anchor de carga inicial. Recolhido, **ignorado**.
- `max_lifts` — passado como texto livre, nunca parseado para fixar carga absoluta.
- `resting_heart_rate`, `cardio_capacity`, VO₂max — recolhidos, nunca tocam volume/RPE.
- BP (sistólica/diastólica) — só serve para clearance binário, não modula tecto.
- Notas qualitativas dos screens (`squat_depth_note` etc.) — vão como string ao prompt mas não influenciam tier nem floors.
- `years_training` — apenas o band importa.

### Buracos ESPECÍFICOS no path de Regenerate

`generatePlanWeek` aceita `assessment` mas:
- **NÃO chama `classifyTier`** → nenhum tier remedial/conservative/advanced é injectado
- **NÃO chama `tierGuidelines`** → nenhuma `forbiddenExercises`, nenhum `week1SetCap`
- **NÃO chama `rpeFloors`** → AI só recebe um RPE ceiling solto via `buildCockpitConstraintBlock`
- **NÃO injecta `injuryBans` estruturados** — apenas o texto livre `assessment.injuries`
- Resultado: cliente conservative com lesão lombar pode receber conventional deadlift no Regenerate, mesmo que o phased generator nunca o faça

Isto explica porque é que o ecrã do utilizador mostra Trap Bar Deadlift como swap em W2/W3 — o regen é mais permissivo que a geração inicial.

---

## Plano de correcção (3 mudanças cirúrgicas, 1 round)

### A. Regenerate passa a respeitar "1 microciclo só"

Reescrever `RegenerateWithFeedbackDialog.submit()` (`PlanEditorSurface.tsx:1711-1864`) para:

1. Chamar `generatePlanWeek(week=1)` **uma única vez** com toda a context (cockpit, tier, lesões, feedback livre).
2. Após persistir W1, invocar a pipeline determinística existente: `proposeProgressions(planId)` → `bulkFillRemainingWeeks(planId)`.
3. `persistRegeneratedPlan` deixa de receber N semanas — passa a receber 1 semana + flag `apply_deterministic_progressions=true`.

Isto reaproveita Stage 4+5 sem código novo no servidor. Os "swaps" desaparecem porque W2-Wn passam a ser cópias de W1 com deltas.

### B. Regenerate ganha os mesmos guardrails que o phased generator

Antes de chamar AI, no `generatePlanWeek`, adicionar:

```ts
const tier = classifyTier(brief, assessment);
const guidelines = tierGuidelines(tier, sessions, primaryGoal);
const floors = rpeFloors(tier, brief.intensity_appetite);
const injuryBans = await deriveInjuryBans(supabase, clientId);
```

E injectar `tierPromptBlock(guidelines)` + bloco `INJURY-DRIVEN BANS` no system prompt — igual ao Stage 3. Sem isto, o regen continua a poder propor exercícios proibidos.

### C. Painel "Configurar mesociclo" ganha 2 linhas honestas

No painel C3 já criado (`PlanEditorSurface.tsx`), adicionar acima da CTA:

- **Tier classificado:** chip com tier (remedial/conservative/advanced) + razão ("2 falhas movement screen · stress 8/10")
- **RPE floors aplicados:** `Main ≥ {floors.main} · Acessórios ≥ {floors.accessory} · Carries ≥ {floors.carry}`

Para o treinador ver, antes de carregar Regenerar, exactamente que constraints o motor vai aplicar — decisão "looks → function" (transparente bate opaco).

---

## Fora do âmbito (próximos rounds)

- Usar `current_capacity_vs_pb` (1-10) para anchor de RPE/load real — Fase B do starting floor (nova memória)
- Parsear `max_lifts` para % de 1RM em compostos
- Ler VO₂max para impact ceiling em saltos/sprints (NASM OPT)
- Day-tagging max-effort/dynamic-effort (Conjugate)

---

## Verificação após implementação

1. Em cliente conservative com lesão lombar (sev ≥3): regenerar e confirmar que (a) os 4 weeks têm o **mesmo nome de exercício** em cada linha, (b) só sets/reps/rpe variam, (c) `generation_log` mostra `injury_filters_applied` no path de regen (hoje só aparece no Stage 3 inicial).
2. Cliente beginner + 2 red_flags: confirmar que regen não permite barbell deadlift nem back squat (hoje permite).
3. Mobile 375px: o painel "Configurar mesociclo" empilha bem com as duas novas linhas (tier + floors).