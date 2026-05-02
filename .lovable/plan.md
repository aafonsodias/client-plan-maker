
## Reading of your message

You bundled ~15 items. I'm sequencing them by impact-vs-risk. **Phase A** must ship first — it has a hard error + a logical inconsistency in the pricing that breaks trust. **Phase B and C** are the polish items you described. **Phase D** is the logbook-autofill exploration — flagged as scope, not silently expanded.

No DB migrations except one tiny column for client photo (Phase C). No new dependencies.

---

## Phase A — Stop the bleeding (must ship first)

### A1. Fix `STRIPE_SECRET_KEY is not configured` on `/billing`

The secret IS configured (I checked), but the server function is reading `process.env.STRIPE_SECRET_KEY` at module top-level instead of inside `.handler()`. With our edge runtime, env vars are only injected at call time — so the module evaluates with an empty key and `createStripeClient()` throws.

**Fix in `src/server/billing.functions.ts`:** move every `process.env.STRIPE_SECRET_KEY` read inside the handler bodies (same pattern the docs explicitly call out under "Authoring Server Functions → Failure modes"). Same audit on `process.env.SUPABASE_SERVICE_ROLE_KEY` and any other env reads in that file.

### A2. Honest pricing rebuild — fix the "10 clients / 5 plans" contradiction

You're right: 1 client = at least 1 plan, so "10 clients + 5 plans/month" is nonsense unless we explain that an existing client doesn't need a brand-new plan every month. We have two options. I'll implement **(b)** because it matches the truth of the product (a plan is a 4-week mesocycle that you progress, not a monthly churn item):

**(a)** Per-plan pricing → kills predictable revenue and over-charges PTs with stable clients.
**(b)** **Active-clients pricing** with AI-plan **generations** as a separate, transparent meter.

New tier shape (in `src/routes/billing.tsx` `TIERS`):

```text
                   STARTER         PRO  (popular)     STUDIO
Active clients     up to 8         up to 25           up to 60
Plan generations   8 / month       30 / month         80 / month
Premium escalations 1 incl.        4 incl.            12 incl.
                   (€1.50 extra)   (€1.50 extra)      (€1.50 extra)
Branded PDFs       ✓               ✓                  ✓
Weekly AI digest                   ✓                  ✓
WhatsApp share                     ✓                  ✓
PT seats           1               1                  up to 5
EUR / month        19              45                 119
EUR / year         190 (~16/m)     450 (~37.5/m)      1,190 (~99/m)
```

What "1 generation" means (will appear as a one-line tooltip next to the pricing): "Uma geração = um novo mesociclo de 4 semanas (Brief + Blueprint + Microciclo + Progressões). Editares ou re-gerar progressões para um cliente existente NÃO conta como geração nova."

Why these numbers are honest, not pulled out of thin air:
- A Starter PT with 8 clients running monthly mesocycles needs ~8 generations/month — exact match, no padding.
- Pro at 25 clients × 1.2 generations/month average = 30. The +20% covers re-generations after a check-in pivot.
- Studio gives 5 PTs ~16 gens each, again ~1.2× headroom.
- Premium escalation cost (€1.50) is what Sonnet actually costs us per phased plan plus margin — I'll add a brief one-liner under the top-up: "€1.50 cobre o custo de Sonnet + 30% margem para infra e suporte."

A separate FAQ accordion under the cards will say plainly:
- "Clientes inactivos (sem sessões logged há 60+ dias) não contam para o limite."
- "Se ultrapassares as gerações no mês, podes comprar packs de 10 (€12) ou esperar pelo próximo ciclo — nada é cobrado em surpresa."
- "Guardamos os dados dos teus clientes pelo tempo que a tua conta estiver activa. A pedido, exportamos tudo em JSON e apagamos."

PT/EN copy lives in `landing.pricing` in `pt/plan.json` + `en/plan.json`. The `Subscribers` table already has `subscription_tier`; no schema change needed for Phase A — only the labels and the meter (which we already track in `profiles.plan_quota_used`).

### A3. Landing mockup polish

In `src/routes/index.tsx` the "Maria S. · Semana 5" microcycle:
- **Add a 4th exercise** to Day 2 (e.g. Face Pull) so it doesn't read as a thin program.
- **Add a constraints chip** above the table: "Lombar sensível · sem axial loading · 2×/sem · ginásio comercial". Without it, a PT looking at 3 exercises will judge it as lazy. With it, it reads as deliberate.
- **Drop the personal name** — change "Maria S." to "Cliente · 42a · Mesociclo 5" and the bottom right "Personalizado para a Maria" to "Personalizado a partir do assessment". Generic > fake-specific.
- **More colour without going carnival**: tint Δ chips by trend (emerald/amber/rose, already exist), tint Day 1 / Day 2 strips with the same warmup/activation OKLCH palette used in `SessionDayView` (orange / green / blue at 12% alpha). One mockup, three soft tints.

