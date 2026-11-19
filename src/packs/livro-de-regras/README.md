# Sistemática

O nome exibido e o banner do compêndio são configurados em `system.json`. O banner usa o GIF local `assets/journal/banner-sistematica-higuruma.gif`, fornecido em https://media1.tenor.com/m/nIpT2Jh32qsAAAAd/higuruma-hiromi-higuruma.gif. O identificador `livro-de-regras` é mantido para preservar os links existentes.

Este compêndio contém dois grupos de diários: Mundo e Sistemática. Combate inclui Condições Ofensivas, Críticos, Kokusen e Morte; Personagem inclui Status, Atributos, especializações de Origem, Level Up, Perícias e Itens Amaldiçoados. Treinamento reúne Sistema de Aprendizado e Conhecimentos. Técnicas reúne Técnicas Treináveis, Barreiras, Anti-Domínios, EAR e Shikigamis; Inata contém Técnicas Inatas. O Catálogo foi removido. Os três diários de Mundo ainda não possuem páginas.

São duas pastas e oito diários, com trinta e duas páginas: sete de Combate, dezessete de Personagem, duas de Treinamento, cinco de Técnicas e uma de Inata. A numeração de Sistemática segue a sequência de 01 - Combate até 05 - Inata. Talentos não possui página no livro; os talentos da ficha do personagem continuam disponíveis.

As 69 mídias fornecidas estão em `assets/journal/`, associadas às páginas correspondentes, incluindo as três tabelas de EAR (limite, uso interno e uso externo). Os nomes originais e os nomes usados no livro estão documentados no README dessa pasta. Não há mídias pendentes nas referências atuais. Nas páginas que receberam apenas imagens e títulos, os textos das regras ainda podem ser adicionados posteriormente.

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
