import { getShikigamiInvoker } from "./shikigami.mjs";

const ATTRIBUTE_ALIASES = Object.freeze({
  for: "attributes.forca",
  forca: "attributes.forca",
  força: "attributes.forca",
  des: "attributes.destreza",
  dex: "attributes.destreza",
  destreza: "attributes.destreza",
  agi: "attributes.agilidade",
  agilidade: "attributes.agilidade",
  con: "attributes.vigor",
  cons: "attributes.vigor",
  vig: "attributes.vigor",
  vigor: "attributes.vigor",
  per: "attributes.percepcao",
  percepcao: "attributes.percepcao",
  percepção: "attributes.percepcao",
  int: "attributes.inteligencia",
  inteligencia: "attributes.inteligencia",
  inteligência: "attributes.inteligencia",
  jjt: "attributes.jujutsu",
  jujutsu: "attributes.jujutsu",
  fdv: "attributes.fdv",
  nivel: "level",
  nível: "level",
  hp: "hp.value",
  hpatual: "hp.value",
  hpmax: "hp.max",
  ea: "ea.value",
  eaatual: "ea.value",
  eamax: "ea.max",
  ca: "defense",
  esquiva: "defense"
});

const MATH_WORDS = new Set([
  "abs",
  "ceil",
  "floor",
  "max",
  "min",
  "pow",
  "round",
  "sqrt"
]);

function normalizeKey(value) {
  return String(value ?? "").trim().toLocaleLowerCase("pt-BR");
}

