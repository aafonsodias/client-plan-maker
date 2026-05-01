# Round 3 — pt-PT sweep + 6 visual bugs blocking ship

Strict order. Typecheck after each step. After Step 7, capture 3 screenshots at 375px (top, middle MovementPatternCard with one box checked, bottom red-flag accommodations) plus a quick 1280px sanity check.

Out of scope this round (queued): A5 (BP inputs), B4 (radar dual layers), Mobility 1-5 objectivation, Steps section, cardio (continuous + interval), color-coded smart feedback, client `/intake/:token` slide-by-slide flow, "Ver sugestões" on red flags, Readiness to Change richer guidance.

---

## Step 1 — A3: full pt-PT sweep

Goal: zero English UI literals on `/clients/$clientId` (action bar, brief editor, intake panel, stage cards, app shell empties). DB enum values stay canonical; only display text changes.

**Label changes (drop the jargon "PB"):**
- `src/routes/clients_.$clientId.tsx` line 1408: `Capacidade actual vs PB` → `Capacidade actual vs pico anterior`.
- Slider helper line under it: replace `(modo reconstrução) … no PB ou acima …` with `… (modo reconstrução) · 5 = a meio · 10 = no pico anterior ou acima (modo progressão).`
- `src/components/BriefEditor.tsx` line 83 pill: keep wording but replace any `PB` reference with `pico anterior` if surfaced.
- Server prompts in `src/server/phased/stage1-brief.functions.ts` (lines 125-129, 437-441) keep the field name `current_capacity_vs_pb` but rephrase the human prose: `"where I am vs my best ever"` → `"onde estou vs o meu pico anterior"`.

**`src/components/IntakeLinkPanel.tsx`:** translate all literals via existing `intake` namespace (or extend it). New keys in `src/i18n/locales/{pt,en}/intake.json`:
- `panel.title`: "Link de avaliação do cliente" / "Client intake link"
- `panel.subtitle`: "Envie um link ao seu cliente para preencher as secções de autoavaliação a partir do telemóvel." / "Send a link to your client to fill the self-report sections from their phone."
- `panel.generate`: "Gerar link de avaliação"
- `panel.regenerate`, `panel.copy`, `panel.copied`, `panel.mark_reviewed`, `panel.toast.ready`, `panel.toast.copied`, `panel.toast.reviewed`
- `panel.share.whatsapp_body`: pt-PT formal — `"Olá {{name}}, envio-lhe o link da avaliação inicial: {{url}}. Demora cerca de 15 minutos. Obrigado!"`
- `panel.share.email_subject` and `panel.share.email_body` analogous.

**`src/components/StageCard.tsx`:** add optional props with EN defaults so other pages stay safe:
```ts
regenerateLabel?: string; generatingLabel?: string;
placeholderLabel?: string; approveLabel?: string;
stageLabel?: (n: number, title: string) => string;
```
All call sites in `clients_.$clientId.tsx` pass pt-PT: `Regenerar`, `A gerar…`, `Aparece aqui assim que a etapa anterior for aprovada.`, `Aprovar`, `Etapa N — {title}`. Add corresponding keys under `assessment.stage_card.*` in both locales so the route reads via `t()`.

**`src/components/BriefEditor.tsx` (full pass):**
- Every `<Card title="…">`: `Goal` → `Objectivo`, `Schedule & emphasis` → `Calendário e ênfase`, `Programming setup` → `Configuração programática`, `Red flag accommodations` → `Acomodações de sinais de alerta`, etc.
- Every `<Field label>`: translate. Use `brief-labels.ts` maps for `<option>` text:
  - primary_goal → `PRIMARY_GOAL_LABELS_PT`
  - training_age_band → `TRAINING_AGE_LABELS_PT`
  - training_split → `TRAINING_SPLIT_LABELS_PT`
  - deload_frequency → `DELOAD_FREQUENCY_LABELS_PT`
  - deload_style → `DELOAD_STYLE_LABELS_PT`
  - exercise_bias → `EXERCISE_BIAS_LABELS_PT`
  - intensity_volume_balance → `INT_VOL_LABELS_PT`
  - red flag strategy → `FLAG_STRATEGY_LABELS_PT`
- Empty state: `No red flags from the brief — nothing to accommodate.` → `Sem sinais de alerta no brief — nada a acomodar.`
- Replace English placeholders ("e.g. ...") with pt-PT equivalents.

**Action bar in `clients_.$clientId.tsx`:** the `defaultValue` literal at line 1706 (`Pré-visualização do brief: ${done}/${total}`) — switch to `t("assessment.brief_preview", { done, total, defaultValue: "Pré-visualização do brief · {{done}}/{{total}}" })` (note the `·` separator and no quotes around "brief"). `Discard draft` / `Generate plan draft` already exist in `pt/assessment.json` (lines 270-277) — make sure both buttons read from `t()`, not hardcoded EN.

**`src/components/AppShell.tsx` and `clients_.$clientId.tsx` empties:** sweep with `rg` for any remaining English literal in JSX text nodes — `All clients`, `No logged sessions yet`, `Loading compliance…`, `Brief preview`, `Generate intake link`, `Expand all`, `Collapse all`. Each goes through `t()` with the PT value as `defaultValue` and a key in the appropriate namespace. Keep EN translations populated so the EN locale still renders correctly.

