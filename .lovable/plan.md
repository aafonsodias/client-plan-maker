### R75 — Exercise Media Architecture (Documentation Round)

Pure docs round. Builds on R74 taxonomy. No schema, no UI, no upload, no player, no provider integration, no deps.

---

### P0 — R74 Alignment Findings

Verified in `src/lib/exercise-taxonomy.ts`:
- `ExerciseKey` exported (line 182) — reuse, do not redefine.
- `MediaQualityStatus` already exists (lines 117–128) with `MEDIA_QUALITY_STATUSES` array. **This is the canonical media quality vocabulary** — R75 docs reference it, never redefine it.
- `EXERCISE_TAXONOMY_VERSION = 1` and entries already carry `media_quality_default`.
- `src/lib/session-taxonomy.ts` exists; not media-related, untouched.
- Existing media-adjacent docs: `mem/specs/exercise-media-quality.md` (taxonomy of statuses), `mem/specs/exercise-media-production.md` (filming standards), `mem/features/exercise-media-layer.md` (deferred scope blurb).

R75 docs will **link** to these and avoid recreating overlapping vocabulary.

---

### P1–P7 — Files to create/update (docs only)

**Create**
1. `mem/specs/exercise-media-hosting-architecture.md` — raw → master → streaming → app metadata → card. Provider abstraction (Bunny / Cloudflare Stream / Mux / `youtube_reference` / `local_reference`). Selection criteria. Migration rule: app stores enough metadata to re-host elsewhere.
2. `mem/specs/exercise-media-data-model.md` — future `exercise_media` shape keyed by `exercise_key: ExerciseKey` (reuses R74 type). Lists all fields from spec (provider, provider_asset_id, playback_url, angle, media_type, quality_status → reuses `MediaQualityStatus`, review_status, version, language, dims, flags, audit fields). Provider/angle/media_type/review_status enums proposed. **Spec only — no migration.**
3. `mem/specs/exercise-media-file-organisation.md` — naming convention `{exercise_key}_{angle}_{media_type}_v{n}_{yyyymmdd}.{ext}` + `/Protocol Exercise Media` folder structure (00_raw_capture … 06_rejected_or_needs_reshoot + metadata_notes). Versioning + master-immutability rules.
4. `mem/specs/exercise-media-production-workflow.md` — 7-step pipeline (Plan → Film → Select → Edit → Review → Encode/upload (deferred) → Attach (deferred)). Cross-links to existing `exercise-media-production.md` filming standards (does not duplicate them).
5. `mem/specs/exercise-ai-visual-pipeline.md` — AI/avatar/stickfigure/landmark are visual layers, never source of truth. Hard rules: preserve angle/ROM/tempo/joints; no invented depth, no bad-form correction, no mascot/creepy character. Real video + overlay > poor avatar.
6. `mem/audits/exercise-media-implementation-plan.md` — 9 phases (0 manual archive → 8 trainer custom media). Each: value/cost/risk/dependency/timing. Default: **Now = docs + file discipline; Next = Slice 2 identity wiring; Later = schema + provider + player.**
7. `.lovable/r75-exercise-media-architecture.md` — round summary + architecture decision + YouTube position.

**Update**
8. `mem/specs/exercise-media-quality.md` — add Founder Demo Honesty Model section (useful ≠ verified; record limitations; replace later; no AI fakery). Cross-link `MediaQualityStatus`.
9. `mem/audits/exercise-library-priority.md` — record R74 done, R75 = docs-only media architecture, **next technical slice is still Slice 2 (identity wiring into `longitudinal.ts` + logbook continuity), not media implementation.**
10. `mem/features/exercise-media-layer.md` — point to new hosting-architecture spec.
11. `mem/index.md` — add references to new specs.

**Optional pure type file — SKIP** (`src/lib/exercise-media-types.ts`). Rationale: nothing in the codebase consumes these enums yet; introducing them risks parallel vocabulary drift before schema lands. Documentation captures the same intent. Re-evaluate at Phase 3 (schema slice).

---

### YouTube position (codified in P1 + P5)

YouTube is **temporary/external reference only** (`youtube_reference`). Allowed for founder review and pre-product validation. Forbidden as: primary product media, branded client experience, "private" storage assumption, permanent canonical URL.

---

### Architecture decision (single line)

`Raw capture → Edited master → Streaming provider → App metadata (keyed by ExerciseKey) → Exercise card`. App never stores video bytes; it stores provider-agnostic metadata referencing `ExerciseKey`.

---

### Hard non-goals (will not happen this round)

Schema, migrations, new tables, upload UI, video player, provider API, signed URLs, CDN setup, new routes, new server functions, new dependencies, exercise library UI, avatar pipeline, AI video, generation/PKL/PDF/billing/schedule changes, edits to `exercise-taxonomy.ts` or `session-taxonomy.ts` beyond docs cross-links.

---

### Final report (after implementation)

Will summarize: R74 alignment, files touched, architecture decision, YouTube position, provider abstraction, future model + `ExerciseKey` link, naming/folder conventions, founder honesty model, AI/avatar role, phased plan, Slice 2 dependency, type-file decision (skipped), and the explicit list of items deliberately not built.