# Exercise Taxonomy Migration Approval Packet v1

Date: 2026-05-26

Scope: documentation only. This packet prepares review for a future core v1 exercise taxonomy migration. It does not create a migration, change application code, update generated Supabase types, apply schema changes, import private files, or change runtime behavior.

## 1. Executive Summary

This approval packet exists because the next step, creating real SQL under `supabase/migrations/`, would encode product policy into the database. The prior docs and SQL draft are strong enough to review, but a real migration should not be created until Andre explicitly accepts or changes the remaining v1 defaults.

Ready:

- Core table boundaries are defined: taxonomy versions, import batches, exercise templates, aliases, and muscle maps.
- Existing code provides an exact v1 muscle-key set.
- Existing migrations show usable patterns for `public.has_role`, admin policies, trainer ownership, authenticated system-data reads, and append-only audit/decision tables.
- The SQL draft is reviewable outside `supabase/migrations/`.

Still risky:

- RLS has not been access-tested for taxonomy tables.
- Published taxonomy immutability is a product and database enforcement decision, not just a status label.
- Alias collisions can silently map exercises incorrectly if over-automated.
- Strict hypertrophy set weights are v1 product heuristics, not final scientific truth.
- Import governance must prevent private source names, client names, or workbook data from becoming committed artifacts or public metadata.

Andre must approve the short checklist in Section 11 before the real migration is created. This packet proposes defaults to reduce decision load; it does not lock decisions on Andre's behalf.

Must stay deferred from the first real migration unless explicitly approved:

- Substitution edges.
- Exercise media.
- Movement, equipment, and constraint tag tables.
- Runtime reads or writes.
- Generated Supabase type updates.
- Seed data from private spreadsheets.
- Any destructive migration or legacy JSON rewrite.

This is a v1 product policy proposal for deterministic prescription. It is not a migration and not final scientific truth. The taxonomy must also preserve existing safety logic: health assessment, PAR-Q, ACSM-style screening, risk bands, pain/injury handling, and trainer approval gates remain authoritative and must not be weakened by taxonomy work.

## 2. Current Readiness Summary

| Area | Current evidence | Ready for migration? | Risk | Decision needed |
| --- | --- | --- | --- | --- |
| Taxonomy versions | Schema draft and SQL draft define `exercise_taxonomy_versions`; existing PKL docs show versioning precedent. | Proposed default awaiting approval | Published immutability can be overclaimed if only status fields exist. | Approve draft/active/retired/superseded lifecycle and one active global version for v1. |
| Import batches | SQL draft uses sanitized source labels; prior docs require staging, validation, approval, publish. | Proposed default awaiting approval | Import metadata can leak private filenames if not constrained by process. | Approve sanitized labels only and admin-only import batch access for v1. |
| Exercise templates | Existing `src/lib/exercise-taxonomy.ts` has stable keys and display names; SQL draft separates `exercise_key` from display. | Proposed default awaiting approval | Trainer-local/global scope bugs can corrupt deterministic joins. | Approve global approved templates plus trainer-local drafts. |
| Aliases | Existing taxonomy has PT/EN aliases; SQL draft uses locale-scoped `normalized_alias`. | Proposed default awaiting approval | Ambiguous aliases can resolve to the wrong exercise. | Approve collision-to-review policy and safe uniqueness only for approved scoped aliases. |
| Muscle maps | `MuscleGroup`, `VOLUME_LANDMARKS`, and exercise seed use primary/secondary muscles; SQL draft stores role and strict weight. | Proposed default awaiting approval | Wrong maps or weights directly affect volume/progression. | Approve v1 muscle keys and strict hypertrophy role weights. |
| RLS model | Existing migrations use `public.has_role`, `auth.uid() = trainer_id`, authenticated system reads, and service-write audit logs. | Recommended, not proven | No taxonomy RLS tests exist yet. | Approve conservative authenticated read/admin write/trainer-local owner model, then test later. |
| Trainer-local drafts | Decision register recommends local drafts; SQL draft includes `owner_scope` and `trainer_id`. | Proposed default awaiting approval | Local drafts could leak or be mistaken for global canon. | Approve local-only visibility and admin promotion requirement. |
| Unknown exercises | Existing docs recommend preserving unknowns and excluding from strict volume. | Proposed default awaiting approval | Too strict blocks trainer workflow; too loose corrupts volume math. | Approve preserve/warn/exclude-from-strict-volume policy. |
| Effective set weights | Existing volume code and prompt rule use primary `1.0`, secondary `0.5`; decision register adds stabilizer `0.0`. | Proposed default awaiting approval | Heuristics can look more precise than they are. | Approve strict hypertrophy weights as versioned v1 heuristics. |
| Published version immutability | Existing audit/adaptation tables show immutable trigger patterns. SQL draft does not fully enforce taxonomy immutability. | Not fully ready until policy approved | A first migration without triggers cannot claim DB-enforced immutability. | Approve whether first migration includes immutability triggers or only app policy. |
| Rollback | SQL draft contains drop order and notes that no runtime depends on new tables yet. | Proposed default awaiting approval | Rollback is only safe before runtime integration. | Approve non-destructive core-only migration and staging verification. |
| Staging plan | Prior docs require staging before production. | Proposed default awaiting approval | Production application without staging RLS checks is unsafe. | Approve staging-first apply, inspect policies/indexes, then production. |

