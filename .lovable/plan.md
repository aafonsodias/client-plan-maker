## Fix: hooks-order crash on `/log/$token`

### Root cause
In `src/routes/log.$token.tsx`, `const blocks = useMemo(...)` is declared at line 321 — **after** the three early returns at lines 260–274 (`error`, `!info`, `done`). React's Rules of Hooks require every hook to run on every render. On the first render the loading guard short-circuits and the `useMemo` never executes; on the next render it does, so React throws *"Rendered more hooks than during the previous render"* and the route boundary shows the generic error screen.

### Change
Move the `blocks` `useMemo` (and any other hooks that may have slipped below) **above** the `if (error) … if (!info) … if (done) …` block, alongside the other hooks (`useEffect`s, `useState`s, `useRef`s).

```text
function ClientLogPage() {
  // … all useState / useRef / useEffect …
  const blocks = useMemo(() => (day ? groupExercises(day.exercises ?? []) : []), [day]);

  if (error) return …
  if (!info) return …
  if (done) return …

  // submit handler + JSX
}
```

Note: `useMemo` already handles `!day` internally, so moving it up is safe.

### Verification
1. Open `/log/<valid token>` — page should mount without the red error screen.
2. Console should be free of the *"change in the order of Hooks"* warning.
3. Submit + week selector still work; `blocks` still drives the rendered exercise groups.

### Out of scope
No behaviour, styling, server-fn, or schema changes. Pure hook-ordering fix.