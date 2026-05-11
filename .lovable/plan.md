## Step C — Painel "Configurar mesociclo" mostra réguas activas

Adicionar 2 chips informativos no topo do painel de regeneração para o treinador ver exactamente que constraints o AI vai seguir antes de clicar "Regenerar".

### O que muda na UI

No `RegenerateWithFeedbackDialog` (src/components/PlanEditorSurface.tsx), por cima do textarea de feedback:

1. **Chip de Tier classificado**
   - Formato: `🟢 Avançado` / `🟡 Conservador` / `🔵 Remedial`
   - Tooltip/subtítulo com a razão: ex. "2 falhas no movement screen · stress 8/10 · 1 red flag"
   - Cores via `src/lib/status-tone.ts` (emerald/amber/blue conforme memory)

2. **Chip de RPE floors aplicados**
   - Formato compacto: `RPE mín — Main 7 · Acessórios 6 · Carries 6`
   - Mostra os pisos que o AI não pode violar nesta regeneração

### Fonte de dados

Criar server fn `getPlanConstraints({ plan_id })` em `src/server/phased/programming-tier.server.ts` (ou novo `.functions.ts` ao lado) que:
- Carrega assessment + brief do plano
- Corre `classifyTier()` → devolve `{ tier, reason, rpeFloors, setCaps }`
- Read-only, sem efeitos

Chamar via `useQuery` quando o dialog abre (não no mount do PlanEditorSurface, para evitar peso quando não se está a regenerar).

### Estados

- Loading: skeleton de 2 linhas
- Erro: esconde chips, não bloqueia regeneração (fallback silencioso, log no console)
- Sem assessment: chip único "Sem assessment — defaults conservadores"

### Fora de âmbito

- Editar os floors a partir do painel (continua read-only — fonte de verdade é o assessment)
- Mostrar set caps (informação demasiado densa para um chip; fica para tooltip futuro se pedido)
- Mexer no Stage 4/5 ou no pipeline phased (já está correcto)
- Tradução PT/EN dos novos labels — vai por `t()` em `common.json` namespace `plan.regenerate.constraints.*`

### Ficheiros tocados

- `src/components/PlanEditorSurface.tsx` — adicionar chips + useQuery no dialog
- `src/server/phased/programming-tier.server.ts` ou novo `programming-tier.functions.ts` — expor `getPlanConstraints`
- `src/i18n/locales/en/common.json` + `pt-PT/common.json` — strings novas
