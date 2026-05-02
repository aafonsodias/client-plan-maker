## Problema

Olhando para o plano da Marta (38a, conservative tier, padrão appetite):

- Header semanal mostra **"RPE alvo 5.4"** em **todas as 4 semanas** — incluindo a semana de deload, que devia ser claramente mais baixa.
- A maioria dos exercícios sai com **RPE 5** (suportes, carries, bands) e só os compostos chegam a 6.
- A onda prometida pelo Stage 4 (`6 → 7 → 7.5`, deload 5) **não aparece visualmente**.

Causas-raiz no código:

1. **`stage3-microcycle.functions.ts`** só passa ao modelo `guidelines.rpeRange` ("6-7"). Não há piso explícito por exercício e o tom do prompt deixa o modelo "escolher seguro" → defaults a 5 para acessório.
2. **Stage 3 é cego ao `brief.intensity_appetite`** — só Stage 4 o lê. Logo a Semana 1 (a âncora) nunca reflecte a vontade de intensidade do treinador.
3. **Stage 4** propõe `intensity_rpe: "+0.5rpe"` mas frequentemente só numa semana, e em acessórios deixa em branco. Combinado com âncora baixa em W1, o RPE médio ronda 5.4 W1→W4.
4. **`MesocycleTableView.weekTotals.rpe`** faz média aritmética sobre TODOS os exercícios incluindo warm-ups/finishers que vêm sem RPE estruturado, mas inclui acessórios fáceis de igual peso que os compostos — distorce a perceção. (Menor — sintoma, não causa.)

## Solução — 3 cirurgias pequenas, sem mudar arquitectura

### 1. Stage 3 ganha `intensity_appetite` + piso por papel de exercício

`src/server/phased/stage3-microcycle.functions.ts`:

- Ler `brief.intensity_appetite` na assinatura de `runDay` (já é passado).
- Calcular um **piso e teto de RPE para Semana 1** combinando tier + appetite:

  ```text
  conservative + conservador  → main 6.5-7.5, accessory 5-6,  carry 5
  conservative + padrão       → main 7-8,     accessory 6-7,  carry 5-6   ← Marta
  conservative + agressivo    → main 7.5-8.5, accessory 7-7.5, carry 6
  remedial   + qualquer       → main 5-6,     accessory 4-5,  carry 4
  advanced   + padrão         → main 8-9,     accessory 7-8,  carry 6-7
  ```

- Reescrever a secção RPE do system prompt para ser **prescritiva por papel** em vez de "RPE range 6-7":

  > "Week 1 RPE FLOOR: main lift ≥ {floorMain}, secondary/accessory ≥ {floorAcc}, carry/core ≥ {floorCarry}. Never write RPE below the floor for that role. The first exercise (main lift) MUST sit at or near the ceiling. RPE 5 is reserved for warm-up/activation, never for the main block."

- Adicionar **post-validation no servidor** (depois do parse do dia): se ≥40% dos exercícios do main block tiverem RPE numérico abaixo do piso, bumpar automaticamente para o piso e marcar `meta.rpe_floor_applied = true`. Sem retry à IA — correcção determinística.

### 2. Stage 4 com onda obrigatória + retry quando flat

`src/server/phased/stage4-progressions.functions.ts`:

- Endurecer Hard Rule 3: **"intensity_rpe MUST move at least once between W1 and W3 for ≥70% das exercícios. A onda alvo é {ramp}. Se W1 já está no teto, então W2 mantém e W3 sobe reps."**
- Estender o `evaluateCoverage` actual para também medir **RPE-wave coverage** (quantos exercícios têm `intensity_rpe` não-vazio em W2 ou W3). Se < 50%, retry com mensagem explícita.
- Garantir que W{N} (deload) **sempre** baixa RPE em ≥1.0 nos compostos (já está nas regras, falta verificar no post-validation).

### 3. Limpar a média do header

`src/components/MesocycleTableView.tsx`:

- `weekTotals.rpe` passa a ser **mediana ponderada do main block** (excluir exercícios cujo `superset_id` é o de warm-up ou cujo `optional === true`). A média actual mistura "carry RPE 5" com "leg press RPE 7" e dá 5.4 — leitura enganadora.
- Mostrar um **range** em vez de um único número: `"RPE 6 – 8 (mediana 7)"`. Mais honesto.

### 4. Botão de "re-anchor" no plano existente da Marta

Para planos já gerados (caso da Marta), adicionar em `src/server/phased/stage3-microcycle.functions.ts` uma server fn `reanchorPlanRpe(planId)` que:

- Lê o brief + tier + appetite.
- Aplica o piso determinístico do passo 1 a cada `workout_plan_days.content.exercises[].rpe`.
- Re-corre as progressões (`proposeProgressions`) para refazer a onda sobre a nova âncora.

Botão "Re-ancorar RPE" no header de `src/routes/plans.$planId.tsx`, ao lado do "Re-gerar resumo".

## Detalhes técnicos

**Floors helper (novo, em `src/server/phased/programming-tier.server.ts`):**

```typescript
export function rpeFloors(tier: Tier, appetite: "conservador"|"padrao"|"agressivo") {
  const matrix = {
    remedial:     { conservador: [4,4,4],   padrao: [5,5,4],   agressivo: [6,5,4] },
    conservative: { conservador: [6.5,5,5], padrao: [7,6,5.5], agressivo: [7.5,7,6] },
    advanced:     { conservador: [7,6,6],   padrao: [8,7,6.5], agressivo: [8.5,8,7] },
  } as const;
  const [main, accessory, carry] = matrix[tier][appetite];
  return { main, accessory, carry };
}
```

**Post-validation determinístico (Stage 3):** após receber `result.data`, percorrer `exercises[]`, parsear RPE, e se `idx === 0 && rpe < floor.main` ou `rpe < floor.accessory`, fazer `ex.rpe = String(floor.X)`. Manter o RPE original em `ex.meta.rpe_original` para auditoria.

**Wave coverage (Stage 4):**

```typescript
const rpeWaveRatio = exerciseList.filter(e => {
  const rows = data.rows.filter(r => r.exercise_id === e.id && r.dimension === "intensity_rpe");
  return rows.some(r => (r.week_2_delta || r.week_3_delta).trim() !== "");
}).length / exerciseList.length;
if (rpeWaveRatio < 0.5) { /* retry com mensagem específica */ }
```

## Ficheiros tocados

- `src/server/phased/programming-tier.server.ts` — adicionar `rpeFloors()`.
- `src/server/phased/stage3-microcycle.functions.ts` — prompt prescritivo + post-validation determinística.
- `src/server/phased/stage4-progressions.functions.ts` — wave coverage check + retry.
- `src/server/phased/plan.functions.ts` (ou novo `rpe-reanchor.functions.ts`) — `reanchorPlanRpe`.
- `src/components/MesocycleTableView.tsx` — mediana do main block + display range.
- `src/routes/plans.$planId.tsx` — botão "Re-ancorar RPE".

## Resultado esperado

Para a Marta após "Re-ancorar":

```text
WEEK 1            WEEK 2            WEEK 3            WEEK 4 · DELOAD
RPE 6 – 8 (med 7) RPE 6.5 – 8 (7.5) RPE 7 – 8.5 (8)   RPE 5 – 6.5 (6)
```

Leg press W1: 3×10 RPE 7 (não 6).
Lat pulldown W1: 3×10 RPE 7 (não 6).
Supported glute bridge W1: 3×12 RPE 6 (não 5).
Light suitcase carry W1: RPE 5-6 (mantém — é carry).

Honesto, e finalmente puxa a senhora.
