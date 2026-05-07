
# Plano — Schedule R+1

Vou tratar tudo numa só ronda. Agrupei por área para ficar fácil de validar antes de implementar.

## 1. Receita esperada — toggle "olho" (privacidade)

- Em `RevenuePanel` adiciono um `IconButton` `Eye / EyeOff` no canto do card.
- Estado `revealRevenue` persistido em `localStorage` (`schedule:revealRevenue`), default `false` → mostra `***€` em vez do valor.
- Aplica-se a todos os números monetários do painel (receita esperada, ending soon, etc.).

## 2. Vista mensal do schedule

- Adicionar 3º toggle no header da semana (atual `< ESTA SEMANA >`) → segmented control **Semana / Mês**, alinhado com o existente.
- Search param novo: `view: "week" | "month"` (default `week`). Ao mudar, faço `navigate` (URL é fonte de verdade).
- Componente novo `ScheduleMonth`:
  - Grid 7 colunas × 5–6 linhas, célula = dia do mês.
  - Cada célula mostra até 3 chips compactos (cor do cliente + hora + nome), com "+N" se houver mais.
  - Clicar num chip abre o `BookingDialog` existente; clicar numa célula vazia abre `BookingDialog` com a data pré-preenchida às 09:00.
  - Reaproveita `listWeekBookings` em loop (ou crio um helper `listMonthBookings` no server — preferido, evita 4–6 round-trips).
- Drag/copy ficam só na vista semanal (mês é resumo).

## 3. Pacote — sessões usadas editáveis depois de criado

- `upsertPack` já aceita `sessionsUsed` (server). Falta UI:
  - No `PackFormDialog` em modo edição, o campo "Sessões já usadas" passa a estar sempre visível e editável (não só na criação).
  - Mostro hint "X agendadas + Y feitas = Z usadas" para reduzir confusão.

## 4. Ao criar pacote — agendamento automático opcional

Adiciono uma secção colapsável **"Agendar sessões automaticamente"** no fim do `PackFormDialog`:

- Toggle "Pré-agendar todas as sessões deste pacote" (default off).
- Quando on:
  - Lista de checkboxes Seg–Dom (até `weekly_frequency` selecionados; se faltar, alerta).
  - Modo simples: 1 hora única para todos os dias selecionados.
  - Switch "Horários diferentes por dia" → revela um time picker por cada dia escolhido.
  - "Início" usa `start_date`; gera `pack_size / weekly_frequency` semanas de bookings consecutivas.
- Server: novo `createBooking` em batch via nova fn `seedPackBookings({ packId, slots: [{dow, hhmm}] })`. Cria todas as sessões `scheduled` e respeita o `weeklyFrequency`. Se já existirem bookings nesse slot (conflito), salta com toast "X criadas, Y conflitos".

## 5. Cor por cliente — enforce 1 cliente = 1 cor

Regra de negócio: a cor pertence ao **cliente**, não ao pacote/booking.

- Migration: adiciono `clients.color text` (nullable). Backfill com a cor do primeiro pack do cliente (ou cor aleatória estável da paleta `PACK_COLORS` se não houver).
- Ao criar/editar cliente, atribuo automaticamente uma cor não usada pelos outros clientes do mesmo trainer (round-robin pela paleta de 8). Se já tiver, mantém.
- O seletor de cor deixa de viver no `PackFormDialog`. Passa a estar:
  - Na ficha do cliente (edit cliente) — fonte da verdade.
  - **No `BookingDialog`**, novo botão "Cor do cliente" que abre o picker de paleta — ao mudar, atualiza `clients.color` (afeta todas as sessões e packs desse cliente).
- Render: `packBlockClasses` passa a derivar cor do `client.color` em vez de `pack.color`. `pack.color` mantém-se na BD (compat) mas é ignorado visualmente.

## 6. Copy/paste mantém a hora original

Hoje, ao colar, a sessão usa o slot clicado. Mudança:

- Quando há `clipboard`, clicar num **dia** (cabeçalho do dia ou célula vazia) cola **mantendo a hora original** (`HH:mm` da sessão copiada, novo `YYYY-MM-DD`).
- Clicar especificamente num slot horário continua a colar nesse slot (override explícito).
- O drag vertical já existente continua a permitir mover depois.
- Banner muda para: "A copiar sessão de X (09:00) — clica num dia para colar à mesma hora, ou num slot para escolher hora".

