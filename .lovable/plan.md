## Próximo passo escolhido

Antes de avançar para A2-lite (locale) ou A5+B4 (radar), há um **bug bloqueador** acabado de reportar: clicar em "Gerar Blueprint" leva o utilizador para uma página de plano vazia. Isto invalida o flow inteiro do Stage 2→4 que acabámos de ligar. Tem de ser fixado primeiro.

---

## Diagnóstico (do que li no código)

`src/server/phased/stage2-blueprint.functions.ts` **persiste correctamente** o blueprint em DB. `runStage("blueprint")` em `clients_.$clientId.tsx` faz `await generateBlueprintFn` e só navega se `res.ok`. Em teoria funciona.

**Causas prováveis do "vazio"** (por ordem de probabilidade):

1. **planId stale/errado** — `inlineBrief.planId` em estado pode apontar para um plano antigo (sem brief válido). `generateBlueprint` devolve `{ ok:false, error:"Brief is missing or invalid" }`, o toast aparece mas é fácil não notar; e mesmo que não navegue via `runStage`, o utilizador pode clicar em "Planos Anteriores" e cair em `/plans/X/blueprint` directamente, onde `BlueprintReview.load()` chama `regenerate()` que falha silenciosamente — o ecrã fica vazio.
2. **Auto-regenerate em `plans.$planId.blueprint.tsx`** engole erros: se `regenerate()` falha, mostra toast mas mantém `blueprint=null` e a UI fica em branco sem CTA claro de retry/voltar.
3. **Race com `refreshPlans` + navegação** — improvável, mas o navigate dispara antes do DB consolidar a leitura.

---

## Prompt — versão draft (v1)

```
GOAL:
Clicar "Gerar Blueprint" no client page produz sempre uma blueprint
visível e editável; aterrar em /plans/$planId/blueprint nunca mostra
ecrã vazio sem feedback.

CONTEXT:
- src/routes/clients_.$clientId.tsx: runStage("blueprint") chama
  generateBlueprintFn e navega para /plans/$planId/blueprint.
- src/routes/plans.$planId.blueprint.tsx: load() chama regenerate()
  silenciosamente quando blueprint é null.
- src/server/phased/stage2-blueprint.functions.ts persiste OK no DB.
- Bug: utilizador vê página vazia.

TASK:
Tornar a geração robusta e o estado vazio diagnosticável.

CONSTRAINTS:
- no unrelated changes
- no refactors unless necessary

ACCEPTANCE:
- Gerar funciona
- Não fica vazio

ROLLBACK:
- git revert
```

---

## Red-team da v1

| # | Falha | Impacto |
|---|---|---|
| R1 | "Gerar funciona" / "Não fica vazio" não são mensuráveis — não há critério de pass/fail objectivo. | Alto |
| R2 | Não diz **qual planId** usar nem como verificar que o `inlineBrief.planId` é o correcto. Lovable vai assumir e pode mexer noutro caminho. | Alto |
| R3 | "Tornar robusta" é vago — abre porta a refactor não pedido (viola própria constraint). | Médio |
| R4 | Não cobre o caso de chegar à página de blueprint **directamente** (via lista de planos antigos) com brief inválido — só fala do click no client page. | Alto |
| R5 | Não define o que mostrar no estado de erro (banner? botão Voltar? botão Retry?). Lovable vai inventar UI. | Médio |
| R6 | Rollback "git revert" é genérico — não identifica os ficheiros tocados, então não dá segurança ao operador. | Baixo |
| R7 | Não restringe o âmbito a Stage 2; pode arrastar Stage 3/4 "por simetria". | Médio |
| R8 | Falta menção a logs/observabilidade — sem isso não conseguimos confirmar acceptance. | Médio |

---

## Prompt — versão final (v2, aplicar)

