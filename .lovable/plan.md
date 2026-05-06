
# R72 — Mockups bilingues, motor multi-modalidade, Hub de Conhecimento

Pediu três coisas distintas. Vou tratá-las como **três sub-rondas** (R72.1, R72.2, R72.3) para cada uma poder fechar isolada e ser revertida sem afundar as outras. Foco PT (a app é PT-only no marketing, mas a UI tem EN/PT/ES/HI).

---

## R72.1 — i18n sweep nos mockups da landing (≤ 1h, P0)

**Problema observado:** Em mobile, a landing em PT mostra exercícios e copy hardcoded em PT que ficam em PT mesmo quando o utilizador troca para EN — e vice-versa. Mockups afetados:

- `src/routes/index.tsx` `SoloTrainerMockup` (linhas 1196-1265): "Goblet Squat", "DB Bench Press", "Single-Leg RDL", "Chin-up assistido", "Face Pull", "Plank", "Treino de hoje", "Copiloto IA · tu decides", "Lower body · ~52 min", dias da semana "Seg/Ter/Qua…".
- `src/routes/index.tsx` `ProtocolRail`/restantes mockups: "Construído por um coach", labels hardcoded.
- `src/components/landing/WorkbenchMockup.tsx`: "Cliente queixa-se de dor lombar", "Substituir Back Squat por Goblet Squat", "Sugestão estruturada", "ao vivo", side-rail rows ("Objectivo/Equipamento/Última RPE/…").

**Plano:**
1. Mover todas as strings desses mockups para `src/i18n/locales/{pt,en}/plan.json` debaixo de `landing.mockups.*` (já existe namespace `landing.*`).
2. Os nomes de exercício ficam **na mesma língua da UI** — o "Goblet Squat" em EN e "Agachamento goblet" em PT (decisão: traduzir nomes nos mockups, porque são decorativos; **não** traduzir nomes em planos reais).
3. Substituir literais por `t("landing.mockups.solo.exercises.goblet_squat.name")` etc.
4. ES e HI fallback automático para EN (já é a política existente).
5. Smoke 375px Mobile Safari PT→EN→PT em todos os 3 mockups.

**Sai:** Tradução das partes funcionais da app (já estão cobertas em rondas anteriores). Só toco em landing.

---

## R72.2 — Motor multi-modalidade (P0, ~3-4h)

**Problema:** Hoje o motor só faz programas de ginásio (resistance + warm-up + cardio acessório). Quando o utilizador pede "5K sub-30min" ou "boulder 6B", o Stage 3 produz lixo porque o blueprint só sabe arquetípos `strength_focus / hypertrophy_focus / mixed_session`.

**Decisão de arquitectura:** introduzir **`training_modality`** no `Brief` como **lista**, não single-select. Um plano pode misturar `gym` + `running`. ACSM 12e §6 (cardiorespiratory) e Bompa 6e §11 (energy systems) cobrem-no.

```text
Brief.training_modalities: ["gym","running","climbing","calisthenics","sport_skill","mobility"]
                                      ↓
Stage 1.5 — Modality blueprint                 (novo: scaffolds Stage 2)
Stage 2 — Mesocycle blueprint                  (atual: agora gera arquetípos por modalidade)
Stage 3 — Microcycle                           (atual: prompt expandido por modalidade)
Stage 3.5 — Microcycle review/edit (NOVO)      (microciclo aprovado antes de progressões)
Stage 4 — Progressions (atual, intacto)
```

**Mudanças concretas:**

1. **Schema** (`src/server/phased/schemas.ts`):
   - `BriefSchema.training_modalities`: array de enum `["gym","running","climbing","calisthenics","mobility","sport_skill"]`, default `["gym"]` (compat retroactivo).
   - `BriefSchema.modality_targets`: opcional, ex.: `{ running: { distance_km: 5, target_time_min: 30 }, climbing: { grade: "6B", style: "boulder" } }`.

2. **Pre-Stage 0** (`section-map.ts` + `pre-stage.functions.ts`): inferir modalidade a partir de `client_overview.goal_text` ("correr 5K", "trepar 6B", "handstand") com regex + heurística simples antes de chamar o LLM, e o LLM confirma/expande.

3. **Stage 2 blueprint** (`stage2-blueprint.functions.ts`): adicionar arquetípos por modalidade. Hoje só tem `strength_focus`, `hypertrophy_focus`, `mixed_session`. Novos: `aerobic_base`, `interval_session` (Z2 vs VO₂max), `tempo_run`, `climb_project`, `climb_endurance`, `skill_practice`, `mobility_flow`. O `week_to_session_map` mistura modalidades (ex.: 3× gym + 2× run).

