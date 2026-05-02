# FORGE — New logo + landing proof + AI model picker

## 1. New brand mark (replace `forge-logo.png`)

Generate a fresh logo via Lovable AI image gen (`google/gemini-3-pro-image-preview`) using a refined version of the user's brief:

> Minimalist premium SaaS app icon for "FORGE". A simple geometric hammer striking a clean modular block from above. Three small amber sparks (#D4A24C / #E8A547) at the impact point, arranged asymmetrically. Hammer and block in monochrome (deep graphite #1C1C1E on transparent for light mode + warm cream variant for dark). Sharp 90° geometry, thin stroke weights, generous negative space. Squared 1024×1024, transparent background, centered with safe margin. No text, no anvil, no medieval ornament, no gradients on the hammer itself — only the sparks carry the amber accent. High-end fintech / scientific instrument feel.

Pipeline:
- Run AI gen → save to `src/assets/forge-logo.png` (overwrite). Also save `forge-logo-mark.png` (mark only) for icon use.
- Refresh favicon in `public/` if a separate file exists.
- Keep `<Logo />` and `<BrandMark />` APIs untouched — the auto luminance detection already handles light/dark.
- QA: render in `BrandMark sm/md/lg` on dark + light, verify no clipping, sparks visible at 28px.

## 2. Landing page — show the inner workings

Add **two new mockup sections** above pricing in `src/routes/index.tsx`, mirroring real screens:

### a) "The Workbench" (intelligent coaching assistant)
A mocked panel showing:
- Chat-style messages between coach and AI ("Cliente queixa-se de dor lombar no agachamento — sugere regressão"), AI reply with a structured suggestion card (exercise swap + rationale + cited principle).
- Side rail: client context chips (goal, phase, last session RPE).
- Bottom: model picker pill + credits remaining.

Component: new `WorkbenchMockup` in `src/components/landing/WorkbenchMockup.tsx`.

### b) "The Logbook, intelligently read"
Reuses existing `SetLogMockup` + a new mini "AI insights" card that lists 2–3 deltas the AI surfaced from the log (e.g. "Bench velocity ↓ 8% over 3 sessions — deload week suggested"). Reinforces the "logbook + AI workbench" pitch.

Both sections get an eyebrow, title, subtitle, and i18n keys in `src/i18n/locales/{pt,en}/plan.json` under `landing.workbench` and `landing.logbook_insights`.

## 3. AI model picker (user-facing)

Mirror the OpenAI/Claude UX inside the Workbench: a dropdown listing the Lovable AI models the coach can pick per request, with a credit-cost chip per model.

### UI
- New `<ModelPicker />` component (`src/components/ai/ModelPicker.tsx`): shadcn DropdownMenu showing model name, one-line description, and credit cost (e.g. "Flash · 1 cr", "Pro · 5 cr", "GPT-5 · 8 cr").
- Persist selection in `localStorage` + a `useModelPreference()` hook so it sticks across sessions.
- Surface remaining credits next to it (reads from existing billing/quota source if available; otherwise placeholder "—" with tooltip "Linked to your plan").

### Wiring
- Add an optional `model` field to the body of existing AI server functions (`src/server/intake-ai.functions.ts`, plan generation, etc.); validate against an allow-list constant `ALLOWED_MODELS` in `src/lib/ai-models.ts`. Default stays `google/gemini-3-flash-preview`.
- Display the picker in the Workbench mockup on landing (static, non-functional preview) AND in the real coach UI where AI is invoked (compact variant in plan editor / assistant panel headers — non-blocking iteration; if a slot doesn't exist yet, ship the constant + component and stub one inside the assistant panel).

### Allow-list (initial)
```ts
[
  { id: "google/gemini-3-flash-preview", label: "Flash", credits: 1, tier: "fast" },
  { id: "google/gemini-2.5-pro",          label: "Gemini Pro", credits: 4, tier: "balanced" },
  { id: "openai/gpt-5-mini",              label: "GPT-5 mini", credits: 3, tier: "balanced" },
  { id: "openai/gpt-5",                   label: "GPT-5", credits: 8, tier: "deep" },
]
```

## 4. Memory updates
- Add `mem://design/brand-mark` rule: "FORGE mark = geometric hammer + cubic block + 3 amber sparks (#D4A24C). Never anvil, never medieval. Sparks are the only chromatic element."
- Update `mem://index.md` Core line to reference the new mark.

## Files

**Created**
- `src/components/landing/WorkbenchMockup.tsx`
- `src/components/landing/LogbookInsightsMockup.tsx`
- `src/components/ai/ModelPicker.tsx`
- `src/hooks/use-model-preference.ts`
- `src/lib/ai-models.ts`
- `mem/design/brand-mark.md`

**Edited**
- `src/assets/forge-logo.png` (regenerated)
- `src/routes/index.tsx` (new sections + picker preview)
- `src/i18n/locales/{pt,en}/plan.json`
- `src/server/intake-ai.functions.ts` + any other AI server fn (accept optional `model`)
- `mem/index.md`

## Out of scope (this turn)
- Real per-user credit metering tied to model cost (current quota system stays plan-based; cost chips are advisory).
- PDF logo refresh (kept text-only per existing rule).
