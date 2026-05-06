# R73 — Programmable Knowledge Layer (PKL) + System Governance

Two parallel systems, fully separated surfaces:
- **`/knowledge`** — PKL (controls training logic)
- **`/admin/system`** — system_iterations + admin-only telemetry
- **`/settings`** — stays as-is (lang/theme only; no advanced controls)

This plan ships **Phase 1 + full Governance**. Phases 2–5 sketched at the end.

---

## A. Schema (single migration)

### A.1 `knowledge_profiles`
```sql
create table public.knowledge_profiles (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null,                    -- owner
  name text not null,                          -- "Default", "High Volume"
  description text default '',
  is_system boolean not null default false,    -- baseline, non-editable
  is_default boolean not null default false,   -- one per trainer
  version int not null default 1,              -- bumps on edit (immutable history via knowledge_profile_versions)
  rules jsonb not null default '{}'::jsonb,    -- see A.3
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index on knowledge_profiles(trainer_id) where is_default;
```

### A.2 `knowledge_profile_versions` (immutable history)
```sql
create table public.knowledge_profile_versions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references knowledge_profiles(id) on delete cascade,
  trainer_id uuid not null,
  version int not null,
  rules jsonb not null,
  changed_by uuid,
  change_summary text default '',
  created_at timestamptz not null default now(),
  unique (profile_id, version)
);
```

### A.3 `rules` JSONB shape (Zod-validated, Phase 1 scope)
```ts
KnowledgeRulesV1 = {
  schema_version: 1,
  volume: {
    landmarks: Partial<Record<MuscleGroup, { mev: 0..30, mav: 0..40, mrv: 0..50 }>>,
    // overrides VOLUME_LANDMARKS; missing groups fall back to system default
  },
  intensity: {
    rpe_ceiling_by_tier: { advanced: 7..10, conservative: 7..10, remedial: 6..9 },
    intensity_volume_tradeoff_default: enum,
  },
  recovery: {
    deload_frequency: enum (every_3..every_6 | no_deload),
    deload_style: enum,
  },
  progression: {
    increments_kg_by_category: {
      lower_compound: 1..10, upper_compound: 0.5..5,
      lower_isolation: 0.5..5, upper_isolation: 0.25..2.5,
    },
    autoreg_strictness_default: enum,
    wave_model_default: enum,
  },
}
```

### A.4 Plan stamping
```sql
alter table workout_plans
  add column knowledge_profile_id uuid references knowledge_profiles(id),
  add column knowledge_profile_version int;
```
Stamped at **Stage 1 brief generation**. Reproducibility: regen reads stamped version row from `knowledge_profile_versions`.

### A.5 Governance — `system_iterations`
```sql
create table public.system_iterations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,        -- "R64", "R72.2", "R73"
  title text not null,
  summary text not null,
  affected_modules text[] not null default '{}',
  shipped_at timestamptz not null default now(),
  created_by uuid
);
```

### A.6 Roles
```sql
create type app_role as enum ('admin','coach');
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role app_role not null,
  unique(user_id, role)
);
create function has_role(_user_id uuid, _role app_role) returns boolean
  language sql stable security definer set search_path=public as $$
  select exists(select 1 from user_roles where user_id=_user_id and role=_role)
$$;
-- Seed: insert admin role for aafonsodias@gmail.com
```

### A.7 RLS (essentials)
- `knowledge_profiles`, `knowledge_profile_versions`: trainer owns rows + read-only access to `is_system=true` rows for all authenticated users.
- `system_iterations`: select for `has_role(uid,'admin')`, all writes admin-only.
- `user_roles`: user reads own; only admin inserts/updates.

### A.8 Triggers
- `bump_knowledge_profile_version`: BEFORE UPDATE on `knowledge_profiles` when `rules` changes → write old row to `knowledge_profile_versions`, increment `version`.
- Validator trigger: enforce `mev <= mav <= mrv` and ranges (defence in depth; primary validation = Zod in server fn).

---

## B. Server functions (`src/server/knowledge/`)

- `profiles.functions.ts`
  - `listKnowledgeProfiles()` — owned + system
  - `getKnowledgeProfile({id})`
  - `getActiveKnowledgeProfile()` — trainer's `is_default` (or system fallback)
  - `updateKnowledgeRules({id, rules})` — Zod-validate, server-merge with system defaults, bump version
  - `duplicateProfile({id, name})` (Phase 4 hook, ship the fn now)
- `resolve.server.ts`
  - `resolveRules(trainerId)` → `KnowledgeRulesV1` merged with system baseline (deep-merge, system fills gaps)
- `system-iterations.functions.ts` (admin-gated middleware `requireAdmin`)
  - `listIterations`, `createIteration`, `updateIteration`

`requireAdmin` middleware: extends `requireSupabaseAuth`, calls `has_role(uid,'admin')`, throws 403 on miss.

---

## C. Pipeline integration (Phase 1 minimum)

| Touchpoint | File | Change |
|---|---|---|
| Stage 1 brief | `stage1-brief.functions.ts` | call `resolveRules(trainerId)`, stamp `knowledge_profile_id/version` on plan, pass rules into prompt as **constraints** (RPE ceiling, deload freq) |
| Stage 4 progressions | `stage4-progressions.functions.ts` + `programming-defaults.ts` | `buildWavePlan` reads `rules.progression.increments_kg_by_category`, `wave_model_default`, `deload_frequency` |
| programNextWeek | `program-next-week.functions.ts` | `autoreg_strictness_default` from rules (still overridable by cockpit) |
| Volume diagnostics | `src/lib/volume-landmarks.ts` consumers (`prescribe-volume.ts`, `volume-compute.ts`) | accept optional `overrides` arg; pages pass resolved rules.volume.landmarks |

