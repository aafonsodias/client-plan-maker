## Round 1.6 — Capacity i18n verification

### Current state (audited)

I checked all four `common.json` files. Coverage is already complete from Round 1.5:

- 11/11 domains have `name` + `short` + `evidence` in en/pt/es/hi
- 32/32 `capacity.map.*` keys present in all locales
- 44 test labels present in all locales (43 from spec + the script will tolerate the extra `5_bound` slug variant)

So the real deliverable here is the **regression-guard script**, not translation work. If it surfaces drift, fix it; otherwise ship the script clean.

### Deliverables

1. **`scripts/verify-capacity-i18n.ts`** — dependency-free Node script (runs via `bun scripts/verify-capacity-i18n.ts` or `tsx`). It:
   - Reads `src/i18n/locales/{en,pt,es,hi}/common.json`
   - Defines the expected key sets inline (single source of truth — easy to extend in later rounds):
     - 11 domain slugs × 3 sub-keys (`name`, `short`, `evidence`)
     - 32 `capacity.map.*` keys
     - 43 `capacity.tests.{slug}` keys
   - Reports per-locale **missing** keys (expected but absent)
   - Reports **drift**: keys present in some locales but not all
   - Reports **literal-slug values**: any value equal to its own slug (e.g. `cooper_12min`) → fail
   - Reports **PT tu/você mix** in `capacity.*` strings: flags `tu`, `teu/tua/teus/tuas`, `contigo`, `te ` — guidance only when found
   - Exits `0` with `"All keys present in all 4 locales"` when clean; non-zero on any failure

2. **Run the script.** Print the report inline.

3. **Patch any gaps it finds.** Based on the pre-audit, expect zero gaps; if drift surfaces, add the missing PT/ES/HI translations following Round 1.5 conventions (formal `você` for PT, neutral 2nd person for ES, Hindi with Latin script kept for proper test names).

4. **Re-run until green.**

### Out of scope (per spec)

- New features, schema changes, style changes
- Refactoring i18n infrastructure
- Native review polish (tracked separately)
- Translating beyond the `capacity` namespace

### Acceptance

Script exists, exits 0, prints "All keys present in all 4 locales", and `/clients/$id` renders the Capacity Map + sheet without raw `[capacity.xxx]` strings in any of the 4 languages.
