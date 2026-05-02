
## Visão geral

Hoje a app tem 1 papel (treinador). O cliente é só um registo na tabela `clients` e preenche a avaliação por um link anónimo (`/intake/$token`) que já funciona. Tu queres o cliente como **utilizador com conta própria**, que entra, vê o plano dele, deixa notas, e cuja informação a IA usa para avisar o treinador (lesões novas, aniversário, faltas, etc.).

Isto é um corte grande. Vou faseá-lo para que cada fase seja entregável sozinha e nada do que já funciona quebre.

---

## Fase 1 — Coach Dashboard guiado + intake mais visível (1 sessão)

**Sem mexer em auth/roles.** Resolve o problema imediato dos screenshots: dashboard vazio que não guia, e o link de intake escondido dentro do detalhe do cliente.

### 1A. Dashboard "Studio" guiado

Reescrever `src/routes/dashboard.tsx`:

- **Quando 0 clientes**: hero claro com 1 ação primária — *"Adicionar primeiro cliente"* — e abaixo um bloco *"Como funciona em 3 passos: 1) Adicionar cliente · 2) Enviar link de avaliação · 3) Gerar plano"*. Cada passo é uma linha, não um wizard modal.
- **Quando ≥1 clientes mas 0 planos**: hero passa a *"Envia o link de avaliação"* com a lista de clientes que ainda não submeteram.
- **Quando ≥1 plano**: layout atual (stats + planos recentes), mas no topo uma faixa de **ações rápidas** (3 botões): `Adicionar cliente` · `Copiar link de avaliação` (do último cliente sem submissão) · `Novo plano`.
- **"Atenção do PT" panel** (novo): lista até 5 itens accionáveis ordenados por urgência:
  - clientes com intake submetido por rever
  - clientes sem submissão há >7 dias (re-enviar link)
  - aniversários nos próximos 7 dias *(precisa de §1C)*
  - notas novas do cliente *(vem na Fase 3, fica vazio até lá)*

Mantém-se `OnboardingChecklist` e `DropoffAlerts`.

### 1B. "Adicionar cliente" simplificado + link no fim

O dialog atual (screenshot 2) pede 6 campos antes de gravar. Mudar para:

- **Mínimo viável**: só *Nome* e *Email* obrigatórios. *Idade, sexo, altura, peso* movem-se para a intake (cliente preenche).
- Imediatamente após gravar, abrir um **passo 2** dentro do mesmo dialog: bloco grande com o link de intake já gerado + botões `Copiar`, `WhatsApp`, `Email`. Isto torna óbvio que o próximo passo é enviar o link, não preencher tudo manualmente.

### 1C. Aniversários

- Migration: adicionar `date_of_birth date` à tabela `clients`. `age` continua a existir mas passa a ser derivado / opcional (não removo já para não partir o que usa).
- Adicionar campo `date_of_birth` ao formulário da intake (`src/routes/intake.$token.tsx`) — opcional mas sugerido.
- Helper `src/lib/birthdays.ts`: `daysUntilBirthday(dob)`, `upcomingBirthdays(clients, days=7)`.
- Mostrar no painel "Atenção do PT" — *"🎂 João Silva faz anos em 3 dias."*

### 1D. Knowledge / Manual mais visível

Adicionar card "Manual" no dashboard (lado a lado com stats), e um link **Manual** no nav principal já existe — só ganha mais peso visual na vazia.

---

## Fase 2 — Client account & shared link (1-2 sessões)

Aqui o link deixa de ser anónimo. O cliente que abre o link **cria conta** (passwordless por email, ou OAuth Google) e a partir daí o intake fica associado a `auth.users` dele.

### 2A. Schema: roles e ligação cliente↔user

Nova tabela `user_roles` (segue o pattern recomendado):

```sql
create type app_role as enum ('coach', 'client');
create table user_roles (
  user_id uuid references auth.users on delete cascade,
  role app_role not null,
  primary key (user_id, role)
);
```

Adicionar `clients.user_id uuid references auth.users` (nullable — só preenche quando o cliente aceita o convite).

