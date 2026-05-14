
## Why this plan

The uploaded `PROTOCOL_MVP_DESIGN.md` is mostly compatible with where we already are — ports exist (`src/domain/ports/index.ts`), `audit_events` and `screening_evaluations` are append-only, `Stage 4` is deterministic, the AI is capped to ≤1 microcycle, and `programNextWeek` already gates on adherence. We don't need to rewrite the architecture. We do need to **flip a few defaults** to honour the doc's central restraint principle: *Protocol augments, never automates. Nothing changes without explicit trainer action.*

Right now we violate that principle in one specific spot: `archivePlanAndStartNextBlock` calls `proposeNextBlock` and **auto-stamps** the proposal onto `generation_meta.next_block_proposal`, which Stage 3 then consumes as hard input. There is no `Accept / Modify / Reject / Defer` gate. That's the single biggest behavioural gap and it's the lever with the most leverage — it forces us to grow the surfaces (ProgressMarker, AdaptationDecision, ReportSnapshot, copy) the doc demands.

## Verdict on each section of the doc vs our code

| Doc concept | Current state | Action |
|---|---|---|
| Bounded-context folders (`domain / application / infrastructure / presentation`) | `src/domain/ports/` exists, but `src/server/*` is flat | **Keep current layout.** Add lint rule: only `src/server/<engine>/` may import port adapters. Don't restructure folders — that's a months-long refactor with no user value. |
| Branded ID types (`ClientId`, `CycleId`, etc.) | Raw `string`/`uuid` everywhere | **Defer.** High refactor cost, low MVP value. Revisit post-MVP. |
| `ProgressMarker` with `inputsHash` for reproducibility | We compute metrics inside `propose-next-block.server.ts` but don't persist them and don't hash inputs | **Adopt.** Persist a thin `progress_markers` table; hash = sha256 of input log IDs + engine version. |
| `AdaptationDecision` as **required** discriminated union | Proposal is auto-applied — no trainer gate | **Refactor (top priority).** See Phase R-D below. |
| `ReportSnapshot` with 5 separated buckets (facts / client-reported / trainer decisions / engine evidence / uncertainty), immutable on commit | Planned as Phase 4.1 PDF, not modeled this way | **Adopt the shape now**, before writing the PDF generator. The 5 buckets become the view-model contract. |
| Trainer-editable per-cycle thresholds (mean RPE ≥9 × 3, pain ≥4, missed-session count, ACWR 0.8–1.5 as marker not gate) | Thresholds hardcoded in engine | **Adopt.** Add `cycle_thresholds` jsonb on `workout_plans`. |
| Copy guidelines ("Protocol surfaces evidence. You decide.", "Computed from your logs. Not a recommendation.", forbidden: "we recommend / suggested load / risk score") | Landing copy already non-adversarial, but adaptation surfaces would say "Recomendado" / "Sugerido" if/when they ship | **Lock in copy contract before building the review UI.** |
| `PerformedWorkRow.substituted` (preserves original on swap) | `session_set_logs` has no substitution column | **Add column.** One migration. |
| Pain logged per set + surfaced (not auto-stop) | `pain_flag boolean` exists; no audit event on flag | **Wire trigger:** pain_flag=true → `audit_events.event_type='pain_flagged'` + cycle marker. No engine action. |
| sRPE × duration = session load (Foster) | We track per-set RPE; no session-level sRPE captured | **Add field** on `workout_sessions`: `session_rpe`, `duration_min`. Compute load AU read-only. |
| Rolling 7v28 ACWR as marker only | Not computed | **Compute and show as evidence chip.** Never gate. |
| e1RM trend (Epley default, formula in `inputsHash`) | Already Epley in adaptation engine | ✅ no change |
| FITT-VP scaffolding | `derive.server.ts` already does this | ✅ no change |
| Restraint properties (a–d in §7.10): no recommendation copy / no engine output mutates plan / no client-facing PDF in this slice / no AI calls in engine | (a) ⚠ mixed (b) ❌ violated by auto-apply (c) ✅ no client PDF yet (d) ✅ engine is pure | **(b) is the lever.** |

## What this means for `forge-gap-may-2026.md`

Insert a new phase **R-D ("Restraint")** between current Phase 3.2 and Phase 4. R-D blocks Phase 4. Phases 3.1 (per-set ingest from `/log/$token` writer) and 4.1 (end-of-block PDF) keep their slots but get reshaped by R-D's outputs.

## Phase R-D — Restraint refactor (the actual work, in order)

### R-D.1 — Stop auto-applying the next-block proposal

In `src/server/blocks.functions.ts` (`archivePlanAndStartNextBlock`):
- Continue computing the proposal via `proposeNextBlock`.
- **Stop** writing it into `generation_meta.next_block_proposal` of the new plan.
- **Stop** creating the new plan automatically.
- Instead: persist the proposal into a new `adaptation_proposals` table (status = `pending`) and emit `next_block_proposed` audit event.
- The trainer must visit a new screen, pick a decision, **then** the new plan is generated using the (possibly edited) proposal.

### R-D.2 — `adaptation_decisions` table + required-decision use case

New tables (one migration):

