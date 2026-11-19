import { getAttributeMax, getXpTarget, NEXUS_ATTRIBUTES, NEXUS_MAX_LEVEL } from "./config.mjs";
import { prototypePortraitChanges, usesTokenPortrait } from "./token-portraits.mjs";
import { SHIKIGAMI_ATTRIBUTE_KEYS } from "./shikigami.mjs";
import { getWeaponDamageDetails } from "./weapon-damage.mjs";

/** Resolve mudanças tanto expandidas quanto em caminhos pontuados. */
function findChange(changes, path) {
  if (!changes || typeof changes !== "object") return null;
  const parts = path.split(".");
  for (let length = parts.length; length > 0; length--) {
    const key = parts.slice(0, length).join(".");
    if (!Object.hasOwn(changes, key)) continue;
    if (length === parts.length) return { target: changes, key, value: changes[key] };
    return findChange(changes[key], parts.slice(length).join("."));
  }
  return null;
}

function setChange(changes, path, value) {
  const existing = findChange(changes, path);
  if (existing) {
    existing.target[existing.key] = value;
    return;
  }
  const parts = path.split(".");
  let target = changes;
  for (const part of parts.slice(0, -1)) target = target[part] ??= {};
  target[parts.at(-1)] = value;
}

/** Inclui remoções de campos e de seus pais, mesmo em caminhos mistos. */
function invokerChanges(changes, prefix = []) {
  const matches = [];
  const target = ["system", "invokerId"];
  for (const [key, value] of Object.entries(changes ?? {})) {
    const parts = [...prefix, ...key.split(".")];
    const canonical = parts.map(part => part.startsWith("-=") ? part.slice(2) : part);
    if (!canonical.slice(0, Math.min(canonical.length, target.length))
      .every((part, index) => part === target[index])) continue;
    const deleted = parts.some(part => part.startsWith("-="));
    if (deleted && canonical.length <= target.length) matches.push({ value: "" });
    else if (canonical.length === target.length) matches.push({ value });
    else if (canonical.length < target.length && value && typeof value === "object" && !Array.isArray(value)) {
      matches.push(...invokerChanges(value, parts));
    } else matches.push({ value: undefined });
  }
  return matches;
}

function validateInvokerChanges(actor, changes, user, { creating = false } = {}) {
  const currentId = creating ? "" : (actor.system.invokerId ?? "");
  for (const { value } of changes) {
    if (typeof value !== "string") {
      globalThis.ui?.notifications?.warn("Escolha um personagem válido como invocador.");
      return false;
    }
    if (value === currentId) continue;
    if (!user?.isGM) {
      globalThis.ui?.notifications?.warn("Apenas o mestre pode alterar o invocador do shikigami.");
      return false;
    }
    if (value && globalThis.game?.actors?.get(value)?.type !== "character") {
      globalThis.ui?.notifications?.warn("O invocador precisa ser um personagem deste mundo.");
      return false;
    }
  }
  return true;
}

export class NexusActor extends Actor {
  async _preCreate(data, options, user) {
    if (this.type === "shikigami") {
      const changes = invokerChanges(data);
      changes.push({ value: this.system.invokerId ?? "" });
      if (!validateInvokerChanges(this, changes, user, { creating: true })) return false;
    }
    const allowed = await super._preCreate(data, options, user);
    if (allowed === false) return false;
    if (usesTokenPortrait(this) && !this.isToken) {
      this.prototypeToken.updateSource({ ...prototypePortraitChanges(this), randomImg: false });
    }
    return allowed;
  }

  async _preUpdate(changes, options, user) {
    const isShikigami = this.type === "shikigami";
    if (isShikigami && !validateInvokerChanges(this, invokerChanges(changes), user)) return false;
    const isCreature = this.type === "character" || this.type === "curse";
    const xp = findChange(changes, "system.xp.value")?.value;
    if (isCreature && Number.isInteger(xp) && xp !== this.system.xp.value) {
      const initialLevel = findChange(changes, "system.level")?.value ?? this.system.level;
      if (Number.isInteger(initialLevel) && initialLevel >= 0) {
        let level = initialLevel;
        let remainingXp = xp;
        while (level < NEXUS_MAX_LEVEL) {
          const target = getXpTarget(level);
          if (remainingXp < target) break;
          remainingXp -= target;
          level++;
        }

        if (level > initialLevel) {
          setChange(changes, "system.level", level);
          setChange(changes, "system.xp.value", remainingXp);
        }
      }
    }
    if (isCreature || isShikigami) {
      const level = findChange(changes, "system.level")?.value ?? this.system.level;
      const maximum = isShikigami ? Infinity : getAttributeMax(level);
      for (const [key, attribute] of Object.entries(NEXUS_ATTRIBUTES)) {
        if (isShikigami && !SHIKIGAMI_ATTRIBUTE_KEYS.includes(key)) continue;
        const change = findChange(changes, `system.attributes.${key}`);
        if (!change) continue;
        const validNumber = typeof change.value === "number" ||
          (typeof change.value === "string" && change.value.trim() !== "");
        const value = Number(change.value);
        // Dados antigos continuam utilizáveis sem apagar pontos em um render ou level down.
        if (!isShikigami && validNumber && value === this.system.attributes[key]) continue;
        if (!validNumber || !Number.isInteger(value) || value < 0 || value > maximum) {
          const range = isShikigami ? "igual ou maior que zero" : `entre 0 e ${maximum} neste nível`;
          globalThis.ui?.notifications?.warn(`${attribute.name} deve ser um número inteiro ${range}.`);
          return false;
        }
      }
    }
    const allowed = await super._preUpdate(changes, options, user);
    if (allowed === false) return false;
    const image = findChange(changes, "img")?.value;
    if (usesTokenPortrait(this) && !this.isToken && typeof image === "string" && image.trim()) {
      setChange(changes, "prototypeToken.texture.src", image);
      setChange(changes, "prototypeToken.randomImg", false);
      const ringImage = findChange(changes, "prototypeToken.ring.subject.texture")?.value ??
        this.prototypeToken._source?.ring?.subject?.texture;
      if (ringImage) setChange(changes, "prototypeToken.ring.subject.texture", image);
    }
    return allowed;
  }

