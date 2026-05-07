# R68.1 — Schedule/Packs Hotfix + Mobile Stabilization

UI-only round. No schema, no server functions, no recurrence/payments, no new routes, no new deps.

---

## Pre-implementation report (as required by your prompt)

1. **Hook crash cause** — `src/routes/schedule.tsx` `ScheduleShell` (lines 55–62) calls `useLocation()` then **early-returns `<Outlet/>` before** calling `Route.useSearch()` + `useNavigate()`. When the user lands on `/schedule/packs` (child route) the hook count is 1; on `/schedule` it's 3 → React throws "Rendered more hooks than during the previous render" the moment you navigate between them. Note: `/schedule/packs` is a redirect to `/schedule?tab=packs`, so this also triggers during the redirect frame.
2. **Booking save refetch** — Week tab's own `refresh()` + `refreshPacks()` runs on save (good). But `PacksPanel` has its own independent `scheduledByPack` query (lines 70–93 of `schedule.packs.tsx`) that nothing invalidates → returning to Pacotes shows stale "X marcadas". Also the search-param prefill `useEffect` only `replace:true`-clears params *after* opening the dialog; if a render re-fires with the same params (Strict Mode, back-navigation) the dialog re-opens with stale `creating` state.
3. **Price per session** — already a labelled `Input` in `PackFormDialog` (`t("pack.price")` = "Preço por sessão (€)"). Real issue: default value `30` is silently applied. Fix = make the default visible by emptying the field and forcing user input or adding an honest helper caption + a pack-card price chip in revenue panel scope.
4. **Selected-day detail panel** — already exists in `DayStrip` (lines 511–546 of schedule.tsx — list of bookings for the selected day appears below the day pills). It is cheap and already shipped. Just polish the day pills + booking line copy.
5. **Deferred** — Exercise Intelligence Layer, Exercise Media/Video Layer, Schedule & Revenue Future expansions. Client Education Layer note already exists from R68.

---

## Changes (max 6, all UI/i18n)

### 1. P0 — Fix hook crash (`src/routes/schedule.tsx`)

Move all hook calls in `ScheduleShell` to the top, gate render with a variable:

```text
function ScheduleShell() {
  const location = useLocation();
  const search = Route.useSearch();
  const navigate = useNavigate();
  if (location.pathname.startsWith("/schedule/")) return <Outlet />;
  const tab = ...
}
```

### 2. P1 — Cross-tab booking invalidation + safer prefill

- Lift the `bookings` + `packs` + `scheduledByPack` source of truth into a small hook `useScheduleData(monday)` at `ScheduleShell` level OR (smaller change) introduce a shared "scheduleVersion" counter via a tiny `useState` on `ScheduleShell`, passed to both `ScheduleWeek` and `PacksPanel` props; on every `onSaved`, bump the counter and have both panels include it in their `useEffect` dep arrays.
- Smaller-still alternative chosen: bump a `bookingTick` integer in `ScheduleShell` state, pass `bookingTick` + `onBookingsMutated` callback into both `<ScheduleWeek>` and `<PacksPanel>`; `PacksPanel`'s `scheduledByPack` `useEffect` adds `bookingTick` to deps; `ScheduleWeek`'s `refresh()` is unchanged but it also calls `onBookingsMutated()` so PacksPanel re-reads next time it's mounted/visible.
- In `ScheduleWeek` prefill `useEffect` (lines 159–169): clear search params **immediately** before setting `creating` state, and gate on `search.newBooking === 1 && !creating` to avoid re-triggering. Also clear params on dialog cancel/close (`onOpenChange={(v) => !v && (setCreating(null), navigate({ to: "/schedule", search: { tab: "week" }, replace: true }))}`).
- `BookingDialog.save()`: close dialog **before** awaiting `onSaved()` — `onOpenChange(false)` first, then `await onSaved()` — so the dialog UI never lingers in a stale state if refetch is slow.

### 3. P2 — Price clarity (`src/routes/schedule.packs.tsx` + i18n)

- `PackFormDialog`: change initial state for new packs from `30` to `""` (number-or-empty); add helper text under the price input: PT "Quanto cobra a este cliente por sessão?" / EN "How much do you charge this client per session?". Block save with toast `t("pack.price_required")` if price is empty/0.
- Pack card: keep `30€/sessão`, but if a pack somehow has price 0, show `t("pack.price_unset")` ("Preço por definir") instead of "0€/sessão" and exclude it from `expectedIncome` (already excluded since `Number(price)` is 0 — but make it visible).
- `RevenuePanel`: when `expectedIncomeEur === 0 && sessionsThisWeek > 0`, replace the price line with `t("panel.expected_income_unavailable")` ("Receita esperada indisponível — falta preço por sessão"). No schema change.

