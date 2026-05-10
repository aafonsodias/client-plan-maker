# Mobile Logbook → "Today's Workout" v2

Sim, percebi. Hoje `/log/$token` é uma tabela editável com selectors de Semana/Dia/Data e um botão "Concluir sessão". Falta-lhe três coisas que pediste:

1. Abrir já no **treino de hoje** (sem o utilizador escolher semana/dia).
2. **Pre‑readiness** no início + **agrupamento** de exercícios (single / superset A1‑A2 / circuito) + **feedback final**.
3. Ao guardar: animação → **voltar à vista anterior** (cliente em `/me`, PT em `/clients/$clientId`).

Ponto 4 (progresso/results/fusion) já existe parcialmente em `ResultsPanel`, `LogbookTimeline`, `ExerciseTrendChart`, `CapacityGainCard` — esta plano garante que o novo schema os alimenta sem partir nada.

---

## 1. Fluxo (mobile, 1 ecrã = 1 etapa)

```text
/log/$token  (entry, no params)
  │
  ├─ resolve "hoje" ─► (week N, day D) baseado em última sessão + frequência semanal
  │
  ▼
[Step 0 · Hoje]      Hero: "Sessão 3 · Empurrar"  ·  duração est.  ·  Iniciar
  ▼
[Step 1 · Pré]       Sono 1‑5 · Energia 1‑5 · Dores 0‑10 · Notas curtas
  ▼
[Step 2 · Treino]    Lista AGRUPADA por bloco
                       ▸ A.  Bench Press            3×6  (single)
                       ▸ B1. DB Row        ╮ superset
                       ▸ B2. Push‑up       ╯ 3 rounds
                       ▸ C.  Circuit (4 ex × 3 rounds)
                       Cada exercício: cards de set como já existem
                       Timer de descanso por bloco
  ▼
[Step 3 · Pós]       RPE global 1‑10 · Como te sentiste? (chips) · Notas
  ▼
[Salvar]             Confetti + "Sessão guardada" → redirect inteligente
```

**Redirect inteligente** (`returnTo`):
- `?from=me` ou cliente autenticado → `/me`
- `?from=trainer&clientId=…` → `/clients/$clientId`
- fallback → ecrã "Sessão registada" actual

---

## 2. Modelo de dados

### 2a. Agrupamento (superset / circuito)
Hoje `PlanData.days[].exercises[]` é uma lista plana. Adicionar campos opcionais por exercício (zero migração de dados, retro‑compat):

```ts
// src/lib/pdf-types.ts
type Exercise = {
  …existing…
  group_id?: string;          // "A","B","C" — exercícios com mesmo id = mesmo bloco
  group_kind?: "single" | "superset" | "circuit" | "giant_set";
  group_order?: number;       // posição dentro do bloco (1,2,3)
  group_rounds?: number;      // override de rondas para circuitos (senão = sets)
};
```
Ausência destes campos = `single`. Stage 3 (`stage3-microcycle.functions.ts`) ganha um pós‑agrupador determinístico que infere supersets/circuitos a partir do `notes` actual ("A1 / A2 / circuit"), e o prompt da AI passa a marcar explícitamente.

### 2b. Pre/Post readiness (coluna nova em `workout_sessions`)

Migração: adicionar duas colunas JSONB nullable (não toca em tabelas reservadas, sem CHECK constraint — usar trigger se quisermos validar mais à frente):

```sql
ALTER TABLE public.workout_sessions
  ADD COLUMN IF NOT EXISTS pre_readiness  jsonb,
  ADD COLUMN IF NOT EXISTS post_feedback  jsonb;
```

Forma:
```ts
pre_readiness  = { sleep:1‑5, energy:1‑5, soreness:0‑10, notes?:string }
post_feedback  = { session_rpe:1‑10, mood:"strong"|"ok"|"flat"|"crushed", notes?:string }
```

Bonus: ao gravar `pre_readiness`, fazemos UPSERT espelhado em `client_checkins` (`checked_on = session_date`) — assim o autoreg do `programNextWeek` (R65) já consome estes sinais sem outra UI.

