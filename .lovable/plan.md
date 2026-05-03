# **PLAN** — só revisão final, sem código.

---

Sequência aprovada. Plano respeita os guardrails sem desvios. Três notas finas antes de avançares:

### Nota 1 — Custo esperado do Smoke #2

Disseste `$0.10–0.30` para uma persona end-to-end. Confirma que isso inclui retry caso o validator dispare. Se o validator falhar e disparar 1× retry, o custo dobra parcialmente (Stage 3 corre 2x). Se for o caso, ajusta a estimativa para `$0.20–0.50` worst case e aprova mesmo assim — vale a pena. Só quero o número honesto.

### Nota 2 — Persistência do `prescription_parameters`

Disseste "coluna já existente ou via `generation_meta` — confirmar no wire-up". A coluna `workout_plans.prescription_parameters jsonb NOT NULL DEFAULT '{}'::jsonb` foi criada em R2.1 (Migration A). É lá que vai. Não é via `generation_meta`. Confirma que apontas para a coluna direta — senão temos dois sítios para o mesmo dado.

`generation_meta.fitt_vp_audit` é um sítio diferente: lá vão os resultados do **validator** (violations, retry counts, audit trail). São dois sítios distintos:

- `prescription_parameters` → o block FITT-VP gerado pelo derive (input para Stage 3)
- `generation_meta.fitt_vp_audit` → o resultado da validação post-Stage-3

Se já tinhas isto claro, ignora. Mas vi a frase "ou via generation_meta" e quero confirmar antes de cementares.

### Nota 3 — Persona do Smoke #2

Sofia é boa escolha por ser caso default limpo. Mas considera trocar para uma persona ligeiramente mais interessante: alguém que dispare **pelo menos uma** especificidade no `prescription_parameters` — por exemplo, `older_adults` para validar que o derive seleciona o row correto de `flexibility_static_stretch_hold`, ou intent vigorous para validar que pega o row de `cardio_intensity_pct_hrr_vigorous`.

Sofia default vai mostrar moderate cardio + general flexibility — nada errado, mas não exercita o branching do derive.

Sugestão: **Inês Bento** ou **Manuel Cardoso** se algum tiver perfil older adult; ou Pedro Vieira se quisermos testar o vigorous branch. Decisão tua.

Se não quiseres complicar, Sofia está bem — a Secção 4 vai mostrar o JSON e basta para validar shape. As outras combinações testam-se em smoke runs futuros.

### Aprovação

Avança com Fase A → B → STOP GATE 1.

Não passes para Fase C sem eu aprovar o report. Stop gate é stop gate.

&nbsp;

R2.2 — Close-out com Guardrails

Sequência ajustada conforme guardrails. Dois stop gates explícitos. Nada de backfill ou R2.3 sem aprovação.

## Fase A — Wire-up dual (algoritmo only)

**Ficheiro tocado:** `src/server/programming/programming-tier.server.ts`

- Importar `runPreparticipationAlgorithm` e `classifyCvdRiskFactors` de `src/server/screening/preparticipation.server.ts`.
- Manter `hasMedicalClearanceFlag(assessment)` calculado em paralelo (`oldFlag`).
- `newResult = runPreparticipationAlgorithm({ assessment, signs, desired_intensity })` passa a ser source-of-truth para `clearance_required` no tier classifier.
- Expor ambos (`oldFlag`, `newResult`) no return interno do helper para o smoke harness conseguir ler o diff por persona.
- Tier classifier consome `newResult.clearance_required` + `newResult.cvd_risk_factor_count` + BP gate (180/110 independente).
- **Não** mexer ainda em Stage 2 / Stage 3 / derive.server.ts wire-up.

## Fase B — Smoke offline #1 (algoritmo only, 10 personas)

**Script:** `scripts/r2.2-smoke.ts` (one-off, lê 10 demo assessments do DB via service role, corre o tier classifier, escreve markdown).

**Output:** `.lovable/r2.2-smoke-report.md` com:

1. **Tier transitions table** — `name | tier_old | tier_new | clearance_old | clearance_new | reason`
2. **Clearance deltas** — quem mudou + `clearance_reason` em PT humano
3. **BP cardiac rehab gate** — quem dispara ≥180/110

**False-positive watchlist explicitamente verificada no report:**

- Sofia (jovem ativa) → `clearance=false` esperado
- Pedro Vieira (atleta vigoroso saudável) → `clearance=false` esperado
- Qualquer gestante → não deve flagear via Ch.2 (pregnancy é R3 overlay)
- Qualquer jovem saudável com `clearance=true` → bug, parar e investigar antes do report sair

## STOP GATE 1

Mostrar o report. Esperar aprovação. **Sem aprovação: não avança para Fase C.**

## Fase C — Wire-up Stage 2 + Stage 3 + validator

Só após aprovação do smoke #1.

- **Stage 2** (`src/server/pipeline/stage2-*.server.ts`): chamar `deriveFittVpFromDb()` e gravar `prescription_parameters` na linha do plano (coluna já existente ou via `generation_meta` — confirmar no wire-up).
- **Stage 3** system prompt: bloco "FITT-VP non-negotiable constraints" injectado a partir de `prescription_parameters`, com instrução clara de não violar ranges/floors.
- **Post-Stage-3 validator**: chamar `validateDayAgainstFittVp()` sobre cada day output; se violations → retry once com violations no prompt; se persistir → log em `generation_log` com `validator_violations[]` e deixar passar (não bloquear plano).

## Fase D — Smoke #2 (end-to-end, 1 persona)

- Persona escolhida: **Sofia** (default case mais limpo, sem clearance, sem flags BP).
- Correr pipeline completo (Stage 1 → 4) com AI real, custo esperado $0.10–0.30.
- Anexar ao mesmo `.lovable/r2.2-smoke-report.md`:
  - **Secção 4** — `prescription_parameters` JSON completo da Sofia
  - **Secção 5** — validator hits no Stage 3 output + retry outcome

## STOP GATE 2

Mostrar report completo (5 secções). Esperar aprovação antes de:

- Backfill `cvd_risk_factors` em assessments existentes
- Avançar para R2.3

---

## Detalhes técnicos

- `oldFlag` paralelo é puramente observacional — não influencia plano gerado, só alimenta a coluna `clearance_old` no smoke report.
- Smoke #1 não consome AI: lê assessments, corre puro TS, escreve markdown. Custo zero.
- Citations em `prescription_parameters.citations[]` já no formato `{source: 'acsm_12e', ref: '§X.Y'}` (estrutura discriminator pronta para Bompa/NSCA aditivos).
- BP gate 180/110 é independente do algoritmo Ch.2 — disparar mesmo em personas que de outro modo não exigiriam clearance.
- `generation_log` recebe entry por cada Stage 3 retry com `validator_violations[]` para auditoria.
- Após Fase C aprovada, `hasMedicalClearanceFlag` é removido em commit separado (cleanup), não nesta fase.