```
GOAL:
Eliminar o estado "página de Blueprint vazia sem feedback".
Após clicar "Gerar Blueprint" no client page, OU aterrar em
/plans/$planId/blueprint vindo de qualquer link, o utilizador vê
sempre uma de três coisas: (a) blueprint preenchida, (b) loader
explícito enquanto gera, (c) banner de erro accionável com botão
"Tentar de novo" e link "Voltar ao cliente".

CONTEXT:
Ficheiros envolvidos (NÃO tocar mais nenhum):
- src/routes/clients_.$clientId.tsx — runStage("blueprint") nas
  linhas ~1913-1965. Usa inlineBrief.planId.
- src/routes/plans.$planId.blueprint.tsx — load() / regenerate() /
  componente BlueprintReview. Auto-regenera em silêncio se blueprint=null.
- src/server/phased/stage2-blueprint.functions.ts — devolve
  { ok:false, error } em forbidden / brief inválido / falha LLM.
  Já persiste em DB via supabase.update quando ok.

Bug observado: utilizador clica "Gerar Blueprint" e aterra numa
página vazia. Hipótese principal: generateBlueprint devolve ok:false
(planId stale, brief inválido, ou falha LLM) e a UI engole o erro.

TASK:
Em plans.$planId.blueprint.tsx adicionar três estados explícitos no
componente BlueprintReview: "loading" (spinner + texto "A gerar
Blueprint…"), "error" (banner vermelho com mensagem do servidor +
botão "Tentar de novo" que chama regenerate() + Link "← Voltar ao
cliente" usando o trainer/client do plano), "ready" (UI actual).
Guardar lastError:string|null no estado. Em load(), se blueprint=null
E generation_state.approved_stages NÃO inclui "brief", mostrar erro
"Brief não aprovado para este plano" com link de volta — NÃO chamar
regenerate(). Em runStage do client page, em caso de res.ok=false,
NÃO navegar (já é o caso) e prefixar o toast com "Blueprint:" para
debug. Adicionar console.error com {planId, error} em ambos os
catches.

CONSTRAINTS:
- Não alterar stage2-blueprint.functions.ts.
- Não alterar Stage 3/4 nem outros ficheiros além dos dois listados.
- Sem refactor de BlueprintReview — apenas adicionar estados.
- Sem mudanças de design noutros lados.
- Manter auto-regenerate quando brief ESTÁ aprovado e blueprint=null.

ACCEPTANCE:
1. Abrir /plans/<id-com-brief-aprovado-mas-sem-blueprint>/blueprint
   mostra spinner "A gerar Blueprint…" e depois a blueprint
   preenchida, OU banner de erro com botão "Tentar de novo".
2. Abrir /plans/<id-sem-brief-aprovado>/blueprint NÃO dispara LLM,
   mostra banner "Brief não aprovado para este plano" + link voltar.
3. No client page, clicar "Gerar Blueprint" com planId inválido faz
   aparecer toast prefixado "Blueprint: <erro do servidor>" e o user
   PERMANECE no client page (não navega).
4. console do browser regista console.error em qualquer falha, com
   planId e mensagem.

ROLLBACK:
Reverter apenas estes dois ficheiros:
- src/routes/plans.$planId.blueprint.tsx
- src/routes/clients_.$clientId.tsx
(git revert <commit> ou restaurar à versão anterior pela timeline
do Lovable).
```

---

## Plano de execução (após aprovares)

1. Editar `src/routes/plans.$planId.blueprint.tsx`:
   - Adicionar `lastError: string | null` no estado.
   - Em `load()`: ler `generation_state.approved_stages`; se não inclui `"brief"` → setar `lastError="Brief não aprovado para este plano"` e NÃO chamar `regenerate()`.
   - Em `regenerate()`: capturar `res.error` para `lastError` em vez de só toast.
   - Renderizar três branches: loading / error (banner + retry + Voltar) / ready.
2. Editar `src/routes/clients_.$clientId.tsx`:
   - No `catch` e no `!res.ok` do `runStage`, prefixar toast com `"Blueprint: "` (e equivalentes para microcycle/progressions) e `console.error({planId, stage, error})`.
3. Sem migrações, sem mudanças de schema, sem deploy de edge functions.

Aprovas para eu aplicar?
