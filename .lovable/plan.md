## Round 10 — proposta

Foco: fechar 3 itens do backlog (P1/P2) que tornam a evolução entre blocos visível em mais sítios e que validam a higiene do motor de rotação.

### 1. Sparkline e1RM no Dashboard (P1, item #16)
- Criar `src/components/EvolutionSparkline.tsx` — SVG puro, ~64×16px, 1 polyline tonal (emerald/amber/red consoante verdict).
- Estender `usePlanBlockEvolution` para devolver também `topLiftSeries` (até 8 pontos do `currentBest`/sessão para o lift mais frequente).
- Em `src/routes/dashboard.tsx`, renderizar a sparkline ao lado do `EvolutionChip` em "Recent plans".

### 2. Tooltip detalhado no chip "Rotação N%" (P2, item #18)
- Substituir `title="..."` no chip por `Popover` (já usado no header).
- Mostrar: `firstPct → finalPct` (se houve retry), `daysRegenerated`, e a lista (até 6) de exercícios do `prior_exercise_pool` que continuam presentes.
- Helper puro `src/lib/rotation-audit.ts` para formatar o payload — fácil de testar e reusar.

### 3. Variação opcional do main lift após 3 blocos (P1, item #19)
- Em `src/server/blocks.functions.ts > archivePlanAndStartNextBlock`: quando `block_number+1 >= 4`, marcar `generation_meta.suggest_main_lift_swap = true` com sugestões por padrão (ex.: back squat → front squat; bench → incline DB).
- No prompt do Stage 3 (`stage3-microcycle.functions.ts`), ler essa flag e, se presente, instruir a IA a trocar o main lift de pelo menos 1 padrão (sem forçar — autonomia controlada).
- Surfacing: chip "Main lift refrescado" no header quando a flag dispara e o nome do main lift mudou vs bloco anterior.

### 4. Atualizar `.lovable/backlog.md`
- Marcar #16, #18, #19 como ✅ Round 9.
  Wait — vai ser Round 10. Marcar como ✅ Round 10.
- Adicionar para Round 11: stack-bar prescrito vs realizado (#15) e sweep EN final (#11).

### Critérios de aceitação
- Dashboard: cada plano com `prior_plan_id` mostra Δ% chip + sparkline numa única linha sem partir o layout em 846px.
- Plan header: clicar no chip Rotação abre popover legível (≤320px de largura) com lista de colisões.
- Bloco 4 gerado a partir de demo: `generation_meta.suggest_main_lift_swap === true` e o main lift de pelo menos 1 padrão difere do bloco 3.
- `tsc --noEmit` continua limpo.

### Ficheiros tocados
- Novos: `src/components/EvolutionSparkline.tsx`, `src/lib/rotation-audit.ts`.
- Editados: `src/hooks/use-clients-block-evolution.ts`, `src/routes/dashboard.tsx`, `src/routes/plans.$planId.tsx`, `src/server/blocks.functions.ts`, `src/server/phased/stage3-microcycle.functions.ts`, `.lovable/backlog.md`.

Aprovas?