4. **Stage 3 microcycle** (`stage3-microcycle.functions.ts`):
   - Schema de exercício já tem `cardio: SectionItemZ[]`; usar para sessões de corrida com **estrutura de intervalos** (warmup easy → main set → cooldown).
   - Prompt: para `running`, gerar `intervals` em vez de `sets/reps` (ex.: "5×800m @ 4:00/km, 90s rest"). Para `climbing`, gerar `boulder_problems` ou `route_pyramids` com grade e tentativas.
   - Adicionar `SectionItemZ` extra `prep_inhibition` (rolo/SMR) para a fase **inibição** que pediu (Cap. NSCA).

5. **Stage 3.5 — Aprovar microciclo (NOVO)**: rota `plans.$planId.microcycle.tsx` já existe; adicionar **botão "Aprovar microciclo"** que carimba `generation_state.approved_stages += "microcycle"`. Stage 4 (progressões) só corre depois desse carimbo. Drag-and-drop de exercícios + edição inline já existe (`MicrocyclePanel`/`DayCardEditable`); falta o gate.

6. **Pacing / intervalos científicos** — `src/lib/training-zones.ts` (NOVO ~120 LOC):
   - `runZones(restingHR, maxHR, vdot?)` → Z1-Z5 (HR + pace via Jack Daniels VDOT se 5K time conhecido).
   - `strengthRanges()` → strength 85-100% 1-5 reps, hypertrophy 67-85% 6-12, endurance ≤67% ≥13 (ACSM 12e Tbl 5.7).
   - `powerRanges()` → 30-60% 1-5 reps, rest ≥3min (NSCA 3e Cap. 17).
   - Stage 3 prompt importa estes ranges como verdade prescritiva.

7. **Stage 3 prompt — modalidades**: adicionar secções no prompt — "For `running` sessions, output items in `cardio[]` with `name = 'Z2 base run'` e `duration = '40min @ Z2 (HR 130-145)'`. For `climbing`, output 3 blocks: warmup boulders V0-V2, project attempts at limit grade, endurance circuits."

**Output:** O mesmo cliente que pediu 5K sub-30 + boulder 6B passa a receber 5 sessões/sem: Ter/Qui run (intervals + Z2), Sáb climb session, Seg/Sex gym (strength compounds + grip + antagonist work).

---

## R72.3 — Hub de Conhecimento (Manual de Prescrição + Estudos + Calculadoras) (P0, ~2-3h)

**Onde vive:** já tens `/manual` com 6 secções (start/intake/plan/logs/feedback/billing). Vou adicionar uma 7ª aba **"Conhecimento"** dentro de `/manual` em vez de criar rota nova — mantém um único hub de aprendizagem.

**Estrutura proposta:**

```text
/manual
 ├─ Tutorial (atual)
 ├─ FAQ (atual)
 ├─ Contacto (atual)
 └─ Conhecimento (NOVO) ─┬─ Manual de Prescrição (denso, golden, < 4000 palavras)
                        ├─ Calculadoras (1RM, VDOT, FFMI, BMR, target HR zones)
                        └─ Estudos (feed StudiesFeed que já existe)
```

### Manual de Prescrição

Documento markdown denso em `src/content/prescription-manual.{pt,en}.md` (parsed em build via `import.meta.glob` ou raw-loader). Estrutura **fixa** que cobre tudo o que precisas decidir:

1. **Screening** (ACSM 12e Cap. 2-3): PAR-Q+, 9 sinais cardinais, factores risco CVD, tier (advanced/conservative/remedial).
2. **FITT-VP** (ACSM 12e Cap. 5): F/I/T/T/V/P por modalidade.
3. **Variáveis de treino** (NSCA 3e Cap. 14): séries, reps, intensidade %1RM, descanso, tempo, ROM, frequência.
4. **Continuum força** (NSCA Tbl 17.2): força máx / força-velocidade / potência / hipertrofia / resistência — % 1RM, reps, descanso, RPE.
5. **Periodização** (Bompa 6e §6-7): linear, ondulatório, bloco, conjugado — quando usar cada.
6. **Habilidades biomotoras** (Bompa 6e §3): força, velocidade, resistência, coordenação, flexibilidade — interferência e ordem.
7. **Cardio** (ACSM 12e §6): Z1-Z5 HR/RPE/pace, VO₂max protocols, prescrição por objectivo.
8. **Populações especiais** (ACSM 12e Cap. 7-10): índice rápido para idosos/grávidas/HTA/T2D/LBP — links para as overlays do R3 quando existirem.
9. **Red flags & quando parar**: BP test stop ≥250/115, sintomas cardinais, plateau RPE.

