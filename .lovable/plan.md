
## 1. Where is the mobile-logbook navigation triggered from /clients/$id?

**File:** `src/routes/clients_.$clientId.tsx`
**Lines:** 1938–1957 (inside the `primaryAction` builder for `<ThisWeekHero/>`)

Relevant excerpt:
```ts
} else if (allApprovedLocal && heroPlan) {
  primaryAction = {
    label: "Abrir primeiro log",
    icon: <ArrowRight className="h-4 w-4" />,
    intent: "log",
    onClick: async () => {
      const token = existingToken ?? (await ensureShareTokenFn(...)).share_token;
      ...
      navigate({ to: "/log/$token", params: { token } });   // line 1952
    },
  };
}
```

This is the only "Logbook"-flavoured CTA on the client page once the plan is fully approved. Target = `/log/$token` (mobile client surface). There is **no** trainer-facing "Open editor / Logbook PT" button anywhere on `/clients/$id` — the only `/plans/$planId` link in this file is the fallback `Abrir plano` at line 1959, which only appears when stages aren't all approved (`else if (heroPlan)`), so the moment a plan is finalized the trainer loses any path to the 5-tab editor from this page.

## 2. Does `/plans/$planId` still expose the 5 tabs?

Yes. `src/routes/plans.$planId.tsx` is intact:
- Line 86: `type Mode = "view" | "edit" | "log" | "results" | "progress";`
- Line 104: `useState<Mode>("view")`
- Lines 864–896: 5 tab buttons (`view`, `edit`, `log`, `results`, `progress`) with `setMode(...)`
- Auto-lands on `results` once enough sessions logged (line 264).

The route renders the trainer editor exactly as documented in `round-mvp-map.txt`. The `log` tab inside it is the trainer's desktop logging table (`LogMode`), distinct from `/log/$token`.

## 3. Minimal proposed change

Add a secondary action **next to** the existing "Abrir primeiro log" CTA (do not replace it — the mobile link is correct for handing to the client). Two viable shapes; recommend **A**:

**A. Add `secondaryAction` on `<ThisWeekHero/>` `primaryAction`-sibling** in `clients_.$clientId.tsx` around lines 1938–1957:

```tsx
} else if (allApprovedLocal && heroPlan) {
  primaryAction = {
    label: "Abrir logbook do cliente",   // mobile link, unchanged behaviour
    icon: <Smartphone className="h-4 w-4" />,
    intent: "log",
    onClick: async () => { ... navigate({ to: "/log/$token", params: { token } }); },
  };
  secondaryAction = {
    label: "Abrir editor",
    href: `/plans/${heroPlan.id}`,   // lands on view tab; auto-jumps to results when sessions exist
    icon: <ArrowRight className="h-4 w-4" />,
  };
}
```

This requires:
- a `secondaryAction?: HeroPrimaryAction` prop on `ThisWeekHero` (`src/components/ThisWeekHero.tsx`) rendered as a ghost/outline button to the right of the primary;
- passing it through at line ~2008 in `clients_.$clientId.tsx`;
- relabeling the existing CTA to "Abrir logbook do cliente" (or keep "Abrir primeiro log" until first session, then flip to "Abrir logbook do cliente" via `zeroState`).

Navigation target: simple `/plans/${heroPlan.id}` href (matches the pattern already used at line 1959 and in ClientCockpit). No query/planId param needed — `planId` is the route param.

**B. Inline trainer link inside the protocol section** (lines 2002–2010): drop a small "Editor · 5 tabs" anchor under `<ThisWeekHero/>`, mirroring the ClientCockpit "Plan strip" (see §4). Lower visual priority but zero changes to ThisWeekHero's API.

Recommendation: **A** — it keeps the two surfaces visually paired (one button per audience), respects the "looks → function → ease" decision order, and matches the mental model the audit describes.

## 4. Does ClientCockpit already have an "Abrir editor" link, and why isn't the same pattern used here?

Yes — `src/components/ClientCockpit.tsx` has it twice:
- **Line 142** (`stagePanel.planLink`): pill-style `<Link to="/plans/$planId" params={{ planId: plan.id }}>` used for stage-action chips.
- **Lines 252–266**: the "Plan strip" — full-width `<Link>` row under the ProtocolRail with title + "block N · week x/y · open plan".

This pattern was added in Round 54 specifically for the dashboard's expanded cockpit. It was **never ported to `/clients/$id`** because that page evolved independently around `<ThisWeekHero/>` + the inline 5-stage rail (`mem://principles/no-stage-redirects.md`). When the post-approval state added "Abrir primeiro log" (Round F-something — points to `/log/$token`), it overwrote the `Abrir plano → /plans/$planId` fallback for finalized plans without keeping a trainer-side link.

Net effect: dashboard cockpit users get both the trainer editor link and the mobile share link; client-page users only get the mobile link once everything is approved. The fix in §3 closes that asymmetry by reintroducing the same `to="/plans/$planId"` link the cockpit already uses.

## Files to touch (when implementation lands)

1. `src/components/ThisWeekHero.tsx` — add optional `secondaryAction?: HeroPrimaryAction` and render it next to `primaryAction`.
2. `src/routes/clients_.$clientId.tsx` lines 1938–1957 + 2003–2009 — add `secondaryAction = { href: \`/plans/${heroPlan.id}\` }` and pass it through; consider the same secondary on the `else if (heroPlan)` branch at line 1958 for symmetry.

No DB / server changes. No i18n schema changes (one new key: `clients.cta.open_editor`).

## Out of scope

- Renaming routes or merging the two surfaces.
- Adding a 6th tab or restructuring `/plans/$planId`.
- Changing share-token logic.
