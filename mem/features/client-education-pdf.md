---
name: Client education — PDF glossary appendix
description: Future client-facing PDF should ship a one-page glossary appendix translating coach jargon (RPE, tempo, %1RM, deload, MEV/MAV/MRV) into plain language. Spec only.
type: feature
---

# Client education — PDF glossary appendix

Companion to [client education layer](mem://features/client-education-layer.md). When the client-facing PDF lands, it must include a **one-page glossary appendix** so the client can read their own plan without messaging the trainer for every term.

## Required entries (minimum)

- **RPE 1–10** — what each step feels like, with "RPE 8 = could do 2 more reps" anchor.
- **Tempo notation** (e.g. `3-1-1-0`) — eccentric, bottom pause, concentric, top pause; in seconds.
- **%1RM** — what 1RM means, why we don't always max-test, how %1RM maps roughly to RPE.
- **Deload** — why a lighter week makes the next block heavier, not weaker.
- **MEV / MAV / MRV** — minimum effective, maximum adaptive, maximum recoverable volume; one sentence each, no Greek letters.
- **Warm-up vs activation vs mobility** — they are not the same thing.
- **Set / rep / superset / drop set** — the basics, in case the client is new.

## Tone rules

- Plain language, no clinical paragraphs.
- One concrete anchor per term ("RPE 7 = you finished with 3 reps in the tank").
- Localised: PT-PT humanly written, EN neutral 2nd person, ES/HI may machine-translate but flag for native review before printing.
- No citations on this page. Citations live in the trainer-facing rationale, not the client glossary.

## Layout

- Single page, last page of the PDF before the back cover.
- Two columns. Term in bold. Definition in 1–2 sentences max.
- Same brand chrome as the rest of the PDF (Protocol §12 spec).

## Out of scope for now

No `pdf.ts` changes ship from this doc. Spec only — implementation rides with the next client-facing PDF round.