```text
adaptation_proposals
  id uuid pk
  trainer_id uuid
  client_id uuid
  prior_plan_id uuid
  proposal jsonb            -- NextBlockProposal as-is
  evidence jsonb            -- triggers + marker IDs + relatedLogIds
  engine_versions jsonb
  inputs_hash text
  status text check in ('pending','decided','expired')
  created_at timestamptz

adaptation_decisions
  id uuid pk
  proposal_id uuid fk
  kind text check in ('continueAsIs','adjustCurrentSession','adjustUpcoming','defer','accept')
  rationale text not null   -- required
  changes jsonb             -- diff vs proposal when kind = adjust* / accept
  decided_by uuid
  decided_at timestamptz

progress_markers
  id uuid pk
  trainer_id uuid
  client_id uuid
  plan_id uuid
  week_index int
  metric text               -- enum from doc §3
  scope text                -- e.g. muscle group
  value numeric
  inputs_hash text
  engine_version text
  computed_at timestamptz
```

All three: RLS = trainer reads/writes own; clients read their own where applicable. `adaptation_decisions` immutable via trigger (same pattern as `audit_events`).

Server function `decideAdaptation({ proposalId, kind, rationale, changes? })`:
- Validates `kind` + `rationale.length >= 1`.
- Writes the decision row.
- Writes `audit_events` (`event_type='block_decided'`, payload = full decision).
- If `kind ∈ {accept, adjustUpcoming}`: triggers the existing block-N+1 generation pipeline with the (possibly modified) proposal as Stage 3 input. Otherwise no plan is generated.
- Marks proposal `decided`.

Type-level invariant: the use case **rejects** at compile time any call missing `rationale`. (Discriminated union from doc §3 verbatim.)

### R-D.3 — Trainer review screen

New route `src/routes/clients_.$clientId.adaptation.$proposalId.tsx`:
- Banner: *"Protocol surfaces evidence. You decide."*
- Three sections, visually distinct:
  1. **Evidence (read-only, grey panel)** — markers (Δe1RM, RPE drift, adherence%, pain flag count, ACWR 7v28) with inline links to underlying sessions. Each marker chip has *"Computed from your logs. Not a recommendation."*
  2. **Engine proposal (read-only, amber panel)** — the diff per exercise, presented as evidence to react to, never as instruction.
  3. **Your decision (editable, white panel)** — radio: Accept / Adjust / Defer / Continue as-is. Free-text rationale (required). When `Adjust`, an inline editor for the diff.
- No "Accept all" default highlighted. No traffic-light coloring used as a directive.
- Submit calls `decideAdaptation`.

### R-D.4 — Copy contract (locked before UI lands)

Add `mem://principles/restraint-copy.md` listing:
- **Required phrases** (verbatim, in PT-PT and EN): *"O Protocol mostra evidência. Você decide."* / *"Calculado a partir dos logs. Não é uma recomendação."* / *"Cargas e progressões são suas para definir."*
- **Forbidden phrases**: "recomendamos", "carga sugerida", "ideal", "score de risco", "o seu cliente deve", "próxima sessão óptima".
- Apply lint sweep across i18n files; flag forbidden tokens in CI.

### R-D.5 — Mark current landing as needing a copy review

The landing line *"Adaptação semana a semana"* and the "Adaptação por regras, não por palpite" principle are still safe (rules ≠ recommendation), but `value.client.items` includes "Continuidade entre blocos: cada novo programa nasce do anterior." That's true today only because of auto-apply. After R-D.1, edit to *"Continuidade entre blocos: cada novo programa parte do que ficou registado, com a sua aprovação."*

## What stays in Phase 4 but gets reshaped

- **4.1 End-of-block PDF** → becomes `ReportSnapshot` first (typed, immutable on commit, 5 separated buckets including `uncertainty: string[]`), and the PDF is a pure consumer of that snapshot. Never reads engine output directly.
- **4.2 Stripe** — no change. Independent of R-D.

## What we explicitly do **not** adopt from the doc

- Folder restructuring to `domain/application/infrastructure/presentation`. Our flat `src/server/*` already isolates side-effects; the cost-benefit is wrong for now.
- Branded ID types. Defer until first real cross-context bug.
- ESLint import boundaries between `domain/application/infrastructure`. Add only the **port-adapter** rule (no module outside `src/server/<engine>/` may import an adapter file directly), which protects the substitution-by-port property the doc cares about.
- The doc's "no client-facing output in this MVP slice" — we already ship the plan PDF and `/me`. Keep those, but ensure `ReportSnapshot` shape doesn't allow recommendation fields.

## Order of execution after approval

1. R-D.1 + R-D.2 migration (one MR — non-trivial, single concern).
2. R-D.4 copy contract memory file + lint sweep (parallel, low risk).
3. R-D.3 review screen.
4. R-D.5 landing edit.
5. Phase 3.1 per-set writer at `/log/$token` (already on roadmap; unblocked but not blocked).
6. Reshape 4.1 PDF as `ReportSnapshot` consumer.

## Risk

The biggest risk is silent retention loss from making the loop manual. We mitigate by making the trainer-review surface **fast** (one screen, default focus on rationale field, sensible pre-filled diff suggestion that the trainer can accept-as-is in two clicks) — restraint, not friction.

