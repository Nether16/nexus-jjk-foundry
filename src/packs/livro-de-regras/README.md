# Livro de Regras e Mundo

Este compêndio contém dois grupos de diários: Mundo e Sistemática. Combate inclui Condições Ofensivas, Críticos, Kokusen e Morte; Personagem inclui Status, Atributos, especializações de Origem, Level Up, Perícias e Itens Amaldiçoados. Treinamento reúne Sistema de Aprendizado e Conhecimentos. As demais páginas têm títulos e campos HTML preparados para receber conteúdo depois. Os três diários de Mundo ainda não possuem páginas.

São duas pastas e sete diários, com sete páginas de Combate, dezessete de Personagem, duas de Treinamento e quatro de Técnicas. Talentos não possui página no livro; os talentos da ficha do personagem continuam disponíveis.

Os arquivos `_Folder.json` representam pastas. Cada outro JSON representa um `JournalEntry`, com suas `JournalEntryPage` dentro de `pages`. Não crie documentos Item ou Actor para o livro.

Para preencher uma página, edite seu `text.content`, mantendo o contêiner `<div class="nexus-wiki">`. Imagens locais usam caminhos como `systems/nexus-jjk/assets/journal/nome.gif`; tabelas podem usar a classe `tabela-img`.

As referências a mídias ainda não fornecidas ficam preservadas nos JSONs. Ao compilar, imagens ausentes em `assets/journal/` são substituídas por comentários no compêndio para evitar imagens quebradas. O comando lista os arquivos pendentes. Adicione os arquivos com os nomes indicados e recompile para incluí-los no livro.

Preserve os IDs de 16 caracteres e os campos `_key`. Eles mantêm os links estáveis e permitem que a ferramenta oficial compile pastas, diários e páginas no formato nativo.

Na raiz do sistema, instale as ferramentas e compile:

```sh
npm install
npm run build:packs
```

Feche o Foundry antes de recompilar um compêndio em uso. Depois, reinicie o Foundry para registrar as mudanças do sistema. O pacote distribuído já contém o compêndio compilado em `packs/livro-de-regras`; jogadores não precisam instalar ferramentas.

O compêndio é visível para jogadores com permissão de observador, somente leitura. Como compêndio do sistema, ele vem bloqueado para edição por padrão. Edite as fontes JSON para manter o conteúdo entre atualizações.

Ferramenta: [CLI oficial do Foundry VTT](https://github.com/foundryvtt/foundryvtt-cli).
