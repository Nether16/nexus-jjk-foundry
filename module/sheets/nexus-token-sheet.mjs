const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

/** Uma ficha de biblioteca: nome, arte e o configurador nativo do token. */
export class NexusTokenSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["nexus-token-sheet"],
    position: { width: 360, height: 460 },
    window: { resizable: true },
    form: { closeOnSubmit: false, submitOnChange: true },
    actions: {
      chooseTokenImage: this.#chooseTokenImage,
      configureTokenSettings: this.#configureTokenSettings
    }
  };

  static PARTS = {
    form: { template: "systems/nexus-jjk/templates/actor/token-sheet.hbs" }
  };

  #closed = false;
  #pickerGeneration = 0;

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const image = this.actor.token?.texture?.src || this.actor.prototypeToken?.texture?.src ||
      this.actor.img || "icons/svg/mystery-man.svg";
    const preview = image.includes("*") ? this.actor.img || "icons/svg/mystery-man.svg" : image;
    return {
      ...context,
      actor: this.actor,
      name: this.actor.token?.name ?? this.actor.name,
      image,
      preview,
      isVideo: /\.(?:mp4|webm|m4v|ogv|ogg)(?:$|[?#])/iu.test(preview),
      editable: Boolean(this.isEditable && this.actor.isOwner)
    };
  }

  async _processSubmitData(event, form, submitData, options = {}) {
    if (!this.isEditable || !this.actor.isOwner || this.#closed) return {};
    const result = await super._processSubmitData(event, form, submitData, options);
    if (this.actor.isToken) {
      const changes = {};
      if (typeof submitData.name === "string") changes.name = submitData.name;
      const image = submitData.prototypeToken?.texture?.src ?? submitData["prototypeToken.texture.src"];
      if (typeof image === "string") changes["texture.src"] = image.trim() || this.actor.prototypeToken.texture.src;
      if (Object.keys(changes).length) {
        await this.actor.token.update(changes);
        if (!this.#closed) await this.render({ force: true });
      }
    }
    return result;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this.#closed = false;
  }

  _onClose(options) {
    this.#closed = true;
    this.#pickerGeneration++;
    this.element?.querySelectorAll("video").forEach(video => video.pause());
    return super._onClose(options);
  }

  static async #chooseTokenImage() {
    if (!this.isEditable || !this.actor.isOwner || this.#closed) return;
    const actor = this.actor;
    const generation = ++this.#pickerGeneration;
    const FilePicker = foundry.applications.apps.FilePicker.implementation;
    try {
      const picker = new FilePicker({
        current: actor.img,
        type: "image",
        document: actor,
        callback: async path => {
          if (this.#closed || generation !== this.#pickerGeneration || this.actor !== actor ||
              !this.isEditable || !actor.isOwner || typeof path !== "string" || !path.trim()) return;
          try {
            await actor.update({ img: path.trim() });
            if (actor.isToken) {
              await actor.token.update({ "texture.src": path.trim() });
              if (!this.#closed) await this.render({ force: true });
            }
          } catch (error) {
            console.error("Nexus JJK | Não foi possível alterar a imagem do token.", error);
            ui.notifications.error("Não foi possível salvar a imagem do token.");
          }
        },
        position: { top: this.position.top + 40, left: this.position.left + 10 }
      });
      await picker.browse();
    } catch (error) {
      console.error("Nexus JJK | Não foi possível abrir o seletor de imagem do token.", error);
      ui.notifications.error("Não foi possível abrir o seletor. Você pode colar o link no campo Imagem.");
    }
  }

  static #configureTokenSettings() {
    if (!this.isEditable || !this.actor.isOwner || this.#closed) return;
    if (this.actor.isToken) return this.actor.token?.sheet.render({ force: true });
    return new CONFIG.Token.prototypeSheetClass({ prototype: this.actor.prototypeToken })
      .render({ force: true });
  }
}
