# screening-risk-rules-v1

## Status

Draft v1 distilled from Protocol Core Stack output 2. This is a product-domain manual for trainer decision support, not medical diagnosis, clinical testing, or emergency-care instruction.

## Core principle

Protocol must separate screening rules by context.

A rule that is valid during a clinical exercise test may be unsafe, impractical, or misleading in a normal personal-training session.

Protocol should help the trainer decide whether to proceed, modify, delay, refer, or request medical clearance. It should not diagnose, treat, or replace clinical judgment.

## Source hierarchy

When sources or frameworks conflict, Protocol prioritizes:

1. safety and scope of practice
2. practical personal-trainer usability
3. exercise science
4. movement frameworks
5. product/software workflow

## Context 1 - Baseline screening before prescription

### Purpose

Establish the client’s starting state before exercise prescription.

Baseline screening answers:

- Can exercise begin?
- Should intensity be limited?
- Is medical clearance needed?
- What data is missing?
- What must the trainer watch more carefully?

### Realistic MVP measurements

Collect:

- informed consent
- current physical activity status
- intended exercise intensity
- known cardiovascular, metabolic, renal, respiratory, neurological, or relevant medical conditions
- current signs/symptoms
- relevant medications
- resting blood pressure when available
- resting heart rate when available
- pain/injury/limitation status
- pregnancy/postpartum status when relevant

### Blood pressure at baseline

Resting BP should be measured before prescription whenever possible.

If BP is unavailable, Protocol marks BP as missing and lowers screening confidence.

Protocol should not diagnose hypertension. It should classify the measurement as a screening concern and suggest appropriate next steps.

High or very high resting BP should trigger conservative intensity choices and/or medical follow-up, especially before vigorous exercise.

Severely elevated BP or elevated BP with symptoms should trigger urgent medical guidance rather than training progression.

### What not to measure routinely

Do not require lab data, ECG, gas exchange, blood lactate, imaging, or clinical testing for MVP.

Do not require mid-exercise physiological monitoring before a basic program has even started.

### Caution flags

- known cardiovascular, metabolic, renal, respiratory, neurological, or complex medical condition
- current or recent concerning symptoms
- relevant medication affecting HR, BP, glucose, balance, thermoregulation, fatigue, or pain perception
- current unresolved pain or recent surgery
- pregnancy/postpartum status without appropriate branch logic
- missing key health data
- very low activity history combined with ambitious intensity goal

### Referral triggers

Baseline referral or medical clearance may be needed when the client reports:

- chest pain or chest discomfort at rest or during exertion
- unexplained syncope, fainting, or dizziness
- unusual shortness of breath disproportionate to effort
- unexplained palpitations or irregular heartbeat symptoms
- known disease requiring medical exercise guidance
- recent surgery or unresolved injury outside trainer scope
- neurological symptoms
- severe or unexplained pain

### Missing-data handling

Incomplete data does not automatically mean “high risk.”

It means “provisional.”

Provisional status should limit confidence and may limit intensity, testing, and automatic progression until screening is completed.

### Output states

- cleared for normal trainer-led exercise
- provisionally cleared with limits
- proceed only with conservative/light-to-moderate start
- needs trainer review before prescription
- needs medical clearance before vigorous exercise
- refer / do not start until clarified

## Context 2 - Optional pre-session checks for flagged clients

### Purpose

Decide whether today’s session should proceed normally, be modified, delayed, or cancelled.

This is not for every client. It is for flagged clients only.

### Who may need pre-session checks

- known hypertension
- known cardiovascular/metabolic condition
- diabetes or glucose-risk concern
- medication changes
- clinician-provided exercise limits
- recent unusual symptoms
- high fatigue or recovery concern
- return after illness, injury, or long absence

### Realistic measurements

Collect only what is relevant:

- subjective readiness
- sleep/fatigue/stress
- symptoms today
- medication adherence where relevant
- resting HR where relevant
- resting BP where relevant
- glucose status only if client has relevant condition and appropriate self-monitoring practice
- pain status and irritability

### What not to measure routinely

Do not run full assessments daily.

Do not measure anthropometrics daily.

Do not create a medical monitoring workflow for healthy clients.

Do not use pre-session checks to diagnose.

### Modification triggers

- unusual fatigue
- poor sleep plus high planned intensity
- elevated symptoms or “feeling off”
- pain increase from baseline
- technique readiness clearly reduced
- medication missed or changed when relevant
- BP/HR concern in a flagged client

### Output states

- proceed as planned
- reduce intensity
- reduce volume
- change modality
- replace exercise
- perform recovery/mobility session
- delay session
- refer or request medical guidance

## Context 3 - Formal fitness testing

### Purpose

Measure capacity or performance under a defined test context.

Formal testing is different from normal training.

### Realistic measurements

Depending on test:

- baseline resting BP/HR when relevant
- HR response when relevant
- RPE
- test-specific output
- technique quality
- symptoms
- reason for stopping
- test validity notes

### Blood pressure during testing

Measure BP at baseline when relevant.

Mid-test BP belongs mainly to formal monitored testing or clinical/symptom-limited protocols where measurement is feasible and reliable.

Do not apply clinical exercise-testing BP stop criteria blindly to ordinary gym tests or normal workouts.

