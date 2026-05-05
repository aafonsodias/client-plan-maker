# Round 59 — Less surface, more signal

Princípio: cada mudança remove ruído visual ou rotas duplicadas, mantendo (ou aumentando) utilidade. Nada de features novas grandes — esta ronda é de condensação.

## 1. Trainee `/me` cockpit (fecha promessa do R58)

`/me` hoje é uma página de definições. Para quem é trainee (sem clientes), entrar na app cai em `/dashboard` que mostra "lista de clientes vazia" — frustrante.

Adicionar em `src/routes/me.tsx`:
- **Hero faixa**: próximo treino (data + foco) + Δ% e1RM esta semana + sleep/energy mais recente
- **Mini-mesocycle** (4 semanas): grid 7 dias × 4, igual ao `MiniWeek` do CoachCockpit mas para o próprio plano
- **Próximo bloco**: usa `NextBlockCard` já existente (deload/normal/push)
- **Logbook recente**: últimas 3 sessões com PR badges

Detecção: `useUserMode()` → se `coach`, redirect para `/dashboard`; se `individual` ou `trainee`, fica em `/me`.

Sem nova migration — usa `useClientPhases`, `computeCapacityGain`, `listSessions` já existentes, parametrizando `clientId = self`.

## 2. Trim do header em `/clients/$id`

Hoje o `/clients/$clientId` repete: avatar plate + ACSM/Recovery chips + ProtocolRail + ThisWeekHero. Tudo isso já está no `ClientCockpit` expansível na dashboard.

Reduzir o header para 3 linhas finas:
```
← Todos os clientes  ·  Maria Silva  ·  [Phase pill]  ·  [Mais ações ▾]
```
Mover ACSM/Recovery chips para dentro de um `<details>` "Contexto clínico" colapsado por padrão. ProtocolRail desce para baixo das StageCards (já está duplicado).

Ganho: `/clients/$id` lê como builder puro. Cockpit fica como overview.

## 3. Fusão de rotas: Templates + Packs

- `/templates` → `/plans?tab=templates` (nova `<Tabs>` no topo de `/plans`: "Active · Drafts · Templates")
- `/schedule/packs` → `/schedule?tab=packs` (já existe `Tabs` no `/schedule`, só falta a aba)

Manter os ficheiros antigos como redirects (`createFileRoute` com `beforeLoad: () => redirect(...)`) por 1 round antes de apagar.

Ganho: 5 rotas top-level → 3. Sidebar/AppShell fica mais leve.

## 4. Landing: fundir "Anti-ChatGPT" + "Para quem é"

São 2 secções consecutivas com a mesma estrutura (eyebrow + título + chips/grid). Fundir numa só:

```
"Para quem (e contra quem)"
   [Personas: Coach / Solo / PT-online]
   ─── divisor fino ───
   "Não é ChatGPT genérico — é um sistema com memória"
   [Chips das 5 secções estruturadas]
```

Ganho: ~400px de scroll a menos no desktop, mesma informação. Aumenta densidade percebida.

## Fora de scope (para próxima ronda)

- Reescrita IA no MessageComposer (R60)
- Field/gym assessment expansion (precisa decisão de UX antes)
- Public "Train with me" join link (P1, próprio round por ter rate-limit + RLS pending)

## Ficheiros tocados (estimativa)

- `src/routes/me.tsx` — reescrita parcial (cockpit + fallback settings)
- `src/routes/clients_.$clientId.tsx` — header slim
- `src/routes/plans.tsx` + `src/routes/templates.tsx` (redirect)
- `src/routes/schedule.tsx` + `src/routes/schedule.packs.tsx` (redirect)
- `src/routes/index.tsx` — merge de duas secções
- `src/i18n/locales/{pt,en}/plan.json` — merge de chaves anti_chatgpt + for_whom
- `src/hooks/useUserMode.ts` — pequena extensão para incluir "trainee"
- `.lovable/backlog.md` — fechar #72, abrir #73 e nova nota R59

Sem migrations. Sem novas server fns. Tudo reusa o que já existe.
