# Round 60.1 — Higiene mobile (390px)

Capturei screenshots em iPhone (390×844) das 3 rotas principais (`/`, `/dashboard`, `/schedule`). Em vez de avançar para R61 (cockpit `/me` + slim header) — que são features grandes — proponho fechar 5 fricções concretas que vi no ecrã. Tudo pequeno, sem migrations, sem novas server fns, sem novos componentes.

## Problemas observados

1. **`/schedule` — botão "Gerir packs" duplica a aba Packs.**
   No header tens `[Tabs: Week | Packs]` e logo abaixo um botão `[⚙ Gerir packs]` que navega exactamente para `?tab=packs`. Ruído puro.

2. **`/schedule` — header em 4 linhas no mobile.**
   Sequência actual: `← Voltar` → `Tabs` → `título+subtítulo` → `‹ Esta semana › 04/05–10/05` → `[Gerir packs] [+ Nova sessão]`. Antes do utilizador ver UM dia já fez ~520px de scroll. O `← Voltar` é redundante (Tabs já é nav top-level dentro de `/schedule`) e o "subtitle" repete a info do range de datas.

3. **`/schedule` — DayStrip mostra scrollbar horizontal feia.**
   Os 7 dias cabem se for `grid grid-cols-7` em vez de `flex overflow-x-auto`. A scrollbar nativa do mobile (a barra cinza espessa visível na screenshot) é puro lixo visual.

4. **`/schedule` — KPIs "0€ / 0 / 0 / Sem alertas" ocupam 200px a dizer nada.**
   Numa semana sem bookings, mostrar 4 caixas a 0 é desinformativo. Colapsar em 1 linha fina ("Esta semana · 0 sessões · 0€ esperado") quando `sessionsThisWeek === 0`.

5. **`/dashboard` — coluna `TUE 5` (hoje) cresce mais alta que as outras 6.**
   No `WeekTimetable` a célula activa tem padding extra que faz toda a row crescer. Visualmente desalinha tudo. Fix: `min-h` partilhado em vez de padding condicional.

## Mudanças

### `src/routes/schedule.tsx`
- Remover o botão `<Button asChild>...{t("manage_packs")}</Button>` (linhas ~192-197). A aba Packs já lá está.
- Tirar o `back={{ to: "/dashboard" }}` do `AppShell` — Tabs já é a navegação principal.
- Remover o `<p>{t("subtitle")}</p>` (a info "sessões da semana e receita esperada" é evidente).
- Header passa a uma linha: título à esquerda, `[‹ semana › range] [+ Nova]` à direita, com `flex-wrap` mantido.
- KPIs: envolver `<RevenuePanel ...>` em `{sessionsThisWeek > 0 ? <RevenuePanel.../> : <CompactStrip/>}`. O `CompactStrip` é um `<div>` interno de uma linha — não merece ficheiro próprio.
- `DayStrip` (linhas 414-436): trocar `flex gap-1 overflow-x-auto` por `grid grid-cols-7 gap-1`. Os botões de dia ficam mais compactos (`min-w` removido, `text-[10px]` mantido).

### `src/components/dashboard/CoachCockpit.tsx` (WeekTimetable)
- Encontrar o bloco que renderiza os 7 dias da timetable (procurar `WED` ou `weekday` no ficheiro). A célula "hoje" tem provavelmente `border-2` ou padding extra que torna a row mais alta. Substituir por `ring-1 ring-amber-500/60` interior + `min-h-[88px]` em todas as 7 células. Sem mudança de layout, só consistência de altura.

## Fora deste round (ficam em backlog R61)

- Cockpit `/me` para trainees (hero + mini-mesocycle + NextBlock).
- Slim header `/clients/$id` com `<details>` clínico.
- AI rewriter no `MessageComposerSheet`.

## Ficheiros tocados

- `src/routes/schedule.tsx` — header colapsado, botão duplicado removido, KPIs condicionais, DayStrip em grid.
- `src/components/dashboard/CoachCockpit.tsx` — alinhar altura das 7 células da timetable.
- `.lovable/backlog.md` — marcar 60.1 fechado, manter 80-82 em R61.

Sem migrations, sem novos componentes, sem novas server fns. Tudo refactor visual mínimo.
