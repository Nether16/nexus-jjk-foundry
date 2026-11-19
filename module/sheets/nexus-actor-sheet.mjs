import {
  NEXUS_ATTRIBUTES,
  NEXUS_ITEM_LABELS,
  NEXUS_ORIGINS,
  NEXUS_TALENTS
} from "../config.mjs";
import { NEXUS_CURSE_ORIGINS } from "../curse-config.mjs";
import { movementWrites, rollMovement } from "../movement-macros.mjs";
import { NEXUS_KNOWLEDGE } from "../knowledge.mjs";
import { NexusSheetUI } from "./nexus-sheet-ui.mjs";
import { applyAppearance, readAppearance } from "./nexus-appearance.mjs";
import { NexusAppearanceConfig } from "./nexus-appearance-config.mjs";
import { NexusShikigamiConfig } from "./nexus-shikigami-config.mjs";
import { getShikigamiReference, SHIKIGAMI_ATTRIBUTE_KEYS } from "../shikigami.mjs";
import { getWeaponDamageDetails } from "../weapon-damage.mjs";

const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;
const TALENT_SLOT_LEVELS = [0, 0, 5, 10, 15, 20];
const TALENT_SLOT_COUNT = TALENT_SLOT_LEVELS.length;
const LOCKED_TALENT_SLOTS = 2;
const TALENT_SLOT_FLAG = "talentSlot";
const DEFAULT_MOVEMENT_IMAGE = "systems/nexus-jjk/assets/icons/d20Icon.png";

