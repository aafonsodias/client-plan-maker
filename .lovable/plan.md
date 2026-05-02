# Plano: avaliação contextual + planos manuais + reassessments

Cinco frentes, todas dentro de `src/routes/clients_.$clientId.tsx` + alguns componentes/migration novos. Ordem: (1) limpeza visual da avaliação, (2) cadência de medições, (3) reassessment lembretes, (4) reorganização do perfil do cliente, (5) novo plano manual + "evoluir do último plano".

---

## 1. Esconder "Revisão de segurança" + "Descartar rascunho" quando há plano pronto

Quando existe pelo menos um `workout_plans` com `generation_status = 'complete'` cuja `assessment_id` corresponde à avaliação atualmente carregada (ou, fallback, com `created_at >= assessment.performed_on`), os botões inferiores da avaliação tornam-se ruído — o trabalho está feito.

Comportamento:
- Esconder o `AlertDialog` de "Descartar rascunho" e o botão vermelho "Revisão de segurança" / "Gerar plano" quando `hasReadyPlanForCurrentAssessment === true`.
- Em vez disso, mostrar um chip discreto "Plano pronto · ver" que faz scroll para a secção *Planos*.
- Reaparecem se o utilizador editar a avaliação (`assessment.updated_at > readyPlan.created_at`) ou criar uma nova reavaliação.

## 2. Avaliação inteira colapsa em "Última avaliação 02/05/2026"

Atualmente cada uma das 14 secções aparece sempre expandida em altura (mesmo colapsada o cabeçalho ocupa ~52px x 14 = ~730px de scroll). Mudanças:

- **Container colapsável**: envolver toda a Avaliação num `<details>` (ou um `Collapsible` shadcn). Quando colapsado mostra só o cabeçalho compacto: *"Avaliação · Última 02/05/2026 · 14 secções · 93%"* + chevron.
- **Default colapsado quando há plano pronto**; default expandido quando não há ou quando há rascunho ativo.
- **Linhas de secção mais densas**: `py-2 px-3` (em vez de `py-3.5 px-4`), tipografia `text-[11px]`, ícone de info `h-3 w-3`, sem espaçamento extra entre secções (`space-y-1` em vez de `space-y-3`). Mantém apenas 1 linha de altura por secção colapsada.
- "EXPANDIR TUDO / COLAPSAR TUDO" passa a um par de chips inline mais pequenos no cabeçalho da avaliação, não cards separados.

## 3. Cadência de medições: diárias vs periódicas

Hoje tudo vive na mesma `assessments` row e parece tudo da mesma natureza. Separar:

- **Diárias** (livres, opcionais por cliente): FCR ao acordar, peso, sono (1–10), stress (1–10), sorencia, hidratação. Cada cliente decide quais quer registar.
- **Periódicas (~bisemanal/mensal)**: circunferências (cintura/anca), %BG, RHR repouso, BP. Lembrete cada 14 ou 30 dias.
- **Reassessment completa** (~6–12 semanas, configurável): subset da avaliação inicial — objetivo, prontidão, performance, screen de movimento, mobilidade. Não repete PAR-Q+ nem ACSM (a menos que tenha passado >6 meses).

Nova tabela `client_measurements`:

```sql
create table public.client_measurements (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null,
  client_id uuid not null,
  measured_on date not null default current_date,
  cadence text not null check (cadence in ('daily','periodic')),
  values jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);
-- index (client_id, measured_on desc), RLS auth.uid() = trainer_id
```

Nova tabela `client_measurement_prefs` (1 linha por cliente):

```sql
create table public.client_measurement_prefs (
  client_id uuid primary key,
  trainer_id uuid not null,
  daily_fields text[] not null default '{}',     -- ex: {'rhr_wake','weight','sleep'}
  periodic_fields text[] not null default '{}',  -- ex: {'waist','hip','bf'}
  periodic_interval_days int not null default 14,
  reassessment_interval_days int not null default 56,
  updated_at timestamptz not null default now()
);
```

UI no perfil do cliente:
- Card *"Medições · diárias"* — lista os 3–5 valores mais recentes em sparklines mini (peso, FCR, sono). Botão "+ registar hoje" abre um drawer pequeno com só os campos ativos.
- Card *"Medições · periódicas"* — circunferências/composição, com chip *"Devido em X dias"* baseado em `periodic_interval_days - (today - last.measured_on)`.
- Settings inline (engrenagem) para cada cliente escolher que campos quer.

## 4. Lembretes de reassessment

Banner amber no topo do perfil quando hoje >= `last_full_assessment.performed_on + reassessment_interval_days`:

> *Marta fez a última avaliação completa há 9 semanas. É boa altura para uma reavaliação parcial (objetivo, screen, performance) — leva ~7 min.*

Botão "Iniciar reavaliação" abre o formulário de avaliação mas com 5 secções pré-selecionadas (objetivo, prontidão, screen, mobilidade, performance) e marca `assessments.kind = 'reassessment'` (nova coluna `text` opcional).

Migration adicional:
```sql
alter table public.assessments add column if not exists kind text not null default 'full';
-- 'full' | 'reassessment'
```

## 5. Perfil do cliente: o que ver + "+ Novo plano"

