# Phase B turn 2 — biggest impact, least effort

This plan groups your feedback into **3 surgical batches**. Big-vision items (intake-as-slides, bioimpedance OCR, beta = email-gated assessment funnel, founder paywall logic) are **scoped as Phase C** at the bottom — they're multi-day projects, not turn-2 work.

## Batch 1 — Landing page voice + visuals (your top complaint)

`src/routes/index.tsx` + `src/i18n/locales/{pt,en}/plan.json`

- **Logged-in landing keeps everything**. Remove the signed-in early-exit; logged-in users see the full landing (hero CTA swaps to "Abrir dashboard"). Add a thin "Voltar ao dashboard" sticky pill so they can leave fast.
- **Rewrite hero copy (PT + EN)** — drop "Workbench de programação". New PT: *"A ferramenta que eu queria ter como treinador."* Sub: *"Avaliação clínica → mesociclo defensável → PDF para o ginásio → feedback que ajusta a próxima semana. Sem atalhos, sem caixa preta."* No English-PT mixing, no jargon ("MEV/MAV" stays inside the credibility section, not the hero).
- **Hero mockup** — replace the dark-shadow workout card with a **cream/amber "Forge glow"** version: subtle amber radial gradient behind the card, soft `oklch(0.78 0.14 75 / 0.25)` ring, no harsh drop-shadow. Same content, premium feel.
- **"Como funciona" wave fix** — kill the decorative SVG waves between steps. Replace with a single thin amber dotted line + small chevron between steps. Cleaner, signals progression instead of decoration.
- **"O percurso" section** — rename to *"Em construção contínua"*. Subtitle: *"Refinamos todas as semanas. Há bugs — mas como tu és o filtro humano, o resultado sai sempre defensável. O objetivo a longo prazo: integrar todo o conhecimento humano relevante para programação de treino."* Drop "sempre os mesmos cinco passos".
- **Credibility section** — change *"Construído sobre a ciência em que já confias"* → *"Em desenvolvimento e refinamento contínuo"* with same 3 cards but framed as *"As bases que já estão dentro: PAR-Q+, ACSM, Prochaska. As próximas: Helms, Israetel, Schoenfeld."*
- **"Depois do PDF" / Logbook section** — bigger payoff framing. New title: *"Cada série registada vira combustível para a próxima semana."* Add a 3-icon row: 📊 *carga acumulada* · 🔁 *deltas automáticos* · 🧠 *contexto guardado* (sleep / stress / RPE). Phrase as *"Ainda hoje: registo manual + tendência. A seguir: voz → texto, integração com balança / passos / sono, e ajustes sugeridos automaticamente. Tudo opcional, tudo via toggle."*
- **Founder section** — remove the photo (`andreFounder` import + `<img>`). Keep the text, tighten to ~3 short paragraphs + signature.
- **Pricing block honesty** — current "Grátis durante a beta" is misleading. Reframe: *"Beta fechada — entras pelo onboarding"*. Body: *"Subscreves com email, fazes a avaliação completa em formato slide-a-slide, e recebes 1 plano de treino + PDF + 1 semana de logbook. Para continuar a usar, ou és Founder ou aderes ao Pro."* (This sets up the real funnel without building it yet.)

## Batch 2 — Plan view-mode polish (mobile especially)

Files: `src/components/SessionDayView.tsx`, `src/routes/plans.$planId.tsx`, `src/components/MesocycleTableView.tsx`, `src/components/AppShell.tsx`

- **Mobile name truncation** ("Leg press", "Supported glute bridge", "Light farmer carry" overlapping the stat blocks). Switch ExerciseCard header to `flex-col sm:flex-row` below `sm`, with stats wrapping under the name. Drop the ghost number on mobile (it bleeds into the title).
- **"Feet…" / "Box at…" / "Eleva…"** — these are `ex.notes` truncated by `line-clamp-1`. Make them a real toggle: tap reveals the full note inline; replace `line-clamp-1` with collapsed/expanded state and a tiny chevron. Already-collapsed `notes` no longer pretend to be clickable when there's nothing extra to show.
- **YouTube play icon** — make it red (`text-red-600`), size `h-4 w-4`, inline with name (already inline; just colour). Tooltip: *"Ver técnica no YouTube"*.
- **"Ribs down" / cue duplication** — only render the cue band if `cue` is **non-empty AND distinct from notes**. Today both `notes` and `cue` can show the same string. Dedupe.
- **"Why this exercise"** — promote: open by default on mobile (most important trust signal per your note), keep collapsible. Add a tiny 💡 icon. Make the chevron visible.
- **RPE prominence** — RPE is currently muted text in the corner. Bump to its own coloured chip (`bg-accent/15 text-accent font-bold`) inline with sets/reps/rest. Tempo stays small.
- **Muscle tag tiers** — three colours by participation:
  - primary: `bg-accent/15 text-accent` (bold)
  - secondary: `bg-foreground/8 text-foreground/80` (current)
  - stabilizer (new tier from `stabilizer_muscles` if present): `bg-muted/40 text-muted-foreground/60` (faintest)
