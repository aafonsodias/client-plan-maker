# Round 70 — Onboarding rápido (5 inputs → plano)

Fecha #62 P0 do backlog. Hoje, criar um plano exige primeiro criar cliente, abrir intake, esperar respostas, abrir builder. Não há atalho honesto para "treinador acabou de descobrir o Forge, quer um plano gerado agora para ver se vale o tempo".

## Objetivo
Uma rota `/plans/quick` (acessível do landing CTA + dashboard "Novo plano rápido") com **5 campos** que produz um plano completo em 60–90s, sem precisar de intake.

## Os 5 inputs (decididos a partir do que Stage 1 mais usa)
1. **Nome do cliente** (text, obrigatório) — vai para `clients.full_name`
2. **Idade + sexo** (number + select M/F/Other) — base ACSM
3. **Objetivo primário** (select: hipertrofia / força / recomp / saúde geral / performance)
4. **Experiência** (select: iniciante <1ano / intermédio 1-3 / avançado 3+)
5. **Dias por semana + equipamento** (select 2/3/4/5 + multi-select gym/casa/livre)

Tudo o resto recebe defaults inteligentes (RPE ceiling 8.5, undulating, deload 4w, bodyweight estimado por idade/sexo, sem lesões).

## Fluxo
```
/plans/quick (form)
   ↓ submit
createQuickPlan() server fn
   - cria client (status=quick, sem intake)
   - cria workout_plan com derived brief
   - chama synthesizeBrief → derive → stage2/3/4/5 em sequência
   - regista no DemoRunsContext (pill global mostra progresso)
   ↓ done
redirect /plans/$planId (modo view)
```

Reusa pipeline existente (`createPhasedPlan` + `synthesizeBrief` + auto-runner que já corre stages 2-5 quando o brief é confirmado). A diferença é só pré-popular o `assessments` com defaults ACSM derivados dos 5 inputs em vez de esperar intake.

## Mudanças
1. **`src/routes/plans.quick.tsx`** (novo, ~180 LOC) — form com os 5 campos, validação Zod inline, submit chama server fn, redirect para `/plans/$planId` quando o auto-runner termina.
2. **`src/server/quick-plan.functions.ts`** (novo, ~120 LOC) — `createQuickPlan({ data })` com `requireSupabaseAuth`. Cria client (`status="quick"`), gera assessment derivado (height/weight estimados por idade/sexo via tabelas ACSM já existentes em `src/server/screening/preparticipation.server.ts`), cria workout_plan, dispara `synthesizeBrief` + marca para auto-stages. Verifica quota via `checkPlanQuota()`.
3. **`src/components/landing/HeroVisualRotator.tsx`** (1 patch) — botão "Experimenta com 5 cliques" que linka para `/plans/quick`.
4. **`src/components/dashboard/CoachCockpit.tsx`** (1 patch) — botão "Plano rápido" ao lado do CTA principal.
5. **`src/i18n/locales/{pt,en}/plan.json`** — bloco `quick.*` (title, fields, submit, generating).
6. **`.lovable/backlog.md`** — marca R62 #1 ✅.

## Honestidade
- Cliente fica marcado `status="quick"` para distinguir do fluxo completo. Trainer pode "promover" depois (preencher intake real).
- Plano gerado mostra chip amber "Plano rápido — sem intake clínico" no header até intake completo.
- Quota conta normalmente (1/1 free) — não é bypass.

## Risco / fora de scope
- Não toca em pricing nem free quota. Não muda Stage 1-5. Não adiciona AI extra.
- Não tenta fazer o form ficar bonito além do necessário (5 campos, 1 botão, design system existente).

## Mobile
375px primeiro: form em coluna única, inputs full-width, submit sticky no bottom.
