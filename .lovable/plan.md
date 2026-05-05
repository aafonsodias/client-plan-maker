# Auditoria visual ponta-a-ponta do Protocol

Objectivo: percorrer todas as rotas reais da app, tirar prints (desktop 1366 + mobile 375), listar onde fazem falta melhorias e propor **fusões cirúrgicas** que não partam o caminho que montámos (intake → brief → blueprint → microcycle → progressions → PDF, tudo inline em `/clients/$id`).

---

## Fase 1 — Inventário visual (apenas leitura, sem código)

Percorrer e fotografar (desktop + mobile, modo escuro e claro nos casos críticos):

**Públicas / chrome**
- `/` landing — 1ª dobra, anti-ChatGPT, ForWhom, Journey, Comparison, Founder, FAQ, Closing, Footer
- `/auth` — signup/login + OAuth
- `/intake/$token` — fluxo do cliente (modo focado)
- `/log/$token` — registo de sessão + import por foto
- `/manual` — Manual / FAQ / Contacto
- `/privacy`, `/terms`

**App (autenticado)**
- `/dashboard` — PlansStatusBar, ThisWeekHero, hints, onboarding
- `/clients/$id` — **a espinha dorsal**: 5 stages inline, BriefContextRail, ClientCockpit
- `/clients/$id/year` — YearView
- `/plans` — index
- `/plans/new`
- `/plans/$id` — view/edit/log/Resultados/Progresso, Table/Cards, CapacityGainCard, VolumeSection
- `/plans/$id/blueprint`, `microcycle`, `progressions`, `sessions` (deep-links de back-compat)
- `/templates`
- `/schedule`, `/schedule/packs`
- `/billing`
- `/settings`, `/me`, `/welcome`

Para cada rota: print + 3-5 bullets com problemas (alinhamento, densidade, redundância, copy, contraste, mobile, tom de cor segundo `status-tone.ts`).

---

## Fase 2 — Mapa de fusões candidatas (sem partir o protocolo)

Hipóteses iniciais (a confirmar com prints; nenhuma toca o caminho inline aprovado):

1. **`/me` + `/settings`** → uma só `/settings` com tabs (Conta, Preferências, Cobrança-link, Marca). `/me` passa a redirect.
2. **`/welcome` + onboarding do `/dashboard`** → `OnboardingChecklist` no dashboard absorve o welcome; `/welcome` só sobrevive como first-run.
3. **`/plans` + `/templates`** → tabs dentro de `/plans` (Planos · Templates · Arquivo). Reduz nav lateral.
4. **`/schedule` + `/schedule/packs`** → tabs (Semana · Packs · Receita). Já partilham layout.
5. **`/plans/$id/{blueprint,microcycle,progressions,sessions}`** → manter como redirects para `/clients/$id?stage=…` (já está parcialmente assim no `brief.tsx`); confirmar que nenhum link interno aterra nestas rotas.
6. **`/manual`** → já consolidado (Manual/FAQ/Contacto). Confirmar que o link "Contacto" do footer aponta cá e não duplica.
7. **`ClientCockpit` no expand de `ClientPlayerCard`** vs **header do `/clients/$id`** → garantir que não estamos a mostrar a mesma coisa duas vezes (ACSM/Recovery chips aparecem em ambos).

**O que NÃO se funde (regra dura):**
- Os 5 stages do `/clients/$id` ficam inline, um por baixo do outro. Nada de tabs aí.
- `/log/$token` fica isolado (cliente final, sem chrome da app).
- `/intake/$token` idem.
- Landing fica numa só rota — secções não viram páginas.

---

## Fase 3 — Entregável

Um único documento em `/mnt/documents/audit-2026-05.md` com:
- Thumbnail de cada rota (desktop + mobile lado a lado).
- Tabela "Rota · Problemas · Severidade (P0/P1/P2) · Proposta".
- Secção "Fusões propostas" com diff de navegação antes/depois.
- Secção "Quick wins" (≤30 min cada) separada de "Refactors" (precisam de ronda própria).
- Actualização do `.lovable/backlog.md` com os P0/P1 priorizados.

Sem alterações de código nesta fase. No fim apresento o documento e tu decides quais fusões avanço numa ronda seguinte (uma fusão = uma ronda, para respeitar "1 concern per round").

---

## Notas técnicas

- Uso `browser--navigate_to_sandbox` (1366×768 e 375×812) + `browser--screenshot` para cada rota.
- Para rotas com `$param` (cliente, plano, token), uso o cliente demo já semeado (Demo Lab) ou o primeiro cliente/plano do utilizador autenticado no preview.
- Cada print é guardado em `/mnt/documents/audit-2026-05/` com naming `route__viewport.png`.
- QA visual: leio cada print antes de escrever o bullet — sem confiar só no DOM.

Aprovas? Assim que disseres "ok" arranco pela landing e vou rota a rota.