**Skip the carousel rotation idea** — adds a real perf cost (rrweb + image preload) for a marginal "wow". Confirm if you want it later as Phase E.

---

## Phase B — Assessment & session-view fixes you flagged

### B1. Assessment section spacing + symmetry

In `src/routes/clients_.$clientId.tsx` the collapsed section headers — reduce vertical padding from current `py-4` (or similar) down to `py-2.5`, and set `leading-none` on the title row so the empty space above the letter equals the space below. Apply the same change to all 14 sections so the column reads tight and rhythmic.

### B2. Synthesis dashboard

In the synthesis card:
- **More fused graphs:** add (1) a small ACSM-risk strip with three stops (low / mod / high) and a marker; (2) a recovery donut that fuses sleep + stress + soreness into one 0–100 score with a one-line interpretation; (3) keep the movement radar. Three coordinated panels in a 1-3 grid.
- **Hide "Revisão de segurança" once the plan is finalised.** Already have `plan.status === "finalized"`; gate the button with that and replace it with a "Plano activo desde {date}" pill in dourado.
- **Collapse the whole assessment** when a finalised plan exists for it: render it as a single dourado bar `Avaliação concluída · {date} · 14/14 secções`. A `+` button on the right starts a new assessment (calls existing reset flow) and re-expands.

### B3. Session view — three concrete bugs from your screenshot

In `src/components/SessionDayView.tsx`:
1. **Prep cluster total time is wrong / dynamic block looks empty.** The `estimatePrepMinutes()` walks all three blocks but the `dynamic_stretches` items in the schema sometimes only have `duration` on a couple of items, so the sum looks too low. Two fixes:
   - When an item has no duration, assume **30s** for warmup, **45s per set** for activation, **30s per side** for dynamic — using sensible defaults instead of skipping. Show the total as `~{n} min` next to the chevron.
   - The "Dynamic" inline list is rendering only the names because the items lack a `notes` field; expand it to show `name · sets×reps` pulled from `it.duration` or default `2×8/side`.
