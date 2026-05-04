
# Round 48 — Logbook real + PR share + favicon + RPE com lógica Bompa

Vou ser honesto sobre o orçamento: 147 créditos. Esta ronda corta tudo o que não é essencial para tu **fazeres log como cliente já amanhã**. Landing aesthetic refresh, newsletter mensal, Google-Earth gym locator e tour Joyride completo ficam parqueados — não morrem, só não entram aqui. O que entra:

---

## A. Favicon e header logo (5 min, custo desprezável)

**Problema**: `public/icon-192.png` ainda mostra a forja antiga (martelo + bigorna). Tab do browser e PWA install icon estão errados.

**Acção**:
1. Gerar 4 PNGs novos a partir de `src/assets/protocol-mark.svg` (P preto sobre fundo transparente, com **padding mínimo ~6%** — não 20% como o ícone actual, para o P aparecer grande mesmo a 16px na tab):
   - `public/icon-192.png` (192×192)
   - `public/icon-512.png` (512×512)
   - `public/icon-maskable-512.png` (com safe-area de 10% para máscaras Android)
   - `public/apple-touch-icon.png` (180×180, fundo branco — Apple não respeita transparência)
2. Adicionar `<link rel="icon" href="/icon-192.png">` já existe em `__root.tsx` — confirmar que o SVG `protocol-mark.svg` também é servido via `/protocol-mark.svg` para uso em meta og:image.

Ferramenta: gerar via skill `lovable_ai` com `--image` ou directamente com sharp/canvas no script local — **não custa créditos AI** se usar conversão SVG→PNG nativa.

---

## B. View Mode mostra sessões logadas (azul-claro do logo)

**Problema**: trainer abre o plano em View, não vê quais sessões o cliente já completou. Hoje o `LogbookTimeline` mostra-os em colunas separadas; queremos **integrar no mesociclo** principal.

**Acção** (`src/routes/plans.$planId.tsx` + nova lib):
1. Novo helper `src/lib/session-overlay.ts` — `getLoggedSetsForExercise(workoutSessions, weekN, dayN, exerciseName) → { sets: SetLog[]; isPR: boolean; loggedAt: string }`.
2. Em `plans.$planId.tsx` View Mode (tabela e cards): para cada célula `WeekN`, se houver `workout_session` com `week_number=N, day_number=D` e o exercício foi logado:
   - **Background tint** `bg-[#5BA3D8]/8` na célula (azul-claro do logo, 8% opacidade — sutil).
   - **Border-left** 2px `#5BA3D8/40`.
   - Tooltip on hover: "Logado em {DD/MM} · {actual_load}×{actual_reps} @{actual_rpe}".
   - Se `isPR`: pequeno emoji 🏆 amarelo (ou ícone Trophy 12px) no canto superior direito da célula.
3. Cards mode: mesmo tratamento mas via `ring-1 ring-[#5BA3D8]/30` em vez de bg.
4. Legend discreta no topo da view: "▮ Sessão registada · 🏆 Recorde pessoal" — uma linha de 11px muted.

Custo: zero AI. ~120 linhas.

---

## C. Logbook MVP no botão "Começar treino"

**Problema**: hoje só há `log/$token` para o cliente externo. O trainer (e o trainer-as-cliente via `?as=`) não tem CTA óbvio para abrir o log.

**Acção**:
1. **Botão `Log today's workout`** no `<ThisWeekHero/>` (azul `#5BA3D8`, ícone `Play`) — calcula próximo dia não-logado da semana actual e abre a rota `/log/$token?day=N&week=W`.
2. **Atalhos de teclado** em `ExerciseSetsCard`:
   - `↓` / `↑`: salta para o próximo/anterior set do mesmo exercício; quando chega ao último set, salta para o primeiro set do próximo exercício.
   - `→` / `←` continuam a navegar célula a célula (reps → weight → rpe).
   - `Enter` num set: marca `done=true`, autosave, salta para o próximo set (mesmo comportamento do ↓).
   - `Esc`: fecha o keyboard, scroll para o save indicator.
3. **Autosave** já existe — reduzir debounce de 1500ms para 800ms e mostrar "Guardado às HH:MM:SS" no `LogHeader`.
4. **Slideshow mode** (botão "Modo treino" no LogHeader): full-screen, um exercício por slide, swipe horizontal (ou ←/→ em desktop), mostra sets em cima + foto/cue do exercício abaixo. Sai com `Esc`. Reusa `ExerciseSetsCard` em layout vertical.

Custo: zero AI. ~250 linhas (slideshow é o maior).

---

## D. PR moment → snapshot WhatsApp share

**Problema**: confettis aparecem mas perdem-se. Cliente não sabe que partilhar e o trainer não vê snapshot exportável.

