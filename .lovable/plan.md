## Step 4D — Persist Quick Path vs Lab Mode (localStorage only)

Goal: Remember the user's preferred interface density across sessions on the current device only. No DB, no schema, no generation changes.

### 1. New helper: `src/lib/interface-mode.ts`

Pure, dependency-free, SSR-safe utility. Single source of localStorage logic.

```ts
export type InterfaceMode = "quick" | "lab";
const KEY = "forge.interface_mode";

export function isInterfaceMode(v: unknown): v is InterfaceMode {
  return v === "quick" || v === "lab";
}

export function getStoredInterfaceMode(): InterfaceMode {
  if (typeof window === "undefined") return "quick";
  try {
    const v = window.localStorage.getItem(KEY);
    return isInterfaceMode(v) ? v : "quick";
  } catch {
    return "quick";
  }
}

export function setStoredInterfaceMode(mode: InterfaceMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, mode);
  } catch {
    /* private mode / quota → silent */
  }
}
```

### 2. `src/components/BriefEditor.tsx` — owner of mode

Replace the current `useState<"quick"|"lab">("quick")` with a hydration-safe pattern:

- Initial state: `"quick"` (matches SSR output → no hydration mismatch).
- `useEffect(() => { setMode(getStoredInterfaceMode()); }, [])` — apply persisted value after mount.
- Toggle handler writes via `setStoredInterfaceMode(next)` then `setMode(next)`.

Mode is already passed to `<IntensityCockpit mode={mode} />` and `<RationaleChip mode={mode} />`. Keep that — BriefEditor remains the single owner. No new prop drilling needed; IntensityCockpit stays a controlled child and does NOT read localStorage itself.

### 3. `src/components/plan/IntensityCockpit.tsx`

No changes to mode logic — it already accepts `mode` as a prop and defaults to `"lab"` for back-compat with any non-BriefEditor caller. The internal `pf.cockpit.finetune` localStorage key (manual-knob preference) is unrelated and stays as-is.

### 4. i18n strings

Add under `ux.mode`:
- PT (`src/i18n/locales/pt/common.json`): `"saved_locally": "Preferência guardada neste dispositivo."`
- EN (`src/i18n/locales/en/common.json`): `"saved_locally": "Preference saved on this device."`

Render as a small muted helper line directly under the segmented control in BriefEditor (replaces nothing; sits beside the existing description). Wrapped in `text-[10px] text-muted-foreground`.

### 5. Behavior contract (unchanged from 4C)

- Quick Path: assumed chips only, no manual-control toggle, no auto-apply.
- Lab Mode: all confidence chips, manual-control toggle visible.
- "Aplicar" still requires explicit click. Mode never mutates `programmingVariables`, `brief`, or any payload.

### 6. Verification checklist

- First visit (no key) → Quick Path.
- Switch to Lab → reload → Lab persists.
- Switch back to Quick → reload → Quick persists.
- Manually set `localStorage["forge.interface_mode"] = "garbage"` → falls back to Quick.
- Incognito / blocked storage → no throw, defaults to Quick.
- `rg "forge.interface_mode"` returns only `interface-mode.ts` (single source).
- `rg "interface_mode|interfaceMode"` in `src/server/`, `supabase/`, payload builders → zero hits.
- 375px viewport: control + helper line still fit.
- PT/EN switch updates helper line.

### 7. Non-goals (explicit)

No schema migration, no Supabase write, no field on plans/clients/profiles, no change to Stage 1–5 prompts, no PDF change, no logbook change, no onboarding modal, no redesign.
