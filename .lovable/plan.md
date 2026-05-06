
# Protocol Forge — UX Friction & Product Value Audit

**Mode:** diagnostic only. No implementation. Observations grounded in the current codebase (R28 → R67 backlog state, dashboard / clients / plan / log / knowledge / cockpit / me / index files inspected).

---

## Part 1 — Per-surface audit

### 1. Landing page (`/`, `src/routes/index.tsx`, ~1,270 LOC)

- **Job:** convince a PT to sign up for the closed beta.
- **Mental model implied:** "premium PT operating system" — BrandMark, amber glow, controlled typography. Good.
- **Trust signals:** PT-only voice ("você"), explicit "Beta privado · vagas limitadas esta semana" honesty, no fake testimonials (memory-enforced).
- **Doubt signals:**
  - Single hero mockup (`HeroPlanMockup`) carries the entire credibility load. If the screenshot looks AI-generated rather than from the real product, trust collapses immediately.
  - No visible loop diagram **assessment → protocol → PDF → log → next week**. The full system value is the loop, but the landing still reads as "plan generator + nice PDF".
  - Pricing tiers (Starter 8 / Pro 25 / Studio 60) need a one-line justification next to each cap; without it Starter looks artificially crippled.
- **Excel feeling:** none — landing is the strongest surface visually.
- **Magic feeling:** muted. The only "wow" promise is "90s plan", which is a ChatGPT-class claim. Nothing on the landing communicates explainability, rationale chips, or the deterministic progression layer — which are Protocol's actual moat.
- **Likely ignored:** FAQ accordion (5 items, OK length), pricing footnotes.
- **Minimal recommendation:** add one ~120px loop strip below the hero — 5 inline chips (Assess · Generate · Print · Log · Adapt) with one-line each. Keep current hero.
- **Do NOT:** add testimonials, case studies, video heroes, or rotating slides — landing memory forbids fake social proof and the rotator is already disabled.

---

### 2. Dashboard / Coach Cockpit (`/dashboard`, ~554 LOC)

- **Job:** "what should I do next?"
- **Mental model implied:** mixed. Today it reads as **client roster + plans inbox + onboarding checklist + birthdays + dropoff alerts + Atlas Genie**. Six surfaces competing for the eye.
- **Trust signals:** real adherence sparklines (`EvolutionSparkline`), block evolution Δ% chip, dropoff alerts.
- **Doubt signals / hesitation:**
  - No single "today" stripe at top — a PT opening Monday morning has no answer to "who needs me this week?". They have to scan 6 panels.
  - `OnboardingChecklist` lives next to working data — once a PT has 3+ clients it becomes visual debt that can't be dismissed.
  - `AtlasGenie` (assistant) and `CoachCockpit` (insights) feel like two competing answers to "what now?".
