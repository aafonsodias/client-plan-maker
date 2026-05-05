
# Round 57 — Region-aware name generation + smart geo touches

## Why

Hardcoded names ("John Smith", "Maria Silva") on the landing feel dishonest to a Brazilian, Indian or Nigerian visitor — and the same flatness exists on the demo seed pool (`src/server/demo-client.functions.ts`) where every persona has 4–5 hardcoded Portuguese names. We need **one** smart generator both can share, with weighted regional pools so the population matches who's actually looking at the page.

## 1. New module: `src/lib/names/regional-names.ts`

Pure, deterministic, zero deps. Exports:

```ts
type Region = "iberia" | "western_europe" | "eastern_europe" | "north_america"
            | "latam" | "brazil" | "maghreb" | "sub_saharan_africa"
            | "middle_east" | "south_asia" | "east_asia" | "southeast_asia" | "global";

type Sex = "f" | "m";

generateName({ region, sex, seed }): { first, last, full }
generateRoster({ region, count, seed }): NameRecord[]   // gender-balanced
detectRegionFromLocale(locale: string): Region          // "pt-BR"→brazil, "pt-PT"→iberia, etc.
```

### Mixture model (the smart bit)

Each region is **not** a single pool — it's a probability distribution over **sub-pools**. Per the user's brief:

```
iberia            → 70% iberian + 20% latin_european + 10% global_anglo
western_europe    → 60% local + 25% latin_european + 15% global_anglo
eastern_europe    → 65% slavic + 20% german + 15% global_anglo
north_america     → 45% anglo + 25% hispanic + 15% east_asian + 10% south_asian + 5% african
latam             → 70% hispanic + 20% indigenous_mestizo + 10% global_catholic
brazil            → 55% luso_brazilian + 20% afro_brazilian + 15% italian_german_diaspora + 10% global
maghreb           → 70% arab + 20% berber + 10% french_colonial
sub_saharan_africa→ 55% local_ethnic + 30% christian_global + 15% muslim_global
middle_east       → 80% arab_persian + 20% christian_global
south_asia        → 50% hindu + 25% muslim + 15% sikh + 10% christian
east_asia         → 90% local + 10% christian_western
southeast_asia    → 50% local + 25% chinese_diaspora + 15% muslim + 10% colonial_iberian
global            → balanced sample across all of the above
```

Sub-pools live as small arrays (~15 first names per sex + ~15 surnames each) inside the same file. Total file ≈ 600 lines but trivial data. Surnames pair with first names from the same sub-pool so we never produce "Wei Schmidt".

### Determinism

A seeded PRNG (FNV-1a hash → `mulberry32`) so the same `seed` always returns the same roster. This matches `src/lib/demo-avatars.ts` so first-name → avatar pairing stays stable across rerenders.

### Honest framing

A short header comment makes it explicit: pools are *common* names (not exhaustive), surnames pair within sub-pool to avoid implausible mixes, and the "global" weight is intentional — real client books are mixed. No stereotypes, no slurs, no joke names.

## 2. Wire into the landing — `src/routes/index.tsx`

`CoachWorkbenchMockup` currently hardcodes 5 names. Replace with:

```ts
const region = detectRegionFromLocale(i18n.language);
const roster = generateRoster({ region, count: 5, seed: 42 });
```

Each row keeps its existing phase/status/photo metadata; only `name`/`initials` come from the roster. `pickDemoAvatar({ sex, archetype: phase.label, fullName })` already exists and stays in charge of picking the photo deterministically — we just feed it the new name + sex.

Add a tiny one-liner under the header chip: *"Nomes adaptados à sua região — só exemplos."* (i18n key `landing.mockups.workbench_subtitle`). Honest, no fake claim of personalization.

## 3. Wire into the demo seed — `src/server/demo-client.functions.ts`

Today every persona has a 4–5-name `name_pool` of Portuguese names — fine for PT founder demos, useless if a Brazilian PT clicks "demo". Change `name_pool` selection:

- Keep the existing PT pools as the default (preserves current behaviour for PT trainers — non-breaking).
- Accept an optional `locale` arg through `seedDemoClients` → `pickName(persona, locale, seed)`. When `locale` is set and not `pt-PT`, call `generateName({ region: detectRegionFromLocale(locale), sex: persona.sex, seed })` instead of `rand(persona.name_pool)`.
- `seedDemoClients` is called from `src/server/demo-oneshot.ts` and `src/components/DemoLabPanel.tsx` — both already have access to the trainer's profile or `i18n.language`; pass it through.

Result: an English-speaking trainer demoing the app sees John, Priya, Wei, Chioma, Sofia in their roster — not five Portuguese strangers.

## 4. Other surfaces worth the same treatment (audit findings)

While scanning I found two more spots that fake universality:

a. **`src/lib/demo-avatars.ts`** — currently picks portraits by hashing only `(archetype, fullName)`. Now that names are region-aware, the avatar URL pool naturally tracks the name (because the hash includes `fullName`), but we should split the pool by region too: `randomuser.me` skews white. Add a `region` parameter and partition the curated portrait list per region (e.g. add separate index sets for women/men we judge as plausibly south-asian, east-asian, african, latam). No new URLs needed — randomuser.me has them all; we just curate per region. **Out of scope for this round if too long — tag as P1 follow-up.**

b. **`PriceTag` / pricing copy** — already EUR-source via `CurrencyContext`. No change needed; flagging as already correct.

c. **Testimonials / social proof** — none exist yet (per memory: "No fake social proof"). Good, nothing to do.

d. **`mockClients` city / phase labels** — phase strings ("Bloco 1 · Sem 3 · Hipertrofia") are language-aware via `t()`. No regional issue there.

So the only meaningful additional surface is **(a) avatars** — included in this round if we have credit headroom, otherwise deferred to P1.

## 5. i18n + memory

- Add `landing.mockups.workbench_subtitle` to `pt/plan.json` + `en/plan.json`.
- New memory: `mem://features/regional-names.md` — describes the mixture-model contract, where it's used, and the rule "always include sex on personas; never pair names across sub-pools".
- Update `mem://index.md` Core line: replace the John/Maria override with: *"Demo + landing names come from `lib/names/regional-names.ts` (region-weighted mixture). Never hardcode display names."*

## 6. Backlog

Mark Round 57 done in `.lovable/backlog.md`; promote "Region-aware avatar pool" to P1 if not bundled.

## Out of scope

- Translating phase/status strings further (already i18n-driven).
- Real geo-IP detection — `i18n.language` (browser locale) is enough and respects user choice. We do **not** want to ship geo-IP without consent.
- Any change to plan generation, pricing, or auth.

## Estimated impact

Tiny — one new pure module (~600 lines of data, ~80 lines of logic), 2 file edits (landing + demo seed), 2 i18n keys, 1 memory file. No migration, no AI calls, no new deps.
