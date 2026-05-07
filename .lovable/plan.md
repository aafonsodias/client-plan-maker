
## Diagnóstico do crash que ainda aparece

O stack trace dos console logs aponta literalmente para `Landing` em `src/routes/index.tsx:52` — não para Schedule. O componente faz:

```
useAuth · useTranslation · useCurrency · ...  ← 15 hooks
if (authLoading) return <Splash/>
const [billing, setBilling] = useState("annual")  ← 16º hook
```

Quando `authLoading` passa de `true` → `false` (hidratação do Supabase em hard refresh), o React vê 15 hooks no render anterior e 16 no seguinte → "Rendered more hooks than during the previous render". O `<CatchBoundary>` do TanStack Router engole o erro e mostra o fallback genérico, que o utilizador interpreta como "schedule still crashes" porque acontece em hard-refresh de qualquer rota (`/` é montado pelo router antes de redirecionar).

Os hotfixes anteriores ao `ScheduleShell` estavam corretos mas não tocavam neste ficheiro. O `ScheduleShell` em si já está estável (single-tree).

## P0 — Fix landing hook crash (CAUSA REAL)

**Ficheiro:** `src/routes/index.tsx`

Mover **TODOS** os hooks (`useState`, `useMemo`, etc.) para antes de qualquer early return. O splash de `authLoading` passa a ser apenas o JSX condicional no return.

```tsx
function Landing() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { t } = useTranslation([...]);
  const { code: currencyCode } = useCurrency();
  const [billing, setBilling] = useState<Billing>("annual");  // ← subir
  const signedIn = !!user;
  // ... derivados
  if (authLoading) return <Splash/>;
  return (...);
}
```

Validar também que `useHeroRotation` e outros sub-componentes não têm o mesmo padrão.

## P1 — Out-of-hours bookings visíveis

**Ficheiro:** `src/routes/schedule.tsx` (`ScheduleWeek`)

Já existe lógica parcial (R68.2). Confirmar que:
- bookings com `hour < 6 || hour >= 22` são listados num bloco "Sessões fora do horário visível" / "Sessions outside visible hours"
- cada linha clicável abre `BookingDialog` em modo edição
- chave i18n: `schedule.out_of_hours.heading`

## P2 — Frequency guard usa semana do candidato

**Ficheiro:** `src/routes/schedule.tsx` (`BookingDialog`)

Já implementado em R68.2 via fetch direto Supabase pela ISO week do `starts_at` candidato. Auditar e garantir:
- exclui o próprio booking quando edita (`neq("id", editingId)`)
- exclui `status = cancelled`
- string i18n já correta

## P3 — Save/refetch reliability

**Ficheiros:** `src/routes/schedule.tsx`, `src/routes/schedule.packs.tsx`

- `bookingTick` já propaga para `ScheduleWeek` e `PacksPanel` (R68.2). Confirmar que `RevenuePanel` também recebe / refetcha após mutação.
- `onSavedJumpToWeek` já existe — verificar que limpa search params (`newBooking/clientId/packId`) com `replace: true` para evitar re-abrir o dialog em StrictMode.

## P4 — Pack accounting honesto

**Ficheiros:** `src/routes/schedule.packs.tsx`, `src/i18n/locales/{pt,en}/schedule.json`

Derivado client-side (sem schema, sem novo server fn):

```
usedBeforeProtocol  = client_packs.sessions_used
completedInProtocol = bookings.filter(pack_id == p.id && status != 'cancelled' && (starts_at + duration) < now).length
upcomingScheduled   = bookings.filter(pack_id == p.id && status != 'cancelled' && starts_at >= now).length
effectiveUsed       = usedBeforeProtocol + completedInProtocol
remaining           = max(0, pack_size - effectiveUsed)
```

Card compacto mostra `remaining/total` + chip "X agendadas". Detalhe completo (4 linhas) dentro do `PackFormDialog` (modo manage).

`sessions_used` já está exposto no `PackFormDialog` e já passa pelo `upsertPack` (R68.2) — apenas adicionar validação `0 <= sessions_used <= pack_size`.

Estender query existente em `PacksPanel` (`select("pack_id, status, starts_at, duration_min")`) — já é uma read scoped, sem nova função.

## P5 — Mobile polish

**Ficheiro:** `src/routes/schedule.tsx` (DayStrip + header)

- Weekday pills: stack vertical (`flex-col`), label abreviada PT `SEG/TER/QUA/QUI/SEX/SÁB/DOM` (já existem), data em baixo, `min-w-[2.75rem]`, `px-1.5 py-1`, `text-[10px]` label.
- Header: `flex items-center justify-between` numa só linha — título à esquerda, `Tabs` à direita. Em ≤375px envolve graciosamente.

## P6 — Long-horizon insight

**Deferido.** Só ship se P0–P5 limparem em <2h. Caso contrário, fica para R69.

## P7 — Landing assessment-first

**Proposal-only nesta ronda.** Resultado fica documentado em `mem/features/landing-assessment-first.md` (rascunho de copy + secções) sem tocar em `src/routes/index.tsx` além do P0.

## i18n

PT/EN obrigatórios. ES/HI espelham EN.

Novas keys em `schedule.json`:
- `out_of_hours.heading`
- `pack.used_before_protocol`
- `pack.completed_in_protocol`
- `pack.upcoming_scheduled`
- `pack.remaining_label`
- `pack.sessions_used_invalid`

## Scope guard — confirmação

- ❌ schema changes
- ❌ migrations
- ❌ novas server functions
- ❌ novas rotas
- ❌ novas dependências
- ❌ recurrence / payments / direct debit
- ❌ engine / generation / PKL
- ✅ apenas bugfixes, derivados client-side, copy, i18n

## Verificação

- Hard-refresh `/`, `/schedule`, `/schedule?tab=packs`, `/schedule?tab=week&newBooking=1&clientId=...&packId=...` × 5
- Tab switch repetido
- Booking 02:00 visível e editável
- Frequency guard semana futura
- Pack 10 total, 4 used → mostra 6 remaining
- 375px / 390px sem overflow
- `tsc --noEmit` clean

## Final report incluirá

- Causa exata: early return antes de `useState` em `Landing`
- Porque os fixes anteriores falharam: olhámos só para `ScheduleShell`
- Ficheiros tocados
- Scope confirmado intacto
