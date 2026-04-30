## O que vamos mudar

Dois ajustes pequenos mas importantes:

### 1. Landing acessível mesmo com sessão activa

Hoje a landing (`/`) mostra sempre **"Sign in"** e **"Start free"** no header — mesmo quando o utilizador já tem sessão. E quando está logged in não há forma óbvia de voltar à página principal a partir do AppShell (o logo leva para `/dashboard`).

Mudanças:
- **`src/routes/index.tsx`** — detectar sessão (`useAuth`) e, se logged in, trocar os botões do header por **"Go to dashboard"** (em vez de Sign in / Start free). Os CTAs internos do corpo ("Draft your first plan", "Create your account") também passam a apontar para `/dashboard` quando há sessão.
- **`src/components/AppShell.tsx`** — adicionar um link discreto **"View landing"** (ou ícone Home) no header, ao lado do "Sign out", para que o trainer possa abrir a landing sem ter de fazer logout.

Resultado: a landing fica navegável em qualquer estado, e logged-in users têm um caminho limpo para a ver e voltar.

### 2. Onboarding checklist: 4 → 7 passos (incluir acompanhamento)

A checklist actual termina no PDF, o que dá a impressão errada de que o trabalho acaba aí. Vamos estendê-la para refletir o **ciclo de acompanhamento** que o produto já suporta.

Lista nova (em `src/components/OnboardingChecklist.tsx`):

```
1. Add your first client            → /clients
2. Run an assessment                → /clients
3. Generate a plan                  → /clients
4. Export a branded PDF             → /plans
5. Log the first session            → /plans   (mark a day as Done/Partial/Missed)
6. Review compliance & adherence    → /clients/$id  (Compliance Dashboard)
7. Re-assess and iterate the plan   → /clients   (snapshot / new assessment)
```

Mudanças concretas:
- **`src/components/OnboardingChecklist.tsx`** — ampliar `Steps` e `STEPS` para 7 entradas; ajustar copy do dialog ("Seven steps to a full coaching loop. X/7 done."); subtitle deixa de prometer "first branded plan" e passa a falar do ciclo completo.
- **Marcação automática dos novos passos** (usando o helper `markOnboardingStep` já existente):
  - `log_session` → marcado quando o trainer cria o primeiro `workout_sessions` (qualquer status). Hook no `DayQuickMark` em `src/routes/plans.$planId.tsx` após o insert bem-sucedido.
  - `review_compliance` → marcado quando o trainer abre o `ComplianceDashboard` num cliente (efeito no mount em `src/components/ComplianceDashboard.tsx`).
  - `reassess` → marcado quando é guardado um segundo assessment OU quando o plano é regenerado para um cliente que já tinha plano. Hook no fluxo de save de assessment / generate plan.
- **DB**: nenhuma alteração de schema. O campo `onboarding_steps` é `jsonb`, aceita as novas chaves directamente.

### Notas técnicas

- A landing já é uma rota pública sem guard, portanto basta ajustar a UI do header para reagir a `useAuth().user`. Sem mudanças no router.
- O `markOnboardingStep` já é tolerante (faz merge do JSON), por isso adicionar chaves novas não quebra perfis antigos.
- A barra de progresso no dialog escala automaticamente porque usa `STEPS.length`.
- Utilizadores que já tinham `onboarding_completed = true` **não voltam a ver** o dialog (comportamento intencional — não queremos reabrir a checklist a quem já a fechou). Se quiseres que reabra para todos, dizes e adiciono uma migration que faz `update profiles set onboarding_completed = false`.

### O que NÃO está incluído

- Não estou a redesenhar a landing nem a mexer nos CTAs principais — só na lógica de auth do header.
- Não estou a adicionar uma nova página de "journey overview" — a checklist continua a ser o único guia.