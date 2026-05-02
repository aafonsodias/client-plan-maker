# Redteam + plan: currency fix, logo unification, landing page revamp

## Part A — Redteam of the prompt

**1. "Clicking $ doesn't change currency" — root cause is a real bug, not just polish.**
`CurrencyMenu` wraps its child in `<PopoverTrigger asChild>` with a `<span>`, and the children we pass in (the header `$` icon button and the `PriceTag`) are themselves `<button>` elements. That nests `<button>` inside `<button>` (or inside an interactive trigger), which React/Radix handles inconsistently — the inner button swallows the click in some browsers and the popover never gets a "selection committed" signal that re-renders the trigger. Net effect for the user: menu opens, selection sometimes doesn't apply, prices on the page don't update. **Fix is structural, not cosmetic.**

**2. "Doesn't change the prices on the landing page" — likely the same issue, plus the prices are mid-page and the user may not scroll down to verify.**
The `PriceTag` *does* subscribe to `useCurrency()`, so once selection commits it should re-render. We'll verify after fixing the nested-button issue. We'll also add a tiny visible confirmation (the trigger shows the active currency code, e.g. `€` / `$` / `₿`) so the user immediately sees the switch worked without scrolling.

**3. "Uniformize the FORGE circle everywhere" — needs scoping or it explodes.**
The amber under-glow ring lives only in `AppShell` header. Other places that render `<Logo>`: landing page header + footer, auth page, intake page, log page, possibly PDF. Blindly applying the ring everywhere risks: (a) ring on the PDF (bad — print artifact), (b) ring on tiny 24px logos (looks like a smudge), (c) ring on the favicon-style footer logo (visual noise). **Plan: extract a `<BrandMark size="sm|md|lg" glow?>` component, default `glow=true` for header sizes (≥28px), `glow=false` for footer/PDF/intake.** Don't just copy the inline style.

**4. "Reverse-engineer the landing page from the end vision (logbook → graphs → trends → AI advice → prompt-driven adjustments)" — this is the dangerous one.**
Real risks if we just rewrite the page:
- **Promising what doesn't exist.** Graphs, trend detection, AI prompt-driven plan adjustments, advice engine — none of those are built. Putting them on the landing page as if they're live = false advertising and erodes trust the moment a user signs up and doesn't find them.
- **Scope creep masquerading as marketing.** "Let's revamp the landing page" can quietly turn into "let's build the product roadmap." We should separate (i) **what the landing page promises today** from (ii) **the public roadmap** ("coming next") section, clearly labelled, no CTAs on unbuilt features.
- **Killing what works.** The current "How it works" animation, founder note, credibility cards, and pricing all do real conversion work. A full rewrite throws that away. Better: **restructure around the journey, keep the parts that earn their place.**
- **The journey IS the product story.** The 5-stage phased generation (intake → brief → blueprint → microcycle → progressions → ready plan) is genuinely the differentiator. The landing page should mirror it: same stages, same vocabulary, so when the user lands inside the app it feels like the brochure came alive. **This is the real insight to lean into.**
- **Logbook-as-hook, not logbook-as-feature.** Per existing project memory: free = 1 plan, paid = logging + history + progressions. The landing page should make logging the emotional hook ("see your progress, get nudges, adjust on the fly"), not a feature bullet.

**5. Honest labelling.** Anything not built today gets a `Soon` chip. No fake screenshots. No fake graph data unless it's clearly stylised as a preview mock with a caption like "preview of upcoming logbook trends".

---

## Part B — What I'll build

### B.1 Fix the currency switcher (Wave 1 — small, ships first)

**Root cause fix in `src/components/CurrencyMenu.tsx`:**
- Remove the wrapping `<span>` in `<PopoverTrigger asChild>`; render children directly via `asChild` and require the consumer to pass a single focusable element (button).
- Stop nesting buttons. Update consumers:
  - `src/components/PriceTag.tsx`: when `interactive`, the `PriceTag` IS the trigger button — pass it directly to `<PopoverTrigger asChild>` instead of wrapping.
  - `src/routes/index.tsx` header `$` icon: same — the icon button IS the trigger.
- Keep the right-click affordance via an `onContextMenu` on the trigger button itself.
- After selection, force the popover to close (`setOpen(false)` already there) and verify the context updates via a small `useEffect` test render.

**Visible confirmation (so the user trusts the switch worked):**
- Header trigger shows the active currency symbol (`€` / `$` / `₿`) instead of always `$`. So picking USD changes the header icon to `$`, EUR to `€`, BTC to `₿`. Tiny but solves the "I don't know if it worked" complaint.
- `PriceTag` already re-renders from context — once the bug above is fixed, the landing page prices (Beta `0` and Pro `19`) will switch live.

**Acceptance check:** open landing page → click `$` → pick USD → header symbol becomes `$`, Pro card shows `$~21`, Beta card shows `$0`. Reload page → selection persists.

### B.2 Unify the FORGE glow (Wave 1)

- New component `src/components/BrandMark.tsx` with `size` (`sm` 24px, `md` 32px, `lg` 40px) and `glow` (default: true for `md`+, false for `sm`).
- Replace inline-styled logo wrappers in:
  - `AppShell.tsx` header → `<BrandMark size="md" glow />`
  - `src/routes/index.tsx` landing header → `<BrandMark size="md" glow />`
  - `src/routes/index.tsx` landing footer → `<BrandMark size="sm" />` (no glow, intentional — small + on a darker strip)
  - `src/routes/auth.tsx` → `<BrandMark size="lg" glow />`
  - `src/routes/intake.$token.tsx` and `src/routes/log.$token.tsx` → `<BrandMark size="md" glow />`
