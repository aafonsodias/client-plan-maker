# Round 28 — Clean sweep, freeze the engine

Goal: collapse duplicate surfaces, kill dead-end clicks, leave plan generation untouched. One job: make the chrome honest so the next round can focus 100% on plan quality.

---

## Decisions (locked from your answers)

1. **Scope** — Dashboard + Roster merge. One screen. No more "Clientes" tab.
2. **Plan engine** — **Frozen**. Zero edits to `src/server/plans*`, `intake-ai*`, `quota.server.ts`, prompts, or the generation pipeline. Quota fix from last round stays as-is. If a true blocker shows up mid-round I stop and ask — I do not patch silently.
3. **Demo Lab** — **Hidden from UI, kept in code.** Honest answer: the seeded-fake-account loop *was* useful for spotting empty states early, but right now it's a distraction with its own bugs and 3 entry points. We hide the banner + buttons + `?lab=1` toggle from the UI. Code (`createDemoClient`, `DemoLabPanel`, `demo_runs` table) stays so you can resurrect it with one flag flip later. **No data deletion this round** — destructive migrations need a separate, deliberate decision.

> "Why don't I understand /me payments?" — that's a separate conversation. Not in this round. When you want, I'll write a one-page plain-Portuguese explainer of how subscriptions/Stripe flow through the app. Just say the word.

---

## What changes

### 1. Kill `/clients` as a destination

- Delete `src/routes/clients.tsx`.
- Move the **client list, filters, invite dialog** into `/dashboard` as the single source of truth.
- Update all `<Link to="/clients">` in `dashboard.tsx`, `templates.tsx`, `settings.tsx`, `plans.index.tsx` to either point to `/dashboard` or be removed (e.g. nav item).
- Remove "Clientes" entry from `AppShell` nav. Dashboard becomes the home for clients.
- `/clients/$clientId` and `/clients/$clientId/year` **stay** — those are the per-client deep views, still reachable from the dashboard list.

### 2. Redesigned `/dashboard` (single screen, top-to-bottom)

```text
┌─ Header ────────────────────────────────────────────┐
│ DASHBOARD                          [+ Novo cliente] │  ← single primary CTA
└─────────────────────────────────────────────────────┘
┌─ DashboardHint (dismissable how-it-works) ──────────┐
└─────────────────────────────────────────────────────┘
┌─ Quick actions row (only if clients>0) ─────────────┐
│ [Copiar link de avaliação · {Nome}]  [Ver planos]   │
└─────────────────────────────────────────────────────┘
┌─ Atenção (submitted intakes / birthdays / stale) ───┐
└─────────────────────────────────────────────────────┘
┌─ Clientes ──────────────────────────────────────────┐
│ Filter chips: Todos · Onboarding · Ativos · Prontos │
│ ─────────────────────────────────────────────────── │
│ [avatar] Nome · email           [phase pill]    →   │
│ [avatar] Nome · email           [phase pill]    →   │
└─────────────────────────────────────────────────────┘
┌─ Planos recentes (existing block, unchanged) ───────┐
└─────────────────────────────────────────────────────┘
```

- The "+ Novo cliente" button opens the **same invite dialog** that lived in `/clients` (manual name + intake link generator). One CTA, one dialog. No more 3-buttons-same-thing.
- Remove the two `StatCard` tiles (Clientes / Planos count) — redundant once the list is right there. Counts live in the filter chips.
- Empty state: dashed card "Adiciona o teu primeiro cliente" with the invite CTA.

### 3. Hide Demo Lab from the UI

- Remove `DemoClientBanner` mount from dashboard.
- Remove `?lab=1` panel + "+ Cliente demo" button from the merged client list.
- Keep `demo-client.functions.ts`, `DemoLabPanel.tsx`, `demo_runs` table — code stays, no migration.
- Remove `data-tour="demo-banner"` step from the Joyride tour config (tour replay still works, just one fewer step).

### 4. AppShell nav

- Nav becomes: **Dashboard · Planos · Templates · Calendário · Faturação** (5 items instead of 6, no "Clientes").
- Founder badge + brand mark unchanged.

### 5. i18n

- Move `clients.invite_*`, `clients.filter_*`, `clients.no_email`, `clients.delete_*` keys into `dashboard.*` namespace (or alias) since they now live there.
- Drop `dashboard.demo_*` strings used only by the hidden banner.
- PT/EN parity pass on the new dashboard surface.

---

## What does NOT change this round

- Plan generation pipeline, prompts, quota logic, intake AI suggestions.
- Intake form itself (`/intake/$token`) — copy and slides untouched.
- `/me` client portal — read-only as it is today.
- Spider chart, SMART chips, "Ver como cliente" preview — **deferred** to next round (good ideas, just not this round's job).
- Pricing, Stripe, billing UI.
- Database schema. No migrations.

---

## Files touched

- `src/routes/dashboard.tsx` — major rewrite (merge in client list + invite dialog)
- `src/routes/clients.tsx` — **deleted**
- `src/components/AppShell.tsx` — drop "Clientes" nav item
- `src/components/DashboardHint.tsx` — minor copy tweak
- `src/components/TourContext.tsx` (or wherever steps live) — drop demo-banner step
- `src/routes/templates.tsx`, `src/routes/settings.tsx`, `src/routes/plans.index.tsx` — update stale `/clients` links to `/dashboard`
- `src/i18n/locales/{pt,en}/common.json` — move/rename keys, drop demo strings
- `.lovable/backlog.md` — log Round 28 closed items + parked (spider chart, SMART chips, /me preview, Demo Lab resurrection)

No new files. No new dependencies. No SQL.

---

## Risk & smoke checklist

- 375px Mobile Safari: hero CTA doesn't overflow, filter chips wrap cleanly.
- Founder account: no demo button visible anywhere.
- Empty account (0 clients): empty state + invite CTA only, no broken links.
- `/clients/$clientId` deep links still work (route file untouched).
- Tour replay from DashboardHint doesn't crash on the removed demo-banner step.
- One full plan generation (existing client) still succeeds — sanity check that the engine freeze held.

Approve and I'll ship it in one pass.