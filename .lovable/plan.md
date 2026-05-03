# Round 6 — Plano de Bloco que evolui de verdade + Resultados redesenhados

## Diagnóstico do PDF que enviaste (Carolina · Bloco 13)

Ao ler o export, três sintomas saltam:

1. **Os blocos não variam.** Toda a sessão chama-se `Day 1 – Week 1` / `Day 2 · Week 1`, RPE oscila ~5.0–5.7 ao longo de **2 anos** e o "Top 5 exercícios" é praticamente o mesmo. O motor SAID exige rotação de acessórios a cada mesociclo — não está a acontecer.
2. **Capacidade não é mostrada.** O cartão "Adaptação" só fala em ajuste de volume por músculo. Não há indicador visível de **ganho de capacidade** (carga estimada, e1RM, kg/rep médio) bloco a bloco — que é exatamente o que o trainer/cliente quer ver.
3. **A página do plano está densa mas baça.** KPIs em cima, depois 3 charts genéricos, depois tabela longa. Sem hierarquia narrativa, sem "uau", sem reação aos dados (insights, badges de PR, comparação com bloco anterior).

Tudo o resto na conversa anterior (tour, i18n PT-PT, runners de fundo) ficou bom — mantemos.

---

## O que esta ronda entrega

### 1. Variação real entre blocos (motor)

**Problema raiz**: `runDemoPlay` passa `priorPlanId` mas só envia o resumo de adesão/RPE para os prompts; nunca envia **a lista de exercícios usados no bloco anterior**, nem regra de rotação. O `seedDemoSessions` usa o mesmo array `exercises` do plano, então blocos seguidos parecem clones.

**Correção**:
- Em `src/server/demo-play.functions.ts`, quando `priorPlanId` existe, ler `workout_plan_days` do bloco anterior e extrair `prior_exercise_pool` (lista única de `exercise_name` + padrão). Stash em `generation_meta.prior_exercise_pool`.
- Em `src/server/phased/stage3-microcycle.functions.ts` (e Stage 2 quando relevante), injetar bloco hard-rule no prompt:
  > **EXERCISE ROTATION (block N>1)**: at least **60%** of accessories must differ from the prior block's pool: `[lista]`. Compounds principais podem repetir se forem o driver da progressão; acessórios e isoladores **devem rodar** (substituições no mesmo padrão e mesma intenção).
- Adicionar uma validação leve pós-geração: se `<40%` de acessórios variarem, pedir 1 retry com a lista a evitar.
- Bónus: em `seedDemoSessions`, aplicar uma curva de carga **monotonicamente crescente entre blocos** (`loadMultiplier` = `1 + 0.04 * (block_number-1)`, capada em 1.4). Assim a "Top 5 lifts" mostra realmente progressão de carga ao longo dos anos.

### 2. SAID / Adaptação visível na página do plano

Novo componente **`<CapacityGainCard />`** logo abaixo do header do plano (substitui o popover-only do chip "Bloco N · evoluiu de N-1"):

- **Carga média estimada vs bloco anterior** (Δ% por padrão: agachamento, hinge, push, pull). Usa entries do bloco anterior + entries do atual (ou prescrição se ainda sem logs).
- **e1RM rolling** dos top 3 levantamentos, com sparkline e seta verde/âmbar/vermelha.
- **Adesão & RPE drift** (já existe, condensado).
- **Veredito por músculo** (já existe — colado, não duplicado).
- Tom: emerald quando há ganho ≥3%, âmbar entre 0–3%, vermelho se regressão.

Adiciona helper `src/lib/capacity-gain.ts` que dado `priorSessions` + `currentSessions` devolve `{ pattern, deltaLoadPct, e1rmDelta, verdict }`.

### 3. Página do plano redesenhada (`/plans/$planId` → modo `view` e `results`)

Princípio: **uma narrativa em 3 dobras**, cada uma com um "porquê" óbvio.

