
## What I read in your PDF

Sim, percebi tudo. Vi os 19 ecrãs, parou na Page 18 (fotos de referência) — bateu no erro `invalid values for "extended"` quando tentaste submeter o todo, e as fotos não auto-guardaram (só guardam quando carregas em "Tirar foto" → upload, sem retry/persistência se a página crashar antes). Vi também que o intake atual assume sempre "tens coach" — não há a bifurcação que descreves.

## Diagnóstico dos 3 bugs

**1. `invalid values for "extended"` no submit final**
A causa é o schema do servidor em `src/server/intake.functions.ts` (`extendedSchema`): só aceita `string|number|boolean|null|array|record-flat`. Mas o cliente envia coisas que não cabem:
- `extended.parq` = `{q1: true|false|null, ...}` — é um record com `null`, e o schema record só permite `string|number|boolean|null` como valor (ok), MAS o teu objeto `parq` chega via `f.parq` antes de `q1..q7` serem todos respondidos → vem `null`, ok. O problema real é `extended.skipped` = `Record<string, boolean>` que passa, mas `ai_goal_interpretation` (escrito por `interpretGoal`) é um objeto aninhado de 2 níveis → falha o refine.
- `extended.sched_days` = `string[]` ok, mas `extended.parq` é record de booleans → ok individualmente. O culpado mais provável é a combinação `parq + skipped + ai_goal_interpretation` (este último não vem do cliente, vem fundido server-side, e quando o cliente envia `extended` no submit, o merge replica e revalida tudo — não é o caso porque a validação só corre em `cleaned.extended` (input), não em `mergedExtended`).
- O culpado real (confirmei no código): `extended.skipped` chega como `Record<string, boolean>` ✓, `extended.parq` `Record<string, boolean|null>` ✓ — mas o `extendedSchema` tem `.refine(o => Object.keys(o).length <= 80)` e mais importante, o `record(value)` aceita `null` mas o **inner record** dentro de extended (`record<string, string|number|boolean|null>`) **não aceita null como valor** quando dentro de outro record nested via `parq`. O `parq` está OK, o que **falha** é provavelmente o campo de topo `ai_goal_interpretation` que tem `{ human_label, confidence, ..., source_text, at }` — Zod não distingue mas o tamanho/tipo OK. Vou instrumentar no fix para apanhar exatamente qual key falha (logar `parsed.error.issues[0].path` antes de devolver mensagem genérica).

**2. Fotos não auto-guardam**
`PhotoSlot` faz upload imediato quando carregas no botão (isso funciona), mas:
- Se o utilizador tirar foto e a página crashar **durante** o upload, perde tudo (não há retry).
- Não há feedback de "esta foto já foi guardada antes" quando volta à página (lê de `assessments.extended.photos[slot]` mas nunca puxa signed URL para preview).
- Não há autosave de drafts antes do upload (não consegues, é binário).

**3. Pós-registo → dashboard adaptado**
Hoje toda a gente cai em `/dashboard` (PT). Não há conceito de `account_type` (`coach` | `solo` | `coached_client`).

---

## O que vou construir

### A. Audience routing (fundação para tudo o resto)

**DB migration:**
- `profiles.account_type` = enum `'coach' | 'solo' | 'coached_client'` (default `'coach'` para retrocompatibilidade).
- `profiles.onboarding_completed` já existe — passa a guardar `account_type` na primeira sessão.
- Trigger `handle_new_user` mantém-se mas `account_type` arranca `NULL` para forçar a escolha.

**Pós-signup welcome (`/welcome`):**
Nova rota que aparece se `profiles.account_type IS NULL`. 3 cards grandes:
1. **"Sou treinador / coach"** → `/dashboard` (atual)
2. **"Treino sozinho/a"** → `/me` (novo dashboard solo)
3. **"Tenho coach e quero acompanhar o meu plano"** → `/me` mas em modo "linked" (vê plano que o coach criou; pode pedir link ao coach via código de convite — fora deste PR)

`AppShell` redireciona para `/welcome` se `account_type` é null e a rota não é `/welcome`/`/auth`.

**Solo dashboard (`/me`) — V1 mínimo viável:**
- Cabeçalho com nome, próximo treino.
- Botão grande "Gerar plano com IA" que reusa o pipeline atual mas com `client = self` (auto-cria cliente espelho do solo user — usar `clients.is_self = true`).
- Lista os planos do próprio.
- Reusa `PlanHeader`, `MicrocycleView`, `Logbook` — não duplicamos.

