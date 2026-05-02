---
name: Intake reference photos
description: 4-slot reference photos collected at intake (front/side/back/face). Honest framing — visual progress, not posture diagnosis.
type: feature
---
Slots: front | side | back | face. Stored in private `client-photos` bucket, path `{trainerId}/{clientId}/posture-{slot}.{jpg|png}`. Path also recorded on `assessments.extended.photos[slot]` plus `extended.photos.captured_at`.

Upload path: `uploadIntakePhoto` server function in `src/server/intake-photos.functions.ts`. Validates intake token + size (≤6MB after client-side resize to ≤1600px JPEG q=0.82), then writes via service role (bypasses RLS that scopes the bucket to the trainer). Re-takes upsert the same path.

UI: `<PhotoSlot/>` in `src/routes/intake.$token.tsx`. Mobile uses native camera capture (`capture="environment"`); desktop falls back to file picker.

Framing copy: "Não usamos para diagnosticar postura. Servem para acompanhar a tua evolução visualmente." Never advertise this as a posture-correction feature.

Skipping: the slide uses the universal Skip button with `skipKeys: ["photos"]` → `extended.skipped.photos = true`.

Coach side: not yet wired into `clients_.$clientId.tsx`. TODO: thumbnail row + lightbox + signed URLs from `client-photos` bucket.