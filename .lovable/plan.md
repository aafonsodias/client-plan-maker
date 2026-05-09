## Objectivo

Transformar `/me` (Casa do cliente) numa app pessoal que o cliente do PT abre todos os dias e em que confia: hoje sabe o que treinar, durante a semana sabe como vai, ao longo do tempo vê que está a evoluir, e tem um canal directo com o seu treinador. Tudo mobile-first (375px), respeitando o white-label do PT.

## Princípios

- **Cliente real é a audiência primária.** Preview do PT (`?as=`) continua a funcionar mas é secundário.
- **Quando há dados, mostrar dados.** Quando não há, dar contexto humano sobre o que vai acontecer a seguir, nunca um vazio em branco.
- **Read-only não chega.** Cliente precisa de fazer 3 coisas: começar a sessão, fazer check-in diário, escrever ao PT. Tudo o resto é leitura.
- **PT voice = "você".** Toda a copy nova entra em `i18n/locales/pt/me.json` (criar) + `en/me.json` para EN básico.
- **Reaproveitar o que já temos.** `plan_feedback` (já existe, author=client/trainer) é o canal de mensagens. `daily_activity_log` + `client_measurements` já guardam steps e peso. Falta apenas `client_checkins` para sono/dores/energia.

## Arquitectura — 6 superfícies + 1 nova rota

A página `/me` passa de scroll plano para 5 cards focados + bottom nav que abre 2 sub-rotas. Mantém-se SSR-safe, mantém-se o `loadMe` como loader único.

```text
/me                    → Hoje (default)
/me/progresso          → Progresso (peso, fotos, top-lifts, capacity-gain)
/me/historico          → Histórico (todas as sessões loggeadas, paginação)
```

### Hoje (default `/me`)

1. **Hero do treinador** — logo + nome do PT + tagline. Quando `primary_color` definido, gradiente do hero usa-o (com fallback amber). Resolve o avatar partido da screenshot: se `logo_url` falhar, cai para `<BrandMark>` em vez de `<img>` com src vazio.
2. **Card "Sessão de hoje"** (substitui "Próxima sessão") — quando há prescrição:
   - Título grande "Sessão N · Foco"
   - Lista compacta dos 4-6 exercícios principais com sets×reps + RPE
   - CTA emerald "Começar sessão" gigante (link para `/log/$token` com query `?day=N`)
   - Badge "Última feita há X dias" para criar urgência saudável
3. **Card "Check-in de hoje"** — 3 emojis para sono (😴 1-5), dores (🤕 0-10), energia (⚡ 1-5). Submissão optimista escreve em `client_checkins` (nova tabela). Já feito hoje → mostra resumo + botão "editar". **Alimenta `programNextWeek` no futuro** (autoreg_strictness usa estes sinais).
4. **Card "Esta semana"** — versão mais visual do que existe: barra de progresso `feitos/total`, lista colapsada de dias com chip de estado (✅ feito, 🔵 hoje, ⚪ pendente). Click num dia abre o seu detalhe inline.
5. **Card "Próximas marcações"** — mantém o que já existe.
6. **Card "Mensagem do treinador"** — última nota do PT com `author='trainer'` em `plan_feedback`. Inline reply abre input que escreve com `author='client'`. Realtime via supabase channel.

### Progresso (`/me/progresso`)

Sub-rota. Tab interna ou stack vertical:

1. **Streak semanal** — últimas 12 semanas em barras (ades­ão %). Reaproveita `compliance.ts`.
2. **Capacity gain** — quando `block_number > 1`, importa `<CapacityGainCard/>` que já existe. Mostra Δ% load + e1RM por padrão (squat/hinge/push/pull).
3. **Top-lifts** — best set por exercício principal nas últimas 4 semanas. Tira de `workout_sessions.entries` agrupando por exercise_id.
4. **Peso ao longo do tempo** — gráfico simples (recharts já usado no projecto) sobre `client_measurements` cadence='periodic' campo 'weight'. Input rápido "Adicionar peso de hoje" abaixo.
5. **Fotos antes/depois** — usa o bucket `client-photos` que já existe. Cliente faz upload de selfie de progresso (nova etiqueta "progress" no path), grid 3-col. Thumbs com data, click para fullscreen.

### Histórico (`/me/historico`)

Lista paginada de todas as `workout_sessions` com filtro por bloco. Click numa sessão abre drawer com entries (peso × reps × RPE prescrito vs realizado, com diff a verde/amber).

### Bottom nav

Mobile-first, sticky bottom: Hoje · Progresso · Histórico · Mensagens (badge com count de não lidas do PT). Em ≥sm vira topnav horizontal sob o header.

### Estado vazio (sem plano)

