import { calculateCriticalDamage, hasMovementDamage, readMovementEffects } from "./critical-damage.mjs";
import { clearKokusenVisuals, decorateKokusenVisuals } from "./kokusen-visuals.mjs";

const NAMESPACE = "nexus-jjk";
const FLAG = "criticalEffect";
const offering = new Set();
const choosing = new Set();
const kokusenLayer = () => '<span class="nexus-kokusen-fx" aria-hidden="true"></span>';

function escapeHTML(value) {
  const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(value ?? "").replace(/[&<>"']/gu, character => entities[character]);
}

function stateOf(message) {
  return message?.getFlag?.(NAMESPACE, FLAG) ?? message?.flags?.[NAMESPACE]?.[FLAG];
}

function authorId(message) {
  return message?.author?.id ?? message?.author;
}

function messageKey(message) {
  return message?.uuid ?? message?.id;
}

function messageValues() {
  const messages = globalThis.game?.messages;
  return messages?.contents ?? messages?.values?.() ?? messages ?? [];
}

function diceOf(roll) {
  if (typeof roll === "string") {
    try { roll = JSON.parse(roll); } catch { return []; }
  }
  if (!roll || typeof roll !== "object") return [];
  if (Array.isArray(roll.dice) && roll.dice.length) return roll.dice;
  const dice = [];
  const visit = term => {
    if (!term || typeof term !== "object") return;
    if (Number(term.faces) > 0 && Array.isArray(term.results)) dice.push(term);
    for (const key of ["terms", "rolls"]) {
      for (const child of Array.isArray(term[key]) ? term[key] : []) visit(child);
    }
    if (term.term) visit(term.term);
    if (term.roll) visit(term.roll);
  };
  visit(roll);
  return dice;
}

/** Tests the natural, kept d20 result, independently of modifiers and the roll total. */
export function hasCriticalD20(message) {
  if (stateOf(message)) return false;
  const rolls = message?.rolls ?? [];
  const indexes = message?.getFlag?.(NAMESPACE, "criticalRollIndexes") ??
    message?.flags?.[NAMESPACE]?.criticalRollIndexes;
  const candidates = Array.isArray(indexes)
    ? indexes.filter(index => Number.isInteger(index) && index >= 0).map(index => rolls[index])
    : rolls;
  return candidates.some(roll => diceOf(roll).some(die => Number(die.faces) === 20 &&
    die.results.some(result => Number(result.result) === 20 && result.active !== false &&
      !result.discarded && !result.rerolled)));
}

function visibilityOf(message) {
  return {
    whisper: Array.from(message.whisper ?? [], user => user?.id ?? user),
    blind: message.blind === true
  };
}

function button(action, text) {
  if (["kokusen", "sparks"].includes(action)) {
    return `<button type="button" data-nexus-critical-action="${action}" class="nexus-kokusen-trigger">` +
      kokusenLayer() + `<span class="nexus-kokusen-label">${escapeHTML(text)}</span></button>`;
  }
  return `<button type="button" data-nexus-critical-action="${action}">${escapeHTML(text)}</button>`;
}

function offerContent(alternatives = false, effects = [], manualDamage = "") {
  const buttons = alternatives
    ? button("sparks", "Escolhido pelas Faíscas") + button("narrative", "Efeito Narrativo")
    : button("kokusen", "Kokusen") + button("other", "Outro Efeito");
  return '<section class="nexus-critical-card">' +
    '<strong class="nexus-critical-title">EFEITO CRÍTICO</strong>' +
    '<p class="nexus-critical-subtitle">Escolha seu efeito</p>' +
    (hasMovementDamage(effects)
      ? `<p class="nexus-critical-subtitle">Dano original: <strong>${calculateCriticalDamage(effects, false).base}</strong></p>`
      : '<label class="nexus-critical-manual">Dano base (opcional)' +
        `<input type="number" min="0" step="1" data-nexus-critical-damage value="${escapeHTML(manualDamage ?? "")}" placeholder="Dano do golpe"></label>`) +
    `<div class="nexus-critical-actions">${buttons}</div></section>`;
}

function damageContent(damage) {
  if (!damage) return "";
  const components = damage.components.length > 1
    ? '<div class="nexus-critical-components">' + damage.components.map(entry =>
      `<div>${escapeHTML(entry.label)} <strong>${entry.value}</strong></div>`).join("") + '</div>' : "";
  const otherEffects = damage.otherEffects.length
    ? '<div class="nexus-critical-other-effects">' + damage.otherEffects.map(entry =>
      `<div><strong>${escapeHTML(entry.label)}</strong> ${escapeHTML(entry.value)}</div>`).join("") + '</div>' : "";
  return '<section class="nexus-critical-damage">' +
    `<div>Dano original <strong>${damage.base}</strong></div>` + components +
    `<div class="nexus-critical-damage-total">Dano final <strong>${damage.total}</strong></div>` +
    `<small>${damage.base} × ${String(damage.multiplier).replace(".", ",")}</small></section>` + otherEffects;
}

function resultContent(choice, success, rollHTML = "", damage = null) {
  let title;
  let text;
  if (choice === "narrative") {
    title = "Excelente resultado!";
    text = "";
  } else if (success) {
    title = choice === "sparks" ? "Escolhido pelas Faíscas" : "Kokusen!";
    text = "Esse golpe receberá o efeito visual de Raios Negros e multiplicará todo o dano causado por 2. " +
      "Nas próximas 3 rodadas, o personagem conseguirá utilizar o Efeito Crítico em rolagens com dificuldade reduzida para 19. " +
      "Controle energético: 20% de diminuição de todos os gastos envolvendo Energia Amaldiçoada; " +
      "atributos temporariamente aumentados em 20%.";
  } else {
    title = "Crítico!";
    text = "Multiplica o dano causado para 130% neste golpe.";
  }
  const kokusen = success && ["kokusen", "sparks"].includes(choice);
  return `<section class="nexus-critical-card nexus-critical-result${kokusen ? " nexus-kokusen-result" : ""}">` +
    (kokusen ? kokusenLayer() : "") +
    `<strong class="nexus-critical-title">${escapeHTML(title)}</strong>` +
    damageContent(damage) + (text ? `<p class="nexus-critical-rules">${escapeHTML(text)}</p>` : "") + rollHTML + '</section>';
}

function resolvedContent(choice) {
  const label = { kokusen: "Kokusen", sparks: "Escolhido pelas Faíscas", narrative: "Efeito Narrativo" }[choice];
  return '<section class="nexus-critical-card nexus-critical-resolved">' +
    '<strong class="nexus-critical-title">EFEITO CRÍTICO</strong>' +
    `<p class="nexus-critical-subtitle">Efeito escolhido: ${escapeHTML(label)}</p></section>`;
}

function speakerActor(message) {
  return message?.speakerActor ?? globalThis.ChatMessage?.getSpeakerActor?.(message?.speaker ?? {}) ?? null;
}

/** Runs only in the rolling user's client; derived cards retain the exact source visibility. */
export async function createCriticalOffer(message) {
  const key = messageKey(message);
  if (!key || authorId(message) !== game.user.id || offering.has(key) || !hasCriticalD20(message)) return;
  if (message.getFlag?.(NAMESPACE, "criticalOfferId")) return;
  const existing = [...messageValues()].find(candidate => stateOf(candidate)?.sourceMessage === key);
  if (existing) return existing;
  offering.add(key);
  try {
    const actor = speakerActor(message);
    const movementEffects = readMovementEffects(message.getFlag?.(NAMESPACE, "movementEffects") ??
      message.flags?.[NAMESPACE]?.movementEffects);
    const data = { kind: "offer", state: "pending", sourceMessage: key, actorUuid: actor?.uuid ?? null, movementEffects };
    const offer = await ChatMessage.create({
      author: game.user.id,
      speaker: { ...(message.speaker ?? {}) },
      ...visibilityOf(message),
      content: offerContent(false, movementEffects),
      flags: { [NAMESPACE]: { [FLAG]: data } }
    });
    if (!offer) throw new Error("Não foi possível publicar as opções de Efeito Crítico.");
    try {
      await message.update({ [`flags.${NAMESPACE}.criticalOfferId`]: offer.id });
    } catch (error) {
      // The offer itself also identifies the source, so a retry cannot duplicate it.
      console.warn("Nexus JJK | Não foi possível marcar a rolagem crítica.", error);
    }
    return offer;
  } catch (error) {
    console.error("Nexus JJK | Não foi possível preparar o Efeito Crítico.", error);
    ui.notifications.error(error.message);
  } finally {
    offering.delete(key);
  }
}

async function canChoose(message) {
  if (!message || message.isContentVisible === false) return false;
  const user = game.user;
  if (!user.isGM && authorId(message) !== user.id) return false;
  if (typeof message.canUserModify === "function" && !message.canUserModify(user, "update")) return false;
  const actorUuid = stateOf(message)?.actorUuid;
  if (!actorUuid) return true;
  let actor;
  try { actor = await fromUuid(actorUuid); } catch { return false; }
  return actor?.documentName === "Actor" && actor.isOwner === true;
}

function resultFor(message) {
  const key = messageKey(message);
  return [...messageValues()].find(candidate => {
    const state = stateOf(candidate);
    return state?.kind === "result" && state.offerMessage === key;
  });
}

/** A choice is stored on the chat document and cannot be rolled again after resolution. */
export async function chooseCriticalEffect(messageId, choice, { baseDamage } = {}) {
  if (!["kokusen", "other", "sparks", "narrative"].includes(choice) || choosing.has(messageId)) return;
  choosing.add(messageId);
  let message;
  let previous;
  let result;
  try {
    message = game.messages.get(messageId);
    previous = structuredClone(stateOf(message));
    if (previous?.kind !== "offer" || !["pending", "alternatives"].includes(previous.state) || resultFor(message)) return;
    if (!await canChoose(message)) {
      ui.notifications.warn("Você não pode escolher o efeito crítico desta rolagem.");
      return;
    }
    if ((previous.state === "pending") !== ["kokusen", "other"].includes(choice)) return;
    const manualDamage = baseDamage === undefined ? previous.manualDamage : baseDamage;
    if (choice === "other") {
      await message.update({ content: offerContent(true, previous.movementEffects, manualDamage),
        [`flags.${NAMESPACE}.${FLAG}`]: { ...previous, state: "alternatives", manualDamage: manualDamage ?? "" } });
      return message;
    }
    // Valida o dano manual antes de consumir o teste de Kokusen.
    if (choice !== "narrative") calculateCriticalDamage(previous.movementEffects, false, manualDamage);
    previous.manualDamage = manualDamage ?? "";
    await message.update({ content: offerContent(previous.state === "alternatives", previous.movementEffects, manualDamage),
      [`flags.${NAMESPACE}.${FLAG}`]: { ...previous, state: "resolving", choice } });
    let roll;
    if (choice === "kokusen") {
      roll = await new Roll("1d2").evaluate({ allowInteractive: !message.blind });
      if (![1, 2].includes(roll.total)) throw new Error("O teste de Kokusen precisa resultar em 1 ou 2.");
    }
    const success = choice === "sparks" || roll?.total === 2;
    const damage = choice === "narrative" ? null : calculateCriticalDamage(previous.movementEffects, success, manualDamage);
    const rollHTML = roll ? await roll.render() : "";
    result = await ChatMessage.create({
      author: game.user.id,
      speaker: { ...(message.speaker ?? {}) },
      ...visibilityOf(message),
      rolls: roll ? [JSON.stringify(roll)] : [],
      content: resultContent(choice, success, rollHTML, damage),
      flags: { [NAMESPACE]: { [FLAG]: {
        kind: "result", offerMessage: messageKey(message), choice, success, damage
      } } }
    });
    if (!result) throw new Error("Não foi possível publicar o efeito crítico.");
    await message.update({ content: resolvedContent(choice),
      [`flags.${NAMESPACE}.${FLAG}`]: { ...previous, state: "resolved", choice, resultMessageId: result.id } });
    return result;
  } catch (error) {
    if (message && previous && !result && stateOf(message)?.state === "resolving") {
      try { await message.update({ [`flags.${NAMESPACE}.${FLAG}`]: previous }); }
      catch (restoreError) { console.error("Nexus JJK | Não foi possível reabrir a escolha crítica.", restoreError); }
    }
    console.error("Nexus JJK | Não foi possível resolver o Efeito Crítico.", error);
    ui.notifications.error(error.message);
  } finally {
    choosing.delete(messageId);
  }
}

export function registerCriticalEffects() {
  Hooks.on("createChatMessage", message => { void createCriticalOffer(message); });
  Hooks.on("renderChatMessageHTML", (message, html) => {
    const state = stateOf(message);
    if (message.isContentVisible !== false) decorateKokusenVisuals(state, html);
    else if (["offer", "result"].includes(state?.kind)) {
      clearKokusenVisuals(html);
    }
    if (state?.kind !== "offer") return;
    const own = game.user.isGM || authorId(message) === game.user.id;
    for (const button of html.querySelectorAll("[data-nexus-critical-action], [data-nexus-critical-damage]")) {
      button.disabled = !own || message.isContentVisible === false || !["pending", "alternatives"].includes(state.state);
    }
    html.addEventListener("click", event => {
      const button = event.target?.closest?.("[data-nexus-critical-action]");
      if (!button || button.disabled || !html.contains(button)) return;
      event.preventDefault();
      for (const control of html.querySelectorAll("[data-nexus-critical-action], [data-nexus-critical-damage]")) control.disabled = true;
      const baseDamage = html.querySelector("[data-nexus-critical-damage]")?.value;
      void chooseCriticalEffect(message.id, button.dataset.nexusCriticalAction, { baseDamage }).finally(() => {
        const current = stateOf(game.messages.get(message.id));
        for (const control of html.querySelectorAll("[data-nexus-critical-action], [data-nexus-critical-damage]")) {
          control.disabled = !own || message.isContentVisible === false || !["pending", "alternatives"].includes(current?.state);
        }
      });
    });
  });
}