## 3. Exact v1 Muscle Key Proposal

The exact v1 muscle keys are safely derivable from current code. `src/lib/volume-landmarks.ts` defines `MuscleGroup`, `VOLUME_LANDMARKS`, `MUSCLE_GROUP_LABELS_PT`, aliases, and `MUSCLE_GROUP_ORDER`. `src/lib/exercise-taxonomy.ts`, `src/lib/volume-compute.ts`, `src/lib/prescribe-volume.ts`, `src/lib/volume-actual.ts`, and related analytics import that type/order.

These are v1 taxonomy keys, not final anatomy.

| muscle_key | Display label | Current code evidence | Intended meaning | Type | Include in first migration? | Confidence |
| --- | --- | --- | --- | --- | --- | --- |
| `chest` | Chest | `MuscleGroup`, `VOLUME_LANDMARKS`, labels, aliases, exercise primary/secondary arrays | Anterior chest/pectoral training bucket | Muscle-group/region bucket | Yes | High |
| `shoulders` | Shoulders | `MuscleGroup`, `MUSCLE_GROUP_ORDER`, labels, aliases including delts, exercise maps | Deltoid/shoulder training bucket | Muscle-group/functional bucket | Yes | High |
| `triceps` | Triceps | `MuscleGroup`, labels, aliases, push exercise secondary maps | Elbow extensor/triceps training bucket | Muscle group | Yes | High |
| `biceps` | Biceps | `MuscleGroup`, labels, aliases including brachialis, pull exercise secondary maps | Elbow flexor/biceps-side training bucket | Muscle-group/functional bucket | Yes | High |
| `back` | Back | `MuscleGroup`, landmarks, aliases including lats/traps/rhomboids/erectors, row/pull maps | Posterior torso pulling/back training bucket | Broad functional/anatomical bucket | Yes | High |
| `core` | Core | `MuscleGroup`, landmarks, aliases for abs/obliques/transverse, core exercise maps | Trunk stabilization/flexion/anti-motion bucket | Functional bucket | Yes | High |
| `glutes` | Glutes | `MuscleGroup`, landmarks, aliases, squat/hinge/bridge maps | Gluteal training bucket | Muscle group | Yes | High |
| `hamstrings` | Hamstrings | `MuscleGroup`, landmarks, aliases, hinge/curl maps | Posterior thigh/knee flexor hip extensor bucket | Muscle group | Yes | High |
| `quads` | Quads | `MuscleGroup`, landmarks, aliases, squat/lunge/wall-sit maps | Anterior thigh/knee extensor bucket | Muscle group | Yes | High |
| `calves` | Calves | `MuscleGroup`, landmarks, aliases including gastrocnemius/soleus, calf raise maps | Lower-leg plantarflexor bucket | Muscle group | Yes | High |

Recommended SQL implication: enforce the exact v1 key set only after Andre approval. The real migration can use either a check constraint, lookup table, or seedable reference table; a lookup/reference table is more future-proof if subregions are expected soon.

## 4. Effective Set Weighting Policy

Proposed v1 strict hypertrophy volume policy:

| Role | Strict hypertrophy volume weight |
| --- | ---: |
| `prime_mover` | `1.0` |
| `synergist` | `0.5` |
| `stabilizer` | `0.0` |
| `antagonist` | Tracked metadata, not counted in strict hypertrophy volume |

This matches the current code direction where primary muscles count as `1.0` set and secondary muscles count as `0.5` set. The schema draft uses `strict_hypertrophy_effective_set_weight` so this field is explicitly scoped to hypertrophy hard-set accounting.

Important interpretation:

- `stabilizer = 0.0` means "not counted as a hypertrophy hard set" in strict volume totals.
- It does not mean stabilizers are unimportant.
- Stabilizer involvement can matter later for exposure, fatigue, readiness, pain, and substitution rules.
- Exposure/fatigue scoring must be a separate later policy or field family, not a reinterpretation of strict hypertrophy volume.
- These weights are v1 heuristics, not biological constants.
- The SQL draft supports future changes by storing numeric weights per map row and tying maps to taxonomy versions.

