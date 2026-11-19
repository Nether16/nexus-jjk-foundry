# Sistemática

O nome exibido e o banner do compêndio são configurados em `system.json`. O banner usa o GIF local `assets/journal/banner-sistematica-higuruma.gif`, fornecido em https://media1.tenor.com/m/nIpT2Jh32qsAAAAd/higuruma-hiromi-higuruma.gif. O identificador `livro-de-regras` é mantido para preservar os links existentes.

Este compêndio contém dois grupos de diários: Mundo e Sistemática. Mundo contém História, Clãs e Escolas, ainda sem páginas. Em Sistemática, a ordem é Combate, Personagem, Técnicas, Inata e Treinamento. Combate inclui Ações, Tabela de Ações, Condições, Condições Ofensivas, Críticos, Kokusen e Morte; Personagem inclui Status, Atributos, Origens Gratuitas (F2P), Origens Pagas, Level Up, Perícias e Itens Amaldiçoados. Técnicas reúne Técnicas Treináveis, Barreiras, Anti-Domínios, EAR e Shikigamis; Inata contém Técnicas Inatas.

São duas pastas e oito diários, com vinte e quatro páginas: sete de Combate, dez de Personagem, cinco de Técnicas, uma de Inata e uma de Treinamento. Os nomes exibidos não possuem prefixos numéricos; a ordem é definida pelo campo `sort`, independentemente do nome dos arquivos. Tabela de Ações, Condições, Level Up, Perícias, Itens Amaldiçoados e Treinamento possuem somente título, conforme o consolidado fornecido. Talentos não possui página no livro; os talentos da ficha do personagem continuam disponíveis.

As mídias fornecidas permanecem em `assets/journal/`, incluindo as três tabelas de EAR e os arquivos que deixaram de ser referenciados no consolidado. Quatro cópias com nomes alternativos preservam as tags de imagem das novas páginas de origem; os nomes estão documentados no README dessa pasta. A referência `origem-sem-tecnica-inata.gif` ainda aguarda o arquivo correspondente. O build reserva essa referência na fonte e omite a imagem ausente no compêndio compilado.

A versão consolidada substitui o conteúdo anterior, inclusive páginas que agora contêm somente título. Os IDs reais dos diários e das páginas correspondentes foram preservados: Origens Pagas usa o ID anterior de Origens Compra; Inata, Treinamento e as páginas de Técnicas mantêm seus IDs existentes. A página de Treinamento usa o ID fornecido no consolidado. A chave do diário de Treinamento segue o formato `!journal!ID` exigido pelo Foundry.

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
