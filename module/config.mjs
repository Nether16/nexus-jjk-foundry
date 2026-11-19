export const NEXUS_MAX_LEVEL = 20;

export function getAttributeMax(level) {
  const value = Number(level);
  const characterLevel = Number.isFinite(value)
    ? Math.min(NEXUS_MAX_LEVEL, Math.max(1, Math.trunc(value)))
    : 1;
  return 5 + (2 * (characterLevel - 1));
}

export function getXpTarget(level) {
  if (level <= 4) return 100;
  if (level <= 9) return 150;
  if (level <= 14) return 250;
  return 500;
}

export const NEXUS_ATTRIBUTES = Object.freeze({
  forca: { label: "FOR", name: "Força" },
  destreza: { label: "DES", name: "Destreza" },
  agilidade: { label: "AGI", name: "Agilidade" },
  vigor: { label: "CON", name: "Vigor" },
  percepcao: { label: "PER", name: "Percepção" },
  inteligencia: { label: "INT", name: "Inteligência" },
  jujutsu: { label: "JJT", name: "Jujutsu" },
  fdv: { label: "FDV", name: "Força de Vontade" }
});

export const NEXUS_ORIGINS = Object.freeze({
  feiticeiro: {
    label: "Feiticeiro Inato",
    hpMultiplier: 50,
    eaMultiplier: 50,
    hasEA: true,
    image: "https://images-ext-1.discordapp.net/external/BVmVTCSUT86e28d0XXcQ9ki6D8A2-faBPgB5n-uPVKk/https/i.pinimg.com/originals/b9/9e/1e/b99e1e309aa8b9356f06de6992968835.gif",
    description: "Feiticeiros Inatos são indivíduos capazes de manipular Energia Amaldiçoada e que nasceram com uma Técnica Inata, uma habilidade única gravada em sua alma desde o nascimento.",
    details: "Ao escolher esse caminho, o jogador desenvolverá uma técnica inata juntamente com o mestre sistematizador e, ao longo de sua jornada de desenvolvimento, receberá extensões de técnica para ampliar seus efeitos de habilidade."
  },
  sombras: {
    label: "Estilo das Sombras",
    hpMultiplier: 50,
    eaMultiplier: 50,
    hasEA: true,
    image: "https://images-ext-1.discordapp.net/external/lT1_iEtb_qoAPvq1GFOEhmf_zXqpOfnsldEqnNuBuOA/https/static.klipy.com/ii/4493325008d34b7bf8cd6813cd5c1619/f5/1c/5Unu5IMoMVqeIe7Iz2zY.mp4",
    description: "Os discípulos do Estilo das Sombras são indivíduos que não possuem Técnica Inata, porém tiveram a oportunidade de aprender um estilo de combate único.",
    details: "Ao escolher esse caminho, o jogador possui conhecimento das técnicas do " +
      "Estilo das Sombras, utilizando em combate variantes desses ensinamentos. Ao longo " +
      "de sua jornada, desenvolve variantes únicas desse estilo ao receber extensões de técnica."
  },
  reverso: {
    label: "Naturalmente Reverso",
    hpMultiplier: 50,
    eaMultiplier: 50,
    hasEA: true,
    image: "https://images-ext-1.discordapp.net/external/t00Hk-dXdrTHJ0AcPMcBFjZVEpssH7NguOOZWEEgP64/https/static.klipy.com/ii/4493325008d34b7bf8cd6813cd5c1619/9c/f9/wg1yNwpXeRhpfI.mp4",
    description: "Por razões desconhecidas, apesar de não possuir Técnica Inata, em suas primeiras interações com a Energia Amaldiçoada conseguiu manipular a Energia Amaldiçoada Reversa.",
    details: "Ao escolher esse caminho, o jogador é capaz de manipular a Energia Amaldiçoada " +
      "Reversa (EAR) desde o início de sua jornada, mesmo sem compreender sua origem. Ao longo " +
      "de seu desenvolvimento, receberá maior eficiência no uso externo da EAR, reduzindo seu " +
      "custo de ativação e tornando-se um excelente suporte contra maldições."
  },
  hibrido: {
    label: "Hibrido 🔒",
    hpMultiplier: 50,
    eaMultiplier: 50,
    hasEA: true,
    image: "https://images-ext-1.discordapp.net/external/tvah82Bv9VNG0i7nVvro4XAjCvVJNyHA7LIdTDaAgDc/https/c.tenor.com/OLTNCuWTuM0AAAAC/tenor.gif",
    description: "Você é fruto da união entre dois mundos que jamais deveriam coexistir. Em seu corpo corre tanto o sangue de um ser humano quanto a essência de uma maldição, tornando-o uma existência única.",
    details: "Ao escolher esta origem, o jogador é fruto da união entre humano e maldição. " +
      "Embora os Úteros Amaldiçoados sejam os mais conhecidos, híbridos também podem surgir " +
      "de rituais proibidos, experimentos ou possessões incompletas.\n\nBenefício: recebe uma " +
      "marca de maldição visível, pode converter 2 EA em 1 HP e possui sangue amaldiçoado."
  },
  amaldicoado: {
    label: "Amaldiçoado 🔒",
    hpMultiplier: 50,
    eaMultiplier: 50,
    hasEA: true,
    image: "https://images-ext-1.discordapp.net/external/NuD4kYiIg5Jie7aeof3CuaDm1-0dGBWJzjjBOLaaq_Y/https/c.tenor.com/QvVggl8ExYQAAAAC/tenor.gif",
    description: "Você foi marcado por uma maldição que jamais o abandonou. Sua existência passou a estar permanentemente ligada a um espírito de grau indefinido.",
    details: "Ao escolher esta origem, o jogador não recebe uma Técnica Inata e passa a ser " +
      "acompanhado por uma Maldição Vinculada de grau indefinido. Ao libertá-la, poderá se tornar " +
      "um excelente Mestre de Shikigami ou se empoderar da técnica da antiga maldição."
  },
  restringidoFisico: {
    label: "Restringido: Fisico 🔒",
    hpMultiplier: 75,
    eaMultiplier: 0,
    hasEA: false,
    image: "https://images-ext-1.discordapp.net/external/Vg5T_6SsAHzyLTZauYOHl5es6hGxxxb2klulOCB8JHI/https/c.tenor.com/vPFUk2ZALWYAAAAd/tenor.gif",
    description: "Você foi marcado por uma Restrição Celestial que suprimiu completamente a sua Energia Amaldiçoada, mas, em troca, seu corpo ultrapassou os limites humanos.",
    details: "Ao escolher esta origem, o jogador nasce com uma Restrição Celestial que suprime " +
      "completamente sua Energia Amaldiçoada. Em troca, seu corpo ultrapassa os limites humanos. " +
      "Todos os pontos que normalmente seriam recebidos em EA passam a ser convertidos em HP.",
    alts: {
      tanqueDeGuerra: {
        label: "Tanque de Guerra",
        details: "+125 HP inicial e +25 HP por nível. " +
          "A partir do nível 10, recebe 10% de mitigação de dano.",

        bonuses: {
          hpInitial: 125,
          hpMultiplier: 100,
        }
      },

      aberracaoEmCombate: {
        label: "Aberração em Combate",
        details: "Recebe Multi-Ataque, permitindo um ataque adicional. " +
          "A partir do nível 10, pode realizar um terceiro ataque.",
      },

      ambidestro: {
        label: "Ambidestro",
        details: "Pode atacar utilizando duas armas. Ao acertar, " +
          "o dano da arma é dobrado e se torna irredutível. " +
          "A partir do nível 10, recebe 10% de aumento de dano.",

        bonuses: {
          dualWield: true,
        }
      }
    }
  },
  restringidoFeiticaria: {
    label: "Restringido: Feitiçaria 🔒",
    hpMultiplier: 25,
    eaMultiplier: 75,
    hasEA: true,
    image: "https://images-ext-1.discordapp.net/external/BRKKPYkydViufl6mWx9GLJBsMcv09C2IKiK8akQcSSY/https/c.tenor.com/EF9U_yS2yEkAAAAd/tenor.gif",
    description: "Você foi marcado por uma Restrição Celestial que sacrificou o potencial do seu corpo em troca de uma afinidade excepcional com a Energia Amaldiçoada.",
    details: "Ao escolher esta origem, o jogador nasce com uma Restrição Celestial que sacrificou o potencial de seu corpo em troca de uma afinidade excepcional com a Energia Amaldiçoada. Em vez de +50 HP e +50 EA por nível, recebe +25 HP e +75 EA."
  },
  receptaculo: {
    label: "Receptaculo 🔒",
    hpMultiplier: 50,
    eaMultiplier: 50,
    hasEA: true,
    image: "https://images-ext-1.discordapp.net/external/tueRwX4_mbQmJEAFBv2sxyiSOFR9_9nFflR0IdA9gBA/https/c.tenor.com/OtY-XfjaznUAAAAC/tenor.gif",
    description: "Seu corpo abriga a alma de um feiticeiro encarnado. Você conseguiu preservar sua própria identidade e estabelecer uma convivência com a entidade que habita seu corpo.",
    details: "Ao escolher esta origem, o jogador torna-se um receptáculo de um feiticeiro encarnado, preservando sua identidade. Devido ao fenômeno de Duas Almas Coexistentes, apenas uma Técnica Inata pode prevalecer: a do feiticeiro encarnado."
  }
});

