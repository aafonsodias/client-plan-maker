## Objectivo
No grelha semanal, cada sessão tem um pequeno botão **Copiar** (ícone Copy). Carregar entra em "modo cola": o cursor muda, o cabeçalho mostra um chip "A copiar sessão de X — clica num slot ou Esc para cancelar". O próximo clique num slot vazio cria uma sessão idêntica nessa data/hora. Em paralelo, qualquer sessão existente pode ser **arrastada verticalmente** para mudar a hora (mesma data, snap a 15 min).

## UX

### 1. Botão Copiar no bloco da sessão (desktop + mobile)
- Pequeno ícone `<Copy className="h-3 w-3" />` no canto superior direito do bloco, opacity 0 → 100 no hover/focus do bloco; em mobile fica sempre visível mas a 60%.
- Click no ícone: `e.stopPropagation()`, entra em modo cola. NÃO abre o editor.
- Estado: `clipboard: { booking: Booking } | null` em `ScheduleWeek`.

### 2. Modo cola
- Quando `clipboard != null`:
  - Mostra um banner fininho por cima da grelha: "A copiar sessão de **{nome}** ({HH:mm}, {duração}′) — clica num slot para colar · `Esc` cancela". Botão "Cancelar" no banner.
  - O cursor sobre slots vazios fica `cursor-copy`.
  - Próximo `onSlotClick(iso)` chama `createBooking` directamente com os campos do clipboard (client_id, pack_id, duration_min, session_type, notes) e o novo `starts_at`. Não abre dialog — feedback é a sessão a aparecer com toast "Sessão copiada".
  - Após colar: limpa o clipboard (uma cola por cópia; mais explícito e evita acidentes). Tecla Esc também limpa.
  - Click numa sessão existente em modo cola = também cancela cola e abre o editor (comportamento normal).

### 3. Arrastar para mudar hora (só desktop, na grelha semanal)
- Pointerdown no bloco (não no botão Copiar) inicia drag vertical:
  - Calcula offset Y inicial; durante o move, transforma `translateY` no bloco (preview optimista).
  - On pointerup: snap ao múltiplo de 15 min mais próximo. Se mudou ≥15 min, chama `updateBooking({ id, starts_at: novoIso })` mantendo a mesma data; refresh.
  - Threshold de 4 px antes de iniciar drag para não competir com o click (que abre o editor).
  - `cursor: ns-resize` durante drag; `cursor-grab` no hover.
- Mobile: NÃO implementar drag (rouba scroll vertical da página). Só copy/paste.

### 4. Estados visuais
- Bloco a ser arrastado: `opacity-80 ring-2 ring-foreground/40`.
- Tooltip pequeno junto ao cursor durante drag: nova hora "10:30 → **10:45**".
- Slots vazios em modo cola: `bg-secondary/60` ao hover (mais óbvio do que o actual).

## Ficheiros tocados (1 só)
- `src/routes/schedule.tsx`
  - `ScheduleWeek`: adicionar `clipboard` state, banner, handler `Escape` (effect), wrapper de `onSlotClick` que intercepta cola → `createBooking`.
  - `RowHour`: adicionar prop `clipboardActive`, `onCopy(b)`, `onDragMove(id, deltaMinutes)`. Renderizar botão Copy. Implementar pointer drag no bloco (handlers locais + state de drag).
  - i18n: `src/i18n/locales/{pt,en}/schedule.json` → `clipboard.copying`, `clipboard.cancel`, `clipboard.toast_pasted`, `action.copy`.

## Fora de âmbito
- Drag horizontal entre dias (pode vir num próximo round se fizer falta — agora seria mais fricção que valor).
- Drag em mobile.
- Resize vertical para mudar duração.
- Multi-paste (uma cópia → várias colas).
- Quotas, server functions novas, RLS.

## Notas técnicas
- Snap: `Math.round(deltaPx / pxPorMinuto / 15) * 15` onde `pxPorMinuto = 56/60` (cada hora = h-14 = 56px).
- `createBooking` já existe e devolve a row criada; reutilizar `refresh()`.
- `Esc` via `useEffect` + `window.addEventListener("keydown")` quando `clipboard != null`.

## Estimativa
~2 créditos.
