## O raciocínio em duas perguntas

Estás a misturar duas coisas (de propósito, e bem):

1. **Tu, treinador, queres ver o que o cliente vê** — sem segundo telemóvel, sem segunda conta. É uma ferramenta de QA interna, não uma feature comercial.
2. **O cliente do PT (o utilizador final)** — o que é que ele precisa mesmo de ter quando paga ao PT que paga ao Forge? Esta é a decisão de produto importante.

Resposta curta: **duas superfícies, **uma** componente partilhada**. O "ver como cliente" do treinador é apenas o mesmo ecrã de cliente, alimentado pelos dados a que o treinador já tem acesso por RLS. Zero impersonation, zero magia.

---

## Parte A — Ver como cliente (para ti, treinador)

### Estado actual
- O cliente hoje só tem 2 superfícies, ambas por token: `/intake/$token` (avaliação) e `/log/$token` (registar treino).
- Não existe ainda uma "casa do cliente" autenticada. `clients.user_id` + RLS "coached client reads own row" estão preparados em DB mas sem UI.
- Logo: hoje, "ver como cliente" significa principalmente *ver o que ele veria se houvesse uma casa de cliente* — o que é exactamente o gancho para construirmos a Parte B em simultâneo.

### Mecânica proposta
- Nova rota `/clients/$clientId/preview` (ou botão "Ver como {Nome}" no header do cliente) que renderiza **a mesma componente** que a futura casa-do-cliente (`<ClientHome/>`).
- Em modo preview, os dados vêm das queries normais do treinador (RLS de trainer). Em modo real (cliente autenticado), vêm das mesmas queries com filtro `client_id = me`.
- Banner amber persistente no topo: `Pré-visualização como {Nome} · Sair`. Bloqueia escritas (toda a UI fica `aria-disabled` para acções que escreveriam como cliente — ex.: registar set, marcar check-in). Isto é não-negociável: senão poluis dados reais.
- Anchor `data-tour="client-preview"` para o tour.

### Porque isto é a opção certa
- **Custo zero em auth.** Não precisas de impersonation tokens, second device, nem GDPR.
- **Reutilização de componente garantida.** Se a Parte B partir da mesma `<ClientHome/>`, qualquer melhoria que faças em preview já beneficia o cliente real.
- **Loop de feedback imediato.** Vês exactamente o estado real (incluindo empty states que talvez nunca terias notado).

### Telemetria mínima
- `generation_log` não serve aqui (é AI). Adicionar coluna `profiles.client_preview_count` ou um `console.info` simples por agora — basta saber se a usas.

---

## Parte B — O que o cliente do PT precisa de ver

Antes do "como", o "porquê". O cliente paga ao **PT**, não ao Forge. A casa-do-cliente é, para o cliente, *a app do PT dele*. Logo:
- White-label real: `profiles.business_name`, `logo_url`, `primary_color`, `tagline` já existem — usar a sério, sem "Forge" visível em lado nenhum dentro deste shell.
- Mobile-first absoluto. 90% destes clientes abrem isto no WC do ginásio.

### As 6 jobs-to-be-done do cliente (priorizadas)

| # | Job | Ecrã |
|---|---|---|
| 1 | "O que faço hoje?" | Sessão de hoje — exercícios, séries × reps, carga sugerida vs. última, cues, critérios de forma. Botão grande "Começar". |
| 2 | "Registar o que fiz" | Logbook por set (já existe em `/log/$token` — promover a primary surface). Auto-progressão NSCA visível. |
| 3 | "Estou a evoluir?" | Top-Lifts trend + e1RM por padrão (Squat/Hinge/Push/Pull) + ring de adesão. Já temos `capacity-gain.ts` e `EvolutionSparkline`. |
| 4 | "Porque é que estou a fazer isto?" | Brief do bloco em linguagem simples (1 parágrafo do PT) + chip "Bloco N · evoluiu de Bloco N-1". Confiança = retenção. |
| 5 | "Como me sinto / aviso o PT" | Check-in diário leve: sono 1-5, dores (mapa corporal simples), "vou faltar terça". Alimenta `programNextWeek` autoreg. |
| 6 | "Quando é o próximo treino + saldo do pack" | Próximas sessões agendadas + saldo "5 de 10 sessões usadas". |

### O que o cliente **NÃO** vê (firewall claro)
- Preçário Forge, billing, dashboard de outros clientes
- Cockpit de intensidade, blueprint editor, microcycle phase rails, model picker, knowledge profiles
- `generation_log`, custos AI, telemetria interna
- Templates, manual de treinador, admin
- Branding "Forge" — só o do PT

### Modelo de acesso (decisão pendente, recomendação abaixo)
- **A. Token-only** (estender `/log/$token`): zero atrito, zero passwords. Limitação: link sprawl, sem multi-device fácil.
- **B. Auth real** (`clients.user_id` + email/password): seguro mas atrito alto para clientes não-técnicos.
- **C. Magic-link → cookie persistente**: o PT envia link uma vez, o telemóvel do cliente fica logado para sempre. **Esta é a recomendação.** Sem passwords, multi-device opcional via novo magic-link, revogável.

---

## Sequência de entrega (3 PRs pequenos, não 1 grande)

1. **PR1 — Esqueleto da `<ClientHome/>` em modo preview-only.** Rota `/clients/$clientId/preview` para o treinador. Renderiza Hoje + Brief + Top-Lifts + Próximas sessões com dados reais. Escritas bloqueadas. White-label dos `profiles`. Sai com tudo que tu precisas para fazer QA.
2. **PR2 — Check-in diário do cliente** (job #5). Tabela nova `client_checkins` (sleep, soreness, RPE diário, missed-session flag). Surface dentro de `<ClientHome/>`. Liga ao `programNextWeek` autoreg via novo input.
3. **PR3 — Auth do cliente real (magic-link).** Activa `clients.user_id`, fluxo de invite, cookie persistente, mesma `<ClientHome/>` renderizada com filtro real. Logbook actual `/log/$token` migra para `/c/sessions/$id`.

Cada PR é entregável e útil sozinho. PR1 sozinho já te resolve a tua dor original.

---

## Aspectos técnicos (para o teu lado)

- **Componente única `<ClientHome/>`** em `src/components/client-home/` consumindo um hook `useClientHomeData(clientId, mode: "preview" | "self")`. O hook escolhe a query e RLS adequados.
- **Bloqueio de escritas em preview**: wrapper `<PreviewGuard>` que intercepta clicks em botões com `data-mutates="true"` e mostra toast "Modo pré-visualização — sem efeito".
- **Tabela nova (PR2)**: `client_checkins (id, client_id, trainer_id, date, sleep, soreness jsonb, missed boolean, note)` com RLS dupla: trainer-owns-all + coached-client-owns-self. Migration separada com backup.
- **Magic-link (PR3)**: usar `supabase.auth.signInWithOtp({ email })` + `emailRedirectTo: /c`. Email customizado com branding do PT (já temos RESEND_API_KEY).
- **i18n**: tudo via `t()` em `pt/common.json` namespace `client_home.*`. PT-PT humano, EN fallback.
- **Memória de produto a guardar quando aprovares**: "Casa do cliente = `<ClientHome/>` única, modo preview (treinador, sem escritas) e modo self (cliente autenticado). White-label total."

---

## O que não faço nesta ronda
- Não toco em billing, AI generation, schedule, ou outras superfícies do treinador.
- Não construo a Parte B inteira de uma vez. Só PR1.
- Não introduzo passwords nem fluxo de signup público para clientes — magic-link no PR3.