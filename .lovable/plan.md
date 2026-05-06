# Step 4C — Quick Path vs Lab Mode (UX-only)

Introduce a local mode distinction that controls **how much rationale/control is shown**, without touching schema, persistence, or generation.

## Scope

- `src/components/BriefEditor.tsx` — own the mode state, render the segmented control, pass `mode` down.
- `src/components/plan/IntensityCockpit.tsx` — accept `mode` prop, change default visibility of knobs and chips.
- `src/components/ux/RationaleChip.tsx` — accept optional `mode` prop to suppress confident/manual chips in Quick Path (keep `assumed` always visible).
- `src/i18n/locales/{pt,en}/common.json` — add `ux.mode.*` keys.
- No changes to `auto-infer.ts` logic; no other files.

## 1. Local state (BriefEditor)

```ts
const [mode, setMode] = useState<"quick" | "lab">("quick");
```

- Not persisted. Not in URL. Not in form state. Not sent to server.
- Lives only in `BriefEditor`'s render tree; passed as prop where needed.

## 2. Segmented control

Rendered at the very top of `BriefEditor` (above the Objetivo card), full-width on 375px:

```text
[ Caminho rápido ] [ Modo laboratório ]
<microcopy line under the active option>
```

- Two buttons, `role="tablist"`, `aria-pressed` toggles.
- Active = amber outline + filled background, matching existing pill style in BriefEditor.
- Microcopy line below shows `ux.mode.quick_description` or `ux.mode.lab_description`.

## 3. Quick Path behavior (default)

- Tier inferred row: keep value, **hide** the rationale chip (it's confident).
- Training Split row:
  - If matches system recommendation → no chip (silent confident state).
  - If user diverges → keep "Recomendado · Aplicar" row visible (this is the only useful nudge).
- IntensityCockpit:
  - Presets row visible.
  - Summary line visible **without** the inline preset RationaleChip.
  - `showKnobs` forced to `false`; "Controlo manual" toggle hidden.

## 4. Lab Mode behavior

- All rationale chips render (tier, split match/manual, cockpit preset, wave, deload, manual envelopes).
- "Sobrepor default" / "Controlo manual" toggle reappears in the cockpit.
- `showKnobs` honors the existing localStorage preference (current behavior).
- "Recomendado · Aplicar" row continues to require explicit click — never auto-applied.

## 5. Rationale density rule (RationaleChip)

Add an optional prop:
```ts
mode?: "quick" | "lab"; // default "lab" (preserves current behavior at all other call sites)
```

When `mode === "quick"`:
- Render `null` for `confident` and `manual` confidences (low-signal chips).
- Always render for `assumed` (these explain non-obvious choices).

This lets the cockpit/brief pass `mode={mode}` once and get the right density for free.

## 6. No hidden mutations

- Toggling mode never calls `onChange`, `setPv`, `apply`, or any setter that mutates `brief` / `programmingVariables`.
- "Aplicar" button still requires an explicit click in both modes.
- Form values, plan object, and generation payload are byte-identical between modes.

## 7. i18n keys (add under existing `ux` namespace)

```json
"ux": {
  "mode": {
    "quick_path": "Caminho rápido",
    "lab_mode": "Modo laboratório",
    "quick_description": "O sistema recomenda defaults seguros com base nos dados atuais.",
    "lab_description": "Mostra mais controlos, rationale e opções de sobreposição.",
    "aria_label": "Modo de configuração"
  }
}
```

EN mirror with the requested copy. No hardcoded strings in components.

## 8. Acceptance

- Default mode = Quick Path on every render of BriefEditor.
- Toggling to Lab reveals chips + manual control toggle without changing any field.
- Toggling back hides them; form values unchanged (verify via re-render with same brief object identity).
- No `psql`/network writes occur on toggle (visual smoke).
- Old plans without `cockpit_preset` or partial `programming_variables` don't crash (defensive optional chaining already in place).
- 375px: segmented control fits on one row; microcopy wraps cleanly.
- PT and EN both render the new strings.

## Non-goals

No schema, no `generation_meta` fields, no `programming_variables.mode`, no PDF, no logbook, no onboarding modal, no Quick-Path-specific generation prompt, no auto-snap of recommendations.