O perfil hoje é um stream linear gigante. Reorganizar para:

```text
┌──────────────────────────────────────────────────┐
│ [Avatar] Marta Quintela (demo)         [editar]  │
│ Snapshot · risco/recuperação/composição          │
├──────────────────────────────────────────────────┤
│ Resumo do treinador (3-5 linhas, livres)         │
│ "Marta foca dorso/posterior, joelho dir. sensí…" │
├──────────────────────────────────────────────────┤
│ ▸ Avaliação · 02/05/2026 (colapsada)             │
├──────────────────────────────────────────────────┤
│ Medições diárias · sparklines + [+ hoje]         │
│ Medições periódicas · [devido em 4d]             │
├──────────────────────────────────────────────────┤
│ Planos                                  [+ Novo] │
│   • Bloco 1 · Pronto · 02/05                     │
│   • Bloco 2 · Em curso ·                         │
└──────────────────────────────────────────────────┘
```

- **Resumo do treinador**: novo campo `clients.trainer_summary text` (free text, ≤500 chars). Aparece sempre visível como cartão pequeno acima da avaliação.
- **Planos** ganha um botão `[+ Novo plano]` no header da secção.

### Novo plano manual + automático "evoluir do último"

Clicando `+ Novo plano` abre um pequeno popover com duas opções:

1. **Plano em branco (manual)** → cria `workout_plans` row com `generation_status = 'manual'`, `plan_data = { weeks: [] }`, redireciona para `/plans/$planId` em modo `edit`. O editor existente (`MesocycleTableView` em modo `edit`) já permite adicionar dias/exercícios à mão. Sem chamada a IA, sem consumir quota.
2. **Evoluir do último plano concluído (IA)** → só ativo se existir `workout_plans` com `status in ('archived','complete')` e logbook não-vazio. Reusa `archivePlanAndStartNextBlock({ priorPlanId: lastFinishedPlan.id })` (já existe em `src/server/blocks.functions.ts`). O botão fica desativado com tooltip *"Termina e regista pelo menos 1 sessão para evoluir."* se o último plano não tem sessões.

Status de "concluído pelo cliente" — separar de `archived`. Adicionar `workout_plans.completion_state text` opcional: `'in_progress' | 'finished_logging' | 'archived'`. Botão "Marcar como terminado" no plano (`/plans/$planId`) escreve `finished_logging` quando o cliente diz que acabou de registar. Só com `finished_logging` é que aparece o "Evoluir" em Novo Plano.

Migration:
```sql
alter table public.clients add column if not exists trainer_summary text;
alter table public.workout_plans add column if not exists completion_state text;
```

---

## Detalhes técnicos

**Ficheiros tocados**
- `src/routes/clients_.$clientId.tsx` — colapsar avaliação, esconder ações draft, banner reassessment, secção planos com `+ Novo plano`, snapshot já existe.
- `src/components/AssessmentSection.tsx` (novo wrapper) — extrair as secções colapsáveis, normalizar densidade.
- `src/components/ClientMeasurementsCard.tsx` (novo) — sparklines (`recharts` mini line) + drawer de input.
- `src/components/MeasurementPrefsSheet.tsx` (novo) — escolha de campos diários/periódicos.
- `src/components/NewPlanPopover.tsx` (novo) — duas opções manual/IA.
- `src/server/measurements.functions.ts` (novo) — `recordMeasurement`, `listMeasurements`, `getPrefs`, `updatePrefs`.
- `src/server/blocks.functions.ts` — pequena adição: aceitar plans com `completion_state = 'finished_logging'` além de `archived`.
- `src/integrations/supabase/types.ts` — regenerado pela migration.

**Migrations (1 ficheiro)**
1. `client_measurements` + RLS (trainer-only, `auth.uid() = trainer_id`).
2. `client_measurement_prefs` + RLS.
3. `assessments.kind text default 'full'`.
4. `clients.trainer_summary text`.
5. `workout_plans.completion_state text`.

**Lógica de "plano pronto para esta avaliação"**
```ts
const readyPlanForAssessment = useMemo(() =>
  plans.find(p =>
    p.generation_status === 'complete' &&
    (p.assessment_id === assessment?.id ||
     (assessment?.performed_on &&
      new Date(p.created_at) >= new Date(assessment.performed_on)))
  ), [plans, assessment]);
```

**Sparklines** — usar `recharts` (já no bundle) com `<LineChart width={120} height={28}>` sem eixos.

**Pré-selecção de secções na reavaliação** — passar `?kind=reassessment&sections=goal,readiness,screen,mobility,performance` ao formulário; o componente esconde as outras secções e marca `kind` na submissão.

**Out of scope** (próximas iterações, evita drift):
- Notificações push/email para reassessment.
- Auto-sync com wearables (Apple Health / Garmin) para FCR e sono.
- Editor visual drag-and-drop para o plano manual (usa o editor de tabela existente).
- Versionamento do `trainer_summary`.

---

Reply **"continua"** para executar pela ordem: (A) migration → (B) colapsar avaliação + esconder draft actions → (C) +Novo plano popover → (D) trainer summary + reorganização do perfil → (E) measurements (cards + drawer + prefs) → (F) reassessment banner + flow.
