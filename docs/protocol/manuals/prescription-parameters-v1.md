# prescription-parameters-v1

## Status

Draft v1 distilled from Protocol Core Stack output 3. This is a product-domain manual for the Protocol prescription cockpit. It defines the control variables the system should store, expose, version, and audit.

This manual does not generate workouts. It defines the prescription control system.

## Core principle

Protocol prescription must be controlled by explicit parameters, not hidden inside prompts.

Every plan should answer:

- what is the goal?
- what is safe?
- what is feasible?
- what is the minimum effective starting dose?
- what should progress?
- what should stay stable?
- what needs trainer approval?
- what data is missing?

AI may suggest prescription parameters, but the trainer approves the final plan.

## Source hierarchy

When sources conflict, Protocol prioritizes:

1. safety and scope of practice
2. practical personal-trainer usability
3. adherence and feasibility
4. exercise science
5. periodization theory
6. movement frameworks
7. product/software workflow

## Parameter 1 - Goal

### Purpose

Defines the primary training objective and the hierarchy of secondary objectives.

### Decisions changed

- exercise emphasis
- volume allocation
- intensity target
- cardio/resistance balance
- progression criteria
- success metrics
- session structure

### MVP values

- general health
- fat loss/body recomposition
- hypertrophy
- strength
- endurance/cardiorespiratory fitness
- mobility/movement quality
- return to training
- pain-aware training support

### Advanced later

- sport-specific performance
- power
- concurrent training specialization
- special population goals
- competition peaking

### Missing data behavior

If no goal is provided, default to general health and consistency, not aggressive optimization.

### Authority

Client states the goal. Trainer validates feasibility and safety. AI may summarize goal conflicts but should not choose the goal alone.

### Versioning

Version goal changes historically because they explain why prescription changes over time.

## Parameter 2 - Training level

### Purpose

Defines the client’s current training status and technical competence.

### Decisions changed

- exercise complexity
- starting volume
- loading intensity
- progression speed
- coaching density
- failure proximity
- need for movement preparation

### MVP levels

- new/inactive
- returning after break
- beginner
- intermediate
- advanced

### Missing data behavior

If uncertain, treat as beginner/returning and start conservatively.

Do not assume advanced status from confidence, appearance, or client self-belief alone.

### Authority

Trainer approval required. AI may suggest level from history, adherence, logs, and performance data.

### Versioning

Version historically, because level can change across months and can differ by movement pattern.

## Parameter 3 - Frequency

### Purpose

Defines how many sessions occur per week and how training stress is distributed.

### Decisions changed

- split structure
- weekly volume distribution
- recovery demands
- adherence feasibility
- session length
- exercise selection density

### MVP fields

- available training days/week
- preferred days
- minimum realistic frequency
- maximum realistic frequency
- supervised vs independent sessions

### Missing data behavior

Ask for availability. If missing, suggest a conservative low-friction default, typically 2-3 sessions/week depending on goal and context.

Do not assume high frequency until adherence is proven.

### Authority

Trainer and client decide. AI may suggest based on goal, recovery, and schedule.

### Versioning

Version because life schedule and adherence change.

## Parameter 4 - Intensity

### Purpose

Defines effort/load target for resistance and aerobic work.

### Decisions changed

- safety
- adaptation stimulus
- fatigue
- recovery need
- progression rate
- exercise selection

### MVP intensity tools

Resistance training:

- RPE/RIR
- load used
- repetition target
- technique quality

Aerobic training:

- talk test
- RPE
- duration
- HR if available and appropriate

### Advanced later

- %1RM
- %HRR
- lactate/threshold zones
- velocity-based training
- power zones
- HRV-informed readiness

### Missing data behavior

If load capacity is unknown, use RPE/RIR and conservative starting loads.

If HRmax or zones are unknown, use talk test and RPE instead of crude formulas as the primary fallback.

### Authority

Trainer approves targets. AI may suggest target ranges.

### Versioning

