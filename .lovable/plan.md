# Round 63 — Microcycle-only engine + mission-driven assessment + UX walk-through

Esta ronda fecha 4 frentes. Tudo PT-PT, mobile-first (390px) e desktop (1280px) com screenshots ao longo do caminho.

---

## 1. Motor: AI gera **só 1 semana**, nunca mais

**Estado atual** (auditado):
- Stage 3 (`stage3-microcycle.functions.ts`) → AI gera microciclo (Semana 1). ✅ Já é 1 semana.
- Stage 4 (`stage4-progressions.functions.ts`) → AI gera **deltas para W2/W3/W4**. ❌ Isto viola a regra.
- Stage 5 (`stage5-bulkfill.functions.ts`) → aplica os deltas deterministicamente para preencher W2..N. Mecânica boa, mas alimentada por AI.

**Mudança**:
- Renomear Stage 4 para `stage4-progressions-deterministic.server.ts`. Sem chamada AI. Constrói os deltas de `progression_plan` com base em:
  - `blueprint.progression_model_proposal.model` (linear, double-progression, RPE wave, DUP)
  - **ACSM FITT-VP** já em `prescription_parameters` (intensity bands por goal)
  - **Bompa** (já em `periodization_phases` na DB) — escolhe o template do mesociclo (acumulação 3:1, intensificação 2:1, etc.)
  - **NSCA** — increments por exercise category (compound +2.5kg, isolator +1.25kg, bodyweight +1 rep)
- O plano passa a ter `duration_weeks = 1` por omissão na criação do plano. Semanas 2..N **não existem até a Semana 1 ser logged**.
- Novo botão no `/plans/$planId` quando W1 está fechada (≥80% adesão): **"Programar próxima semana"** → server fn `programNextWeek(planId)` que:
  1. Lê sessões logged de W1 (`workout_sessions.entries`)
  2. Calcula adesão real, RPE médio por exercício, PRs
  3. Aplica progressão determinística (mesma `applyDeltaToExercise` mas com inputs reais, não previstos)
  4. Insere W2 em `workout_plan_days`
  5. Repete para a próxima quando W2 fecha

**Recursos que confirmo já temos** (na DB ou parqueados):
- ACSM 12e: `acsm_recommendations`, `acsm_thresholds`, `acsm_normatives`, `acsm_contraindications` ✅
- Bompa 6e: roadmap previsto (.lovable/bompa-buzzichelli-6e-source.txt parqueado)
- NSCA 3e: roadmap previsto (parqueado)

**Recursos que peço para confirmares antes de ler papers grandes**:
- Schoenfeld — Science and Development of Muscle Hypertrophy 3e (para volume landmarks MEV/MAV/MRV mais finos)
- Helms — Muscle and Strength Pyramid 2.0 (para auto-regulation por RPE)
- McGuigan — Monitoring Training and Performance (para fitness-fatigue model nas decisões de deload)

Se concordares, ingiro estes 3 a seguir ao Bompa.

**Migration**:
```sql
alter table workout_plans alter column duration_weeks set default 1;
-- planos existentes ficam como estão (não tocar)
```

---

## 2. PDF: Missões de assessment 0→100 distribuídas pelos dias de treino

Hoje o PDF (`src/lib/pdf.ts`) mostra `assessment_completion_pct` mas **não diz ao cliente o que falta fazer**.

**Mudança**:
- Nova função `computeAssessmentMissions(assessment)` em `src/lib/assessment-missions.ts` que retorna `Mission[]` ordenadas por impacto/esforço:
  - Cada missão = +X pontos (ex: "Tira foto frontal +5", "Mede tensão arterial +8", "Faz teste submax Rockport +12", "Preenche SMART deadline +3")
- `distributeMissionsAcrossDays(missions, trainingDaysPerWeek)` → uma missão por dia (round-robin), espalhando ao longo das semanas.
- No PDF, abaixo de cada `Day N`, secção compacta **"Missão da sessão (+X pts no perfil)"** com 1 linha de instrução.
- Na primeira página, barra de progresso "Perfil 64/100 → meta 100/100 em ~3 semanas se cumprires".

---

## 3. "Needs human review" tem casa própria

Hoje vive enterrado no `ValidationReport` (linha 68) como mais um chip cinzento.

**Mudança**:
- Novo componente `<HumanReviewBanner planId>` no topo do `/plans/$planId` (acima do header), só aparece quando `validation` o pede:
  - Faixa âmbar discreta (não vermelha — não é erro), 1 linha + CTA "Rever 3 dias"
  - Lista os dias em causa com link direto para o `MesocycleTableView` no dia X
  - Quando o trainer aprova manualmente, regista `validation_meta.human_reviewed_at` e o banner desaparece
- Continua a aparecer um chip pequeno no `ValidationReport` mas sem ser o sinal principal — a faixa é o sinal.

---

## 4. UX walk-through com screenshots mobile+desktop

Vou simular um PT novo a entrar e percorrer o fluxo todo, capturando 390px e 1280px em cada paragem:

| Paragem | Crítica do "PT-ignorante" |
|---|---|
| `/` landing | Headline ainda fala demasiado de tecnologia? |
| `/auth` signup | Quantos cliques até estar dentro? |
| `/welcome` | Faz sentido o coach vs solo? |
| `/dashboard` vazio | Convida a agir ou paralisa? |
| Convidar 1º cliente | Manual vs link — copy clara? |
| `/intake/$token` (vista cliente) | Demasiado longo? Onde é que abandonaria? |
| `/clients/$id` (intake recebido) | Vê-se que falta algo? Missões aparecem? |
| Gerar plano | 90s sente-se? Stages claros? |
| `/plans/$id` modo view | Onde clica primeiro? |
| Logbook 1 sessão | Quantos toques? |
| "Programar próxima semana" | É óbvio o gatilho? |
| PDF download | Missões aparecem por dia? |

Cada paragem fica em `.lovable/walkthrough-r63.md` com screenshot mobile + desktop + 1 linha de crítica + ação proposta. Issues encontradas viram bugs P0 que fecho na mesma ronda se forem cosméticos, ou caem no backlog se forem estruturais.

---

## 5. Pequenos extras enquanto ando lá

- "Human touches" → confirmar que está em todo o lado como **"Lembretes para clientes"** ou **"Revisão humana opcional"**
- Slides do hero: confirmar 1 slide único
- "After the PDF" → reescrever
- Sleep slider: granularidade 30 min
- Bug "language switch causa logout" → isolar no `LanguageSwitcher.tsx` (não tocar no Supabase auth)
- Datas no intake EU (DD/MM/AAAA) — verificar se já cobre todos os ecrãs

---

## Ordem de execução

1. Audit + screenshots iniciais (sem mexer em código) → `.lovable/walkthrough-r63.md`
2. Motor 1-semana (migration + stage4 determinístico + `programNextWeek`)
3. PDF missões
4. Human review banner
5. Polishes do ponto 5
6. Re-walk e diff de screenshots, atualizar `mem://index.md` com a regra "AI nunca > 1 semana"

---

## Confirmações que peço antes de arrancar

- **OK ingerir Schoenfeld + Helms + McGuigan** depois do Bompa? (são os 3 que faltam para o algoritmo determinístico ser sério)
- **`programNextWeek` requer ≥80% adesão da semana anterior** ou avanças mesmo com 50%? Recomendo 80% senão arriscas progressão sobre dados que não existem.
- Banner "needs human review" deve **bloquear** publicação do plano ou só avisar? Recomendo só avisar (PT decide).
