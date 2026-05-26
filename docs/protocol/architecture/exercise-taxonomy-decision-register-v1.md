# Exercise Taxonomy Decision Register v1

Date: 2026-05-26

Scope: documentation only. This register proposes v1 product defaults for exercise taxonomy and deterministic prescription decisions before any schema migration is drafted. It does not create migrations, change runtime behavior, import private data, or alter existing product logic.

## 1. Executive Summary

The taxonomy schema migration should not start until the product defaults are explicit. Once exercise templates, muscle maps, substitution edges, import batches, and taxonomy versions exist in the database, the schema will encode assumptions about identity, editability, review authority, auditability, and deterministic volume math. Reworking those assumptions after production data exists is possible, but expensive and risky.

Protocol needs taxonomy that is strict enough for deterministic logic and flexible enough for trainers. Strictness is required for stable joins, volume calculations, substitution filtering, progression continuity, and audit trails. Flexibility is required because trainers will use local names, preferred variants, regional terminology, private libraries, and client-specific substitutions.

AI cannot be the source of truth for taxonomy. AI may help suggest aliases, initial muscle maps, substitutions, or import cleanup candidates, but every taxonomy-affecting output must remain staged until a trainer/admin approval path accepts it.

Urgent for v1: canonical muscle keys, effective set weights, unknown exercise behavior, trainer-created exercise scope, import approval, movement/equipment vocabularies, substitution governance, taxonomy versioning, and audit requirements. Can wait: fine-grained submuscle regions, public media provider integration, per-client muscle-map personalization, automatic global promotion of trainer exercises, and client-visible advanced volume metrics.

## 2. Decision Table

| Decision | Recommended v1 default | Alternative options | Why this default | Risk if wrong | Reversible later? | Requires Andre approval? | Blocks schema migration? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Canonical muscle abbreviations | Use current 10 `MuscleGroup` keys: `chest`, `back`, `quads`, `hamstrings`, `glutes`, `shoulders`, `biceps`, `triceps`, `calves`, `core` | Add subregions now; use anatomical Latin names; use spreadsheet abbreviations directly | Matches existing code and volume landmarks; small enough for v1 | Too coarse for advanced bodybuilding or rehab | Yes, via region child table later | Yes | Yes |
| Muscle grouping hierarchy | One canonical group level in v1; optional `region_key` metadata only | Full hierarchy of region, head, side, joint action | Keeps volume engine tractable | Future detail may need backfill | Yes | Yes | Yes |
| Prime mover effective set weight | `1.0` | 0.75; exercise-specific weights only; no weighting | Matches current Protocol prompt rule and trainer intuition | Overcredits compounds with multiple prime movers | Yes, by taxonomy version | Yes | Yes |
| Synergist effective set weight | `0.5` | 0.25; 0.33; exercise-specific only; no synergist credit | Matches current Protocol prompt rule and simple spreadsheet practice | Inflates secondary volume or hides undertraining if too low | Yes, by taxonomy version | Yes | Yes |
| Stabilizer effective set weight | `0.0` for hypertrophy volume; track role as metadata | 0.1-0.25; no stabilizer tracking | Avoids pretending bracing equals direct hypertrophy stimulus | Understates stabilizer exposure for fatigue/risk | Yes | Yes | Yes |
| Antagonist tracking | Track as optional metadata; no volume credit | Do not store; store with negative/maintenance credit | Useful for balance/substitution reasoning without affecting volume | Schema clutter if unused | Yes | No, can defer | No |
| Unilateral exercise handling | Count one prescribed set as one set per mapped muscle, not doubled by side; add `unilateral=true` metadata | Double-count left/right; require per-side logs; ignore unilateral flag | Preserves common programming notation and avoids volume inflation | Side imbalance cannot be audited deeply in v1 | Yes, with performed-set side fields later | Yes | Yes |
| Compound exercise volume attribution | Multi-credit allowed: every prime gets `1.0`, every synergist gets `0.5`; volume audit shows map version | Cap total credit per set at 1.0; single primary only | Matches current primary/secondary model and supports multi-muscle compounds | Compound-heavy plans can show high total muscle-set sum | Yes, via engine policy/version | Yes | Yes |
| Movement-pattern vocabulary | Seed from current `MOVEMENT_PATTERNS`; add alias mapping for legacy/adaptation terms | Replace with new reduced list; use free text | Reuses existing code while allowing cleanup | Vocabulary may be too broad or inconsistent | Yes, with versioned pattern aliases | Yes | Yes |
| Equipment vocabulary | Use `EQUIPMENT_CATALOG.id` as canonical; support aliases for current taxonomy keys and stored labels | Keep EN labels as identity; use free text | Stable ids are better than labels and locale strings | Existing singular/plural mismatches need mapping | Yes | Yes | Yes |
| Constraint/contraindication tags | Seed from current `CAUTION_FLAGS`; add `severity`, `body_region`, `evidence_source` | Free-text notes only; exhaustive clinical taxonomy now | Structured enough for filters, not overbuilt | Safety-sensitive tags can be incomplete | Yes, but carefully | Yes | Yes |
| Trainer-created exercises | Trainer-local draft by default; not global and not used for strict volume until approved/mapped | Auto-global; blocked entirely; AI-created global suggestions | Allows workflow without polluting canonical taxonomy | Local duplicates and fragmented names | Yes, via promotion/merge | Yes | Yes |
| Global vs local taxonomy edits | Global taxonomy changes require admin/import approval; trainers can create local aliases/templates/overrides | All trainers edit global; no local edits | Protects shared deterministic behavior | More review overhead | Yes | Yes | Yes |
| Unknown exercise fallback | Preserve display name, assign `unknown:<normalized>`, log audit warning, exclude from strict canonical volume totals, allow trainer resolution | Block plans/sessions; silently infer; include as free-text volume | No silent math corruption while preserving workflow | Trainers may ignore warnings | Yes | Yes | Yes |
| Alias approval | Global aliases require approval; trainer-local aliases allowed only in trainer scope | Auto-approve aliases; no aliases | Prevents alias collisions and wrong joins | Review queue grows | Yes | Yes | Yes |
| Import batch approval | Always staged; validate, dedupe, review, then publish as taxonomy version | Direct import to active taxonomy; manual-only entry | Keeps private spreadsheet imports safe and reversible | Slower library expansion | Yes | Yes | Yes |
| Substitution edge governance | Global approved edges only for automatic suggestions; trainer may override per plan with reason | AI proposes live; any trainer creates global edges | Substitution is safety- and intent-sensitive | Too conservative substitutions early | Yes | Yes | Yes |
| Media/demo provider direction | Store optional provider-agnostic media rows; keep search fallback until verified media exists | Pick YouTube/Vimeo/internal now; no media table | Avoids provider lock-in while supporting future demos | Link rot and inconsistent demos | Yes | No, can defer details | No for core taxonomy |
| Multilingual display names | `name_pt`, `name_en`, and locale-scoped aliases; identity remains `exercise_key` | Separate templates per language; one display name only | Current product is bilingual and aliases already exist | Alias collisions across locales | Yes | Yes | Yes |
| Deprecated/retired exercises | Keep historical key, set `status=retired`, optional replacement template | Delete rows; mutate key in place | Preserves old plans/sessions and auditability | Retired rows add lookup complexity | Yes, policy can evolve | Yes | Yes |
| Taxonomy versioning | Draft -> active -> retired versions; plans record taxonomy version used | Mutable live rows only; semantic version text only | Deterministic audits need historical maps | Version management overhead | Hard to add later, so do now | Yes | Yes |
| Audit requirements | Every import, approval, merge, retirement, override, and engine decision stores actor, timestamp, previous/new values, reason, version, and input hash where relevant | Minimal timestamps only; rely on git history | Required for trainer trust and deterministic explainability | More schema and implementation work | Partially | Yes | Yes |