If BP is monitored during a formal test, exaggerated BP response and abnormal BP response may be stop criteria according to the relevant protocol.

### Stop triggers

Stop the test if there is:

- chest pain or angina-like symptoms
- dizziness, syncope, or near-syncope
- severe or unusual shortness of breath
- pallor, cyanosis, confusion, or signs of poor perfusion
- loss of control
- significant technique breakdown that compromises safety
- severe pain
- client requests to stop
- abnormal monitored physiological response within a formal protocol

### Output states

- valid test result
- invalid result due to protocol error
- stopped due to symptoms
- stopped due to technique breakdown
- retest needed
- referral flag generated

## Context 4 - Normal training sessions

### Purpose

Execute the prescribed stimulus safely and adjust in real time.

Normal sessions are not lab tests.

### Realistic measurements

Collect:

- exercises performed
- sets, reps, load, duration, rest
- RPE or session RPE
- pain/discomfort notes
- technique notes
- adherence/completion
- exercise substitutions
- trainer modifications
- client feedback

### What not to measure routinely

Do not routinely measure BP mid-session.

Do not treat every normal session as a formal fitness test.

Do not over-monitor healthy low-risk clients to the point that the app becomes unusable.

HR may be useful for cardio intensity, but it is not mandatory for every session.

### Modification triggers

Modify, regress, or stop an exercise when there is:

- pain provocation
- technique deterioration
- loss of control
- RPE much higher than expected
- unusual fatigue
- inability to complete prescribed work safely
- dizziness or unusual breathlessness
- client anxiety or confidence breakdown
- equipment mismatch

### Pain handling during normal sessions

Pain does not automatically mean medical referral.

First trainer-level responses may include:

- reduce load
- reduce range of motion
- slow tempo
- change exercise variation
- change modality
- stop that specific exercise
- document the trigger

Refer when pain is severe, persistent, worsening, unexplained, associated with neurological signs, or does not respond to reasonable modification/rest.

### Output states

- completed as planned
- completed with modifications
- exercise regressed
- exercise removed
- session reduced
- session stopped
- referral flag generated
- reassessment needed

## Context 5 - Emergency and referral situations

### Purpose

Protect the client and keep the trainer inside scope.

### Immediate stop triggers

Stop activity immediately when there is:

- chest pain or pressure
- fainting, syncope, or near-syncope
- severe dizziness
- confusion
- clammy skin or signs of poor perfusion
- cyanosis
- severe unexplained shortness of breath
- neurological symptoms
- sudden unusual weakness
- severe acute pain
- loss of motor control
- client requests to stop

### Referral triggers

Refer or request medical guidance when there is:

- new cardiovascular-type symptom
- unexplained breathlessness, dizziness, or palpitations
- persistent pain that does not improve with modification/rest
- suspected injury outside trainer scope
- neurological symptoms
- recent surgery without clearance
- severe BP concern at rest
- any need for diagnosis or treatment

### Scope rule

Trainer screens, observes, modifies, documents, and refers.

Trainer does not diagnose, treat, clear medically, or interpret complex clinical findings.

## Decision authority

### Deterministic rules

- consent required before assessment/training
- missing-data warnings
- symptom flags
- scope warnings
- emergency stop prompts
- referral prompts when clearly outside trainer scope
- audit record creation for major state changes

### Trainer approval required

- final prescription approval
- progression/regression
- exercise substitution
- decision to proceed with limitations
- decision to stop a session
- referral follow-up within trainer scope

### AI-assisted suggestions

- summarize screening data
- flag contradictions
- highlight missing data
- suggest conservative modifications
- identify trend patterns
- suggest questions for trainer review

### Never automated

- diagnosis
- treatment
- medical clearance
- emergency medical decisions
- clinical interpretation of unexplained symptoms
- final responsibility for trainer decisions

## Data to store historically

- screening date and version
- raw answers
- missing-data fields
- symptoms reported
- known conditions reported
- medication notes
- BP/HR values and measurement context
- risk flags
- referral/clearance status
- trainer decision
- AI suggestion if used
- trainer override reason
- session stop/modification events

## MVP now

MVP needs:

- baseline screening before prescription
- provisional status for incomplete data
- resting BP/HR support
- symptom flags
- known condition flags
- pain/injury flags
- basic referral prompts
- normal-session modification logic
- audit trail for trainer overrides and referrals

## Advanced later

Later versions may include:

- condition-specific screening branches
- pregnancy/postpartum branch
- diabetes-specific pre-session logic
- clinician instruction upload
- formal test protocol library
- HRV/readiness trend logic
- integration with wearables
- longitudinal risk-state evolution

## Product language

Use “decision support,” “flags,” “suggestions,” “trainer approval,” and “scope warning.”

Avoid language that implies Protocol is diagnosing, treating, medically clearing, or autonomously prescribing for clinical populations.

## Open issues for validation

Exact BP thresholds must be validated against the current target guideline set before implementation.

PAR-Q+ wording/licensing must be checked before copying text directly.

Emergency guidance must be localized to the target market and should be legally reviewed.

Special-population branches require dedicated manuals before automation.

Normal-session rules must stay practical enough for real gyms, homes, and low-equipment contexts.