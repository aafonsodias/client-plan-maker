# exercise-taxonomy-v1

## Status

Draft v1 distilled from Protocol Core Stack output 4. This is a product-domain manual for representing exercises as structured data inside Protocol.

This manual does not list exercises and does not define a proprietary movement system.

## Core principle

Protocol must not treat exercises as free-text names.

An exercise must be represented as a structured object that supports selection, substitution, regression, progression, safety filtering, localization, media, logging, and audit.

Free text can describe nuance, but it must not be the source of truth.

## Source hierarchy

When sources conflict, Protocol prioritizes:

1. safety and scope of practice
2. practical personal-trainer usability
3. adherence and feasibility
4. exercise science
5. movement frameworks
6. product/software workflow

## Three separate concepts

### Exercise template

The reusable exercise identity.

Example meaning: what the exercise is, what pattern it belongs to, what equipment it needs, what muscles it targets, what common regressions/progressions exist.

### Exercise prescription

The client-specific dose.

Example meaning: sets, reps, load, RPE, rest, tempo, ROM target, coaching focus, pain constraints.

### Logged exercise performance

What actually happened.

Example meaning: completed sets/reps/load, RPE, pain, substitutions, technique notes, missed work, trainer modifications.

Protocol must keep these separate.

## Field 1 - Exercise identity

### Purpose

Create a stable exercise identifier that allows tracking, substitution, analytics, and audit.

### MVP fields

- exercise_id
- canonical_name
- display_name
- aliases
- language/locale names
- status: draft, verified, deprecated

### Decision changed

Prevents ambiguous exercise names from corrupting plans, logs, substitutions, and analytics.

### Data type

Structured.

### Editable

Trainer may add local aliases. Core identity should be controlled.

### AI suggestion

AI may suggest matching unknown names to known exercises, but trainer approval is required.

### Versioning

Version changes to canonical identity, aliases, deprecation status, and exercise mapping.

## Field 2 - Movement pattern

### Purpose

Classify the exercise by broad movement behavior.

### MVP examples

- squat / knee-dominant
- hinge / hip-dominant
- lunge / split stance
- horizontal push
- vertical push
- horizontal pull
- vertical pull
- carry
- trunk anti-extension
- trunk anti-rotation
- trunk flexion/extension where appropriate
- gait / locomotion
- balance / stance control
- aerobic modality

### Decision changed

Enables program balance, substitution, regression, progression, movement-screen links, and beginner-friendly selection.

### Data type

Structured enum or controlled taxonomy.

### Editable

Trainer can suggest additions, but taxonomy should remain controlled.

### AI suggestion

Allowed, but trainer approval required for new or uncertain classification.

### Versioning

Version when pattern classification changes.

## Field 3 - Primary muscles

### Purpose

Identify the main intended target tissues or muscle groups.

### Decision changed

Supports volume tracking, goal alignment, fatigue management, and hypertrophy/strength planning.

### Data type

Structured list with controlled muscle/group names.

### Editable

Trainer editable with approval.

### AI suggestion

Allowed.

### Versioning

Version if primary classification changes.

## Field 4 - Secondary muscles and stabilizers

### Purpose

Capture relevant secondary contributors and stabilizing demands.

### Decision changed

Prevents hidden fatigue accumulation and supports better substitutions.

### Data type

Structured list plus optional notes.

### Editable

Trainer editable.

### AI suggestion

Allowed.

### Versioning

Version meaningful changes.

## Field 5 - Equipment requirements

### Purpose

Ensure exercise selection matches the client’s real environment.

### MVP fields

- no equipment
- bodyweight
- bench/box/chair
- bands
- dumbbells
- kettlebells
- barbell
- machine
- cable
- suspension trainer
- cardio machine
- floor space
- wall support

### Decision changed

Filters exercises, supports home/gym modes, and improves adherence.

### Data type

Structured.

### Editable

Trainer/client can update equipment availability. Exercise equipment tags should be controlled.

### AI suggestion

Allowed for substitutions, not for inventing availability.

### Versioning

Version if exercise equipment requirements change.

## Field 6 - Setup requirements

### Purpose

Define the environmental and positioning requirements needed to perform the exercise safely.

### MVP fields

- start position
- equipment setup
- space requirement
- support requirement
- safety setup
- supervision requirement if relevant

### Decision changed

Affects feasibility, safety, and coaching clarity.

### Data type

Structured fields plus short free-text notes.

### Editable

Trainer editable.

### AI suggestion

Allowed for drafts, trainer approval required.

### Versioning

Version significant setup changes.

## Field 7 - Difficulty / technical level

### Purpose

Represent how technically demanding the exercise is.

### MVP levels