  get equippedWeapon() {
    if (this.type === "shikigami") return null;
    const item = this.items.get(this.system.equippedWeaponId);
    return item?.isWeapon ? item : null;
  }

  get weaponDamage() {
    return getWeaponDamageDetails(this.equippedWeapon).total;
  }

  async equipWeapon(id = "") {
    if (this.type === "shikigami") throw new Error("Shikigamis não possuem inventário de armas.");
    if (!this.isOwner) throw new Error("Você não pode alterar o equipamento deste personagem.");
    if (typeof id !== "string") throw new Error("Arma inválida.");
    if (id && !this.items.get(id)?.isWeapon) {
      throw new Error("Escolha uma arma do inventário deste personagem.");
    }

    return this.update({ "system.equippedWeaponId": id });
  }

  getRollData() {
    const data = super.getRollData();
    const attributes = this.system.attributes;

    const physical = {
      ...data,
      FOR: attributes.forca,
      DES: attributes.destreza,
      DEX: attributes.destreza,
      AGI: attributes.agilidade,
      CON: attributes.vigor,
      CONS: attributes.vigor,
      NIVEL: this.system.level,
      HP: this.system.hp.value,
      ESQUIVA: this.system.defense
    };
    if (this.type === "shikigami") return physical;

    return {
      ...physical,
      PER: attributes.percepcao,
      INT: attributes.inteligencia,
      JJT: attributes.jujutsu,
      FDV: attributes.fdv,
      EA: this.system.ea.value,
      ARMA: this.weaponDamage,
      DANO_ARMA: this.weaponDamage
    };
  }

  async rollAttribute(key) {
    if (this.type === "shikigami" && !SHIKIGAMI_ATTRIBUTE_KEYS.includes(key)) return;
    const attribute = NEXUS_ATTRIBUTES[key];
    if (!attribute) return;

    const bonus = Number(this.system.attributes[key]) || 0;
    const roll = await new Roll("1d20 + @bonus", { bonus }).evaluate();

    const label = this.type === "shikigami"
      ? ({ destreza: "DEX", vigor: "CONS" }[key] ?? attribute.label)
      : attribute.label;
    return roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `${this.name} — ${attribute.name} (${label})`
    });
  }

  async shareDefense() {
    const image = foundry.utils.getRoute("systems/nexus-jjk/assets/images/ca-defense.gif");
    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<section class="nexus-chat-card"><strong class="nexus-chat-title">CA: ${this.system.defense}</strong><img class="nexus-chat-media" src="${image}" alt=""></section>`
    });
  }
}

export class NexusItem extends Item {
  get weaponDamageDetails() {
    return getWeaponDamageDetails(this);
  }

  get isWeapon() {
    if (this.type !== "equipment") return false;
    // Itens antigos eram equipados sem uma classificação explícita.
    const equippedId = this.actor?.system.equippedWeaponId;
    return this.system.isWeapon ?? (
      this.system.weaponDamage > 0 || (!!equippedId && equippedId === this.id)
    );
  }

  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if (allowed === false) return false;

    const damage = data["system.weaponDamage"] ?? data.system?.weaponDamage ?? 0;
    if (!user.isGM && Number(damage) !== 0) {
      ui.notifications.warn("Apenas o mestre pode definir o dano da arma.");
      return false;
    }
  }

  async _preUpdate(changes, options, user) {
    const allowed = await super._preUpdate(changes, options, user);
    if (allowed === false) return false;

    const changesDamage = Object.hasOwn(changes, "system.weaponDamage") ||
      Object.hasOwn(changes, "system.-=weaponDamage") ||
      Object.hasOwn(changes.system ?? {}, "weaponDamage") ||
      Object.hasOwn(changes.system ?? {}, "-=weaponDamage");
    if (changesDamage && !user.isGM) {
      ui.notifications.warn("Apenas o mestre pode alterar o dano da arma.");
      return false;
    }
  }
}