Substitui o "Sem plano activo" actual por algo útil:
- Hero do PT continua igual.
- Card "O seu plano está a ser preparado" com timeline 4 passos (Recolha · Avaliação · Plano em construção · Plano pronto). O passo actual ilumina-se a amber a partir de heurísticas (`assessments` existe? `clients.intake_status`? alguma `workout_plans` em status≠finalised?).
- Card "Enquanto espera" com 2-3 acções: completar perfil (link para `/intake/$token` se ainda aberto), enviar mensagem ao treinador, fazer check-in de baseline.

## Mudanças de dados (1 migração)

**Nova tabela `client_checkins`** — base para autoreg + casa do cliente. Campos relevantes: `client_id`, `trainer_id`, `checked_on date` (UNIQUE com client_id), `sleep_quality 1-5`, `soreness_level 0-10`, `energy_level 1-5`, `notes text`. RLS: cliente faz CRUD nos seus próprios via `clients.user_id = auth.uid()`; PT lê os do seu cliente. Sem trigger de autoreg neste round — só persistência.

**Reaproveitar `plan_feedback` para mensagens.** Adicionar índice composto `(client_id, status, created_at desc)` se ainda não existir. Sem novas colunas.

**Bucket storage `client-photos`** — adicionar política para `user_id = auth.uid()` poder upload em pasta `progress/{clientId}/...` (path actual é `{trainerId}/{clientId}.{ext}`, precisa de extensão). Resolve-se na mesma migração com nova policy de storage.objects.

## Mudanças de código

**Novo `src/server/me.functions.ts`** — `loadMe` evolui para devolver: tudo o que já devolve + `todayCheckin` + `weekCheckins` + `unreadMessages count` + `lastTrainerMessage` + `lastSessionDate` + `weightSeries` (últimos 90 dias) + `topLifts`. Adicionar `submitCheckin`, `sendMessage` (cliente → PT, escreve em plan_feedback), `addWeightEntry`, `uploadProgressPhoto` (signed upload URL).

**Novo `src/routes/me.tsx`** — vira layout com `<Outlet/>` + bottom nav. Conteúdo "Hoje" passa para `src/routes/me.index.tsx`. Cria `src/routes/me.progresso.tsx` e `src/routes/me.historico.tsx`. Loader partilhado via context.

**Componentes novos** (`src/components/me/`):
- `TrainerHero.tsx` (header + white-label)
- `TodaySessionCard.tsx`
- `CheckinCard.tsx` (com `useOptimistic`)
- `WeekProgressCard.tsx`
- `TrainerMessageCard.tsx` (realtime via channel)
- `EmptyPlanTimeline.tsx`
- `WeightTrendChart.tsx`
- `TopLiftsTable.tsx`
- `ProgressPhotoGrid.tsx`
- `MeBottomNav.tsx`

**i18n**: `src/i18n/locales/{en,pt}/me.json` novos. PT em "você". Outros locales fallback EN.

**CSS tokens**: zero novos — paleta existente (emerald/amber/muted) chega. White-label: derivar `--accent` runtime do `trainer.primary_color` num `<style>` inline no layout, com fallback amber. Mantém o resto do app intacto.

## Smoke checklist (definição de "pronto")

- 375px Mobile Safari: scroll suave, todos os cards lêem-se sem clipping, CTAs ≥44px, bottom nav não cobre conteúdo.
- Cliente real (não preview): pode iniciar sessão, fazer check-in, ver semana, ler/responder mensagem, adicionar peso, fazer upload de foto.
- Preview PT (`?as=`): banner amber persiste em todas as sub-rotas, todas as escritas estão desactivadas com tooltip.
- Estado vazio (cliente novo, sem plano): mostra timeline em vez de white space.
- Logo partido do PT (`logo_url` 404): cai graciosamente para BrandMark.
- White-label: PT com `primary_color = '#9333ea'` vê accents roxos no hero; cliente sem PT custom vê amber.
- Realtime: PT escreve mensagem em `/clients/$id` → cliente vê chegar em <2s sem refresh.
- i18n: nada hardcoded em PT no JSX; tudo via `t('me.*')`.
- Memory update no fim: actualizar a entrada "Casa do cliente (R69)" com as novas superfícies + nota de que `plan_feedback` é o canal de mensagens.

## Por onde começar

Round 1 — fundações + Hoje rico:
1. Migração `client_checkins` + storage policy progress photos.
2. Layout shell `/me` com bottom nav + 3 sub-rotas.
3. `TrainerHero` (resolve logo partido) + `TodaySessionCard` + `CheckinCard` + `WeekProgressCard`.
4. `EmptyPlanTimeline` para estado sem plano.
5. i18n base PT.

Round 2 — Progresso + Mensagens:
6. `/me/progresso` com peso, top-lifts, capacity-gain, fotos.
7. `TrainerMessageCard` com realtime e thread mínima.
8. `/me/historico` paginado.

Confirma se a divisão em 2 rounds te serve, ou queres que o round 1 inclua já as mensagens (reaproveita `plan_feedback`, é barato).