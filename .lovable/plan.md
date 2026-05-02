# E agora? — Última milha do ciclo vertical

O ciclo já fecha no papel: prescrever → imprimir A4 → treinar → importar → fechar bloco → iniciar Bloco N+1 (manual ou IA). Mas três coisas continuam a sabotar a sensação de "golden standard":

1. **Marta ainda mostra summary antigo com leak da IA** ("Sem análises por secção fornecidas…"). O fix em `stage5-bulkfill` só escreve quando `summary` está vazio — planos pré-existentes ficam para trás.
2. **Não há prova visual de progresso**. O treinador não vê "Marta subiu o leg-press de 40→50kg em 4 semanas". Sem isto, o software parece um Word com PDF.
3. **O "fechar bloco" é silencioso**. O banner emerald aparece sempre que o plano está `complete`, mas não grita "Marta acabou — e agora?" quando ela realmente acaba (ex: 100% sessões logged).

## O que vou construir

### 1. Re-summarize de planos legados (one-shot, manual)
- Botão pequeno **"Re-gerar resumo"** no header do plano (ao lado de "Folha de registo"), apenas para planos `complete` cujo summary contém o tag de leak conhecido (`Sem análises por secção`, `notes_for_next_stage`, etc.).
- Server fn `regeneratePlanSummary` em `src/server/plan.functions.ts` que reaproveita exactamente a lógica determinística que já está em `stage5-bulkfill` (extraída para `src/server/phased/summary.server.ts` para evitar duplicação).
- Sem chamadas à IA. 100% determinístico a partir do `brief`.

### 2. Gráfico de progressão por exercício (ExerciseTrendChart)
- Novo componente `src/components/ExerciseTrendChart.tsx` usando `recharts` (já no projecto via `ui/chart`).
- Lê `workout_sessions.entries` do plano, agrupa por `exercise_name`, plota peso médio + RPE médio por semana.
- Entra como nova aba **"Progresso"** ao lado de View / Edit / Log / Resultados em `plans.$planId.tsx`.
- Cabeçalho de cada gráfico: "Leg press · +12.5 kg em 4 semanas · RPE 6 → 7.5". Formato honesto, sem inventar números (se faltam dados, diz "sem registos suficientes — importe a folha de registo").

### 3. Auto-detecção de "plano concluído"
- Quando o número de sessões registadas iguala ou ultrapassa `duration_weeks × sessions_per_week`, o banner emerald passa a:
  - cor amber + ícone Sparkles
  - copy: **"Bloco {N} concluído na totalidade. Pronto para fechar e desenhar o Bloco {N+1}?"**
- Lógica vive em `src/lib/plan-status.ts` (helper `isPlanFullyLogged(plan, sessions)`).
- O banner promove o CTA "Iniciar Bloco N+1" como acção primária (botão sólido amber em vez do outline actual).

### 4. PR auto-detection (bonus, leve)
- Em `ExerciseTrendChart`, quando o último set de um exercício é a maior carga já registada nesse plano, mostra um chip "PR Bloco {N}" verde-emerald no card.
- Pura comparação determinística sobre `sessions[].entries[].actual.weight`.

## Ficheiros a tocar

- `src/server/phased/summary.server.ts` (novo — extrai a função `buildDeterministicSummary(brief, weeks)`)
- `src/server/phased/stage5-bulkfill.functions.ts` (passa a importar de `summary.server.ts`)
- `src/server/plan.functions.ts` (adiciona `regeneratePlanSummary`)
- `src/components/ExerciseTrendChart.tsx` (novo)
- `src/routes/plans.$planId.tsx`
  - botão "Re-gerar resumo" no header
  - nova aba "Progresso"
  - banner emerald → amber quando `isPlanFullyLogged`
- `src/lib/plan-status.ts` (helper `isPlanFullyLogged`)
- `src/i18n/locales/pt/plan.json` + `en/plan.json` (strings novas)

Sem migrations. Sem novas dependências.

## Fora do âmbito (ficam no roadmap, não nesta passada)

- OCR / AI Vision sobre fotos da folha de registo (precisa de Lovable AI Gateway com modelo de imagem; é um sprint próprio).
- Auto-deload trigger baseado em RPE drift > 1.5 em 2 semanas consecutivas (precisa cron + notificações).
- Comparativo entre blocos no perfil do cliente (Bloco 1 vs Bloco 2 side-by-side).

Aprove e eu construo.