Version because intensity targets explain fatigue, adaptation, and safety decisions.

## Parameter 5 - Duration / session time

### Purpose

Defines the time budget for each session and protects adherence.

### Decisions changed

- exercise count
- warm-up length
- density
- rest intervals
- conditioning dose
- complexity

### MVP fields

- target session duration
- minimum acceptable session duration
- maximum realistic session duration
- warm-up included yes/no
- cardio included yes/no

### Missing data behavior

Ask. If missing, use a practical default such as 30-45 minutes, then adjust from adherence.

### Authority

Trainer and client decide. AI may compress or simplify the session.

### Versioning

Version when duration changes, because it changes the plan structure.

## Parameter 6 - Type / modality

### Purpose

Defines training modalities used in the program.

### Decisions changed

- exercise library filters
- equipment needs
- skill demand
- cardio/resistance balance
- progression path

### MVP modalities

- resistance training
- aerobic training
- mobility/movement preparation
- balance/stability
- bodyweight training
- machine-based training
- free-weight training
- band/cable training

### Missing data behavior

If modality preference or equipment is missing, default to low-skill, low-equipment options and ask for clarification.

### Authority

Trainer approves. AI may suggest options from constraints.

### Versioning

Version if modality emphasis changes across blocks.

## Parameter 7 - Volume

### Purpose

Defines amount of work performed.

### Decisions changed

- adaptation stimulus
- fatigue
- recovery demand
- soreness risk
- time demand
- progression speed

### MVP volume units

- sets
- reps
- exercises per movement/muscle group
- weekly hard sets by major target area
- aerobic minutes
- session count

### Advanced later

- tonnage
- effective reps
- volume landmarks
- muscle-specific MEV/MAV/MRV estimates
- acute:chronic workload ratios

### Missing data behavior

If tolerance is unknown, start near conservative minimum effective dose and progress from session feedback.

Do not over-prescribe because the goal is ambitious.

### Authority

Trainer approves. AI may suggest starting ranges.

### Versioning

Version volume because it is central to adaptation and fatigue tracking.

## Parameter 8 - Progression

### Purpose

Defines how training stress changes over time.

### Decisions changed

- when to add load
- when to add reps
- when to add sets
- when to increase duration
- when to change exercise difficulty
- when to hold or regress

### MVP progression signals

Progress if:

- target work completed
- RPE/RIR within target
- technique acceptable
- pain stable or absent
- recovery acceptable
- adherence acceptable

Hold or regress if:

- pain increases
- technique degrades
- RPE unexpectedly high
- adherence fails
- fatigue accumulates
- recovery poor
- client confidence drops

### Missing data behavior

If feedback is missing, do not auto-progress aggressively.

Use “hold current dose” or “trainer review required.”

### Authority

Trainer approval required. AI may suggest progression options.

### Versioning

Version every progression rule and progression decision.

## Parameter 9 - Recovery

### Purpose

Defines recovery between sets, sessions, and blocks.

### Decisions changed

- rest intervals
- weekly spacing
- deload need
- exercise order
- intensity distribution
- session density

### MVP fields

- inter-set rest
- rest days between similar stressors
- soreness duration
- sleep quality
- fatigue rating
- deload/reduction flag

### Advanced later

- planned deloads
- autoregulated deload triggers
- HRV/readiness trends
- condition-specific recovery rules

### Missing data behavior

If recovery is unknown, avoid high-density or high-volume prescriptions until response is observed.

### Authority

Trainer approves. AI may suggest adjustments.

### Versioning

Version recovery policies and deload decisions.

## Parameter 10 - Equipment

### Purpose

Defines what exercises are possible.

### Decisions changed

- exercise selection
- substitution logic
- loading options
- session logistics
- home/gym compatibility

### MVP equipment fields

- no equipment
- bodyweight only
- bands
- dumbbells
- kettlebells
- barbell
- machines
- cable station
- cardio machines
- space constraints

### Missing data behavior

Assume no equipment until confirmed.

### Authority

