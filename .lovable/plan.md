```text
R70 — Non-Adversarial Landing Copy Pass

Objective:
Make Protocol’s public positioning calmer, more premium, and non-adversarial.

Protocol should sell by showing what the trainer gains, not by diminishing Excel, ChatGPT, Trainerize, RP Strength, generic apps, or any other tool.

The user should connect the dots naturally.

This is a copy/positioning pass, not a redesign and not a feature round.

======================================================================
CORE POSITIONING RULE
======================================================================

Adopt this rule:

No adversarial visible positioning.

Never sell Protocol by attacking or diminishing other tools in user-facing copy.

Avoid visible copy such as:
- “sem viver no Excel”
- “melhor que ChatGPT”
- “mais controlável que ChatGPT”
- “Excel guarda dados, Protocol liga”
- “apps genéricas fazem X, Protocol faz Y”
- “vs Trainerize”
- “vs ChatGPT”
- “vs Excel”
- “vs RP Strength”

The tone should be:
- calm
- premium
- self-contained
- confident
- professional
- non-combative

Sell:
- workflow
- clarity
- structure
- continuity
- professional delivery
- coach control
- operational usefulness

Do not sell by creating enemies.

======================================================================
WHY THIS MATTERS
======================================================================

A premium product does not need to attack other tools.

Protocol should make the trainer think:

“This connects the pieces of my work.”

Not:

“This brand is trying to win by insulting what I already use.”

We want the user to infer the value.

Do not force the comparison.

======================================================================
SAVE POSITIONING RULE
======================================================================

Create or update positioning docs.

Preferred:
1. Create/update:
`mem/positioning/non-adversarial.md`

Include:
- rule summary
- forbidden visible phrasing
- preferred PT examples
- preferred EN examples
- comparison-section reframing rule

2. Update:
`mem/positioning/sharp.md`

Remove or soften matrix language built around:
- vs Trainerize
- vs ChatGPT
- vs Excel
- vs RP Strength
- generic app takedowns

Keep only positive, self-contained positioning.

Do not delete useful product truth.
Just remove adversarial framing.

Avoid touching `mem/index.md` unless this project already requires positioning rules to be indexed there. If an index update is needed, add only a one-line pointer to `mem/positioning/non-adversarial.md`.

======================================================================
AUDIT CURRENT LANDING COPY
======================================================================

Before editing, audit user-facing copy for adversarial framing.

Search these surfaces:

- `src/i18n/locales/{pt,en,es,hi}/plan.json`
- landing-related keys in other locale files if landing copy lives elsewhere
- `src/routes/index.tsx`
- `src/components/landing/*`
- any currently rendered landing section

Flag every visible/user-facing line that:
- names a competitor/tool
- implies “we are better because they are worse”
- uses negative contrast to create value
- frames Excel, ChatGPT, Trainerize, RP Strength, or generic apps as the enemy
- uses “sem viver no Excel”
- uses “melhor que”
- uses “vs”
- uses “guarda dados” as a contrast line

Create audit file before editing:
`.lovable/r70-copy-audit.md`

Audit table format:
- file
- key/line
- current copy
- issue
- proposed replacement
- implement now / proposal only

Important:
Do not count internal component names as copy if they are not visible to the user.

Example:
If `AntiChatGPTSection` remains as an internal component name but no visible copy says “ChatGPT”, that is acceptable for this round.

Do not rename internal components unless trivial and low-risk.

It is acceptable for adversarial terms to appear inside:
- audit documents
- positioning docs explaining what to avoid
- internal notes
- non-rendered comments

It is not acceptable for adversarial framing to appear in rendered landing copy.

======================================================================
COPY REPLACEMENT RULES
======================================================================

Replace flagged visible copy with positive, self-contained copy.

Do not say:
“Protocol is better than X.”

Say:
“Protocol helps the trainer connect Y.”

Preferred PT examples:
- “Da avaliação ao plano, com lógica visível.”
- “Avaliação estruturada, protocolo editável, adaptação baseada no log.”
- “Menos dispersão. Mais continuidade entre avaliação, plano e execução.”
- “Organize clientes, sessões, planos e progresso num só fluxo.”
- “O treinador mantém o controlo: revê, ajusta e aprova.”
- “Cada plano nasce de dados concretos: objetivo, disponibilidade, equipamento, limitações e histórico.”
- “Ligue avaliação, plano, sessões, logbook, adaptação e progresso.”
- “Estruture o acompanhamento sem espalhar decisões por ferramentas soltas.”

Preferred EN examples:
- “From assessment to plan, with visible logic.”
- “Structured assessment, editable protocol, log-based adaptation.”
- “Less fragmentation. More continuity between assessment, plan, and execution.”
- “Organize clients, sessions, plans, and progress in one workflow.”
- “The coach stays in control: review, adjust, and approve.”
- “Each plan starts from concrete inputs: goal, availability, equipment, limitations, and history.”
- “Connect assessment, plan, sessions, logbook, adaptation, and progress.”
- “Structure coaching without scattering decisions across disconnected tools.”

Use these as voice reference.
Do not paste blindly if the surrounding layout needs shorter copy.

======================================================================
SPECIFIC REQUIRED REPLACEMENT
======================================================================

Flag this current line:

PT:
“Programação séria, sem viver no Excel.”

Replace with a positive line.

Preferred PT:
“Da avaliação ao plano, com lógica visível.”

Preferred EN:
“From assessment to plan, with visible logic.”

If the hero already has assessment/protocol/adaptation language and this becomes repetitive, use:

PT:
“Menos dispersão. Mais decisões estruturadas.”

EN:
“Less fragmentation. More structured decisions.”

======================================================================
COMPARISON SECTION REFRAME
======================================================================

Problem:
A classic comparison table with competitor columns is structurally adversarial and difficult to read on mobile.

Do not frame the section as:
“Protocol vs Excel vs ChatGPT vs apps.”

Reframe it as:

PT title:
“Ligue o que normalmente fica separado”

EN title:
“Connect what usually stays separate”

Use the same existing section slot.
Do not add a new route.
Do not add a new major section.
Do not redesign the whole landing.

Replace competitor-column logic with a workflow connector.

Suggested PT items:
1. Avaliação
“Dados do cliente antes do plano.”

2. Plano
“Estrutura editável para o treinador rever.”

3. Sessões
“Agenda ligada ao acompanhamento real.”

4. Logbook
“O que foi feito, não apenas o que foi prescrito.”

5. Adaptação
“A semana seguinte responde à execução.”

6. Progresso
“Tendências, consistência e resultados visíveis.”

Suggested EN items:
1. Assessment
“Client inputs before the plan.”

2. Plan
“Editable structure for the coach to review.”

3. Sessions
“Schedule connected to real coaching work.”

4. Logbook
“What was done, not only what was prescribed.”

5. Adaptation
“The next week responds to execution.”

6. Progress
“Trends, consistency, and visible outcomes.”

Use cards/chips/grid only if it fits the existing layout cleanly.

If the existing comparison component cannot support this without layout risk:
- return a proposal instead of implementing a heavy refactor.

======================================================================
ANTI-COMPETITOR SECTION
======================================================================

If there is a rendered section such as `AntiChatGPTSection`, do not keep visible anti-ChatGPT positioning.

Options, in priority order:

1. Replace visible copy with neutral workflow-continuity framing.

Preferred PT:
“O valor não está numa resposta isolada. Está na sequência: avaliar, estruturar, executar, registar e adaptar.”

Preferred EN:
“The value is not a single answer. It is the sequence: assess, structure, execute, log, and adapt.”

2. If replacement is risky, hide the section using an existing visibility flag.

3. If hiding/removing risks layout regressions, leave the internal component but remove adversarial visible copy.

Do not delete files in this round unless trivial.

======================================================================
LOCALES
======================================================================

Do not change the project’s global source-of-truth architecture.

For this round:
- PT and EN must be human-authored.
- ES and HI may mirror EN if that is the current project convention.
- Do not invent new ES/HI translations unless that is already the project’s pattern.

All user-facing copy must go through i18n.

No hardcoded user-facing strings.

======================================================================
OUT OF SCOPE
======================================================================

Do not implement:
- truth/clinical terminology cleanup
- revenue privacy mode
- full-app QA
- MVP-loop audit
- new landing sections
- new components unless tiny and already consistent
- new routes
- animations
- new dependencies
- pricing logic changes
- auth changes
- billing changes
- schedule changes
- schema changes
- server functions
- engine/generation/PKL changes

The clinical/diagnostic cleanup and revenue privacy mode are separate rounds.

Do not mix them into this one.

======================================================================
VERIFICATION
======================================================================

Run:
- `tsc --noEmit`

Smoke:
- landing desktop
- landing mobile 375px
- landing mobile 390px
- hard refresh `/`
- no hook crash
- no horizontal overflow
- comparison/connector section readable on mobile

Search after changes.

Important:
The goal is not zero mentions of competitor/tool names across the entire codebase.

The goal is zero visible adversarial landing copy.

Run a search for likely visible copy references in landing/locales:

`rg -i "excel|chatgpt|trainerize|rp strength|generic app|apps genéricas|melhor que|sem viver|guarda dados|vs " src/i18n/locales src/routes/index.tsx src/components/landing`

Classify remaining hits:
- rendered adversarial copy → must fix
- internal component/function name → acceptable if not visible
- audit/positioning doc explaining what to avoid → acceptable
- comments/non-rendered notes → acceptable, mention in report if relevant

No rendered landing copy should attack another tool.

======================================================================
EXPECTED FILES
======================================================================

Likely files:
- `mem/positioning/non-adversarial.md`
- `mem/positioning/sharp.md`
- `.lovable/r70-copy-audit.md`
- `src/i18n/locales/{pt,en,es,hi}/plan.json`
- `src/routes/index.tsx`
- `src/components/landing/*` if rendered copy exists there

Optional:
- `mem/index.md`, only if an index pointer is required by project convention

Do not touch unrelated app surfaces.

======================================================================
IMPLEMENTATION ORDER
======================================================================

1. Create/update positioning docs.
2. Audit visible landing copy and write `.lovable/r70-copy-audit.md`.
3. Replace flagged hero/section copy.
4. Reframe comparison table into workflow connector if low-risk.
5. Neutralize or hide any rendered anti-competitor section.
6. Update locales.
7. Run typecheck and mobile smoke.
8. Report remaining internal-only references separately.

======================================================================
ACCEPTANCE CRITERIA
======================================================================

1. No visible landing copy attacks Excel, ChatGPT, Trainerize, RP Strength, or generic apps.
2. “Programação séria, sem viver no Excel” is replaced.
3. Comparison section no longer works as a competitor attack table.
4. The new section communicates workflow/value positively.
5. PT copy sounds premium, calm, and natural.
6. EN copy is complete.
7. ES/HI mirrored according to project convention.
8. Mobile 375px and 390px remain readable.
9. No new sections unless reusing an existing slot safely.
10. No new routes.
11. No new dependencies.
12. No pricing/auth/billing/schedule/schema/server/engine changes.
13. `tsc --noEmit` clean.

======================================================================
FINAL REPORT
======================================================================

Report:
- positioning docs created/updated
- audit file created
- visible adversarial lines found
- lines replaced
- comparison section change
- anti-competitor section handling
- files changed
- i18n keys changed
- search results summary
- remaining competitor/tool references, classified by visible/internal/docs
- mobile 375/390 result
- confirmation:
  - no schema changes
  - no server changes
  - no pricing/auth/billing changes
  - no schedule changes
  - no new routes
  - no new dependencies
  - no engine/generation/PKL changes

```

&nbsp;