# Round 1 Closeout + NSCA Park

Pure admin. No code, no DB, no ingestion. Mirrors the Bompa parking pattern.

## 1. Park the NSCA PDF

- Copy `user-uploads://NSCAs_Essentials_of_Personal_Training_...pdf` → `/mnt/documents/nsca-essentials-3e.pdf` (server-only, outside repo).
- Append `/mnt/documents/nsca-essentials-3e.pdf` to `.gitignore` in the same block as `acsm-12e.pdf` and `bompa-buzzichelli-6e.pdf`.
- Create `.lovable/nsca-essentials-3e-source.txt` mirroring `bompa-buzzichelli-6e-source.txt`:
  - Title: NSCA's Essentials of Personal Training, 3rd Edition (2022)
  - Editors: Brad J. Schoenfeld, Ronald L. Snarr
  - Publisher: Human Kinetics · ISBN 978-1-4925-9521-2
  - PDF location: `/mnt/documents/nsca-essentials-3e.pdf` (agent-only, never bundled)
  - Status: **PARKED** — not ingested in Round 1; slot decision pending (Hypothesis A: Round 3.5 after population overlays; Hypothesis B: Round 2.7 between Bompa and overlays — preference A)
  - IP rule: identical to ACSM/Bompa — never verbatim prose, only paraphrased rules + derived facts + `NSCA Essentials 3e §X.Y` citations; server-only RLS deny-all for prose, trainer-readable for derived facts when ingested
  - Note on Model B: source-agnostic schema (`periodization_phases`, `exercise_recommendations`, `population_overlays` with `source` column) extends to NSCA when ingested — enables cross-source agreement/conflict detection across ACSM 12e + Bompa 6e + NSCA 3e

## 2. Update `.lovable/backlog.md`

**Concluído** — append:

- Round 1 — ACSM 12e ingestion + gap report ✅ (3 Mai 2026) → see `.lovable/acsm-12e-gap-report.md` (8 ch · 22 sec · 59 rec · 79 contra · 167 norm · 37 pop)

**Em aberto** — replace/extend with the rounds roadmap:


| #   | P   | Round        | Item                                                                                                                                                                                                                                                                                                                        | Status  |
| --- | --- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 45  | P0  | R2           | FITT-VP backbone + citations: structured `workout_plans.prescription_parameters`, submax VO₂ test (Rockport/1.5-mi/Ebbeling), 9 cardinal signs/symptoms checklist in intake. Auto-adopt 17 thresholds from gap report §E (all more conservative — zero blocking decisions).                                                 | next    |
| 46  | P1  | R2.5         | Bompa & Buzzichelli 6e ingestion — periodization layer above FITT-VP. **Model B approved**: source-agnostic `periodization_phases` / `_sequences` / `_microcycle_patterns` with `source` + `citation` columns.                                                                                                              | planned |
| 47  | P1  | R3           | Special-population overlays — ~18 populations falling silently through (gap report §D): pediatric, pregnancy, older-adult/frailty, LBP, HTN, T1D, T2D, dyslipidemia, obesity, MASLD, asthma, COPD, stroke, Parkinson's, MS, depression, cancer survivors, osteoporosis. Includes 12e-new (POTS, ME/CFS, SCAD, transgender). | planned |
| 48  | P2  | R3.5 vs R2.7 | NSCA Essentials 3e ingestion — exercise selection / cuing / technique / applied programming layer. **Open question**: Hypothesis A = Round 3.5 (after overlays, plug substitutions on top); Hypothesis B = Round 2.7 (before overlays, so overlays can cite specific exercises). Preference A. Decide when we get there.    | parked  |
| 49  | P2  | R4           | Behaviour-change scaffolding — ACSM Ch. 12 (transtheoretical model, motivational interviewing hooks, goal-setting templates).                                                                                                                                                                                               | parked  |
| 50  | P2  | Future       | McGill — Ultimate Back Fitness and Performance (2014). Specialized LBP overlay; depends on Round 3 overlay infrastructure existing first.                                                                                                                                                                                   | parked  |


Add a short note at the bottom under a new **"Cross-source policy"** line:

> Bompa 6e + NSCA 3e + ACSM 12e share genuine overlap (training variables, populations, assessment). Model B (source-agnostic tables with `source` discriminator) extends to all three — surfaces agreement (strong signal) vs disagreement (resolve manually).

## 3. Deliverable message back to user

Short confirmation:

- Backlog updated (paths + summary of new R2 / R2.5 / R3 / R3.5(parked) / R4(parked) / Future-McGill rows)
- NSCA archived (`.lovable/nsca-essentials-3e-source.txt` created, `.gitignore` updated, PDF at `/mnt/documents/nsca-essentials-3e.pdf`)
- **Confirmed: zero NSCA ingestion** — no DB writes, no extraction, no schema changes
- Standing by for Round 2 go-ahead

## Out of scope (explicit)

- No Round 2 work. No FITT-VP schema. No submax test UI. No signs/symptoms intake.
- No NSCA extraction script. No new tables. No migrations.
- No code changes outside `.lovable/` and `.gitignore`.

**RESPOSTA PARA O LOVABLE:**

---

Plano aprovado tal como está. Executa exatamente o que descreveste — admin only, zero código, zero DB, zero ingestion. Zero desvios.

Confirmações antes de começares:

- **Modelo B aprovado** para periodization_phases / exercise_recommendations / population_overlays com `source` discriminator — vai estender-se a Bompa 6e e NSCA 3e quando forem ingeridos. Confirmado.
- **Hypothesis A é a preferência** para o slot do NSCA (Round 3.5, depois dos overlays). Hypothesis B fica registada como alternativa em aberto. Decidimos quando lá chegarmos.
- **Cross-source policy line** aprovada — exatamente como descreveste.
- **R2 fica em standby**. Não inicies. Espera ordem explícita.

Quando terminares, devolve a mensagem curta de confirmação que já planeaste (backlog updated path + NSCA archived + zero ingestion + standing by).

Avança.