Acceptance: `rg -n '"[A-Z][a-z]+ [a-z]+"' src/routes/clients_.\$clientId.tsx src/components/{BriefEditor,IntakeLinkPanel,StageCard,AppShell}.tsx` returns no obvious English UI strings (allowed: technical identifiers, console logs, `defaultValue` fallbacks).

---

## Step 2 — A2: locale stale-detection + "Re-analisar avaliação"

Server `src/server/phased/pre-stage.functions.ts`:

1. Add `locale: z.enum(["pt-PT", "en-GB"]).default("pt-PT")` to `InputSchema`.
2. In the cache check (line 98), also miss when `cachedAt[\`${section}__locale\`] !== data.locale`.
3. Pass locale into the system prompt: branch the existing pt-PT line based on `data.locale` (en-GB variant: "Output English (en-GB), formal address, British spelling.").
4. After successful update, also write to `section_analyses_locale` JSONB (column already exists — see `src/integrations/supabase/types.ts:68/142/216`):
   ```ts
   const cachedLocales = ((assessment as any).section_analyses_locale ?? {}) as Record<string,string>;
   const newLocales = { ...cachedLocales, [data.section]: data.locale };
   ```
   include `section_analyses_locale: newLocales as any` in the `.update()`.
5. `getSectionAnalysisCoverage`: also `.select("section_analyses_locale")` and return `analyses_locale: Record<string,string>` plus per-section `locale` on each entry.

Client `src/routes/clients_.$clientId.tsx`:

1. Helper: `const uiLocale = i18n.language?.startsWith("pt") ? "pt-PT" : "en-GB";`
2. After `getCoverageFn` resolves, compute stale = sections where `analyses_locale[s] && analyses_locale[s] !== uiLocale`. Drop those from local `sectionAnalyses` state so the UI shows "a analisar…" and the existing autosave/analyze-on-save loop re-fetches them with `force: true, locale: uiLocale`.
3. Pass `locale: uiLocale` on every `analyzeSectionFn(...)` call site (search for `analyzeSectionFn(`).
4. Add a "Re-analisar avaliação" button next to Expand/Collapse in the assessment header. On click:
   - Open an `<AlertDialog>`: title `Re-analisar avaliação`, body `Custo estimado ~€0.05 · re-correr 14 secções em {{locale}}?` (interp uiLocale).
   - On confirm: set `reanalyzing = true`, disable Expand/Collapse + the button itself, iterate `PHASED_SECTIONS` sequentially with `await analyzeSectionFn({ data: { assessmentId, section, force: true, locale: uiLocale } })`. Show `<Loader2 className="animate-spin"/> {n}/14` next to the button. After loop, refetch coverage and re-render synthesis.
5. Add i18n keys `assessment.reanalyze.button|dialog_title|dialog_body|progress` in both locales.

Acceptance: switching language and reloading triggers automatic re-analysis of stale sections; the button forces a fresh full pass and the synthesis dashboard reflects pt-PT text after it completes.

---

## Step 3 — Logo swap

The logo currently lives at `src/assets/forge-logo.png` and is imported via `src/components/Logo.tsx` (used by `index.tsx`, `auth.tsx`, `log.$token.tsx`, and the AppShell brand area).

Action:
- The user will upload the new gold-bar / grey-monolith / black PNG. Save it over `src/assets/forge-logo.png` (same path so all imports keep working).
- If the upload is not in `user-uploads://` at execution time, leave `Logo.tsx` untouched and ask the user to upload to `src/assets/forge-logo.png`.
- Verify the wordmark `FORGE` still renders to the right of the logo in `AppShell.tsx` and on the landing page (`src/routes/index.tsx:373`).
- Use `className="h-7 w-auto"` in `AppShell.tsx` so the asset's natural ratio is preserved (avoid forcing a square box on a horizontal mark).

Acceptance: header shows new logo + `FORGE` wordmark on every authenticated route.

---

## Step 4 — Action bar layout fix

In `clients_.$clientId.tsx` near line 1706 (the row containing Discard / brief preview counter / Generate plan draft), replace the current row with:

```tsx
<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
  <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={...}>
    {t("assessment.discard_draft.button")}
  </Button>
  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
    <span className="text-xs tabular-nums text-muted-foreground">
      {t("assessment.brief_preview", { done, total, defaultValue: "Pré-visualização do brief · {{done}}/{{total}}" })}
    </span>
    <Button size="lg" className="w-full sm:w-auto" onClick={...}>
      {t("assessment.generate_draft.button")}
    </Button>
  </div>
</div>
```

Remove any wrapping `<div className="flex justify-between …">` that previously caused the clip. Confirm the parent container has `min-w-0` so children may shrink.

Acceptance: at 375px both buttons render full-width stacked; at ≥640px Discard sits left, counter + Generate sit right with no overflow.

---

## Step 5 — MovementPatternCard checkbox contrast

