## Goal

Surface the **assessment summary PDF** download right next to the **plan PDF** chip on the `ThisWeekHero` (top of `/clients/$id`), so both documents (avaliação + plano) sit side-by-side in the same place.

Today the assessment PDF exists (`renderAssessmentPdf` in `src/lib/pdf.ts`, already wired in the "⋯" dropdown at line 1714) but is hidden inside a kebab menu, far from the plan controls. The trainer asked: pode estar disponível nesta página, perto do download do PDF do plano?

## Plan

### 1. Add a second optional action prop to `ThisWeekHero`

`src/components/ThisWeekHero.tsx` — extend the props with:

```ts
assessmentPdf?: { onDownload: () => void | Promise<void>; loading?: boolean };
```

Render a sibling chip immediately to the left of the existing emerald **PDF · Sem. N** chip. Same pill shape, but tonal (e.g. teal/info) so the two are visually distinct yet clearly a pair:

```
[ Avaliação · PDF ]   [ PDF · Sem. 1 ]   [W1 W2 W3 W4]   [Abrir logbook]
```

Keep the chip small (`text-[10px]`, same height) so it fits the condensed hero we just landed.

### 2. Wire it on the client page

`src/routes/clients_.$clientId.tsx` — in the `<ThisWeekHero …/>` call (~line 2010), pass:

```tsx
assessmentPdf={
  assessment
    ? {
        onDownload: async () => {
          const { renderAssessmentPdf } = await import("@/lib/pdf");
          renderAssessmentPdf({ assessment, client, t: t as any });
        },
      }
    : undefined
}
```

The chip renders only when an `assessment` exists for the client.

### 3. Keep the dropdown entry (for now)

The "Documentos → Download PDF" item in the "⋯" menu (line 1714) stays as a back-up surface — removing it is a separate decision. Trainers who already learned the dropdown path won't be surprised.

### Optional polish

- Loading toast on click (mirror the existing plan PDF toast pattern).
- `title` tooltip: "Descarregar PDF da avaliação".
- If no assessment is present, no chip — keeps the hero clean.

## Files touched

- `src/components/ThisWeekHero.tsx` — new prop + chip render.
- `src/routes/clients_.$clientId.tsx` — pass the prop.

No DB / migration / i18n changes.

## Out of scope

- Reorganising the "⋯" menu.
- A unified "Documentos" panel surfacing every artifact (assessment + plan PDFs + share-token URL). Future round if the list grows.
- Embedding the assessment as an inline tab inside the editor (different scope; would conflict with View/Edit/Log tabs).

Estimate: ~3–5 credits.
