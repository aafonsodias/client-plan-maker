---
name: Exercise media hosting architecture
description: Raw → master → streaming → app-metadata layered model for Protocol exercise videos. Provider-agnostic. Spec only.
type: feature
---

# Exercise Media — Hosting Architecture

## Architecture decision (one line)

`Raw capture → Edited master → Streaming provider → App metadata (keyed by ExerciseKey) → Exercise card`.

The app **never** stores video bytes (no blobs in DB rows, no MP4s in the repo, no large files in app bundle). It stores lightweight, provider-agnostic metadata that references the canonical `ExerciseKey` from `src/lib/exercise-taxonomy.ts`.

## Layers

### 1. Raw capture
- Original camera/phone files (`.MOV`, `.MP4`).
- Stored externally by founder (local disk + cloud backup).
- Never directly served to client app.
- Naming + folder discipline per [file organisation spec](mem://specs/exercise-media-file-organisation.md).

### 2. Edited master
- Cleaned, trimmed, color-corrected, stabilized only if needed.
- High-quality archive (ProRes / high-bitrate H.264).
- Source of all future encodes/exports.
- Immutable once accepted; new versions bump `_v{n}`.
- Not directly embedded in app.

### 3. Streaming version
- Compressed, adaptive (HLS/DASH) variant produced by chosen provider.
- Hosted by provider; provider supplies playback URL/ID + thumbnail.
- Only file the client device ever streams.

### 4. App metadata
- Lightweight rows referencing `exercise_key: ExerciseKey`.
- Provider name + provider asset/playback ID + thumbnail URL + dims + flags + audit fields.
- Provider-agnostic: re-encoding to a different host requires only swapping `provider` + IDs, not changing taxonomy or app surfaces.
- See [data model spec](mem://specs/exercise-media-data-model.md).

### 5. Exercise card consumption
- UI looks up media for an `ExerciseKey` + desired `angle`.
- Player reads `provider` + `provider_playback_id` and renders the appropriate embed.
- No app surface depends on a specific provider URL shape.

## Provider abstraction

### Candidate providers

| Provider | Role | Notes |
|---|---|---|
| **Bunny Stream** | Strong primary candidate | Cheap bandwidth, EU PoPs, adaptive HLS, branded player off, signed URLs. |
| **Cloudflare Stream** | Strong primary candidate | Per-minute pricing, global edge, signed URLs, simple API, no marketplace branding. |
| **Mux** | Premium candidate | Best DX + analytics, higher cost. Reasonable if media volume justifies. |
| **`local_reference`** | Internal use only | Founder-local file paths for review before upload. Never served to clients. |
| **`youtube_reference`** | External reference only | Allowed for founder review, internal POCs, temporary validation. NEVER primary product media. |
| **`other`** | Forward-compat escape hatch | Document why before using. |

### Selection criteria

- Storage cost per GB-month
- Bandwidth/delivery cost per GB
- Adaptive streaming (HLS/DASH) support
- Player control (no provider branding, custom poster, no related-video panels)
- Thumbnail generation API
- Privacy/access control (signed URLs, referrer locks, domain allowlist)
- Analytics quality
- API/SDK quality
- Migration flexibility (export originals, re-upload elsewhere without UI changes)
- EU/GDPR posture (data residency, sub-processor list)
- Ability to suppress public branding/discovery

### Migration rule

The app must store enough metadata to migrate providers later **without touching the exercise taxonomy or the exercise card UI**. The only fields that change on migration are `provider`, `provider_asset_id`, `provider_playback_id`, `playback_url`, `thumbnail_url`.

## Position on YouTube

YouTube is **not** the target product architecture.

Allowed: private founder review · temporary reference link · internal POC · early non-product validation.

Forbidden as final product strategy:
- Relying on YouTube embeds as the premium client-facing library.
- Building architecture around YouTube limitations.
- Exposing YouTube branding as default media experience.
- Treating "unlisted" YouTube as private/secure.
- Treating YouTube URLs as permanent canonical media.

If YouTube appears later it is classified `youtube_reference` / `external_reference` / `temporary_validation`, never `primary_product_media`.

## Cross-refs

- Quality vocabulary: reuses `MediaQualityStatus` from `src/lib/exercise-taxonomy.ts` — see [quality model](mem://specs/exercise-media-quality.md).
- Filming standards: [production notes](mem://specs/exercise-media-production.md) + [production workflow](mem://specs/exercise-media-production-workflow.md).
- AI / overlay limits: [AI visual pipeline](mem://specs/exercise-ai-visual-pipeline.md).
- Phasing: [implementation plan](mem://audits/exercise-media-implementation-plan.md).