### 4. P3 — Mobile header/hero alignment (`CoachCockpit.tsx`)

- Hero strip (lines 294–333): collapse the right-side group into a vertical stack on `<sm`. Use `w-full sm:w-auto` and `flex-col sm:flex-row` on the right-side container so price + CTA buttons stack cleanly under the title at 390px instead of wrapping into a detached row.
- MiniWeek button (line 337): keep `→` always visible on mobile (`opacity-100 sm:opacity-0 sm:group-hover:opacity-100`). Title and arrow stay in same `justify-between` flex row — verify no overflow.

### 5. P4 — Day pills + booking line readability (`schedule.tsx` DayStrip + `CoachCockpit.tsx` MiniWeek)

- `DayStrip` day pills already vertical — good. Increase tap target: `min-h-12 py-2`. Use lowercase-then-uppercase abbreviated PT label (already `Intl.DateTimeFormat short`), force two-digit date, add today underline contrast.
- Selected-day list (already exists): change second line copy to `{name} · {HH:mm} · {Presencial|Online}` so user knows session type at a glance. Add small header above the list: `t("day.list_header", { count })` → "1 sessão marcada" / "2 sessões marcadas".
- `MiniWeek` (CoachCockpit lines 429–447): force `flex-col items-start` per cell so day label and date stack on separate lines (fixes "SEG4" cramming at 390px). Replace per-booking initials badge ("ET 1") with a single colored dot per booking, capped at 3 dots + "+N" — the user is already going to /schedule for detail.

### 6. P6 — Future notes

Append three new files (read-only documentation):

- `mem/features/exercise-intelligence-layer.md` — structured exercise DB, primary/secondary muscles, McGill overlay, MEV/MAV/MRV mapping. Future-only.
- `mem/features/exercise-media-layer.md` — videos, technique clips, AI-assisted media. Future-only.
- Update `mem/features/schedule-revenue-future.md` (already exists) — append monthly/yearly view, recurring slots, holidays, direct debit, trial sessions, revenue projection.

(Client Education Layer file already exists from R68; no change.)

---

## i18n keys to add

`schedule.json` (PT + EN; mirror to ES + HI):

- `pack.price_required` — "Define o preço por sessão." / "Set the price per session."
- `pack.price_required_hint` — "Quanto cobra a este cliente por sessão?" / "How much do you charge this client per session?"
- `pack.price_unset` — "Preço por definir" / "Price not set"
- `panel.expected_income_unavailable` — "Receita esperada indisponível — falta preço por sessão" / "Expected revenue unavailable — price per session missing"
- `day.list_header_one` / `day.list_header_other` — "{{count}} sessão marcada" · "{{count}} sessões marcadas" / "{{count}} session scheduled" · "{{count}} sessions scheduled"

---

## Files touched

- `src/routes/schedule.tsx` (P0, P1, P4)
- `src/routes/schedule.packs.tsx` (P1, P2)
- `src/components/schedule/RevenuePanel.tsx` (P2)
- `src/components/dashboard/CoachCockpit.tsx` (P3, P4)
- `src/i18n/locales/{pt,en,es,hi}/schedule.json` (i18n)
- `mem/features/exercise-intelligence-layer.md` (new, future note)
- `mem/features/exercise-media-layer.md` (new, future note)
- `mem/features/schedule-revenue-future.md` (append)

---

## Acceptance smoke

1. Hard refresh `/schedule`, `/schedule?tab=packs`, `/schedule?tab=week&newBooking=1&clientId=X&packId=Y` — no hook warning, no crash.
2. Pack → "Marcar sessão" → save → Week shows booking immediately, revenue + count update, return to Pacotes shows scheduledThisWeek+1 (no refresh).
3. New pack form requires price; pack card with no price shows "Preço por definir"; revenue panel shows "Receita esperada indisponível" when applicable.
4. 390px hero stacks cleanly; arrow visible inside MiniWeek header.
5. 375px day pills readable (label/date stacked); selected-day list shows "Elsa Tavares · 08:00 · Presencial".
6. `tsc --noEmit` clean.

## Strict non-goals (confirmed)

No new schema, no new server functions, no recurrence, no payments, no new routes, no engine/generation/PKL changes, no new dependencies, no Atlas redesign, no exercise library, no videos, no education ebook.  
  
Do not make the new pack form frustrating.

If price is required:

- keep validation clear and lightweight

- autofocus the field on empty submit

- avoid aggressive blocking UX

- prefer inline helper + toast over modal/error wall  
  
For bookingTick:

prefer the smallest local state possible.

Do not turn it into a reusable abstraction or scheduling state system.  
  
For the selected-day detail list:

keep it visually lightweight.

It should feel like a contextual detail strip,

not a second full schedule section.