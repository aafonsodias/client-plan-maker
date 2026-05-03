# Próxima ronda — Forge ready-to-use (P0 → P1 → P2)

**Objetivo:** app utilizável "out of the box" → cliente vê portal próprio → custos travados.

---

## Onda P0 — Limpeza + correções críticas (~1h)

### 1. Top bar responsive proper

`src/components/AppShell.tsx`**:**

- Breakpoint nav desktop: `md` (768) → `lg` (1024). Abaixo: hamburger
- Entre `lg`–`xl`: só ícones com `title` tooltip
- Founder badge: só ícone Sparkles abaixo de `xl`
- ShareAppButton: hidden `<lg`

### 2. StageCard colapsa fisicamente

`src/components/StageCard.tsx`**:**

- Trocar classe `hidden` por `{!collapsed && children}` (não basta esconder visualmente — não renderizar)
- Auditar todos os usos para garantir consistência

### 3. Foto rosto intake → perfil cliente

`src/server/intake.functions.ts` **(submitIntake):**

```ts
if (extended.photos?.face && !clients.photo_url) {
  clients.photo_url = extended.photos.face;
  clients.photo_verified = true; // ✓ amber badge no avatar
}

```

- Cliente pode auto-upload depois (perde `photo_verified`)
- Migration adicionar coluna `clients.photo_verified boolean default false`

### 4. Demo escondido para users normais

- `src/routes/clients.tsx`: gate DemoLabPanel + botão "Cliente demo" atrás de `isFounder && search.lab === '1'`
- `src/routes/dashboard.tsx`: idem DemoClientBanner
- **Migration cleanup:** `DELETE FROM clients WHERE is_demo=true AND trainer_id=<founder_uid>` (com confirmação log)
- Demo só acessível via `/clients?lab=1` para founder

### 5. Intake "Who is this for?" → coaching mode

`src/routes/intake.$token.tsx` **(slide 2):**

Trocar pergunta atual por:

```
"Como vais treinar comigo?"
- Presencial
- Online (longa distância)
- Híbrido

```

Grava em `extended.coaching_mode`. Stage 3 microcycle usa para decidir nível de detalhe das cues (presencial = breve, online = detalhado).

### 6. Tela final intake — nome + animação

`src/routes/intake.$token.tsx` **(final screen):**

```tsx
const firstName = formState.client_full_name?.split(' ')[0];
"Obrigado{firstName ? `, ${firstName}` : ''}!
O teu treinador vai rever isto antes da primeira sessão."

```

- Animação CSS-only: anel amber pulse 1× + check com spring (0.5s, sem Lottie)

### 7. Auth no fim do intake (opcional)

`src/routes/intake.$token.tsx` **(novo slide pós-thanks):**

Card opcional:

```
"Cria a tua conta para acompanhar o plano"
- Email pré-preenchido (read-only)
- Senha OU "Sign in with Google"
- Botão "Criar conta" → auth.signUp + clients.user_id = uid + profiles.account_type = 'coached_client' → redirect /me
- Botão "Skip" → magic link enviado, pode registar depois

```

Skip é safe — não bloqueia entrega ao PT.

### 8. Adicionar cliente manual

`src/routes/clients.tsx` **(dialog "novo cliente"):**

Tabs ou dropdown:

- "Convidar via link" (atual)
- "Adicionar manual" (novo): nome + email opcional → cria com `intake_status='manual'` → abre `/clients/$id` para PT preencher à mão

---

## Onda P1 — Portal cliente + intake rico (~1.5h)

### 9. Rota `/me` — cliente vê plano (read-only)

**Auto-redirect:** se `profiles.account_type='coached_client'` e `clients.user_id=auth.uid()`, `/dashboard` → `/me`.

`src/routes/me.tsx` **(novo):**

Voz "tu", read-only, secções:

1. **Próxima sessão** — data + foco + botão "Ver sessão"
2. **Plano atual** — semana X de Y, blocos visuais (cor por fase), RPE alvo
3. **Evolução** — sparkline e1RM dos lifts principais; tabela sessões logadas
4. **Pagamentos** — tabela `client_payments` (a criar): data | pack | EUR | status
5. **Feedback** — botão "Pedir ajuste" → modal → `client_messages` table → notifica PT

### 10. Red-team portal — proteções

**RLS strict:**

```sql
-- coached_client só vê o seu próprio
CREATE POLICY clients_self ON clients FOR SELECT USING (user_id = auth.uid());
CREATE POLICY plans_own ON workout_plans FOR SELECT USING (
  client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
);
-- idem sessions, payments, client_messages

```

**Bloqueios:**

- Coached_client não pode: editar plano, ver IA logs, ver `trainer_id`, ver custos, ver outros clientes
- `client_messages`: unidirecional (cliente → PT only)
- Foto self-uploaded: perde `photo_verified` badge

