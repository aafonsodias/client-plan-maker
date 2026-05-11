Hoje, ao concluir uma sessão, o cliente vê só "Sessão registada 💪". Os números/notas são guardados em `workout_sessions` mas só o RPE numérico alimenta `programNextWeek`. Faltam: resumo pós-sessão, leitura das notas, gráficos de progresso e bandeiras estruturadas.

As 4 fases abaixo são incrementais — cada uma entrega valor sozinha e a seguinte assenta na anterior. P0 e P3 são deterministas (sem AI). P1 e P2 usam Lovable AI (gemini-flash, escreve em `generation_log`).

---

## Fase P0 — Resumo pós-sessão determinista + delta vs. semana anterior

**Objectivo:** substituir o "Sessão registada 💪" por um ecrã rico com números reais. Sem AI, sem dependências novas.

**O que se constrói:**
- Novo módulo `src/lib/session-summary.ts` que recebe a sessão acabada de logar + a sessão homóloga da semana anterior (mesmo `plan_id`, `day_label`, `week_number - 1`) e devolve, por exercício:
  - top set (peso × reps melhor) e e1RM Epley (já existe `epley()` em `capacity-gain.ts`)
  - delta vs. semana anterior: `+2.5 kg @ mesmo RPE`, `mesmo peso, RPE +1`, `primeira vez deste padrão` quando não há comparável
  - flag visual emerald/amber/danger via `status-tone.ts`
- Novo server fn `getSessionSummary({ sessionId })` em `src/server/sessions.functions.ts` — lê a sessão actual + a anterior pelo slot e devolve o objecto resumo (sem escrever nada).
- Novo componente `src/components/log/SessionSummaryCard.tsx`:
  - hero: "Sessão concluída · Sessão N · Foco" + adesão (X/Y séries)
  - lista de highlights (top lifts, PRs detectados via `pr_celebrated_at`)
  - tabela compacta com delta por exercício (esconde "primeira sessão" quando bloco 1 / semana 1, mostra apenas baseline registado)
  - "Próxima sessão: <weekday> · <foco>" com CTA
- Substituir o bloco `if (done) return …` em `src/routes/log.$token.tsx` por `<SessionSummaryCard sessionId={…} />`.
- Mostrar este mesmo card também em `/me` na secção "Sessões recentes" ao clicar numa sessão concluída (read-only, sem CTA de iniciar).

**Critérios de aceitação:** semana 1 mostra baseline ("ponto de partida registado"); semana 2+ mostra deltas reais por exercício; nenhum texto inventado; smoke 375px ok.

---

## Fase P1 — Destilação AI das notas em 1 frase

**Objectivo:** transformar `entries[].notes`, `session_notes`, `entries[].felt` (😌🎯😵‍💫) e `post_feedback.mood` numa frase humana que o cliente lê no resumo e o PT vê na timeline.

**Schema (migration):**
- adicionar `workout_sessions.ai_summary text` e `workout_sessions.ai_summary_generated_at timestamptz`.

**O que se constrói:**
- Server fn `generateSessionSummary({ sessionId })` em `src/server/phased/session-summary.functions.ts`:
  - lê sessão + sessão anterior do mesmo slot
  - prompt curto: "Resume em 1 frase (≤140 chars) o que correu nesta sessão para o cliente. Tom do PT (você). Cita 1 highlight e 1 sinal a vigiar se existir. Não inventes."
  - chama Lovable AI (`google/gemini-3-flash-preview`)
  - escreve `ai_summary` + log em `generation_log` (stage: `session_summary`)
  - retry 1× se falhar; em falha persistente, deixa `ai_summary` null e o `SessionSummaryCard` cai para os deltas determinísticos do P0
- Disparar a server fn dentro do `submit()` de `log.$token.tsx` em background (não bloqueia o ecrã); o resumo aparece com "a escrever resumo…" → fade-in da frase.
- Card de sessão na timeline do PT (`/dashboard` cliente individual) passa a mostrar a frase AI como subtítulo.

**Critérios de aceitação:** ≥95% das gerações terminam <3s; nenhuma frase com números inventados (validação contra os entries reais); todas registadas em `generation_log`.

---

