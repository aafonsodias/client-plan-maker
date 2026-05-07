# Protocol Forge — Strict MVP Lock-In Audit

Read-only diagnostic. No code touched. Budget mentality: 140 credits. Every recommendation below is sized to ship in one tight round and improves the core loop **assess → protocol → execute → adapt → progress** without expanding architecture.

---

## TOP 5 HIGHEST-LEVERAGE MVP IMPROVEMENTS (ranked)

### 1. "Why this week looks like this" — adaptation rationale on Week N+1
**Where:** `src/components/plan/NextWeekCard.tsx` + the W2/W3 header inside `MesocycleTableView`.
**What:** When `programNextWeek` runs, surface the deterministic story it already computes (`adherence`, `flaggedCount`, `strictness`, per-exercise drift) as 1–3 plain sentences at the top of the new week. Examples already in your prompt:
- "Carga reduzida 5% em Bench Press — RPE realizado 0.8 acima do prescrito durante 2 sessões."
- "Adesão 100% · sem alertas. Mantida progressão linear."
- "Sem ajuste automático — coach a decidir (modo sugerido)."

**Impact:** ★★★★★ · **Difficulty:** S (data already exists in `validation_meta` per day) · **Retention:** ★★★★★ · **Trust:** ★★★★★ · **Better-than-Excel:** ★★★★★

**Why psychologically:** This is the single moment the product stops feeling like "AI generated another week" and starts feeling like "the protocol thinks." It's the proof that logbook → adaptation is a closed loop, not two disconnected systems.
**Why operationally:** PT can defend the change to the client in one sentence. That's the WhatsApp message they would have written manually.
**Smallest ship:** Read `validation_meta` from the first day of week N+1, render a `<NextWeekRationale/>` strip inside `NextWeekCard`. ~80 LOC, no schema change, no engine change.

---

### 2. Measurements → trend interpretation strip (honest, hedged)
**Where:** Client cockpit (`src/components/ClientCockpit.tsx`) + clients_.$clientId route.
**What:** Above the existing measurement table, show 3 chips with **interpreted** trend per default metric (weight, waist, sleep/RPE avg if logged): "Peso — tendência de descida (4 sem · confiança moderada)", "Cintura — estável", "RPE médio — a subir, vale monitorizar". No new tables, no new inputs — just a derived view over what's already stored.

**Impact:** ★★★★★ · **Difficulty:** S–M · **Retention:** ★★★★★ · **Trust:** ★★★★ · **Better-than-Excel:** ★★★★★

**Why psychologically:** Excel stores numbers; Protocol *interprets* them. This is the "operational coherence" you described — measurements stop feeling like dead cells.
**Why operationally:** Triggers the reassessment conversation without the PT having to remember to look.
**Smallest ship:** Pure client-side `lib/trend-interpret.ts` (slope + r² → label). Hedged language enforced ("tendência de", "vale monitorizar", "consistente com"). ~120 LOC, zero backend.

---

### 3. Dashboard "today" line — make the cockpit operational, not decorative
**Where:** `src/components/dashboard/CoachCockpit.tsx`.
**What:** Replace the current widget grid with a single ranked list: "3 clientes precisam de atenção hoje" — pulled from existing signals you already compute (low adherence, RPE drift flagged, plan ready to advance, intake submitted, reassessment due). Each row = one click to act.

**Impact:** ★★★★★ · **Difficulty:** S · **Retention:** ★★★★★ · **Trust:** ★★★★ · **Better-than-Excel:** ★★★★★

**Why psychologically:** Right now the dashboard is "look at your stats". After: "here is your morning". That is the WhatsApp/Excel killer for a working PT.
**Why operationally:** One screen that tells them what to do. They open the app and act.
**Smallest ship:** New component reading existing `useClientsBlockEvolution` + `dropoff-alerts` signals, render as a sorted list. No new data sources.

---

### 4. PDF — add the rationale layer that already exists in-app
**Where:** `src/lib/pdf.ts`.
**What:** The PDF currently lists exercises. Add (a) one-line block summary per session ("Sessão 3 · Push · Carga moderada, foco em ROM"), and (b) a footer note per week if `programNextWeek` adjusted anything ("Semana 2 ajustada: −5% em Bench Press por RPE acima do prescrito"). All data already exists.

**Impact:** ★★★★ · **Difficulty:** S · **Retention:** ★★★★ · **Trust:** ★★★★★ · **Better-than-Excel:** ★★★★★

**Why psychologically:** The PDF is the artifact the client sees. Right now it looks like a beautiful spreadsheet. With one rationale line per session it looks like a coached protocol.
**Why operationally:** The PT looks like a professional who plans on purpose, not a generator user.
**Smallest ship:** Two text blocks added to existing PDF template. No new fonts, no new layout.

