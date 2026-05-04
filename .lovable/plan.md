
## Crítica primeiro — o que está mesmo a partir-se

### 1. "Regenerate with feedback" usa o motor errado (P0, urgente)

Olhei para `src/routes/plans.$planId.tsx:1554` (RegenerateWithFeedbackDialog) e ele chama `generatePlanDraft` — o **pipeline single-shot legacy**. Esse motor:

- Não passa pelo Stage 2/3/4/5 phased (que é o source-of-truth desde Round 30+).
- Não aplica `computeWaveRpe` nem o anchor RPE por training age (W1 = 5.5/6.5/7.0 conforme tier).
- Não tem critic/repair (auditor).
- Limita-se a 8000 tokens num único call → o Claude colapsa para 4 exercícios e ignora o pedido de "2 sets".

Por isso vês:
- "RPE 7" rígido em vez da onda 6.5→7.5→+0.5 (o teu pedido de "RPE properly starting from 6.5").
- "3×" em todos os exercícios em vez dos 2× pedidos.
- Estrutura colapsada (4 exercícios/dia em vez dos ~6).
- Banner "No progression was applied" porque os progressions deltas (Stage 4) nunca foram corridos.

**O que os livros dizem (rápido):**
- **Bompa & Buzzichelli 6e §6.4**: novato 2–3 séries, RPE 6–7 anchor; intermediate 3–4 séries, RPE 7–8.
- **NSCA Essentials 3e Cap. 17**: novato 1–3 séries é defensável para hipertrofia inicial. Acima disso só com base.
- **ACSM 12e Cap. 7**: 2–4 séries é o típico, 1 série aceitável para recém-iniciados.
- Conclusão: o pedido do utilizador (2× @ RPE 6.5 W1) é academicamente correto para novato. O motor é que não obedeceu.

### 2. Sessões órfãs após regen (P0)

Quando regeneras, o `plan_data` é reescrito mas as `workout_sessions` antigas continuam atadas ao `plan_id`. O Logbook lê tudo e mostra Day 1 Week 1 vazio porque o nome dos exercícios mudou e já não há match. **Não as devemos apagar** — são histórico real. Devemos marcá-las como `legacy` (ou guardar `plan_data_version`) e mostrar num drawer "Sessões antes do redesenho".

### 3. Falta de transparência durante a regeneração

Clicaste, viste "Regenerating…", esperaste, toast minúsculo. Sem indicação de:
- Qual modelo/motor.
- Em que stage (W1, W2, audit, etc.).
- ETA.
- Possibilidade de cancelar.

A `DemoRunsContext` + `DemoRunsIndicator` já fazem isto para a Demo Lab. Reusar.

### 4. Avaliação parece colada de outro produto (P1)

Confirmado pela tua descrição: bege/off-white em vez de respeitar `--background`/`--card`/`--muted`, sem `shadow-sm`, sem `border` consistente, hierarquia plana. O ficheiro `src/i18n/locales/en/assessment.json` está cuidado, mas o componente em si (provavelmente em `src/components/PlanAssessmentSheet.tsx` + sub-blocos) usa cores hard-coded em vez dos tokens do design system.

### 5. Logbook (já com bug fix do Round 54)

Confirma primeiro. Depois MVP do redesign — stepper no mobile + tabela densa no desktop. O Grok tem razão.

---

## Plano (~95 cr, ordem P0 → P1)

### P0 — 35 cr · Regen pelo motor certo + transparência + sessões órfãs

**P0.a (15 cr)** — Reescrever `RegenerateWithFeedbackDialog` para chamar o **pipeline phased** em vez de `generatePlanDraft`:

1. Novo server fn `regeneratePlanWithFeedback` em `src/server/plan.functions.ts` que:
   - Recebe `plan_id` + `trainer_feedback`.
   - Lê o `brief` + `programming_variables` existentes (não recalcula tudo).
   - Injeta o feedback como override **antes** do Stage 3 (microcycle) — passa `trainer_feedback` no prompt do Stage 3 com instrução "estas correções têm prioridade sobre os defaults; aplicar literalmente".
   - Re-corre Stage 3 (microcycle) → Stage 4 (progressions) → critic → repair se preciso.
   - Mantém os mesmos `block_number` e `prior_plan_id`.
   - Escreve `generation_meta.regen_feedback_history` (array, append).
2. Aplica o **wave RPE** (`computeWaveRpe`) por defeito — não confiar no modelo.
3. Aplica o auditor (já existe em `plan-critic.server.ts`) automaticamente — remove o banner "No progression was applied".

**P0.b (12 cr)** — Indicador de progresso real:
- Registar o run em `DemoRunsContext` (já tem `registerRun`).
- Stages: `prep → microcycle → progressions → audit → done`.
- Pill global no canto + dentro do diálogo (substituir "Regenerating…" por barra com stages).
- Botão Cancelar (abort signal).