## 3. Recommended v1 Policy

Recommended muscle abbreviation system:

- Use the current `MuscleGroup` keys as the canonical v1 muscle set: `chest`, `back`, `quads`, `hamstrings`, `glutes`, `shoulders`, `biceps`, `triceps`, `calves`, `core`.
- Store display labels separately from keys.
- Store aliases for imported abbreviations and multilingual variants, but do not let import aliases become canonical keys automatically.
- Defer submuscle and side-specific canonical volume until v2. Allow optional region metadata so future migration is possible.

Recommended effective set weighting policy:

- Prime mover: `1.0`.
- Synergist: `0.5`.
- Stabilizer: `0.0` for hypertrophy volume, but store the role for readiness, fatigue, and substitution context.
- Antagonist: metadata only, no volume credit in v1.
- Compound exercises may credit multiple prime movers and synergists. The volume audit must show the exercise map and taxonomy version used.
- Unilateral exercises count as written in the plan, not doubled by default. A future per-side logging policy can refine this.

Recommended unknown exercise policy:

- Unknown exercises must not be silently mapped by AI or fuzzy matching.
- The app should preserve the visible exercise name and use a deterministic fallback key such as `unknown:<normalized_name>`.
- Unknown exercises are allowed in plan/session display and logging, but excluded from strict canonical muscle-volume totals until resolved.
- Unknowns should produce an audit warning and review candidate.

Recommended trainer-created exercise policy:

- Trainer-created exercises are local draft templates by default.
- Local templates can be used for display and local plan construction after trainer confirmation.
- They do not become global taxonomy rows unless promoted through approval.
- Strict volume calculations require an approved local or global muscle map. Otherwise the exercise remains in the unknown/unmapped bucket.

