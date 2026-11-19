/** Graus e regras transcritos da ficha Firecast Nexus Maldição. */
const curseOrigin = ({ label, image, description, details, regenerationCost, appearance }) => Object.freeze({
  label,
  image,
  description,
  details,
  hpMultiplier: 75,
  eaMultiplier: 75,
  hasEA: true,
  regenerationCost,
  appearance: Object.freeze({ ...appearance, text: "#ffffff" })
});

export const NEXUS_CURSE_ORIGINS = Object.freeze({
  grau4: curseOrigin({
    label: "🟣 Grau 4",
    image: "systems/nexus-jjk/assets/images/curses/grau4.mp4",
    description: "Manifestação menor de sentimentos negativos humanos. Possui inteligência primitiva e fraqueza física evidente, sendo a categoria mais básica de espíritos amaldiçoados.",
    details: "Maldições de Grau 4 surgem do acúmulo tênue de sentimentos negativos cotidianos. Apresentam formas grotescas, comportamento rasteiro e inteligência quase nula.\n\n• Carne Amaldiçoada: consome 2 EA para recuperar 1 HP.",
    regenerationCost: 2,
    appearance: { accent: "#d9a9f0", frame: "#6a0fac", cardBorder: "#7f20b8", highlight: "#c566ff" }
  }),
  grau3: curseOrigin({
    label: "🔵 Grau 3",
    image: "systems/nexus-jjk/assets/images/curses/grau3.mp4",
    description: "Espírito amaldiçoado intermediário com agressividade acentuada. Costuma assombrar locais específicos onde emoções ruins se acumulam com frequência.",
    details: "Maldições de Grau 3 nascem de focos concentrados de rancor, medo e estresse coletivo. Possuem agressividade violenta e força física suficiente para ferir gravemente.\n\n• Carne Amaldiçoada: consome 2 EA para recuperar 1 HP.",
    regenerationCost: 2,
    appearance: { accent: "#a8d2ff", frame: "#1769c2", cardBorder: "#2e8bea", highlight: "#62b0ff" }
  }),
  grau2: curseOrigin({
    label: "🟢 Grau 2",
    image: "systems/nexus-jjk/assets/images/curses/grau2.mp4",
    description: "Maldição perigosa e resistente, capaz de manifestar técnicas amaldiçoadas rudimentares e agir com astúcia tática em embates.",
    details: "Maldições de Grau 2 exibem força, resistência e técnicas amaldiçoadas perigosas. Demonstram astúcia tática e instintos predatórios desenvolvidos.\n\n• Carne Amaldiçoada: consome 1 EA para recuperar 1 HP.",
    regenerationCost: 1,
    appearance: { accent: "#9ce5b6", frame: "#159447", cardBorder: "#27bd63", highlight: "#4dde83" }
  }),
  grau1: curseOrigin({
    label: "🟡 Grau 1",
    image: "systems/nexus-jjk/assets/images/curses/grau1.mp4",
    description: "Ameaça letal com intelecto desenvolvido, capaz de fala articulada e técnicas amaldiçoadas sofisticadas, exigindo feiticeiros de elite para exorcismo.",
    details: "Maldições de Grau 1 representam ameaças letais. Possuem intelecto aguçado, fala articulada, estratégias de combate e técnicas inatas poderosas.\n\n• Carne Amaldiçoada Aprimorada: consome 1 EA para recuperar 1 HP.",
    regenerationCost: 1,
    appearance: { accent: "#ffe49a", frame: "#c08a00", cardBorder: "#e0ad26", highlight: "#ffd65c" }
  }),
  especial: curseOrigin({
    label: "🔴 Grau Especial",
    image: "systems/nexus-jjk/assets/images/curses/especial.mp4",
    description: "Catástrofe viva de poder incomensurável. Possui intelecto avançado, domínio técnico absoluto e potencial para aniquilar legiões inteiras de feiticeiros.",
    details: "Maldições de Grau Especial são anomalias devastadoras no ápice do mundo jujutsu. Possuem reservas avassaladoras, intelecto elevado e domínio técnico absoluto.\n\n• Carne Amaldiçoada Suprema: consome 1 EA para recuperar 1 HP.",
    regenerationCost: 1,
    appearance: { accent: "#ffabb3", frame: "#b71c2b", cardBorder: "#db3f4d", highlight: "#ff6775" }
  })
});

export function getCurseOrigin(key) {
  return Object.hasOwn(NEXUS_CURSE_ORIGINS, key) ? NEXUS_CURSE_ORIGINS[key] : NEXUS_CURSE_ORIGINS.grau4;
}