## Fase P2 — Bandeiras estruturadas das notas → autoreg

**Objectivo:** o `programNextWeek` deixa de ler só drift de RPE e passa a ler também sinais explícitos das notas (dor lombar, fadiga alta, ombro a queixar) para ajustar carga/volume cirurgicamente em vez de em bloco.

**Schema (migration):**
- adicionar `workout_sessions.flags jsonb default '[]'` — array de `{ kind: 'pain'|'fatigue'|'technique'|'equipment', body_zone?: string, exercise_name?: string, severity: 1..3, source_text: string }`.

**O que se constrói:**
- Server fn `extractSessionFlags({ sessionId })` em `src/server/phased/session-flags.functions.ts`:
  - lê todas as notas + felts da sessão
  - prompt com schema estruturado (Lovable AI, JSON mode): devolve array de bandeiras tipadas; lista fechada de body_zones (lombar, ombro, joelho, etc.).
  - escreve em `flags` + `generation_log` (stage: `session_flags`)
  - corre logo a seguir ao `generateSessionSummary` (P1) no mesmo background.
- Estender `programNextWeek` em `src/server/phased/program-next-week.functions.ts`:
  - lê `flags` agregadas da última semana
  - regras determinísticas (sem AI nesta camada — respeita a regra de ouro):
    - pain severity ≥2 num exercício específico → swap por padrão alternativo do mesmo movimento (ou cortar para 0 sets se nada disponível) + cue "✋ trocar enquanto X melhora"
    - fatigue severity ≥2 em ≥50% das sessões → activar deload na próxima semana (override do `deload_every_n`)
    - technique repeated → reduzir carga 5% mesmo sem drift de RPE + cue "🎯 limpar técnica antes de adicionar carga"
- UI: chip amber no `PlanHeader` da próxima semana mostrando "Ajuste a partir de X bandeiras" com tooltip listando as bandeiras + acções tomadas. Transparência total, mantém confiança do PT.

**Critérios de aceitação:** auditoria PT: 10 sessões reais → ≥80% das bandeiras extraídas correctas + 0 falsos positivos graves (severity 3 inventado). Toggle no perfil do PT para desactivar leitura de bandeiras (fica só com RPE drift).

---

## Fase P3 — Página de progresso do cliente em /me

**Objectivo:** dar ao cliente (e ao PT em modo preview) gráficos visuais que valorizem todo o trabalho de logging. Determinista, sem AI.

**O que se constrói:**
- Nova rota `src/routes/me.progresso.tsx` (sub-rota de `/me`, layout partilhado).
- Server fn `getClientProgress({ clientId? })` em `src/server/me.functions.ts`:
  - séries temporais: e1RM por exercício principal, volume semanal por padrão (squat/hinge/push/pull/lunge/carry), adesão semanal (%), RPE médio por sessão
  - top 5 lifts com PRs marcados (já há base em `me.functions.ts`)
  - Δ inter-bloco (já há `computeCapacityGain`)
- Componentes (`src/components/me/`):
  - `E1RMTrendChart.tsx` — linha por exercício, recharts, eixo X = semana
  - `VolumeByPatternChart.tsx` — barras empilhadas por padrão
  - `AdherenceRing.tsx` — ring 0–100% últimas 4 semanas
  - `FlagsTimeline.tsx` (depende de P2) — pequena timeline de bandeiras resolvidas vs. activas
- Respeita modo preview (`?as=clientId`) com banner amber existente; nunca escreve.
- Link "Ver progresso" no `SessionSummaryCard` (P0) e no hero de `/me`.

**Critérios de aceitação:** carrega <1s para clientes com 12 semanas; gráficos legíveis em 375px (mobile-first, scroll horizontal quando preciso); zero placeholders quando não há dados (estado vazio com copy útil "Faltam X sessões para ver tendência").

---

## Sequência de execução

Executamos uma fase por round, fechamos backlog em `.lovable/backlog.md` no fim de cada uma, smoke 375px obrigatório antes de fechar.

P0 → P1 → P2 → P3. Não saltar. P3 depende de P2 para a `FlagsTimeline`; o resto de P3 funciona sem P2.

Confirma e arrancamos com P0.