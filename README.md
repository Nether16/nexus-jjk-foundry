# Nexus — Jujutsu RPG para Foundry VTT

Sistema Nexus para **Foundry VTT 14**, com fichas de Personagem, Maldição e Shikigami.

## Instalar

Na tela de configuração do Foundry:

1. Abra **Game Systems → Install System**.
2. Cole o endereço abaixo em **Manifest URL**.
3. Clique em **Install**.

```text
https://github.com/Nether16/nexus-jjk-foundry/releases/latest/download/system.json
```

Depois, crie um mundo com **Nexus — Jujutsu RPG**. Ao criar um ator, escolha **Personagem**, **Maldição** ou **Shikigami**.

Para atualizar, use **Check for Updates** na lista de sistemas do Foundry. O link de instalação continua o mesmo entre versões.

## Recursos

- Ficha de personagem com atributos, nível, XP, HP, EA e CA.
- Ficha de maldição com classificação de Grau 4 a Grau Especial.
- Ficha vertical de shikigami, com janela estreita, quatro atributos físicos, HP e nível do invocador; abas internas de Movimentos, Técnicas e Anotações.
- Movimentos com rolagem no chat e custo de Energia Amaldiçoada.
- Campos dos movimentos expandem ao editar; rolagem, custo e efeitos numéricos arredondam o resultado final para baixo.
- Movimentos na barra de macros: arraste o botão do dado para um slot; um clique normal no dado continua rolando pela ficha.
- Talentos, técnicas, conhecimentos, inventário, história e anotações.
- Reserva de Energia Amaldiçoada aumenta automaticamente a EA máxima em 10 por nível, com bônus retroativo.
- Arma afiliada no inventário recebe +15 de dano nos níveis 5, 10, 15 e 20. Sob Medida aumenta o dano em até 15, limitado ao Grau Especial; armas especiais exibem o lembrete da segunda habilidade. A variável ARMA usa o dano final da arma equipada.
- ARMA_ACERTO consulta o acerto da arma afiliada equipada: +1 inicial, chegando a +5 no nível 20. Use `1d20 + DES + ARMA_ACERTO` no campo Rolagem.
- Imagens de anotações, itens e movimentos pelo seletor nativo do Foundry, com link ou upload.
- Cores personalizadas e wallpaper por personagem, com link de imagem ou upload pelo seletor do Foundry.
- Arte dos tokens independente da foto da ficha, configurada pelo token ou pelo token padrão do ator.
- Compêndio **Sistemática**, com banner animado de Higuruma, regras de combate, personagem, treinamento e técnicas, ilustrado com GIFs e tabelas; demais seções preparadas para receber conteúdo.
- Sistemática em uma janela grande única: índice por categoria, busca de títulos e leitura das páginas no mesmo painel, com botões de anterior/próxima. Abrir novamente o livro ou seus links reutiliza essa janela.
- Textos do livro revisados, com títulos, listas e espaçamento uniforme; cabeçalho com Higuruma e busca integrada ao botão de limpar.
- Tabelas de regras em texto selecionável, com o tema do guia, incluindo ações, condições, críticos, progressão, equipamentos e técnicas.
- Guia de movimentos e macros no compêndio, com instruções simples para jogadores, opções de fórmulas e exemplos prontos para adaptar à mesa.

Os atalhos ficam na barra do usuário conectado. As teclas 1–9 e 0 executam os movimentos da página ativa da barra. A macro usa os dados atuais do movimento e a mesma rolagem da ficha, incluindo imagem, efeitos, custo e verificação de EA disponível. Ao excluir um movimento da ficha, as macros vinculadas a ele também são excluídas automaticamente.

Shikigamis têm o nível do invocador, com 50 HP no nível 1, mais 25 HP por nível seguinte e 10 HP por ponto de Constituição do próprio shikigami. Seus quatro atributos físicos são inteiros não negativos, sem limite automático por nível. Shikigamis não possuem XP, EA, origem ou inventário; o custo dos movimentos é descontado da EA do personagem invocador vinculado. O gasto exige vínculo válido, EA suficiente e permissão para editar o invocador.

O mestre pode usar **Vincular invocador**, na área do invocador, para escolher um personagem. Os indicadores ao lado do retrato mostram a distância máxima (JJT em metros) e a Perícia Ocultista (JJT + FDV + INT), que é o total de pontos para distribuir nos quatro atributos do shikigami. Nível e indicadores ficam com “?” sem vínculo; o HP usa a base de 50. Ao vincular, acompanham os valores atuais do invocador. A distância é informativa.

## Desenvolvimento

O ZIP de cada versão já contém os arquivos necessários ao Foundry. Mestres e jogadores não precisam instalar Node.js nem executar comandos.

Para trabalhar no código e gerar uma versão, use Node.js 24:

```sh
npm ci
npm run build:release
```

A compilação gera `dist/system.json` e o ZIP da versão. O compêndio é compilado a partir de `src/packs/livro-de-regras` em uma pasta temporária; o banco em uso pelo Foundry não é alterado.

Para publicar uma atualização:

1. Altere `version` no `system.json` e ajuste `download` para o ZIP dessa versão.
2. Execute a compilação.
3. Publique uma release com a tag `v<versão>`, anexando o `system.json` gerado e o ZIP.
4. Marque a release como a mais recente. O campo `manifest` mantém o endereço fixo de instalação.

Para compilar somente o compêndio instalado, feche o Foundry antes de executar `npm run build:packs`.

## Créditos

Sistema Nexus por **Nyck e Galact**. Adaptação para uso no Foundry VTT.

Projeto de fãs inspirado em Jujutsu Kaisen. Marcas, personagens e materiais visuais pertencem aos respectivos titulares.
