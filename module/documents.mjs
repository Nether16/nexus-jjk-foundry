import { getAttributeMax, getXpTarget, NEXUS_ATTRIBUTES, NEXUS_MAX_LEVEL } from "./config.mjs";
import { SHIKIGAMI_ATTRIBUTE_KEYS } from "./shikigami.mjs";
import { getWeaponDamageDetails } from "./weapon-damage.mjs";
import { validateProgressionChanges } from "./progression-permissions.mjs";

const DEFAULT_TOKEN_ART = globalThis.CONST?.DEFAULT_TOKEN ?? "icons/svg/mystery-man.svg";
const tokenArt = value => typeof value === "string" && value.trim() ? value.trim() : DEFAULT_TOKEN_ART;
const videoArt = value => /^data:video\//iu.test(value) || /\.(?:mp4|webm|m4v|ogv|ogg)(?:$|[?#])/iu.test(value);
const tokenOnlyArt = value => videoArt(value) || value.includes("*") || value.startsWith("#");

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
  _initializeSource(data, options) {
    const tokenImage = findChange(data, "prototypeToken.texture.src")?.value;
    const portrait = data.img;
    const defaults = ["displayName", "displayBars", "bar1.attribute", "bar2.attribute", "name"]
      .filter(key => !findChange(data, `prototypeToken.${key}`));
    const source = super._initializeSource(data, options);
    if (source.type === "token") {
      const art = tokenArt(typeof tokenImage === "string" && tokenImage.trim() ? tokenImage : portrait);
      source.prototypeToken.texture.src = art;
      // Actor.img aceita imagens; vídeos continuam na textura do token nativo.
      source.img = tokenOnlyArt(art) ? tokenArt(portrait) : art;
      if (defaults.includes("displayName")) source.prototypeToken.displayName = globalThis.CONST?.TOKEN_DISPLAY_MODES?.HOVER ?? 30;
      if (defaults.includes("displayBars")) source.prototypeToken.displayBars = globalThis.CONST?.TOKEN_DISPLAY_MODES?.NONE ?? 0;
      for (const bar of ["bar1", "bar2"]) {
        if (defaults.includes(`${bar}.attribute`)) (source.prototypeToken[bar] ??= {}).attribute = null;
      }
      if (defaults.includes("name")) source.prototypeToken.name = source.name;
      return source;
    }
    if (typeof tokenImage !== "string" || !tokenImage.trim()) {
      source.prototypeToken.texture.src = DEFAULT_TOKEN_ART;
    }
    return source;
  }

  async _preCreate(data, options, user) {
    if (!validateProgressionChanges(this, data, user, { creating: true })) return false;
    if (this.type === "shikigami") {
      const changes = invokerChanges(data);
      changes.push({ value: this.system.invokerId ?? "" });
      if (!validateInvokerChanges(this, changes, user, { creating: true })) return false;
    }
    const tokenImage = this.prototypeToken?.texture?.src || DEFAULT_TOKEN_ART;
    const allowed = await super._preCreate(data, options, user);
    if (allowed === false) return false;
    if (!this.isToken) {
      this.prototypeToken.updateSource({ "texture.src": tokenImage });
    }
    return allowed;
  }

  async _preUpdate(changes, options, user) {
    if (!validateProgressionChanges(this, changes, user)) return false;
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
    const imageChange = findChange(changes, "img");
    const image = imageChange?.value;
    const tokenChange = findChange(changes, "prototypeToken.texture.src");
    if (this.type === "token") {
      if (tokenChange || imageChange) {
        const art = tokenArt(tokenChange ? tokenChange.value : image);
        if (tokenChange) delete tokenChange.target[tokenChange.key];
        setChange(changes, "prototypeToken.texture.src", art);
        setChange(changes, "img", tokenOnlyArt(art) ? tokenArt(this.img) : art);
      }
      const nameChange = findChange(changes, "name");
      if (nameChange && typeof nameChange.value === "string") setChange(changes, "prototypeToken.name", nameChange.value);
    } else if (tokenChange || (typeof image === "string" && image.trim())) {
      const tokenImage = tokenChange ? tokenChange.value : this.prototypeToken?.texture?.src;
      // O Foundry copia o retrato para tokens com arte padrão; mantenha a arte independente.
      // Normalize caminhos mistos antes do hook nativo consultar a textura.
      if (tokenChange) delete tokenChange.target[tokenChange.key];
      setChange(changes, "prototypeToken.texture.src",
        typeof tokenImage === "string" && tokenImage.trim() ? tokenImage : DEFAULT_TOKEN_ART);
    }
    return super._preUpdate(changes, options, user);
  }

  get equippedWeapon() {
    if (this.type === "shikigami" || this.type === "token") return null;
    const item = this.items.get(this.system.equippedWeaponId);
    return item?.isWeapon ? item : null;
  }

  get weaponDamage() {
    return getWeaponDamageDetails(this.equippedWeapon).total;
  }

  get weaponAccuracy() {
    return getWeaponDamageDetails(this.equippedWeapon).accuracy;
  }

  async equipWeapon(id = "") {
    if (this.type === "token") throw new Error("Fichas de token não possuem inventário de armas.");
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
    if (this.type === "token") return data;
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
      ARMA_ACERTO: this.weaponAccuracy,
      ACERTO_ARMA: this.weaponAccuracy,
      DANO_ARMA: this.weaponDamage
    };
  }

  async rollAttribute(key) {
    if (this.type === "token") return;
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
    if (this.type === "token") return;
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
