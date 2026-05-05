## Goal

Refazer o card expandido do cliente (`ClientCockpit`) no `/dashboard` para que (1) o **Protocolo** seja a primeira coisa e funcione como navegação, (2) **ACSM + Recovery** saiam de junto do protocolo, (3) o **% do Assessment** mostre a cobertura real (mesmo quando já há plano), e (4) o cartão do plano distinga claramente "abrir plano" de "descarregar PDF" — devolvendo a clicabilidade ao título.

## Estrutura nova do cockpit (de cima para baixo)

```
┌─ Protocolo (rail com 5 etapas — TODAS clicáveis) ─────────┐
│  1 Avaliação · 47%   2 Briefing   3 Plano   4 Semana  5 ▸ │
└────────────────────────────────────────────────────────────┘
┌─ Painel da etapa selecionada (muda conforme clique) ──────┐
│  ...conteúdo associado à etapa...                         │
└────────────────────────────────────────────────────────────┘
┌─ Plano em curso (só se existir) ───────────────────────────┐
│  ▶ André Periquito — Calisthenics Hypertrophy Meso        │
│    Bloco 1 · Wk 1 de 4                       [↓ PDF] [✎] │
└────────────────────────────────────────────────────────────┘
┌─ Sinais (chips ACSM + Recovery, separados do protocolo) ──┐
│  ⚠ ACSM Baixo     ⚡ Recovery 63/100                      │
└────────────────────────────────────────────────────────────┘
```

## Mudanças por ficheiro

### `src/components/ProtocolRail.tsx`
- Adicionar props `activeStage?: number | null` e `onStageClick?: (n: number) => void`.
- Todas as 5 etapas passam a ser botões clicáveis quando `onStageClick` está definido (não só a 1). Etapa ativa ganha o ring âmbar (mesma estética do `stage1Expanded` atual).
- Manter compat com `onStage1Click` (no detalhe do cliente continua a alternar o editor de avaliação).

### `src/components/ClientCockpit.tsx` (refactor principal)
- **Estado novo**: `selectedStage: 1|2|3|4|5` (default = 1 se assessment incompleto, senão 4 se há plano, senão 1).
- **Buscar cobertura real**: chamar `getSectionAnalysisCoverage(clientId)` (já existe em `src/server/phased/pre-stage.functions.ts`) no `useEffect` em vez de forçar 100% quando o plano está completo. A etapa 1 fica **verde** (check) se `plan.generation_status === "complete"` OR `coverage >= 80%`, mas o número exibido é sempre a `%` real.
- **Reordenação**:
  1. `<ProtocolRail>` no topo (sem chips ACSM/Recovery por cima).
  2. **Painel de etapa** (componente local `<StagePanel n={selectedStage} ...>`):
     - **1 Avaliação**: resumo (`X/Y secções · %`), última data, botão "Continuar avaliação" → `Link to="/clients/$clientId#assessment"`. Se houver síntese, chip "Ver síntese".
     - **2 Briefing**: se `plan.generation_meta?.brief` existir, mostrar 2-3 linhas resumo (objetivo, restrições). Link "Abrir brief" → `/plans/$id?stage=brief`.
     - **3 Plano-mestre**: blocos/fases do plano (`duration_weeks`, foco). Link "Abrir plano-mestre" → `/plans/$id?stage=blueprint`.
     - **4 Semana-tipo**: aqui mora o `<ComplianceDashboard>` (sai de baixo do plano). Mostra cumprimento/sessões da semana atual. Link "Abrir semana" → `/plans/$id`.
     - **5 Progressões**: nota curta sobre regra de progressão do plano (se disponível em `generation_meta`). Link "Abrir progressões" → `/plans/$id?stage=progressions`.
   - Cada painel é leve (sem queries novas — usa o que já vem em `plan` + `genState`). Onde não há dados ricos, mostra placeholder honesto + link.
  3. **Strip do plano** redesenhada para clarificar afordância:
     - O **título inteiro** vira um `<Link to="/plans/$planId">` com `ChevronRight` à esquerda e hover `ring-1 ring-amber-500/40`. Subtítulo "Bloco N · Wk x de y · Abrir plano" para o tornar inequívoco.
     - À direita, **dois botões iconográficos separados** com tooltip: `[↓ PDF]` (ghost icon-only) e `[✎ Editor]` (ghost icon-only) — em vez do botão grande "PDF" que parecia ser a única ação.
  4. **Linha "Sinais"** no fundo: mantém os mesmos chips ACSM + Recovery que estavam em cima, agora claramente separados do protocolo por um divisor `border-t border-border/40`.
- Remover a action row final (Logbook / Editor) — fica redundante com o `[✎]` da strip e os links dentro de cada painel de etapa.

### i18n
- Adicionar chaves em `src/i18n/locales/{pt,en}/common.json` sob `clients.cockpit.*`:
  - `signals_label` = "Sinais" / "Signals"
  - `stage_panel.1.title` … `stage_panel.5.title`
  - `stage_panel.open_plan`, `stage_panel.open_brief`, `stage_panel.open_assessment`, etc.
  - `plan_strip.open_plan` = "Abrir plano" / "Open plan"
  - `plan_strip.pdf_tooltip`, `plan_strip.editor_tooltip`

## Não-objetivos (deixar para depois)
- Sistema de quests semanais para preenchimento gradual do assessment (mencionado pelo utilizador como design futuro) — fora deste âmbito; podemos abrir item no backlog.
- Mudanças à página `/clients/$clientId` (a página de detalhe). Esta tarefa só toca no card expandido do `/dashboard` + no `ProtocolRail` (que é partilhado mas as alterações são retro-compatíveis).

## QA
- 375px Mobile Safari smoke: rail enrolar bem, painel de etapa não fazer overflow, dois botões iconográficos sem encavalitar o título.
- Conferir num cliente sem plano (Rebeca): só vê painel da etapa 1 + chip ACSM/Recovery se houver assessment.
- Conferir num cliente com plano completo (André): % real do assessment (não 100% forçado), todas as 5 etapas verdes, painel 4 com Compliance.