**Acção**:
1. Quando `isPR` dispara em `ExerciseSetsCard`, em vez do confetti volátil:
   - Modal `<PrShareDialog/>` aparece **5s depois do save** (não interrompe o flow).
   - Conteúdo: card 1080×1080 SVG com:
     - Header: BrandMark P + "Recorde pessoal · {client_name}"
     - Centro grande: nome do exercício + `{kg} × {reps}` + chip "e1RM {epley}kg"
     - Comentário curto (1 frase, ~80 chars): cached, **NÃO chama AI por defeito**. Banco de 12 frases pré-escritas em `src/lib/pr-quotes.ts` (PT/EN), escolhe por hash do `exercise_name + user_id`. Honesta, sem entusiasmo falso ("Mais 5kg que a melhor série anterior. Vai ficar.").
     - Footer: "protocol.app · {date}"
   - Render via `html-to-image` ou `dom-to-image-more` (npm, leve, zero deps nativas) → PNG download + WhatsApp share via `navigator.share({ files: [png] })`.
   - Botões: `Partilhar via WhatsApp` (primary), `Descarregar PNG`, `Mais tarde`.
2. **Frequência**: máx 1 prompt por sessão, máx 1 por exercício por semana — guardado em `localStorage.protocol.pr_prompt_seen`. Não bombardear.
3. Toggle no Settings: `pr_share_prompt: 'always' | 'milestones_only' | 'never'`. Default = `milestones_only` (só PRs onde Δe1RM ≥ 5%).

Custo: zero AI (frases cached). +1 dependência npm `html-to-image` (~14kb).

---

## E. Wave RPE periodization (Bompa & Buzzichelli 6e + ACSM)

**Problema**: hoje o gerador atira RPE 7-8 logo na semana 1 para todos. Tu pediste arranque mais conservador + onda volume→intensidade.

**Princípio Bompa** (parafraseado, citação interna `Bompa & Buzzichelli 6e §7.3-7.5`):
- Mesociclo de 4 semanas em hipertrofia/perda gordura: **W1 acumular volume a intensidade moderada, W2 aumentar volume, W3 aumentar intensidade mantendo volume, W4 deload**.
- RPE inicial varia por experiência + sinais de prontidão:
  - `beginner` ou `injury_active` ou `red_flag_present`: arranque RPE 5-6 (médio-leve)
  - `intermediate` sem red flags: arranque RPE 6-7 (médio)
  - `advanced` + lifting history ≥2 anos + recovery_score ≥7: RPE 7-7.5 (médio-pesado)

**Acção** (`src/server/phased/programming-defaults.ts` + `stage4-progressions.functions.ts`):
1. Nova função `computeWaveRpe(profileTier, weekN, totalWeeks) → { rpe_low, rpe_high, volume_multiplier }`:
   ```
   beginner:      W1 5.5  W2 6   W3 6.5 W4 5  (volume: 1.0 → 1.15 → 1.15 → 0.6)
   intermediate:  W1 6.5  W2 7   W3 7.5 W4 5.5 (volume: 1.0 → 1.15 → 1.15 → 0.6)
   advanced:      W1 7    W2 7.5 W3 8   W4 6   (volume: 1.0 → 1.15 → 1.15 → 0.6)
   ```
   *Nota:* W2 sobe **volume primeiro** (mais 1 set por exercício principal), W3 mantém volume e sobe RPE (mesmos sets, mais carga).
2. `stage4-progressions` consome `computeWaveRpe()` em vez do bloco hardcoded actual. Citação `Bompa & Buzzichelli 6e §7.4` aparece no `generation_meta.periodization_citation`.
3. UI: no plan summary, substituir "RPE 7-8 · med 7" por chip honesto `W1 vol+0% RPE 6.5 · W2 vol+15% RPE 7 · W3 vol+15% RPE 7.5 · W4 deload`.

Custo: zero AI extra (lógica determinística, executa antes do prompt).

---

## F. Schedule: confirmação 24h antes (cron)

**Problema**: cliente esquece-se da sessão; queres lembrete respeitoso 24h antes.

**Acção**:
1. Migration: `scheduled_sessions.confirmation_sent_at` (timestamptz, nullable) + `scheduled_sessions.confirmation_status` (enum: `pending|confirmed|declined|noshow`).
2. Server route `src/routes/api/public/hooks/session-reminder.ts` (corre via pg_cron a cada hora):
   - SELECT sessions onde `start_at` está entre `now()+23h` e `now()+25h` E `confirmation_sent_at IS NULL`.
   - Chama Resend (já temos integração se existir; senão **PARQUE este passo** e regista TODO).
   - Mensagem PT: "Olá {nome}, lembrete da sessão amanhã às {hora} com {trainer}. Confirmas? [Sim] [Reagendar]." — links assinados que mudam `confirmation_status`.
3. UI no `/schedule`: badge `Confirmada ✓` / `Pendente ⏳` / `Reagendar` por sessão.

**Honestidade**: se Resend não está configurado, esta secção fica como **stub completo + checklist de activação**. Não envia emails fantasma.

Custo: zero AI. Migration + edge route + 1 componente UI.

---

## G. Cliente no assessment — micro-educação não-patronizing

