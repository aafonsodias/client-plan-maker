## Concern
The client list card on `/dashboard` (the white block wrapping the "Aspiringbaconeer" row) still uses `border border-border bg-card`, which reads as a flat white card and breaks the tonal language applied everywhere else (Próxima acção, Hoje, Esta semana, Calendário, Lembretes — all `bg-muted/40`).

## Edits (frontend only — `src/routes/dashboard.tsx`)

1. **Line 529** — list wrapper
   - From: `overflow-hidden rounded-2xl border border-border bg-card`
   - To: `overflow-hidden rounded-2xl bg-muted/40`

2. **Line 501** — empty state ("nenhum cliente neste filtro")
   - From: `rounded-2xl border border-dashed border-border bg-card p-12 text-center`
   - To: `rounded-2xl bg-muted/30 p-12 text-center` (drop dashed border, soften surface)

3. **`src/components/ClientPlayerCard.tsx` (line 101)** — the row divider
   - The row currently uses `border-b border-border` between players. On a `bg-muted/40` surface the hard border looks heavy; switch to `border-b border-border/50` so rows separate via tonal subtlety, matching the rest of the page.

4. **`src/components/ClientPlayerCard.tsx` (line 105)** — hover
   - From: `hover:bg-secondary/40`
   - To: `hover:bg-muted/60` (consistent with CoachCockpit + ClientCockpit hover token)

## Out of scope
- ClientCockpit internals (already done last round)
- Filter pills, header, or any other dashboard region
- Any logic / data shape change

## Acceptance
- The "Aspiringbaconeer" row sits on the same warm tonal surface as the cards above it, not a white card
- No hard border around the list; rows still visually separate
- Hover token matches the rest of the page