### 2c. Server fn
- `saveClientSession` (já existe) recebe os dois campos novos no Zod schema; retorna `next_session_hint` (semana/dia + ETA) para o ecrã de sucesso.
- `getTodayForToken({token})` novo — devolve `{week_number, day_label, group_layout, last_session_at}`. Heurística: maior (`week_number`,`day_label`) com sessão `done` → próximo dia do plano que ainda não foi feito esta semana.

---

## 3. UI mobile (391×844 = nosso baseline)

Ficheiros novos em `src/components/log/`:
- `TodayHero.tsx` — card grande "Sessão de hoje" + Iniciar
- `PreReadinessStep.tsx` — 3 sliders + textarea (1 ecrã, scroll mínimo)
- `BlockGroup.tsx` — wrapper para superset/circuito (chip A1/A2, timer de descanso partilhado, contador de rounds)
- `PostFeedbackStep.tsx` — RPE + mood chips + notas
- `LogStepper.tsx` — controla 4 passos com swipe + barra de progresso fina

Reutiliza: `ExerciseSetsCard`, `LogHeader`, `Confetti`, `ImportFromPhotoButton`.

Refactor de `src/routes/log.$token.tsx`:
- Remover selectores de Semana/Dia da UI principal (movem‑se para um `<details>` "Mudar de dia" para casos edge — PT a fazer make‑up, etc.).
- Default = resultado de `getTodayForToken`.
- `searchParams` `?from=me|trainer&clientId=…` controla o redirect pós‑save.

---

## 4. Progresso, resultados e fusão (sem trabalho novo de UI)

Como mantemos `entries[]` no mesmo formato, **tudo isto continua a funcionar** e ganha contexto extra:

- `ResultsPanel` + `LogbookTimeline` (`/plans/$id` tab `results`) — mostra adesão e RPE drift; passa a poder pintar barra "como te sentiste" por sessão (`post_feedback.mood`).
- `ExerciseTrendChart` — inalterado (lê pesos × reps).
- `CapacityGainCard` — inalterado.
- `programNextWeek` (R65) — passa a ler `pre_readiness.soreness` + `post_feedback.session_rpe` além do RPE por exercício; autoreg fica mais honesto sem mexer no algoritmo.
- `/me` — nova mini‑secção "Como me senti esta semana" alimentada por `post_feedback.mood`.

---

## 5. Plano de execução (ordem)

1. **Schema** — migration: 2 colunas em `workout_sessions` + trigger leve para validar ranges (sleep 1‑5 etc.).
2. **Types & grouping infer** — `pdf-types.ts` + util `group-from-notes.ts` + pós‑agrupador no Stage 3 (sem novo prompt; só inferência determinística para já).
3. **Server** — `getTodayForToken` + extender `saveClientSession` (Zod + UPSERT em `client_checkins`).
4. **UI mobile** — `LogStepper` + 4 passos; refactor de `log.$token.tsx` com `?from=` redirect.
5. **PT entry** — botão "Treinar agora" em `/me` e em `/clients/$id` (passa `from` correcto).
6. **Polish** — confetti + toast + smoke 391×844 + i18n PT/EN das strings novas em `common.json`.

## 6. Fora do âmbito desta round
- Editor de supersets para o PT (drag‑and‑drop de A1/A2). Para já o agrupamento vem do plano AI / inferência.
- Voice notes / cronómetro flutuante avançado.
- Comparativo "Hoje vs última vez que fizeste isto" no card do exercício — fácil de adicionar depois (já temos `entries` históricas).

---

## 7. Risco / mitigação
- **Retro‑compat de planos antigos** sem `group_id` → defaultam a `single`, UI inalterada.
- **PT que precisa de logar dia diferente do "hoje"** → `<details>` "Mudar de dia" mantém os selectores actuais.
- **Sessão em curso** → `getOpenSession` continua a hidratar; o stepper pula para o passo onde ficou (se já tem entries, vai para Step 2).

Confirma se queres que eu avance assim, ou se queres ajustar a ordem (ex.: começar pela UI sem mexer no agrupamento, ou inverter).