- **Cognitive load:** high on first paint. The page is dense vertically because every block is full-width.
- **Click friction:** to log a client's session as a coach, the path is dashboard → client card → plan → sessions tab. 3 clicks for the most-frequent action.
- **Excel feeling:** the recent plans list is currently a vertical list of rows with status chips + sparkline. Verges on spreadsheet — saved by the sparkline. Without it, would feel like a filtered table.
- **Magic feeling:** dropoff alerts and the per-client Δ% sparkline are the strongest moments — "the system noticed something I would have missed". This is gold and underused.
- **Likely ignored:** birthdays panel (low signal unless the PT actually messages clients on birthdays — and right now the dashboard doesn't help compose that message).
- **Minimal recommendation:** promote dropoff alerts + "needs review this week" into a 1-line **Today** ribbon at the very top. Demote onboarding checklist to a collapsible card after the user has ≥3 clients.
- **Do NOT:** add more KPI tiles. The dashboard does not need an MRR/clients/revenue strip — that's a SaaS reflex, not a coaching reflex.

---

### 3. Client list / Client profile (`/clients/$clientId`, **4,136 LOC**)

- **Job:** open one client and run their training relationship.
- **Mental model implied:** "everything about this client lives here." Correct intent.
- **Doubt signals:**
  - 4,136 LOC in one route file is a maintainability red flag — each tab probably owns a slightly different state convention. The user can feel this in inconsistent loading skeletons or stale data after a save.
  - Without seeing the on-screen layout, the LOC alone tells me there's likely **8–12 stacked sections** (assessment, missions, plans, sessions, measurements, intake, photos, year view, schedule, etc.). Anything > 5 sections forces the user to scroll-hunt.
- **Hesitation:** "what is this section for, and is it ready to use?" The client phase pill (`ClientPhasePill`) helps but only if it changes the page contents, not just the chip.
- **Excel feeling:** likely highest in measurements and assessment grids (need direct visual confirmation, but pattern across the codebase suggests dense input rows).
- **Magic feeling:** when the year view (`YearView`) shows real blocks evolving — that's the wow moment of the client page.
- **Likely overused:** vertical accordions stacked.
- **Likely ignored:** documents tab if no docs uploaded; reassessment sheet trigger.
- **Minimal recommendation:** add a sticky 2-row header (name + phase + next action), and make every section auto-collapse to a 1-line summary that opens on click — not a tab system, not a redesign, just `<details>` semantics with a designed summary line.
- **Do NOT:** split the route into sub-routes yet (would break in-page state and saves) and do NOT add tabs (reintroduces hide-and-seek).

---

### 4. Inline 5-stage workbench (`plans.$planId.{brief,blueprint,microcycle,progressions,sessions}.tsx` + `plans.$planId.tsx` ~1,958 LOC)

- **Job:** drive a plan from brief → final week.
- **Mental model:** "phased AI pipeline you can intervene in." Strong concept.
- **Trust signals:** stage cards, validation reports, rationale chips on inferred values, deterministic Stage 4 (no AI = no hallucination at the most error-prone step).
- **Doubt signals:**
  - Stage labels (1–5) read as workflow steps but the inline workbench mixes them with "view" mode. A first-time PT does not always know whether they are running the pipeline or browsing the result.
  - "Approve and continue" between stages: the cost of pressing it is invisible (does it generate? Does it lock? Can I un-approve?).
  - PR confetti, NextWeekCard, CapacityGainCard, BlockAdaptationCard — each is great in isolation; together at the top of `/plans/$id` they create a wall of cards that looks marketing-heavy.
- **Cognitive load:** Stage 5 ("Bulk fill remaining weeks") used to be AI-driven and is now deterministic via `programNextWeek`. The UI may still imply a giant AI step here — needs verification that the page no longer says "generating week 2-N".
- **Click friction:** button column in plan header (8 buttons per memory note #63) — overflow menu is already on the backlog (R55), still pending.
- **Excel feeling:** `MesocycleTableView` is the clearest spreadsheet on the platform. Backlog #61 (blue actual line under prescription) helps; until it ships, the table reads as static.
- **Magic feeling:** **highest in the app** = `programNextWeek` actually re-shaping next week from logged RPE drift. Most users will not realize this happened unless the UI labels it loudly. Currently it's a card; could be a "what changed" diff.
- **AI suspicion:** Stage 3 microcycle is the riskiest — "where did this exercise come from?" Rationale chips help but on the exercise itself, not just on the stage.
- **Minimal recommendation:** add a one-line per-stage "what this step does and what it costs" subtitle under each stage card title. E.g. Stage 4: *"Deterministic — no AI call. Builds weeks 2–N from your cockpit knobs."*
- **Do NOT:** redesign the stage flow. Do NOT add stage redirects (memory rule).

---

### 5. BriefEditor (component used in Stage 1 + plan header)

- **Job:** capture training brief in a way that produces a defensible plan.
- **Mental model:** form-like. Honest.
- **Trust signals:** rationale chips on inferred tier and split, "based on current inputs" hint.
- **Doubt signals:**
  - "Quick path" vs "Lab mode" toggle at the top is now persistent — but the labels are still abstract. A new PT does not know which one is "right" for them. Default Quick is fine; the toggle copy could read "Show advanced controls" instead.
  - The objective/secondary-goals/training-age cluster reads like a registration form. Could be 3 chips that expand on click.
- **Excel feeling:** the emphasis split (3 number inputs summing to 1.0) is the densest spot. Most PTs will not know what to type.
- **Magic feeling:** the tier inference chip when it shows "remedial · 2 red flags" — that's a small wow.
- **Likely ignored:** "intensity_appetite" select at the bottom (the cockpit covers this better; the field is duplicate cognition).
- **Minimal recommendation:** drop or hide `intensity_appetite` once the cockpit is mounted (it's redundant with cockpit's RPE ceiling + autoreg). Convert emphasis_split to a 3-segment slider that always sums to 1.
- **Do NOT:** add more brief fields. The Brief is already at the edge of what a busy PT will fill.

---

### 6. Intensity Cockpit (`src/components/plan/IntensityCockpit.tsx`)

- **Job:** modulate progression without rewriting the engine.
- **Mental model:** dashboard knobs + presets. Great metaphor.
- **Trust signals:** preset chips, summary line, rationale chip on preset, "Manual control" toggle (not "advanced").
- **Doubt signals:**
  - "Custom" preset chip is disabled but visible — it reads as broken until you understand it's a state indicator.
  - The summary line `Linear · RPE 9.0 · deload 4w · suggested` is the single most important thing on this surface and currently competes for attention with 6 preset pills above it. It should be the *headline*, presets second.
  - Knob row (when expanded) is 5 selects + 1 range slider — very settings-y. Not Excel, but close.
- **Likely ignored:** `intensity_volume_tradeoff` knob — the option labels (`high_int_low_vol`, `moderate_moderate`) are jargon and the consequence is invisible.
- **Likely magical:** when changing a preset visibly changes the summary line and the user sees the 5 settings snap together. That micro-animation moment doesn't currently exist — the change is instant.
- **Minimal recommendation:** swap the visual hierarchy — summary line big, presets as chips below, "Manual control" still last. When changing presets, briefly flash which knobs changed (~600ms amber pulse on the changed values).
- **Do NOT:** add more knobs. Do NOT add per-knob confidence dots (memory forbids).

---

### 7. Knowledge / PKL page (`/knowledge`, ~598 LOC)

- **Job:** customise the rules the engine uses.
- **Mental model:** "settings panel for protocol rules". This is the page most likely to make a PT say "this is just settings".
- **Trust signals:** version number, summary lines, rationale chip on each card, side-sheet for advanced editing (good — defaults stay clean).
- **Doubt signals:**
  - Summary lines describe the rule but **not the consequence**. E.g. "Volume — séries por semana · Landmarks balanceados (defaults do sistema)". A PT thinks: "ok, but what happens if I change this?" There's no hint that this controls weekly set targets and volume warnings on the plan.
  - The 4 cards look identical and equally important — no priority order. Most PTs will only ever touch Intensity (RPE ceiling per tier) and Recovery (deload frequency); Volume landmarks and Progression increments are advanced.
  - "Customize rule" buttons all look the same regardless of whether the card is at default or already personalised. Once personalised, the card should show a clear "personalised" state.
- **Excel feeling:** **HIGH** when the side sheet opens and reveals 12×3 number inputs for muscle landmarks. Pure spreadsheet. Useful, but no PT will know if 8 sets MEV for biceps is normal without context.
- **Magic feeling:** none currently. Could be — show "your current rules differ from system default in 2 places" globally.
- **Minimal recommendation 1:** add one outcome phrase under each summary, e.g. "Controls weekly set targets and volume warnings on every plan."
- **Minimal recommendation 2:** mark which cards are commonly customised vs. rarely (a tiny "advanced" tag on Volume + Progression).
- **Do NOT:** add a wizard. Do NOT auto-suggest changes. PKL must remain explicit.

---

### 8. RationaleChip system (`src/components/ux/RationaleChip.tsx`)

- **Job:** explain why a value was chosen.
- **Trust signals:** tone dot (emerald/amber/grey) is honest signal.
- **Doubt signals:**
  - The chip is small (24px) and easy to overlook. On wide cards, users miss it. On chips next to a label, it competes with the label visually.
  - Same chip used for "confident · derived from goal" and "manual" — the user has to open the popover to discover which.
  - The popover content is text-heavy and uses i18n keys that fall back to a generic phrase if not translated → on ES/HI users get the same generic line every time, which makes the system look broken in those locales.
- **Likely ignored:** chips on cockpit knobs when knobs are expanded — too many chips at once.
- **Likely useful:** chip next to the tier value in BriefEditor — that's exactly the moment a PT wants to know "why advanced?".
- **Minimal recommendation:** vary the dot colour by source as well as confidence (assessment = amber, pkl = blue, default = grey, user = filled). Same shape, more pre-popover signal.
- **Do NOT:** put a chip on every value. Reserve for **inferred** decisions, not measured/user-entered ones.

---

### 9. Logbook `/log/$token` (391 LOC)

- **Job:** client (or PT-as-client) logs a session in 30 seconds.
- **Mental model:** "tick boxes per set, save". Honest and well-targeted.
- **Trust signals:** auto-save state, streak, "Sessão registada 💪" confirmation, confetti on PR.
- **Doubt signals / friction:**
  - The week + day + date selector at the top is a 3-dropdown row that looks like a desktop spreadsheet on mobile. On 375px iOS Safari this likely wraps awkwardly.
  - Day dropdown shows `day_label · focus` — `day_label` is "Day 1" / "Day 2" which is generic; once focus is present the day label is redundant.
  - Logbook mode chip (Force / Hipertrofia / Cardio) is tiny and lives **after** the date row — easy to miss. This is one of the most expensive inferences in the product right now and gets ~4mm of vertical space.
  - "Treinaste com a folha impressa? Tira foto..." (OCR import) is an amazing magic moment but reads as a dashed footnote.
- **Excel feeling:** medium — the `ExerciseSetsCard` repeats the same 4-column row per set. This is fine because that **is** what logging is, but the visual rhythm is monotonous.
- **Magic feeling:**
  - OCR import = highest-leverage magic on the platform, currently buried.
  - Confetti + PR detection = strong but only fires occasionally.
- **AI suspicion:** none in logbook (good — it's pure capture).
- **Minimal recommendation 1:** promote the OCR button to a dedicated CTA at the top of the log, not a footnote. "Print the PDF, train, photograph, import." That's the loop.
- **Minimal recommendation 2:** if `day.focus` exists, replace the "Day N" label with the focus name in the dropdown.
- **Do NOT:** add per-set RPE/RIR/notes inputs as required fields. Keep the minimum log = sets done. Optional fields only.

---

### 10. Program Next Week flow (`<NextWeekCard/>`, `programNextWeek`)

- **Job:** turn last week's logs into next week's plan.
- **Mental model:** "the system reads my logs and adapts." This **is** the moat.
- **Trust signals:** adherence threshold (≥80%), explicit autoreg_strictness rule, deterministic.
- **Doubt signals:**
  - When it succeeds, the user gets a new week — but does the UI **show what changed**? If not, the magic is invisible. The user will think "it just made next week, like a calendar".
  - When it fails with "low_adherence", the inline error needs to read like coaching ("only 4 of 6 sessions logged — log the missing days first") not like an API error.
- **Minimal recommendation:** after `programNextWeek` succeeds, show a 3-line diff at the top of the new week: "Squat reduced 5% (RPE 8.7 → target 8.0). Pull-ups added 1 set. Other lifts unchanged."
- **Do NOT:** ever re-introduce AI here (memory rule).

---

### 11. PDF export

- **Job:** deliver a printable plan a PT can hand to a client.
- **Trust signals:** "Sessão N · Foco" labels (R64), capacity gain section in block N+1 PDFs (R38).
- **Doubt signals:** can't audit visually here; based on memory PDF spec is amber/serif. The risk is the PDF is *too* design-heavy and a serious PT wants something they can mark up. Optional "ink-saver" variant could be a quick win — parked.
- **Minimal recommendation:** add a small footer line per session: "Generated from {brief id} · cockpit: {preset} · rules v{N}". Auditability badge for serious PTs.

---

### 12. Trainee view `/me` (200 LOC)

- **Job:** client sees their own plan + week.
- **Mental model:** "my coach app." Clean.
- **Trust signals:** amber gradient hero with plan + block, weekly day list with done-state, recent sessions.
- **Doubt signals:**
  - "Sessão 1" / "Sessão 2" labels with optional focus — same redundancy as logbook.
  - No CTA to log. The page is pure read-only and footer says "Mais funções em breve". A client opening this and finding no action will close it after one visit.
  - "Ligue a sua conta" empty state is friendly but the next step ("ask trainer for a new questionnaire link") creates support burden.
- **Magic feeling:** could surface "your last 3 sessions improved 4% on Squat" — same data exists.
- **Minimal recommendation:** add a single CTA on each weekday row that opens the trainer's `/log/$token` for that day. Even if it's the same shared link, the CTA closes the loop.
- **Do NOT:** build a full client app yet.

---

### 13. Settings, Admin, Billing, Schedule

- **Settings:** standard; not a friction source.
- **Admin system page:** for the founder; not user-facing.
- **Billing:** clean per memory; trust depends on Stripe integration showing real prices in EUR, which is enforced.
- **Schedule (`schedule.tsx`, `schedule.packs.tsx`):** R28 v1. Likely minimal — a timetable + revenue panel + packs. Risk: if it looks like Google Calendar Lite, it weakens the "operating system" feeling. Not the round to fix.

---

### 14. Client intake `/intake/$token`

- **Job:** client fills assessment.
- **Trust signals:** clean form, regional names, photo upload.
- **Doubt signals:** intake completion is the gating event for everything downstream — the dashboard does not currently show "X clients sent intake but have not completed". This is a missed retention metric.
- **Minimal recommendation:** dashboard ribbon item: "2 intakes pending · last reminder 3 days ago".

---

### 15. Mobile 375px

- The plan page (`plans.$planId.tsx` 1958 LOC) and client profile (4136 LOC) are the highest risk for 375px overflow.
- Logbook header 3-dropdown row will wrap unevenly.
- BriefEditor mode toggle (Quick / Lab) is 2-col grid — fine.
- Cockpit summary line + presets + manual control button — likely fine, would benefit from snapshot screenshots.

---

## Part 2 — Special deep-dives

### Deep-dive 1 — "Old Excel" feeling, ranked

| Surface | What feels Excel | Why it hurts | Class |
|---|---|---|---|
| `/knowledge` Volume side-sheet | 12×3 numeric grid | No context, no consequence shown | Needs protocol framing + needs default simplification |
| `/plans/$id` MesocycleTableView | Dense per-week grid | Static prescription, no actual overlay yet (R55 pending) | Needs visualization (blue actual line) |
| BriefEditor "emphasis_split" | 3 number inputs summing to 1 | No PT thinks in 0.05 increments | Needs default simplification (segmented slider) |
| `/log/$token` 3-dropdown header | Spreadsheet-style row | Mobile-hostile | Needs default simplification (one focus chip + edit) |
| Cockpit knob grid (when expanded) | 5 selects | Settings-feel | Good spreadsheet — keep, but reorder summary first |
| `/clients/$clientId` (suspected) | Stacked sections | LOC count alone implies wall-of-form | Needs protocol framing + collapse-by-default |

### Deep-dive 2 — Magic moments (existing + adjacent)

| Moment | Status | Why it works | How to amplify |
|---|---|---|---|
| `programNextWeek` adapts week from RPE drift | Built, invisible | Closes the loop | Show 3-line diff |
| OCR photo → log import | Built, buried | Removes a real chore | Promote to top of `/log` |
| Block N+1 capacity gain card | Built, prominent | Concrete progress proof | Keep as-is |
| Tier "remedial · 2 red flags" inference | Built | First sign the system *thinks* | Keep |
| Dropoff alerts on dashboard | Built | "Coach, look here" | Promote to top ribbon |
| Rotation-audit chip "Rotação 73%" | Built | Honest auditability | Keep |
| PR confetti | Built (R54) | Emotional close on a session | Keep |
| Adherence + RPE drift insight on plan view | Partial | The coach reflex | Verbalise it ("your client is over-shooting RPE on lower body") |

### Deep-dive 3 — AI trust labels

The product needs **provenance labels**, not more rationale text. Every value falls into one bucket:

| Class | Label | Visual | Where used |
|---|---|---|---|
| Measured | (no chip — measurement IS the label) | Plain number | Logged sets, weights |
| User-entered | (no chip) | Plain | Brief fields the user typed |
| Inferred | grey dot + "Inferred" | RationaleChip | Tier, split, focus, logbook mode |
| Deterministic | blue dot + "Computed" | small subscript | Stage 4 progressions, deload week |
| AI-generated | amber dot + "Drafted by AI" | RationaleChip | Stage 2/3 outputs only |
| PKL-default | filled grey + "From your rules" | RationaleChip | Knowledge cards |

Today the product mostly conflates inferred + AI-generated under one chip. Splitting these visually is the single highest trust win.

### Deep-dive 4 — Measurements (planned, not built)

Default vs advanced split (proposed):

| Measurement | Default? | PT value | Client value | Error risk | Graph? | AI insight? |
|---|---|---|---|---|---|---|
| Weight | yes | high | high | low | yes | trend, recomp signal |
| Waist | yes | high | high | low–med | yes | recomp signal w/ weight |
| Progress photos | yes | high | high | low | side-by-side | qualitative only |
| Hip | yes | med | med | low–med | yes | ratio with waist |
| Chest / arm / thigh | yes | med | med | med | yes | hypertrophy proxy |
| Notes | yes | high | high | none | no | flag mining |
| Subjective recovery 1–10 | advanced | high | low | none | yes | adherence cue |
| Sleep quality 1–10 | advanced | high | low | none | yes | recovery layer |
| Resting HR | advanced | med | low | low | yes | recovery layer |
| Blood pressure | advanced | high (HTA pop.) | med | med | yes | red flag |
| Plank / dead hang | advanced | med | low | med | yes | capacity |
| Skinfolds | advanced | med | low | high | maybe | rarely |
| VO2max estimate | advanced | high | med | high | yes | credibility |

Required system manners:
- Body diagram with where to measure (drawn once, reused).
- "Tape measurements have ±1.5cm noise — interpret trends across ≥3 weeks." text once per page.
- Honest language: "trend suggests", "consistent with", never "you lost X kg fat".
- L/R asymmetry only when both sides are entered — don't ask twice if not used.

### Deep-dive 5 — Logbook + next week intelligence

**Minimum viable log (already there, mostly):** sets done · reps done · weight · session done flag.

**Highest-value optional signals (rank order):**
1. Per-exercise RPE on last set — feeds `programNextWeek`. Already there.
2. Pain flag (binary per exercise) — feeds red-flag accommodation. Not surfaced.
3. Skipped / substituted — feeds rotation logic. Already in OCR but not in manual.
4. Session duration — soft signal for adherence quality.
5. Subjective recovery next morning — separate logbook surface, not session-bound.

**What should feed `programNextWeek`:** RPE drift (built), pain flag, skip/substitution, adherence %.
**What should feed insights only:** session duration, recovery score, notes mining.
**What should NOT be required:** anything beyond sets/reps/weight per set.

### Deep-dive 6 — PT operations layer (still mostly missing)

| Area | Build now? | Default? | Retention impact | Coach workflow impact |
|---|---|---|---|---|
| Sessions used / remaining per pack | already in schedule.packs (R28) | default | high | high |
| Last session date / next session | partial | default | high | high |
| Birthdays | built (dashboard) | default | low | low |
| Payment status | parked | advanced | med | med |
| Reassessment reminder | not built | default | high | high |
| Injury/restriction sticky note | partial via brief | default | high | high |
| Communication log | not built | advanced | high | high |
| Equipment available per client | brief field | default | low | med |
| Client preferences (time, location) | partial | default | med | high |

Top operational gap: **reassessment reminder + sticky injury card**. These are 2-day builds and produce a "this app actually thinks like a coach" feeling.

### Deep-dive 7 — Landing value proposition gaps

- Strongest section: hero + brand mark.
- Weakest section: between hero and pricing — there is no visual proof of the loop.
- Missing proof: a 5-step strip with real screenshots from the actual app (intake card, brief screen, PDF page, log page, next-week diff).
- Mock problems: hero mockup carries everything.
- Why-better-than-Excel: not stated. One line would help: "Excel doesn't read your logs and adjust next week."
- Why-better-than-ChatGPT: not stated. One line: "ChatGPT can't show its sources or version your rules."

### Deep-dive 8 — Button copy audit

| Current label | Risk | Recommended |
|---|---|---|
| "Generate" | implies AI cost / lock | "Generate plan (uses 1 of {N} this month)" |
| "Approve and continue" | irreversible-feeling | "Lock stage and continue" |
| "Bulk fill" | meaningless to PTs | "Build remaining weeks (no AI)" |
| "Customize rule" | OK now (R56) | keep |
| "Manual control" | OK | keep |
| "Program next week" | abstract | "Build next week from logs" |
| "Invite client" | clear | keep |
| "Rotate demo year" | unclear (admin only) | keep, gate to founder |
| "Send link" | OK | keep |
| "Add manually" | OK | keep |

Top three to relabel: **Approve and continue**, **Bulk fill**, **Program next week**.

### Deep-dive 9 — Certainty calibration

| Implies false certainty | Surface | Honest language |
|---|---|---|
| Capacity gain Δ% per pattern | CapacityGainCard | "estimated, based on logged top sets" |
| Adherence % single number | dashboard / plan | OK — measured |
| PR detection on bodyweight/hold | logbook | "PR (estimated)" — backlog #65 |
| RPE drift adjustment | NextWeekCard | already cautious; OK |
| PKL-derived volume targets | knowledge card summaries | "starting point, refine over 6 weeks" |
| Tier inference | brief | "based on what we know now" |

Where stronger certainty IS appropriate: completed sessions, prescribed sets, dates, package status, payments.

### Deep-dive 10 — Data → insight fusion (fastest wins)

| Insight | Data needed | Built? | Where to surface |
|---|---|---|---|
| Recomp signal (weight stable, waist down) | measurements 3+ weeks | not built | client profile hero |
| Under-recovery (RPE drift up + adherence dropping) | logs | partial | NextWeekCard error |
| Exercise-specific overload | per-exercise RPE drift | partial | plan page exercise card |
| Pain trend on a specific lift | log pain flag | not built | plan page |
| Cardio improvement (HR↓ at same load) | needs HR — out of scope today | no | future |
| Plateau detection (e1RM flat 3+ weeks) | logs | partial | YearView |
| Disengagement risk (gap in logs) | DropoffAlerts | built | dashboard top ribbon |
| Reassessment due | client.created_at + last assessment | not built | dashboard ribbon |
| Adherence pattern by weekday | logs | not built | client profile, low priority |

---

## Part 3 — Top 10 highest-leverage UX improvements (ranked)

Each: impact · difficulty · confidence · trust / retention / usability / perceived intelligence / scientific rigor / PT speed.

| # | Improvement | Impact | Diff | Conf | Trust | Retn | Use | PI | Sci | Speed |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | "What changed" diff after `programNextWeek` (3 lines: lift · change · reason) | high | low | high | yes | yes | yes | **yes** | yes | no |
| 2 | Provenance dot palette: split inferred / AI-drafted / deterministic / PKL on the chip itself | high | low | high | **yes** | no | yes | yes | yes | no |
| 3 | Dashboard "Today" ribbon (dropoff + intake-pending + reassessment-due) above all panels | high | low | high | yes | **yes** | yes | yes | no | **yes** |
| 4 | One outcome phrase under each `/knowledge` summary card ("Controls weekly set targets…") | high | low | high | yes | no | **yes** | yes | yes | no |
| 5 | Promote OCR import to top CTA of `/log/$token` (currently a footnote) | high | low | high | no | yes | yes | yes | no | **yes** |
| 6 | Per-stage "what this step does + what it costs" subtitle in plan workbench | med-high | low | high | **yes** | no | yes | yes | yes | yes |
| 7 | Replace "Bulk fill" / "Approve and continue" / "Program next week" copy with concrete, cost-aware labels | med-high | low | high | yes | no | **yes** | no | no | yes |
| 8 | `/clients/$id` collapse-by-default with designed 1-line summaries per section (no tabs, just `<details>`) | high | med | med | no | yes | **yes** | no | no | **yes** |
| 9 | Cockpit hierarchy flip — summary line as headline, presets as supporting chips, knob-change pulse on preset switch | med | low | high | yes | no | yes | **yes** | no | no |
| 10 | Reassessment-due reminder (12 weeks since last assessment) on dashboard | med | low | high | **yes** | **yes** | yes | yes | yes | yes |

## Part 4 — Top 10 "do not build yet"

1. Native mobile app (current PWA via /me is enough).
2. Calendar sync (Google/Apple) — already parked.
3. Stripe pack billing automation.
4. AI chat assistant on every page (Atlas already overreaches).
5. Per-session client RPE rating sliders (will hurt log speed).
6. Skinfold body comp inputs (high error, low signal).
7. Custom plan templates marketplace.
8. Multi-trainer / studio roles.
9. Public PT directory.
10. Macro/nutrition module beyond hints.

## Part 5 — Top 10 risks to product value

1. Magic moments invisible (`programNextWeek` diff, OCR import, rotation audit).
2. RationaleChip reads as decorative when over-applied to non-inferred values.
3. `/clients/$id` is a 4k LOC monolith — first-run perceived complexity.
4. Knowledge page reads as settings, not as protocol.
5. Cockpit jargon in tradeoff knob options.
6. Logbook focus chip too small; OCR buried.
7. Landing has no proof of the full loop.
8. Plan page header crowded with cards (block, capacity, next-week, validation, rotation, main-lift swap).
9. Trainee `/me` has no action (read-only dead end for clients).
10. Mobile 375px untested on the heaviest routes.

## Part 6 — Top 10 strongest existing assets

1. Phased generation pipeline with explicit stage boundaries.
2. Deterministic Stage 4 (no AI in progressions = no hallucination).
3. `programNextWeek` adaptation logic.
4. PKL versioning + per-plan rule snapshot.
5. Capacity gain Δ% across blocks.
6. Rotation audit + main-lift swap auditing.
7. RationaleChip primitive (right idea, needs sharper provenance).
8. PDF with "Sessão N · Foco" naming.
9. Honest pricing tiers tied to client caps.
10. PT-PT voice + brand mark + amber identity.

## Part 7 — Recommended next 3 implementation rounds

Each small, coherent, low-risk. No engine changes.

**Round A — "Make the magic visible" (UI only)**
- `programNextWeek` diff card with 3-line summary of what changed and why.
- Promote OCR import to top of `/log/$token`.
- Add per-stage subtitle in plan workbench (one phrase each, all i18n).

**Round B — "Provenance, not just rationale" (UI + 1 component refactor)**
- Extend `RationaleChip` dot to encode source (inferred / deterministic / AI-drafted / PKL / user) on top of confidence.
- Apply across cockpit, brief, knowledge, plan page.
- Add outcome phrase under each `/knowledge` card.

**Round C — "Today" (dashboard surfacing only)**
- Top ribbon on `/dashboard`: dropoff alerts + pending intakes + reassessment-due.
- Demote onboarding checklist to collapsible after 3 clients.
- Relabel three buttons (Bulk fill, Approve and continue, Program next week).

After these three rounds the product should feel **measurably more intelligent** without any engine, schema, or generation change.

---

*End of audit. Implementation requires explicit go-ahead per round.*