**IP rule:** zero cópia verbatim dos livros. Tudo paráfrase + citação `ACSM 12e §X.Y` etc., respeitando `mem://acsm-12e-source.txt`.

### Calculadoras (componentes reutilizáveis)

Já existe `OneRepMaxCalculator.tsx`. Adicionar:
- `VdotCalculator.tsx` — input 5K time → tabela paces Z1-Z5.
- `TargetHrCalculator.tsx` — Karvonen (HRR%).
- `BmrTdeeCalculator.tsx` — Mifflin-St Jeor.

Cada calculadora num `<Card>` colapsável dentro da aba Conhecimento.

### Estudos

`src/components/StudiesFeed.tsx` já existe. Confirmar que tem (i) lista de papers, (ii) clique abre detalhe com summary + "porque importa" + link DOI, (iii) tag por tópico (hipertrofia, cardio, recovery). Se faltar, completar.

---

## Ficheiros tocados (resumo)

| Ronda | Ficheiro | Acção |
|---|---|---|
| R72.1 | `src/routes/index.tsx` | Substituir literais por `t()` em SoloTrainerMockup, ProtocolRail |
| R72.1 | `src/components/landing/WorkbenchMockup.tsx` | i18n sweep |
| R72.1 | `src/components/landing/LogbookInsightsMockup.tsx` | já está OK, verificar fallbacks EN |
| R72.1 | `src/i18n/locales/pt/plan.json`, `en/plan.json` | Adicionar `landing.mockups.*` |
| R72.2 | `src/server/phased/schemas.ts` | `training_modalities`, `modality_targets` |
| R72.2 | `src/server/phased/pre-stage.functions.ts` | Inferir modalidade do goal_text |
| R72.2 | `src/server/phased/stage2-blueprint.functions.ts` | Arquetípos por modalidade |
| R72.2 | `src/server/phased/stage3-microcycle.functions.ts` | Prompt + intervals + climbing |
| R72.2 | `src/lib/training-zones.ts` | NOVO — VDOT, HR zones, strength ranges |
| R72.2 | `src/routes/plans.$planId.microcycle.tsx` | Gate "Aprovar microciclo" |
| R72.3 | `src/routes/manual.tsx` | Nova aba "Conhecimento" |
| R72.3 | `src/content/prescription-manual.pt.md`, `.en.md` | NOVO — manual denso |
| R72.3 | `src/components/calculators/{Vdot,TargetHr,BmrTdee}Calculator.tsx` | NOVO |
| R72.3 | `src/components/StudiesFeed.tsx` | Confirmar/completar |
| Doc | `.lovable/backlog.md` | Marcar R72.1/2/3 + abrir R73 (special-population overlays sobre o motor multi-modalidade) |
| Memory | `mem://features/multi-modality.md` | NOVO — regra: `training_modalities` é lista, motor tem que respeitar; Stage 3.5 microcycle approval é gate obrigatório |

---

## O que **não** faço nesta ronda (parked para R73+)

- **Bouldering grading inteligente por sistema** (V-scale vs Fontainebleau): por agora aceito ambos como string, sem conversor.
- **Pacing por VDOT calibrado individualmente**: a calculadora existe; o motor usa VDOT só se o brief o tiver, senão Z2 = "easy conversational".
- **Special-population overlays (R73)**: gravidez, idosos, HTA, T2D — depende deste motor multi-modalidade existir.
- **AI conversacional sobre o manual** (RAG): o manual é estático nesta ronda. RAG fica P3 futuro.
- **Sport-specific templates** (handball, ténis, etc.): o `sport_skill` é genérico; templates por modalidade ficam P2.

---

## Pergunta antes de avançar

**Quer que eu execute as 3 sub-rondas seguidas no mesmo turno**, ou prefere que pare entre cada (R72.1 → revê → R72.2 → revê → R72.3)?

Recomendação minha: **fazer R72.1 sozinha** (i18n sweep, zero risco, fecha em 30min) **+ R72.2 num turno separado** (motor é o coração da app, melhor focar) **+ R72.3 num terceiro turno** (manual é estático, baixa pressa). Mas se quiser tudo num só turno, faço — só fica ~6h de trabalho de IA num só commit, mais difícil de reverter.
