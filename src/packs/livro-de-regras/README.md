# Sistemática

O nome exibido e o banner do compêndio são configurados em `system.json`. O banner usa o GIF local `assets/journal/banner-sistematica-higuruma.gif`, fornecido em https://media1.tenor.com/m/nIpT2Jh32qsAAAAd/higuruma-hiromi-higuruma.gif. O identificador `livro-de-regras` é mantido para preservar os links existentes.

Este compêndio contém os grupos Mundo e Sistemática, transcritos das bibliotecas originais do Firecast fornecidas pelo usuário. Mundo reúne História, os sete clãs e as escolas de Sendai e Shirohana. Em Sistemática, a ordem é Combate, Personagem, Técnicas, Inata, Treinamento e Catálogo. Conhecimentos e Talentos incluem o conteúdo integral disponível nas respectivas abas do Firecast.

São duas pastas, dez diários e 51 páginas: dez de Mundo, sete de Combate, dezoito de Personagem, cinco de Técnicas, uma de Inata, duas de Treinamento, duas de Catálogo e seis do Guia de movimentos e macros. Os nomes exibidos não possuem prefixos numéricos; a ordem é definida pelo campo `sort`. Ritos Ocultistas e Ferraria Amaldiçoada estão vazios nas bibliotecas originais e mantêm somente o título, sem regras inventadas.

O diário **Guia de movimentos e macros**, após Catálogo, resume o manual fornecido em `output/Nexus-Manual-Movimentos-e-Macros.html` e a referência `docs/movimentos-e-macros.md` para jogadores. Cobre criação de movimentos, fórmulas, EA, armas, efeitos, parâmetros, atalhos e imagens, com seis exemplos de configuração. Seus valores são exemplos para adaptar às regras da mesa. API e scripts avançados permanecem no manual completo. As páginas usam `.nexus-player-guide` para leitura alinhada à esquerda e blocos de fórmula.

As mídias fornecidas permanecem em `assets/journal/`. A transcrição reutiliza as ilustrações e tabelas já publicadas e inclui 49 novas mídias locais de Mundo, Catálogo, Conhecimentos, Talentos e Reforço Amaldiçoado II. As imagens das páginas anteriores foram preservadas quando a aba Firecast continha somente texto. A referência antiga `origem-sem-tecnica-inata.gif` ainda aguarda seu arquivo; o build a conserva na fonte e omite somente essa imagem ausente no compêndio compilado.

Origens Pagas recebeu a revisão pontual com os textos de Restrição Celestial: Física, Restrição Celestial: Feitiçaria, Amaldiçoado, Receptáculo, Híbrido e Gêmeos. O conteúdo segue o documento fornecido; o ID real `016a179411ac66b0`, a chave da página e sua posição (`sort: 650000`) foram mantidos.

A pedido do usuário, Origens Gratuitas (F2P) voltou ao conteúdo e visual da versão 0.4.14, anterior à transcrição das bibliotecas Firecast. Seu ID `2d5bdc39828be3b2`, a chave e a posição foram preservados; o manifesto de referência registra essa exceção à transcrição.

Os 24 IDs de páginas e os oito IDs de diários existentes foram preservados. As páginas restauradas recuperam seus IDs anteriores quando disponíveis. O antigo espaço de Treinamento recebeu Sistema de Aprendizado, preservando seu ID. Catálogo recuperou os IDs que já possuía. Origens Pagas ficou integralmente intacta, com a revisão nova, suas seis origens, imagens, chave e posição; a aba Origens Compra do Firecast já continha as mesmas seis origens, sem conteúdo faltante para acrescentar nela.

As bibliotecas binárias originais e o manifesto de correspondência entre abas, páginas e mídias estão em `src/reference/firecast/`. A conversão preserva o texto visível, parágrafos, destaques, cores e ordem das abas. Sete spans de fonte quase invisível (0,1 px), contendo cópias ocultas do editor, foram omitidos da apresentação; os originais completos continuam nos arquivos `.bib`. O Catálogo organiza nome, ilustração e disponibilidade juntos, sem alterar seus textos ou valores. As fontes de referência não fazem parte do ZIP de execução.

Os arquivos `_Folder.json` representam pastas. Cada outro JSON representa um `JournalEntry`, com suas `JournalEntryPage` dentro de `pages`. Não crie documentos Item ou Actor para o livro.

Para preencher uma página, edite seu `text.content`, mantendo o contêiner `<div class="nexus-wiki">`. Imagens locais usam caminhos como `systems/nexus-jjk/assets/journal/nome.gif`; tabelas podem usar a classe `tabela-img`.

Na revisão de legibilidade de 24/11/2026, a apresentação do livro foi padronizada com `.nexus-book-page`: títulos sem duplicação na janela de leitura, texto à esquerda, listas e margens consistentes. Foram removidos parágrafos vazios e medidas de fonte/recuo trazidas do editor original. A prosa foi enxugada preservando regras, valores, mídias e identificadores. Os binários e o manifesto em `src/reference/firecast/` continuam como referência da transcrição original.

As 15 imagens de tabelas usadas no livro foram transcritas para 17 tabelas HTML em nove páginas. Ações, condições, críticos, níveis, atributos, ferramentas, reforços, leitura e EAR usam `.nexus-table-wrap` e `.nexus-rule-table`, com títulos, cabeçalhos e texto selecionável no mesmo tema do guia. Os painéis de progressão foram reunidos na ordem dos níveis 1–20. Valores, fórmulas e regras das células foram preservados; apenas erros evidentes de ortografia foram corrigidos. As imagens originais continuam nos assets como referência e não são mais exibidas nas páginas.

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
