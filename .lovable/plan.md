## Estado

Restam 2 itens no backlog:
- **#32** — i18n sweep profundo em `src/routes/clients_.$clientId.tsx` (~30 literals PT em sub-secções de assessment)
- **#33** — Smoke test manual PT/EN antes de publicar

Proposta: 2 rondas curtas (R25 fecha #32, R26 entrega #33 como checklist). Depois disso o backlog fica vazio até nova direção tua.

## R25 — Fechar #32 (i18n clients_.$clientId)

**Alvo:** literais PT remanescentes em painéis de assessment profundos do detalhe do cliente.

**Passos:**
1. `rg` no ficheiro para mapear strings PT cruas (ex.: "Avaliação", "Mobilidade", "Postura", labels de scores 1–5, headers de cartões, toasts).
2. Adicionar namespace `client_detail.assessment.*` a `pt/common.json` e `en/common.json` (agrupado por sub-secção: movement_screen, vitals, history, notes).
3. Substituir literais por `t()` mantendo interpolações (`{{name}}`, `{{n}}`).
4. Datas inline → `toLocaleDateString(i18n.language === "pt" ? "pt-PT" : "en-US")`.
5. Smoke visual em `/clients/$id` em PT e EN (QA viewport).

**Saída:** ~30 chaves novas, 1 ficheiro de rota tocado, 2 locales.

## R26 — Fechar #33 (smoke test checklist)

Como não há UI nova a construir, entrega um checklist versionado em `.lovable/smoke-test.md` com:
- Lista de rotas críticas (`/`, `/dashboard`, `/clients`, `/clients/$id`, `/plans/$id`, `/billing`, `/templates`, `/auth`, intake público).
- Por rota: itens a verificar em PT e EN (headers, dialogs principais, toasts, datas, chips de estado).
- Coluna "PT ok / EN ok / notas" para preencher manualmente.

Atualiza `.lovable/backlog.md` movendo #32 e #33 para concluído. Backlog fica vazio (secção "Em aberto" some) — próxima ronda exige nova direção tua.

## Sem publicar

Nenhuma das rondas publica. Continua a regra "publicar só quando eu disser".

## Confirmação

Avanço com R25 + R26 nesta ordem?