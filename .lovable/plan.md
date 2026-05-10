A página de logbook já existe e abre. O que falta é tornar o "qual sessão é a de hoje?" óbvio, automático e à prova de erro humano. A solução mais elegante é ligar cada sessão do mesociclo a um dia da semana fixo e usar isso para mostrar de imediato o treino certo quando o cliente abre o link.

## Como vai funcionar (linguagem do utilizador)

1. **No plano, cada sessão ganha um dia da semana** (ex.: Sessão 1 → Segunda, Sessão 2 → Quarta, Sessão 3 → Sexta). O treinador define isto uma única vez quando aprova o plano, ou aceita a sugestão automática (distribuída a partir de "dias/semana" da avaliação).

2. **Quando o cliente abre o link de logbook**, o sistema olha para o dia da semana de hoje:
   - **É dia de treino?** Mostra logo a sessão correspondente, pronta a registar — sem cliques.
   - **Já foi feita hoje?** Mostra "Treino de hoje já registado ✅" e oferece rever ou fazer um treino de recuperação.
   - **É dia de descanso?** Mostra "Hoje é descanso" e um botão discreto "Quero treinar à mesma — abrir próxima sessão".
   - **Faltou um dia anterior?** Banner amber: "Faltou Quarta. Recuperar agora ou marcar como falhada?"
   - **Semana terminou?** Salta para a Semana 2 automaticamente.

3. **Botão único e grande no topo: "Começar sessão"**. Ao tocar, expande os exercícios. Não há ecrã intermédio.

4. **Registo rápido por bloco**: cada exercício/superset/circuito tem checkboxes grandes por série + carga/reps inline. Como já está, mas com foco automático na próxima série por preencher (uma série de cada vez, scroll automático).

5. **Guardar = animação curta + redireção** para /me (cliente) ou /clients/{id} (treinador), conforme `?from=`. Já está.

6. **No /me e no detalhe do cliente**, a "Próxima sessão" passa a dizer "Hoje, Quarta · Sessão 2 · Push" em vez de só "Sessão 2", confirmando ao cliente que sabe o que vai fazer antes de tocar.

## O que muda em concreto

- **Modelo do plano**: cada `Day` ganha um campo opcional `weekday` (1-7 ou null). Plans antigos continuam a funcionar (fallback = ordem sequencial, comportamento actual).
- **Distribuição automática**: ao aprovar microciclo, se nenhum dia tem weekday, distribuímos por dias úteis preferidos (ex.: 3×/sem → Seg/Qua/Sex; 4×/sem → Seg/Ter/Qui/Sex). Usa `assessments.training_days_per_week` como base.
- **Editor do plano**: pequeno seletor "Dia da semana" por sessão no editor do treinador, com presets rápidos ("3×/sem MQS", "4×/sem", "Definir manualmente").
- **`getTodayForToken`** (server fn já existe): nova ordem de prioridade →
  1. Draft em curso (resume).
  2. Hoje é training day **e** ainda não registado → essa sessão.
  3. Hoje é rest day → devolve marker `rest_day` + próxima sessão sugerida.
  4. Faltou alguma sessão dos últimos 2 dias → devolve marker `missed_recent` + essa sessão.
  5. Tudo ok mas sem treino hoje → próxima sessão futura.
- **Hero da página /log/$token**: passa a ter 3 estados visuais (treino-hoje, descanso, em falta) com cores do design system (emerald/muted/amber). Botão "Começar sessão" centralizado.
- **/me e /clients/$id**: o badge "Próxima sessão" passa a mostrar dia da semana + nome do treino.

## Decisões de UX (para validar antes de construir)

- **Fixo vs. flexível**: a atribuição de dia da semana é uma sugestão amigável, não uma prisão. Se o cliente abrir num dia "errado", continua a poder escolher manualmente em "Mudar de dia". Sem culpas, sem fricção.
- **Sem notificações nesta ronda**: emails/push ficam para depois — o objectivo agora é "abro o link → sei o que fazer".
- **Sem novos ecrãs**: tudo dentro da `/log/$token` actual; só muda o hero e o `getTodayForToken`.

## Detalhes técnicos (referência)

- Schema: `plan_data.weeks[].days[].weekday: number | null` (1=segunda … 7=domingo).
- Migração: nenhuma alteração de tabela necessária — `plan_data` é JSONB.
- Distribuição automática: helper puro `src/lib/weekday-distribution.ts` (input: `{ trainingDaysPerWeek, sessionCount }`, output: `number[]` com weekdays).
- `getTodayForToken` em `src/server/sessions.functions.ts`: estender o tipo de retorno com `state: "ready" | "rest" | "missed" | "done_today" | "empty"` + `suggested_next` opcional.
- Hero: novo componente `<TodayHero state=… day=… onStart=… />` em `src/components/log/`.
- Editor de plano: `<WeekdayPicker />` por sessão, integrado no `BriefEditor`/microcycle approval step.
- i18n: chaves novas em `src/i18n/locales/pt/common.json` sob `logbook.today.*`.

## O que **não** muda

- Estrutura de tabelas (nenhuma migração).
- Geração AI (fora deste scope).
- Lógica de progressão semana N→N+1.
- Botão "Abrir logbook do cliente" no detalhe do cliente.