Recommended import approval policy:

- All imports are staged first.
- Import batches validate required fields, normalize names, detect duplicates, map equipment, map muscle abbreviations, and flag uncertain rows.
- Approval actions are approve, reject, merge, local-only, or needs-evidence.
- Publishing creates a new taxonomy version; rollback restores the previous active version without deleting historical rows.

Recommended substitution policy:

- Automatic substitution suggestions use approved global substitution edges only.
- Trainer-local substitution preferences may exist, but must be scoped and audited.
- AI may propose substitutions only into staging or explanation, never directly into active edges.
- Client-specific contraindications and equipment filters must be applied before a substitution is shown as acceptable.

Recommended edit/versioning policy:

- Published taxonomy rows are immutable for calculation history.
- Corrections create a new taxonomy version or explicit patch event.
- Retired exercises remain resolvable for historical plans and sessions.
- Plans should eventually store the taxonomy version used at creation.

Recommended audit policy:

- Store actor, scope, event type, previous value, new value, reason, source, approval status, taxonomy version, and input hash where relevant.
- Engine outputs should include engine version, taxonomy version, warnings, and unmapped exercise counts.
- AI suggestions should be audited separately from accepted taxonomy changes.

Uncertain items needing explicit approval: effective set weights, unknown-exercise strictness, trainer-local exercise scope, and whether complex volume metrics should be trainer-visible in v1.

## 4. What Should Be Configurable

| Setting | Classification | Rationale |
| --- | --- | --- |
| Canonical muscle keys | Hardcoded v1 default | Engine tests and schema need stable keys. |
| Muscle aliases | Admin configurable | Imports and multilingual names need reviewable expansion. |
| Prime/synergist/stabilizer weights | Admin configurable by taxonomy version | Defaults need governance and audit; trainers should not casually change global math. |
| Exercise display names | Admin configurable globally; trainer override per plan/session | Identity must remain stable while display can be local. |
| Trainer-created exercises | Trainer configurable per account in draft/local scope | Supports workflow without polluting global taxonomy. |
| Global exercise templates | Admin configurable only | Shared deterministic behavior requires control. |
| Unknown exercise strictness | Admin configurable; default warn/exclude from strict totals | Product may later choose to block approvals with unknowns. |
| Import approval status | Admin configurable | Imports are governance actions. |
| Substitution edges | Admin configurable globally; trainer override per plan/session | Safety and intent need approval, but trainers need plan-specific judgment. |
| Constraint tags | Admin configurable | Safety tags should be centrally controlled. |
| Media/demo links | Admin configurable; trainer override per plan/session later | Low-risk display concern but still needs quality control. |
| Taxonomy version lifecycle | Not configurable in v1 | Keep draft/active/retired simple. |
| Audit event creation | Not configurable in v1 | Audit must be mandatory. |
| Client-visible volume complexity | Not configurable in v1; keep hidden or trainer-only | Avoid overexposing uncertain metrics before validation. |

## 5. Deterministic Engine Implications

- `volumeEngine`: can use stable muscle keys and role weights immediately once taxonomy rows exist. It must produce warnings for unknown/unmapped exercises and include taxonomy version in output.
- `prescriptionEngine`: can filter by canonical equipment, movement pattern, contraindication tags, level, and template status. It should not ask AI to invent exercise names for canonical prescriptions.
- `progressionEngine`: can group history by `exercise_key` and approved aliases instead of raw names, improving continuity across language and variant names.
- `substitutionEngine`: must read approved edges, equipment tags, constraint tags, muscle maps, and movement patterns. AI stays outside the active decision path.
- `readinessEngine`: can use constraint tags, body-region metadata, and stabilizer roles to warn or reduce exercise choices when readiness, pain, or recovery signals conflict.
- `auditEngine`: must capture taxonomy version, engine version, unknowns, overrides, import batch, and previous/new values for every material decision.
- Import pipeline: must stage everything, validate structure, reject ambiguous rows, and publish only reviewed taxonomy versions.
- Future AI minimization: AI moves from choosing exercises and inventing mappings toward suggesting review candidates, explaining deterministic rationale, and summarizing messy notes.

## 6. Schema Implications

Eventual taxonomy schema must support these tables:

- `exercise_templates`
- `exercise_aliases`
- `exercise_muscle_map`
- `exercise_movement_patterns`
- `exercise_equipment_tags`
- `exercise_constraint_tags`
- `exercise_media`
- `exercise_substitution_edges`
- `exercise_taxonomy_versions`
- `exercise_import_batches`
- `exercise_import_staging_rows`
- `trainer_exercise_templates` or scoped templates via owner/scope fields
- `trainer_overrides` or domain-specific override rows

Required fields:

- Stable identity fields: `exercise_key`, `normalized_name`, `status`, `scope`, `owner_trainer_id`.
- Versioning fields: `taxonomy_version_id`, `previous_version_id`, `published_at`, `retired_at`, `replacement_exercise_id`.
- Approval fields: `approval_status`, `approved_by`, `approved_at`, `rejected_reason`, `source_type`, `import_batch_id`.
- Audit fields: `created_by`, `updated_by`, `reason`, `source_hash`, `input_hash`, `engine_version`.
- Muscle map fields: `muscle_key`, `role`, `effective_set_weight`, `confidence`, `evidence_source`.
- Equipment and constraint fields: canonical tag keys, severity, body region, requirement type.
- Fallback fields: `unknown_key`, original display name, normalized candidate, review status, resolved template id.

Plans and sessions do not need to be rewritten in the first taxonomy migration, but the future bridge must support storing `exercise_key`, `display_name_snapshot`, `taxonomy_version_id`, and unknown/unmapped warnings alongside existing JSON.

## 7. Risk Register

| Risk | Severity | Why it matters | Mitigation | Decision needed now or later |
| --- | --- | --- | --- | --- |
| Wrong effective set weights | High | Volume, progression, and deload decisions can become misleading | Start with simple 1.0/0.5/0.0, version weights, expose audit, keep trainer override | Now |
| Too many muscle abbreviations | Medium | Imports become ambiguous and trainers lose trust in metrics | Keep 10 canonical groups, aliases only, defer subregions | Now |
| Too strict unknown exercise handling | Medium | Trainers may be blocked during normal workflow | Preserve display/logging, warn, exclude from strict totals, provide review queue | Now |
| Trainer-created exercise chaos | High | Global taxonomy can fill with duplicates and unsafe mappings | Trainer-local drafts by default; global promotion requires approval | Now |
| Unsafe substitutions | High | Substitutions can violate injury, equipment, or goal constraints | Use approved edges plus constraint/equipment filters; require trainer override reason | Now |
| Imported spreadsheet inconsistencies | High | Private workbooks may encode incompatible columns, abbreviations, and formulas | Stage imports, validate, dedupe, review unknowns, never commit source files | Now |
| Multilingual alias collisions | Medium | Same alias can resolve to different exercises across locales | Locale-scoped aliases plus collision review before approval | Now |
| Media link rot | Low | Demo quality can degrade and break trust | Provider-agnostic media rows, status field, fallback search, verification date | Later |
| Overexposing complex metrics to trainers | Medium | Early metrics may look precise before evidence and UI education exist | Keep advanced volume audit trainer-only or internal in v1 | Later |
| Versioning overhead | Medium | More schema and operational complexity | Keep lifecycle simple: draft, active, retired | Now |
| Local/global scope bugs | High | Trainer-local taxonomy could leak between accounts | Explicit scope and owner fields, RLS tests, audit events | Now |

## 8. Human Approval Checklist

| Decision | Recommended default | Approve / change |
| --- | --- | --- |
| Muscle groups | Use current 10 `MuscleGroup` keys for v1 |  |
| Effective set weights | Prime `1.0`, synergist `0.5`, stabilizer `0.0`, antagonist metadata only |  |
| Compound attribution | Allow multi-credit per mapped prime/synergist and audit the map version |  |
| Unknown exercises | Preserve display/logging, use `unknown:<normalized>`, exclude from strict totals, queue review |  |
| Trainer-created exercises | Trainer-local draft by default; global promotion requires approval |  |
| Import batches | Staged, validated, reviewed, and published as taxonomy versions |  |
| Substitutions | Approved global edges for automatic suggestions; trainer plan overrides require reason |  |
| Versioning/audit | Published versions immutable; audit every import, approval, merge, retirement, override, and engine decision |  |
| Metric visibility | Keep advanced volume/taxonomy diagnostics trainer-only or internal in v1 |  |

## 9. Next PR Readiness

Schema migration draft can begin after this decision register only if Andre approves the checklist defaults or provides replacements. Without that approval, the schema can be drafted only as a non-authoritative sketch.

Before taxonomy tables:

- Approve muscle keys, version lifecycle, global/local scope, approval fields, and audit fields.

Before import staging:

- Approve import batch lifecycle, duplicate policy, alias approval, unknown abbreviation handling, and private-source privacy rules.

Before volume engine:

- Approve effective set weights, compound attribution, unilateral handling, unknown-exercise volume behavior, and metric visibility.

Before substitution engine:

- Approve substitution edge governance, constraint tags, trainer override requirements, and safety severity policy.

Before trainer-created exercise workflow:

- Approve local-vs-global scope, promotion workflow, alias collision handling, and whether local muscle maps can drive strict volume.

Recommended next PR after approval: schema migration draft for taxonomy tables, with no production import and no runtime use until migrations, RLS, generated types, and rollback are reviewed.