Função `has_role(_uid, _role)` SECURITY DEFINER (já documentada no projeto).

### 2B. Fluxo de aceitação

`/intake/$token` ganha um header novo: *"Esta avaliação é para ti, [nome]. Cria a tua conta para guardares e voltares depois."*

- Botão **"Continuar com Google"** ou **"Continuar com email"** (magic link).
- No callback, se `clients.user_id IS NULL` para esse token, faz a ligação: `update clients set user_id = auth.uid() where intake_token = X` e adiciona `('client')` em `user_roles`.
- Depois do login, a intake continua igual mas autenticada — RLS muda de "tem o token no header" para "auth.uid() = clients.user_id".
- Mantém-se compatibilidade: se o cliente não quiser conta, ainda pode submeter como anónimo (modo legacy).

### 2C. Convite por email

`generateIntakeToken` (server fn já existe) ganha opção `sendEmail`. Usa o sistema de email do Lovable Cloud para mandar um template simples *"O teu PT [nome] convidou-te para preencheres a avaliação inicial. [Botão: Abrir]"*.

(Se não houver domínio de email configurado, mantém-se o WhatsApp/cópia atual.)

---

## Fase 3 — Client-side dashboard (2 sessões)

Rota nova `/me` (protegida por `_authenticated/_client`), separada do mundo do PT. Layout e tom diferentes — calmo, motivacional, simples.

Conteúdo:

- **O meu plano desta semana** — vista read-only do microciclo atual (reutiliza `SessionDayView`).
- **Logbook fácil** — registar séries da sessão de hoje (reutiliza `ExerciseSetsCard`).
- **Notas para o treinador** — textarea simples + lista de notas anteriores. Cada nota grava em nova tabela `client_notes` (id, client_id, body, created_at, seen_by_coach_at).
- **Métricas básicas** — peso ao longo do tempo, total de sessões registadas. Sem RPE/volume per pattern aqui — manter limpo.
- **Sem acesso** ao gerador de plano, brief, blueprint, etc.

Schema:
```sql
create table client_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients on delete cascade,
  body text not null,
  created_at timestamptz default now(),
  seen_by_coach_at timestamptz
);
```

RLS: cliente lê/escreve só as suas notas (`auth.uid() = (select user_id from clients where id = client_id)`); treinador lê todas as do cliente dele e marca como visto.

### IA awareness

No painel "Atenção do PT" (Fase 1A), aparecem agora notas novas. Botão "Resumir notas" chama uma server fn que passa as últimas N notas ao Lovable AI Gateway (`google/gemini-2.5-flash`) e devolve 1-2 frases — *"Cliente queixa-se de dor lombar há 3 dias; faltou 2 sessões esta semana."*

---

## Fase 4 — Polimento / engagement (depois)

- Comparação básica vs população (peso, força relativa) na vista do cliente.
- Notificações por email quando o PT publica novo plano / quando o cliente regista sessão.
- VO2 max, grip strength, etc. — campos opcionais na intake e métricas, mostrados só se preenchidos.

---

## O que faço **agora** (Fase 1, este turno)

1. Migration: `clients.date_of_birth date`, helper i18n.
2. `src/lib/birthdays.ts`.
3. Reescrever `src/routes/dashboard.tsx` com 3 estados (zero clientes / zero planos / normal), faixa de ações rápidas, painel "Atenção do PT" com aniversários e intakes por rever.
4. Simplificar o dialog "Adicionar cliente" em `src/routes/clients.tsx` para 2 campos + passo 2 com o link gerado e atalhos de partilha (reutiliza `IntakeLinkPanel`).
5. Adicionar campo opcional de data de nascimento à intake (`src/routes/intake.$token.tsx`).
6. i18n PT/EN para todo o copy novo.

Não vou começar a Fase 2 (client accounts) sem confirmação tua, porque mexer em auth/roles é onde se parte coisas em silêncio. Confirma a Fase 1 e, quando estiveres confortável, atacamos a 2.

### Fora de scope (este turno)

- Sem alterar RLS atual.
- Sem criar `user_roles` table.
- Sem rota `/me` ainda.
- Sem email transacional ainda.