**Problema**: cliente preenche assessment longo sem feedback de valor.

**Acção** (`src/routes/intake.$token.tsx`):
1. Após cada secção (saúde / objectivos / estilo de vida / treino), uma `<MicroLesson/>` cinzenta-suave (não amarela, não AI-tom) de 1-2 frases:
   - Após "saúde": "Estes dados ficam só com o teu PT. Servem para ajustar carga e evitar exercícios contraindicados."
   - Após "objectivos": "Objectivos com prazo + medida (kg, reps, %) progridem 2× mais rápido em estudos da ACSM 12e §11.3."
   - Após "estilo de vida": "Sono <6h reduz ganho de força em 18% (Bompa 6e §3.2). Vamos planear treinos curtos nessas semanas."
2. **Cached/static**, não AI. Chave: `intake.$token` + section index.
3. Progress bar visível em cima: `Secção 2 de 4 · 47% completo`.

Custo: zero AI. ~60 linhas + 8 strings i18n.

---

## H. Parqueado para R49+ (não entra aqui — créditos)

| Item | Razão de adiar |
|---|---|
| Landing aesthetic refresh tri-tema | Custa ~30 créditos AI para refazer copy + visual tokens. Espera. |
| Newsletter mensal / weekly digest | Resend setup + template + agente AI para insights = ronda inteira. |
| Tour Joyride completo (steps Atlas) | UX polish, não bloqueia uso. |
| Slideshow swipe gestures avançados | MVP slideshow chega; gestos refinados depois. |
| Adaptive repeat assessments | R49+ — schema novo. |
| Real verified/cert backend | R50+. |
| Google Earth gym locator | R51+. |

---

## QA antes de fechar

```text
[ ] Tab do browser mostra P do Protocol (não martelo)
[ ] iPhone "Add to Home Screen" mostra P, não forja
[ ] View mode tem células azul-claro nas sessões logadas + 🏆 nos PRs
[ ] Tooltip nas células logadas mostra carga/reps/RPE/data
[ ] Botão "Log today's workout" no ThisWeekHero abre /log/$token correcto
[ ] ↓/↑ no log saltam set-a-set, → continuam célula-a-célula
[ ] Autosave mostra "Guardado às HH:MM:SS"
[ ] PR dispara modal share 5s depois do save (1×/sessão, 1×/exercício/semana)
[ ] Snapshot PNG 1080×1080 com BrandMark + e1RM + frase cached
[ ] Settings > pr_share_prompt: always|milestones_only|never (default milestones)
[ ] Plan summary mostra wave honesta W1→W4 (vol/RPE)
[ ] Beginner gera RPE 5.5 W1, intermediate 6.5, advanced 7
[ ] computeWaveRpe testado com 3 tiers × 4 semanas
[ ] /schedule mostra badge confirmation por sessão (mesmo sem Resend ligado)
[ ] Intake mostra micro-lessons honestas + progress bar
[ ] rg "FORGE\|Forge" src/ → vazio (excepto vars CSS legacy)
```

## Files to touch

- `public/icon-{192,512,maskable-512}.png` (regenerar)
- `public/apple-touch-icon.png` (regenerar)
- `src/lib/session-overlay.ts` (novo)
- `src/lib/pr-quotes.ts` (novo, 12 PT + 12 EN)
- `src/routes/plans.$planId.tsx` (View overlay azul + 🏆)
- `src/components/ThisWeekHero.tsx` (botão Log today's workout)
- `src/components/log/ExerciseSetsCard.tsx` (atalhos teclado, autosave 800ms)
- `src/components/log/LogHeader.tsx` (timestamp + Modo treino)
- `src/components/log/SlideshowMode.tsx` (novo)
- `src/components/PrShareDialog.tsx` (novo + html-to-image)
- `src/routes/settings.tsx` (toggle pr_share_prompt)
- `src/server/phased/programming-defaults.ts` (computeWaveRpe)
- `src/server/phased/stage4-progressions.functions.ts` (consume wave)
- `src/routes/intake.$token.tsx` (MicroLesson + progress)
- `supabase/migrations/...` (scheduled_sessions confirmation columns + pg_cron)
- `src/routes/api/public/hooks/session-reminder.ts` (novo, stub se sem Resend)
- `src/i18n/locales/{pt,en}/*.json` (strings novas)
- `bun add html-to-image`

## Estimativa créditos

| Bloco | Créditos AI |
|---|---|
| A favicon | 0 |
| B view overlay | 0 |
| C log MVP | 0 |
| D PR share (frases cached) | 0 |
| E wave RPE | 0 (lógica determinística) |
| F schedule cron | 0 |
| G micro-lessons (cached) | 0 |
| **Total ronda** | **~0-5 créditos** (só I/O do meu trabalho) |

Aprova e arranco. Sugiro começar por **A + C + D** (favicon + log MVP + PR share) numa primeira tacada, depois **B + E** (overlay + wave) na segunda, F+G na terceira. Se preferires tudo de uma vez, faço tudo.

— A.
