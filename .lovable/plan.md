
## Objetivo

Quando um trainer entra pela primeira vez, a conta demo passa a ter **1 ano completo (≈13 blocos × 4 semanas = 52 semanas) de mesociclos da Maria**, todos com logbook preenchido, encadeados via `prior_plan_id` / `block_number`. Datas vão de "há 12 meses" até "esta semana", para a app parecer viva desde o segundo zero.

Depois disso, basta um botão "rodar o ano" (ou cron mensal) para empurrar o timeline +1 ano e a história continua a evoluir sem novo trabalho de IA.

## Princípio chave (custo/tempo)

Correr 13 vezes o pipeline phased de IA é caro e lento (~minutos cada). Não vale a pena: o cliente é fictício e o objectivo é UI, não programação inédita. Estratégia:

- **Bloco 1** corre o pipeline real **uma vez** (já existe), para o trainer ver o output completo da IA.
- **Blocos 2..13** são **clones determinísticos** do Bloco 1 com:
  - mesma estrutura de `workout_plan_days` (com pequenas mutações: troca acessórios, ajusta volume/intensidade por bloco),
  - `block_transition_summary` calculado a partir das sessões do bloco anterior (a mesma lógica que já existe em `archivePlanAndStartNextBlock`, mas sem chamar IA),
  - `is_demo=true`, `status='archived'` (último: `'ready'`).
- **Logbook** semeado para todos os 13 blocos, com datas contíguas para trás a partir de hoje. Persona profile já controla curva de RPE/carga por semana.

## Mudanças

### 1. Nova função `seedDemoYear` (server)

Ficheiro: `src/server/demo-seed.functions.ts` (extender) ou novo `src/server/demo-year.functions.ts`.

Após `runInstantPipelineForUser` terminar o Bloco 1 com sucesso:

1. Carrega `workout_plan_days` do Bloco 1 + `brief` + `programming_variables` + `blueprint`.
2. Loop `for b in 2..13`:
   - `INSERT INTO workout_plans` cópia (mesmo `client_id`, `assessment_id`), `block_number=b`, `prior_plan_id=` bloco anterior, `is_demo=true`, `status='archived'` (excepto último), `generation_status='complete'`, `title='Bloco {b}'`.
   - `INSERT INTO workout_plan_days` cópia mutada — função `mutateBlock(content, b)` que:
     - aplica drift de volume/intensidade (ex.: `+2.5%/bloco` até bloco 6, deload bloco 7, novo ciclo),
     - cada 3 blocos roda 1–2 acessórios da pool por padrão de movimento.
   - Calcula `block_transition_summary` a partir das sessões do bloco `b-1` (reutilizar a lógica de cálculo de adesão/RPE drift de `blocks.functions.ts` extraída para helper).
3. Semeia sessões para todos os 13 blocos com `seedDemoSessions` (já existe — só precisa aceitar `anchorDate`/`weekOffset` para datar para trás).
4. Marca `profiles.demo_seeded_at` com timestamp + grava `demo_year_offset=0`.

### 2. Estender `seedDemoSessions` para datar para trás

Hoje a função usa `startDate = today - maxWeek*7`. Adicionar parâmetro opcional `endsOnWeekIso` (ou `weekOffset`) para que o gerador saiba qual a data final do bloco. O caller (`seedDemoYear`) passa, para cada bloco, o offset correcto: bloco 13 termina na semana actual, bloco 12 termina 4 semanas antes, etc.

### 3. Botão "Rodar o ano" + automação opcional

- Componente novo `RotateDemoYearButton` no painel demo do dashboard (`DemoClientBanner.tsx`), só visível quando há demo já semeada.
- Server fn `rotateDemoYear`: para todas as `workout_sessions` de planos `is_demo=true` do trainer, `session_date := session_date + interval '365 days'` (capa em "hoje" para não saltar para o futuro). Incrementa `demo_year_offset`.
- Útil para demos a clientes em datas diferentes sem regenerar nada.

### 4. Schema (1 migração mínima)

```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS demo_year_offset integer NOT NULL DEFAULT 0;
```

Tudo o resto reutiliza `is_demo`, `block_number`, `prior_plan_id` que já existem.

### 5. UI

- `DemoClientBanner`: barra de progresso passa a mostrar "Bloco 1 de 13" → "Semeando histórico anual" enquanto corre o `seedDemoYear`. Mantém o botão "Remover demo" (já existe) — `wipeDemoContent` já apanha tudo via `is_demo=true`.
- Cabeçalho do plano: amber chip "Bloco N · evoluiu de Bloco N−1" já existe — vai funcionar de borla porque `prior_plan_id` está populado.

## Arquivos tocados

- **Novo**: `src/server/demo-year.functions.ts` (`seedDemoYear`, `rotateDemoYear`, helper `mutateBlock`, helper `summariseBlockTransition`).
- **Editar**: `src/server/demo-seed.functions.ts` (chamar `seedDemoYear` no fim do pipeline), `src/server/demo-sessions.functions.ts` (parâmetro `weekOffset`), `src/server/blocks.functions.ts` (extrair `summariseBlockTransition` para reuso), `src/components/DemoClientBanner.tsx` (texto + botão "Rodar o ano").
- **Migração**: `profiles.demo_year_offset`.

## Impacto / custo

- **Tempo de seed**: Bloco 1 (pipeline IA) ~30–60 s, Blocos 2..13 (clones SQL puros) ~2–5 s totais, sessões ~1 s. → demo completa pronta em ≤1 min.
- **Custo de IA**: igual ao actual (1 corrida de pipeline). Zero custo extra para os outros 12 blocos.
- **Quota**: nada conta (todos `is_demo=true`, trigger `bump_plan_quota_on_complete` já exclui).

## Fora deste plano (próximos passos)

- "Workbench AI" por cliente, integração de upload de exames via Ask Forge router, e refinements ao PDF — ficam para a próxima ronda. Faço isto a seguir se aprovares este passo primeiro.
