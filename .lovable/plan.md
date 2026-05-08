Vou corrigir isto sem mexer na lógica do BMV:

1. Adicionar uma pequena zona editável de identidade no topo da página do cliente, perto do cabeçalho, com os campos que o checklist está a pedir: sexo, data de nascimento/idade, altura e peso.
2. Dar a essa zona um alvo estável para scroll, por exemplo `id="sec-identity"`, para que o botão “Ver” vá exatamente para onde há algo para preencher.
3. Alterar o item “Sexo, data nascimento, altura e peso” em `brief-minimum.ts` para apontar para `identity` em vez de `anthro`.
4. Ajustar o handler de salto para tratar `identity` como alvo especial fora das tabs da avaliação, tal como já fazia para o overview.

Resultado esperado: ao clicar “Ver” nesse item, a sheet fecha e a página desce para campos concretos onde o treinador consegue registar os dados em falta.