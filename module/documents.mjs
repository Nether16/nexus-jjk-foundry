import { getAttributeMax, getXpTarget, NEXUS_ATTRIBUTES, NEXUS_MAX_LEVEL } from "./config.mjs";

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

export class NexusActor extends Actor {
  async _preUpdate(changes, options, user) {
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
    if (isCreature) {
      const level = findChange(changes, "system.level")?.value ?? this.system.level;
      const maximum = getAttributeMax(level);
      for (const [key, attribute] of Object.entries(NEXUS_ATTRIBUTES)) {
        const change = findChange(changes, `system.attributes.${key}`);
        if (!change) continue;
        const validNumber = typeof change.value === "number" ||
          (typeof change.value === "string" && change.value.trim() !== "");
        const value = Number(change.value);
        // Dados antigos continuam utilizáveis sem apagar pontos em um render ou level down.
        if (validNumber && value === this.system.attributes[key]) continue;
        if (!validNumber || !Number.isInteger(value) || value < 0 || value > maximum) {
          globalThis.ui?.notifications?.warn(`${attribute.name} deve ser um número inteiro entre 0 e ${maximum} neste nível.`);
          return false;
        }
      }
    }
    return super._preUpdate(changes, options, user);
  }

  get equippedWeapon() {
    const item = this.items.get(this.system.equippedWeaponId);
    return item?.isWeapon ? item : null;
  }

  get weaponDamage() {
    const damage = Number(this.equippedWeapon?.system.weaponDamage);
    return Number.isFinite(damage) && damage >= 0 ? damage : 0;
  }

  async equipWeapon(id = "") {
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

    return {
      ...data,
      FOR: attributes.forca,
      DES: attributes.destreza,
      AGI: attributes.agilidade,
      CON: attributes.vigor,
      PER: attributes.percepcao,
      INT: attributes.inteligencia,
      JJT: attributes.jujutsu,
      FDV: attributes.fdv,
      NIVEL: this.system.level,
      HP: this.system.hp.value,
      EA: this.system.ea.value,
      ESQUIVA: this.system.defense,
      ARMA: this.weaponDamage,
      DANO_ARMA: this.weaponDamage
    };
  }

  async rollAttribute(key) {
    const attribute = NEXUS_ATTRIBUTES[key];
    if (!attribute) return;

    const bonus = Number(this.system.attributes[key]) || 0;
    const roll = await new Roll("1d20 + @bonus", { bonus }).evaluate();

    return roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `${this.name} — ${attribute.name} (${attribute.label})`
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