Trainer/client provide. AI should not invent available equipment.

### Versioning

Version only when equipment access changes meaningfully.

## Parameter 11 - Pain / limitation constraints

### Purpose

Prevents prescription from ignoring pain, injury history, or movement limitations.

### Decisions changed

- exercise inclusion/exclusion
- range of motion
- load
- tempo
- modality
- progression speed
- referral need

### MVP fields

- pain location
- current vs historical
- severity
- irritability
- aggravating movements
- easing modifications
- red flags
- trainer action taken

### Missing data behavior

Do not assume pain-free. Mark as “no pain reported” or “pain status unknown.”

Monitor session feedback and require review if pain appears.

### Authority

Trainer approval required. AI may suggest conservative modifications but must not diagnose or treat.

### Versioning

Mandatory.

## Parameter 12 - Adherence constraints

### Purpose

Keeps the plan executable in real life.

### Decisions changed

- frequency
- duration
- exercise complexity
- number of independent tasks
- communication strategy
- progression speed
- friction reduction

### MVP fields

- schedule constraints
- motivation/confidence
- perceived barriers
- preferred training style
- supervision level
- history of dropout
- home practice feasibility

### Missing data behavior

If adherence risk is unknown, keep the first plan simple and low-friction.

### Authority

Trainer and client. AI may flag risk and suggest simplification.

### Versioning

Version because adherence barriers change and explain plan changes.

## Parameter 13 - Trainer preference / override

### Purpose

Preserves trainer authority and professional accountability.

### Decisions changed

Any prescription decision can be overridden by the trainer within scope.

### MVP fields

- parameter changed
- previous value
- new value
- reason
- timestamp
- trainer ID
- AI suggestion accepted/rejected if relevant

### Missing data behavior

Not applicable. Overrides require explicit reason.

### Authority

Trainer only.

### Versioning

Mandatory permanent audit trail.

## Parameter 14 - Risk / screening constraints

### Purpose

Ensures prescription respects screening outputs.

### Decisions changed

- allowed intensity
- allowed testing
- need for clearance
- contraindicated activities
- supervision level
- emergency caution

### MVP fields

- risk flags
- screening status
- referral/clearance status
- missing-data flags
- symptom flags
- BP/HR context when available
- medical/scope warnings

### Missing data behavior

Missing risk data creates provisional status and conservative prescription limits.

Do not claim the client is fully screened when key data is absent.

### Authority

Hard safety warnings are deterministic. Trainer approves practical plan within scope. Medical clearance remains medical scope.

### Versioning

Mandatory.

## MVP prescription cockpit

MVP cockpit should expose:

- goal
- training level
- weekly frequency
- session duration
- equipment
- modality mix
- intensity target
- volume target
- progression rule
- recovery/rest setting
- pain/limitation constraints
- adherence constraints
- risk/screening constraints
- trainer override notes

## Advanced later

Advanced cockpit may add:

- MEV/MAV/MRV by muscle group
- concurrent training interference management
- block periodization models
- HRV/readiness integration
- velocity-based training
- detailed energy-system targeting
- special-population rules
- clinician-provided constraints
- nutrition/recovery integration

## Decision authority summary

Deterministic:

- missing-data flags
- scope warnings
- screening constraints
- audit record creation

Trainer approval required:

- final prescription
- progression/regression
- pain-related modification
- exercise substitution
- override

AI-assisted:

- parameter suggestions
- pattern detection
- conservative starting ranges
- fatigue/adherence warnings
- alternative options

Never automated:

- diagnosis
- treatment
- medical clearance
- final trainer responsibility

## Open issues for validation

Exact BP thresholds must be validated before implementation.

Volume defaults should be conservative and not hardcoded universally.

Progression percentages should be goal-, level-, exercise-, and context-specific.

Pain constraints require alignment with the pain-and-modification manual before plan generation.

Concurrent training needs its own later refinement layer.

Do not allow free-text prompts to become the hidden source of prescription truth.