- **Do NOT** touch PDF rendering (`src/lib/pdf.ts`) — print should stay flat.

### B.3 Landing-page revamp (Wave 2 — the big piece)

Structure mirrors the in-app journey. New section order:

```text
1. Hero                       (kept, light copy refresh)
2. The journey                (NEW — 5-stage horizontal scroll, mirrors Stage 1→5)
3. From assessment to plan    (kept "How it works" animation, repositioned as Stage 1–5 deep-dive)
4. Built on the science       (kept — credibility)
5. The plan you'll get        (kept — hero plan mockup repositioned)
6. After the PDF: the logbook (NEW — preview mock of logging + trend chart, "Soon" chip on graph)
7. Pricing                    (kept, clarify free = 1 plan)
8. Roadmap (Soon)             (NEW — small honest list of what's next)
9. Founder note               (kept)
10. FAQ                       (kept, +2 questions on logging/quota)
11. Closing CTA + footer      (kept)
```

**New section: "The journey" (Section 2).**
A 5-stage strip — Intake · Brief · Blueprint · Microcycle · Progressions — using the same vocabulary as the app. Each stage = 1 line of plain Portuguese/English copy + tiny icon. Click a stage → scrolls to the matching deep-dive in Section 3. This is what makes the brochure feel like the app.

**New section: "After the PDF: the logbook" (Section 6).**
Two-column:
- Left: stylised mock of a session log (sets, reps, RPE, a quick "felt heavy today" note). Built with real components (no fake screenshot image), but with placeholder data clearly captioned as preview.
- Right: stylised trend graph (1 lift over 6 weeks) with a `Soon` chip. Caption: "Trend lines and AI nudges coming next — your logs already feed the engine."
- One-line copy: "PDF é o ponto de partida. O logbook é o que torna o plano vivo." / "The PDF is where it starts. The logbook is what keeps the plan alive."

**New section: "Roadmap" (Section 8) — honest, no CTAs.**
Three small cards, each with a `Soon` chip:
- "Tendências e gráficos" / "Trends & graphs" — auto-detect plateaus, show progress per movement pattern.
- "Ajustes por prompt" / "Prompt-driven adjustments" — describe a tweak in plain language, the plan adjusts.
- "Coach AI advice" — weekly nudges based on logged sessions (deload, intensify, swap variation).

These mirror the user's stated vision but are clearly labelled as future work. **No "Notify me" CTA on each — the existing Pro `mailto` covers it**; one note at the bottom of the section: "Subscreve o Pro para entrar na primeira leva." / "Subscribe Pro to be in the first wave."

**FAQ additions (Section 10):**
- "O que tenho de pagar para começar?" / "What do I have to pay to start?" → 1 plano grátis por conta, log incluído nesse plano, depois Pro.
- "Os meus dados ficam guardados se cancelar?" / "What happens to my data if I cancel?" → kept, exportable, no lock-in.

### B.4 i18n

All new copy lands in `src/i18n/locales/{pt,en}/plan.json` under `landing.journey.*`, `landing.logbook.*`, `landing.roadmap.*`, plus 2 new FAQ keys. Symbol-only strings (`€`, `$`, `₿`) live in `currency.symbol_*` in `common.json`.

### B.5 Out of scope (flagged for next wave)

- Building the actual logbook trend graph engine (Recharts component reading `workout_sessions`).
- Building prompt-driven plan adjustments (this is a Stage 6 — needs a new server function + LLM call + diff UI).
- Building the AI weekly-nudge digest (cron + edge function + email; we already have `weekly-digest.ts` scaffolding to extend).
- Stripe/Paddle wiring. Pro stays `mailto` until that decision lands.

---

## Part C — Technical notes

- **Currency fix is purely a JSX/Radix structure change** — no schema, no server work, no FX-rate change. Touches 2 files (`CurrencyMenu.tsx`, `PriceTag.tsx`) + 1 site (`index.tsx` header trigger).
- **`BrandMark` extraction is a refactor** — same visual output where glow already exists, new visual where it didn't. Six call sites updated. PDF deliberately untouched.
- **Landing revamp is additive** — three new sections inserted into `src/routes/index.tsx`, two existing sections re-ordered, none deleted. No new routes, no new server functions, no DB changes.
- **`Soon` chip** = small reusable inline component (or just a Tailwind class set + i18n string), defined locally in `index.tsx`. No new dependency.
- **Logbook preview mock** uses existing `Card` + a stylised inline SVG line (no new chart library). Clearly captioned as preview to avoid promising live data.
- **Memory updates:** add a Core line — "Landing page mirrors the 5-stage app journey; never advertise unbuilt features without a Soon chip." Add a memory file `mem://design/brandmark` documenting glow rules.

## Part D — One open question

For the Roadmap section copy, do you prefer:
- **(a)** plainspoken and humble ("ainda não, mas vem aí" / "not yet, but coming") — my recommendation, matches the founder voice, or
- **(b)** more aspirational/bold ("a próxima geração de coaching" / "the next generation of coaching") — sells harder, risks sounding like vapourware.

Defaulting to (a) unless you say otherwise. Approve the plan and I'll execute Wave 1 (currency fix + brandmark) and Wave 2 (landing revamp) in one pass.
