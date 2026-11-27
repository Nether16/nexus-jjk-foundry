# Movimentos, fórmulas e macros — Nexus

Documentação de uso • Nexus 0.4.43 • Foundry VTT 14 • Revisada em 27/11/2026.

Este manual reúne os recursos implementados para montar movimentos, escrever fórmulas, publicar resultados no chat e executar habilidades pela barra de macros. Os exemplos usam a sintaxe da ficha Nexus. Os comandos de chat e os scripts do Foundry são apresentados separadamente.

## 1. O que o sistema faz

| Recurso | Comportamento |
|---|---|
| Rolagem | Rola os dados e soma atributos ou outras expressões. |
| Custo | Calcula o gasto, verifica a EA disponível e desconta da ficha. |
| Efeito | Calcula e mostra um ou vários resultados, com rótulos e textos. |
| Imagem | Publica a imagem ou o GIF do movimento junto ao resultado. |
| Parâmetros | Pergunta valores numéricos durante a execução. |
| Arma | Consulta o dano da arma equipada pela variável `ARMA`. |
| Macros | Cria atalhos ao arrastar o dado do movimento para a barra. |
| Atualizações | Usa os atributos, a arma e as fórmulas atuais da ficha. |
| Arredondamento | Arredonda cada resultado numérico final para baixo. |

**Dano, cura e condições escritos em Efeito são resultados publicados no chat.** Eles não alteram automaticamente o HP de um alvo, não aplicam condições e não verificam se o ataque acertou. O recurso que o movimento desconta automaticamente é a EA indicada no campo Custo. Nos movimentos de Shikigami, o desconto sai da EA do invocador vinculado.

## 2. Criar e preencher um movimento

Abra a ficha, entre em **Movimentos** e clique em **Adicionar movimento**.

| Campo ou botão | Uso |
|---|---|
| Nome | Título exibido no chat e usado ao criar o atalho. |
| Rolagem | Expressão do teste, como `1d20 + DES`. Pode ficar vazia. |
| Custo | Quantidade de EA ou fórmula que determina o gasto. Vazio significa sem custo. |
| Efeito | Fórmulas, resultados identificados e textos da habilidade. |
| Botão de imagem | Escolhe a imagem ou o GIF por link ou pelo seletor de arquivos do Foundry. |
| Botão de dado | Um clique executa; arrastar cria o atalho na barra. |
| Lixeira | Exclui o movimento da ficha. |

Para trocar a ordem dos movimentos, arraste pelo **espaço vazio da linha ou do cartão** e solte acima ou abaixo de outro movimento. O dado continua reservado ao arraste para a hotbar. Itens, técnicas e anotações também podem ser arrastados dentro de suas listas; os campos de texto continuam disponíveis para edição. A nova ordem fica salva ao fechar a ficha.

Ao terminar de editar um campo, pressione **Tab** ou clique fora dele. Nas fichas de Personagem e Maldição, o campo de fórmula em edição se amplia suavemente. Na ficha vertical de Shikigami, os campos ficam organizados em cartões.

É possível ter um movimento só de efeito, só de custo ou só de imagem. Preencher apenas o nome não produz uma execução: é necessário haver Rolagem, Custo, Efeito ou uma imagem personalizada.

Exemplo completo:

```text
Nome: Golpe reforçado
Rolagem: 1d20 + DES
Custo: 15
Efeito: Dano: ARMA + FOR * 2
```

## 3. Colocar e usar na barra de macros

1. Destrave o cadeado da barra de macros, na parte inferior da tela.
2. Segure o botão esquerdo sobre o **botão do dado do movimento**.
3. Arraste esse botão para uma posição da barra e solte.
4. Clique no atalho criado ou pressione a tecla correspondente.

Arraste o dado da linha ou do cartão. Um clique normal nesse dado já executa o movimento pela ficha.

| Ação | Controle padrão |
|---|---|
| Executar as posições 1 a 9 | Teclas `1` a `9` da fileira superior do teclado |
| Executar a décima posição | Tecla `0` |
| Trocar diretamente de página | `Alt + 1` até `Alt + 5` |
| Trocar de página pelo mouse | Setinhas ao lado da barra |
| Mover um atalho | Arrastar entre posições com a barra destravada |
| Remover somente da barra | Botão direito no atalho → Remover |

