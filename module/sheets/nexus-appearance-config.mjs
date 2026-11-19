import {
  getAppearanceDefaults,
  COLOR_FIELDS,
  deriveAppearancePalette,
  normalizeAppearance,
  readAppearance,
  applyAppearance,
  getWallpaperChoices,
  canBrowseWallpapers,
  canImportWallpapers,
  importWallpaper,
  saveAppearance
} from "./nexus-appearance.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const wallpaperURL = path => {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return foundry.utils?.getRoute?.(encoded) ?? `/${encoded}`;
};

/** Configuração visual por personagem; a prévia não altera os dados da ficha. */
export class NexusAppearanceConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(sheet) {
    super();
    this.sheet = sheet;
    this.actor = sheet.actor;
    this.#draft = readAppearance(this.actor);
  }

  static DEFAULT_OPTIONS = {
    classes: ["nexus-appearance-config"],
    tag: "form",
    window: {
      title: "Aparência da ficha",
      icon: "fa-solid fa-palette",
      minimizable: false,
      resizable: false
    },
    position: { width: 460 },
    form: {
      handler: this.#onSubmit,
      closeOnSubmit: false,
      submitOnChange: false
    },
    actions: {
      refreshWallpapers: this.#refreshWallpapers,
      importWallpaper: this.#chooseWallpaper,
      resetAppearance: this.#resetAppearance,
      cancelAppearance: this.#cancelAppearance
    }
  };

  static PARTS = {
    form: {
      template: "systems/nexus-jjk/templates/actor/appearance-config.hbs"
    }
  };

  #draft;
  #choices = null;
  #controller = null;
  #closed = false;
  #saving = false;

  get #canEdit() {
    return Boolean(this.sheet.isEditable);
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    this.#choices ??= await getWallpaperChoices({ refresh: true });
    // Uma escolha já salva continua visível mesmo antes de o catálogo ser atualizado.
    const choices = [...this.#choices];
    if (!choices.some(choice => choice.value === this.#draft.wallpaper)) {
      choices.push({ value: this.#draft.wallpaper, label: "Wallpaper atual" });
    }
    return {
      ...context,
      id: this.id,
      editable: this.#canEdit,
      canBrowse: canBrowseWallpapers(),
      canImport: canImportWallpapers(),
      colors: COLOR_FIELDS.map(field => ({ ...field, value: this.#draft[field.key] })),
      wallpapers: choices.map(choice => ({
        ...choice,
        selected: choice.value === this.#draft.wallpaper
      })),
      wallpaper: wallpaperURL(this.#draft.wallpaper)
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this.#closed = false;
    this.#controller?.abort();
    const view = this.element.ownerDocument.defaultView;
    this.#controller = new view.AbortController();
    const update = event => {
      if (!event.target.matches("[data-appearance-color], [data-appearance-wallpaper]")) return;
      if (!this.#canEdit || this.#saving) return;
      this.#readForm();
      const source = event.target.name;
      if (source === "accent" || source === "cardBorder") {
        this.#draft = normalizeAppearance({
          ...this.#draft,
          ...deriveAppearancePalette(this.#draft[source], { source })
        });
      }
      this.#updatePresentation({ syncInputs: true });
      applyAppearance(this.sheet.element, this.#draft);
    };
    this.element.addEventListener("input", update, { signal: this.#controller.signal });
    this.element.addEventListener("change", update, { signal: this.#controller.signal });
    this.element.querySelector("[data-wallpaper-upload]")?.addEventListener("change", event => {
      void this.#uploadWallpaper(event.currentTarget);
    }, { signal: this.#controller.signal });
    this.element.addEventListener("keydown", event => {
      if (event.key !== "Escape" || this.#saving) return;
      event.preventDefault();
      event.stopPropagation();
      this.close();
    }, { signal: this.#controller.signal });
    this.#updatePresentation();
  }

  _onClose(options) {
    this.#closed = true;
    this.#controller?.abort();
    this.#controller = null;
    // Fechar pelo X, Cancelar ou Escape descarta apenas a prévia não salva.
    applyAppearance(this.sheet.element, readAppearance(this.actor));
    super._onClose(options);
  }

  #readForm() {
    const values = { ...this.#draft };
    for (const field of COLOR_FIELDS) {
      const input = this.element.querySelector(`[name="${field.key}"]`);
      if (input) values[field.key] = input.value;
    }
    const wallpaper = this.element.querySelector("[data-appearance-wallpaper]");
    if (wallpaper) values.wallpaper = wallpaper.value;
    this.#draft = normalizeAppearance(values);
    return this.#draft;
  }

  #updatePresentation({ syncInputs = false } = {}) {
    for (const field of COLOR_FIELDS) {
      const input = this.element.querySelector(`[name="${field.key}"]`);
      const output = this.element.querySelector(`[data-color-value="${field.key}"]`);
      if (syncInputs && input) input.value = this.#draft[field.key];
      if (output) output.textContent = this.#draft[field.key].toUpperCase();
    }
    const wallpaper = this.element.querySelector("[data-appearance-wallpaper]");
    if (syncInputs && wallpaper) wallpaper.value = this.#draft.wallpaper;
    const preview = this.element.querySelector("[data-wallpaper-preview]");
    if (preview) preview.src = wallpaperURL(this.#draft.wallpaper);
  }

  #setBusy(busy) {
    this.#saving = busy;
    for (const control of this.element.querySelectorAll("button, input, select")) {
      const cancel = control.dataset.action === "cancelAppearance";
      const importControl = control.dataset.action === "importWallpaper" || control.hasAttribute("data-wallpaper-upload");
      control.disabled = busy || (!this.#canEdit && !cancel) || (importControl && !canImportWallpapers());
    }
  }

  async #uploadWallpaper(input) {
    const file = input.files?.[0];
    input.value = "";
    if (!file || this.#saving || !this.#canEdit || !canImportWallpapers()) return;
    this.#readForm();
    this.#setBusy(true);
    try {
      const choice = await importWallpaper(this.actor, file);
      if (this.#closed) return;
      this.#draft = normalizeAppearance({ ...this.#draft, wallpaper: choice.value });
      this.#choices = [...(this.#choices ?? []).filter(entry => entry.value !== choice.value), choice];
      applyAppearance(this.sheet.element, this.#draft);
      await this.render({ force: true });
    } catch (error) {
      console.error("Nexus JJK | Não foi possível importar o wallpaper.", error);
      if (!this.#closed) ui.notifications.error(error.message || "Não foi possível importar o wallpaper.");
    } finally {
      if (!this.#closed) this.#setBusy(false);
    }
  }

  /** @this {NexusAppearanceConfig} */
  static async #onSubmit(event) {
    event.preventDefault();
    if (this.#saving) return;
    if (!this.#canEdit) {
      await this.close();
      return;
    }
    this.#readForm();
    this.#setBusy(true);
    try {
      this.#draft = await saveAppearance(this.actor, this.#draft);
      applyAppearance(this.sheet.element, this.#draft);
      if (this.#closed) return;
      await this.close();
    } catch (error) {
      console.error("Nexus JJK | Não foi possível salvar a aparência da ficha.", error);
      if (!this.#closed) {
        ui.notifications.error("Não foi possível salvar a aparência da ficha.");
        this.#setBusy(false);
      }
    }
  }

  /** @this {NexusAppearanceConfig} */
  static async #refreshWallpapers() {
    if (this.#saving || !this.#canEdit || !canBrowseWallpapers()) return;
    this.#readForm();
    const choices = await getWallpaperChoices({ refresh: true });
    if (this.#closed) return;
    this.#choices = choices;
    await this.render({ force: true });
  }

  /** @this {NexusAppearanceConfig} */
  static #chooseWallpaper() {
    if (!this.#saving && this.#canEdit && canImportWallpapers()) {
      this.element.querySelector("[data-wallpaper-upload]")?.click();
    }
  }

  /** @this {NexusAppearanceConfig} */
  static #resetAppearance() {
    if (!this.#canEdit || this.#saving) return;
    this.#draft = normalizeAppearance(getAppearanceDefaults(this.actor));
    this.#updatePresentation({ syncInputs: true });
    applyAppearance(this.sheet.element, this.#draft);
  }

  /** @this {NexusAppearanceConfig} */
  static #cancelAppearance() {
    if (!this.#saving) return this.close();
  }
}