`src/components/MovementPatternCard.tsx` currently uses native `<input type="checkbox" className="accent-primary" />` (lines 56, 78). On the dark surface the checkmark renders white-on-near-white.

Replace both native checkboxes with the shadcn `Checkbox` from `src/components/ui/checkbox.tsx` (already styled with `border-primary` + filled `data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground`):

```tsx
import { Checkbox } from "@/components/ui/checkbox";

// "Ainda não avaliado"
<Checkbox
  id={`na-${pattern}`}
  checked={notAssessed}
  onCheckedChange={(v) => onNotAssessed(v === true)}
  className="h-3.5 w-3.5"
/>

// per-criterion row
<Checkbox
  id={`fc-${pattern}-${c.key}`}
  disabled={disabled}
  checked={checked}
  onCheckedChange={(v) =>
    onFormCriteria({ ...(formCriteria ?? {}), [c.key]: v === true })
  }
  className="mt-0.5 h-3.5 w-3.5 shrink-0"
/>
```

Keep label markup (`<label htmlFor={...}>`) so clicking the text toggles. Verify contrast at 100% and at the `opacity-60` when `notAssessed` is true.

Acceptance: visible border at rest; clearly filled square + check mark when checked, on both pattern criteria and the "Ainda não avaliado" toggle.

---

## Step 6 — Mobile language chip in top bar

Currently in `src/components/AppShell.tsx` the desktop locale picker uses a Globe icon (line 158); below `md:` it lives only in the hamburger sheet (line 230).

Add a small text chip right next to the FORGE brand on mobile (visible at every width below `md`, hidden above):

```tsx
{/* shows current locale at a glance on mobile; tap reuses the same dropdown */}
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <button
      type="button"
      aria-label={t("appshell.language")}
      className="md:hidden inline-flex items-center rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
    >
      {activeLanguage}
    </button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="start">
    {/* same items the desktop Globe dropdown uses */}
  </DropdownMenuContent>
</DropdownMenu>
```

Place this chip in the brand row (right of the `<Logo>` + `FORGE` wordmark, left of the hamburger). The desktop Globe dropdown stays unchanged at `≥md`.

Acceptance: at 390px viewport the chip shows `PT` (or `EN`) next to FORGE; tapping opens a 2-item dropdown that swaps locale and persists via the existing `LOCALE_STORAGE_KEY` flow; chip disappears at `≥768px`.

---

## Step 7 — Flatten Red Flag Accommodations

In `src/components/BriefEditor.tsx` lines 283-310 the structure is `Card → list of Card → Strategy + Detail`. Combined with the parent `StageCard` and route wrapper, the user sees 4 stacked borders.

Refactor to:

```tsx
{accommodations && onAccommodationsChange && (
  <section className="space-y-2">
    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
      Acomodações de sinais de alerta
    </h3>
    {accommodations.length === 0 ? (
      <p className="text-xs text-muted-foreground">Sem sinais de alerta no brief — nada a acomodar.</p>
    ) : (
      <ul className="divide-y divide-border">
        {accommodations.map((a, idx) => (
          <li key={idx} className="py-3 first:pt-0 last:pb-0">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <p className="min-w-0 flex-1 text-sm font-medium text-foreground">{a.flag}</p>
              <select
                value={a.strategy}
                onChange={(e) => setAcc(idx, { strategy: e.target.value as any })}
                className="be-input shrink-0 sm:w-44"
              >
                {(["AVOID","MODIFY","MONITOR","ACCOMMODATE"] as const).map((s) => (
                  <option key={s} value={s}>{FLAG_STRATEGY_LABELS_PT[s]}</option>
                ))}
              </select>
            </div>
            <textarea
              value={a.detail ?? ""}
              onChange={(e) => setAcc(idx, { detail: e.target.value })}
              rows={2}
              placeholder="Detalhe (opcional)…"
              className="be-input mt-2 w-full resize-none"
            />
          </li>
        ))}
      </ul>
    )}
  </section>
)}
```

No outer `<Card>`. Use `divide-y` instead of per-row borders. Apply the same flattening to `Programming setup` if it currently nests cards inside cards (audit while in the file).

Acceptance: max 2 nested borders (StageCard → section); rows separated by hairline dividers, no `russian doll`.

---

## Validation

After all steps:
1. Typecheck (auto-runs).
2. Navigate to `/clients/bfc11030-9a47-40fb-94a7-68945c73789d` at 390px.
3. Click "Re-analisar avaliação" → confirm → wait for 14/14.
4. Click "Expandir tudo".
5. Capture 3 screenshots:
   - **Top**: nav with new logo + PT chip + action bar showing Discard / counter / Generate cleanly stacked.
   - **Middle**: a MovementPatternCard with one criterion checked — checkbox visibly filled.
   - **Bottom**: BriefEditor "Acomodações de sinais de alerta" rows flattened.
6. Quick 1280px sanity screenshot to confirm no desktop regression.

Acceptance recap: (a) zero EN literals after re-analysis; (b) cached AI re-runs in pt-PT; (c) new logo; (d) action bar fully visible at 375px; (e) checkboxes high contrast; (f) PT/EN chip visible mobile; (g) accommodations 2 levels max.
