import { getShikigamiReference } from "../shikigami.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Define apenas o vínculo da ficha; não altera permissões ou tokens. */
export class NexusShikigamiConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(sheet) {
    super();
    this.sheet = sheet;
    this.actor = sheet.actor;
  }

  static DEFAULT_OPTIONS = {
    classes: ["nexus-shikigami-config"],
    tag: "form",
    window: {
      title: "Configurar shikigami",
      icon: "fa-solid fa-link",
      minimizable: false,
      resizable: false
    },
    position: { width: 460 },
    form: {
      handler: this.#onSubmit,
      closeOnSubmit: false,
      submitOnChange: false
    },
    actions: { cancelShikigami: this.#cancel }
  };

  static PARTS = {
    form: {
      template: "systems/nexus-jjk/templates/actor/shikigami-config.hbs"
    }
  };

  #saving = false;

  get #canEdit() {
    return Boolean(this.sheet.isEditable && game.user?.isGM && this.actor.type === "shikigami");
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const invokerId = this.actor.system.invokerId || "";
    const characters = this.#canEdit
      ? game.actors.filter(actor => actor.type === "character" && !actor.pack && !actor.compendium)
      : [];
    characters.sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
    const reference = this.#canEdit ? getShikigamiReference(this.actor) : null;
    return {
      ...context,
      id: this.id,
      editable: this.#canEdit,
      invokerId,
      hasNoInvoker: !invokerId,
      invalidInvoker: Boolean(invokerId && !characters.some(actor => actor.id === invokerId)),
      invokers: characters.map(actor => ({
        id: actor.id,
        name: actor.name,
        selected: actor.id === invokerId
      })),
      reference
    };
  }

  #setBusy(busy) {
    this.#saving = busy;
    for (const control of this.element.querySelectorAll("button, select")) {
      const cancel = control.dataset.action === "cancelShikigami";
      control.disabled = busy || (!this.#canEdit && !cancel);
    }
  }

  /** @this {NexusShikigamiConfig} */
  static async #onSubmit(event) {
    event.preventDefault();
    if (this.#saving) return;
    if (!this.#canEdit) {
      ui.notifications.warn("Apenas o mestre pode configurar o invocador do shikigami.");
      return;
    }
    const invokerId = this.element.querySelector('[name="invokerId"]')?.value;
    const invoker = invokerId ? game.actors.get(invokerId) : null;
    if (typeof invokerId !== "string" || (invokerId &&
        (!invoker || invoker.type !== "character" || invoker.pack || invoker.compendium))) {
      ui.notifications.warn("Selecione um personagem do mundo ou remova o vínculo.");
      return;
    }

    this.#setBusy(true);
    try {
      const updated = await this.actor.update({ "system.invokerId": invokerId });
      if (!updated) throw new Error("Não foi possível salvar o invocador do shikigami.");
      await this.close();
    } catch (error) {
      console.error("Nexus JJK | Não foi possível configurar o shikigami.", error);
      ui.notifications.error(error.message || "Não foi possível salvar o invocador do shikigami.");
      this.#setBusy(false);
    }
  }

  /** @this {NexusShikigamiConfig} */
  static #cancel() {
    if (!this.#saving) return this.close();
  }
}
