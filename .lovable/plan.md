## Fix

In `src/routes/clients_.$clientId.tsx`:

1. Move the `bmiAuto` computation and its `useEffect` (currently lines 1450–1460) to **above** the `if (!client) return …` guard at line 1439, alongside the other top-level hooks.
2. Make them null-safe: compute `bmiAuto` from `client?.height_cm / client?.weight_kg` (already does) and inside the effect bail out early when `!client` or `!assessment`.
3. Leave the JSX usage at lines 1838–1859 unchanged — `bmiAuto` is still in scope.

No other files touched. This restores the hook order invariant and unblocks both viewing existing clients and the post-create redirect.