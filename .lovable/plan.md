
# Round 55 — MVP focus: Log que não perde dados, mobile-first, mapa da app + landing refresh

107 créditos restantes. Vou alocar com critério: o **bug do log a aparecer vazio** é P0 e barato; o **redesign do logbook desktop+mobile** é o item de maior impacto para MVP; mapa da app + landing refresh são entregáveis paralelos baratos. **Open-source recon: passo, mas com defesa** (ver §5).

---

## 1. Bug "Log apareceu vazio mas eu já tinha preenchido" (P0 — 8 cr)

**Causa exacta** (li `src/routes/plans.$planId.tsx:1188-1295`, função `LogMode`):
- Cada vez que mudas de dia/semana/data, o `useEffect` em 1204-1221 **reseta `entries` a partir de `plan.exercises`** com sets vazios.
- A submissão chama `INSERT INTO workout_sessions` (1260) — **nunca lê** se já existe uma sessão para `(plan_id, week, day_label, session_date, logged_by='trainer')`.
- Resultado: a sessão antiga existe na DB (por isso "History (1)" mostra), mas o formulário arranca em branco e cada `submit` cria uma sessão duplicada com a data de hoje.

**Correção:**
1. Quando o seletor (week/day/date) muda, **fazer lookup local** em `safeSessions` por `(week_number, day_label, session_date, logged_by='trainer')`. Se existir, hidratar `entries` + `notes` a partir dela em vez de zerar.
2. Mostrar chip "📝 a editar sessão de DD/MM" vs "✨ nova sessão" no header do picker para o trainer perceber qual o estado.
3. `submit` passa a fazer **upsert**: se `editingSessionId` existe → `UPDATE`; senão → `INSERT`. Sem duplicados.
4. Toast a desambiguar: "Sessão atualizada" vs "Sessão registada".

**Não toca em sharing público (`saveClientSession` já tem lógica de upsert por outro caminho).**

## 2. Logbook desktop ↔ mobile redesign (P0 — 35 cr)

Este é o core da tua mensagem. Premissa: **PT vê o telemóvel para ver/registar o cliente; cliente regista no telemóvel; tu vês o desktop para passar o olho num bloco.** São 2 jobs diferentes — não vou tentar fazer um layout só.

### 2.1 Mobile (≤640px) — *fast logging in 3 taps*
- **Sticky bottom bar** com 3 ações: `← Anterior · Próximo →` + `Guardar` (âmbar). Sempre visível.
- Cada exercício é um **card colapsável**: header "Bodyweight Squats · Set 2/4 · 12 reps × 60kg" (último set preenchido em destaque).
- **Stepper grande para reps/peso**: tap-tap-tap, sem teclado a saltar. Botões `+1 / +5 / +0.5kg / +1kg` ao lado do input — copia padrão do FitNotes.
- **Auto-collapse do exercício** quando todos os sets prescritos estão preenchidos. Vai sozinho ao próximo.
- **RPE wheel** (oklch âmbar 0-10) no fim de cada exercício, opcional, 1 tap.
- Sem cabeçalho gordo: o picker de week/day/date colapsa para `Week 1 · Day 1 · 04 mai ▾` (1 linha).

### 2.2 Desktop (≥1024px) — *bird's-eye + tabular*
- Layout **2 colunas**: à esquerda lista de exercícios do dia (sticky), à direita a tabela de sets editável. Click num exercício → scroll-to e foco.
- **Tabela densa** com `Set | Prescrição | Reps | Peso | RPE | ✓` por linha, edita inline com Tab.
- **Atalhos**: `Tab`/`Enter` salta de campo; `Cmd+S` guarda; `Cmd+→` próximo dia.
- Coluna direita extra: **history strip** das últimas 3 execuções desse exercício (carga + reps), trazida pelo `getExerciseHistory` server-fn já existente.
- **Dirty indicator** no botão Guardar (âmbar pulsante quando há alterações por gravar) + auto-save draft em `localStorage` por `planId+week+day` para resistir a F5.

### 2.3 Componentização (sem partir nada)
- Novo `src/components/log/LogPickerCompact.tsx` — picker de 1 linha responsive.
- Novo `src/components/log/LogExerciseRowMobile.tsx` — card stepper.
- Novo `src/components/log/LogExerciseTableDesktop.tsx` — tabela inline.
- `LogMode` em `plans.$planId.tsx` orquestra; usa `useMediaQuery('(min-width: 1024px)')` ou Tailwind `lg:hidden / hidden lg:flex` (preferido — sem JS).

## 3. Mapa da app + screenshots (P1 — 12 cr)

Não consegui autenticar o browser-tool (loading infinito sem sessão) — vou produzir o mapa **a partir do código** + 6 screenshots PNG renderizados a partir das rotas-chave através de um script Puppeteer-em-edge **OU** mais honestamente: peço-te para teres a sessão aberta no preview e eu uso o browser-tool no próximo turno para tirar prints reais. **No turno actual, entrego o mapa textual + identificação visual baseada em código.**

