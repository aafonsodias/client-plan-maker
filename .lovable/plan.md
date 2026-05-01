## O que observei

Olhei o teu plano `André Periquito… 4-Week Plan` no DB:
- ✅ `brief` aprovado (rico — risk flags, movement screen, body comp, etc.)
- ✅ `blueprint` gerado e válido
- ❌ `progression_plan` ainda nulo
- ❌ `plan_data.weeks = []` (legacy vazio — por isso vês "No weeks yet")
- `generation_state.stage = "blueprint"`

**A tua queixa real**, traduzida: *"o sistema deixa-me preencher tudo à mão como se fosse um plano em branco, mas perdeu por completo o conhecimento do brief. As decisões — porque é que este archetype, porque esta sessão, porque estes movimentos — não são herdadas."*

Tens razão em três frentes:

1. **As páginas dos stages 2/3/4 mostram só o esqueleto técnico** (archetype IDs, week×day matrix, deltas), nunca te mostram o "porquê do brief" que justifica cada decisão. Não há **header sticky com red flags + movement screen + cap×PB** sempre visível.
2. **Quando o microcycle (Day 1) é gerado, NÃO te explica** que `lower_squat_strength` foi escolhido **porque** o brief disse "neck damage from BJJ → modify overhead", "hip pinching → accommodate flexion depth". A `rationale` por dia existe no schema mas não está visível.
3. **A página antiga `/plans/$planId`** ainda existe e ainda apanha planos phased em alguns flows (link das screenshots) — embora eu tenha posto o redirect, há cliques que aterram lá antes do useEffect correr (paint inicial). Tu acabas a editar um plano em branco achando que é o "real".

---

## Proposta — três passos pequenos, sequenciais

### Passo A (fix imediato, hoje): "Brief Context Rail" sticky em todos os stages 2/3/4

Adicionar um componente reutilizável `<BriefContextRail planId>` que carrega o brief 1×, e renderiza um **lateral colapsável** (ou topo collapsível em mobile) com:

- **Goals** (top 3) + timeline
- **Red flags** com a sua acção (`modify` / `monitor` / `accommodate`)
- **Movement screen** (squat/hinge/push/pull/lunge/carry scores) — versão mini
- **Body comp / risk** (BF%, WHR, ACSM risk)
- **Equipment & sessions/week**
- **Goal-fit constraints** (o que NÃO fazer)

Aparece em `/plans/$planId/blueprint`, `/microcycle` e `/progressions`. Sempre visível. Para que ao gerar/editar o user veja o "porquê" do brief sem trocar de página.

Custo: ~150 linhas, 1 componente novo, 3 imports. Sem mudanças de schema, sem mudanças server-side.

### Passo B (próximo): "Why this?" inline em cada decisão gerada

- No Blueprint: por baixo de cada **archetype** mostrar uma frase do tipo *"Escolhido porque brief: focus=hipertrofia, hinge score 3/5 → RDL antes de deadlift"* — usar `progression_model_proposal.rationale` que já existe + uma linha por archetype gerada pela LLM (campo novo `archetypes[].rationale`).
- No Microcycle/Day 1: tornar visível o `rationale` que **já é gerado** mas está escondido na coluna `rationale` da tabela.
- No Progressions: mostrar `progression_plan.rationale` por dimensão.

Custo: stage2 schema ganha `archetypes[].rationale: string` (1 migração lógica, sem DB), prompt actualizado, UI mostra. ~200 linhas.

### Passo C (depois): matar o aterrar na página legacy

O redirect que fiz só corre no `useEffect`. Mover para `beforeLoad` da rota `/plans/$planId` — assim a página antiga **nunca chega a render** para planos phased. User nunca mais vê "Summary (empty)" / "No weeks yet" para um plano novo.

Custo: 10 linhas. Resolve as screenshots 2/3/4 que mandaste.

---

## Prompt — versão final (Passo A, para arrancar agora)

