## Diagnóstico definitivo

Verifiquei o estado do plano `819c0eef-…` no DB:
- **Blueprint foi gerada e persistida** ✅ (objecto válido com `sessions_per_week=6`, archetypes etc.)
- `generation_state.stage = "blueprint"`, `approved_stages = ["brief"]`
- Toast "Blueprint pronto" no screenshot ✅

O screenshot que mandaste mostra a **página antiga monolítica `/plans/$planId`** (vês "Summary (empty)", "AI validation report", "No weeks yet"). Essa página NÃO é a `/blueprint` nova — é o editor antigo de planos legacy.

**Causa raiz**: existem dois sítios que linkam para `/plans/$planId` em vez de para o stage actual:
1. A lista "All plans" / cards de plans antigos vão sempre para `/plans/$planId`.
2. Após aprovar o brief, há fluxos que aterram em `/plans/$planId` (página antiga) em vez de `/plans/$planId/blueprint`.

A página `/plans/$planId` está a renderizar `plan_data.weeks` (vazio nos planos phased novos, porque os dados estão em `blueprint`/`microcycle_template`/etc., não em `plan_data`). Dá a sensação de "carreguei e não aconteceu nada".

---

## Prompt — versão final

```
GOAL:
Quando o utilizador aterra em /plans/$planId de um plano "phased"
(que tem generation_state com stage), redirecionar
automaticamente para o stage actual (/blueprint, /microcycle,
/progressions ou /sessions). Planos legacy (sem generation_state)
continuam a usar a página antiga.

CONTEXT:
- src/routes/plans.$planId.tsx é o editor monolítico antigo.
  Carrega workout_plans.* e mostra plan_data.weeks. Para planos
  phased, plan_data.weeks=[] e o user vê "Summary (empty)" + "No
  weeks yet" — falsa sensação de erro.
- workout_plans.generation_state shape:
    { stage: "brief"|"blueprint"|"microcycle"|"progressions"|"done",
      approved_stages: string[],
      last_updated_at: string }
- Rotas existentes: /plans/$planId/brief, /blueprint, /microcycle,
  /progressions, /sessions.
- Se generation_state for null/undefined → plano legacy → não
  redirecionar.

TASK:
Em src/routes/plans.$planId.tsx, no useEffect que carrega o plano,
após `setPlan(p)`, ler p.generation_state. Se existe e tem `stage`
não-null, fazer navigate({ to, replace: true }) para a rota do
stage actual:
- "brief"        → /plans/$planId/brief
- "blueprint"    → /plans/$planId/blueprint
- "microcycle"   → /plans/$planId/microcycle
- "progressions" → /plans/$planId/progressions
- "done"         → /plans/$planId/sessions
Usar `replace: true` para que o "back" do browser não fique preso
em loop. Se generation_state é null/undefined, não fazer nada
(plano legacy).

CONSTRAINTS:
- Não alterar a UI nem a lógica do PlanEditor para planos legacy.
- Não tocar em outros ficheiros.
- Não mexer em rotas /brief, /blueprint, etc.
- Sem refactor — apenas adicionar bloco de redirect dentro do
  useEffect existente.

ACCEPTANCE:
1. Aterrar em /plans/<phased-plan-id> redireciona instantaneamente
   para /plans/<id>/blueprint (ou stage correspondente). User vê a
   nova UI com archetypes/weeks já preenchida.
2. Aterrar em /plans/<legacy-plan-id> (sem generation_state)
   continua a mostrar a página antiga sem redirect.
3. O botão "back" do browser não fica em loop entre /plans/$planId
   e /plans/$planId/blueprint (graças a replace:true).
4. Console regista console.info("[PlanEditor] redirect", {planId,
   stage, to}) quando o redirect dispara.

ROLLBACK:
Reverter src/routes/plans.$planId.tsx (apenas adições no useEffect
que carrega o plano).
```

---

## Plano de execução

1. **`src/routes/plans.$planId.tsx`**: dentro do `useEffect` (linha 59), depois de `setPlan(p)`:
   - Se `p?.generation_state?.stage` existe, mapear para a rota correspondente.
   - Chamar `navigate({ to, params: { planId }, replace: true })`.
   - Adicionar `console.info` para debug.
   - **Returnar cedo** para evitar carregar o resto (sessions, profile) quando vamos redirecionar.
2. Sem mudanças noutros ficheiros.
3. Sem migrações.

**Resultado esperado**: nunca mais ver "Summary (empty)" / "No weeks yet" para um plano phased. Qualquer link antigo (lista de planos, histórico do browser, partilhas) cai sempre na UI nova do stage actual.

Aprovas?
