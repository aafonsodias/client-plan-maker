# Round 46 — Quest path foundation + tri-theme + brand polish

Eu sou o Atlas. Esta ronda fecha o cleanup R45 e abre as duas fundações que destrancam tudo o resto: **(1)** o esquema de Missions (caminho mordida-a-mordida até `assessment_completion = 100`), e **(2)** o tri-tema visual alinhado com a tua imagem do logo (Dark · Slate · Cream). Mais a coreografia AtlasGenie e os fixes de cima.

> 1 ronda = 1 conjunto coeso. A coreografia full-pointing (Joyride/Shepherd) e a UI rica de missões ficam parqueadas para R47, conforme combinado.

---

## A. P0 cleanup R45 (5 min)

- Apagar `src/assets/forge-logo.png` (smoke confirmou que `Logo.tsx` e `BrandMark.tsx` já apontam para `protocol-mark.png`).
- `rg -i "forge|askForge"` final — substituir as ocorrências que sobram em código vivo (`STORAGE_KEY = "forge_theme"` em `ThemeToggle.tsx`, `KEY = "forge.ai.model"` em `use-model-preference.ts`, comentários em `styles.css` `/* FORGE design system tokens */` → renomear para Protocol nos comentários, manter as CSS vars `--forge-*` para não partir o PDF).
- Memory sweep: actualizar `mem://index.md` para Protocol/Atlas e remover linhas que ainda mencionem Forge.

## B. Brand mark fixes (clique no P + contraste)

Problemas no print do dashboard mobile:
1. `<BrandMark>` no AppShell **não navega** quando carregado — está dentro de um `<Link to="/">` mas o utilizador disse "carregar no P não leva à landing". Verificar se o problema é o handler ou se `location.pathname` já está em `/dashboard` e o link visualmente não dá feedback. Garantir que o clique sempre vai para `/`.
2. **Contraste inverso**: a tua imagem mostra a P branca a viver em fundo escuro / a P escura em fundo claro. O `protocol-mark.png` actual é uma única imagem que fica branca no claro (invisível). Fix: usar **duas variantes** — `protocol-mark-dark.png` (P branca, para tema escuro) e `protocol-mark-light.png` (P escura, para tema claro+cream). O `<Logo>` escolhe via `useTheme()`. Alternativamente, gerar um SVG com `currentColor` para ser one-source — vou propor SVG primeiro (1 ficheiro, escala, sem fetch).
3. Remover do header o sublinhado roxo/branco que aparece no mobile no print (resíduo do hover/focus do Link).

## C. Tri-mode theme: Dark · Slate · Cream

Substituir o toggle binário por **rotativo de 1/3** (120° por clique): Dark → Slate → Cream → Dark.

- `ThemeToggle.tsx`: novo `Mode = "dark" | "slate" | "cream"`. Estado guardado em `localStorage` chave `protocol_theme`. Ícone passa a ser um disco dividido em 3 sectores (cream / slate / dark) com seta amber a apontar o sector activo; rotação 120° suave (300ms ease-out). Respeita `prefers-reduced-motion`.
- `styles.css`: 
  - `:root` continua dark (default).
  - `.light` → renomeado conceptualmente para "cream" mas mantemos a classe `.light` para não partir nada; values ajustadas para o cream warm da tua imagem (`#F5F0E6` background, `#1A1814` foreground).
  - Nova classe `.slate`: fundo `#1F2530` (slate-azulado da imagem do meio), foreground `#E5E7EB`, cards `#2A3140`. Accent amber mantém-se em todos.
  - `color-scheme` ajustado por modo (`dark` para slate+dark, `light` para cream).
- Todos os componentes que assumem dark/light hard-coded levam audit rápido (`grep "dark:"` está OK porque slate cai no dark via `color-scheme`).

> Decisão "Decide tu" no terceiro tema: escolhi **Cream warm** (não Slate) como o terceiro distinto, porque Slate fica demasiado próximo do Dark. Final: Dark (oficina) · Slate (intermédio neutro) · Cream (manual de papel). Os 3 painéis da tua imagem inspiram directamente esta escolha.

## D. Workbench title personalisado

Mantém "Workbench" mas troca o copy para possessivo + ligeiro hover de vida:
- PT: `dashboard.title` → `"O teu Workbench"` (foi essa a tua escolha)
- EN: `"Your Workbench"`
- Subtítulo eyebrow continua `"BEM-VINDO DE VOLTA"` / `"WELCOME BACK"`.
- Adicionar micro-animação amber pulse no `<BrandMark>` ao lado do título (1× ao montar, ~600ms).