2. **Rest "90 sec" overflowing the box.** `StatBlock` is `w-12` fixed. Make it `min-w-[3rem] w-auto px-1.5` so multi-character values like "90 sec" or "2:30" fit. Remove `whitespace: nowrap` clipping.
3. **RPE buried.** Move RPE out of the muted right column and into a coloured pill on the same row as Sets/Reps/Rest, with `bg-accent/15 text-accent` and the prefix `RPE`. When `rpe ≥ 8`, add a soft amber glow (we already have `rpeHigh` flag — wire it to the new pill instead of the muted text).
4. **"Why this exercise" is showing technique cues, not rationale.** In the schema, `technique_cues` and `rationale` are different fields, but `splitCueAndRationale()` is forcibly splitting `technique_cues` into pseudo-cue + pseudo-rationale, which is why "Press through mid-foot. Exhale on press." ends up under "Why".
   - Fix: use `(ex as any).rationale` (or `ex.exercise_rationale`) for the "Why" block. Fall back to `null` (don't show the section) when missing — better empty than misleading.
   - Update the Stage 3 microcycle prompt in `src/server/phased/stage3-microcycle.functions.ts` to explicitly populate `exercise_rationale` per exercise: "1 sentence answering: why THIS exercise for THIS person, given their assessment red flags / equipment / goal".
5. **Supersets default-on.** Add a system-prompt instruction in Stage 3: "Pair accessory exercises into supersets (mark `superset_id`) by default, unless the assessment notes flag balance issues, cardiovascular risk, or fatigue intolerance — in which case keep them straight-set."

---

## Phase C — PDF, edit-table RPE, and client photo

### C1. PDF cover cleanup (`src/lib/pdf.ts` lines ~347–402)

- **Remove the "FORGE" wordmark and the tagline next to the logo.** Keep only the logo image, sized 56×56. The word FORGE inside your logo already reads — printing it twice + a motto is noisy.
- **Replace the title `"{Client Name} — Phased Plan"`** with a programming label that stays useful in a database listing:
  - First plan ever for that client → `"General Conditioning · Mesociclo 1 · {date}"`.
  - Later plans → use the plan's `archetype_label` from Stage 2 (e.g. `"Strength Foundation · Mesociclo 3"`).
  - Internal `plan.code` field (already exists or add it as `${client_id}-M${n}`) shown small and muted under the title for traceability.
- **"PREPARED FOR {client name}"** stays on the right — that's still useful for the printout itself.

### C2. Edit-mode RPE visibility (`src/components/MesocycleTableView.tsx`)

The header pills (`W1 ~504 reps · RPE 5.3`) are hidden under a separate toolbar — you didn't even notice them. Two fixes:
1. Add `RPE` as a dedicated **column-header sub-line** under each `Week N` cell so you see the week's average RPE inside the table grid, not above it: `Week 1 \n RPE 5.3 · ~504 reps`.
2. Make the per-cell `@RPE 7` chip render in `text-accent` weight 600 instead of muted grey when present. Currently it's the same colour as "sec" and reads as filler.
3. **Card view as a sibling option** — add a `Table | Cards` toggle next to the existing `Compact / Detailed`. Cards = collapsible day cards (re-use `SessionDayView`), table = current default. Persist choice in `localStorage` so the PT picks once.

### C3. Volume estimate panel

We already compute reps/RPE per week. Add a **slim sparkline above the table** showing `total reps` and `avg RPE` per week as two overlapping mini-lines (40px tall, full width). Click it to open a modal with the existing `ComplianceDashboard` filtered to the prescribed plan. No new computation — just surfacing what we have. Add a one-liner: "Volume prescrito vs. logged: usa a tab Log para comparar."

### C4. Client photo + avatar in the list

Tiny, contained change:
- Add `photo_url text` column to `public.clients` (migration tool, single ALTER).
- Add an upload widget on `/clients/$clientId` (Supabase storage bucket `client-photos`, RLS: trainer-scoped). Same pattern as we use for branding logo.
- In `src/routes/clients.tsx` list, render a 32×32 round avatar at the start of each row. Fallback: initials on a muted disc when no photo. Show a small amber `!` badge over the avatar when `compliance.has_warning === true` (we already compute this).

---

## Phase D — Logbook autofill exploration (flagged, not silently scoped)

You asked whether I should auto-generate sample logs to drive UI design. Honest answer: **yes for prototyping, no for production**. Plan:

- Build a **dev-only seed script** (`/dev/seed-logbook` route, hidden behind `import.meta.env.DEV`) that takes a finalised plan and fabricates 4 weeks of session logs with realistic noise (RPE drift, missed sessions, occasional PR). Pure fixture, never persisted as "real" client data.
- Use it to design the logbook graphs (top-set progression, volume actual-vs-prescribed, compliance heatmap, e1RM trend by main lift, fatigue index from RPE deltas).
- Once the design is locked, the actual log entry stays manual — the autofill code stays in `/dev` and is not shipped.

I'll **not** start Phase D until A/B/C are done — flagging it so it doesn't get forgotten.

---

## Files touched (per phase)

```text
Phase A
  src/server/billing.functions.ts          (env reads inside .handler())
  src/routes/billing.tsx                   (TIER restructure + FAQ accordion)
  src/i18n/locales/{en,pt}/plan.json       (pricing copy + FAQ)
  src/routes/index.tsx                     (mockup colour + 4th exercise + constraints chip + name)

Phase B
  src/routes/clients_.$clientId.tsx        (section padding, synthesis donut/strip,
                                            safety-review gating, finalised-collapse)
  src/components/SessionDayView.tsx        (prep timer defaults, RPE pill, rest box width,
                                            rationale field switch)
  src/server/phased/stage3-microcycle.functions.ts
                                            (exercise_rationale prompt + superset default)

Phase C
  src/lib/pdf.ts                           (cover: drop wordmark+tagline, programming label)
  src/server/phased/schemas.ts             (add plan.code + archetype_label if not present)
  src/components/MesocycleTableView.tsx    (RPE in header sub-line + cell colour, Table/Cards toggle,
                                            sparkline strip)
  src/routes/clients.tsx                   (avatar + warning badge)
  src/routes/clients_.$clientId.tsx        (photo upload widget)
  Supabase migration                       (clients.photo_url + storage bucket policies)

Phase D (later, behind DEV flag)
  src/routes/dev.seed-logbook.tsx
  src/server/dev/seed.server.ts
```

No new npm packages. Two Supabase changes (Phase C only): one column, one storage bucket + RLS.

---

## What I am NOT doing in this round

- The PDF carousel-rotation idea (would slow the page; happy to revisit).
- Auto-generating real logbook entries for clients (only dev fixtures).
- Re-introducing the "Founder" tier in public copy (stays as your private badge).
- Per-plan pricing (keeping per-active-client + meter is honest and predictable).

Reply **go** to execute Phase A first, then I'll roll into B and C in the same loop if it stays clean.
