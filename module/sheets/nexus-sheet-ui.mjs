/**
 * Interações locais da ficha e anotações salvas nas flags do personagem.
 * Uma instância pertence a uma janela; as escritas de anotações são enfileiradas
 * sem renderizar a ficha nem interromper a edição.
 */
export class NexusSheetUI {
  #root = null;
  #controller = null;
  #editable = true;
  #collections = new Map();
  #drafts = new Map();
  #editorBindings = new WeakMap();
  #boundEditors = new Set();
  #movementImages = new Map();
  #lifetime = 0;
  #actor = null;
  #notesSnapshot = null;
  #queuedNotes = null;
  #writingNotes = false;
  #notesWrite = Promise.resolve();

  attach(root, { editable = true, actor = null } = {}) {
    this.#captureEditors();
    this.#boundEditors.clear();
    this.#controller?.abort();
    this.#root = root;
    this.#editable = editable;
    this.#actor = actor;
    if (!root?.querySelectorAll) return;

    const view = root.ownerDocument.defaultView;
    this.#controller = new view.AbortController();
    const signal = this.#controller.signal;
    root.addEventListener("click", event => this.#onClick(event), { signal });
    // Captura antes do formulário para não disparar seu submitOnChange.
    root.addEventListener("input", event => this.#onInput(event), { signal, capture: true });
    root.addEventListener("change", event => this.#onChange(event), { signal, capture: true });

    for (const collection of root.querySelectorAll("[data-ui-collection]")) {
      this.#prepareCollection(collection);
    }
    for (const editor of root.querySelectorAll("prose-mirror[data-ui-draft]")) {
      const key = editor.dataset.uiDraft;
      if (!this.#drafts.has(key)) this.#drafts.set(key, editor.value ?? "");
      this.#bindEditor(editor, key, this.#drafts.get(key), value => this.#drafts.set(key, value));
    }
    for (const [index, button] of this.#movementButtons().entries()) {
      this.#paintImage(button, this.#movementImages.get(index) ?? "");
      this.#setEditable(button);
    }
  }

  destroy() {
    this.#captureEditors();
    this.#controller?.abort();
    this.#controller = null;
    this.#root = null;
    this.#collections.clear();
    this.#drafts.clear();
    this.#boundEditors.clear();
    this.#editorBindings = new WeakMap();
    this.#movementImages.clear();
    this.#lifetime++;
    this.#actor = null;
    this.#notesSnapshot = null;
  }

  async flush() {
    this.#captureEditors();
    await this.#notesWrite;
  }

  #queueNotes(state) {
    if (!this.#actor || !this.#editable) return;
    const notes = [...state.entries].map(([id, entry]) => ({ id, ...entry }));
    const snapshot = JSON.stringify(notes);
    if (snapshot === this.#notesSnapshot) return;
    this.#notesSnapshot = snapshot;
    this.#queuedNotes = { actor: this.#actor, notes, snapshot };
    if (this.#writingNotes) return;
    this.#writingNotes = true;
    this.#notesWrite = this.#writeNotes();
  }

  async #writeNotes() {
    try {
      while (this.#queuedNotes) {
        const { actor, notes, snapshot } = this.#queuedNotes;
        this.#queuedNotes = null;
        try {
          await actor.update({ "flags.nexus-jjk.notes": notes }, { render: false });
        } catch (error) {
          if (this.#notesSnapshot === snapshot) this.#notesSnapshot = null;
          console.error("Nexus JJK | Não foi possível salvar as anotações.", error);
          globalThis.ui?.notifications?.error("Não foi possível salvar as anotações.");
        }
      }
    } finally {
      this.#writingNotes = false;
    }
  }

  #prepareCollection(collection) {
    const key = collection.dataset.uiCollection;
    let state = this.#collections.get(key);
    if (!state) {
      state = { entries: new Map(), selected: null, nextId: 1 };
      if (key === "notes" && this.#actor) {
        const saved = this.#actor.getFlag?.("nexus-jjk", "notes");
        for (const entry of Array.isArray(saved) ? saved : []) {
          if (!entry || typeof entry.id !== "string" || !entry.id || state.entries.has(entry.id)) continue;
          state.entries.set(entry.id, {
            title: typeof entry.title === "string" ? entry.title : "",
            content: typeof entry.content === "string" ? entry.content : "",
            image: typeof entry.image === "string" ? entry.image : ""
          });
        }
        state.selected = state.entries.keys().next().value ?? null;
        this.#notesSnapshot = JSON.stringify([...state.entries].map(([id, entry]) => ({ id, ...entry })));
      }
      this.#collections.set(key, state);
    }
    const buttons = [...collection.querySelectorAll("[data-ui-entry]")];
    for (const [index, button] of buttons.entries()) {
      const id = button.dataset.uiEntry || `visual-${index + 1}`;
      button.dataset.uiEntry = id;
      if (!this.#actor && !state.entries.has(id)) {
        state.entries.set(id, { title: "", content: "", image: "" });
      }
      const number = Number(id.match(/^visual-(\d+)$/)?.[1]);
      if (number) state.nextId = Math.max(state.nextId, number + 1);
      if (!state.selected && (button.classList.contains("selecionado") || index === 0)) {
        state.selected = id;
      }
    }
    this.#renderCollection(collection, state);
  }

  #renderCollection(collection, state) {
    const list = collection.querySelector(".lista-lateral");
    const template = list?.querySelector("[data-ui-entry-template]")?.content.querySelector("[data-ui-entry]")
      ?? list?.querySelector("[data-ui-entry]");
    if (!list || !template) return;
    const existing = new Map([...list.querySelectorAll("[data-ui-entry]")]
      .map(button => [button.dataset.uiEntry, button]));
    for (const [id, button] of existing) {
      if (!state.entries.has(id)) button.remove();
    }

    for (const [id, entry] of state.entries) {
      let button = existing.get(id);
      if (!button) {
        button = template.cloneNode(true);
        button.dataset.uiEntry = id;
        list.append(button);
      }
      this.#paintEntry(button, entry, state.selected === id, collection.dataset.uiCollection);
    }

    const currentId = state.selected;
    const current = state.entries.get(currentId);
    const title = collection.querySelector("[data-ui-title]");
    let editor = collection.querySelector("prose-mirror[data-ui-content]");
    if (title) {
      title.value = current?.title ?? "";
      title.disabled = !this.#editable || !current;
    }
    if (editor) {
      editor = this.#bindEditor(editor, current ?? null, current?.content ?? "", value => {
        if (!this.#editable || !current || state.entries.get(currentId) !== current || current.content === value) return;
        current.content = value;
        if (collection.dataset.uiCollection === "notes") this.#queueNotes(state);
      });
      editor.disabled = !this.#editable || !current;
      editor.hidden = !current;
    }
    const header = collection.querySelector(".detalhe-cabecalho");
    if (header) header.hidden = !current;
    const empty = collection.querySelector("[data-ui-empty]");
    if (empty) empty.hidden = Boolean(current);
    const imageButton = collection.querySelector("[data-ui-image]");
    if (imageButton) {
      this.#paintImage(imageButton, current?.image ?? "");
      this.#setEditable(imageButton);
      imageButton.disabled ||= !current;
    }
    const addButton = collection.querySelector("[data-ui-add]");
    if (addButton) this.#setEditable(addButton);
    const deleteButton = collection.querySelector("[data-ui-delete]");
    if (deleteButton) {
      this.#setEditable(deleteButton);
      deleteButton.disabled ||= !current;
    }
  }

  #paintEntry(button, entry, selected, collectionKey) {
    button.disabled = false;
    button.classList.toggle("selecionado", selected);
    button.setAttribute("aria-pressed", String(selected));
    button.setAttribute("aria-disabled", String(Boolean(button.disabled)));
    const label = collectionKey === "notes" ? "Selecionar anotação" : "Selecionar item";
    button.setAttribute("aria-label", entry.title.trim() ? `${label}: ${entry.title}` : label);

    const name = button.querySelector(".entrada-nome");
    const hasName = Boolean(entry.title.trim());
    if (name) {
      name.textContent = entry.title;
      name.hidden = !hasName;
    }
    const skeleton = button.querySelector(".entrada-linhas");
    if (skeleton) {
      if (name && skeleton.contains(name)) {
        for (const line of skeleton.children) {
          if (line !== name) line.hidden = hasName;
        }
      } else {
        skeleton.hidden = hasName;
      }
    }
    const thumbnail = button.querySelector("[data-ui-entry-image], .miniatura-visual");
    if (thumbnail) this.#paintImage(thumbnail, entry.image);
  }

  #paintImage(container, image) {
    let element = container.querySelector("img");
    if (!element) {
      element = container.ownerDocument.createElement("img");
      element.alt = "";
      container.prepend(element);
    }
    if (image) element.src = image;
    else element.removeAttribute("src");
    element.hidden = !image;
    for (const placeholder of container.querySelectorAll("i")) {
      placeholder.hidden = Boolean(image);
    }
  }

  #selectEntry(collection, id) {
    const state = this.#collections.get(collection.dataset.uiCollection);
    if (!state?.entries.has(id)) return;
    this.#captureEditors();
    state.selected = id;
    this.#renderCollection(collection, state);
  }

