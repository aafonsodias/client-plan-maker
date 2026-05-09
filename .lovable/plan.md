## Bug

Clicking a client (e.g. *aspiringbaconeer*) crashes with **"Rendered more hooks than during the previous render."**

## Cause

In `src/routes/clients_.$clientId.tsx`, last round added a `useClientPhases` hook **after** an early `return`:

```tsx
1525:  if (!client) return <p>{t("loading")}</p>;   // early return
...
1542:  const headerPhases = useClientPhases([client.id]);  // hook AFTER return
1543:  const clientPhase = headerPhases[client.id];
```

First render `client` is null → return runs, hook never called. Next render `client` is loaded → extra hook appears → React throws. Rules of Hooks violation.

## Fix

Move the `useClientPhases` call above line 1525, using an empty array when `client` isn't loaded yet:

```tsx
const headerPhases = useClientPhases(client ? [client.id] : []);
const clientPhase = client ? headerPhases[client.id] : undefined;

if (!client) return <p className="text-muted-foreground">{t("loading")}</p>;
```

Delete the duplicate declaration at lines 1542–1543. No other changes.

## Verification

- Navigate to `/clients/<id>` — page renders without the error overlay.
- Header still shows the phase tone dot (emerald/amber/teal/sky/muted) for the loaded client.