## E. IntakeLinkPanel — fora-do-lugar mobile + nomenclatura

Print mostra "Como funciona" e "Copiar link de avaliação · André" empilhados de forma estranha + ainda diz o nome em vez de "último link gerado".

Em `dashboard.tsx`:
- Mover o pill `<AtlasGenie trigger="pill" />` para **dentro** do header (canto direito ao lado do "+ Novo cliente"), em vez de uma linha solta `flex justify-end`. Em mobile fica como ícone `?` pequeno; em desktop pill com texto.
- Refactor da action row (linha 380-390): em vez de `Copiar link de avaliação · André` fixo, mostrar:
  - Label: "Último link de avaliação gerado" + chip pequeno com nome do cliente por baixo, em duas linhas claras.
  - PT/EN i18n: `dashboard.last_intake_label` / `dashboard.last_intake_for`.
- "Copiar link de avaliação" → renomear para **"Copiar link de intake"** com tooltip "Questionário inicial do cliente". (Queres ser percebido — "intake" + tooltip explicativo é o equilíbrio.)

## F. AtlasGenie animação (génio sai do livro)

Coreografia CSS pura (~600ms total, sem libs):
- Pulse amber no ícone do livro do trigger (`box-shadow` expand 200ms).
- Marca P emerge: `translateY(-40px → 0) + scale(0 → 1) + filter: blur(8px → 0)` em 400ms.
- Halo amber radial fade-out 600ms.
- Dialog content fade-in 200ms depois.
- `prefers-reduced-motion: reduce` → fallback fade simples 150ms.
- Backdrop: `radial-gradient` amber 8% opacity (não takeover total).

Manter o conteúdo dos 3 passos existente.

## G. Mission schema (fundação que destranca R47)

**Lógica seca apenas, sem UI rica.**

Migration nova:
```sql
create type mission_kind as enum ('parq','rockport','blood_pressure','gym_class','photos','custom');
create type mission_status as enum ('pending','in_progress','done','skipped');

create table public.missions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  trainer_id uuid not null,
  kind mission_kind not null,
  status mission_status not null default 'pending',
  evidence_required boolean not null default false,
  evidence_url text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.missions enable row level security;
create policy "trainer manages own missions" on missions
  for all using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());

alter table public.clients add column if not exists assessment_completion int not null default 0;
```

E um helper `src/lib/missions.ts` com:
- `MISSION_KIND_LABELS` (PT/EN via i18n keys).
- `computeAssessmentCompletion(client)` — soma ponderada simples (PARQ 30 + medidas 20 + tensão 20 + Rockport 20 + foto 10).
- Tipo TS `Mission` exportado.

**Gate no gerador de plano**: em `clients_.$clientId.tsx`, se `assessment_completion < 100`, o botão "Gerar plano" mostra em vez disso o componente novo `<MissionsPanel client={...} />` (apenas render seco — lista das missões pendentes e botão "Marcar feito"). Sem genie animations, sem confetti — isso é R47.

## H. Backlog actualizado

`.lovable/backlog.md` ganha secção "R46 closed" + parqueamentos formais:
- P2 Atlas pointing/Joyride choreography → R47.
- P2 Marketing AI avatars (modelos diversos por etnia para vídeos) → Future · Marketing.
- P2 Google Earth gym/farmácia locator → Future · Missions.
- P2 Agente reviews/Reddit/Portal da Queixa scrape → Future · Marketing intel.

## Out of scope (esta ronda)

- UI rica das Missions (animações, progresso visual, Atlas a apontar).
- Marketing AI avatars (parqueado, vou pedir aprovação separada quando tivermos guidelines de uso ético/respeitoso).
- Joyride choreography full.

## QA checklist antes de fechar

- 375 px Mobile Safari: clique no P leva a `/`, header limpo (sem duplicação), tema toggle roda 120° por clique, last-intake label correcto.
- Os 3 temas: Dark, Slate, Cream — todos legíveis, accent amber visível, BrandMark P contrasta em todos.
- AtlasGenie: animação suave, reduced-motion respeitado.
- Missão schema: migration aplica sem erro, RLS activa, gate funciona (cliente novo sem assessment vê missões em vez de "Gerar plano").
- PT/EN: zero "Forge", "Workbench" personalizado, "Último link gerado" em ambos os idiomas.

Se aprovares, executo como Atlas. — A.