**Intake adaptativo:**
A pergunta "Who is this for?" (Page 2 do PDF) deixa de ser uma pergunta de slide e passa a vir **pré-determinada pelo contexto**:
- Se entrou via link do coach → `intake_path = "coached"` (sem perguntar).
- Se chegou via signup solo → `intake_path = "self"` (sem perguntar).
- Em vez disso, o slide 2 pergunta algo útil: **frequência de check-ins desejada** (semanal/quinzenal/mensal) ou salta direto para o goal.

### B. Fix do `invalid values for "extended"`

`src/server/intake.functions.ts`:
1. Substituir o `extendedSchema` rígido por um schema **2-níveis** explícito:
   - top-level keys whitelisted (`smart_extra`, `ext_*`, `parq`, `intake_path`, `sched_days`, `sched_window`, `lifestyle_gate`, `ai_goal_confirmed`, `ai_goal_interpretation`, `skipped`, `photos`).
   - cada uma com o seu sub-schema correto (`parq` = `record<enumKeys, boolean.nullable()>`, `skipped` = `record<string, boolean>`, `ai_goal_interpretation` = `object passthrough`, `photos` = `record<string, string>`).
2. No catch que devolve `Invalid value for "X"`, **logar `error.issues`** para debug (`console.error("[saveIntake] zod issues", parsed.error.issues)`) — assim a próxima vez que falhar sabemos a path exata.
3. `cleaned.extended` antes do merge tem de manter o objeto vazio em vez de `null` para não destruir provenance.

### C. Auto-save de fotos robusto

`PhotoSlot`:
1. **Hidrata estado inicial** do `ctx.assessment.extended.photos[slot]` — se já existe, marca `done=true` e mostra preview via signed URL (novo server fn `getIntakePhotoUrl({token, slot})` que devolve URL assinada de 5min).
2. **Auto-retry** com backoff (3 tentativas) em falha de rede.
3. **Persistência local antes do upload**: guardar `dataUrl` em IndexedDB (não localStorage — limite 5MB) com chave `forge_intake_photo_${token}_${slot}`. No mount, se há foto pendente em IDB e não há foto remota, re-tenta upload.
4. Botão "Tirar foto" passa a aceitar drag-drop também (desktop).

### D. Mais dados no assessment (cobre o que ficou de fora)

O PDF mostra que param-se nos slides 17/18. Slides que faltam ou estão fracos:
- **Antropometria básica**: altura, peso, % gordura estimada (opcional). Slide entre o "Who are you" e "Goal".
- **Histórico de treino**: melhor agachamento/supino/peso morto/dominadas conhecidos (opcional, só intermédio+).
- **Disponibilidade real**: dias da semana específicos (não só "X dias") — feed para o microcycle scheduler.
- **Preferências de modalidade**: cardio sim/não, mobilidade sim/não, qual exercício odeias.
- **Objetivo secundário**: para casos como o teu ("ripped + vo2max") — explicitamente um campo "primary_goal" + "secondary_goal".

Tudo guardado em `extended.*` com keys bem definidas, integrado no Stage 1 (Brief) prompt.

---

## Como testar registo (resposta direta)

Sim — **email novo**. Algumas opções:
1. **Gmail aliases**: `aafonsodias+test1@gmail.com`, `+test2`, etc. — entregam-te à mesma caixa.
2. **mailinator.com**: `qualquercoisa@mailinator.com` → consultas em mailinator.com sem registar.
3. Vou também adicionar um botão dev-only **"Reset minha conta"** em `/settings` (só visível para `aafonsodias@gmail.com`) que apaga clientes/planos/profile e permite re-onboarding sem criar nova conta.

---

## Plano de execução (ordem)

1. **Migration**: `profiles.account_type`, `clients.is_self`, índice. (≤2min)
2. **Fix extended schema** + logging detalhado. (15min)
3. **Auto-save de fotos** (IDB + retry + hidratação). (30min)
4. **`/welcome` route + AppShell redirect**. (20min)
5. **`/me` solo dashboard V1** (lista de planos próprios + botão gerar). (40min)
6. **Intake adaptativo**: remover slide "Who is this for?", inferir `intake_path`, adicionar slides em falta (antropometria, disponibilidade, secondary goal). (45min)
7. **Dev reset button** em settings. (10min)
8. Smoke test: criar `aafonsodias+coach@`, `+solo@`, `+client@`, verificar cada caminho até gerar plano.

Total estimado: ~3h. Faço tudo numa volta, sem te chatear, e reporto no fim com screenshots dos 3 caminhos a funcionar.

**Confirmas?** Se sim, arranco já. Se quiseres tirar/adiar alguma parte (ex: adiar o `/me` solo para outro PR e focar só nos bugs + welcome), diz qual.