1. very simple / low skill
2. simple
3. moderate
4. advanced
5. high skill / specialist

Difficulty should consider skill demand, balance demand, mobility demand, loadability, coordination, and consequence of error.

### Decision changed

Controls beginner suitability, progression, and regression.

### Data type

Structured ordinal plus optional rationale.

### Editable

Trainer editable with moderation if shared globally.

### AI suggestion

Allowed.

### Versioning

Version meaningful changes.

## Field 8 - Regression options

### Purpose

Define easier or safer alternatives that preserve the intended pattern or goal where possible.

### Decision changed

Allows the plan to adapt when the client lacks skill, confidence, strength, mobility, equipment, or pain tolerance.

### Data type

Structured links to exercise templates with reason tags.

### MVP reason tags

- less load
- less range
- more support
- lower skill
- less balance demand
- less spinal demand
- less shoulder demand
- less knee demand
- no-equipment alternative

### Editable

Trainer editable.

### AI suggestion

Allowed.

### Versioning

Version regression graph changes.

## Field 9 - Progression options

### Purpose

Define harder alternatives or higher-complexity versions.

### Decision changed

Supports progressive overload without relying only on load increases.

### Data type

Structured links to exercise templates with progression reason tags.

### MVP progression dimensions

- more load
- more range
- less support
- more stability demand
- higher coordination
- unilateral variation
- tempo change
- power emphasis
- density increase

### Editable

Trainer editable.

### AI suggestion

Allowed, trainer approval required.

### Versioning

Version progression graph changes.

## Field 10 - Substitution logic

### Purpose

Find acceptable replacements when the planned exercise is not possible.

### Decision changed

Protects plan intent when equipment, pain, fatigue, skill, or logistics change.

### MVP substitution priorities

1. same goal
2. same movement pattern
3. similar target muscles
4. compatible equipment
5. appropriate difficulty
6. compatible pain/limitation constraints
7. similar loading intent where possible

### Data type

Rule-based structured logic plus trainer notes.

### Editable

Trainer approval required.

### AI suggestion

Allowed.

### Versioning

Version substitutions used in actual plans and logs.

## Field 11 - Contraindication / caution tags

### Purpose

Flag exercises that may require caution, modification, referral, or avoidance in specific contexts.

### Important correction

Protocol should avoid saying an exercise is universally contraindicated for broad labels like “hypertension” unless the context is precise.

Most tags should be caution/context tags, not absolute bans.

### MVP tags

- high axial load
- overhead load
- high impact
- high balance demand
- high spinal flexion demand
- high spinal extension demand
- high rotation demand
- deep knee flexion demand
- high shoulder elevation demand
- breath-holding/straining tendency
- fall risk concern
- complex setup

### Decision changed

Supports safer filtering and trainer review.

### Data type

Structured tags.

### Editable

Core tags controlled. Trainer may add client-specific cautions in prescription.

### AI suggestion

Allowed only as suggestion.

### Versioning

Version tag changes.

## Field 12 - Pain-modification tags

### Purpose

Link exercises to common mechanical or contextual triggers without diagnosing pain.

### MVP tags

- flexion-sensitive candidate
- extension-sensitive candidate
- rotation-sensitive candidate
- compression-sensitive candidate
- impact-sensitive candidate
- overhead-sensitive candidate
- grip-sensitive candidate
- kneeling-sensitive candidate
- deep-range-sensitive candidate
- balance-sensitive candidate

### Decision changed

Supports exercise modification, regression, and documentation.

### Data type

Structured tags plus optional notes.

### Editable

Trainer editable in client-specific context.

### AI suggestion

Allowed, but never diagnostic.

### Versioning

Version pain-related changes and client-specific applications.

## Field 13 - Coaching cues

### Purpose

Provide simple teaching prompts.

### MVP fields

- setup cue
- execution cue
- breathing cue if relevant
- safety cue
- common correction cue

Prefer concise external cues where possible, especially for beginners.

### Decision changed

Improves teachability and consistency.

### Data type

Short text, grouped by cue type.

### Editable

Trainer editable.

### AI suggestion

Allowed for drafts, trainer approval required.

### Versioning

Version if cues are part of shared exercise template.

## Field 14 - Common errors

### Purpose

Help trainers identify predictable technique breakdowns.

### MVP fields

- error name
- observable sign
- likely consequence
- correction options
- when to regress

### Decision changed

Improves real-time coaching and safer progression.

### Data type

Structured list plus notes.

### Editable

Trainer editable.

### AI suggestion

Allowed.

### Versioning

Version shared-template changes.

## Field 15 - Range-of-motion options

### Purpose

Represent intended movement depth/amplitude and modification options.

### MVP fields

