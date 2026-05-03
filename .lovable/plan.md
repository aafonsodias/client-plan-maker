# Part 2 — Adaptive intake + metabolism/steps + AI SMART helper

Two waves. Wave A finishes the Part 2 we agreed on last round. Wave B picks up the new feedback. Both sweat the "técnica > força bruta" rule: cheapest model that does the job, real value per question, no fluff.

---

## Wave A — Adaptive intake (the original Part 2)

### A1. Remove "Who is this for?" slide

Already inferred from context (intake link → `coached`, `/welcome` solo route → `self`). The slide is redundant. Default `intake_path = "coached"` when the form is loaded via `/intake/$token`, skip rendering it. Keep the field in the schema (already supported) so nothing breaks.

### A2. Add missing slides (real coaching info — currently dropped)

New slides between current "Experience" and "Location":

1. **Anthropometry** — height (cm), current weight (kg), optional waist (cm). Persists to `assessments.height_cm`, `weight_kg`, `extended.waist_cm`. Skippable.
2. **Training history** — years training (pill: <1, 1–3, 3–5, 5–10, 10+), longest consistent streak (months), prior injuries narrative (already partly there, promote it).
3. **Real availability** — instead of just "days/week + duration", a 7-day pill grid (Seg–Dom multi-select) + typical window (manhã/almoço/tarde/noite). This survives the "I can do 4 days but only Tue/Thu/Sat/Sun" reality. Stored on `extended.weekday_availability[]` + `extended.window`.
4. **Modality preference** — pill multi: força, hipertrofia, condicionamento, mobilidade, desporto-específico, perder gordura, ganhar massa. Currently inferred from goal — making it explicit takes 4 seconds and unblocks better Stage 2 archetypes.
5. **Secondary goal** (optional) — same SMART micro-pattern as primary, but skippable. Persists to `extended.secondary_goal_*`.

All slides use the existing `Skip` mechanism, all copy through `intake.json` PT/EN.

### A3. Photo upload polish (carryover)

Already wired to IndexedDB + retry — verify hydration on coach side `clients_.$clientId.tsx`. Add a 2x2 thumbnail row reading from `assessments.extended.photos` with signed URLs (server fn `getClientPhotoUrls`). Lightbox on click. No editing UI yet.

---

## Wave B — New feedback

### B1. AI-suggested SMART (cheapest model, accept/edit)

User writes the goal in slide 2 (`smart_specific`). Slide 3 currently asks them to also write metric + deadline manually — most clients freeze here.

**Flow:**
- After slide 2, call new server fn `suggestSmartMetric` with `{ goal, profile_hint }` → returns `{ measurable: string, deadline_iso: string, rationale: string }`.
- Model: `google/gemini-3-flash-preview` (cheapest, ~$0.0001/call). Hard cap 200 output tokens. JSON tool-call.
- Prefill slide 3 with the suggestion + a small "✨ proposto pelo Forge — edita se quiser" chip. User just taps Next.
- Cache result in `extended.ai_smart_suggestion` so re-renders don't re-call.
- Skip-safe: if AI fails, fallback to the current empty inputs.

Cost ceiling: ~1 call per intake. Negligible.

### B2. Metabolism + activity panel in assessment

New compact card on the existing slide that already asks `ext_hours_seated` / `ext_daily_steps` / `ext_job_type`. Promote it into a proper "Atividade & metabolismo" slide with:

- **BMR** auto-computed (Mifflin-St Jeor, needs sex + age + height + weight — sex pill added here, age from `client_dob` if present).
- **Activity factor** picked via pill: sedentário 1.2 / leve 1.375 / moderado 1.55 / ativo 1.725 / muito ativo 1.9.
- **TDEE** = BMR × factor, shown live as the user picks.
- **Treino estimado** = sessions/week × duration × MET (rough lookup by experience level), shown as kcal/week.
- Persisted to `extended.metabolism = { bmr, activity_factor, tdee, training_kcal_week, sex }`.
- Pure client-side math, no AI call. ~50 LOC of `src/lib/metabolism.ts` + tiny component.

This is data that **directly improves** Stage 2/3 prompts (we can pass `tdee` so volume prescription respects energy availability).

### B3. Daily-step logging (lightweight, no device sync)

**Scope honesty:** no Apple Health / Google Fit integration this round (huge surface, OAuth, native bridges). Manual logging only — but make it 5-second fast.