O Foundry possui cinco páginas de dez posições. As teclas executam a **página atualmente exibida**. Os atalhos podem ser personalizados em Configurar Controles; enquanto estiver digitando em um campo, saia dele antes de usar as teclas da barra. [Referência de controles do Foundry](https://foundryvtt.com/article/controls/)

Soltar um movimento em uma posição ocupada substitui o atalho daquela posição, sem apagar o movimento anterior. Atribuir o mesmo movimento a outra posição pode deixar atalhos dele em vários espaços.

Cada usuário organiza a própria barra. Para compartilhar uma macro com outro usuário, o mestre pode ajustar sua propriedade no diretório de macros; esse compartilhamento não dá permissão para editar a ficha que o movimento usa. [Macros e propriedade no Foundry](https://foundryvtt.com/article/macros/)

### Vínculo com a ficha

O atalho guarda a referência do **movimento original**, não apenas o nome dele.

- A ficha pode estar fechada.
- Não é necessário selecionar um token ou um alvo para executar.
- Selecionar outro token não muda a ficha usada pela macro.
- Editar a fórmula na ficha afeta as próximas execuções do atalho.
- Duplicar a ficha ou o movimento cria outra referência: arraste o dado da cópia para criar seu próprio atalho.
- Excluir e recriar um movimento com o mesmo nome não recupera o vínculo antigo.

O texto e a imagem do cartão de chat vêm do movimento atual. Já o nome e o ícone visíveis no atalho são copiados na atribuição: para atualizá-los após mudar nome ou imagem, arraste o dado novamente para a barra.

## 4. Variáveis da ficha

Use os nomes abaixo diretamente nas fórmulas. Os aliases desta tabela aceitam maiúsculas ou minúsculas: `FOR`, `for` e `For` consultam o mesmo atributo.

| Informação | Variável principal | Outros nomes aceitos |
|---|---|---|
| Força | `FOR` | `FORCA`, `FORÇA` |
| Destreza | `DES` | `DEX`, `DESTREZA` |
| Agilidade | `AGI` | `AGILIDADE` |
| Vigor / Constituição | `CON` | `CONS`, `VIG`, `VIGOR` |
| Percepção | `PER` | `PERCEPCAO`, `PERCEPÇÃO` |
| Inteligência | `INT` | `INTELIGENCIA`, `INTELIGÊNCIA` |
| Jujutsu | `JJT` | `JUJUTSU` |
| Força de vontade | `FDV` | — |
| Nível | `NIVEL` | `NÍVEL` |
| HP atual | `HP` | `HPATUAL` |
| HP máximo | `HPMAX` | — |
| EA atual | `EA` | `EAATUAL` |
| EA máxima | `EAMAX` | — |
| CA | `CA` | `ESQUIVA` |
| Dano da arma equipada | `ARMA` | `DANOARMA`, `DANO_ARMA` |
| Acerto da arma equipada | `ARMA_ACERTO` | `ARMAACERTO`, `ACERTO_ARMA`, `ACERTOARMA` |

Exemplos:

```text
1d20 + AGI
FOR * 5
ARMA + DES * 2
HPMAX * 0.1
EAMAX * 0.05
NIVEL * 3 + JJT
```

Essas palavras representam valores numéricos. `CA`, por exemplo, consulta a defesa da ficha que está executando o movimento; não consulta a CA de um alvo selecionado.

### Caminhos numéricos internos

Também é possível consultar um campo numérico de `system` com `@{caminho}`:

```text
@{movement}
@{xp.value}
@{attributes.forca}
```

Os caminhos são relativos aos dados do sistema: escreva `@{attributes.forca}`, sem o prefixo `system.`. Use a grafia exata do caminho. Para atributos e recursos comuns, prefira os aliases da tabela.

## 5. Operações e escrita das fórmulas

| Operação | Exemplo |
|---|---|
| Somar | `FOR + DES` |
| Subtrair | `ARMA - 5` |
| Multiplicar | `JJT * 3` |
| Dividir | `FOR / 2` |
| Agrupar uma conta | `(ARMA + FOR) * 2` |
| Usar decimal | `ARMA * 1.5` |
| Potência recomendada | `pow(FOR, 2)` |

Multiplicação e divisão são feitas antes de soma e subtração. Use parênteses para deixar a intenção explícita:

```text
ARMA + FOR * 2
```

Com ARMA 10 e FOR 4, o resultado é 18.

```text
(ARMA + FOR) * 2
```

Com os mesmos valores, o resultado é 28.

O ponto decimal é a forma recomendada para copiar exemplos. A vírgula decimal também é aceita em contas simples, como `FOR * 1,5`. Nas funções `min`, `max` e `pow`, a vírgula separa os argumentos; use ponto nos decimais: `max(1.5, 2.5)`.

Os sinais `×` e ` x ` também são convertidos em multiplicação, mas `*` é a forma mais simples de escrever e revisar as fórmulas.

Nos blocos que mostram várias fórmulas avulsas, cada linha é uma opção independente. Para colocar vários resultados no mesmo Efeito, una os módulos com `|`; uma quebra de linha não é um separador de módulos.

### Potência e resto

`2^3` e `2**3` funcionam para uma potência simples com números. Entretanto, os operadores `^` e `**` têm limitações na preparação de fórmulas com dados e em potências encadeadas. **Use `pow(base, expoente)` para potências**, inclusive `pow(1d20, 2)`.

`%` calcula o resto de divisões numéricas, como `5 % 2`, que resulta em 1. Seu uso diretamente após um dado não é confiável nesta versão. Evite expressões como `1d20%3`.

## 6. Dados, vantagem e desvantagem

Escreva os dados de forma contígua: quantidade, letra `d` e número de faces.

| Fórmula | Uso |
|---|---|
| `1d20` | Um dado de vinte faces |
| `2d6` | Soma de dois dados de seis faces |
| `1d20 + DES` | Teste com Destreza |
| `2d6 + FOR` | Dois dados somados à Força |
| `1d20 + NIVEL + JJT` | Teste com vários valores da ficha |
| `max(1d20, 1d20) + DES` | Rola dois d20, usa o maior e soma DES |
| `min(1d20, 1d20) + DES` | Rola dois d20, usa o menor e soma DES |

Use `1d20`, sem espaços entre suas partes. `1D20` também é aceito.

Rolagem, Custo e cada módulo de Efeito são avaliados separadamente. Escrever `1d20` em dois campos faz duas rolagens; a segunda expressão não reaproveita o resultado da primeira.

### Modificadores nativos do Foundry

**Nesta versão, não use `kh`, `kl`, `dl`, rerrolagens ou explosões dentro dos campos da Nexus.** A interpretação de variáveis pode confundir esses sufixos com parâmetros e produzir um resultado incorreto. Para vantagem e desvantagem, use os exemplos com `max` e `min` acima.

O Foundry possui uma linguagem de dados mais ampla no próprio chat e em scripts. Ela não deve ser confundida com o conjunto de expressões confiáveis nos campos da Nexus. [Dados no Foundry](https://foundryvtt.com/article/dice/)

## 7. Funções matemáticas

Escreva os nomes das funções em **minúsculas**.

| Função | O que faz | Exemplo | Resultado final |
|---|---|---|---:|
| `abs(valor)` | Valor absoluto | `abs(-8)` | 8 |
| `ceil(valor)` | Arredonda para cima | `ceil(7 / 2)` | 4 |
| `floor(valor)` | Arredonda para baixo | `floor(7 / 2)` | 3 |
| `round(valor)` | Arredonda para o inteiro mais próximo | `round(3.6)` | 4 |
| `min(a, b)` | Escolhe o menor | `min(10, 25)` | 10 |
| `max(a, b)` | Escolhe o maior | `max(10, 25)` | 25 |
| `pow(base, expoente)` | Calcula uma potência | `pow(2, 3)` | 8 |
| `sqrt(valor)` | Raiz quadrada | `sqrt(25)` | 5 |

Exemplos de composição:

```text
max(ARMA - 10, 0)
min(JJT * 5, 100)
ceil(EAMAX * 0.05)
pow(FOR, 2) + ARMA
```

O primeiro limita o resultado mínimo a zero. O segundo impõe um teto de 100. São fórmulas para produzir números; escrever um teto de dano em Efeito continua sendo uma publicação de resultado, sem aplicação automática no alvo.

## 8. Arredondamento dos resultados

Cada resultado numérico final de Rolagem, Custo e Efeito recebe `floor`: arredondamento para o inteiro inferior.

| Conta | Resultado publicado ou utilizado |
|---|---:|
| `7.9` | 7 |
| `10 / 3` | 3 |
| `(3 / 2) * 2` | 3 |
| `-0.2` | -1 |

Os valores intermediários preservam a precisão. Não é necessário acrescentar `floor` a todas as fórmulas. O arredondamento automático fica escondido na fórmula exibida no cartão de chat.

Para decidir outro arredondamento em parte da conta, use uma função explícita:

```text
ceil(10 / 3)
```

O resultado é 4. Um `floor(...)` escrito por você continua aparecendo como parte da sua fórmula; o `floor` acrescentado pelo sistema fica oculto.

## 9. Valores perguntados durante a execução

Use `@{Nome}` quando um valor precisar ser informado a cada uso do movimento.

O sistema pergunta apenas nomes que não correspondem a um valor conhecido. `@{Bonus}` pode gerar uma pergunta; `@{FOR}` consulta a Força da ficha.

```text
Rolagem: 1d20 + DES + @{Bonus}
Custo: 10 * @{Cast}
Efeito: Dano: (ARMA + FOR * 2) * @{Cast}
```

Ao executar, o sistema pergunta o valor de Bonus e de Cast. Cada nome é solicitado uma única vez naquela execução e o valor é reutilizado em todos os campos. Na próxima execução, os valores são perguntados novamente.

Os nomes podem conter espaços:

```text
Dano: FOR * 3 + @{Bonus do ritual}
```

Os parâmetros aceitam números inteiros, decimais e negativos. A fórmula de Custo continua exigindo um resultado final não negativo. Cancelar a pergunta interrompe o movimento sem publicar o resultado ou gastar EA.

Uma variável desconhecida dentro de uma expressão como `Cast * 10` também pode gerar uma pergunta. **Prefira sempre `@{Cast}`**: essa forma funciona inclusive quando o parâmetro aparece sozinho.

```text
Custo: @{Gasto}
```

`EAR`, `Cast`, `Bonus` e outros nomes personalizados não são reservas ou atributos registrados automaticamente. Com `@{EAR}`, por exemplo, você informa um número; o sistema não cria uma barra de Energia Amaldiçoada Reversa.

Parâmetros não são resultados de campos anteriores. `@{Dano}` pergunta um número; não consulta o resultado de uma linha chamada Dano.

## 10. Efeitos com várias partes

O campo Efeito aceita vários módulos. A forma recomendada é separar as partes com `|` e dar um rótulo a cada uma:

```text
Dano: ARMA + FOR * 2 | Cura: JJT * 3 | Nota: "Derruba o alvo se o mestre confirmar o efeito."
```

O chat mostra três seções: Dano, Cura e Nota.

Também é possível separar módulos com `/` quando a barra é seguida por um novo rótulo:

```text
Dano: FOR / 2 / Cura: JJT + 1
```

Nesse exemplo, `FOR / 2` é a divisão; a barra antes de `Cura:` começa outra seção. Para facilitar a leitura, prefira `|` como separador de seções.

### Texto literal

Coloque o texto entre aspas duplas para publicá-lo sem calcular ou substituir palavras:

```text
Condição: "Atordoado por 2 turnos."
Nota: "A: B; texto com | e / preservados."
Descrição: "Recebe o efeito de FOR por um turno."
```

No último exemplo, a palavra FOR permanece escrita; não vira o valor de Força. Para texto com dois-pontos, use um rótulo explícito, como `Nota: "A: B"`.

As três linhas acima são exemplos separados. Para publicá-las juntas no mesmo campo, separe-as com `|`.

Dentro do texto literal, `\"` representa aspas e `\\` representa uma barra invertida.

### Rótulos não executam ações

Você pode usar nomes como Dano, Cura, Defesa, Duração ou Alcance. Eles identificam as seções do chat; não são comandos especiais.

```text
Custo: 30
```

Se essa linha estiver em **Efeito**, ela apenas mostra uma seção chamada Custo. Para gastar 30 EA, coloque `30` no campo **Custo** do movimento.

## 11. Custo e Energia Amaldiçoada

Custo aceita um número fixo, uma fórmula ou dados. Personagens e Maldições gastam a própria EA; Shikigamis gastam a EA do personagem invocador vinculado:

| Custo | Comportamento |
|---|---|
| Vazio | Não cobra EA |
| `0` | Publica custo zero, sem gasto |
| `15` | Gasta 15 EA |
| `NIVEL * 2` | Gasta o dobro do nível |
| `EAMAX * 0.05` | Gasta 5% da EA máxima, arredondado para baixo |
| `EA * 0.1` | Gasta 10% da EA atual, arredondado para baixo |
| `10 * @{Cast}` | Pergunta Cast e calcula o custo |
| `1d6 + 5` | Rola o custo e verifica a EA necessária |

O custo é resolvido antes da Rolagem e dos Efeitos. Se ele usar dados, esses dados podem ser rolados antes de o sistema descobrir que a EA é insuficiente; o restante do movimento não prossegue nesse caso.

`EAMAX` já reflete a EA máxima calculada pela ficha, incluindo o bônus de Reserva de Energia Amaldiçoada quando o personagem possui esse talento. Nas fórmulas de Shikigami, `EA` e `EAMAX` continuam valendo zero; vincular o invocador define quem paga o custo, sem copiar seus atributos para a fórmula.

O resultado final do custo deve ser um inteiro não negativo após o arredondamento. Custos negativos, expressões inválidas e divisões por zero são recusados.

Se faltar EA, o sistema mostra um aviso e não publica o movimento. Com EA suficiente, calcula a mensagem, desconta o custo e envia o cartão ao chat. Para cobrar um custo positivo de Shikigami, é preciso ter um invocador válido e permissão para editar a ficha dele. Custo vazio ou zero não exige desconto. Se a publicação falhar depois do desconto, o sistema tenta devolver o gasto sem sobrescrever outra alteração que tenha ocorrido na EA.

### Quando a variável EA é lida

Em Personagens e Maldições, todos os campos usam a EA atual **antes do desconto desse movimento**.

```text
EA inicial: 100
Rolagem: EA
Custo: EA * 0.1
Efeito: Referência: EA + 0
```

O cartão mostra Rolagem 100, custo 10 EA e Referência 100. A ficha termina com 90 EA.

## 12. Dano da arma equipada

`ARMA`, `DANOARMA` e `DANO_ARMA` representam o mesmo valor: o dano final da arma atualmente equipada, incluindo os bônus aplicáveis de Arma Afiliada e Sob Medida. O dano base cadastrado pelo mestre fica preservado.

1. No Inventário, marque o item como arma.
2. O mestre define o dano da arma.
3. Equipe a arma desejada.
4. Use `ARMA` nas fórmulas dos movimentos.

A ficha possui uma arma equipada por vez. Se nenhuma estiver equipada, `ARMA` vale zero. Trocar a arma equipada altera as próximas execuções, inclusive as feitas por macro.

```text
Dano: ARMA
Dano: ARMA + FOR * 2
Dano: (ARMA + DES) * 1.5
```

O valor é numérico. `ARMA` não representa o nome do item e não é uma expressão de dados armazenada no campo de dano da arma.

### Acerto da arma afiliada

`ARMA_ACERTO` consulta o bônus de acerto da arma equipada. Uma arma marcada como Arma afiliada recebe +1 inicial, +2 no nível 5, +3 no nível 10, +4 no nível 15 e +5 no nível 20. Sem uma arma afiliada equipada, o valor é zero.

```text
Rolagem: 1d20 + DES + ARMA_ACERTO
```

Escreva a variável na fórmula para somar o bônus. O sistema não a acrescenta sozinho às rolagens e não a soma duas vezes. `ARMAACERTO`, `ACERTO_ARMA`, `ACERTOARMA` e `@{Arma acerto}` também são aceitos. Sob Medida altera o dano, sem acrescentar outro bônus de acerto.

## 13. Imagens e GIFs

Escolha a imagem pelo botão de imagem do próprio movimento. O seletor permite usar um caminho disponível no Foundry ou um link de imagem; o envio de arquivo depende da permissão de upload do usuário.

Uma imagem personalizada é publicada no cartão do chat. O ícone padrão do movimento não é enviado como ilustração. A imagem e os textos aparecem junto à Rolagem, ao Custo e aos Efeitos preenchidos.

Use links HTTP/HTTPS ou caminhos servidos pelo próprio Foundry. Endereços locais como `C:\\Imagens\\golpe.png` e links `file:`, `data:` ou `blob:` não são aceitos como imagem do cartão.

Use arquivos de imagem ou GIF para esse campo. O cartão é renderizado com uma imagem, não com um player de vídeo. Escolher um vídeo não fornece reprodução de vídeo nesse cartão; o atalho também usa um ícone de dado como alternativa para arquivos de vídeo reconhecidos.

## 14. Personagem, Maldição e Shikigami

| Recurso | Personagem | Maldição | Shikigami |
|---|---|---|---|
| Executar pela ficha e por macro | Sim | Sim | Sim |
| Rolagem e Efeito calculados | Sim | Sim | Sim |
| Custo calculado e descontado da EA | Da própria ficha | Da própria ficha | Do invocador vinculado |
| Custo mostrado no chat | Mostra o gasto calculado | Mostra o gasto calculado | Mostra o gasto calculado |
| Atributos mentais da própria ficha | Sim | Sim | Não possui |
| Dano de arma equipada | Consulta ARMA | Consulta ARMA | ARMA vale zero |

Cada ponto de Constituição (**CON/CONS**) acrescenta **25 HP ao máximo** de Personagens, Maldições e Shikigamis. O HP atual não aumenta automaticamente; ao reduzir o máximo, a vida atual é limitada a ele.

No Shikigami, preencha Custo com o número ou a fórmula, do mesmo jeito que no personagem. Para gastar 20 EA do invocador, escreva apenas:

```text
Custo: 20
```

A EA é compartilhada: se o invocador começa com 50 EA, usa um movimento de custo 20 e depois o Shikigami usa outro de custo 20, o invocador termina com **10 EA**. O cartão continua sendo publicado pelo Shikigami.

Se faltar EA no invocador, o movimento é bloqueado. Custo positivo também exige vínculo válido e permissão para editar o invocador. Sem custo ou com custo zero, não há desconto. Fórmulas inválidas ou perguntas canceladas não cobram EA; uma falha na publicação tenta devolver o gasto à ficha que pagou.

As fórmulas do Shikigami consultam seus próprios atributos físicos, HP, CA e nível derivado. `JJT`, `INT`, `PER`, `FDV` e `EA` não puxam os valores do invocador; esses recursos ausentes resolvem como zero. `ARMA` e `ARMA_ACERTO` também valem zero. Sem vínculo válido, a variável numérica `NIVEL` resolve como zero.

## 15. Exemplos prontos para copiar

Os números abaixo são exemplos técnicos de configuração. Ajuste custos, multiplicadores e efeitos às regras aprovadas pelo mestre.

### Ataque com arma

```text
Nome: Golpe reforçado
Rolagem: 1d20 + DES
Custo: 15
Efeito: Dano: ARMA + FOR * 2
```

### Ataque usando Jujutsu

```text
Nome: Disparo amaldiçoado
Rolagem: 1d20 + JJT
Custo: 20
Efeito: Dano: JJT * 5
```

### Cura anunciada no chat

```text
Nome: Recuperação
Rolagem:
Custo: 15
Efeito: Cura: JJT * 3 | Nota: "Ajustar o HP do beneficiário após resolver a habilidade."
```

### Intensidade escolhida ao usar

```text
Nome: Canalização
Rolagem: 1d20 + JJT
Custo: 10 * @{Cast}
Efeito: Dano: JJT * 5 * @{Cast}
```

Cast é perguntado uma vez e usado nas duas contas.

### Bônus informado para o teste

```text
Nome: Ataque com bônus
Rolagem: 1d20 + DES + @{Bonus}
Custo: 10
Efeito: Dano: ARMA + FOR * 2
```

### Dois resultados e uma condição descritiva

```text
Nome: Impacto
Rolagem: 1d20 + FOR
Custo: 20
Efeito: Dano: ARMA + FOR * 3 | Alcance: 3 + AGI | Condição: "Derrubado, se a habilidade for bem-sucedida."
```

### Teste com o maior ou o menor de dois d20

```text
Rolagem com maior resultado: max(1d20, 1d20) + DES
Rolagem com menor resultado: min(1d20, 1d20) + DES
```

Copie apenas a expressão desejada para Rolagem, sem o texto explicativo antes dos dois-pontos.

### Custo percentual

```text
Nome: Liberação
Rolagem: 1d20 + JJT
Custo: EAMAX * 0.05
Efeito: Dano: JJT * 8
```

### Shikigami usando a EA do invocador

```text
Nome: Investida
Rolagem: 1d20 + FOR
Custo: 15
Efeito: Dano: FOR * 5
```

## 16. Macros de chat e macros de script

O Foundry oferece macros do tipo **Chat**, para enviar texto e comandos, e **Script**, para executar JavaScript e acessar sua API. Clique em uma posição vazia da barra ou crie uma macro pelo diretório para configurar uma delas. [Tipos de macro no Foundry](https://foundryvtt.com/article/macros/)

Uma macro de Chat pode conter, por exemplo:

```text
/roll 1d20 + 5
```

Essa é uma rolagem nativa. Escrever `DES` ou `ARMA` nela não aciona automaticamente o resolvedor dos campos da ficha Nexus. Para executar um movimento com suas variáveis, custo e imagem, use o atalho criado ao arrastar o dado, ou a chamada de Script abaixo.

### Executar um movimento por Script

```javascript
await game.nexus.rollMovement("Actor.ID_DO_ATOR.Item.ID_DO_MOVIMENTO");
```

Substitua o texto de exemplo pelo UUID real do Item de movimento. Uma forma de obter a referência correta é criar o atalho arrastando o dado e abrir **Editar** no menu de botão direito da macro: o comando criado já contém seu UUID.

Essa chamada usa o mesmo fluxo da ficha: permissões, parâmetros, fórmulas, EA, imagem e chat. Ela não exige que a ficha esteja aberta.

JavaScript genérico permite construir outras automações por meio da API do Foundry e de módulos instalados. Isso depende do script escrito; não significa que existam campos ou comandos equivalentes implementados na Nexus.

## 17. Referência da API de movimentos

### `game.nexus.rollMovement(uuid)`

| Item | Descrição |
|---|---|
| Argumento | UUID do Item de movimento, como string |
| Fichas aceitas | Personagem, Maldição e Shikigami existentes no mundo |
| Permissão | O usuário precisa ter propriedade da ficha |
| Sucesso | Promise que resolve com o documento ChatMessage criado |
| Cancelamento ou falha tratada | Promise que resolve com `undefined` |

Não há argumentos para escolher alvo, ignorar custo, acrescentar bônus ou mudar o modo da mensagem nessa função. Bônus variáveis devem estar nas fórmulas do movimento.

Para usar a mensagem criada dentro de um Script:

```javascript
const mensagem = await game.nexus.rollMovement("Actor.ID_DO_ATOR.Item.ID_DO_MOVIMENTO");
if (mensagem) {
  console.log("Movimento publicado:", mensagem.id);
}
```

A macro automática criada pela barra contém `await ...;`, sem `return`. Portanto, executar o documento Macro não devolve diretamente a mensagem. Em uma macro manual que precise devolver esse valor ao chamador, use:

```javascript
return await game.nexus.rollMovement("Actor.ID_DO_ATOR.Item.ID_DO_MOVIMENTO");
```

### Atribuir uma posição por código

`assignMovementMacro` é uma exportação do módulo, não um método de `game.nexus`. Esta é uma opção avançada para scripts do cliente:

```javascript
const { assignMovementMacro } = await import(
  foundry.utils.getRoute("systems/nexus-jjk/module/movement-macros.mjs")
);

await assignMovementMacro("Actor.ID_DO_ATOR.Item.ID_DO_MOVIMENTO", 12);
```

O exemplo atribui à página 2, tecla 2. O número usado pela função é a posição absoluta, de 1 a 50:

| Página | Posições absolutas | Tecla 1 | Tecla 0 |
|---|---|---:|---:|
| 1 | 1–10 | 1 | 10 |
| 2 | 11–20 | 11 | 20 |
| 3 | 21–30 | 21 | 30 |
| 4 | 31–40 | 31 | 40 |
| 5 | 41–50 | 41 | 50 |

A regra é `(página - 1) * 10 + posição`, contando a tecla 0 como posição 10. A função substitui o atalho daquela posição e devolve a macro atribuída, ou `undefined` se a operação não for concluída.

O módulo também exporta `promptMovementMacro`, que abre um seletor de página e tecla e confirma substituições. Essa função não está ligada a um botão da ficha e não existe como `game.nexus.promptMovementMacro`.

```javascript
const { promptMovementMacro } = await import(
  foundry.utils.getRoute("systems/nexus-jjk/module/movement-macros.mjs")
);

await promptMovementMacro("Actor.ID_DO_ATOR.Item.ID_DO_MOVIMENTO");
```

O cadeado protege o arraste na interface. Ele não deve ser interpretado como bloqueio dessas chamadas por código.

## 18. Permissões, privacidade e exclusão

### Permissões

Para criar o atalho automaticamente, o usuário precisa poder criar macros e ter a permissão de macros de script. Para executar o movimento, também precisa ter propriedade da ficha original, mesmo quando o custo é zero.

Compartilhar apenas o documento Macro não compartilha a ficha. O mestre pode configurar as propriedades necessárias; a Nexus não executa a operação com permissões elevadas de um GM.

### Visibilidade no chat

No Foundry 14 verificado, o movimento usa o modo de mensagem escolhido no chat:

| Modo | Quem vê o conteúdo |
|---|---|
| Público | Todos |
| GM | Autor e mestres |
| Cego / Blind | Mestres |
| Próprio / Self | Autor |

Em rolagens ocultas, o Foundry pode manter uma indicação da mensagem ou um espaço com conteúdo escondido; isso não significa que o resultado foi revelado. [Modos de dados do Foundry](https://foundryvtt.com/article/dice/)

### Remover e excluir

- **Remover da barra:** libera a posição, mantendo a macro e o movimento.
- **Excluir a macro:** apaga o atalho como documento, mantendo o movimento da ficha.
- **Excluir o movimento:** a Nexus remove as macros automáticas identificadas como ligadas àquele movimento, conforme as permissões disponíveis.

Com um GM ativo, ele coordena a limpeza das macros do movimento excluído, inclusive as de autores desconectados. Macros escritas manualmente sem a identificação da Nexus não entram nessa limpeza automática.

Não há garantia de limpeza geral ao excluir uma ficha inteira ou de recuperação de todos os atalhos antigos. Uma macro com referência indisponível mostra aviso ao executar; recrie o atalho a partir do movimento válido.

### Cliques repetidos

Enquanto um movimento está sendo processado, uma segunda execução para a mesma ficha no mesmo cliente é ignorada. Isso cobre as perguntas, a rolagem e o gasto. Aguarde a conclusão antes de executar novamente.

Movimentos de fichas diferentes que gastam a EA do mesmo invocador entram em uma fila no mesmo cliente. O personagem e seus Shikigamis usam o saldo atualizado a cada execução, sem descontar todos a partir do mesmo valor antigo.

Essa proteção não é uma transação compartilhada entre vários usuários ou várias abas. Evite que duas pessoas operem a mesma ficha simultaneamente para gastar o mesmo recurso.

### XP da sessão

O mestre escreve `/xp` no chat, informa a quantidade de XP por personagem e marca as fichas que receberão. Também pode usar `/xp 50` para abrir a janela com 50 XP já preenchidos. Confirme em **Distribuir XP**. O sistema soma a experiência, sobe de nível quando necessário e conserva o XP restante.

O chat anuncia **Sessão encerrada**, **XP Recebido:** e a quantidade entregue, com os nomes dos personagens. XP e nível ficam disponíveis para edição apenas para o mestre, inclusive por atualizações de documento. Os jogadores continuam editando os demais campos da ficha.

Em uma macro de Script do mestre, `await game.nexus.promptXP()` abre a mesma janela. Para fichas específicas, use `await game.nexus.awardXP(["ID_DO_PERSONAGEM"], 50)`.

### Efeitos críticos no chat

Um **20 natural em um d20 ativo** abre o cartão **EFEITO CRÍTICO**. O total somado aos atributos não conta: 19 + 1 continua sendo um 19 natural. Dados descartados não contam. Nos movimentos Nexus, apenas o campo Rolagem gera essa escolha; dados de Custo e Efeito não geram críticos.

- **Kokusen:** rola `1d2`. Resultado **2** anuncia **Kokusen!**, com dano ×2; resultado **1** anuncia **Crítico!**, com dano equivalente a **130%** do golpe.
- **Outro Efeito → Escolhido pelas Faíscas:** anuncia o Kokusen diretamente, usando **Escolhido pelas Faíscas** como título.
- **Outro Efeito → Efeito Narrativo:** publica **Excelente resultado!**.

O cartão de Kokusen informa os benefícios de 3 rodadas: crítico a partir de 19, custos de EA reduzidos em 20% e atributos aumentados em 20%. **Esses bônus temporários são apenas anunciados:** o sistema não altera atributos, custos, dificuldade ou duração automaticamente. O mestre resolve esses modificadores durante a sessão.

O cartão mostra **Dano original** e **Dano final**: 100 vira **130** no crítico normal, ou **200** em Kokusen e Escolhido pelas Faíscas. Ele usa os resultados já calculados na rolagem original, sem repetir os dados de dano nem consultar novos atributos. A soma das parcelas de dano recebe o multiplicador e o total final é arredondado para baixo.

Use `Dano:`, `Dano físico:` ou `Dano extra:` para identificar parcelas de dano numérico. Um efeito numérico sem rótulo também é tratado como dano. Cura, custo, alcance e textos mantêm seus valores; o efeito narrativo continua publicando apenas **Excelente resultado!**. Não há aplicação automática ao HP de um alvo.

Em rolagens avulsas ou mensagens antigas sem dano registrado, preencha **Dano base (opcional)** para calcular o total. Sem esse valor, o cartão apresenta as regras do crítico.

A escolha é feita pelo autor da rolagem ou pelo mestre, com permissão sobre a ficha. Cada cartão permite concluir uma única escolha. As opções e o resultado mantêm a visibilidade da rolagem original, incluindo sussurros e rolagens cegas.

O botão Kokusen e a opção Escolhido pelas Faíscas mostram energia vermelha e raios negros ao passar o mouse ou usar o foco do teclado. Os cartões de Kokusen recebem o mesmo efeito, com uma breve animação de impacto; o crítico normal e o resultado narrativo mantêm sua aparência. A preferência do dispositivo por movimento reduzido é respeitada.

### Catálogo online

Abra **Compêndios → Sistemática → Catálogo**. As páginas **Técnicas da Obra**, **Técnicas de Clã** e **Origens** leem os nomes, as imagens, as vagas e os preços do Supabase. O botão **Atualizar** consulta as três tabelas novamente; ao navegar, a cópia recente é reutilizada por até um minuto. Alterar os registros no Supabase atualiza o catálogo sem precisar publicar outra versão do sistema.

Na tabela `Clas`, use `id`, `nome` e `imagem`. Em `Tecnicas`, use `id`, `nome`, `imagem`, `vagas`, `vagas_maxima`, `valor` e `clan`: deixe `clan` vazio para Técnicas da Obra ou informe o ID do clã. Em `Origens`, o máximo usa o campo `vagas_max`. `imagem` aceita um link HTTPS de imagem, GIF ou vídeo; vazio mantém a mídia original dos registros já incluídos. Novos registros sem imagem mostram um espaço reservado.

As vagas são mostradas como **vagas / máximo**, exatamente conforme os valores cadastrados. O catálogo permite consultar; reservas, pagamentos e alterações das vagas são feitos pelo administrador no Supabase. Ele não muda as origens ou habilidades das fichas e conserva os textos de regras do livro. Se a conexão falhar, o leitor mostra a última cópia salva ou a página distribuída com o sistema, com aviso da fonte. A chave publicável depende das permissões SELECT/RLS do banco; o cliente não usa chave secreta nem envia alterações.

### Tokens simples

Para colocar figurantes, objetos ou marcadores no mapa, crie um ator e selecione **Tipo → Token**. A ficha guarda somente o nome e a arte; clique na imagem para escolher um arquivo ou use o campo de link. Depois arraste o ator da lista para a cena. O nome aparece ao passar o mouse sobre o token, por padrão.

**Configurar token** abre as opções nativas de tamanho, visão, exibição do nome e outras propriedades. A imagem do novo tipo Token é compartilhada entre a ficha e seu token de referência; Personagem, Maldição e Shikigami conservam as artes independentes. Mudanças no token de referência são usadas nas próximas colocações no mapa.

## 19. Limites da versão atual

| Recurso | Situação |
|---|---|
| Aplicar dano ou cura diretamente ao HP | Não automatizado pelos movimentos |
| Aplicar condições e contar seus turnos | Não automatizado |
| Comparar ataque com CA de um alvo | Não automatizado |
| Identificar 20 natural e escolher Efeito Crítico | Automático no chat, incluindo cálculo do dano final; bônus temporários são apenas anunciados |
| Consumir ações ou controlar alcance | Não automatizado |
| Descontar no invocador o custo do Shikigami | Automático pelo campo Custo, com vínculo e permissão válidos |
| Reutilizar o resultado de outra linha como variável | Não implementado |
| `if`, `else` e condições nos campos de fórmula | Não implementado como sintaxe de movimento |
| `kh`, `kl`, `dl`, rerrolagens e explosões nos campos | Não confiáveis nesta versão; use alternativas validadas |
| `^` e `**` em fórmulas gerais com dados | Não confiáveis; use `pow` |
| `%` diretamente após um dado | Não confiável |
| Reproduzir vídeo no cartão do movimento | Não implementado como player de vídeo |
| Atualizar imediatamente o nome/ícone da macro ao editar o movimento | Requer arrastar o dado novamente |

Os títulos Dano, Cura e Condição não transformam o resultado em uma ação automática. Fórmulas personalizadas também não são JavaScript: nos campos da ficha, use a sintaxe matemática descrita neste manual.

## 20. Problemas comuns

| Problema | O que conferir |
|---|---|
| Não consigo arrastar para a barra | Destrave o cadeado e arraste o botão do dado; confirme que pode editar a ficha. |
| A tecla não executa | Saia do campo de texto, confira a página atual e os atalhos em Configurar Controles. |
| A tecla executa outra habilidade | Confira a página e o atalho daquela posição. |
| A macro usa outro personagem | Ela continua ligada à ficha de origem; arraste o dado da ficha correta. |
| Não tenho permissão | Confira propriedade da ficha e permissões de criação de macros/script com o mestre. |
| Movimento inexistente | O original pode ter sido excluído ou duplicado. Crie o atalho a partir do movimento atual. |
| A arma vale zero | Confira se o item está marcado como arma, tem dano definido e está equipado. |
| Pede um nome estranho, como `d20kh` | Há um modificador de dados não suportado. Use `max(1d20, 1d20)` ou `min(...)`. |
| Não pergunta meu parâmetro | Escreva `@{Nome}`; um nome solto pode ser tratado como texto. |
| Pede um valor que deveria ser atributo | Confira a grafia na tabela de variáveis. |
| Texto está sendo interpretado como conta | Use rótulo e aspas: `Nota: "seu texto"`. |
| Não aceita meu custo | Use número ou fórmula de resultado não negativo; confira parênteses, funções e EA disponível. |
| Mostra o custo, mas não desconta | Confira se está no campo Custo, não em Efeito; no Shikigami, confira o vínculo e a EA do invocador. |
| A fórmula mudou, mas o ícone da barra está antigo | A execução usa a fórmula atual; arraste novamente para atualizar a aparência do atalho. |
| Um decimal apareceu como inteiro | O arredondamento final para baixo é automático. |

## 21. Referências e versão

Esta documentação foi conferida contra a implementação Nexus **0.4.43** e o núcleo local Foundry **14.370**. Os exemplos matemáticos principais, parâmetros, vantagem/desvantagem e limitações de dados foram verificados no motor da Nexus com o Roll nativo do Foundry.

- [Motor de fórmulas da Nexus, versão 0.4.43](https://github.com/Nether16/nexus-jjk-foundry/blob/v0.4.43/module/formula-engine.mjs)
- [Integração de macros da Nexus, versão 0.4.43](https://github.com/Nether16/nexus-jjk-foundry/blob/v0.4.43/module/movement-macros.mjs)
- [Dados e arma equipada da Nexus, versão 0.4.43](https://github.com/Nether16/nexus-jjk-foundry/blob/v0.4.43/module/documents.mjs)
- [Macros do Foundry](https://foundryvtt.com/article/macros/)
- [Controles do Foundry](https://foundryvtt.com/article/controls/)
- [Dados e modos de rolagem](https://foundryvtt.com/article/dice/)
- [API Hotbar do Foundry 14](https://foundryvtt.com/api/v14/classes/foundry.applications.ui.Hotbar.html)
- [API ChatMessage.applyMode do Foundry 14](https://foundryvtt.com/api/v14/classes/foundry.documents.ChatMessage.html#applyMode)

Alterações futuras no sistema ou em módulos instalados podem ampliar ou modificar esse comportamento. Este manual descreve o que está implementado na versão indicada.
