# Status audit — May 2026

Snapshot of the measurement / capacity consolidation. Report only — no code, schema, or UI changes were made.

## 1. Capacity system

| Item | Status | Path / detail |
|---|---|---|
| `src/components/CapacityMap.tsx` | ✅ exists, modified 9 May (today) | mounted **active** at `src/routes/clients_.$clientId.tsx:1707` `<CapacityMap clientId={clientId} clientName={…} />` |
| `src/components/AddSnapshotSheet.tsx` | ✅ exists | opened from inside `CapacityMap` (no separate route mount) |
| `src/server/capacity.functions.ts` | ✅ exists | exports `getClientCapacityMap` (L18), `addCapacitySnapshot` (L77), `listClientCapacitySnapshots` (L139) — all present |
| Table `client_capacity_snapshots` | ✅ exists | **0 rows** |
| Table `capacity_domains` | ✅ exists | **12 rows** |
| `autonomic_regulation` seeded | ✅ yes | `display_order = 12`, tier `integrative` — Round 3 partial migration **landed** |

Domain slugs in `display_order`:

| # | slug | tier |
|---|---|---|
| 1 | cardiorespiratory | health_related |
| 2 | muscular_strength | health_related |
| 3 | muscular_endurance | health_related |
| 4 | flexibility | health_related |
| 5 | body_composition | health_related |
| 6 | power | skill_related |
| 7 | balance | skill_related |
| 8 | coordination | skill_related |
| 9 | agility | skill_related |
| 10 | cognitive_motor | integrative |
| 11 | movement_quality | integrative |
| 12 | autonomic_regulation | integrative |

## 2. Legacy measurement system

| Item | Status | Detail |
|---|---|---|
| `src/components/ReassessmentSheet.tsx` | ✅ file exists | mount at `clients_.$clientId.tsx:3460` is **gated** behind `LEGACY_REASSESSMENT_SHEET` flag (L98) → `import.meta.env.VITE_MEASUREMENT_LEGACY_REASSESSMENT_SHEET === "true"`. Effectively **off by default**. |
| `src/components/RealInsightsCard.tsx` | ✅ file exists | **not imported, not mounted** (comment at L96 of clients route: "RealInsightsCard import removed; component file kept"). Replaced by `CapacityDeltasCard` (L1746). |
| `src/server/measurements.functions.ts` | ✅ exists, marked DEPRECATED | exports `recordMeasurement`, `listMeasurements`, `getMeasurementPrefs`, `updateMeasurementPrefs`. Header explicitly forbids new use. |
| Table `client_measurements` | ✅ exists | **0 rows** |
| Table `client_measurement_prefs` | ✅ exists | **0 rows** |
| `assessments.waist_cm`, `hip_cm`, `body_fat_pct`, `body_fat_method` | ✅ columns exist | Still **read & written** by `clients_.$clientId.tsx` (~17 references L160–L4473). Intake (`intake.$token.tsx`) does **not** touch these directly (no matches). Trainer-only fields. |
| `client_measurements` lingering reads | ⚠ 1 remaining | `src/server/me.functions.ts:530-532` reads weight series from `client_measurements.values.weight_kg` for `/me/progresso`. Only legacy read path that still matters. |

## 3. AI prompt status

- **Stage 1 brief reads `client_capacity_snapshots`** ✅
  ```ts
  // src/server/phased/stage1-brief.functions.ts:85-91
  const { data: snaps } = await supabase
    .from("client_capacity_snapshots")
    .select(
      "domain_slug, measured_at, raw_value, raw_unit, normalized_score, test_used, notes",
    )
    .eq("client_id", clientId)
    .order("measured_at", { ascending: false });
  ```
- **Stage 1 reads `assessments.waist_cm` etc.?** ❌ no direct refs in `stage1-brief.functions.ts`. Anthro now flows through snapshots (verify-consolidation script confirms `getLatestWaistCm` + `getLatestBodyCompositionSnapshots` are present and Stage 2 calls them).
- **`BriefSchema.capacity_profile`** ✅ present at `src/server/phased/schemas.ts:138`.
- **`BriefEditor` capacity card** ✅ rendered: `<CapacityProfileCard brief={brief} />` at `src/components/BriefEditor.tsx:343`. Visible to user.

## 4. Audit history

