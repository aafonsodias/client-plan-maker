## Round 73 — NextActionCard compacto + prioridade de avaliação

### Objetivo
A `NextActionCard` no `/dashboard` deve estar **sempre** visível (nunca `null`) mas **discreta**: uma faixa fina, não um cartão grande com glow. A prioridade tem de respeitar o pipeline real do treinador — primeiro completar a avaliação, só depois gerar o brief.

### Mudanças

**1. Reescrever `src/components/dashboard/NextActionCard.tsx`**
- Trocar layout grande (avatar 56px, glow amber, gradient) por uma **strip horizontal compacta**: ~56px altura, padding `py-3 px-4`, border `border-amber-500/25` (apenas amber discreto, sem under-glow shadow), avatar/ícone 32px, título 1 linha + CTA pill à direita.
- Remover o `shadow-[0_30px_80px_…]` e o `bg-gradient-to-br`.

**2. Nova lógica de prioridade (top-down, primeira que casa ganha):**
1. **Avaliação submetida → rever** (intake_status = `submitted`) — CTA "Rever avaliação" → `/clients/$id`.
2. **Avaliação incompleta → completar** (intake_status `in_progress` OU `submitted` com `assessment_completion < 100`) — CTA "Completar avaliação" → `/clients/$id` (secção missions). Mostra `{name} · {pct}%`.
3. **Pronto para gerar brief** (intake `submitted`/`reviewed`, `assessment_completion = 100`, sem plano ativo) — CTA "Gerar plano" → `/plans/new?clientId={id}`.
4. **Aniversário ≤ 7 dias** (já existe).
5. **Fallback (estado vazio honesto):** se não há clientes, "Convidar primeiro cliente" → abre InviteDialog. Se há clientes mas nada acionável, copy neutro: "Tudo em dia · {n} clientes ativos" sem CTA (ou CTA secundário "Ver agenda").

**3. Dashboard:**
- `dashboard.tsx` passa também `assessment_completion` no shape do `ClientLite`. Adicionar à query (`clients` select já provavelmente tem; confirmar) + ao tipo da prop.
- Re-passar `onInvite` para o caso fallback "convidar primeiro cliente" (quando `clients.length === 0`).

**4. i18n** (`en/common.json` + `pt/common.json` em `dashboard.next_action.*`):
- `complete_title`: "Completar avaliação · {{name}}" / "Finish assessment · {{name}}"
- `complete_sub`: "{{pct}}% completo — faltam {{missing}} passos" / "{{pct}}% done — {{missing}} steps left"
- `complete_cta`: "Completar" / "Continue"
- `generate_title`: "{{name}} está pronto para o plano" / "{{name}} is ready for a plan"
- `generate_sub`: "Avaliação 100% — gerar brief" / "Assessment complete — generate brief"
- `generate_cta`: "Gerar plano" / "Generate plan"
- `empty_invite_title`: "Convidar primeiro cliente" / "Invite first client"
- `empty_idle`: "Tudo em dia · {{n}} clientes" / "All caught up · {{n}} clients"

**5. Backlog:** marcar #92 como ✅ revisto (compact + lógica correta), criar entrada R73 a documentar a regra:
> "NextActionCard nunca convida a gerar plano com avaliação <100%. Prioridade: rever submetida → completar incompleta → gerar quando 100%."

E gravar isto em memory: novo `mem://principles/next-action-priority.md` para travar regressão futura.

### Fora de escopo
- Engine/AI changes
- Mover a card para outro sítio
- Onboarding checklist (separado)

### Verificação
- 1389×869 (viewport actual) + 375px iOS smoke
- Casos manuais: cliente com `assessment_completion = 40`, cliente `submitted` à espera de revisão, cliente `100%` sem plano, conta sem clientes.
- Confirmar que a strip ocupa ≤72px de altura e não compete visualmente com o resto do dashboard.

### Onde podes ajudar
- Confirma se preferes o fallback "tudo em dia" silencioso (sem CTA) ou se queres sempre um CTA secundário (ex: "Ver agenda de hoje").
- Confirma a copy PT da prioridade #2 — gosto mais de "Completar avaliação" que "Continuar avaliação", mas se preferires outro tom diz.