**Dobra 1 — "O que ganhámos"** (substitui a faixa atual de 4 KPIs frios):
- `<CapacityGainCard />` em destaque (gradiente subtil amber→emerald).
- KPIs reduzidos a 3 chips inline: Sessões · Adesão · RPE médio. Tonelagem desce para a Dobra 2.

**Dobra 2 — "Como treinámos"** (densifica os charts):
- RPE trend e Top-lifts lado a lado (já existe), mas com **anotações automáticas**: "PR carga · Leg press · 19/03" como ponto destacado, badges de deload nas weeks correctas.
- Volume semanal vira **stack bar realizado vs prescrito** (já temos prescrição em `progression_plan` / blueprint). Linha de MEV/MAV sobre as barras.

**Dobra 3 — "O que aconteceu"** (logbook + feedback fundidos):
- Tabela atual mantém-se, mas com **agrupamento por semana colapsável**, badges de PR, e uma coluna nova "Sinal" que resume `[STRESS]`/`[COMPLAINT]`/`[QUESTION]` como ícone ao lado do RPE.
- Painel "Feedback do cliente" deixa de ser tabela seca — passa a um **timeline** vertical com cores por tipo (vermelho complaint, âmbar stress, azul question) e link directo para a sessão correspondente.

Tudo continua a respeitar `status-tone.ts` e `BrandMark`.

### 4. Princípio aplicado ao resto da app (próximas rondas, em backlog)

Não tocamos agora, mas crio entradas no backlog:
- **YearView**: cada bloco vira um card com micro-CapacityGain em vez de chip âmbar genérico.
- **VolumeSection**: realizado vs prescrito também aqui (hoje só prescrito).
- **Dashboard / lista de clientes**: mostrar ganho médio de capacidade do último bloco como sinal de "este cliente está a evoluir".

### 5. Backlog vivo de prioridades

Crio `.lovable/backlog.md` (markdown simples, já uso `.lovable/plan.md`) com tabela:

| # | Prioridade | Área | Item | Estado |
|---|---|---|---|---|
| 1 | P0 | Motor | Rotação de exercícios por bloco | esta ronda |
| 2 | P0 | Plan page | CapacityGainCard | esta ronda |
| 3 | P0 | Plan page | Logbook timeline + agrupamento | esta ronda |
| 4 | P1 | YearView | Cards de bloco com ganho | próxima |
| 5 | P1 | Volume | Realizado vs prescrito em todo o lado | próxima |
| 6 | P1 | Dashboard | Sinal de evolução por cliente | próxima |
| 7 | P2 | Demo seed | Curva de carga inter-blocos | esta ronda (bónus) |
| 8 | P2 | i18n | Sweep EN final + smoke test | próxima |

Vou actualizar este ficheiro a cada ronda — fica como o "cérebro" da app, sempre legível para nós dois.

### 6. Tua prompt — versão melhorada para reusar

Sugestão de molde curto que podes copiar/colar nas próximas mensagens:

> "Continua o backlog. Foco P0 desta ronda: **[área]**. Resultado esperado: **[1 frase]**. Princípio: útil, funcional, bonito, divertido — sem inventar features que não estão no backlog. Atualiza `.lovable/backlog.md` no fim."

E para a tua mensagem anterior, a parte "ajuda-me a fazer esta prompt" virou esta plan — proponho que a meta-prompt seja "diagnostica primeiro com base em artefactos reais (PDF, screenshot, replay), depois propõe a ronda".

---

## Ficheiros tocados (estimativa)

**Criar**: `src/components/CapacityGainCard.tsx`, `src/lib/capacity-gain.ts`, `.lovable/backlog.md`.

**Editar**: `src/server/demo-play.functions.ts`, `src/server/phased/stage3-microcycle.functions.ts`, `src/server/phased/stage2-blueprint.functions.ts`, `src/server/demo-sessions.functions.ts`, `src/server/blocks.functions.ts` (passar pool ao runDemoPlay), `src/components/ResultsPanel.tsx` (3 dobras + timeline), `src/routes/plans.$planId.tsx` (encaixar CapacityGainCard).

Sem migrações de DB — `generation_meta` já é jsonb livre.

**Aprovas para executar?**