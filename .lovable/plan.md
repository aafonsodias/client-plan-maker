# Sprint 2 — Arrumação visual + hub único

Aplico as minhas recomendações para as Q1–Q5 (já disseste "tu é que sabes"). Se algo não bater certo, dizes e ajusto antes de executar.

## Decisões assumidas

- **Q1 Hub:** `/dashboard` é o hub único. `/bancada` (43L stub) e `/forge` (169L, fora do nav) são eliminados. Conteúdo útil do `/forge` (se existir) absorvido pelo dashboard.
- **Q2 Block N+1:** conta para a quota.
- **Q3 Preços:** €19/€39/€79 mensal + anual com -17%, ambos no checkout. (Confirmar antes de Sprint 4.)
- **Q4 Paywall:** ao tentar o 2º plano (ou 1º depois do trial expirar).
- **Q5 Manual:** move para footer do AppShell; sai do secondaryNav.

## Sprint 2 — alterações

### 1. Eliminar hubs duplicados (A1)
- Apagar `src/routes/bancada.tsx` e `src/routes/forge.tsx`.
- Auditar `forge.tsx` antes de apagar — se tiver widgets úteis (ex: atalhos, listas), porto-os para `dashboard.tsx` numa secção nova.
- Atualizar `primaryNav` em `src/components/AppShell.tsx`: remover `/bancada`, manter `/dashboard · /clients · /settings`.
- Verificar que nenhum link aponta para `/bancada` ou `/forge` (rg sweep).

### 2. Manual para footer (Q5/C3)
- Remover `/manual` do `secondaryNav` em `AppShell.tsx`.
- Adicionar link discreto no footer do AppShell: "Manual · Privacidade · Termos".

### 3. Sweep status-tone (B1)
- `rg` por chips/dots manuais (`bg-emerald`, `bg-amber`, `text-red-`, `Badge variant=` com cores hardcoded) fora de `src/lib/status-tone.ts`.
- Substituir por `toneChip(tone)` / `toneDot(tone)` / `toneText(tone)` consoante semântica (success/neutral/warn/danger).
- Alvos prováveis: `ResultsPanel`, `ClientPhasePill`, `ComplianceDashboard`, `DropoffAlerts`, `FeedbackPanel`, `SessionDayView`, headers de plan.

### 4. BrandMark consistency (B2)
- Adicionar `<BrandMark size="sm" />` aos headers de:
  - `src/routes/settings.tsx`
  - `src/routes/billing.tsx`
  - `src/routes/manual.tsx`
- NÃO adicionar a `/log/$token` (público, branding do PT via `get_intake_branding`) nem a PDFs nem a `/auth` (plate próprio).

### 5. Documentar Logo vs BrandMark (C1)
- Comentário no topo de `src/components/Logo.tsx`: "Landing/auth only. Para chrome interno usar BrandMark."
- Comentário no topo de `src/components/BrandMark.tsx`: "Chrome interno (AppShell, headers de rotas autenticadas). Nunca em PDFs."

## Ficheiros tocados (estimativa)

```text
DELETED
  src/routes/bancada.tsx
  src/routes/forge.tsx

EDITED
  src/components/AppShell.tsx          (nav + footer)
  src/routes/dashboard.tsx             (absorver órfãos do forge se relevante)
  src/routes/settings.tsx              (BrandMark header)
  src/routes/billing.tsx               (BrandMark header)
  src/routes/manual.tsx                (BrandMark header)
  src/components/Logo.tsx              (comentário)
  src/components/BrandMark.tsx         (comentário)
  ~6-10 componentes com chips manuais  (status-tone sweep)
  .lovable/plan.md                     (marcar Sprint 2 done)
  mem/index.md                         (se necessário, sem regras novas)
```

## Fora do âmbito (próximos sprints)

- Dashboard grid 2-col denso (B4) → Sprint 5.
- Mobile pass (B5) → Sprint 5, depois do intake slideshow.
- Auditoria `plan.functions` legacy (A6) → Sprint 5.
- Intake slideshow → Sprint 3.
- Stripe funnel → Sprint 4 (preciso da tua confirmação dos preços antes).

## Risco

Baixo. Tudo é remoção, renomeação semântica e adições visuais. Nenhuma migração SQL, nenhum server function novo. Se `/forge` tiver lógica viva em produção, faço auditoria antes de apagar e mostro-te o que encontrei.

Aprovas?
