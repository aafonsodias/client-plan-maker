Assessment screen refactor - mobile-first, low-credit pass

Narrow, surgical pass. No new design system, no route rewrite, no schema changes, no renaming of existing section ids.

Goal:

Refactor the assessment screen to be more efficient on mobile, remove redundant UI/status copy, add “Lesões e dor” as step 1/15, guarantee one vertical page scroll, and lightly improve dark theme hierarchy.

1. Step model - add “Lesões e dor” as 1/15

SECTIONS is module-level in src/routes/clients_.$clientId.tsx, so t() is not available there.

Use stable ids + labelKey at module level:

const SECTIONS = [

  { id: "injuries", labelKey: "sections.injuries", group: "self_intake" },

  { id: "parq", labelKey: "sections.parq", group: "self_intake" },

  ...

];

Resolve labels at render sites:

Use labelKey when present, otherwise fall back to the existing label string:

t(section.labelKey ?? section.label)

Apply this wherever section labels render: stepper, header, mini-card, mobile header.

Final order:

injuries → parq → risk → training → history → goal → meds → readiness → lifestyle → nutrition → anthro → mobility → posture → screen → performance

15 total.

Rules:

- Keep all existing ids stable.

- Do not rename existing section ids.

- Use id: "injuries" only for the new section.

- Deep-links and stored progress must survive.

- Move existing injuries/pain UI from the training block into a new InjuriesSection rendered before PAR-Q+.

- Remove the old injuries/pain rendering from the training/setup block completely.

- There must be exactly one visible injuries/pain section.

- Injuries is required. Do not add it to OPTIONAL_SECTIONS.

no_injuries persistence:

Persist no_injuries inside an existing flexible JSON assessment/intake payload.

Preferred:

Use [assessment.no](http://assessment.no)_injuries if the current assessment object is already flexible JSON.

If generated DB table types are fixed:

Do not edit generated Supabase/DB types directly.

Do not add schema changes.

Do not add a DB column.

Update only app-level types/parsers/helpers around the flexible JSON payload.

If the patch path rejects unknown fields:

Look for an existing flexible assessment/intake JSON object, e.g. extended, meta, intake, where no_injuries can be stored without schema changes.

Last resort only:

Use an internal sentinel inside the injuries field, kept hidden.

Never surface that sentinel as client-written clinical text in any UI, PDF, or AI prompt.

Update only app-level TypeScript types, form state types, Zod/validation helpers, default assessment object, dirty-state logic, and patch payload builders needed for no_injuries to typecheck.

Completion rule:

The injuries section is complete if:

injuries text is non-empty OR pain_areas?.length > 0 OR no_injuries === true

Use optional-safe checks such as pain_areas?.length > 0 so missing legacy fields do not crash older assessments.

i18n:

Add labels in:

src/i18n/locales/pt/assessment.json

src/i18n/locales/en/assessment.json

ES/HI should fall back per existing project policy.

2. Mobile shell - reclaim vertical space

On < 768px, above the first input, render only:

1. Back link

2. Minimum client identity strip - name + single invite/status chip

3. Sticky MobileStepHeader

4. Content

The mobile identity strip replaces the identity/status part that the hero used to provide.

Render it explicitly in the route.

Do not extract it from ClientStageOneHero.

Do not modify ClientStageOneHero.tsx.

Important:

On mobile, the minimum client identity strip may include the single invite/status strip.

Do not render a second separate invite/status strip below it.

Status must appear once only.

Hide on mobile via route call-site responsive classes:

- ClientStageOneHero

- AUTO-AVALIAÇÃO DO CLIENTE group header

- horizontal step-chip strip

- duplicate step/progress badge in upper mini-card

- repeated section title on mobile only when the sticky header already shows it

Do not remove useful desktop section titles.

Create:

src/components/MobileStepHeader.tsx

MobileStepHeader requirements:

- mobile only

- sticky

- h-11

- blurred/surface background

- shows translated step label + title

- kebab/menu button opens the existing step Sheet

- no desktop navigation changes

- use i18n for the step prefix, not hardcoded PT copy

PT:

Passo X de 15 · Título

EN:

Step X of 15 · Title

3. Status redundancy - single source of truth

When invite is unopened, show once:

Convite pendente · Ainda não aberto · expira em 14d

Rules:

- Drop “Avaliação a decorrer” while unopened.

- Section title appears once: section header on desktop, sticky mobile header on mobile.

- Global progress belongs to the stepper only.

- Current section progress belongs to the section header only.

- Remove the third duplicate progress copy from the mini-card.

- PAR-Q alert chip renders only when count > 0.

- Never render “ALERTAS PAR-Q+: 0”.

4. Single vertical scroll

Audit the assessment subtree for:

overflow-y-auto

overflow-auto

h-screen

max-h-screen

ScrollArea

Line numbers are orientation hints only.

Search by component/class/pattern rather than relying on exact line numbers.

Rules:

- On mobile, only the document/page scrolls.

- No inner scrollbar in the assessment content.

- No horizontal overflow.

- Add overflow-x-hidden at the page root if not already present.

- Replace h-screen cascades with min-h-dvh where they affect the assessment page.

- Cards and form sections must use natural document flow, never internal scroll.

- Modal/Sheet overflow-y-auto is allowed as the only exception.

Known Sheet/modal scroll containers may remain if they are only inside the stepper Sheet.

5. Scroll cue - mobile only

Create:

src/components/ScrollCue.tsx

Requirements:

- fixed bottom-center

- bottom-6

- double chevron or elegant pill

- soft bounce/fade loop

- aria-hidden

- no text

- md:hidden

- hides when window.scrollY > 8

- local state per mount

- no sessionStorage

- cue returns on every fresh open, route mount, or reload

- within the same mount, it stays hidden after the first scroll

- respect prefers-reduced-motion: if enabled, render it static with no bounce/fade animation

- must not overlap sticky bottom navigation

- if bottom navigation is present, position the cue above it or hide it once the bottom navigation is visible

- ScrollCue should reset predictably on route/client change; key the component by clientId or current route section if needed

6. Theme polish - dark only

In src/styles.css, adjust dark tokens only.

Goal:

Dark theme should feel premium, readable, and clinical, not muddy.

Adjust:

- --background: slightly cooler charcoal

- --surface / --card: visibly lighter than background

- --border: lower opacity

- --foreground: higher contrast

- amber remains primary

- success/warning/danger remain restrained

Do not redesign light or medium themes.

Visual cleanup in the assessment route:

- remove redundant outlined chips inside already-bordered cards

- use space-y-3 for section bodies

- use mb-3 or gap-3 between sections

- reduce stacked labels before the first input

7. Files expected to change

Expected:

- src/routes/clients_.$clientId.tsx

- src/components/MobileStepHeader.tsx

- src/components/ScrollCue.tsx

- src/styles.css

- src/i18n/locales/pt/assessment.json

- src/i18n/locales/en/assessment.json

- app-level TS/Zod/form/patch helpers needed for no_injuries to typecheck

Do not modify ClientStageOneHero.tsx unless absolutely necessary.

Preferred approach: hide it at the route call-site and re-render identity explicitly in the mobile shell.

8. Out of scope

Do not do:

- light/medium theme redesign

- backend/schema changes

- DB migrations

- generated Supabase/DB type edits

- renaming existing section ids

- full route rewrite

- desktop redesign

- new clinical logic beyond moving injuries/pain into its own step

9. Acceptance checklist

Verify before stopping:

- 390px: first “Lesões e dor” input visible within one short thumb scroll.

- 768px: layout still behaves correctly.

- Desktop width: desktop navigation remains intact.

- “Lesões e dor” = 1/15 in stepper, header, and progress count.

- PAR-Q+ = 2/15.

- Existing section ids remain stable.

- no_injuries toggle survives reload.

- no_injuries is included in relevant app-level TS/form/patch types without schema migration.

- Optional-safe checks prevent crashes on legacy assessments with missing fields.

- Mobile retains client identity + status chip even with hero hidden.

- Invite status appears once: “Convite pendente · Ainda não aberto · expira em Nd”.

- “Avaliação a decorrer” is gone when invite is unopened.

- PAR-Q chip hidden when count = 0.

- Mobile step chips hidden.

- Desktop nav intact.

- One vertical scrollbar only.

- No horizontal overflow.

- Scroll cue appears on every fresh open and hides after first scroll within that mount.

- Scroll cue resets predictably on route/client change.

- Scroll cue does not overlap sticky bottom navigation.

- prefers-reduced-motion is respected for ScrollCue.

- Dark theme has clear background/surface/border/text separation.

- bunx tsc --noEmit passes.

- No unrelated rewrites.

Final hardening:

- Ensure all markdown/code fences in reports or notes are properly closed.

- Keep generated implementation code in files, not in long nested markdown blocks.

- Do not fake persistence through local state.

- After moving injuries/pain UI into InjuriesSection, confirm the old training/setup rendering is fully removed.

- Add a quick manual smoke check at 390px, 768px, and desktop width.

When done, return:

1. Files changed

2. Acceptance checklist confirmation

3. Remaining risks/TODOs