## 7. Botão apagar nas sessões com confirmação

- Junto ao `Copy` dentro do `BookingBlock`, adiciono `Trash2` (mesmo padrão de visibilidade: hover desktop, sempre 60% mobile).
- Click → `AlertDialog` "Apagar esta sessão? Esta ação não pode ser desfeita." → `deleteBooking`.
- Toast de sucesso e refresh.

## 8. Pacotes partilhados (casal / família)

Modelo:

- Migration: tabela `pack_members (pack_id, client_id, primary_payer bool, position int)`. Backfill: para cada `client_packs` existente cria 1 row com `client_id = packs.client_id`, `primary_payer = true`.
- `client_packs.client_id` mantém-se = pagador principal (compat).

UI no `PackFormDialog`:

- Campo "Cliente" continua. Botão **"+ Adicionar cliente partilhado"** abre selector e adiciona à lista.
- Mostra lista: pagador (chip "Paga"), outros membros. Pode marcar quem é o pagador.

Servidor:

- `upsertPack` aceita `memberIds: string[]` e `payerId: string`. Faz upsert em `pack_members`.
- `createBooking`: se o `pack_id` é partilhado, valida que `client_id` ∈ membros do pack. UI no `BookingDialog`: ao escolher um pacote partilhado, o select de cliente filtra para os membros.
- Contagem de sessões: `sessions_used` continua único por pacote (descontam todos do mesmo saldo) — corresponde ao pedido.

Schedule render:

- Cada booking continua a mostrar o cliente que treinou (cor dele). Pacote partilhado só afeta saldo, não a cor.

## 9. Closed beta publish

Não é código — é configuração de publish. Ação: depois desta ronda, `Publish` em **Private** (workspace) e adicionar os teus PTs/clients ao workspace, **ou** publish público com URL não anunciada (security through obscurity, suficiente para closed beta de utilizadores convidados). Recomendo Private — é o que existe no plano Business/Enterprise; se não tiveres, fica público e partilhas só o link. Aviso-te no fim para tu decidires e clicares em Publish.

---

## Detalhes técnicos

**Ficheiros tocados:**
- `src/routes/schedule.tsx` — view toggle (semana/mês), `ScheduleMonth` novo, paste-keeps-time, botão delete em `BookingBlock`, eye toggle wiring.
- `src/components/schedule/RevenuePanel.tsx` — eye toggle + máscara `***€`.
- `src/routes/schedule.packs.tsx` — `PackFormDialog`: pré-agendamento + membros partilhados + sessões usadas sempre editáveis. Cor removida daqui.
- `src/components/BookingDialog.tsx` (ou inline) — picker de cor do cliente + filtro de cliente quando pack partilhado.
- `src/server/schedule.functions.ts` — nova `seedPackBookings`, `listMonthBookings`, aceita `memberIds/payerId` em `upsertPack`, valida member em `createBooking`.
- `src/server/clients.functions.ts` (ou equivalente) — `setClientColor`, auto-assign de cor ao criar cliente.
- `src/lib/schedule.ts` — `packBlockClasses` passa a aceitar cor (string) já resolvida do cliente; helper `pickFreeColor(usedColors)`.
- i18n: `pt/schedule.json`, `en/schedule.json` — strings novas (`view.month`, `view.week`, `revenue.hidden`, `pack.shared.*`, `pack.autoschedule.*`, `delete.confirm.*`, `clipboard.paste_same_time`).

**Migrations (1 só, atómica):**
1. `ALTER TABLE clients ADD COLUMN color text;` + backfill.
2. `CREATE TABLE pack_members (...)` com RLS por trainer, backfill 1 row por pack existente.

Sem alteração a stages/AI/quotas/PDF.

**Estimativa:** ronda grande (~6–8 créditos). Se quiseres, parto em 2 fases:
- **Fase A (rápida):** 1, 3, 6, 7, 9 — pequenas, alto impacto.
- **Fase B:** 2, 4, 5, 8 — exigem migrations e UI nova.

Diz-me **A+B numa só** ou **A primeiro**, e arranco.