Ficheiro `.lovable/app-map.md` com:
- Diagrama Mermaid das 28 rotas e como se ligam.
- Por cada rota: **status MVP** (✅ pronto · 🟡 funcional mas tosco · 🔴 falta) + 1 frase do que faz + ficheiros principais.
- Lista única "MVP-blocking gaps" — máx 5 items que faltam para enviar a v1 honesta.

## 4. Landing page refresh (P1 — 25 cr)

`src/routes/index.tsx` tem 1158 linhas — não vou reescrever, vou **cirurgicamente actualizar 4 secções**:

1. **Hero**: trocar promessa para reflectir o estado real ("Periodização honesta + logbook que não te perde + PDF de oferecer ao cliente"). Hoje fala em coisas que ainda não existem.
2. **5-stage journey strip** (Intake → Brief → Blueprint → Microcycle → Progressions): adicionar sub-bullets do que é real **agora**: red-flag tiers, capacity gain inter-blocos, rotation audit, e1RM PRs com confetti.
3. **"What's new"** (substitui qualquer fake testimonial): linha do tempo Round 6→54 com 6-8 milestones honestos (multi-block, capacity-gain, rotation audit, PR celebration, light-mode contrast, etc).
4. **Pricing**: confirmar que os caps (8/30/80) batem com `tier_to_plan_quota` e remover qualquer "soon" que já tenha sido entregue.

**Não toco**: copy legal, FAQ, footer.

## 5. Open-source recon — fazer mas em modo "tomar uma ideia, não importar dependência" (P2 — 7 cr)

Vou navegar a 3 projetos relevantes (browser tool externo) e produzir `.lovable/oss-recon.md` com:
- **FitNotes** (Android, GPL): padrões de stepper para reps/peso, plate calculator. Não copiamos código, copiamos UX.
- **wger** (web, AGPL — incompatível com nosso modelo, NÃO importar): exercícios + tradução, mas a parte de planos é fraca. Lessons learned, não código.
- **OpenWorkout / Gymrats**: histórico de sessões, gráficos de e1RM. Confirmar que o nosso `ExerciseTrendChart` cobre o caso.

**Linha vermelha**: *zero* dependências GPL/AGPL adicionadas. Só MIT/Apache/ISC, e mesmo essas só se encurtarem caminho >2 dias. Hoje provavelmente a recon devolve "padrões UX a copiar" e não "lib a importar" — e isso é o resultado certo.

## 6. Não está incluído (parcado / próximo round)

- Round 53 P0 (RPE periodization, FORGE→PROTOCOL rename, PDF repaint) — fica para Round 56. Quero o Log fix antes porque desbloqueia tudo.
- Header colapsado do plano (#62/#63 do Round 54) — fica para Round 56 também, depois do RPE.
- Mesocycle table com overlay azul (#61) — depende do RPE periodization.
- "Acompanhar treino do cliente em tempo real / lembretes / receita semanal":
  - **Receita semanal** já existe em `src/routes/schedule.tsx` (revenue panel, R28). Posso só **promovê-la ao dashboard** num próximo round (Round 57, ~10 cr).
  - **Lembretes / push** seria backend-pesado (cron + email/push provider) → Round 58+, requer decisão de canal (email Resend já está; push é outro projecto).

---

## Custo total: ~87 cr (sobra 20 para imprevistos)

| Tarefa | Cr | Prioridade |
|---|---|---|
| 1. Log re-edita em vez de duplicar | 8 | P0 bug |
| 2. Logbook mobile+desktop redesign | 35 | P0 |
| 3. Mapa da app + status MVP | 12 | P1 |
| 4. Landing refresh (4 secções) | 25 | P1 |
| 5. OSS recon (3 projectos, MD report) | 7 | P2 |
| **Total** | **87** | |

## Ficheiros tocados

- `src/routes/plans.$planId.tsx` — `LogMode` refactor (orquestrador, ~80 linhas mudadas)
- `src/components/log/LogPickerCompact.tsx` — novo
- `src/components/log/LogExerciseRowMobile.tsx` — novo
- `src/components/log/LogExerciseTableDesktop.tsx` — novo
- `src/components/log/useDirtyDraft.ts` — novo (autosave LS)
- `src/routes/index.tsx` — 4 secções
- `.lovable/app-map.md` — novo
- `.lovable/oss-recon.md` — novo
- `.lovable/backlog.md` — entradas 70-75

## Pergunta antes de seguir

A 2.1 (mobile redesign) é a única decisão que pode beliscar a tua estética: o **stepper grande +1/+5/+0.5/+1kg** é UX de gym-bro app (FitNotes-style). Funciona bem mas é menos "minimalista craft". Alternativa é **só inputs maiores com `inputmode='decimal'`** — mais sóbrio, menos rápido. **Default vou no stepper porque "looks → function → ease" inverte para "ease" quando o cliente está suado entre sets.** Confirmas, ou queres a versão sóbria?