- full available ROM
- partial ROM
- pain-free ROM
- box/target depth
- elevated support
- limited range due to equipment or control

Avoid fake precision such as universal percentage ROM unless a specific measurement method exists.

### Decision changed

Supports pain-aware modification and progression.

### Data type

Structured option plus optional notes.

### Editable

Trainer editable in prescription.

### AI suggestion

Allowed.

### Versioning

Version prescribed ROM changes for a client.

## Field 16 - Loading options

### Purpose

Define how the exercise can be loaded.

### MVP options

- bodyweight
- assisted bodyweight
- external load
- machine load
- band tension
- cable load
- tempo-based difficulty
- range-based difficulty
- density-based difficulty
- incline/decline

### Decision changed

Supports intensity prescription and progression.

### Data type

Structured list.

### Editable

Trainer editable.

### AI suggestion

Allowed.

### Versioning

Version if loading options change in template or prescription.

## Field 17 - Tempo / control options

### Purpose

Represent movement speed and control emphasis.

### MVP fields

- controlled
- slow eccentric
- pause
- explosive intent
- isometric hold
- continuous rhythm

Avoid overcomplicated tempo notation in MVP unless trainer explicitly wants it.

### Decision changed

Affects skill learning, safety, hypertrophy stimulus, power intent, and fatigue.

### Data type

Structured options plus optional tempo string.

### Editable

Trainer editable.

### AI suggestion

Allowed.

### Versioning

Version client prescription changes.

## Field 18 - Media fields

### Purpose

Provide visual and instructional support.

### MVP fields

- image_url
- video_url
- media_quality_status
- demonstration_notes
- language/locale
- source/owner
- review_status

### Decision changed

Improves client understanding and reduces coaching ambiguity.

### Data type

Structured.

### Editable

Trainer/admin editable.

### AI suggestion

AI may suggest missing media needs, not fabricate authoritative technique media.

### Versioning

Version media changes and review status.

## Field 19 - Language/localization fields

### Purpose

Support multilingual trainer/client interfaces.

### MVP fields

- canonical English name
- Portuguese display name
- aliases
- client-facing simple name
- coach-facing technical name

### Decision changed

Improves clarity and avoids mixed terminology.

### Data type

Structured strings.

### Editable

Trainer/admin editable.

### AI suggestion

Allowed, human review recommended.

### Versioning

Version canonical and client-facing naming changes.

## Field 20 - Audit/versioning fields

### Purpose

Preserve what changed, why, and who changed it.

### MVP fields

- created_at
- updated_at
- created_by
- updated_by
- version
- change_reason
- reviewed_by
- status

### Decision changed

Protects data integrity, supports professional accountability, and allows later product learning.

### Data type

Structured audit metadata.

### Editable

System-controlled.

### AI suggestion

No.

### Versioning

Mandatory.

## Unknown exercise handling

If a trainer adds an unknown exercise, Protocol should create a provisional exercise template.

Minimum required fields:

- name
- movement pattern
- equipment category
- primary target or intent
- difficulty estimate
- setup notes
- caution tags if relevant

Unknown exercises should not enter the verified global library automatically.

AI may suggest classification, but the trainer must approve.

Unknown exercises used in a plan should be traceable historically.

## Free-text policy

Free text is allowed for:

- coaching nuance
- trainer notes
- setup notes
- context-specific modifications
- subjective observations

Free text is not enough for:

- exercise identity
- movement pattern
- muscles
- equipment
- substitutions
- caution tags
- volume tracking
- audit
- analytics

## Beginner-trainer usability

The interface should begin with simple filters:

1. goal
2. body region or movement pattern
3. equipment
4. difficulty
5. pain/limitation constraints
6. regression/progression options

Do not expose the whole taxonomy at once.

Beginner trainers need guided options, not a biomechanics encyclopedia.

## MVP now

MVP exercise taxonomy requires:

- stable exercise identity
- names and aliases
- movement pattern
- primary/secondary muscles
- equipment
- difficulty
- basic setup
- regression/progression links
- simple substitution logic
- caution tags
- pain-modification tags
- coaching cues
- common errors
- loading options
- media fields
- audit fields

## Advanced later

Later versions may add:

- muscle contribution weighting
- detailed force vectors
- joint-angle modeling
- velocity/power profiles
- advanced contraindication engine
- individualized substitution scoring
- clinician-provided restrictions
- exercise media quality grading
- localization review workflow
- exercise effectiveness analytics

## Open issues for validation

Caution tags must not become hidden medical claims.

Exercise contraindications must be context-specific and trainer-scope safe.

Taxonomy must remain extensible without becoming unusable.

Unknown exercise workflow must prevent free-text drift.

Exercise template, prescription, and logged performance must remain separate in the database.