---

### 5. Landing — reposition from "AI plans" to "Assessment-driven coaching operations"
**Where:** `src/routes/index.tsx` + hero copy.
**What:** New headline: **"Protocolos que se explicam. Adaptação que se justifica."** Subhead: "Avaliação → Protocolo → Execução → Adaptação → Progresso. O sistema operacional do PT sério." Replace the "90s AI plan" hero bullet with a **3-step diagram showing the loop** (assess → protocol → adapt). Keep the rest.

**Impact:** ★★★★ · **Difficulty:** S · **Retention:** ★★★ (acquisition) · **Trust:** ★★★★★ · **Better-than-Excel:** ★★★★★

**Why psychologically:** Stops attracting the "give me a free plan" tourist; starts attracting the PT who wants an OS. Aligns landing with the product reality.
**Why operationally:** Sets the right expectation pre-signup → less churn at first plan.
**Smallest ship:** Copy + 1 SVG diagram in `HeroPlanMockup`. No new sections.

---

## TOP 5 THINGS WE ABSOLUTELY SHOULD NOT BUILD YET

1. **More AI modes / more cockpit knobs.** IntensityCockpit + presets is already over the trainer's ceiling for MVP. Stop adding sliders.
2. **Calendar sync / billing / scheduling depth.** The Schedule v1 ships; do not add recurring rules, ICS, Stripe-per-pack, individual mode. All P2 in backlog — keep them P2.
3. **Conjugate / max-effort day tagging.** Already correctly marked "Em breve" in memory. Resist the temptation.
4. **New rationale chip variants / provenance dot palette.** Round-A/B/C deferred items in the plan — leave them.
5. **A messaging/chat layer.** Tempting because it would "kill WhatsApp" — but the moat right now is the protocol, not the comms surface. One round of messaging eats 3 rounds of credits.

---

## WHAT CURRENTLY FEELS MOST "OLD EXCEL"

- **MesocycleTableView grid** without the actuals overlay (#61 in backlog is the right fix and is P1).
- **Measurements page** — raw numbers, no interpretation (see Improvement #2).
- **Dashboard widgets** — feel like reporting, not operating (Improvement #3).

## WHAT CURRENTLY FEELS MOST "WOW"

- **CapacityGainCard** with Δ% per pattern between blocks. This is the "protocol engine" smoking gun.
- **NextBlockCard** deload/normal/push recommendation with adherence + RPE inputs.
- **Rotation chip + popover** showing first→final rotation %. Honest, defensible, unique.

## WHAT MOST RISKS FEELING LIKE "JUST AI"

- **Stage 3 microcycle output** when a coach opens a fresh plan — it arrives without a single sentence saying *why this split, why this volume, why this exercise selection*. Brief rationale exists in code; surface 1 line per session in the plan view (overlap with Improvement #4 PDF).
- **The "Generate plan" button** without a visible "based on: assessment X, profile Y, equipment Z" provenance line.

## WHAT MOST SUCCESSFULLY FEELS LIKE A TRUE "PROTOCOL ENGINE"

- The deterministic chain: `programNextWeek` → autoreg strictness → `validation_meta`.
- The block-to-block lineage: `block_number`, `prior_plan_id`, prior_exercise_pool feeding rotation.
- Volume diagnostic with MEV/MAV/MRV bands.
- Rationale chips with confidence tone.

These four together *are* the moat. Everything else is wrapper.

---

## THE SINGLE MOST IMPORTANT NEXT ROUND

**Round 66 — "Make the loop visible."**

Ship Improvements **#1 (Next-week rationale)** and **#3 (Dashboard today-line)** together. They are the two surfaces where the closed loop becomes legible to the user in one glance. After this round:
- The dashboard says *what to do today*.
- The plan says *why this week is different from last*.

That is the operational coherence story end-to-end, with zero new architecture.

## THE SMALLEST HIGH-IMPACT MVP SHIP POSSIBLE

If only **one** thing ships next: **Improvement #1 — Next-week rationale strip.** It uses 100% existing data, costs ~80 LOC, requires no schema/engine change, and is the single moment that converts the user's mental model from "AI generator" to "protocol engine." Everything else can wait one round.

---

## Guardrails for the next round (non-negotiable)

- No engine changes. No schema changes. No new server functions.
- No new routes. No new settings page. No new admin surface.
- All copy through `t()` under existing namespaces.
- 375px Mobile Safari smoke before merge.
- One concern per PR. Backups before any (unlikely) SQL.

---

**Awaiting your call:** ship Improvement #1 alone (smallest), the recommended #1+#3 pair (Round 66), or a different combination from the top 5.