function escapeHTML(value) {
  const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(value ?? "").replace(/[&<>"']/gu, character => entities[character]);
}

function trim(value) {
  return String(value ?? "").trim();
}

function isDiceFormula(formula) {
  return /\d+\s*d\s*\d+/iu.test(formula);
}

function splitModules(content) {
  const source = String(content ?? "");
  const modules = [];
  let start = 0;
  let quoted = false;
  let escaped = false;

  const push = end => {
    const value = source.slice(start, end).trim();
    if (value) modules.push(value);
  };

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"' && !escaped) quoted = !quoted;

    const rest = source.slice(index + 1);
    const slashBeforeLabel = character === "/" &&
      /^\s*[\p{L}_][\p{L}\p{N}_\s-]*:\s*/u.test(rest);
    const separator = !quoted && (character === "|" || slashBeforeLabel);

    if (separator) {
      push(index);
      start = index + 1;
    }

    escaped = character === "\\" && !escaped;
  }

  push(source.length);
  return modules;
}

function splitLabel(module) {
  const match = module.match(/^(.*?:\s*)(.+)$/u);
  if (!match) return { label: "", expression: trim(module) };
  return { label: match[1], expression: trim(match[2]) };
}

function literalText(expression) {
  const match = trim(expression).match(/^"([\s\S]*)"$/u);
  if (!match) return null;
  return match[1].replace(/\\"/gu, '"').replace(/\\\\/gu, "\\");
}

function getKnownValue(actor, name) {
  const key = normalizeKey(name).replace(/\s+/gu, "");
  if (["arma_acerto", "armaacerto", "acerto_arma", "acertoarma"].includes(key)) {
    const accuracy = Number(actor.weaponAccuracy);
    return Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : 0;
  }
  if (["arma", "danoarma", "dano_arma"].includes(key)) {
    const damage = Number(actor.weaponDamage);
    return Number.isFinite(damage) && damage >= 0 ? damage : 0;
  }
  const path = ATTRIBUTE_ALIASES[key];
  if (path) return Number(foundry.utils.getProperty(actor.system, path)) || 0;

  const direct = foundry.utils.getProperty(actor.system, name);
  if (Number.isFinite(Number(direct))) return Number(direct);
  return null;
}

function identifiers(expression) {
  return [...String(expression).matchAll(/[\p{L}_][\p{L}\p{N}_]*/gu)]
    .map(match => match[0]);
}

function collectUnknownVariables(actor, attack, effect, cost = "") {
  const unknown = new Map();
  const contents = [attack, cost, ...splitModules(effect).map(module => splitLabel(module).expression)];

  for (const original of contents) {
    if (!original || literalText(original) !== null) continue;
    if (!/[+\-*/^()]|\d+\s*d\s*\d+|@\{/iu.test(original)) continue;

    let expression = original.replace(/".*?"/gu, "");
    expression = expression.replace(/@\{([^}]+)\}/gu, (_match, name) => {
      const key = normalizeKey(name);
      if (getKnownValue(actor, name) === null && !unknown.has(key)) unknown.set(key, name.trim());
      return "";
    });

    for (const name of identifiers(expression)) {
      const key = normalizeKey(name);
      if (/^d\d+$/iu.test(name) || key === "x" || MATH_WORDS.has(key)) continue;
      if (getKnownValue(actor, name) === null && !unknown.has(key)) unknown.set(key, name);
    }
  }

  return [...unknown.values()];
}

async function promptVariables(actor, item) {
  const { attack, effect, cost } = item.system;
  const variables = collectUnknownVariables(actor, attack, effect, cost);
  const values = new Map();

  for (const variable of variables) {
    const field = await foundry.applications.api.DialogV2.input({
      window: { title: item.name || "Golpe" },
      content: `<label>Informe o valor de <strong>${escapeHTML(variable)}</strong>:</label>` +
        '<input name="value" type="number" step="any" value="0" autofocus>',
      ok: { label: "Continuar" },
      rejectClose: false,
      modal: true
    });

    if (!field) return null;
    const value = Number(field.value);
    if (!Number.isFinite(value)) {
      ui.notifications.error(`Valor inválido para ${variable}.`);
      return null;
    }
    values.set(normalizeKey(variable), value);
  }

  return values;
}

function normalizeDecimalSeparators(formula) {
  const groups = [];
  let result = "";
  for (const character of String(formula ?? "")) {
    if (character === "(") {
      const name = result.match(/([\p{L}_][\p{L}\p{N}_]*)\s*$/u)?.[1];
      groups.push(["min", "max", "pow"].includes(normalizeKey(name)));
    } else if (character === ")") groups.pop();
    // Só funções de vários argumentos usam a vírgula como separador.
    result += character === "," && !groups.at(-1) ? "." : character;
  }
  return result;
}

function resolveFormula(actor, formula, extraValues) {
  let result = normalizeDecimalSeparators(formula)
    .replace(/×/gu, "*")
    .replace(/\s+[xX]\s+/gu, " * ")
    .replace(/\*\*/gu, "^");

  result = result.replace(/@\{([^}]+)\}/gu, (_match, name) => {
    const extra = extraValues.get(normalizeKey(name));
    if (extra !== undefined) return String(extra);
    const known = getKnownValue(actor, name);
    return known === null ? name : String(known);
  });

  return result.replace(/[\p{L}_][\p{L}\p{N}_]*/gu, name => {
    if (/^d\d+$/iu.test(name) || MATH_WORDS.has(normalizeKey(name))) return name;
    const extra = extraValues.get(normalizeKey(name));
    if (extra !== undefined) return String(extra);
    const known = getKnownValue(actor, name);
    return known === null ? name : String(known);
  });
}

function evaluateNumeric(expression) {
  if (isDiceFormula(expression)) return null;
  try {
    const result = Roll.safeEval(expression.replace(/\^/gu, "**"));
    return Number.isFinite(result) ? result : null;
  } catch (_error) {
    return null;
  }
}

function prepareDiceFormula(formula) {
  let result = trim(formula);
  let previous;

  do {
    previous = result;
    result = result.replace(/\(([^()]*)\)/gu, (whole, inner, offset, source) => {
      // Os parênteses de uma função precisam continuar ligados ao seu nome.
      if (/[\p{L}_][\p{L}\p{N}_]*\s*$/u.test(source.slice(0, offset))) return whole;
      if (isDiceFormula(inner)) return whole;
      const value = evaluateNumeric(inner);
      return value === null ? whole : String(value);
    });
  } while (result !== previous);

  const power = /(-?\d+(?:\.\d+)?)\s*\^\s*(-?\d+(?:\.\d+)?)/u;
  while (power.test(result)) {
    result = result.replace(power, (_whole, base, exponent) => String(Number(base) ** Number(exponent)));
  }

  return result;
}

function movementImage(source) {
  if (!source) return "";

  try {
    const url = new URL(source, document.baseURI);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    if (/\/(?:d20Icon\.png|icons\/svg\/(?:image|item-bag)\.svg)$/iu.test(url.pathname)) return "";
    return `<img class="nexus-chat-media" src="${escapeHTML(source)}" alt="">`;
  } catch (_error) {
    return "";
  }
}

function movementSection(label, html, className = "") {
  const heading = label ? `<strong class="nexus-chat-label">${escapeHTML(label)}</strong> ` : "";
  const classes = className ? `nexus-chat-section ${className}` : "nexus-chat-section";
  return `<div class="${classes}">${heading}<div class="nexus-chat-value">${html}</div></div>`;
}

async function renderMovementRoll(roll) {
  const context = await roll._prepareChatRenderContext({});
  // As rolagens deste motor sempre recebem um floor externo automático.
  if (context.formula.startsWith("floor(") && context.formula.endsWith(")")) {
    context.formula = context.formula.slice(6, -1);
  }
  return foundry.applications.handlebars.renderTemplate(roll.constructor.CHAT_TEMPLATE, context);
}

function checkAvailableEA(actor, cost) {
  const available = Number(actor.system.ea.value) || 0;
  if (cost <= available) return available;

  ui.notifications.warn(`Você não tem EA suficiente. O golpe custa ${cost} EA e você tem ${available} EA.`);
  return null;
}

function validateEAPayer(actor, payer) {
  if (actor.type === "shikigami") {
    if (!payer) throw new Error("Vincule um personagem como invocador do Shikigami para gastar EA.");
    if (getShikigamiInvoker(actor) !== payer) {
      throw new Error("O invocador do Shikigami foi alterado ou não está mais disponível. Use o movimento novamente.");
    }
  }
  if (!actor.isOwner) throw new Error("Você precisa poder editar a ficha para usar este movimento.");
  if (!payer.isOwner) throw new Error("Você precisa poder editar o invocador para gastar a EA dele.");
}

export class NexusFormulaEngine {
  static async rollItem(actor, item) {
    const payer = actor.type === "shikigami" ? getShikigamiInvoker(actor) : actor;
    const values = await promptVariables(actor, item);
    if (values === null) return;

    const attack = trim(item.system.attack);
    const cost = trim(item.system.cost);
    const effect = trim(item.system.effect);
    const image = movementImage(item.img);
    if (!attack && !cost && !effect && !image) {
      ui.notifications.warn("Preencha a rolagem, o custo, o efeito ou a imagem do golpe.");
      return;
    }

    const messageMode = game.settings.get("core", "messageMode");
    const rows = [];
    const rolls = [];
    const resolve = formula => resolveFormula(actor, formula, values);
    const evaluateRoll = async (formula, label) => {
      try {
        const roll = await new Roll(`floor(${prepareDiceFormula(formula)})`).evaluate({
          allowInteractive: messageMode !== "blind"
        });
        if (!Number.isFinite(roll.total)) throw new Error("Resultado não numérico");
        return roll;
      } catch (_error) {
        throw new Error(`Fórmula inválida em ${label}: ${formula}`);
      }
    };

    let amount = 0;
    let previousEA;
    let spentEA = false;
    try {
      // Resolve o custo antes de rolar o ataque e os efeitos.
      let costRoll;
      if (cost) {
        const formula = resolve(cost);
        if (isDiceFormula(formula)) {
          costRoll = await evaluateRoll(formula, "Custo");
          amount = costRoll.total;
        } else {
          const value = evaluateNumeric(formula);
          amount = value === null ? null : Math.floor(value);
        }
        if (!Number.isInteger(amount) || amount < 0) {
          throw new Error("O custo do golpe precisa resultar em um número inteiro de EA, igual ou maior que zero.");
        }
        if (amount > 0) {
          validateEAPayer(actor, payer);
          if (checkAvailableEA(payer, amount) === null) return;
        }
      }

      if (attack) {
        const roll = await evaluateRoll(resolve(attack), "Rolagem");
        rolls.push(roll);
        rows.push(movementSection("Rolagem", await renderMovementRoll(roll)));
      }
      if (cost) {
        if (costRoll) rolls.push(costRoll);
        const html = costRoll ? await renderMovementRoll(costRoll) : escapeHTML(`${amount} EA`);
        rows.push(movementSection("Custo em EA", html, "nexus-chat-cost"));
      }
      for (const module of splitModules(effect)) {
        const { label, expression } = splitLabel(module);
        const title = label.trim() || "Efeito";
        const literal = literalText(expression);
        if (literal !== null) {
          rows.push(movementSection(title, escapeHTML(literal)));
          continue;
        }

        const formula = resolve(expression);
        if (isDiceFormula(formula)) {
          const roll = await evaluateRoll(formula, title);
          rolls.push(roll);
          rows.push(movementSection(title, await renderMovementRoll(roll)));
          continue;
        }

        const value = evaluateNumeric(formula);
        if (value === null && /[+*\/^()%-]/u.test(expression) && /^[\d\s.+*\/^()%-]+$/u.test(formula)) {
          throw new Error(`Fórmula inválida em ${title} ${formula}`);
        }
        rows.push(movementSection(title, escapeHTML(value === null ? expression : Math.floor(value))));
      }

      if (amount > 0) {
        validateEAPayer(actor, payer);
        previousEA = checkAvailableEA(payer, amount);
        if (previousEA === null) return;
        const updated = await payer.update({ "system.ea.value": previousEA - amount });
        if (!updated) throw new Error("Não foi possível atualizar a EA do personagem.");
        spentEA = true;
      }

      const message = await ChatMessage.create({
        author: game.user.id,
        speaker: ChatMessage.getSpeaker({ actor }),
        rolls: rolls.map(roll => JSON.stringify(roll)),
        content: `<section class="nexus-chat-card"><strong class="nexus-chat-title">${escapeHTML(item.name)}</strong>${image}${rows.join("")}</section>`
      }, { messageMode });
      if (!message) throw new Error("Não foi possível publicar o golpe no chat.");
      return message;
    } catch (error) {
      if (spentEA && Number(payer.system.ea.value) === previousEA - amount) {
        try {
          await payer.update({ "system.ea.value": previousEA });
        } catch (restoreError) {
          console.error("Nexus JJK | Erro ao restaurar EA", restoreError);
          ui.notifications.error("Não foi possível devolver a EA após a falha ao publicar o golpe.");
        }
      }
      ui.notifications.error(error.message);
    }
  }
}

export {
  collectUnknownVariables,
  evaluateNumeric,
  literalText,
  prepareDiceFormula,
  resolveFormula,
  splitLabel,
  splitModules
};
