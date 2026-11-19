# Nexus — Jujutsu RPG para Foundry VTT

Sistema Nexus para **Foundry VTT 14**, com fichas de Personagem e Maldição.

## Instalar

Na tela de configuração do Foundry:

1. Abra **Game Systems → Install System**.
2. Cole o endereço abaixo em **Manifest URL**.
3. Clique em **Install**.

```text
https://github.com/Nether16/nexus-jjk-foundry/releases/latest/download/system.json
```

Depois, crie um mundo com **Nexus — Jujutsu RPG**. Ao criar um ator, escolha **Personagem** ou **Maldição**.

Para atualizar, use **Check for Updates** na lista de sistemas do Foundry. O link de instalação continua o mesmo entre versões.

## Recursos

- Ficha de personagem com atributos, nível, XP, HP, EA e CA.
- Ficha de maldição com classificação de Grau 4 a Grau Especial.
- Movimentos com rolagem no chat e custo de Energia Amaldiçoada.
- Talentos, técnicas, conhecimentos, inventário, história e anotações.
- Cores personalizadas e importação de wallpaper por personagem.
- Estrutura de diários **Livro de Regras e Mundo**, pronta para receber o conteúdo.

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
