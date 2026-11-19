# Livro de Regras e Mundo

Este compêndio contém somente a estrutura do livro. As páginas têm títulos e campos HTML vazios para receber o conteúdo depois. Os três diários de Mundo ainda não possuem páginas.

Os arquivos `_Folder.json` representam pastas. Cada outro JSON representa um `JournalEntry`, com suas `JournalEntryPage` dentro de `pages`. Não crie documentos Item ou Actor para o livro.

Para preencher uma página, edite seu `text.content`, mantendo o contêiner `<div class="nexus-wiki">`. Imagens locais usam caminhos como `systems/nexus-jjk/assets/journal/nome.gif`; tabelas podem usar a classe `tabela-img`.

Preserve os IDs de 16 caracteres e os campos `_key`. Eles mantêm os links estáveis e permitem que a ferramenta oficial compile pastas, diários e páginas no formato nativo.

Na raiz do sistema, instale as ferramentas e compile:

```sh
npm install
npm run build:packs
```

Feche o Foundry antes de recompilar um compêndio em uso. Depois, reinicie o Foundry para registrar as mudanças do sistema. O pacote distribuído já contém o compêndio compilado em `packs/livro-de-regras`; jogadores não precisam instalar ferramentas.

O compêndio é visível para jogadores com permissão de observador, somente leitura. Como compêndio do sistema, ele vem bloqueado para edição por padrão. Edite as fontes JSON para manter o conteúdo entre atualizações.

Ferramenta: [CLI oficial do Foundry VTT](https://github.com/foundryvtt/foundryvtt-cli).
