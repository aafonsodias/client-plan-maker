# Smoke Test Checklist — PT/EN

Atualizado: R26 (3 Mai 2026). Encher antes de cada publish.

Como usar: para cada rota, abrir em PT e EN (toggle no AppShell) e marcar `✓` / `✗` / nota. Falha = abrir issue antes do publish.

## Convenções
- **Headers**: títulos H1/H2 das secções, chips de estado (Ready/Draft/Archived), badges.
- **Dialogs**: títulos, descrições, botões primários/secundários, toasts de sucesso/erro.
- **Datas**: formato local (`pt-PT` vs `en-US`), labels relativos ("há 2d" / "2d ago").
- **Tooltips**: hover em chips (ACSM, rotação, evolução), botões com ícone-only.

## Rotas

| Rota | PT | EN | Notas |
|------|----|----|-------|
| `/` (landing) | ☐ | ☐ | hero, 5 estágios, FAQ, footer |
| `/auth` | ☐ | ☐ | login + signup, validações, OAuth Google |
| `/dashboard` | ☐ | ☐ | notificações (aniversários, intake stale, assessments), PlansStatusBar, EvolutionChip, dialog delete |
| `/clients` | ☐ | ☐ | tabela, dialog convite (instruções, gen link), dialog demo |
| `/clients/$id` | ☐ | ☐ | snapshot card, AssessmentSection (focus mode + tabs), StageCards (Blueprint/Microcycle/Progressions), Synthesis dashboard, plans (manual + evolve), datas |
| `/clients/$id/year` | ☐ | ☐ | strip de blocos, sparkline, anos |
| `/plans/$id` | ☐ | ☐ | header (chips bloco/rotação/main-lift), CapacityGainCard, NextBlockCard, VolumeSection, WeeklyVolumeBars, LogbookTimeline, dialogs (PDF, RPE re-anchor), toasts |
| `/billing` | ☐ | ☐ | tiers (Starter/Pro/Studio), preços EUR/USD/BTC, FAQ honesto, top-up |
| `/templates` | ☐ | ☐ | lista, criar, editar |
| `/intake/$token` (público) | ☐ | ☐ | branding do trainer, formulário, submit, idiomas |
| Tour (react-joyride) | ☐ | ☐ | step copy em PT e EN, botões Next/Skip |

## Checklist transversal
- [ ] Toggle PT⇄EN não recarrega a página (i18next live switch).
- [ ] Nenhuma string crua aparece como `key.namespace.foo` (key não traduzida).
- [ ] Datas em todos os surfaces respeitam locale.
- [ ] Toasts (sonner) traduzidos nos casos de erro de quota e generation.
- [ ] PDF export gera com idioma correto da UI.

## Princípio
Útil > funcional > bonito > divertido. Se um surface está em PT no EN (ou vice-versa), bloqueia o publish.