| File | Status |
|---|---|
| `.lovable/audits/measurements-surfaces-2025.md` | ✅ exists, mtime 9 May 11:09 (today) |
| Newer audits in `.lovable/audits/` | ❌ none — only the surfaces audit + this file |
| `scripts/verify-capacity-i18n.ts` | ✅ exists — **passes** (exit 0, all 119 keys × 4 locales) |
| `scripts/verify-consolidation-phase-a.ts` | ✅ exists — **passes 11/11 checks** (12 domains, autonomic_regulation seeded, anthro snapshots back-filled, stage2 wired to `getLatestWaistCm`, dead measurement fns removed, deprecated header present) |

## 5. Recent rounds (from `.lovable/backlog.md`)

| Round | Date | Topic |
|---|---|---|
| R61 | – | PT-only repositioning, ES/HI scaffold |
| R62–R67 | – | Quick onboarding, pricing toggle, Intensity Cockpit knobs, programNextWeek |
| R68 | 5 May | `/clients/$id` header trim — readiness strip removed (single source of truth) |
| R69 | 5 May | `/me` trainee cockpit (loadMe with weekDays + recentSessions) |
| R70 | 5 May | `/plans/quick` rapid-onboarding pipeline |
| R71 | 5 May | Annual pricing toggle + Studio tier |
| R72 | 9 May | Aesthetic loud-moments pass: NextActionCard, flagged client borders, intake numbered chips, plan fade-in |
| R73 (in flight) | 9 May | NextActionCard priority memo, anthro body-fat moved to "Avançado · requer equipamento" sub-block, CapacityMap desktop layout collapsed to 360px + side panel |

Capacity / measurement / consolidation touches in recent commits/notes:
- R72/R73: CapacityMap desktop layout rework (mtime 12:16 today)
- R73: anthro body-fat sub-block (clients_.$clientId.tsx)
- Pre-R61 “Round 3 / Phase A”: capacity_domains seeding, snapshot back-fill, ReassessmentSheet gated behind env flag, RealInsightsCard unmounted

## 6. Components mounted on `/clients/$id` (render order)

| Line | Component | Status |
|---|---|---|
| 1596/1629 | `IntakeLinkPanel` | current canonical |
| 1707 | `CapacityMap` | current canonical |
| 1717 | `ProtocolRail` | current canonical |
| 1746 | `CapacityDeltasCard` | current canonical |
| 1785 | `AssessmentSection` | current canonical |
| 1830–2582 | `SectionBlock` × 12 (parq, risk, anthro, meds, goal, readiness, training, lifestyle, nutrition, mobility, posture, screen, history, performance) | current canonical |
| 2862+ | Founder telemetry + `StageCard` × N (brief → blueprint → microcycle → progressions → bulkfill) + `PipelineStrip`, editors | current canonical |
| 3292/3297/3302 | trailing `StageCard`s | current canonical |
| 3460 | `ReassessmentSheet` | **legacy/deprecated** (env-flag-gated, off) |
| 3466/3473 | `DeviceCaptureSheet` (Tanita / Jamar) | current canonical |
| 3480 | `BriefMinimumSheet` | current canonical |
| 3642+ | `StatCard` row | current canonical |
| 4086 | `SectionAnalysisCard` | current canonical |

No component on the route is mounted as **unknown** — every reference is either canonical or legacy-flagged.

## 7. Recommendation

**(b) Round 3.1 backend consolidation is effectively done — skip to Round 3.2 (UI cleanup + final legacy purge).** All Phase A acceptance criteria pass: 12 capacity domains seeded incl. `autonomic_regulation`, snapshot table live (0 rows because no live trainer has logged yet), Stage 1/2 read from snapshots, anthro back-fill verified, `measurements.functions.ts` deprecated, `RealInsightsCard` unmounted, `ReassessmentSheet` gated behind a default-off env flag. The only honest follow-ups are: (i) delete `RealInsightsCard.tsx` + `ReassessmentSheet.tsx` files; (ii) move `/me/progresso` weight series off `client_measurements` onto `client_capacity_snapshots` (body_composition, test_used='body_weight'); (iii) drop `client_measurements` / `client_measurement_prefs` tables once that read is gone; (iv) decide whether `assessments.waist_cm/hip_cm/body_fat_pct/body_fat_method` stay as the trainer-input front door (writing through to a snapshot via trigger) or get retired in favour of the snapshot insert path used by `CapacityMap → AddSnapshotSheet`.
