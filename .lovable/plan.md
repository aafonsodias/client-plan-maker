# Round 60 — Condensar rotas e fechar promessa do trainee

Princípio: zero novas features grandes. Reduzir 5 rotas top-level → 3, dar ao trainee uma página com sinal real, e tornar `/clients/$id` num builder limpo. Tudo reusa código existente. Sem migrations. Sem novas server fns.

## 1. Fusão `/templates` → `/plans?tab=templates`

`src/routes/plans.index.tsx` ganha um `<Tabs>` no topo:

```text
[ Activos · Drafts · Templates ]
```

- `validateSearch` aceita `tab: "active" | "drafts" | "templates"` (default `active`).
- Abas Activos/Drafts particionam a lista actual de planos por `status`.
- Aba Templates importa o corpo de `TemplatesIndex` (mover para `src/components/plans/TemplatesPanel.tsx`, sem AppShell — o panel só renderiza grid + acções).
- Sidebar/AppShell deixa de ter entrada "Templates" — passa a ser `Link to="/plans" search={{ tab: "templates" }}`.

`src/routes/templates.tsx` reduz para redirect:

```ts
export const Route = createFileRoute("/templates")({
  beforeLoad: () => { throw redirect({ to: "/plans", search: { tab: "templates" } }); },
});
```

## 2. Fusão `/schedule/packs` → `/schedule?tab=packs`

`src/routes/schedule.tsx` ganha o mesmo padrão (`tab: "week" | "packs"`, default `week`).
- Aba Week = conteúdo actual da agenda.
- Aba Packs = corpo de `SchedulePacksIndex` extraído para `src/components/schedule/PacksPanel.tsx`.
- Botão "Manage packs" do `RevenuePanel` muda para `<Link to="/schedule" search={{ tab: "packs" }}>`.

`src/routes/schedule.packs.tsx` vira redirect equivalente. (Manter ambos os redirects 1 round antes de apagar — bookmarks/quick-search ainda resolvem.)

## 3. Trainee `/me` cockpit

Hoje `/me` é uma página de boas-vindas + plano actual em texto. Para um trainee que vem treinar, isto é pouco. Reescrita parcial mantendo o fallback "conta não ligada":

```text
┌── header (foto + nome + treinador) ──┐
│ Próximo treino · Ter 06:30 · Push    │
│ Última sessão · há 2d · 3 PRs        │
├── Mini mesocycle (4 semanas × 7d) ───┤
│ grid colorido por status, hoje destacado
├── Próximo bloco ─────────────────────┤
│ <NextBlockCard/> (deload/normal/push)
├── Logbook recente (3 últimas) ───────┤
│ data · foco · Δ% e1RM · PR badge
└──────────────────────────────────────┘
```

- `loadMe` server fn estende o que retorna: próxima sessão (`listWeekBookings` filtrado por `clientId`), 3 últimas sessões logadas (`listSessions`), `phases` para o mini-mesocycle (reusa `useClientPhases` no client).
- Componentes 100% reusados: `MiniWeek` (extrair de `CoachCockpit` para `src/components/MiniWeek.tsx`), `NextBlockCard`, `LogbookTimeline`.
- `useUserMode()` redirect: se `coach`, navegar para `/dashboard`; se `individual` ou `trainee`, ficar em `/me`.

## 4. Slim header `/clients/$id`

Hoje o topo do client page tem: avatar plate, ACSM/Recovery/Phase chips, ProtocolRail, ThisWeekHero — informação que já vive no `ClientCockpit` da dashboard.

Reduzir para 3 linhas finas:
```text
← Todos os clientes  ·  Maria Silva  ·  [Phase pill]  ·  [Mais ▾]
```
- Chips clínicos (ACSM/Recovery/idade/equipamento) entram num `<details>` "Contexto clínico", colapsado por defeito.
- ProtocolRail desce para baixo das StageCards (já estava duplicado).
- Sem nova lógica — só re-arranjar JSX e envolver em `<details>`.

## Out of scope (R61)

- AI rewriter no `MessageComposerSheet` (ainda hand-written).
- Field/gym assessment expansion.
- Public "Train with me" join link (precisa de RLS + rate-limit próprios).

## Ficheiros tocados

- `src/routes/plans.index.tsx` — Tabs + validateSearch.
- `src/components/plans/TemplatesPanel.tsx` — extracção do corpo de templates.
- `src/routes/templates.tsx` — redirect.
- `src/routes/schedule.tsx` — Tabs + validateSearch + extracção de packs.
- `src/components/schedule/PacksPanel.tsx` — extracção do corpo packs.
- `src/routes/schedule.packs.tsx` — redirect.
- `src/components/schedule/RevenuePanel.tsx` — link "Manage packs" actualizado.
- `src/components/AppShell.tsx` — remover entrada "Templates" do menu (se existir).
- `src/components/MiniWeek.tsx` — extracção a partir de `CoachCockpit.tsx`.
- `src/components/dashboard/CoachCockpit.tsx` — usar o `MiniWeek` partilhado.
- `src/server/me.functions.ts` — estender `loadMe` (next session, recent logs, phases).
- `src/routes/me.tsx` — reescrita parcial com cockpit (mantém branch "not linked").
- `src/routes/clients_.$clientId.tsx` — header slim + `<details>` contexto clínico + ProtocolRail abaixo.
- `.lovable/backlog.md` — fechar 76/77/78/79, abrir R61.
- `mem/index.md` — adicionar Core rule "trainee /me = mini-cockpit, não settings".

Sem migrations. Sem novas server fns além de extensão de `loadMe`. Tudo reusa componentes existentes.
