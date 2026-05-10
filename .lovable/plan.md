# Logger único, prático no telemóvel

## Diagnóstico (o que já existe e o que falha)

Hoje há **dois loggers paralelos**:

1. **`/log/$token`** — surface do cliente (mobile-first). Já tem auto-save, restore de draft, streaks, pre-readiness, post-feedback, import por foto, histórico por exercício e confetti. **Mas só pede reps + weight + RPE**, mesmo quando o dia é cardio, intervalos ou mobilidade.
2. **Tab "Log" do `PlanEditorSurface`** — UI separada dentro do editor do treinador, com a sua própria lógica de selecção de semana/dia. Sobreposição que confunde quem mantém: dois sítios para corrigir bugs, dois sítios para traduzir, dois sítios para evoluir.

O botão `Abrir logbook do cliente` (em `clients_.$clientId.tsx:1960`) abre o link `/log/$token`. O nome é frio e ambíguo — "logbook" soa a leitura, não a acção.

Outro problema fino: quando um plano não tem `weekday` em nenhum dia (typical demo), `getTodayForToken` devolve `state: "empty"` e o cliente vê o cartão "Este plano ainda não tem sessões agendadas" sem exercícios por baixo (printscreen 1). Vamos garantir que o picker manual abre por defeito nesse caso.

## Decisões

- **Um logger só**, partilhado: o trainer-side passa a re-usar exactamente os componentes de `/log/$token` (`TodayHero`, `BlockGroup`, `ExerciseSetsCard`, pre/post). O tab "Log" do `PlanEditorSurface` deixa de ter UI própria — passa a embeber o mesmo flow em modo "trainer" (que envia `?from=trainer&clientId=...`).
- **Botão renomeado** para `Registar treino` (ícone `NotebookPen`). Mais directo, alinhado com a acção.
- **Inputs adaptam-se ao modo do dia** via `inferLogbookModeFromDayFocus` (já existe e já mostramos o chip):
  - `strength` / `hypertrophy` → reps · peso · RPE  *(comportamento actual)*
  - `cardio` → duração (mm:ss) · distância (km) · FC média  · RPE
  - `intervals` → rondas · trabalho (s) · descanso (s) · RPE
  - `mobility` / `skill` → duração (mm:ss) · notas qualitativas
  - `mixed` → fallback ao modo strength com toggle "passar a cardio" por exercício
- **Empty plan** (sem semanas com weekday) → o `TodayHero` empty state passa a mostrar imediatamente o `WeekDayPicker` expandido + os exercícios da Semana 1 / Dia 1 por baixo, em vez de esconder tudo.
- **Mobile-first**: inputs grandes (h-12), teclado numérico (`inputMode="decimal"`), placeholder com o plano (ex: "10–12"), tick "feito" como toggle gigante na linha do set, sticky CTA "Concluir sessão" no fundo no mobile.

## Mudanças

### Tipos (`src/components/log/ExerciseSetsCard.tsx`)
Estender `SetLog` com campos opcionais sem partir o que já está gravado:
```text
SetLog = { reps, weight, rpe?, done, ts?,
           duration_s?, distance_m?, avg_hr?,    // cardio
           work_s?, rest_s?, rounds?,            // intervals
           hold_s? }                              // mobility
```
Server schema (`saveClientSession`) — alargar `SetLogSchema` para aceitar os novos campos como opcionais. Sem migração de DB: tudo vive em `entries` JSONB.

### Componente `SetRow` por modo
Dentro de `ExerciseSetsCard`, escolher o renderer pelo `mode` recebido por prop:
- `StrengthSetRow` (actual)
- `CardioSetRow` (duração + distância + FC)
- `IntervalSetRow` (rondas × trabalho/descanso)
- `MobilitySetRow` (apenas duração)

Histórico ("Última vez: 12 reps × 60 kg") adapta-se ao modo (ex: "Última vez: 5 km em 28:14").

### Routing/header (`src/routes/log.$token.tsx`)
- Passar `mode` ao `BlockGroup` → `ExerciseSetsCard`.
- Quando `todayState === "empty"` e o plano tem dias prescritos → forçar `showDayPicker = true` na primeira render e popular weekNum/dayLabel com o primeiro dia disponível (já faz parte; afinar para mostrar a lista de exercícios).
- Quando `search.from === "trainer"`, esconder o card "treinaste com folha impressa? tira foto…" (irrelevante para o PT).
- CTA `Concluir sessão` torna-se **sticky bottom** no mobile (`sm:relative`).

### Trainer surface (`src/components/PlanEditorSurface.tsx`)
- Substituir o conteúdo do tab `log` por um `iframe`-less embed: importar `<ClientLogContent>` extraído de `log.$token.tsx` e passar `token` + `from="trainer"` + `clientId`.  *(Refactor: extrair o JSX do `ClientLogPage` para um componente exportado `ClientLogContent` recebendo `token` por prop; o route component fica como wrapper que lê o param.)*
- Manter os outros tabs (View/Edit/Resultados/Progresso) intactos.

### Botão (`src/routes/clients_.$clientId.tsx`)
- Linha 1960: `label: "Abrir logbook do cliente"` → `label: "Registar treino"`.
- Manter o `intent: "log"` e a lógica de `ensureShareToken`.

### i18n
- Novas chaves em `src/i18n/locales/{en,pt}/common.json` sob `logbook.modes.*` para os labels de duração/distância/FC/rondas/trabalho/descanso, e `logbook.cta.finish`. ES/HI fallback ao EN.

## Fora de scope (para outra ronda)

- Migração de DB ou nova tabela.
- Re-treinar `inferLogbookModeFromDayFocus` ou abrir um seletor de modo manual ao cliente.
- Notificações push / lembretes de treino.
- Replicar tudo isto em `/me` (cliente final) — esta ronda é o link público `/log/$token` + o tab do PT.
- Métricas avançadas (HRV, watts, splits) — adicionamos quando alguém pedir.

## Plano de verificação

1. `npm run build` limpo (sem novos imports a falhar).
2. Abrir `/clients/$id` com plano finalizado → ver `Registar treino` no secondary action.
3. Clicar → abre `/log/$token` no mesmo separador, exercícios visíveis mesmo em planos sem `weekday`.
4. Mudar para um dia de cardio na demo → ver inputs de duração/distância/FC.
5. No editor do plano, abrir tab `Log` → ver exactamente a mesma UI, com banner amber "estás a registar como treinador".
6. Smoke 375×812 (Mobile Safari): inputs com teclado numérico, CTA sticky, sem overflow horizontal.
