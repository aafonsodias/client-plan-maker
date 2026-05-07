## Problema
No diálogo "Nova sessão", quando o cliente ainda não tem pacote, o único caminho para criar um é fechar o diálogo, ir ao tab Pacotes, criar, voltar e refazer a sessão. O botão extra que adicionei no header da semana resolveu o caso errado.

## Solução (mesma UX em mobile e desktop)
Inline, dentro do próprio dropdown Pacote do `BookingDialog`:

1. Adicionar uma última opção persistente no `Select` de pacote: **"+ Novo pacote"** (ícone Plus, estilo discreto).
2. Ao escolher essa opção:
   - Não fecha o `BookingDialog` (mantém o estado: cliente, data, hora, duração, notas).
   - Abre o `PackFormDialog` já existente (`src/routes/schedule.packs.tsx`) por cima, com `clientId` pré-preenchido e bloqueado.
3. Ao guardar o pacote:
   - Refresca a lista de pacotes do cliente no `BookingDialog`.
   - Selecciona automaticamente o novo `pack_id` no select.
   - Fecha só o `PackFormDialog`; o utilizador continua na sessão e carrega Guardar.
4. Reverter a alteração do round anterior: remover o botão "Novo pacote" que adicionei no header da `ScheduleWeek` e o param `?newPack=1` no `validateSearch` + efeito em `PacksPanel`.

## Porquê este sítio (e não um botão "+" ao lado)
- Mobile (375px): botão extra ao lado do Select rouba largura e parte o grid. Uma opção dentro do dropdown não.
- Desktop: mesmo gesto, zero fricção (clic → escolhe → guarda → volta à sessão).
- Mantém o princípio "1 fluxo por contexto": se estás a marcar sessão e descobres que falta pacote, resolves sem mudar de página.

## Ficheiros tocados
- `src/routes/schedule.tsx`
  - Reverter o botão "Novo pacote" no header de `ScheduleWeek` e a entrada `newPack` em `validateSearch`.
  - No `BookingDialog`: adicionar `SelectItem` "+ Novo pacote" no fim das opções; estado `inlinePackOpen`; renderizar `PackFormDialog` (importado de `./schedule.packs`).
  - Após `onSaved` do `PackFormDialog`: re-correr a query de `clientPacks` (`supabase.from("client_packs")…`) e fazer `setPackId(novoId)`.
- `src/routes/schedule.packs.tsx`
  - Exportar `PackFormDialog` (já existe, só precisa de export nomeado).
  - Aceitar prop opcional `lockClient?: boolean` para desactivar o select de cliente quando vem do `BookingDialog`.
  - Reverter o `useEffect` do `?newPack=1` (não é mais necessário).
- i18n (`src/i18n/locales/{en,pt}/schedule.json`)
  - Adicionar `form.create_new_pack` ("+ Novo pacote" / "+ New pack").

## Fora de âmbito
- Não mexer em quotas, server functions de pacote, RLS, ou no fluxo de pagamento.
- Não tocar no Stage 3/4/5.
- Sem migrations.

## Estimativa
~1 crédito.