- **Cooldown styling** — currently visually dead. Light teal accent (`oklch(0.75 0.08 200)`) on the section header strip + dashed border in same hue. Keeps it calm but alive.
- **Day card "Done/Partial/Missed" buttons** — make Done banging: bigger (`h-9 px-4`), emerald gradient (`from-emerald-500 to-emerald-600`), shadow on hover, check icon scaled 1.2x. Tooltip on Partial: *"Completaste menos séries / saltaste exercícios — fica registado para a IA ajustar a próxima semana."* Tooltip on Missed: *"Não treinaste. Sem stress, fica registado."*
- **Done gating** — block "Done" until that day's logbook has at least 1 logged set for every main exercise. Show a small inline `"Falta registar X exercícios"` warning when the gate fails. (Cheap check via existing `sessions` query already loaded on the page.)
- **"Day 1 – Week 1" on Week 2 day 1 bug** — `dayLabel` is the literal stored label ("Day 1") and we re-render the same string for every week. Fix: when rendering inside Week N, show *"Dia 1 — Semana N"* derived from `index + 1` and `week.week_number`, not from `day_label`. Same fix in MesocycleTableView headers.
- **Brand logo overflow on mobile** in plan page — `AppShell` header uses `truncate` on the title but the BrandMark sits in a flex container without `min-w-0`. Add `min-w-0 flex-1` to the title slot and `shrink-0` to the BrandMark wrapper.
- **Plan title duplication** — `"André Periquito Afonso Dias →"` then `"André Periquito Afonso Dias — Phased Pl…"` appears twice in the breadcrumb + h1. Drop the breadcrumb client name when it equals the H1 prefix; show only `← Todos os planos`.
- **Summary card style** — make it feel precious: cream gradient bg (`from-amber-50/50 to-transparent`), thin amber left border, serif-italic body text, small "GOLDEN NUGGETS" eyebrow in amber tracking-widest. Same component, just restyled.
- **AI validation report stuck on "will appear here…"** — the placeholder doesn't reflect actual generation state. Replace with a real status check: if `plan.validation_report` is null AND `plan.status === 'ready'`, show *"Sem relatório — plano aprovado manualmente."* If status is generating, show a pulsing skeleton. (Bug fix, not feature.)
- **View / Edit / Log + Cards/Table buttons** — currently flat. Make them a proper segmented control: filled background for active, soft hover, a small icon on each. "Edit" gets a tooltip: *"Edita exercícios, séries e notas — sem chamar a IA."* "Regenerate with feedback" gets an amber outline + sparkle icon + tooltip: *"Refaz o microciclo com as tuas correções. Custa ~1 chamada à IA."*
- **Edit mode landing on "Approve microcycle"** — when plan is already `ready`, edit mode should open the editor directly (not the approval flow). Detect `plan.status === 'ready'` and skip the approval UI; show only the inline week/day editor. The "second workout not loading" symptom is the same root cause: edit mode is re-mounting the approval stage.
- **Done day visual** — when a day is marked Done, fade the day card to a soft amber-tinted state (like assessment phases): `bg-amber-50/40 dark:bg-amber-950/10`, slightly desaturated text, emerald check next to the day label. Cheap, satisfying.
- **Section spacing on assessment route** — reduce inner padding inside the assessment section cards from `py-8` to `py-5`, and trim top from `pt-8` to `pt-6`. (You said "1mm or 2 less on top, much less after the paragraph".)
- **Intake link copy button** — add a copy-to-clipboard icon button next to the intake URL (in `IntakeLinkPanel.tsx`) with a confirmation dialog: *"Estás prestes a partilhar um link com um terceiro. Tens a certeza que é o cliente certo?"* Yes → copies. Cancel → nothing. Single AlertDialog.

## Batch 3 — Reactive plans status bar + small carries

- **Plans status bar after delete** — `PlansStatusBar` on dashboard already invalidates queries on quota update; the delete mutation needs to also invalidate `["profile"]` and `["plans"]` keys. One-line fix in the delete handler.
- **Founder badge** already shipped last turn — verify it suppresses the trial countdown everywhere (currently still shown on `/dashboard`; check `AppShell.tsx` trial banner branch).
- **Desktop ultra-narrow viewport** (your screenshots) — at desktop window widths < 600px, the landing hero text overflows into the mockup. Add `min-w-0` + `overflow-hidden` on hero grid columns so they wrap instead of overlap. Acceptable tradeoff: it's an edge case but a 5-min fix.

## Phase C — explicitly deferred (these are real projects, not polish)

Acknowledged and parked:

1. **Beta funnel = assessment-as-slides + paywall**. Building this means: (a) a public `/onboarding/$step` slide flow with progress bar, (b) save-and-resume state, (c) gated PDF generation on completion, (d) Stripe Pro tier + Founder allowlist. Multi-day. Will plan separately.
2. **Bioimpedance / weight / step / PA / sleep / voice ingestion**. Each is its own integration (file upload + parser, HealthKit/Google Fit OAuth, voice transcription via Lovable AI). Batch as a "Client Signals" feature.
3. **Intake-as-slides** (mobile-first, slide-by-slide, toggle for "advanced data we'll do together"). Big UX rebuild of `intake.$token.tsx`. Plan separately.
4. **Superset machine-conflict detection** (don't pair two machines a local gym might not allow superset on). Needs equipment-aware prompt for stage 3.
5. **Cooldown per-exercise design tinting** — left as visual polish; small but not blocking.

## Technical notes

- All Batch 1 + 2 items are **read-only-friendly**: no DB migration needed.
- Done-gating uses already-loaded `sessions` data — no new server function.
- Edit-mode bug fix is a single conditional in `plans.$planId.tsx` around line 326.
- Plan stays under ~10 components touched; should ship in one turn.

```text
Estimated impact:
  Batch 1 → user-visible voice change (the loudest complaint)
  Batch 2 → 80% of mobile bug list cleared in one pass
  Batch 3 → 3 quick fixes
  Phase C → scoped, sized, parked
```

Reply **"go"** to execute Batches 1 + 2 + 3. Reply **"go b1"** / **"go b2"** to ship one batch at a time. Reply **"plan c1"** to design the beta-funnel project next.
