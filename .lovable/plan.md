
# Round 53 — Destilar ao golden standard MVP (revisto)

Mantenho a espinha do plano anterior, com 3 mudanças baseadas no teu feedback:
- Renomeação **FORGE → PROTOCOL** em todos os sítios visíveis.
- **Repaint do PDF** para ficar mais bonito e vendável, sem perder legibilidade impressa (CMYK-safe, contraste AA+).
- Pequeno ajuste: o "FORGE" que aparece no teu PDF vem do campo `business_name` do teu perfil de trainer, não do código. O código já usa fallback `"PROTOCOL"`. Há uma fix em duas frentes: (a) corrigir o teu profile, (b) auditar e renomear menções restantes em código/comentários/seed para "PROTOCOL".

---

## 1) Mudanças vs plano anterior

### 1a) FORGE → PROTOCOL (5 cr, é cosmético)

- **Investigação feita:** `rg -nw FORGE src public` devolve só:
  - `src/styles.css` linhas 67/69/150 — **comentários** ("FORGE design system tokens"). Renomear comentários para "PROTOCOL design system tokens".
  - `src/server/phased/schemas.ts:199` — comentário ("Mirrors the existing FORGE day shape"). Renomear.
  - **`src/lib/pdf.ts:266`** já tem `const brand = (branding.business_name || branding.full_name || "PROTOCOL").toUpperCase();` — o "FORGE" vem do `profile.business_name` armazenado. Vou:
    - Adicionar migration que faz `UPDATE profiles SET business_name = 'PROTOCOL' WHERE business_name = 'FORGE'` (só onde literal, não toca em nomes legítimos).
    - Defender no PDF: se `business_name` for vazio ou `FORGE`, usar `"PROTOCOL"`.
- Manter os tokens CSS `--forge-*` por enquanto (renomear isso é um round inteiro de churn). Comentário diz "PROTOCOL palette tokens (var name kept for back-compat)".

### 1b) PDF mais bonito sem perder print (10 cr extra → bloco PDF passa de 15 → 25 cr)

Princípio: **papel branco quente + tinta preta densa + 1 cor accent + 1 cor secundária para data/log**. CMYK-safe (nenhum azul fluorescente, nenhum gradiente que vire blob no jacto de tinta).

Nova paleta `LIGHT_THEME`:
```
bg          #FAF7F0   warm ivory (era #FAF8F4 — fica "menos hospital")
bgSubtle    #F1ECE0   sand para zebra rows
ink         #14110D   ink quente, denso (era #1A1A1A)
inkMuted    #6B6357   warm grey (era #787670)
inkGhost    #D9D0BD   linhas de tabela
rule        #C9BFA8   réguas
accent      #C8861E   Protocol amber escurecido p/ print (era #E8A547 — em CMYK estoura)
accentSoft  #F4E2BD   wash para band do header e zebra accent
ink-on-accent #14110D
secondary   #2E5C8A   Protocol blue (logo "P") — usado APENAS no slot de log
                       (S1–S4, "actual" cells); cria distinção visual prescrito vs registado
                       e amarra digital → papel
```

Mudanças visuais:
1. **Header band (top 30mm de cada página)** — barra de `accentSoft` com filete `accent` por baixo e logo+brand em `ink`. Em vez do header monocromático.
2. **Glance table na capa** — cells com `bgSubtle` zebra e header em `ink-on-accent` (amber sólido). Usa o teu spec §12 mas mais quente.
3. **Tabela de exercícios** — colunas `S1–S4` com micro-label `LOG` em azul (`secondary`), texto vazio mas a borda da célula em azul ténue. Diz visualmente "isto é para registar".
4. **Periodização visível na coluna do header** (vem do P0 RPE):
   - `WEEK 1 · base · RPE 6` (ink)
   - `WEEK 2 · +load · RPE 7` (accent, bold)
   - `WEEK 3 · +reps · RPE 7.5` (accent escuro)
   - `WEEK 4 · DELOAD · RPE 6` (chip ink-on-accentSoft)
5. **Footer** — uma única linha fina `accent` + texto `inkMuted` "PROTOCOL · {trainer} · página X / Y". Tira o ruído da linha de email actual.
6. **Tipografia (jsPDF embedded)** — Helvetica para data densa, mas **título da sessão em weight 700 + tracking +1** para parecer "design-led". Sem instalar fontes (mantém o bundle leve).
7. **DARK_THEME** — actualizar accent para o mesmo `#C8861E` para consistência (mas a app continua a usar `#E8A547` no ecrã, só PDF muda — print≠screen é normal).

Garantias de impressão:
- Nenhuma área >40% de cor accent (evita banding em laser).
- Texto sempre ≥9pt sobre `bgSubtle`.
- Réguas ≥0.4pt.
- Logo: se `logo_data_url` for inexistente, render a "P" amber (mesmo glyph do BrandMark) em vez de espaço vazio.

---

## 2) Plano completo (revisto, ~125 créditos)

```text
P0   5 cr  Rename FORGE → PROTOCOL (comentários, profile migration, PDF defensive default)
P0  15 cr  Regen 401 → migrar para Lovable Gateway (callAnthropicWithSchema)
P0  20 cr  RPE periodiza W1→W4 (Stage 3 prompt + Zod validator + day labels deterministic)
P1  25 cr  PDF: nova paleta + log-blue accents + column tags com RPE + start hints + rationale
P1  25 cr  Log overlay azul (oklch 0.68 0.16 240) sobre MesocycleTableView + popover inline
P1  20 cr  Plan-view = daily-driver: header colapsado, 3 modos, atalho do client-view
P2   0 cr  Cortes: esconder banner partido, colapsar 8 botões em ⋯, remover modo Edit
P2  15 cr  Dialog de regen com 4 chips estruturados
─────────
   125 cr  (margem ~−5; se faltar dou prioridade P0+P1, P2 fica para 54)
```

---

## 3) O que não muda do plano original

- Sem AI-coach por cima dos logs (P3).
- Sem refundar a página do cliente (só atalho).
- Sem reescrever CUEs com IA mais cara.

---

## 4) Pergunta directa antes de começar

Confirma só uma coisa: o azul do "P" que queres como cor do log é **o mesmo da PROTOCOL flag** (~`#2E5C8A`) ou queres mais saturado tipo `oklch(0.68 0.16 240)` que já uso no `MuscleVolumeRadar`? Sugestão: usar `#2E5C8A` no PDF (calmo, imprime bem) e `oklch(0.68 0.16 240)` no ecrã (vivo, contrasta no dark mode). Se aprovares, sigo assim.
