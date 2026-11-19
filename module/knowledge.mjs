export const NEXUS_KNOWLEDGE = Object.freeze({
  medicina: {
    name: "Medicina",
    description: "Conhecimento dedicado ao estudo do corpo, suas condições e formas de recuperação, permitindo compreender ferimentos, identificar problemas de saúde e aplicar métodos de tratamento.",
    levels: {
      1: {
        title: "Primeiros Socorros",
        description: "Conhecimento básico de atendimento emergencial, focado em preservar a vida e estabilizar pacientes em situações críticas.\n" +
          "\n" +
          "O usuário pode fazer um Teste de INT + DES, cuja dificuldade será definida pelas condições do alvo, materiais disponíveis e o efeito desejado. Caso passe no teste, o jogador é capaz de:\n" +
          "Controlar sangramentos e ferimentos simples.\n" +
          "Amenizar ou desfazer deméritos impostos por danos ao corpo.\n" +
          "Estabilizar um aliado caído, o tirando do risco de vida.\n" +
          "\n" +
          "OBS: Alguém que não tem esse conhecimento treinado pode realizar ou ajudar no teste se fizer sentido, mas utiliza apenas o atributo Inteligência no teste, dependendo de raciocínio e lógica acima da prática."
      },
      2: {
        title: "Diagnóstico",
        description: "Aprimoramento da capacidade de analisar sintomas, ferimentos e condições físicas para compreender problemas e encontrar soluções.\n" +
          "\n" +
          "O aluno faz um Teste de INT + PER para analisar o corpo de um alvo com base no seu conhecimento anatômico e biológico.\n" +
          "Sua dificuldade dependerá da intenção da análise, como será feito o exame, se o alvo colabora e etc. Se tiver sucesso na análise, o usuário pode:\n" +
          "Identificar doenças, lesões e a gravidade de ferimentos.\n" +
          "Obter Vantagem no teste de primeiros socorros.\n" +
          "Compreender melhor um efeito amaldiçoado pelo seu resultado no corpo."
      },
      3: {
        title: "Tratamento",
        description: "Domínio avançado dos cuidados médicos, permitindo realizar procedimentos complexos e auxiliar na recuperação completa de pacientes.\n" +
          "\n" +
          "O usuário faz um Teste de Inteligência e descreve seus cuidados quanto a um paciente alvo. A dificuldade vai depender dos recursos disponíveis e o estado do paciente. O resultado do sucesso pode acarretar:\n" +
          "Cura de um efeito debilitante ou Vantagem em testes de resistência quanto a ele.\n" +
          "Aumento na velocidade de recuperação de vida por descanso."
      },
    }
  },
  tech: {
    name: "Tech",
    description: "O estudo da tecnologia moderna e o conhecimento aplicado do funcionamento de máquinas e seus sistemas.",
    levels: {
      1: {
        title: "Análises de Sistemas",
        description: "O conhecimento básico de tecnologia possibilita avaliar e identificar a funcionalidade de máquinas e programas digitais.\n" +
          "\n" +
          "O usuário pode fazer um Teste de INT + PER quando diante de aparelhos eletrônicos ou sistemas automatizados. Deve ser especificado a informação que está sendo buscada, se é no Hardware (físico) ou Software (digital). Em caso de sucesso, pode:\n" +
          "Verificar a integridade ou funcionalidade daquele aparelho.\n" +
          "Buscar por algo específico, uma informação ou anormalidade no aparelho ou sistema."
      },
      2: {
        title: "Manipulação",
        description: "Conhecendo mais a fundo os fundamentos da tecnologia, agora se torna capaz de manipular e modificar máquinas com maior proficiência.\n" +
          "\n" +
          "O usuário faz um Teste de INT + FDV (para software) ou INT + DEX (para hardware) para interagir e modificar uma tecnologia de maneira mais direta. Em caso de sucesso, se pode:\n" +
          "Hackear ou invadir sistemas criptografados.\n" +
          "Consertar ou Sabotar equipamentos tecnológicos.\n" +
          "Modificar a funcionalidade inicial de uma máquina de forma que faça sentido."
      },
      3: {
        title: "Desenvolvimento",
        description: "Sua experiência ampla permite criar equipamentos tecnológicos com e programas úteis do zero.\n" +
          "\n" +
          "Com tempo e recursos, o usuário pode rolar um Teste de INT + FDV (para software) ou INT + DEX (para hardware) para criar aparelhos ou programas digitais com utilidades específicas.\n" +
          "\n" +
          "A depender da utilidade, complexidade e intenção, o tempo e os recursos necessários variam. Em um sucesso, se pode:\n" +
          "Criar novos aplicativos e programas personalizados, inclusive vírus.\n" +
          "Montar máquinas de funções variadas, como caixas de som, placas de circuito ou até robôs.\n" +
          "\n" +
          "OBS: Esses equipamentos dão Vantagem em testes para o propósito que foram criados."
      },
    }
  },
  teoriaDoJujutsu: {
    name: "Teoria do Jujutsu",
    description: "O estudo aplicado de efeitos, técnicas e espíritos amaldiçoados.\n" +
      "Usado para identificar técnicas famosas, compreender técnicas novas e identificar grau e características de maldições.",
    levels: {
      1: {
        title: "Catalogar",
        description: "Ao absorver conhecimento didático sobre o jujutsu, o aluno se torna capaz de identificar certos padrões e analisar com mais clareza uma maldição.\n" +
          "\n" +
          "Ao observar o uso da técnica de um feiticeiro ou a habilidade de um espírito amaldiçoado, o usuário pode usar sua Ação Bônus para fazer um Teste de PER + INT. A análise comparativa com técnicas e maldições conhecidas permite a identificação de características dos efeitos avaliados.\n" +
          "O número de efeitos demonstrados e escondidos por uma maldição ou feiticeiro afeta a dificuldade. Em caso de sucesso, se pode:\n" +
          "Identificar características de maldições como grau, tipo, pontos fortes e fracos. Também se pode identificar a maldição num nível mais conceitual, captando se sua forma ou poderes tem alguma temática.\n" +
          "Identificar ou compreender uma técnica amaldiçoada ou a habilidade de uma maldição, concedendo Vantagem contra seus efeitos.\n" +
          "\n" +
          "OBS: Um \"leigo\" pode utilizar esse movimento sem o conhecimento em si, mas utiliza apenas INT no teste."
      },
      2: {
        title: "Assimilar",
        description: "O conhecimento mais amplo do jujutsu concede ao usuário a capacidade de compreender conceitos ainda mais incomuns como rituais e a origem de maldições.\n" +
          "\n" +
          "Ao juntar informações suficientes sobre um ritual ou uma maldição através da investigação de suas características, o usuário pode fazer um Teste de INT + FDV para pensar mais a fundo sobre o assunto. Isso permite ao usuário avaliar rituais estranhos ou maldições através do resultado deles, os rastros que deixaram num local ou vítima, sem necessariamente presenciar seus atos. Em caso de sucesso, se pode:\n" +
          "Identificar características de uma maldição sem a ver, como seu comportamento, alguma ideia sobre sua habilidade ou até uma ideia de seu conceito.\n" +
          "Identificar as características e objetivos de um ritual feito através dos rastros deixados, recebendo pistas sobre quem o executou e suas intenções.\n" +
          "Receber Vantagem num posterior teste de Catalogar usando as informações adquiridas."
      },
      3: {
        title: "Dominar",
        description: "O domínio completo do conhecimento sobre o jujutsu, seus efeitos, história e aplicações mais recentes. O aluno passa a ter mais facilidade ao compreender o funcionamento do mundo e analisar Feiticeiros e Maldições.\n" +
          "\n" +
          "Ao compreender POR COMPLETO um efeito, ritual, feiticeiro ou maldição, todos os testes feitos contra tal tem Vantagem. A exigência para obter domínio sobre um assunto ou oponente é muito alta, pois o usuário deve conhecer suas intenções, suas técnicas, estilo de luta, temática de suas habilidades, personalidade, etc.\n" +
          "\n" +
          "Dado o requisito alto, não exige teste, mas a habilidade pode ter um efeito incompleto, onde é aplicada as características conhecidas pelo usuário, mas não as coisas que ele não conhece sobre o assunto, maldição ou feiticeiro.\n" +
          "\n" +
          "Estabelecer a postura de domínio em um combate exige uma Ação Suplementar para se fechar e confiar plenamente no conhecimento que tem, mas apresenta um risco, pois qualquer habilidade ou movimento que pegue o usuário de surpresa por não o conhecer o causa Desvantagem nos testes."
      },
    }
  },
  combate: {
    name: "Combate",
    description: "Estudo e prática de técnicas de combate, estilos de luta e artes marciais que permeiam a história, dando ao aluno um amplo entendimento do campo de batalha, seja em combate armado ou desarmado.",
    levels: {
      1: {
        title: "Postura de Combate",
        description: "A postura é algo essencial em qualquer estilo de luta, preparando corpo e mente em prol de tornar o usuário mais eficiente em combate.\n" +
          "\n" +
          "O usuário pode usar uma Ação Bônus para assumir uma postura entre Ofensiva e Defensiva. Sair das posturas de combate também gasta a ação bônus.\n" +
          "\n" +
          "Ofensiva: postura onde o usuário abre sua defesa e vai para um ataque feroz, aprimorando sua capacidade de combate de acordo o intelecto.\n" +
          "O usuário recebe um bônus de Acerto e um decréscimo na Defesa igual INT/2.\n" +
          "\n" +
          "Defensiva: postura onde o usuário se prepara para defender e esquivar com maestria.\n" +
          "A defesa do usuário recebe um bônus de INT/2 enquanto o acerto tem um decréscimo igual."
      },
      2: {
        title: "Manobras Avançadas",
        description: "O próximo passo após aprender a se posicionar em combate é utilizar suas posturas para movimentos mais complexos e avançados.\n" +
          "\n" +
          "Ao assumir uma postura, o usuário pode usar novos movimentos ligados a ela que não são possíveis em outros casos:\n" +
          "Investida (Ofensiva): a escolha da violência direta capacita o usuário a atingir novas distâncias para atacar seus oponentes. O usuário gasta sua ação de movimento e ação padrão para correr até duas vezes seu deslocamento em linha reta e desferir um golpe direto.\n" +
          "O golpe causa um bônus de dano igual INT x 2.\n" +
          "\n" +
          "Redirecionar (Defensiva): Ao receber um golpe direto de um oponente e esse errar, o usuário pode usar uma reação para redirecionar o golpe em algum oponente ao alcance corpo a corpo. Um teste de DES é feito pelo usuário para determinar o Acerto do golpe redirecionado (considerando o debuff de acerto que a postura causa)."
      },
      3: {
        title: "Maestria Marcial",
        description: "O domínio do conhecimento e prática do combate possibilita ao aluno misturar seus conhecimentos em novas técnicas devastadoras.\n" +
          "\n" +
          "O usuário desbloqueia movimentos que utilizam e misturam os conhecimentos aplicados, além de fazer movimentos que apenas o um mestre teria preparo físico e mental para executar.\n" +
          "\n" +
          "Arremessar (Ofensiva): o usuário faz um teste de ataque contra um oponente como se fosse o agarrar ou empurrar. Ao invés disso ele executa um movimento onde pega o oponente e o joga na direção que desejar. O inimigo voa um número de metros determinado por FOR, cai no chão e recebe dano de acordo com o atributo como num ataque normal, ficando Caído.\n" +
          "Caso tenha alguma obstrução, parede ou oponente na rota de colisão, esse também pode ser atingido e danificado, tendo como base o Acerto do início do movimento. O oponente arremessado e qualquer outro que pudesse ser atingido na trajetória tem direito a um teste de AGI ainda contra o ataque inicial do usuário para evitar a condição Caído.\n" +
          "\n" +
          "Proteger Aliado (Defensiva): o preparo magistral do usuário em combate muda a própria capacidade de proteger os seus. Ao invés de receber o dano diretamente, a Defesa do usuário entra em jogo ao tomar a frente de um companheiro já preparado para o golpe, podendo fazer que ambos desviem.\n" +
          "\n" +
          "Ambos os movimentos podem ser utilizados em conjunto com os movimentos de Nível 2, mas o esforço descomunal desfaz qualquer postura de combate, não podendo a reestabelecer pelo próximo turno."
      },
    }
  },
  navegacao: {
    name: "Navegação",
    description: "O estudo da locomoção, localização e direção em terrenos variados e veículos diversos. O aluno que adquire esse conhecimento treina para saber como chegar a um objetivo ou fugir de uma situação da maneira mais eficiente, rápida e segura possível.",
    levels: {
      1: {
        title: "Orientar",
        description: "O princípio desse conhecimento é saber como se orientar e encontrar o caminho mais rápido para seu objetivo, onde quer que esteja.\n" +
          "Seja dirigindo um carro pelas ruas de uma cidade, correndo por caminhos tortuosos ou até calculando o melhor caminho utilizando o transporte público de sua cidade.\n" +
          "\n" +
          "O usuário pode fazer um teste de INT + PER ou INT + FDV para saber se localizar por pontos de referência ou identificar o melhor caminho à frente.\n" +
          "Também tem direito a fazer testes de INT + DES para dirigir veículos terrestres. Com sucesso, pode:\n" +
          "Saber sua localização em locais minimamente conhecidos ou, pelo menos, o direcionamento de Norte, Sul, Leste e Oeste.\n" +
          "Cortar o tempo para chegar em qualquer lugar pela metade através de um bom planejamento.\n" +
          "Dirigir com mais facilidade qualquer veículo terrestre por conhecer os princípios da maioria deles."
      },
      2: {
        title: "Navegar",
        description: "Através de estudos mais profundos sobre mapas e navegação em si, o aluno aprimora sua capacidade de guiar a si e seus companheiros em viagens ou situações de risco.\n" +
          "Além disso, seus estudos incluem meios de locomoção aquáticos.\n" +
          "\n" +
          "O usuário agora pode fazer os mesmos testes do nível anterior com o objetivo de ler mapas de todos os tipos, orientar seu grupo para a fuga em uma situação de risco ou encontrar atalhos não convencionais, além de saber dirigir veículos aquáticos. Com sucesso, pode:\n" +
          "Adquirir e conceder ao grupo Vantagem no próximo teste de Fuga ao escolher caminhos não convencionais ou desvantajosos ao oponente.\n" +
          "Ler, compreender e até confeccionar mapas com precisão apurada.\n" +
          "Fazer manobras e movimentos mais complexos com veículos terrestres ou navegar em veículos aquáticos."
      },
      3: {
        title: "Pilotar",
        description: "A maestria na arte da locomoção aprimora as habilidades do aluno com veículos e adiciona conhecimentos para se orientar até mesmo em pleno ar.\n" +
          "\n" +
          "O usuário pode gastar uma ação bônus para Focar na Pilotagem, recebendo Vantagem ao dirigir, navegar ou pilotar qualquer tipo de veículo, mas, como consequência, tem Desvantagem em outras ações.\n" +
          "Além disso, recebe conhecimento e treinamento básico com simuladores de voo, habilitando o usuário a pilotar veículos aéreos."
      },
    }
  },
  cienciasHumanas: {
    name: "Ciências Humanas",
    description: "O estudo do ser humano enquanto indivíduo e, principalmente, enquanto parte de uma sociedade. Esse conhecimento reúne diferentes áreas de conhecimento, incluindo História, Sociologia, Linguística, Antropologia, Política e Heráldica.\n" +
      "\n" +
      "O aluno que adquire esse conhecimento possui uma ampla base de informações sobre as civilizações, sendo capaz de reconhecer,\n" +
      "interpretar e utilizar elementos culturais e sociais em seu benefício.",
    levels: {
      1: {
        title: "Relembrar",
        description: "O princípio desse conhecimento é adquirir e recordar informações estudadas sobre diferentes povos, culturas e sociedades. O aluno possui conhecimento sobre acontecimentos históricos, costumes, idiomas e símbolos, podendo utilizar sua memória para reconhecer informações relevantes sobre aquilo que estudou.\n" +
          "\n" +
          "O usuário pode fazer testes de INT + FDV para recordar informações específicas sobre um assunto previamente estudado. Também pode fazer testes de INT + PER para identificar elementos que entreguem uma origem específica, como brasões de clãs ou as características físicas de seus membros. Com sucesso, pode:\n" +
          "Recordar brasões, símbolos e elementos de Heráldica pertencentes a clãs, famílias, reinos ou organizações conhecidas. Além da árvore genealógica de um clã, seus antecedentes e originários.\n" +
          "Recordar costumes, tradições e características culturais de diferentes povos.\n" +
          "Reconhecer idiomas, dialetos e sistemas de escrita diferentes.\n" +
          "Recordar acontecimentos históricos, personagens importantes e informações relevantes sobre sociedades."
      },
      2: {
        title: "Relacionar",
        description: "Através de estudos mais aprofundados, o aluno passa a compreender que elementos culturais e acontecimentos históricos influenciam diretamente a maneira como as pessoas pensam e agem. Seu conhecimento também se aprofunda na Linguística, permitindo compreender melhor a estrutura, origem e utilização das diferentes formas de comunicação.\n" +
          "\n" +
          "O usuário pode fazer testes de INT + PER ou INT + FDV para relacionar elementos culturais, históricos e linguísticos ao comportamento de indivíduos ou grupos.\n" +
          "Ao analisar uma pessoa, pode utilizar informações sobre sua origem, cultura e experiências conhecidas para compreender melhor sua mentalidade e possíveis motivações. Com sucesso, pode:\n" +
          "Identificar possíveis motivações de um indivíduo através de sua cultura, origem ou experiências conhecidas.\n" +
          "Compreender relações entre idiomas, dialetos e diferentes formas de comunicação.\n" +
          "dentificar características de um idioma através de sua estrutura, vocabulário ou escrita.\n" +
          "Identificar relações sociais, hierarquias, alianças e conflitos entre indivíduos ou grupos.\n" +
          "Obter Vantagem em interações sociais que dependam desses conhecimentos, se preparando para coisas como eventos culturais, festivais ou eventos mais formais e ritualisticos."
      },
      3: {
        title: "Interpretar",
        description: "O domínio das Ciências Humanas permite ao aluno interpretar pessoas, culturas e ambientes através da relação entre diferentes informações. Seu conhecimento se torna uma ferramenta para compreender aquilo que não é imediatamente evidente, permitindo avaliar comportamentos, reconhecer influências culturais e interpretar vestígios de sociedades antigas.\n" +
          "\n" +
          "O usuário pode gastar fazer testes para reunir e interpretar as informações reunidas de um indivíduo ou grupo para conseguir novas dicas de suas intenções e próximos passos. Pode também relembrar e relacionar melhor informações de povos e civilizações antigas ou quase esquecidas. Além disso, seu domínio da linguística permite fazer testes para decifrar qualquer língua ou código, novo ou antigo, e reproduzir os mesmos. Com o sucesso pode:\n" +
          "Relacionar características de um lugar, como arquitetura, símbolos, organização, costumes e vestígios, para identificar informações sobre a sociedade que o habita ou habitou.\n" +
          "Avaliar o estado mental de uma pessoa através de seu comportamento, maneira de falar, postura e outras características observáveis, identificando emoções ou alterações comportamentais, além de ser capaz de diagnosticar distúrbios mentais.\n" +
          "Traduzir, com algum tempo de estudo e análise, linguagens antigas ou que não conheça, desde que possua material suficiente para realizar a interpretação.\n" +
          "Reconstruir acontecimentos ou costumes de uma sociedade a partir de vestígios, documentos e informações fragmentadas.\n" +
          "Todas as informações adquiridas podem contribuir com o Domínio do conhecimento Teoria do Jujutsu."
      },
    }
  },
  sobrevivencia: {
    name: "Sobrevivência",
    description: "O estudo das técnicas de subsistência e adaptação em ambientes naturais e urbanos. O aluno aprende a identificar perigos, localizar recursos, construir abrigos, produzir ferramentas improvisadas e compreender o comportamento do ambiente ao seu redor, tornando-se capaz de sobreviver mesmo nas condições mais adversas.",
    levels: {
      1: {
        title: "Subsistir",
        description: "O princípio desse conhecimento é aprender as práticas fundamentais de sobrevivência. O aluno desenvolve noções de orientação, obtenção de recursos e proteção contra os perigos mais comuns de diferentes ambientes.\n" +
          "\n" +
          "O usuário pode realizar testes de INT + PER ou INT + FDV para resgatar e aplicar conhecimentos básicos de sobrevivência como identificação de perigos, coleta de recursos e construção de abrigos. Com sucesso, pode:\n" +
          "Identificar plantas, fungos e alimentos próprios para consumo.\n" +
          "Reconhecer animais perigosos e seus comportamentos básicos.\n" +
          "Acender fogueiras utilizando recursos disponíveis.\n" +
          "Encontrar ou improvisar água potável.\n" +
          "Construir abrigos simples.\n" +
          "Identificar perigos naturais e urbanos antes que se tornem uma ameaça.\n" +
          "Orientar-se utilizando referências naturais, mesmo sem equipamentos."
      },
      2: {
        title: "Adaptar",
        description: "Com maior experiência, o aluno aprende a interpretar o ambiente ao seu redor. Através da observação, passa a reconhecer padrões da fauna, flora, clima e geografia, compreendendo como cada região funciona e como utilizá-la a seu favor.\n" +
          "\n" +
          "O usuário pode realizar testes de INT + PER ou INT + FDV para estudar uma região, identificando suas características naturais, perigos e recursos. Com sucesso, pode:\n" +
          "Identificar mudanças climáticas iminentes através da observação do ambiente.\n" +
          "Adaptar seus métodos de sobrevivência às condições específicas da região, tornando suas ações mais eficientes enquanto permanecer nela. Tendo Vantagem em ações de encontrar recursos ou construir abrigos.\n" +
          "Identificar anormalidades numa região, recebendo dicas caso algo ou alguém a esteja modificando.\n" +
          "Entender como se misturar ou se portar num ambiente, podendo adaptar suas roupas ou aparência para passar despercebido, recebendo Vantagem em Testes de Furtividade ou para apagar seus rastros."
      },
      3: {
        title: "Caçar",
        description: "O domínio da sobrevivência permite ao aluno compreender os padrões deixados por pessoas, animais e pelo próprio ambiente. Mesmo os menores vestígios tornam-se informações valiosas, possibilitando localizar e perseguir um alvo através da interpretação de rastros físicos ou digitais.\n" +
          "\n" +
          "O usuário pode realizar testes de INT + PER ou INT + FDV para rastrear um alvo específico, seja uma pessoa, animal ou outra criatura, em ambientes naturais ou urbanos. O rastreamento pode ser feito através de quaisquer vestígios deixados pelo alvo, como pegadas, marcas, objetos abandonados, sinais de passagem, alterações no ambiente ou até rastros digitais, desde que existam evidências suficientes para serem analisadas.\n" +
          "Após escolher um alvo e obter sucesso, inicia sua perseguição, cabendo ao Mestre definir quanto tempo e testes serão necessários para localizá-lo. Além disso, pode:\n" +
          "Estimar a direção seguida, o tempo desde sua passagem e seu ritmo de deslocamento.\n" +
          "Diferenciar vestígios recentes de antigos e identificar quando um rastro foi alterado ou ocultado.\n" +
          "Antecipar a rota mais provável de um alvo com base no ambiente e em seus padrões de comportamento.\n" +
          "Encontrar atalhos e pontos estratégicos para interceptar um alvo durante a perseguição. Obtendo ou concedendo Vantagem no próximo teste de uma cena de perseguição."
      },
    }
  },
  cienciasExatas: {
    name: "Ciências Exatas",
    description: "O estudo dos princípios que regem o mundo físico e suas aplicações práticas. Esse conhecimento reúne diferentes áreas, incluindo Matemática, Física, Química, Biologia, Metalurgia, Engenharia, Astronomia e Ciências Forenses.\n" +
      "\n" +
      "O aluno que adquire esse conhecimento possui uma ampla base científica, sendo capaz de compreender fenômenos, analisar materiais, realizar cálculos e desenvolver soluções através do método científico.",
    levels: {
      1: {
        title: "Relembrar",
        description: "O princípio desse conhecimento é adquirir e recordar informações estudadas sobre as diferentes áreas das Ciências Exatas. O aluno possui conhecimentos sobre fórmulas, propriedades dos materiais, reações químicas, princípios físicos e demais conceitos científicos, podendo utilizar sua memória para reconhecer informações relevantes.\n" +
          "\n" +
          "O usuário pode fazer testes de INT + FDV para recordar informações específicas sobre um assunto previamente estudado. Também pode fazer testes de INT + PER para identificar materiais, fenômenos ou características físicas de um objeto. Com sucesso, pode:\n" +
          "Recordar fórmulas, leis e conceitos científicos.\n" +
          "Identificar materiais, ligas metálicas, minerais, compostos químicos e organismos conhecidos.\n" +
          "Recordar propriedades físicas e químicas de materiais.\n" +
          "Reconhecer ferramentas, mecanismos e suas funções.\n" +
          "Realizar cálculos matemáticos e estimativas de forma rápida e precisa."
      },
      2: {
        title: "Relacionar",
        description: "Através de estudos mais aprofundados, o aluno passa a compreender como diferentes princípios científicos interagem entre si. Seu conhecimento permite relacionar materiais, fenômenos e evidências para compreender seu funcionamento, suas causas e consequências.\n" +
          "\n" +
          "O usuário pode fazer testes de INT + PER ou INT + FDV para relacionar informações científicas, físicas, químicas ou biológicas durante uma análise. Ao observar um objeto, substância, construção ou fenômeno, pode utilizar seus conhecimentos para compreender seu funcionamento e origem. Com sucesso, pode:\n" +
          "Identificar como diferentes materiais reagem entre si.\n" +
          "Compreender as causas prováveis de um fenômeno físico, químico ou biológico.\n" +
          "Realizar análises forenses através de vestígios físicos, químicos ou biológicos.\n" +
          "Identificar falhas estruturais, desgastes ou defeitos em objetos, mecanismos ou construções.\n" +
          "Calcular medidas, trajetórias, resistência, proporções e outras grandezas necessárias para resolver problemas.\n" +
          "Determinar métodos adequados para fabricar, reparar ou modificar objetos utilizando conhecimentos científicos."
      },
      3: {
        title: "Aplicar",
        description: "O domínio das Ciências Exatas permite ao aluno utilizar seus conhecimentos para reproduzir, desenvolver e aperfeiçoar processos científicos. Seu entendimento deixa de ser apenas teórico, permitindo criar soluções, reconstruir acontecimentos e produzir materiais através do conhecimento adquirido.\n" +
          "\n" +
          "O usuário pode realizar testes para aplicar seus conhecimentos científicos na resolução de problemas complexos, fabricação de objetos ou interpretação de evidências. Também pode reproduzir processos científicos, mesmo sem instruções detalhadas, desde que possua os materiais necessários. Com sucesso, pode:\n" +
          "Fabricar compostos químicos, ligas metálicas e outros materiais compatíveis com seus recursos.\n" +
          "Produzir ferramentas, dispositivos ou mecanismos simples.\n" +
          "Reconstruir acontecimentos através da análise de evidências físicas, químicas ou biológicas.\n" +
          "Determinar a composição, origem e processo de fabricação de um material ou objeto.\n" +
          "Consertar ou improvisar objetos rapidamente.\n" +
          "Produzir ítens complexos com materiais disponíveis e tempo, como bombas por exemplo."
      },
    }
  },
});
