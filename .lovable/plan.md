## Player Card on the clients list

Replace the thin client row on `/dashboard` with a **player card** — one collapsed card per client that shows everything you'd glance at before opening the file. The detail page (`/clients/$id`) stays exactly as the build/edit surface; it doesn't change scope this round.

### What the card shows (collapsed, default)

```text
┌─────────────────────────────────────────────────────────────────────┐
│ [avatar]  Joana Pires                              [phase pill]     │
│           Bloco 2 · Sem. 3 · Hipertrofia                            │
│           Último log: há 2 dias  ·  4/4 sessões  ·  ✓ no prazo      │
│                                                  [Abrir →]          │
└─────────────────────────────────────────────────────────────────────┘
```

Four lines, no flash:
1. **Avatar + name + phase pill** (existing `ClientPhasePill` — onboarding / active / idle / ready-for-next).
2. **Block + week + protocol focus** (`Bloco N · Sem. W · {focus}`) — pulled from the latest non-archived `workout_plans` row (`block_number`, `block_transition_summary`/title for focus, plus week computed from `started_at`).
3. **Last log + adherence** — most recent `workout_logs` row + this-week sessions logged vs scheduled. Amber dot if behind, neutral if on track, muted if no plan yet.
4. **Quiet "Abrir →" link** to `/clients/$id`.

No CTAs, no "generate next block", no inline builder. The card is a status surface.

### States

- **No plan yet** → card shows only avatar + name + "Avaliação por completar" or "Pronto a montar plano" + Abrir.
- **Plan ready, not started** → "Plano pronto · aguarda 1.º log".
- **Active** → block/week/focus + last log.
- **Idle (>10 d no log)** → amber muted strip "Sem treino há 12 dias".
- **Block ended** → golden strip "Bloco terminado · próximo nasce no próximo log" (consistent with the principle that the next block is born when the last session is logged — no button).

### Visual law (kept consistent)

- Card = `rounded-2xl border border-border bg-card p-4` (same as everything else).
- Status dots/chips via `src/lib/status-tone.ts` (success/neutral/warn/danger). No `bg-primary`, no gradients.
- Phase pill stays as-is on the right.
- Hover: `hover:bg-secondary/40`. Whole card is a link; trash button stays as the discreet right-edge action it is today.

### Filter chips

Keep the existing filter row (`all / onboarding / active / idle / ready`) above the cards — no change.

### Files touched

- `src/routes/dashboard.tsx` — swap the row markup (lines ~430–480) for the new `<ClientPlayerCard />`. Pass `phases[c.id]`. Fetch latest plan + last log per client in the existing dashboard loader (one extra `workout_plans` select grouped by client_id, one `workout_logs` select for max(performed_at)). Filter cap stays at the existing list size.
- `src/components/ClientPlayerCard.tsx` — **new**. Pure presentational; takes `{ client, phase, plan, lastLog, weekProgress }`.
- `src/lib/client-card-data.ts` — **new**, small helpers: `computeBlockFocus(plan)`, `computeWeekProgress(plan, logs)`, `formatLastLog(ts, locale)`. All pure, all i18n-aware.
- `src/i18n/locales/{pt,en}/clients.json` — add `card.block_week_focus`, `card.last_log_relative`, `card.no_plan`, `card.plan_ready`, `card.idle_days`, `card.block_ended`. Voice: PT "você", neutral.
- `src/routes/clients_.$clientId.tsx` — **no changes this round.** Detail page is the build surface; standardisation pass already landed last round.

### What I'm explicitly NOT doing

- Not creating a `/clients/$id/build` route. One route, one source of truth.
- Not adding "expanded inline" mode for the card. If you want more, you click in. Cards stay scannable.
- Not adding any new CTAs. The card is read-only on purpose.
- Not touching the 5-stage builder, BriefEditor, or PDF flow.

### Backlog

After this lands I'll log in `.lovable/backlog.md`: (a) revisit the detail page header now that the card carries the at-a-glance load, (b) consider a tiny sparkline of last-4-weeks adherence on the card if it earns its space.