export class NexusActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["nexus-jjk", "nexus-actor-sheet"],
    position: {
      width: 960,
      height: 720
    },
    form: {
      closeOnSubmit: false,
      submitOnChange: true
    },
    actions: {
      configureAppearance: this.#configureAppearance,
      configureShikigami: this.#configureShikigami,
      rollAttribute: this.#rollAttribute,
      shareDefense: this.#shareDefense,
      createItem: this.#createItem,
      deleteItem: this.#deleteItem,
      rollAttack: this.#rollAttack,
      openPopup: this.#openPopup,
      setKnowledgeLevel: this.#setKnowledgeLevel,
      selectItem: this.#selectItem,
      editItemImage: this.#editItemImage,
      toggleEquipWeapon: this.#toggleEquipWeapon
    }
  };

  static PARTS = {
    form: {
      template: "systems/nexus-jjk/templates/actor/actor-sheet.hbs",
      scrollable: ['.conteudo-abas:has(> [data-popup-panel="knowledge"]:not([hidden]))']
    }
  };

  /** @type {string|null} */
  #activePopup = null;

  /** @type {{technique: string|null, knowledge: string|null, equipment: string|null}} */
  #selectedItems = {
    technique: null,
    knowledge: null,
    equipment: null
  };

  /** @type {Map<string, number>} */
  #barPositions = new Map();

  /** @type {number|null} */
  #barFrame = null;

  /** @type {Window|null} */
  #barWindow = null;
  #visualUI = new NexusSheetUI();
  #appearanceConfig = null;
  #shikigamiConfig = null;
  #savingTalentSlots = new Set();
  #richTextWrites = new Set();

  get #originCatalog() {
    return this.actor.type === "curse" ? NEXUS_CURSE_ORIGINS : NEXUS_ORIGINS;
  }

  _initializeApplicationOptions(options) {
    const initialized = super._initializeApplicationOptions(options);
    if (initialized.document.type === "shikigami") {
      if (!initialized.classes.includes("nexus-shikigami-sheet")) {
        initialized.classes.push("nexus-shikigami-sheet");
      }
      initialized.position = {
        ...initialized.position,
        width: options.position?.width ?? 500,
        height: options.position?.height ?? 780
      };
      initialized.window.resizable = options.window?.resizable ?? true;
    }
    return initialized;
  }

  _getHeaderControls() {
    return [
      ...super._getHeaderControls(),
      {
        action: "configureAppearance",
        icon: "fa-solid fa-palette",
        label: "Aparência da ficha",
        visible: this.isEditable
      },
      {
        action: "configureShikigami",
        icon: "fa-solid fa-link",
        label: "Configurar shikigami",
        visible: this.isEditable && Boolean(game.user?.isGM) && this.actor.type === "shikigami"
      }
    ];
  }

  async _prepareContext(options) {
    // Salva antes de montar o próximo HTML para um render não restaurar texto antigo.
    for (const editor of this.element?.querySelectorAll("prose-mirror[data-item-field], prose-mirror[data-actor-field]") ?? []) {
      editor.save();
    }
    await Promise.all(this.#richTextWrites);
    const context = await super._prepareContext(options);
    const isCurse = this.actor.type === "curse";
    const isShikigami = this.actor.type === "shikigami";
    const visibleTabs = {
      movements: true,
      origin: !isShikigami,
      talents: !isCurse && !isShikigami,
      techniques: true,
      knowledge: !isCurse && !isShikigami,
      equipment: !isShikigami,
      notes: !isCurse,
      history: !isShikigami
    };
    if (!visibleTabs[this.#activePopup]) this.#activePopup = "movements";
    const grouped = {
      attack: [],
      talent: [],
      technique: [],
      knowledge: [],
      equipment: []
    };

    for (const item of this.actor.items) {
      if (!grouped[item.type]) continue;
      grouped[item.type].push({
        id: item.id,
        uuid: item.uuid,
        name: item.name,
        img: item.img,
        system: item.system
      });
    }

    const lockedTalents = NEXUS_TALENTS.filter(talent => talent.locked);
    const freeTalents = NEXUS_TALENTS.filter(talent => !talent.locked);

    const savedTalents = new Map();
    const oldLockedTalents = [];
    const oldFreeTalents = [];
    for (const item of grouped.talent) {
      const document = this.actor.items.get(item.id);
      const slot = document.getFlag("nexus-jjk", TALENT_SLOT_FLAG);
      if (Number.isInteger(slot) && slot >= 0 && slot < TALENT_SLOT_COUNT && !savedTalents.has(slot)) {
        savedTalents.set(slot, item);
      } else {
        const oldTalents = item.system.locked ? oldLockedTalents : oldFreeTalents;
        oldTalents.push(item);
      }
    }

    const talentSlots = Array.from({ length: TALENT_SLOT_COUNT }, (_, slot) => {
      const locked = slot < LOCKED_TALENT_SLOTS;
      const oldTalents = locked ? oldLockedTalents : oldFreeTalents;
      const item = savedTalents.get(slot) ?? oldTalents.shift();
      const requiredLevel = TALENT_SLOT_LEVELS[slot];
      if ((Number(this.actor.system.level) || 0) < requiredLevel) {
        return { slot, requiredLevel, lockedByLevel: true };
      }
      const talents = locked ? lockedTalents : freeTalents;

      const choices = talents.map(talent => ({
        name: talent.name,
        selected: talent.name === item?.name
      }));

      return {
        ...item,
        slot,
        choices,
        hasSelection: choices.some(choice => choice.selected)
      };
    });

    for (const type of ["technique", "knowledge", "equipment"]) {
      const items = grouped[type];
      if (!items.some(item => item.id === this.#selectedItems[type])) {
        this.#selectedItems[type] = items[0]?.id ?? null;
      }
      for (const item of items) item.selected = item.id === this.#selectedItems[type];
    }

    const equippedWeaponId = this.actor.equippedWeapon?.id;
    for (const item of grouped.equipment) {
      const document = this.actor.items.get(item.id);
      item.isWeapon = document.isWeapon;
      item.equipped = item.id === equippedWeaponId;
      item.weaponDamage = Number(item.system.weaponDamage) || 0;
      const damage = getWeaponDamageDetails(document);
      item.weaponDamageTotal = damage.total;
      const bonuses = [];
      if (damage.affiliatedBonus) bonuses.push(`Arma afiliada +${damage.affiliatedBonus}`);
      if (damage.tailoredBonus) bonuses.push(`Sob Medida +${damage.tailoredBonus}`);
      if (damage.specialAbility) bonuses.push("Sob Medida: segunda habilidade de Grau Especial, definida pelo mestre.");
      item.weaponDamageNote = bonuses.join(" · ");
    }

    for (const item of grouped.attack) {
      item.hasCustomImage = Boolean(item.img && item.img !== DEFAULT_MOVEMENT_IMAGE);
    }

    const origins = this.#originCatalog;
    const originData = this.actor.system.origin ?? {};
    const origin = Object.hasOwn(origins, originData.key)
      ? origins[originData.key]
      : origins.grau4 ?? origins.feiticeiro;
    const originImage = originData.image || origin.image;
    const originVariants = Object.entries(origin.alts ?? {})
      .filter(([, variant]) => variant && typeof variant === "object" && !Array.isArray(variant))
      .map(([key, variant]) => ({
        id: key,
        key,
        label: variant.label || key,
        selected: key === originData.variant
      }));
    const selectedVariant = originVariants.find(variant => variant.selected);
    const variant = selectedVariant ? origin.alts[selectedVariant.key] : null;

    return {
      ...context,
      actor: this.actor,
      system: this.actor.system,
      isCurse,
      isShikigami,
      shikigamiReference: isShikigami ? getShikigamiReference(this.actor) : null,
      canConfigureShikigami: isShikigami && this.isEditable && Boolean(game.user?.isGM),
      visibleTabs,
      tabCount: Object.values(visibleTabs).filter(Boolean).length,
      editable: this.isEditable,
      isGM: Boolean(game.user?.isGM),
      activePopup: this.#activePopup,
      activeTabs: this.#activePopup ? { [this.#activePopup]: true } : {},
      attributes: Object.entries(NEXUS_ATTRIBUTES)
        .filter(([key]) => !isShikigami || SHIKIGAMI_ATTRIBUTE_KEYS.includes(key))
        .map(([key, config]) => ({
        key,
        label: isShikigami ? ({ destreza: "DEX", vigor: "CONS" }[key] ?? config.label) : config.label,
        name: isShikigami && key === "vigor" ? "Constituição" : config.name,
        value: this.actor.system.attributes[key],
        inputMin: Math.min(0, this.actor.system.attributes[key]),
        inputMax: isShikigami ? null : Math.max(this.actor.system.attributeMax ?? 5, this.actor.system.attributes[key])
      })),
      origins: Object.entries(origins).map(([key, config]) => ({
        key,
        label: config.label,
        selected: key === originData.key
      })),
      origin: {
        ...origin,
        image: originImage,
        isVideo: /\.mp4(?:$|[?#])/iu.test(originImage || ""),
        description: originData.description || origin.description,
        effects: originData.effects,
        hasVariants: originVariants.length > 0,
        variants: originVariants,
        variantDetails: variant?.details || variant?.description || ""
      },
      knowledgeEntries: Object.entries(NEXUS_KNOWLEDGE).map(([id, entry]) => {
        const level = this.actor.system.knowledgeLevels?.[id] ?? 0;
        const levels = [1, 2, 3].map(value => ({
          ...entry.levels[value],
          value,
          selected: value === level
        }));
        return {
          id,
          name: entry.name,
          description: entry.description,
          detailsId: `${this.id}-knowledge-${id}`,
          levels,
          visibleLevels: levels.filter(({ value }) => value <= level)
        };
      }),
      talentSlots,
      items: grouped
    };
  }

  async _onRender(context, options) {
    this.#animateBars();
    await super._onRender(context, options);

    applyAppearance(this.element, readAppearance(this.actor));
    this.#syncPopupState();
    this.#syncSelectionState();
    this.#visualUI.attach(this.element, { editable: this.isEditable, actor: this.actor });

    for (const key of Object.keys(NEXUS_ATTRIBUTES)) {
      const input = this.element.querySelector(`[name="system.attributes.${key}"]`);
      if (!input) continue;
      input.addEventListener("change", event => {
        if (!this.isEditable) return;
        const isShikigami = this.actor.type === "shikigami";
        const maximum = isShikigami ? Infinity : this.actor.system.attributeMax ?? 5;
        const value = input.valueAsNumber;
        if (value === this.actor.system.attributes[key]) return;
        if (Number.isInteger(value) && value >= 0 && value <= maximum) return;
        event.stopPropagation();
        input.value = this.actor.system.attributes[key];
        ui.notifications.warn(isShikigami
          ? "Cada atributo deve ser um número inteiro igual ou maior que zero."
          : `Cada atributo deve ficar entre 0 e ${maximum} neste nível.`);
      });
    }

    for (const input of this.element.querySelectorAll("[data-item-field]")) {
      const row = input.closest("[data-item-id]");
      input.addEventListener("change", async event => {
        event.stopPropagation();
        if (input.matches("prose-mirror") && event.target !== input) return;
        if (!this.isEditable) return;
        const target = event.currentTarget;
        const item = this.actor.items.get(row?.dataset.itemId);
        if (row?.hasAttribute("data-talent-slot")) {
          await this.#saveTalent(target, row, item);
          return;
        }
        if (!item) return;

        const field = target.dataset.itemField;
        if (["system.isWeapon", "system.isAffiliatedWeapon"].includes(field) && item.type !== "equipment") return;
        if (field === "system.weaponDamage" && !game.user?.isGM) {
          target.value = item.system.weaponDamage;
          return;
        }

        let value = target.type === "checkbox" ? target.checked : target.value;
        if (target.type === "number") {
          value = Number(value);
          if (!Number.isFinite(value) || (field === "system.weaponDamage" && value < 0)) {
            target.value = field === "system.weaponDamage" ? item.system.weaponDamage : "";
            return;
          }
        }
        if (item.type === "talent" && field === "name") {
          const talent = NEXUS_TALENTS.find(entry => entry.name === value);
          if (talent) {
            await item.update({
              name: talent.name,
              img: talent.image,
              "system.description": talent.description,
              "system.locked": talent.locked
            });
            return;
          }
        }

        if (item.type === "attack") {
          // O clique no dado pode acontecer enquanto o último campo ainda está sendo salvo.
          const write = Promise.resolve(movementWrites.get(item))
            .then(() => item.update({ [field]: value }, { render: false }))
            .catch(error => {
              console.error("Nexus JJK | Erro ao salvar golpe", error);
              ui.notifications.error("Não foi possível salvar o golpe.");
              return false;
            });
          movementWrites.set(item, write);
          if (await write === false) target.value = foundry.utils.getProperty(item, field) ?? "";
          if (movementWrites.get(item) === write) movementWrites.delete(item);
          return;
        }

        if (target.matches("prose-mirror")) {
          await this.#updateRichText(item, field, value);
          return;
        }
        await item.update({ [field]: value });
        if (field === "system.isWeapon" && item.system.isWeapon === false &&
            this.actor.system.equippedWeaponId === item.id) {
          await this.actor.equipWeapon("");
        }
      });
    }

    for (const editor of this.element.querySelectorAll("prose-mirror[data-actor-field]")) {
      editor.addEventListener("change", async event => {
        event.stopPropagation();
        if (event.target !== editor) return;
        if (!this.isEditable) return;
        const field = editor.dataset.actorField;
        if (field !== "system.history") return;
        await this.#updateRichText(this.actor, field, editor.value);
      });
    }

    for (const originSelect of this.element.querySelectorAll("[data-origin-select]")) {
      originSelect.addEventListener("change", async event => {
        event.stopPropagation();
        if (!this.isEditable) return;
        const key = event.currentTarget.value;
        if (!Object.hasOwn(this.#originCatalog, key)) return;
        const origin = this.#originCatalog[key];
        if (!origin) return;

        await this.actor.update({
          "system.origin.key": key,
          "system.origin.variant": "",
          "system.origin.image": null,
          "system.origin.description": origin.description
        });
      });
    }

    for (const variantSelect of this.element.querySelectorAll("[data-origin-variant]")) {
      variantSelect.addEventListener("change", async event => {
        event.stopPropagation();
        if (!this.isEditable) return;
        const key = event.currentTarget.value;
        const origin = this.#originCatalog[this.actor.system.origin.key];
        const variant = Object.hasOwn(origin?.alts ?? {}, key) ? origin.alts[key] : null;
        if (key && (!variant || typeof variant !== "object" || Array.isArray(variant))) return;
        await this.actor.update({ "system.origin.variant": key });
      });
    }
  }

  async #updateRichText(document, field, value) {
    const write = document.update({ [field]: value }, { render: false });
    this.#richTextWrites.add(write);
    try {
      return await write;
    } finally {
      this.#richTextWrites.delete(write);
    }
  }

  async #saveTalent(select, row, item) {
    const slot = Number(row.dataset.talentSlot);
    if (!Number.isInteger(slot) || slot < 0 || slot >= TALENT_SLOT_COUNT) return;
    if ((Number(this.actor.system.level) || 0) < TALENT_SLOT_LEVELS[slot]) return;
    if (this.#savingTalentSlots.has(slot) || (item && item.type !== "talent")) return;

    const locked = slot < LOCKED_TALENT_SLOTS;
    const talent = NEXUS_TALENTS.find(entry => entry.name === select.value && entry.locked === locked);
    if (!talent) return;

    const data = {
      name: talent.name,
      img: talent.image,
      system: {
        description: talent.description,
        locked: talent.locked
      },
      flags: {
        "nexus-jjk": { [TALENT_SLOT_FLAG]: slot }
      }
    };

    this.#savingTalentSlots.add(slot);
    select.disabled = true;
    try {
      if (item) {
        await item.update(data);
      } else {
        await this.actor.createEmbeddedDocuments("Item", [{ ...data, type: "talent" }]);
      }
    } finally {
      this.#savingTalentSlots.delete(slot);
      select.disabled = !this.isEditable;
    }
  }

  async _preClose(options) {
    await this.#visualUI.flush();
    await super._preClose(options);
  }

  _onClose(options) {
    this.#appearanceConfig = null;
    this.#shikigamiConfig = null;
    this.#visualUI.destroy();
    this.#cancelBarAnimation();
    this.#barPositions.clear();
    this.#activePopup = null;
    super._onClose(options);
  }

  #cancelBarAnimation() {
    if (this.#barFrame === null) return;
    this.#barWindow.cancelAnimationFrame(this.#barFrame);
    this.#barFrame = null;
    this.#barWindow = null;
  }

  #animateBars() {
    this.#cancelBarAnimation();
    const view = this.element.ownerDocument.defaultView;
    const reducedMotion = view.matchMedia("(prefers-reduced-motion: reduce)");
    const animations = [];

    for (const bar of this.element.querySelectorAll("progress[data-bar]")) {
      const key = bar.dataset.bar;
      const target = bar.position;
      if (target === -1) {
        this.#barPositions.delete(key);
        continue;
      }

      const start = this.#barPositions.get(key) ?? target;
      const targetValue = bar.getAttribute("value");
      this.#barPositions.set(key, target);
      if (reducedMotion.matches || start === target) continue;

      bar.value = start * bar.max;
      this.#barPositions.set(key, bar.position);
      animations.push({ bar, key, start, target, targetValue });
    }

    if (!animations.length) return;
    const startedAt = view.performance.now();
    this.#barWindow = view;
    const animate = timestamp => {
      const elapsed = Math.min(Math.max((timestamp - startedAt) / 350, 0), 1);
      const finished = elapsed === 1 || reducedMotion.matches;
      const eased = 1 - ((1 - elapsed) ** 3);

      for (const { bar, key, start, target, targetValue } of animations) {
        if (finished) bar.setAttribute("value", targetValue);
        else bar.value = (start + ((target - start) * eased)) * bar.max;
        this.#barPositions.set(key, bar.position);
      }

      if (finished) {
        this.#barFrame = null;
        this.#barWindow = null;
      } else {
        this.#barFrame = view.requestAnimationFrame(animate);
      }
    };
    this.#barFrame = view.requestAnimationFrame(animate);
  }

  static async #rollAttribute(_event, target) {
    if (!this.isEditable) return;
    await this.actor.rollAttribute(target.dataset.attribute);
  }

  static async #shareDefense() {
    if (!this.isEditable) return;
    await this.actor.shareDefense();
  }

  static async #createItem(_event, target) {
    if (!this.isEditable) return;
    const type = target.dataset.type;
    if (!NEXUS_ITEM_LABELS[type]) return;

    const count = this.actor.items.filter(item => item.type === type).length;
    const data = {
      name: NEXUS_ITEM_LABELS[type],
      type,
      img: type === "attack"
        ? DEFAULT_MOVEMENT_IMAGE
        : "icons/svg/item-bag.svg",
      system: type === "equipment" ? { isWeapon: false } : {}
    };

    if (type === "technique" || type === "knowledge") {
      data.name = `${NEXUS_ITEM_LABELS[type]} ${count + 1}`;
    }

    if (type === "talent") {
      const lockedSlot = count < 2;
      const talent = NEXUS_TALENTS.find(entry => entry.locked === lockedSlot);
      if (talent) {
        data.name = talent.name;
        data.img = talent.image;
        data.system = {
          description: talent.description,
          locked: talent.locked
        };
      }
    }

    const [created] = await this.actor.createEmbeddedDocuments("Item", [data]);
    if (created && type in this.#selectedItems) {
      this.#selectedItems[type] = created.id;
      await this.render();
    }
  }

  static async #deleteItem(_event, target) {
    if (!this.isEditable) return;
    const row = target.closest("[data-item-id]");
    const item = this.actor.items.get(row?.dataset.itemId);
    if (!item) return;

    const name = document.createElement("strong");
    name.textContent = item.name;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Excluir registro" },
      content: `<p>Excluir ${name.outerHTML}?</p>`,
      rejectClose: false,
      modal: true
    });

    if (confirmed) {
      await item.delete();
      if (this.actor.system.equippedWeaponId === item.id) await this.actor.equipWeapon("");
    }
  }

  static async #rollAttack(_event, target) {
    if (!this.isEditable) return;
    const row = target.closest("[data-item-id]");
    const item = this.actor.items.get(row?.dataset.itemId);
    if (item?.type !== "attack") return;

    target.disabled = true;
    try {
      await rollMovement(this.actor, item);
    } finally {
      target.disabled = !this.isEditable;
    }
  }

  async _onDragStart(event) {
    const target = event.currentTarget;
    if (!target.matches("[data-movement-macro]")) return super._onDragStart(event);
    const item = this.actor.items.get(target.dataset.itemId);
    if (!this.isEditable || item?.type !== "attack") {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("text/plain", JSON.stringify({
      type: "Item",
      uuid: item.uuid,
      nexusMovement: true
    }));
  }

  static #configureAppearance() {
    if (!this.isEditable) return;
    if (this.#appearanceConfig?.rendered) {
      this.#appearanceConfig.bringToFront();
      return;
    }
    this.#appearanceConfig = new NexusAppearanceConfig(this);
    return this.renderChild(this.#appearanceConfig);
  }

  static #configureShikigami() {
    if (!this.isEditable || !game.user?.isGM || this.actor.type !== "shikigami") return;
    if (this.#shikigamiConfig?.rendered) {
      this.#shikigamiConfig.bringToFront();
      return;
    }
    this.#shikigamiConfig = new NexusShikigamiConfig(this);
    return this.renderChild(this.#shikigamiConfig);
  }

  static #openPopup(_event, target) {
    const trigger = target.closest?.("[data-popup]") ?? target;
    const popup = trigger.dataset.popup;
    if (!popup) return;

    this.#setPopup(popup);
  }

  static async #setKnowledgeLevel(_event, target) {
    if (!this.isEditable) return;
    const id = target.closest("[data-knowledge-id]")?.dataset.knowledgeId;
    const level = Number(target.dataset.knowledgeLevel);
    if (!Object.hasOwn(NEXUS_KNOWLEDGE, id) || ![1, 2, 3].includes(level)) return;

    const currentLevel = this.actor.system.knowledgeLevels?.[id] ?? 0;
    await this.actor.update({ [`system.knowledgeLevels.${id}`]: currentLevel === level ? 0 : level });
  }

  static #selectItem(_event, target) {
    const row = target.closest?.("[data-item-id]");
    const type = row?.dataset.itemType;
    if (!row?.dataset.itemId || !(type in this.#selectedItems)) return;

    this.#selectedItems[type] = row.dataset.itemId;
    this.#syncSelectionState();
  }

  static async #editItemImage(_event, target) {
    if (!this.isEditable) return;
    const row = target.closest?.("[data-item-id]");
    const item = this.actor.items.get(row?.dataset.itemId);
    if (!item) return;

    const picker = new FilePicker.implementation({
      current: item.img,
      type: "image",
      document: item,
      callback: path => {
        if (!this.isEditable || this.actor.items.get(item.id) !== item) return;
        return item.update({ img: path });
      },
      position: {
        top: this.position.top + 40,
        left: this.position.left + 10
      }
    });
    await picker.browse();
  }

  static async #toggleEquipWeapon(_event, target) {
    if (!this.isEditable) return;
    const row = target.closest?.("[data-item-id]");
    const item = this.actor.items.get(row?.dataset.itemId);
    if (item?.type !== "equipment" || !item.isWeapon) return;

    this.#selectedItems.equipment = item.id;
    const nextId = this.actor.equippedWeapon?.id === item.id ? "" : item.id;
    await this.actor.equipWeapon(nextId);
  }

  #setPopup(popup) {
    const panel = this.element.querySelector(
      `[data-popup-panel="${CSS.escape(popup)}"]`
    );
    if (!panel) return;

    this.#activePopup = popup;
    this.#syncPopupState();
  }

  #syncPopupState() {
    if (!this.element) return;

    const panels = [...this.element.querySelectorAll("[data-popup-panel]")];
    const buttons = [...this.element.querySelectorAll("[data-action='openPopup']")];
    if (!panels.some(panel => panel.dataset.popupPanel === this.#activePopup)) {
      this.#activePopup = buttons.find(button =>
        panels.some(panel => panel.dataset.popupPanel === button.dataset.popup)
      )?.dataset.popup ?? panels[0]?.dataset.popupPanel ?? null;
    }

    this.element.classList.toggle("has-popup", panels.length > 0);

    for (const panel of panels) {
      const active = panel.dataset.popupPanel === this.#activePopup;
      panel.classList.toggle("active", active);
      panel.toggleAttribute("hidden", !active);
      panel.setAttribute("aria-hidden", String(!active));
    }

    for (const button of buttons) {
      const active = button.dataset.popup === this.#activePopup;
      button.classList.toggle("active", active);
      button.setAttribute("aria-expanded", String(active));
    }
  }

  #syncSelectionState() {
    if (!this.element) return;

    for (const type of Object.keys(this.#selectedItems)) {
      const selected = this.#selectedItems[type];

      for (const row of this.element.querySelectorAll(`[data-item-type="${type}"]`)) {
        const active = row.dataset.itemId === selected;
        row.classList.toggle("selected", active);
        if (row.classList.contains("entrada-visual")) {
          row.classList.toggle("selecionado", active);
          row.setAttribute("aria-pressed", String(active));
        }
      }

      for (const detail of this.element.querySelectorAll(`[data-detail-type="${type}"]`)) {
        const active = detail.dataset.detailItemId === selected;
        detail.classList.toggle("active", active);
        detail.toggleAttribute("hidden", !active);
      }

      const empty = this.element.querySelector(`[data-empty-detail="${type}"]`);
      empty?.toggleAttribute("hidden", Boolean(selected));
    }
  }
}