**P0.c (8 cr)** — Sessões órfãs:
- Migration: `workout_sessions.plan_data_version` (int, default 1) + index.
- Bump `plan_data_version` no plano sempre que `regenerate*` corre.
- `LogbookTimeline`: agrupa `current` (version match) vs `previous` (version mismatch), mostra as antigas dentro de `<details>` "X sessões antes do último redesenho", desactiva PR confetti nas antigas.
- Quando o picker do Log abre uma sessão antiga, banner amber "Esta sessão é de uma versão anterior do plano. Editar não a re-vincula aos exercícios atuais."

### P1 — 35 cr · Logbook v1 (mobile stepper + desktop denso)

**P1.a (15 cr)** — Mobile (≤640px):
- `LogExerciseRowMobile.tsx`: cartão por exercício, set rows com `+1 / +5 / +0.5kg / +1kg` steppers (FitNotes pattern), inputs grandes, RPE wheel 6→10 com 0.5 steps, auto-collapse quando todos os sets preenchidos.
- Sticky bottom bar: `Salvar · Próximo dia · Histórico`.
- Tap no nome do exercício abre mini-history (últimas 3 sessões + e1RM trend).

**P1.b (12 cr)** — Desktop (≥1024px):
- `LogExerciseTableDesktop.tsx`: tabela densa, coluna por set, inputs inline.
- "Última sessão" em cinza dentro da célula como ghost (Hevy pattern).
- Atalhos: Enter = próximo set; Tab = próximo exercício; +/- ajusta peso; R abre rest timer.
- Indicador "modificado" por linha; auto-save a cada 3s para `localStorage` (`useDirtyDraft`).

**P1.c (8 cr)** — Picker compacto + UX:
- Substituir o picker atual por `LogPickerCompact` (semana ⇆, dia ⇆, data, chip "📝 a editar" / "✨ nova").
- "Duplicar última sessão" botão (1 clique → pré-preenche pesos da última).

### P1 — 18 cr · Avaliação rescue (versão única, sóbria-impactante)

Escolho **uma só versão** em vez das 2 que pediste — poupa créditos e a "conservadora" sem o design system não acrescenta nada. Direto à boa:

- Auditar `src/components/PlanAssessmentSheet.tsx` + os blocos PARQ/Risk/Anthro: substituir todos os `bg-white`, `bg-gray-*`, `border-gray-*` hard-coded por `bg-card`, `bg-muted`, `border-border`.
- PAR-Q+ block: cards com `shadow-sm border` separados por pergunta, número grande à esquerda (1/7), botões Sim/Não 56px de altura, `data-state` highlight em amber quando "Sim" disparada (usa `status-tone.ts warn`).
- Hierarquia: H1 da secção 24px, subtitle muted, perguntas em `text-base`, rationale em `text-xs text-muted-foreground` dentro de `<details>`.
- Stepper topo: já existe — confirmar contraste em todos os 3 temas (light/dark/system).
- Mobile: botões Sim/Não full-width stack, scroll suave entre perguntas.

### P2 — 7 cr · Polish

- Toast da regen mais informativo (modelo, stages, "Auditor aprovou ✓ ou levantou X warnings").
- Smoke test 375px Mobile Safari + 1280px desktop, screenshots no `.lovable/r55-smoke.md`.
- Backlog: marca P0/P1 como done, adiciona itens parqueados (PR detection bodyweight, voice-log, rest-timer auto, duplicar semana).

### Não faço neste turno (defendido)

- **Landing page upgrade** — o Grok tem razão, é fora de scope MVP. Vai para P2 backlog.
- **App-map global** — só faz sentido depois do logbook estabilizar.
- **2 versões da Avaliação** — desperdício, vou direto à boa.
- **Compliance card / FAB / dashboard hierarchy** — backlog R56.
- **Voice-log / offline robusto** — futuro.

---

## Orçamento

| Bloco | Cr |
|---|---|
| P0 regen pelo motor certo + transparência + órfãs | 35 |
| P1 Logbook v1 mobile + desktop | 35 |
| P1 Avaliação rescue | 18 |
| P2 polish + smoke + backlog | 7 |
| **Total** | **95** |

Sobra ~5 cr para imprevistos. Cada bloco é commit independente — paro a meio se quiseres.

---

## Decisão que preciso de ti

**Apenas 1 confirmação** (o stepper já tinhas dito que sim implicitamente via Grok):

A regen-with-feedback nova vai obrigar **wave-RPE** mesmo quando o trainer não pede explicitamente — i.e. o motor força W1 anchor 6.5, W2 +volume, W3 +intensity, W4 deload conforme `computeWaveRpe`. O feedback do trainer pode **deslocar o anchor** ("começa a 5.5") mas não pode **achatar a onda** ("RPE 7 fixo todas as semanas"). É a forma honesta de programar — concordas, ou queres permitir override total?
