const PACK_ID = "nexus-jjk.livro-de-regras";
const UUID_PREFIX = `Compendium.${PACK_ID}.`;
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const ordered = documents => [...documents].sort((a, b) =>
  (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name, "pt-BR"));
const normalize = text => String(text ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Build the book's index from the documents the current user may read. */
export function buildReaderGroups(documents, folders, user) {
  const entries = ordered(documents).filter(entry => entry.testUserPermission(user, "OBSERVER"))
    .map(entry => ({
      id: entry.id, name: entry.name, folderId: entry.folder?.id ?? entry.folder ?? "",
      pages: ordered(entry.pages).filter(page => page.testUserPermission(user, "OBSERVER"))
        .map(page => ({ id: page.id, name: page.name }))
    })).filter(entry => entry.pages.length);
  const groups = ordered(folders).map(folder => ({
    id: folder.id, name: folder.name, entries: entries.filter(entry => entry.folderId === folder.id)
  }));
  const unfiled = entries.filter(entry => !groups.some(group => group.id === entry.folderId));
  if (unfiled.length) groups.push({ id: "unfiled", name: "Outros conteúdos", entries: unfiled });
  return groups.filter(group => group.entries.length);
}

/** Both current typed UUIDs and older compendium links retain their original IDs. */
export function parseReaderUuid(uuid) {
  if (!uuid?.startsWith(UUID_PREFIX)) return null;
  const parts = uuid.slice(UUID_PREFIX.length).split(".");
  if (parts[0] === "JournalEntry") parts.shift();
  const [entryId, pageType, pageId] = parts;
  if (!entryId || (pageType && (pageType !== "JournalEntryPage" || !pageId)) || parts.length > 3) return null;
  return { entryId, pageId: pageId ?? null };
}

/** A single native Foundry window for the index and every page of Sistemática. */
export class NexusCompendiumReader extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "nexus-compendium-reader",
    classes: ["nexus-compendium-reader"],
    collection: null,
    window: { title: "Sistemática", icon: "fa-solid fa-book-open", resizable: true },
    position: {
      width: Math.min(1280, window.innerWidth - 40),
      height: window.innerHeight - 60,
      top: 30,
      left: Math.max(20, (window.innerWidth - 1280) / 2)
    },
    actions: {
      openPage: function(_event, target) { return this.openPage(target.dataset.entryId, target.dataset.pageId); },
      previousPage: function() { return this.#step(-1); },
      nextPage: function() { return this.#step(1); },
      clearSearch: function() { this.#query = ""; this.#filterIndex(); this.element.querySelector("[data-reader-search]")?.focus(); }
    }
  };

  static PARTS = {
    reader: { template: "systems/nexus-jjk/templates/compendium/reader.hbs", scrollable: [".nexus-reader-navigation"] }
  };

  #entryId = null;
  #pageId = null;
  #query = "";
  #documents = null;
  #groups = [];
  #sequence = [];
  #controller = null;
  #anchor = null;
  #displayedPage = null;
  #scrollTop = 0;
  #collapsed = new Set();
  #initializedIndex = false;

  get collection() { return this.options.collection; }

  _canRender(options) {
    if (!this.collection?.visible) {
      if (options.force) ui.notifications.warn("Você não tem permissão para ler este compêndio.");
      return false;
    }
    return super._canRender(options);
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    let error = "";
    let current = null;
    try {
      // Keep data cached, but insert only the selected page's HTML and media in the DOM.
      this.#documents ??= this.collection.getDocuments().catch(error => { this.#documents = null; throw error; });
      const documents = await this.#documents;
      this.#groups = buildReaderGroups(documents, this.collection.folders, game.user);
      this.#sequence = this.#groups.flatMap(group => group.entries.flatMap(entry =>
        entry.pages.map(page => ({ entryId: entry.id, pageId: page.id }))));
      let selected = this.#sequence.find(page => page.entryId === this.#entryId && page.pageId === this.#pageId);
      selected ??= this.#sequence.find(page => page.entryId === this.#entryId) ?? this.#sequence[0];
      if (selected) {
        this.#entryId = selected.entryId;
        this.#pageId = selected.pageId;
        if (!this.#initializedIndex) {
          for (const group of this.#groups) {
            for (const entry of group.entries) {
              if (entry.id !== selected.entryId) this.#collapsed.add(`entry:${entry.id}`);
            }
          }
          this.#initializedIndex = true;
        }
        const entry = documents.find(document => document.id === selected.entryId);
        const page = entry.pages.get(selected.pageId);
        const html = page.type === "text"
          ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(page.text.content ?? "", {
            relativeTo: page, secrets: page.isOwner
          })
          : "<p>Esta página não possui conteúdo de texto.</p>";
        current = { ...selected, entryName: entry.name, pageName: page.name, html,
          position: this.#sequence.indexOf(selected) + 1, total: this.#sequence.length };
      }
    } catch (cause) {
      console.error("Nexus JJK | Não foi possível abrir a Sistemática.", cause);
      error = "Não foi possível carregar o livro. Feche esta janela e tente abrir novamente.";
    }
    const position = current ? current.position - 1 : -1;
    return { ...context, error, current,
      groups: this.#groups.map(group => ({ ...group, entries: group.entries.map(entry => ({
        ...entry, pages: entry.pages.map(page => ({ ...page,
          active: entry.id === this.#entryId && page.id === this.#pageId }))
      })) })),
      hasPrevious: position > 0, hasNext: position >= 0 && position < this.#sequence.length - 1
    };
  }

  async openPage(entryId, pageId = null, anchor = null) {
    this.#entryId = entryId;
    this.#pageId = pageId;
    this.#anchor = anchor;
    this.#collapsed.delete(`entry:${entryId}`);
    const group = this.#groups.find(group => group.entries.some(entry => entry.id === entryId));
    if (group) this.#collapsed.delete(`folder:${group.id}`);
    await this.render({ force: true });
    this.bringToFront();
  }

  async #step(offset) {
    const index = this.#sequence.findIndex(page => page.entryId === this.#entryId && page.pageId === this.#pageId);
    const next = this.#sequence[index + offset];
    if (index >= 0 && next) await this.openPage(next.entryId, next.pageId);
  }

  _preRender(context, options) {
    const content = this.element?.querySelector(".nexus-reader-content");
    this.#scrollTop = content?.scrollTop ?? 0;
    this.element?.querySelectorAll("video, audio").forEach(media => media.pause());
    return super._preRender(context, options);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this.#controller?.abort();
    const view = this.element.ownerDocument.defaultView;
    this.#controller = new view.AbortController();
    const signal = this.#controller.signal;
    this.element.querySelector("[data-reader-search]")?.addEventListener("input", event => {
      this.#query = event.target.value;
      this.#filterIndex();
    }, { signal });
    this.element.querySelectorAll("details").forEach(details => {
      const key = this.#detailsKey(details);
      details.open = !this.#collapsed.has(key);
      details.addEventListener("toggle", () => {
        if (this.#query) return;
        if (details.open) this.#collapsed.delete(key);
        else this.#collapsed.add(key);
      }, { signal });
    });
    this.#filterIndex();
    if (!this.#query && this.#displayedPage !== this.#pageId) {
      this.element.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest" });
    }
    const content = this.element.querySelector(".nexus-reader-content");
    if (content) {
      content.scrollTop = this.#displayedPage === this.#pageId ? this.#scrollTop : 0;
      if (this.#anchor) {
        const anchor = [...content.querySelectorAll("[id]")].find(element => element.id === this.#anchor);
        anchor?.scrollIntoView({ block: "start" });
      }
    }
    this.#anchor = null;
    this.#displayedPage = this.#pageId;
  }

  #detailsKey(details) {
    return details.hasAttribute("data-reader-entry")
      ? `entry:${details.dataset.readerEntry}` : `folder:${details.dataset.readerFolder}`;
  }

  #filterIndex() {
    const input = this.element.querySelector("[data-reader-search]");
    if (input && input.value !== this.#query) input.value = this.#query;
    const query = normalize(this.#query.trim());
    for (const group of this.element.querySelectorAll("[data-reader-folder]")) {
      const groupName = this.#groups.find(item => item.id === group.dataset.readerFolder)?.name ?? "";
      let groupVisible = false;
      for (const entry of group.querySelectorAll("[data-reader-entry]")) {
        const data = this.#groups.flatMap(group => group.entries).find(item => item.id === entry.dataset.readerEntry);
        let entryVisible = false;
        for (const button of entry.querySelectorAll('[data-action="openPage"]')) {
          const matches = !query || normalize(`${groupName} ${data?.name} ${button.textContent}`).includes(query);
          button.hidden = !matches;
          entryVisible ||= matches;
        }
        entry.hidden = !entryVisible;
        if (query && entryVisible) entry.open = true;
        else if (!query) entry.open = !this.#collapsed.has(this.#detailsKey(entry));
        groupVisible ||= entryVisible;
      }
      group.hidden = !groupVisible;
      if (query && groupVisible) group.open = true;
      else if (!query) group.open = !this.#collapsed.has(this.#detailsKey(group));
    }
    const empty = this.element.querySelector("[data-reader-no-results]");
    if (empty) empty.hidden = [...this.element.querySelectorAll("[data-reader-folder]")].some(group => !group.hidden);
  }

  _onClose(options) {
    this.#controller?.abort();
    this.element?.querySelectorAll("video, audio").forEach(media => media.pause());
    // Refetch on reopen so edits made to an unlocked book appear immediately.
    this.#documents = null;
    super._onClose(options);
  }
}

export function registerCompendiumReader() {
  // Foundry creates exactly one app for each pack after setup, using this public property.
  Hooks.once("setup", () => {
    const pack = game.packs.get(PACK_ID);
    if (pack) pack.applicationClass = NexusCompendiumReader;
  });
  Hooks.once("ready", () => {
    // Route book links from chat, journals, and sidebar search back into that same window.
    document.addEventListener("click", event => {
      if (event.button !== 0) return;
      const target = event.target.closest?.('a[data-link], [data-action="openDocumentSheet"]');
      if (!target) return;
      const uuid = target.closest("[data-uuid]")?.dataset.uuid;
      const selection = parseReaderUuid(uuid);
      if (!selection) return;
      const pack = game.packs.get(PACK_ID);
      const reader = pack?.apps.find(app => app instanceof NexusCompendiumReader);
      if (!reader) return;
      event.preventDefault();
      event.stopPropagation();
      void reader.openPage(selection.entryId, selection.pageId, target.dataset.hash).catch(error => {
        console.error("Nexus JJK | Não foi possível abrir o link do livro.", error);
        ui.notifications.error("Não foi possível abrir esta página da Sistemática.");
      });
    }, { capture: true });
  });
}
