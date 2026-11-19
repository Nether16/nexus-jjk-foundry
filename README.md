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
- Ficha reduzida de shikigami com Força, Destreza, Agilidade e Constituição, HP e nível do invocador; abas Movimentos, Técnicas e Anotações.
- Movimentos com rolagem no chat e custo de Energia Amaldiçoada.
- Movimentos na barra de macros: arraste o botão do dado para um slot; um clique normal no dado continua rolando pela ficha.
- Talentos, técnicas, conhecimentos, inventário, história e anotações.
- Cores personalizadas e importação de wallpaper por personagem.
- Arte dos tokens acompanha a foto da ficha, incluindo tokens já colocados nas cenas.
- Compêndio **Sistemática**, com banner animado de Higuruma, regras de combate, personagem, treinamento e técnicas, ilustrado com GIFs e tabelas; demais seções preparadas para receber conteúdo.

Os atalhos ficam na barra do usuário conectado. As teclas 1–9 e 0 executam os movimentos da página ativa da barra. A macro usa os dados atuais do movimento e a mesma rolagem da ficha, incluindo imagem, efeitos, custo e verificação de EA disponível. Ao excluir um movimento da ficha, as macros vinculadas a ele também são excluídas automaticamente.

Shikigamis têm o nível do invocador, com 50 HP no nível 1 e mais 25 HP por nível seguinte, sem bônus de Constituição. Seus quatro atributos físicos são inteiros não negativos, sem limite automático por nível. Shikigamis não possuem XP, EA, origem ou inventário; o custo dos movimentos aparece apenas como texto no chat, sem descontar EA.

O mestre pode usar **Vincular invocador**, abaixo dos atributos, para escolher um personagem. Os indicadores sob o retrato mostram a distância máxima (JJT em metros) e a Perícia Ocultista (JJT + FDV + INT), que é o total de pontos para distribuir nos quatro atributos do shikigami. Nível e indicadores ficam com “?” sem vínculo; o HP usa a base de 50. Ao vincular, acompanham os valores atuais do invocador. A distância é informativa.

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