  #addEntry(collection) {
    const state = this.#collections.get(collection.dataset.uiCollection);
    if (!state) return;
    this.#captureEditors();
    let id;
    do { id = `visual-${state.nextId++}`; } while (state.entries.has(id));
    state.entries.set(id, { title: "Nova anotação", content: "", image: "" });
    state.selected = id;
    this.#renderCollection(collection, state);
    if (collection.dataset.uiCollection === "notes") this.#queueNotes(state);
    collection.querySelector("[data-ui-title]")?.focus();
  }

  async #deleteEntry(collection) {
    const state = this.#collections.get(collection.dataset.uiCollection);
    const id = state?.selected;
    const entry = state?.entries.get(id);
    if (!entry || !this.#editable) return;
    this.#captureEditors();
    const lifetime = this.#lifetime;
    const name = collection.ownerDocument.createElement("strong");
    name.textContent = entry.title.trim() || "Anotação";
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Excluir anotação" },
      content: `<p>Excluir ${name.outerHTML}?</p>`,
      rejectClose: false,
      modal: true
    });
    if (!confirmed || !this.#editable || lifetime !== this.#lifetime || !state.entries.has(id)) return;
    this.#captureEditors();
    const order = [...state.entries.keys()];
    const index = order.indexOf(id);
    state.entries.delete(id);
    if (state.selected === id) state.selected = order[index + 1] ?? order[index - 1] ?? null;
    const activeCollection = [...this.#root.querySelectorAll("[data-ui-collection]")]
      .find(node => node.dataset.uiCollection === collection.dataset.uiCollection);
    if (activeCollection) this.#renderCollection(activeCollection, state);
    if (collection.dataset.uiCollection === "notes") this.#queueNotes(state);
  }

  #onClick(event) {
    const target = event.target;
    if (!target?.closest) return;
    const collection = target.closest("[data-ui-collection]");
    if (collection && target.closest("[data-ui-delete]")) {
      if (!this.#editable) return;
      event.preventDefault();
      void this.#deleteEntry(collection);
      return;
    }
    const thumbnail = target.closest("[data-ui-entry-image]");
    if (thumbnail && collection && this.#editable) {
      event.preventDefault();
      const entry = thumbnail.closest("[data-ui-entry]");
      this.#selectEntry(collection, entry.dataset.uiEntry);
      this.#openImage(collection.querySelector("[data-ui-image]"), collection);
      return;
    }
    const imageButton = target.closest("[data-ui-image]");
    if (imageButton) {
      if (!this.#editable) return;
      event.preventDefault();
      this.#openImage(imageButton, collection);
      return;
    }
    if (collection && target.closest("[data-ui-add]")) {
      if (!this.#editable) return;
      event.preventDefault();
      this.#addEntry(collection);
      return;
    }
    const entry = target.closest("[data-ui-entry]");
    if (entry && collection) {
      event.preventDefault();
      this.#selectEntry(collection, entry.dataset.uiEntry);
    }
  }

  #onInput(event) {
    const target = event.target;
    if (!this.#isVisualField(target)) return;
    event.stopPropagation();
    if (!this.#editable) return;
    const collection = target.closest("[data-ui-collection]");
    if (!collection) return;
    const state = this.#collections.get(collection.dataset.uiCollection);
    const current = state?.entries.get(state.selected);
    if (!current) return;
    if (target.closest("[data-ui-title]")) {
      current.title = target.closest("[data-ui-title]").value;
      if (collection.dataset.uiCollection === "notes") this.#queueNotes(state);
      for (const button of collection.querySelectorAll("[data-ui-entry]")) {
        if (button.dataset.uiEntry === state.selected) {
          this.#paintEntry(button, current, true, collection.dataset.uiCollection);
        }
      }
    }
  }

  #onChange(event) {
    const target = event.target;
    if (!this.#isVisualField(target)) return;
    event.stopPropagation();
    this.#onInput(event);
  }

  #isVisualField(target) {
    if (!target?.closest?.(".conteudo-abas")) return false;
    // O editor nativo gerencia o conteúdo e os controles internos dele.
    if (target.closest("prose-mirror")) return false;
    const field = target.closest("input, select, [contenteditable]");
    return Boolean(field && !field.hasAttribute("name") &&
      !field.closest("[data-item-field], [data-actor-field], [data-origin-select], [data-origin-variant]"));
  }

  #captureEditors() {
    for (const editor of this.#boundEditors) {
      this.#editorBindings.get(editor)?.save(editor.value ?? "");
    }
  }

  #bindEditor(editor, identity, value, save) {
    const binding = this.#editorBindings.get(editor);
    editor.disabled = !this.#editable;
    if (binding?.identity === identity) {
      this.#boundEditors.add(editor);
      return editor;
    }

    // Um editor ativo não pode receber novo HTML sem recriar o estado do ProseMirror.
    if (editor.classList.contains("active") && (binding || editor.value !== value)) {
      const replacement = editor.constructor.create({
        name: "",
        value,
        disabled: !this.#editable,
        documentUUID: editor.dataset.documentUuid ?? editor.dataset.documentUUID,
        toggled: editor.hasAttribute("toggled")
      });
      for (const attribute of editor.attributes) {
        if (/^(data-|aria-)/u.test(attribute.name) || ["id", "style", "role"].includes(attribute.name)) {
          replacement.setAttribute(attribute.name, attribute.value);
        }
      }
      for (const name of editor.classList) {
        if (!["active", "inactive", "editor", "prosemirror"].includes(name)) replacement.classList.add(name);
      }
      replacement.removeAttribute("name");
      this.#bindEditor(replacement, identity, value, save);
      this.#boundEditors.delete(editor);
      editor.replaceWith(replacement);
      return replacement;
    }

    if (binding) editor.removeEventListener("change", binding.listener);
    const lifetime = this.#lifetime;
    const listener = event => {
      if (event.target !== editor) return;
      event.stopPropagation();
      if (lifetime === this.#lifetime) save(editor.value ?? "");
    };
    this.#editorBindings.set(editor, { identity, save, listener });
    this.#boundEditors.add(editor);
    // Listener direto continua recebendo o save emitido ao remover o elemento da ficha.
    editor.addEventListener("change", listener);
    if (editor.value !== value) editor.value = value;
    return editor;
  }

  async #openImage(button, collection) {
    if (!button || !this.#editable || this.#actor?.isOwner === false) return;
    const descriptor = this.#imageDescriptor(button, collection);
    if (!descriptor) return;
    const lifetime = this.#lifetime;
    const actor = this.#actor;
    const current = descriptor.kind === "collection"
      ? this.#collections.get(descriptor.key)?.entries.get(descriptor.id)?.image
      : this.#movementImages.get(descriptor.index);
    try {
      const picker = new FilePicker.implementation({
        // Imagens antigas embutidas continuam visíveis, sem virar uma pasta no seletor.
        current: current?.startsWith("data:") ? "" : current ?? "",
        type: "image",
        document: actor,
        callback: image => {
          if (!this.#editable || !this.#root || lifetime !== this.#lifetime ||
              actor !== this.#actor || actor?.isOwner === false || typeof image !== "string") return;
          const path = image.trim();
          if (path) this.#applyImage(descriptor, path);
        }
      });
      await picker.browse();
    } catch (error) {
      console.error("Nexus JJK | Não foi possível abrir o seletor de imagem.", error);
      globalThis.ui?.notifications?.error("Não foi possível abrir o seletor de imagem.");
    }
  }

  #imageDescriptor(button, collection = button.closest("[data-ui-collection]")) {
    if (collection) {
      const key = collection.dataset.uiCollection;
      const state = this.#collections.get(key);
      return state?.selected ? { kind: "collection", key, id: state.selected } : null;
    }
    const index = this.#movementButtons().indexOf(button);
    return index >= 0 ? { kind: "movement", index } : null;
  }

  #applyImage(descriptor, image) {
    if (descriptor.kind === "collection") {
      const state = this.#collections.get(descriptor.key);
      const entry = state?.entries.get(descriptor.id);
      if (!entry) return;
      entry.image = image;
      if (descriptor.key === "notes") this.#queueNotes(state);
      const collection = [...this.#root.querySelectorAll("[data-ui-collection]")]
        .find(node => node.dataset.uiCollection === descriptor.key);
      if (collection) {
        const button = [...collection.querySelectorAll("[data-ui-entry]")]
          .find(node => node.dataset.uiEntry === descriptor.id);
        if (button) this.#paintEntry(button, entry, state.selected === descriptor.id, descriptor.key);
        if (state.selected === descriptor.id) {
          const imageButton = collection.querySelector("[data-ui-image]");
          if (imageButton) this.#paintImage(imageButton, image);
        }
      }
    } else {
      this.#movementImages.set(descriptor.index, image);
      const button = this.#movementButtons()[descriptor.index];
      if (button) this.#paintImage(button, image);
    }
  }

  #movementButtons() {
    return this.#root ? [...this.#root.querySelectorAll(".movimentos-visual [data-ui-image]")] : [];
  }

  #setEditable(button) {
    button.disabled = !this.#editable;
    button.setAttribute("aria-disabled", String(!this.#editable));
  }
}
