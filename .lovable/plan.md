
# Próximo passo — investigação concluída

## O que investiguei

- **Stage 3** (`stage3-microcycle.functions.ts`) já recebe `tierGuidelines().forbiddenExercises` + `red_flags` flat no prompt. Não há filtro por zona de lesão.
- **`programming-tier.server.ts`** já lê o assessment completo (tem `forbiddenExercises` por tier remedial/conservative + `requiredAlternatives`). É o ponto de injecção natural.
- **`assessment_injuries`** é recolhido com `body_zone` + `severity` + `injury_label` mas só chega ao Stage 3 como string em `red_flags`. Desperdício total.
- **Regen** (`PlanEditorSurface` linha 819) está como botão solto fora dos tabs (`Regenerate (Cockpit-aware)`). C1 estabilizou a persistência mas o botão continua desligado do edit mode.
- **Edit mode** já tem a tab; o painel de detalhes (`DETALHES & ACÇÕES DO PLANO`) acima dos tabs é o sítio óbvio para condensar inputs.

## Recomendação: avançar **C2-lite + C3 juntos no mesmo round**

Razão: separados, o utilizador faz duas voltas (regen → ver mesmas escolhas → reabrir → regen). Juntos, o painel de edit expõe os toggles de lesão que o C2 acabou de criar — valor visível à primeira tentativa. Mantém-se 1 concern por round porque é tudo "tornar o regen consciente do assessment".

Sem páginas novas. Sem schema novo. Sem refactor da exercise DB.

## Escopo concreto

### C2-lite — filtros de lesão (server)

Novo: `src/server/phased/exercise-filters.server.ts`

Input: `(brief, assessment, assessment_injuries[])`
Output: extensão de `tierGuidelines()` com:
- `injuryForbidden[]` — denylist por zona (apenas 6 zonas + 3 flags médicas no v1):
  - `low_back ≥3` → no conventional DL, good morning, behind-neck press, jefferson curl
  - `knee ≥3` → no deep box jump, pistol squat, jump lunge, sissy squat
  - `shoulder` → no upright row, behind-neck press, kipping pull-up
  - `neck` → no behind-neck press, heavy shrug, weighted sit-up
  - `hip` → no deep ATG squat sem aquecimento, jefferson curl
  - `wrist` → no front rack pesado, handstand push-up
  - `hypertension` → no Valsalva-heavy 1RM, inverted, breath-hold > 3s
  - `pregnancy` (>16w) → no prone, no supine after T2, no breath-hold
  - `recent_surgery (<12w)` → no compound máximo na zona afectada
- `injuryAlternatives` — mapa "se proibido X, sugere Y" por padrão de movimento
- Cada regra com `citation` (ACSM/NASM/Bompa cap.) escrita em `generation_log.injury_filters_applied`

Wire-up:
- `tierGuidelines()` aceita `assessment_injuries[]` opcional, faz merge.
- Stage 3 prompt ganha bloco `INJURY-DRIVEN BANS` separado dos tier bans (audit-friendly).
- Stage 3 retry loop: se output contiver banido por lesão → reject com motivo específico.

Sem novas tabelas. Sem alteração ao schema do brief.

### C3 — consolidar regen no edit (mesma página)

No `PlanEditorSurface`:
1. **Remover** o botão `RegenerateWithFeedbackDialog` solto (linha 819-838).
2. **Edit mode** ganha um header novo "Configurar mesociclo" (collapsible, fechado por defeito) com 6 grupos pre-preenchidos:
   - **Goal & timing** — primary_goal, duration_weeks, sessions_per_week (já existe no BriefEditor; reutilizar)
   - **Intensity Cockpit** — `<IntensityCockpit/>` existente
   - **Tier & screening** — chip read-only "Conservative · 1 falha screen · PAR-Q+ ok" + popover "porquê?" com regras citadas
   - **Lesões honradas** — lista de `assessment_injuries`, cada uma com toggle `honour_in_plan` + slider severity (override apenas para esta regen, não mexe na tabela `assessment_injuries`)
   - **Equipamento & local** — multi-select existente
   - **Nota livre p/ AI** — campo actual de feedback
3. **Footer do header**: única CTA `↻ Regenerar este mesociclo` que chama `persistRegeneratedPlan` (já existe, do C1) com `overrides` mergidos no brief + programming_variables.
4. Tabs (View/Edit/Log/Resultados/Progresso) intactos; só desaparece o botão flutuante do canto.

Resultado visual: o utilizador entra em **Edit**, abre "Configurar mesociclo", vê tudo o que afecta a geração, ajusta o que quer, carrega Regenerar, fica no mesmo sítio e vê o plano novo a hidratar. Sem navegação, sem dialog modal, sem dois sítios para a mesma acção.

## O que fica de fora deste round (deliberadamente)

- Estrutura de exercise DB com IDs canónicos (deferido — round próprio, ver `mem/features/exercise-intelligence-layer.md`)
- NASM OPT phase classification (entra num C2-fase-2 quando o pack base estiver provado)
- Impact ceiling derivado de VO₂max/BP (entra com OPT phase)
- Zonas de lesão #7+ (cotovelo, tornozelo, etc.) — adicionadas iterativamente conforme aparecem

## Risco / verificação

- **Risco principal**: regra de lesão demasiado agressiva proíbe um exercício que o trainer queria. Mitigação: toggle "honour_in_plan" no painel C3 dá escape hatch por mesociclo.
- **Smoke**: cliente com `low_back severity 4` regenerar → confirmar que conventional DL desaparece e que `generation_log` mostra `injury_filters_applied` com a citação ACSM.
- **Mobile 375px**: o painel collapsible tem de empilhar bem — único item de UX a verificar.

## Próximo passo

Aprovar este plano e arranco já com C2-lite (server) + C3 (UI) numa só sessão. Estimativa: ~1 round.