- New table `daily_activity_log (client_id, date, steps int, notes text)` with RLS scoped to trainer + client (via intake token in client-side log routes).
- Tiny widget in `/log/$token` and on coach client page: "Quantos passos hoje?" + history sparkline (last 14 days).
- Compute kcal from steps cheaply: `steps × weight_kg × 0.0005` (standard ACSM walking estimate).
- Show on client overview alongside compliance: "Passos médios 7d: 8.2k · ~310 kcal/dia".
- No notifications, no goals enforcement — just visibility. The user explicitly said "no devices, just track manually for now."

Defer to next round (P1 not P0 here): integration with Apple Health / step counters.

### B4. "Where will you train?" → multi-select

Trivial change. Pills component already supports `value: string[]`. Convert `training_location` from string → string[] in form state, persist as comma-joined to keep the column shape (or migrate the column to text[] — preferred, cleaner). I'll do the proper migration.

### B5. Expanded equipment catalog (3–5× more)

Current list has 8 items. New catalog grouped by category, each with i18n key + emoji-free label. ~35 items across:

- **Barras & discos** — barbell, EZ bar, trap bar, plates standard, plates olympic
- **Halteres & kettlebells** — dumbbells fixed, dumbbells adjustable, kettlebells single, kettlebells set
- **Máquinas** — cable machine, smith machine, leg press, lat pulldown, hack squat, leg curl/ext, chest press
- **Bancos & racks** — flat bench, adjustable bench, squat rack, power rack, dip station
- **Corpo & suspensão** — pull-up bar, dip bar, parallettes, gymnastic rings, TRX
- **Cardio** — treadmill, stationary bike, rower, assault bike, jump rope, stair climber
- **Mobilidade & acessórios** — resistance bands, mini-bands, foam roller, lacrosse ball, sliders, ab wheel, medicine ball, slam ball, sandbag, plyo box
- **Espaço** — outdoor track, hill, pool

Stored as IDs in `available_equipment text[]`. Group headers in UI. Search/filter input on top because 35 pills need it. Catalog lives in `src/lib/equipment-catalog.ts` (already exists — extend it).

---

## Technical summary

**New / modified files:**
- `src/routes/intake.$token.tsx` — slide additions, multi-select location, prefill SMART
- `src/lib/metabolism.ts` (new) — Mifflin + TDEE
- `src/components/intake/MetabolismPanel.tsx` (new)
- `src/lib/equipment-catalog.ts` — expand to ~35 items, group metadata
- `src/server/intake-ai.functions.ts` — add `suggestSmartMetric`
- `src/server/daily-activity.functions.ts` (new) — log + read 14-day window
- `src/routes/log.$token.tsx` — steps widget
- `src/routes/clients_.$clientId.tsx` — photos thumb row + steps mini-chart
- i18n: `intake.json`, `common.json`, `assessment.json` PT+EN

**Migrations:**
1. `assessments`: add `extended` schema usage docs (no DDL — already JSONB).
2. `clients.training_location` → `text[]` (with safe backfill: `string_to_array(training_location, ',')`).
3. New table `daily_activity_log` with RLS (trainer can read all of own clients; intake-token read+insert via server fn using service role).

**Cost discipline:**
- 1 cheap AI call per intake (SMART suggest, ~$0.0001).
- 0 AI calls for metabolism/steps (pure math).
- All text fits the existing slide animation cost.

**Ordering of work:**
1. Migration (location → text[], new daily_activity_log).
2. Metabolism panel + equipment expansion + multi-location (no AI, fast wins).
3. Slide additions (anthropometry, history, real availability, modality, secondary).
4. AI SMART helper.
5. Steps widget (client log + coach view).
6. Photo thumbs on coach page.

After this round the assessment carries everything Stage 2 actually needs to prescribe honestly: real availability, real equipment, energy budget, history depth. No food tracking yet (correctly out of scope).

---

## What I'm explicitly **not** doing this round

- Apple Health / Google Fit / wearables — separate beast, P2.
- Food tracking — confirmed parked.
- Solo `/me` dashboard buildout — already deferred; `/welcome` lands solo users in the standard dashboard for now.
- Posture analysis from photos — kept honest as "visual progress only."

Approve and I'll execute in the order above, smoking each migration with a backup first per the non-negotiables.