export const NEXUS_TALENTS = Object.freeze([
  {
    name: "Escolhido pelas Faíscas 🔒",
    locked: true,
    image: "https://images-ext-1.discordapp.net/external/idCj-CpUfGQvV8XHkbNqbcRb8cZYCHU-yJU8PUHMZWY/https/static2.klipy.com/ii/4493325008d34b7bf8cd6813cd5c1619/1f/c6/MBKHjHVCLDGM4E.gif",
    description: "Sempre que conseguir um Acerto Crítico em um ataque realizado com Reforço Amaldiçoado, o golpe desencadeia um Kokusen automaticamente."
  },
  {
    name: "Mestres de Shikigami 🔒",
    locked: true,
    image: "https://images-ext-1.discordapp.net/external/6X58CkS7UHB-GEzQ8KXlqlTRT3jkuko40uFYk7FUuyc/https/static2.klipy.com/ii/e293a233a303a98e471f78d04e13a1b0/9c/ff/dVkYJkJK.gif",
    description: "Os Shikigamis sob seu controle causam 30% a mais de dano e recebem um aprimoramento de 10% em todos os seus efeitos."
  },
  {
    name: "Grande Controle de Energia 🔒",
    locked: true,
    image: "https://images-ext-1.discordapp.net/external/phYEzGSgIZThbvHMmxV9b9X0wXrDMic0TTGhvqLT5bE/https/static2.klipy.com/ii/4493325008d34b7bf8cd6813cd5c1619/84/af/FM47ebSaj2nsM2fj2W.gif",
    description: "O personagem recebe um desconto de 30% no custo de Energia Amaldiçoada em todas as habilidades, técnicas e efeitos."
  },
  {
    name: "Energia Única 🔒",
    locked: true,
    image: "https://images-ext-1.discordapp.net/external/1GZfeStYMlG-9Is2BfwwVWrXoWj308RoKxit6rLnQV8/https/static2.klipy.com/ii/4493325008d34b7bf8cd6813cd5c1619/28/35/K3P1ybtytyf2t.gif",
    description: "Sua Energia Amaldiçoada possui uma característica singular, tornando-se uma extensão da identidade do personagem."
  },
  {
    name: "Alma Perseverante 🔒",
    locked: true,
    image: "https://images-ext-1.discordapp.net/external/Td5zaTTE2EEq6luT7mTpe0b_-lnjefD3Wh_wmAFCqdc/https/static2.klipy.com/ii/4493325008d34b7bf8cd6813cd5c1619/69/5e/GJ0tNPx8Q2rusQS.gif",
    description: "Uma vez por combate, quando entraria na condição Caído pela primeira vez, você pode permanecer com 1 Ponto de Vida."
  },
  {
    name: "Sob Medida 🔒",
    locked: true,
    image: "https://images-ext-1.discordapp.net/external/HZFy7cKoc3UpWOox_77ACjksmVuVjzbkPvIKFJ31nzQ/https/static2.klipy.com/ii/4493325008d34b7bf8cd6813cd5c1619/ab/27/zrLwT8R00Tae1QLLxbTF.gif",
    description: "Ao utilizar armamentos, seus ataques passam a utilizar o dano correspondente a um grau acima do grau original da arma. No Grau Especial, a arma recebe uma segunda habilidade própria, definida pelo mestre."
  },
  {
    name: "Grande Liberação de Energia 🔒",
    locked: true,
    image: "https://images-ext-1.discordapp.net/external/AY6ySi3BE7haMjJWv6p9RmVdOCkkXyfYBSQSKPncB40/https/static2.klipy.com/ii/4493325008d34b7bf8cd6813cd5c1619/c0/07/7qxKfzIXJijRUlNgu0.gif",
    description: "Ao realizar um ataque, você pode investir Energia Amaldiçoada para aumentar seu dano na proporção de 1 para 1."
  },
  {
    name: "Especialista em Técnicas de Barreira 🔒",
    locked: true,
    image: "https://images-ext-1.discordapp.net/external/v9M_DbUjHIYDHIzHkPKiBKj9-GPrwn4dbs1GxPiE7cE/https/c.tenor.com/HvgKNijieJ4AAAAd/tenor.gif",
    description: "Ao utilizar uma Técnica de Barreira, recebe +50% em sua Perícia Ocultista e reduz em 30% o custo de Energia Amaldiçoada."
  },
  {
    name: "Arma Afiliada 🔒",
    locked: true,
    image: "https://images-ext-1.discordapp.net/external/rq8mHO_qOh5nl6u9G1EnSuWnOj8RSSHXMuuvlzt4qh4/https/static2.klipy.com/ii/4493325008d34b7bf8cd6813cd5c1619/99/c5/tlaDLiRYZNldiWlYu.gif",
    description: "Você inicia a campanha com uma arma de Grau IV. Marque Arma afiliada no inventário para receber +15 de dano nos níveis 5, 10, 15 e 20."
  },
  {
    name: "Perícia em Controle de Energia",
    locked: false,
    image: "https://images-ext-1.discordapp.net/external/Ob0i616hQvWldumTPBJrw0HKgGv6uByvsxWwbIo9XIA/https/c.tenor.com/XUiSuVmjE_oAAAAC/tenor.gif",
    description: "Reduz em 15% o custo de Energia Amaldiçoada de todas as técnicas e habilidades utilizadas."
  },
  {
    name: "Perícia em Artefatos Amaldiçoados",
    locked: false,
    image: "https://images-ext-1.discordapp.net/external/GTY4txmZXaWOy3-RN4JMC05Xi1ua7xPaanhEOY7zoOQ/https/c.tenor.com/5vskOaGTsN4AAAAd/tenor.gif",
    description: "Ferramentas Amaldiçoadas causam +25% de dano base e Objetos Amaldiçoados possuem +25% de eficiência."
  },
  {
    name: "Perícia em Barreiras",
    locked: false,
    image: "https://images-ext-1.discordapp.net/external/UWPFXm5Ci9sfH_6ne5Vl5JbLAgeg2GKDofrX9EtPynk/https/c.tenor.com/1ig2msEAF_MAAAAd/tenor.gif",
    description: "Recebe +25% de Perícia Amaldiçoada em testes relacionados a Técnicas de Barreira."
  },
  {
    name: "Perícia em Votos Vinculativos",
    locked: false,
    image: "https://images-ext-1.discordapp.net/external/fiPtgBaHsJOW2clAov3Es-jxjmwZmDL49qPgG119NX8/https/c.tenor.com/lLLvFoqOLf8AAAAC/tenor.gif",
    description: "Desbloqueia a capacidade de criar e utilizar Votos Vinculativos."
  },
  {
    name: "Reserva de Energia Amaldiçoada",
    locked: false,
    eaPerLevel: 10,
    image: "https://images-ext-1.discordapp.net/external/cZFu6XbY84IvbyhAXbkIeMkyBsQxXtgGghaDsRr7vz4/https/c.tenor.com/OQaO8JLeldIAAAAd/tenor.gif",
    description: "Recebe +10 de Energia Amaldiçoada por nível. O bônus é retroativo e acompanha toda a progressão do personagem."
  },
  {
    name: "Perícia em Ritos Ocultistas",
    locked: false,
    image: "https://images-ext-1.discordapp.net/external/EJFMYaV8wnc32HzPppcEjq-X9Gv9oRkwfUOr5_frsY0/https/c.tenor.com/Sns2XuBGyswAAAAC/tenor.gif",
    description: "Desbloqueia a capacidade de aprender e realizar Ritos Ocultistas."
  },
  {
    name: "Perícia em Ferraria Amaldiçoada",
    locked: false,
    image: "https://images-ext-1.discordapp.net/external/H_Cfs7lavoky6pfR7wWd7JsfK-7yN1WUljP9-TCQz-o/https/c.tenor.com/MF5kzY4UdxkAAAAd/tenor.gif",
    description: "Desbloqueia a capacidade de criar, modificar e reparar Ferramentas e Objetos Amaldiçoados."
  },
  {
    name: "Perícia em Reversão",
    locked: false,
    image: "https://images-ext-1.discordapp.net/external/4Zt8joc0O3k28cvf9EXdAla7mEjNSPVsZotEf6ifjRQ/https/c.tenor.com/VH3loefMFgwAAAAC/tenor.gif",
    description: "Desbloqueia a mecânica de Energia Amaldiçoada Reversa e a criação de uma Reversão de Feitiço. Pré-requisito: Nível 10."
  }
]);

export const NEXUS_ITEM_LABELS = Object.freeze({
  attack: "Novo Golpe",
  talent: "Novo Talento",
  technique: "Nova Técnica",
  knowledge: "Novo Conhecimento",
  equipment: "Novo Item"
});