Approval needed: Andre should accept these as v1 product heuristics or provide replacement weights before a real migration bakes them into seed data, tests, or engine behavior.

## 5. RLS Approval Packet

Existing patterns inspected:

- `public.app_role` includes `admin` and `coach`.
- `public.user_roles` exists.
- `public.has_role(_user_id uuid, _role public.app_role)` exists and is used for admin policies.
- Trainer-owned tables commonly use `auth.uid() = trainer_id`.
- System/global knowledge profiles are readable to authenticated users.
- Audit/decision tables use append-only patterns and restricted writes.

RLS recommendation for v1:

| Surface | Proposed default | Risk | Alternative | Include in real migration now? | Tests needed later |
| --- | --- | --- | --- | --- | --- |
| Global approved taxonomy read | Authenticated users can read approved/active global taxonomy rows. | Any logged-in user can inspect taxonomy curation. | Server-only read; anon read. | Yes, if Andre accepts authenticated exposure. | Auth user can read active; anon cannot; draft/rejected not visible. |
| Trainer-local draft visibility | Only owning trainer and admin can read trainer-local drafts. | Scope bug leaks one trainer's local exercises to another. | No trainer-local drafts in first migration. | Yes, if trainer-local drafts are in core. | Owner can read/write; other trainer cannot; admin can review. |
| Import batch visibility | Admin-only read/write for v1. | Coaches cannot self-serve imports. | Add staff/reviewer role later. | Yes. | Admin can manage; coach cannot; anon cannot. |
| Admin/staff approval | Use existing `admin`; do not invent `staff` role in first migration. | Admin role may be too broad operationally. | Add `taxonomy_admin` or `reviewer` later. | Yes, admin only. | Admin policies match `has_role`; non-admin denied. |
| Write permissions | No unauthenticated writes. Global writes admin-only. Trainer-local writes owner-only. | Incorrect `with check` can allow scope escalation. | Server-only writes for all taxonomy rows. | Yes, after review. | Insert/update checks prevent changing `trainer_id`, `owner_scope`, status escalation. |
| Anon access | No anon taxonomy reads or writes in v1. | Public intake cannot directly read taxonomy if needed later. | Server function for public display; anon read approved global taxonomy. | Yes, deny anon by omission. | Anon cannot read/write any taxonomy tables. |

Do not claim RLS is safe until access tests exist. The first real migration may include policies, but the follow-up must add RLS tests or a staging verification script before runtime integration.

## 6. Alias Collision Policy

Proposed v1 policy:

- `normalized_alias` is produced by deterministic normalization: lowercase, trim, strip accents/diacritics, collapse whitespace, and remove harmless punctuation where safe.
- Locale is required on aliases, with `und` only for unknown/unspecified language.
- Approved global aliases should be unique per taxonomy version, locale, and normalized alias.
- Trainer-local aliases should be unique per trainer, locale, and normalized alias.
- Unknown exercise aliases should not become approved aliases automatically.
- Duplicate or ambiguous aliases found during import create review items.
- Exact uniqueness should be enforced only where scope is clear: approved global aliases within a version/locale and trainer-local aliases within a trainer/locale.
- Ambiguous imported aliases should remain staged with candidate matches and confidence metadata; they should not be guessed into production.

Default: avoid overconstraining ambiguous aliases at the raw import stage. Constrain only approved scoped aliases.

## 7. Trainer-Local Exercise Policy

Proposed v1 policy:

- Trainer-created exercises start as trainer-local drafts.
- Local drafts are visible only to the creator/trainer scope and admin review paths.
- Local drafts are excluded from global taxonomy unless promoted.
- Global promotion requires admin approval.
- Promotion creates or targets a new global taxonomy version; it must not mutate a published version silently.
- Local drafts can preserve workflow, but strict volume totals require an approved muscle map. If no approved local/global map exists, the exercise is preserved but treated as unknown/unmapped for strict volume.
- Future Studio/team scope is deferred.

This preserves trainer flexibility without letting local names corrupt global deterministic behavior.

## 8. Import Lifecycle Policy

Proposed v1 lifecycle:

1. Raw private source stays outside the repo.
2. Import metadata stores only a sanitized source label.
3. Import creates a staging import batch.
4. Validation checks required fields, normalized names, candidate keys, muscle keys, roles, aliases, equipment, and duplicates.
5. Duplicate and alias collisions create review items.
6. Unknown muscle abbreviations create review items.
7. Admin approves, rejects, merges, or marks local-only.
8. Approved rows attach to a draft taxonomy version.
9. Publishing activates a taxonomy version.
10. Rollback/supersede restores or points to the previous active version without deleting historical rows.

Explicit privacy rules:

- Do not store raw private spreadsheet filenames by default.
- Do not store private client names.
- Do not store private trainer comments or client notes in taxonomy rows.
- Do not commit `private-reference` files.
- Do not use spreadsheet examples as final product truth; use them as operational evidence only.

## 9. Published Version Immutability

### A. v1 app policy

Published taxonomy versions should be treated as immutable. Corrections should create a new version, supersede a version, or record a patch event with an audit trail. Plans and future engine outputs should record the taxonomy version they used.

### B. DB enforcement now

The first real migration can either:

- Include reviewed triggers/policies to block mutation of active/published rows, or
- Create status/version columns and leave full immutability as an app policy until a follow-up enforcement migration.

If the first migration does not include triggers, immutability is not fully DB-enforced. The docs, SQL comments, and final migration notes must not overclaim.

### C. DB enforcement later

Later enforcement can use:

- Triggers similar to existing append-only audit/adaptation patterns.
- Status transition functions.
- Admin-only supersede/retire operations.
- Audit events for publish, supersede, retire, merge, alias approval, and map approval.

Recommendation: include no destructive immutability shortcut in the first migration. Either add carefully reviewed triggers for core published rows or explicitly mark immutability as app policy pending enforcement.

## 10. Rollback and Staging Plan

First migration should be non-destructive because:

- No runtime reads these tables yet.
- Existing plans, sessions, assessments, screening, pain/risk logic, and trainer approval flows remain unchanged.
- No generated types or app code should be updated in the migration PR.
- No private source data is seeded.

After applying in staging, inspect:

- Tables exist with expected columns.
- Indexes and partial unique indexes exist.
- RLS is enabled on every taxonomy table.
- Anon has no access.
- Authenticated non-admin can read only approved/active global rows.
- Trainer-local rows are visible only to owner/admin.
- Admin policies work through `public.has_role`.
- Import batches are admin-only.
- No runtime errors occur in current app flows.

Rollback drop order if needed before runtime integration:

1. `exercise_muscle_map`
2. `exercise_aliases`
3. `exercise_templates`
4. `exercise_import_batches`
5. `exercise_taxonomy_versions`

If deferred tables are explicitly added later, drop them before core tables in dependency order.

Production application is blocked if:

- RLS helper behavior differs from staging.
- Any policy permits anon writes or cross-trainer local draft access.
- Alias uniqueness blocks expected approved data.
- Published version immutability is described more strongly than it is enforced.
- Staging rollback is not verified.
- Runtime code is changed in the same PR.

## 11. Approval Checklist for Andre

| Decision | Recommended v1 default | Approve / change |
| --- | --- | --- |
| v1 muscle keys | Use `chest`, `shoulders`, `triceps`, `biceps`, `back`, `core`, `glutes`, `hamstrings`, `quads`, `calves` as v1 taxonomy keys. |  |
| Strict hypertrophy weights | `prime_mover=1.0`, `synergist=0.5`, `stabilizer=0.0`, antagonist metadata only. |  |
| Unknown exercise policy | Preserve display/logging, use unknown fallback, exclude from strict volume until mapped, create review item. |  |
| Trainer-local draft policy | Trainer-created exercises start local; global promotion requires admin approval. |  |
| Global read policy | Approved global taxonomy readable by authenticated users; no anon access. |  |
| Alias collision policy | Approved scoped aliases are unique; collisions/ambiguous imports go to review, not automatic mapping. |  |
| Import approval policy | Sanitized staging batch, validation, duplicate review, approval, publish; no private filenames/client names. |  |
| Published immutability level | Either DB-enforced triggers in first migration or explicitly app-policy-only until a follow-up enforcement migration. |  |
| Core-only first migration | First real migration includes only taxonomy versions, import batches, templates, aliases, and muscle maps. |  |
| Deferred substitution/media/tags | Substitution edges, media, movement/equipment/constraint tags, runtime reads, type generation, and seeds remain deferred. |  |

## 12. Go/No-Go Framing

Technically ready for core migration draft after Andre approval: yes.

Human approval still needed: yes.

Real migration must not be created until the approval checklist is accepted or changed. If Andre changes any blocking default, the SQL draft and migration scope should be updated before creating a file under `supabase/migrations/`.

## 13. Next Migration Scope

If approval is accepted later, the next migration may include only core v1 tables:

- `exercise_taxonomy_versions`
- `exercise_import_batches`
- `exercise_templates`
- `exercise_aliases`
- `exercise_muscle_map`

The next migration must not include:

- Substitution edges.
- Exercise media.
- Movement, equipment, or constraint tag tables unless explicitly approved.
- Runtime reads.
- Runtime writes.
- Generated Supabase type updates.
- Seed data from private spreadsheets.
- Any destructive migration.
- Changes to health assessment, PAR-Q, ACSM screening, risk, pain, injury, or trainer-approval behavior.