Cockpit (R64) **still wins** when explicitly set on a plan — PKL provides defaults, cockpit overrides per-plan. Document in `mem://features/pkl.md`.

---

## D. UI

### D.1 `/knowledge` (route `src/routes/_authenticated/knowledge.tsx`)
Single page, 4 cards:

```
┌─ Volume landmarks ────────────────┐  table: muscle | MEV | MAV | MRV (numeric inputs, +/- steppers, status chip)
├─ Intensity ──────────────────────┤  RPE ceiling sliders × 3 tiers; tradeoff Select
├─ Recovery & deload ──────────────┤  deload_frequency Select; deload_style Select
└─ Progression ────────────────────┘  4 increment inputs (kg) + wave_model Select + autoreg Select
```

Components:
- `src/components/knowledge/KnowledgePage.tsx`
- `KnowledgeVolumeCard.tsx`, `KnowledgeIntensityCard.tsx`, `KnowledgeRecoveryCard.tsx`, `KnowledgeProgressionCard.tsx`
- Sticky footer "Save changes" with diff dialog ("3 fields changed → version 4 → 5"). System profile shown read-only with "Duplicate to edit" CTA.
- All copy via `i18n` keys under `common.json:knowledge.*` (PT + EN, ES/HI fallback to EN).

Nav entry: AppShell sidebar → "Conhecimento" (PT) / "Knowledge" (EN). Icon: `BookOpen`.

### D.2 `/admin/system` (route `src/routes/_authenticated/admin.system.tsx`)
- `beforeLoad` calls `requireAdmin` server fn → redirects non-admins to `/`.
- Chronological list (DESC `shipped_at`): code chip, title, summary (markdown-lite), affected modules as chips, timestamp.
- "New iteration" dialog (admin-only) → form → `createIteration`.
- Seed initial rows R64..R72.2 from existing `mem://index.md` knowledge.

### D.3 `/settings` — **no changes** (only language/theme remain)

---

## E. Validation, guardrails, observability (Phase 1 baseline)

- Zod schema in `src/server/knowledge/schema.ts` enforces ranges + `mev<=mav<=mrv`.
- Server fn rejects invalid configs with friendly error keys; UI surfaces inline.
- Every Stage 1 / Stage 4 / programNextWeek run writes `generation_log.input_snapshot.knowledge_profile_version`.
- Phase 5 hook reserved: "impact preview" placeholder card (computes Δ% volume vs system default) — wire interface now, render in P5.

---

## F. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Pipeline regressions | All consumers fall back to system defaults via `resolveRules` deep-merge; smoke test: legacy plan with no PKL stamp must produce byte-identical output. |
| Privilege escalation | Admin gate in **server fn middleware**, never UI-only. RLS on `system_iterations`. |
| Version bloat | Versions only on `rules` change (trigger compares old vs new). |
| Cockpit vs PKL confusion | PKL = defaults, Cockpit = per-plan override. Documented in tooltip + memory rule. |
| Extreme configs breaking generation | Hard ranges in Zod + DB trigger; warn chip in UI when value > P95 of normative. |

---

## G. Phase 2–5 (sketched, ship later)

- **P2 Engine binding**: replace remaining hardcoded constants in `programming-defaults.ts`, `block-adaptation.ts`, `prescribe-volume.ts`. Add `system_default_profile` SQL seed (id `00000000-...-system`, `is_system=true`).
- **P3 AI editing**: `/knowledge` "Descreva a sua filosofia" sheet → Lovable AI (`gemini-2.5-flash`) → returns `Partial<KnowledgeRulesV1>` → diff dialog → apply. Logs to `knowledge_generation_log`.
- **P4 Profiles & sharing**: list view at `/knowledge` shows multiple profiles; per-client `default_knowledge_profile_id` column on `clients`; plan creation reads client → profile.
- **P5 Guardrails & observability**: extreme-config warnings; impact preview Δ%; `plan_decision_trace` (which rule keys influenced which exercises).

---

## H. Files created / touched (Phase 1 + Governance)

**New**
- `supabase/migrations/<ts>_pkl_phase1_and_governance.sql`
- `src/server/knowledge/{schema.ts,resolve.server.ts,profiles.functions.ts,system-iterations.functions.ts}`
- `src/server/auth/require-admin.ts`
- `src/routes/_authenticated/knowledge.tsx`
- `src/routes/_authenticated/admin.system.tsx`
- `src/components/knowledge/{KnowledgePage,KnowledgeVolumeCard,KnowledgeIntensityCard,KnowledgeRecoveryCard,KnowledgeProgressionCard,KnowledgeDiffDialog}.tsx`
- `mem/features/pkl.md`

**Edited**
- `src/server/phased/stage1-brief.functions.ts` (resolve + stamp + inject)
- `src/server/phased/stage4-progressions.functions.ts` + `programming-defaults.ts`
- `src/server/phased/program-next-week.functions.ts`
- `src/lib/volume-landmarks.ts` (export `mergeLandmarks(overrides)`)
- `src/components/AppShell.tsx` (sidebar entry)
- `src/i18n/locales/{pt,en}/common.json`
- `.lovable/backlog.md`, `mem/index.md`

---

**Proceed with Phase 1 + Governance as scoped above? Say "go" to implement, or tell me what to trim/expand.**