```
GOAL:
Em /plans/$planId/blueprint, /microcycle e /progressions o
utilizador vê SEMPRE o contexto do brief aprovado (goals, red
flags com acção, movement screen, body comp, equipment) num rail
lateral sticky (desktop) ou collapsible no topo (mobile). Sem
trocar de página e sem perder a UI actual.

CONTEXT:
- workout_plans.brief é jsonb e respeita BriefSchema
  (src/server/phased/schemas.ts). Tem: client_snapshot.goals[],
  client_snapshot.red_flags[] (cada um com {flag, severity,
  recommended_action: "modify"|"monitor"|"accommodate"}),
  client_snapshot.movement_screen (squat/hinge/push/pull/lunge/
  carry como 1-5), client_snapshot.body_composition (bf_pct, whr,
  acsm_risk), client_snapshot.equipment[],
  sessions_per_week.recommended.
- 3 rotas alvo: src/routes/plans.$planId.blueprint.tsx,
  plans.$planId.microcycle.tsx, plans.$planId.progressions.tsx.
- Já existe useServerFn / supabase client; brief é leitura RLS-
  safe via supabase.from("workout_plans").select("brief").
- Cliente actual está em /clients/<id> e tem componentes que
  renderizam algumas destas peças (referência visual, não
  importar).

TASK:
1. Criar src/components/BriefContextRail.tsx que recebe
   {planId: string} e:
   - Faz select supabase de workout_plans.brief uma vez (state
     local; sem React Query — manter consistente com restantes
     páginas).
   - Parse com BriefSchema.safeParse; em falha mostra placeholder
     "Brief indisponível" + link "Abrir Brief".
   - Renderiza 5 secções colapsáveis (todas abertas por default
     em desktop): "Objetivos", "Sinais de alerta", "Competência
     de movimento", "Composição corporal · Risco", "Equipamento
     & frequência".
   - Red flags: cada linha mostra texto + badge da
     recommended_action (modify=amber, monitor=blue,
     accommodate=violet) usando design tokens
     (bg-accent/bg-secondary/border-border).
   - Movement screen: 6 mini-bars 1-5, cor accent.
   - Body comp: BF%, WHR, ACSM risk como tag.
   - Goals: lista numerada top 3.
   - Equipment: chips horizontais.
2. Layout: em ≥lg viewport, fixed à direita com width 320px,
   sticky top-16, max-h-[calc(100vh-5rem)] overflow-y-auto.
   Em <lg, render como <details> collapsible no topo da página.
3. Integrar em blueprint/microcycle/progressions:
   - Wrap o conteúdo principal num <div class="lg:flex
     lg:gap-6"><main class="flex-1 min-w-0">…UI actual…</main>
     <aside class="hidden lg:block w-80 flex-shrink-0">
     <BriefContextRail planId={planId} /></aside></div>.
   - Em mobile, render <BriefContextRail> ANTES da UI actual.
4. Sem mudar nenhum dos componentes existentes Blueprint /
   Microcycle / Progressions internamente. Apenas wrap.

CONSTRAINTS:
- Não tocar em server functions, schemas, ou edge functions.
- Não alterar a página /plans/$planId (legacy).
- Não mudar branding/cores; usar tokens existentes
  (bg-card, border-border, text-muted-foreground, bg-accent,
  etc.).
- Sem novas dependências.
- Sem refactor de Blueprint/Microcycle/Progressions além do
  wrapper de layout.

ACCEPTANCE:
1. Abrir /plans/<planId-com-brief>/blueprint em desktop ≥1024px:
   à direita aparece um rail sticky com 5 secções e dados
   reais do brief; à esquerda continua a ver a UI de archetypes
   + week×day matrix exactamente como antes.
2. O mesmo rail aparece em /microcycle e /progressions.
3. Em viewport <1024px o rail aparece como bloco collapsible
   colapsado no topo (mobile-friendly).
4. Se o brief estiver inválido/ausente, o rail mostra fallback
   "Brief indisponível" com link para /plans/$planId/brief — não
   crasha.
5. Nenhuma alteração de comportamento no Blueprint editing
   (archetypes, matrix, approve, regenerate continuam a
   funcionar).

ROLLBACK:
Apagar src/components/BriefContextRail.tsx e reverter os
3 ficheiros de rota (apenas o wrapper de layout adicionado).
```

---

## Plano de execução do Passo A

1. **Criar `src/components/BriefContextRail.tsx`** (~180 linhas). Carrega brief, parse, render 5 secções com tokens semânticos.
2. **Editar 3 ficheiros de rota** (`blueprint`, `microcycle`, `progressions`): wrap conteúdo num grid `lg:flex` + `<aside>` à direita; em mobile, rail no topo collapsed.
3. Sem migrações, sem servidor, sem novas deps.

**Depois disto pergunto-te se queres seguir para Passo B (rationale inline) ou Passo C (kill da aterragem na página legacy).**

Aprovas o Passo A?