### 11. Intake — ergonomia + secções

**Lesões:** chips frequentes (`Joelho`, `Lombar`, `Ombro`, `Punho`, `Tornozelo`, `Quadril`) + campo livre.

**Equipamento:** remover separadores; single list; categoria por **cor** + legenda lateral colapsável (poupa altura).

**Fotos:**

- Secção "Perfil" (rosto) — separada de "Postura/Evolução" (corpo 4 ângulos)

**Novas secções:**

- Histórico exames recentes (BP, colesterol, etc — opcional)
- Contacto emergência (nome + tel)
- Fuso horário (online clients)
- Preferência comunicação: WhatsApp / Email / In-app

**Animação final:** CSS @keyframes (check spring, anel pulse). Sem Lottie.

### 12. Smart measurable + deadline com IA

**Slide novo (antes de "thanks"):**

```
"Como vais medir progresso? Até quando?"

Chips: 1RM | Reps | Aparência | Força relativa | Custom
+ Botão "💡 Sugerir com IA" → google/gemini-flash (~$0.0001/call)
  Input: goal + training_age + sport + coaching_mode
  Output: "Recomendação: XXX até DD/MM"
  Cliente aceita ou edita
Grava em extended.goal_measurable + extended.goal_deadline

```

---

## Onda P2 — Custos + merge + housekeeping (~1h)

### 13. Merge `/schedule` ↔ `/clients`

`src/routes/clients.tsx`**:**

Lista densa default:

- Linha: avatar | nome | nº planos | última sessão | próxima sessão | fase | ações
- Sort: nome / última / próxima / plano ativo
- Filtros: all / onboarding / active / idle / ready

Botão "📅 Agenda" → `?view=calendar` (sub-vista, mesma rota, grid semana)

Eliminar rota `/schedule` isolada (redirect para `/clients?view=calendar`).

### 14. Drop-off radar → "Reengajamento"

- Renomear "Drop-off radar" → "Reengajamento" (PT)
- Adicionar `<InfoHint/>`: *"Detecta clientes >7 dias sem sessão. Sugere mensagem para reengajar."*

### 15. Cost guardrails (CRÍTICO)

**Hard cap mensal:**

```ts
// profiles.monthly_ai_cents_cap
// default: 500 (€5) free | 2000 (€20) paid

// Helper antes de cada call AI:
async function assertWithinBudget(userId, modelCost) {
  const spent = await getMonthSpend(userId);
  const cap = await getCap(userId);
  if (spent + modelCost > cap) {
    return { error: 'budget_exceeded', toast: 'Limite mensal atingido' };
  }
}

```

**Routing barato por defeito:**

- Stage 1 (brief): Google Gemini Flash
- Stage 2 (blueprint): Haiku ou Gemini Flash
- Stage 3 (microcycle): GPT-5 / Sonnet **só em dias críticos**; resto determinístico (RPE floor + fórmula volume + templates)
- Stage 4 (finalize): SQL puro, zero IA

**Demo:** clones SQL pré-cooked, zero IA. Manter como está.

**Telemetria founder:**

- `/founder/costs` — spend agregado/mês, breakdown user, sparkline trend

### 16. Renomear "Estúdio de treino" → **"Bancada"**

(Alinha com `WorkbenchMockup`, vibe craftwork PT)

### 17. Botão duplicado new client

Após P0 #4 + #8 — fica um único dropdown CTA: "+ Convidar via link / Adicionar manual".

### 18. Filtros + arquivar + bulk actions

`/clients` **e** `/templates`**:**

Header: sort por nome / criado / última atividade

Multi-select (checkbox row):

- Arquivar
- Exportar CSV
- Apagar (só archived, com `AlertDialog` confirm — segurança contra apagar ativos)

Toggle "Mostrar arquivados?" → revela coluna escondida by default.

---

## Ordem de execução


| Onda | Items | Tempo | Entrega                            |
| ---- | ----- | ----- | ---------------------------------- |
| P0   | 1–8   | ~1h   | App utilizável, sem ar de obra     |
| P1   | 9–12  | ~1.5h | Portal cliente + intake polido     |
| P2   | 13–18 | ~1h   | Custos safe + merge + housekeeping |


---

## Respostas às perguntas (decididas)

1. **Nome:** "Bancada" (alinha com WorkbenchMockup já existente)
2. **Demo cleanup:** **Sim**, apagar clientes demo dos founders + esconder UI para non-founders
3. **/me pagamentos:** **Sim** — cliente vê valores quando já pago + status do pendente (transparência > opacidade)
4. **Auth no intake:** **Opcional** (skip envia magic link). Não bloqueia entrega.

---

**GO.**