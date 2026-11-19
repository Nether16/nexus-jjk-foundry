import assert from "node:assert/strict";
import test from "node:test";

const PACK_ID = "nexus-jjk.livro-de-regras";
let importId = 0;

class Collection extends Map {
  [Symbol.iterator]() { return this.values(); }
}

function page(id, name, { sort = 0, readable = true, content = `<p>${name}</p>`, owner = false } = {}) {
  return { id, name, sort, type: "text", text: { content }, isOwner: owner,
    testUserPermission: (_user, permission) => permission === "OBSERVER" && readable };
}

function entry(id, name, pages, { sort = 0, folder = null, readable = true } = {}) {
  return { id, name, sort, folder, pages: new Collection(pages.map(page => [page.id, page])),
    testUserPermission: (_user, permission) => permission === "OBSERVER" && readable,
    get sheet() { throw new Error("The reader must not open native journal sheets."); } };
}

async function setup(t) {
  const names = ["foundry", "window", "game", "ui", "Hooks", "document"];
  const originals = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  t.after(() => {
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });

  const hooks = new Map();
  const listeners = [];
  const enrichments = [];
  const warnings = [];
  const errors = [];
  class ApplicationV2 {
    constructor(options = {}) {
      this.options = options;
      this.contexts = [];
      this.frontCount = 0;
      this.pending = Promise.resolve();
    }
    _canRender() {}
    async _prepareContext() { return {}; }
    _onClose() {}
    render(options = {}) {
      const rendering = this.pending.then(async () => {
        if (this._canRender(options) !== false) this.contexts.push(await this._prepareContext(options));
        return this;
      });
      this.pending = rendering.catch(() => {});
      return rendering;
    }
    bringToFront() { this.frontCount++; }
  }
  globalThis.foundry = {
    applications: {
      api: { ApplicationV2, HandlebarsApplicationMixin: Parent => class extends Parent {} },
      ux: { TextEditor: { implementation: { async enrichHTML(content, options) {
        enrichments.push({ content, options });
        return `enriched:${content}`;
      } } } }
    }
  };
  globalThis.window = { innerWidth: 1600, innerHeight: 900 };
  globalThis.game = { user: { id: "reader" }, packs: new Map() };
  globalThis.ui = { notifications: { warn: message => warnings.push(message), error: message => errors.push(message) } };
  globalThis.Hooks = { once: (name, callback) => hooks.set(name, callback) };
  globalThis.document = { addEventListener: (...args) => listeners.push(args) };
  const api = await import(`../module/compendium-reader.mjs?test=${++importId}`);
  return { api, hooks, listeners, enrichments, warnings, errors };
}

function book(documents, folders = []) {
  let loads = 0;
  return { visible: true, apps: [], folders,
    async getDocuments() { loads++; return documents; },
    get loads() { return loads; } };
}

test("o índice respeita a ordem do livro e elimina entradas e páginas sem permissão", async t => {
  const { api } = await setup(t);
  const documents = [
    entry("later", "Combate", [page("p2", "Segundo", { sort: 20 }), page("p1", "Primeiro", { sort: 10 }),
      page("secret", "Segredo", { readable: false })], { sort: 20, folder: { id: "rules" } }),
    entry("first", "Personagem", [page("p3", "Ficha")], { sort: 10, folder: "rules" }),
    entry("hidden", "Oculto", [page("hidden-page", "Oculta")], { readable: false, folder: "world" }),
    entry("empty", "Sem páginas legíveis", [page("denied", "Não pode", { readable: false })], { folder: "world" }),
    entry("unfiled", "Avulso", [page("p4", "Referência")], { folder: "removed-folder" })
  ];
  const groups = api.buildReaderGroups(documents, [
    { id: "rules", name: "Sistemática", sort: 20 }, { id: "world", name: "Mundo", sort: 10 }
  ], game.user);
  assert.deepEqual(groups.map(group => [group.id, group.entries.map(entry => entry.id)]), [
    ["rules", ["first", "later"]], ["unfiled", ["unfiled"]]
  ]);
  assert.deepEqual(groups[0].entries[1].pages.map(page => page.id), ["p1", "p2"]);
  assert.deepEqual(documents.map(entry => entry.id), ["later", "first", "hidden", "empty", "unfiled"]);
});

test("pastas vazias desaparecem e pastas legíveis mantêm sua ordenação", async t => {
  const { api } = await setup(t);
  const documents = [entry("world", "História", [page("p1", "História")], { folder: "world" }),
    entry("rules", "Regras", [page("p2", "Combate")], { folder: "rules" })];
  assert.deepEqual(api.buildReaderGroups(documents, [
    { id: "rules", name: "Sistemática", sort: 20 }, { id: "empty", name: "Vazia", sort: 0 },
    { id: "world", name: "Mundo", sort: 10 }
  ], game.user).map(group => group.id), ["world", "rules"]);
});

test("UUIDs atuais e antigos preservam os IDs existentes e ficam limitados à Sistemática", async t => {
  const { api } = await setup(t);
  const prefix = `Compendium.${PACK_ID}.`;
  assert.deepEqual(api.parseReaderUuid(`${prefix}JournalEntry.original123.JournalEntryPage.page456`),
    { entryId: "original123", pageId: "page456" });
  assert.deepEqual(api.parseReaderUuid(`${prefix}original123`), { entryId: "original123", pageId: null });
  assert.deepEqual(api.parseReaderUuid(`${prefix}JournalEntry.original123`), { entryId: "original123", pageId: null });
  for (const uuid of [undefined, "", "JournalEntry.original123", "Compendium.other.pack.JournalEntry.original123",
    `${prefix}JournalEntry`, `${prefix}JournalEntry.original123.Item.page456`,
    `${prefix}JournalEntry.original123.JournalEntryPage`, `${prefix}JournalEntry.original123.JournalEntryPage.page456.extra`]) {
    assert.equal(api.parseReaderUuid(uuid), null, `Unexpected book selection for ${uuid}`);
  }
});

test("setup troca somente a interface do pack do Nexus antes da criação da janela", async t => {
  const env = await setup(t);
  const native = class NativeCompendium {};
  const target = { applicationClass: native };
  const other = { applicationClass: native };
  game.packs.set(PACK_ID, target);
  game.packs.set("other.rules", other);
  env.api.registerCompendiumReader();
  assert.equal(target.applicationClass, native);
  env.hooks.get("setup")();
  assert.equal(target.applicationClass, env.api.NexusCompendiumReader);
  assert.equal(other.applicationClass, native);
});

test("a leitura enriquece apenas a página selecionada e usa o mesmo cache e janela", async t => {
  const env = await setup(t);
  const first = page("p1", "Primeira", { content: "primeiro texto" });
  const selected = page("p2", "Segunda", { content: "segundo texto", owner: true, sort: 20 });
  const pack = book([entry("entry", "Regras", [first, selected])]);
  const reader = new env.api.NexusCompendiumReader({ collection: pack });
  await reader.openPage("entry", "p2");
  assert.equal(reader.contexts.at(-1).current.html, "enriched:segundo texto");
  assert.deepEqual(env.enrichments, [{ content: "segundo texto", options: { relativeTo: selected, secrets: true } }]);
  assert.equal(reader.contexts.at(-1).hasPrevious, true);
  assert.equal(reader.contexts.at(-1).hasNext, false);
  await reader.openPage("entry", "p1");
  assert.equal(reader.contexts.at(-1).current.pageId, "p1");
  assert.equal(reader.contexts.at(-1).hasNext, true);
  assert.equal(pack.loads, 1);
  assert.equal(reader.frontCount, 2);
  assert.deepEqual(env.enrichments.map(item => item.content), ["segundo texto", "primeiro texto"]);
});

test("página sem permissão recua para conteúdo legível e pack oculto não carrega o livro", async t => {
  const env = await setup(t);
  const pack = book([entry("entry", "Regras", [page("hidden", "Oculta", { readable: false }), page("public", "Pública")])]);
  const reader = new env.api.NexusCompendiumReader({ collection: pack });
  await reader.openPage("entry", "hidden");
  assert.equal(reader.contexts.at(-1).current.pageId, "public");
  assert.equal(env.enrichments.length, 1);
  assert.equal(env.enrichments[0].options.secrets, false);
  const hiddenPack = book([]);
  hiddenPack.visible = false;
  const hiddenReader = new env.api.NexusCompendiumReader({ collection: hiddenPack });
  await hiddenReader.render({ force: true });
  assert.equal(hiddenPack.loads, 0);
  assert.equal(hiddenReader.contexts.length, 0);
  assert.equal(env.warnings.length, 1);
});

test("navegação rápida mantém a última seleção e fechar permite recarregar as fontes", async t => {
  const env = await setup(t);
  const pack = book([entry("entry", "Regras", [page("p1", "Uma"), page("p2", "Duas", { sort: 10 })])]);
  const reader = new env.api.NexusCompendiumReader({ collection: pack });
  await Promise.all([reader.openPage("entry", "p1"), reader.openPage("entry", "p2")]);
  assert.equal(reader.contexts.at(-1).current.pageId, "p2");
  assert.equal(pack.loads, 1);
  reader._onClose({});
  await reader.openPage("entry", "p1");
  assert.equal(reader.contexts.at(-1).current.pageId, "p1");
  assert.equal(pack.loads, 2);
});

function clickEvent(uuid, { action = false, button = 0, hash } = {}) {
  const ancestor = { dataset: { uuid } };
  const target = { dataset: { hash }, closest: selector => selector === "[data-uuid]" ? ancestor : null };
  const event = { button, prevented: false, stopped: false,
    target: { closest: selector => selector.includes(action ? "openDocumentSheet" : "a[data-link]") ? target : null },
    preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } };
  return event;
}

test("links e resultados da busca abrem a mesma janela e preservam cliques em outros packs", async t => {
  const env = await setup(t);
  const reader = new env.api.NexusCompendiumReader({ collection: book([]) });
  const calls = [];
  t.mock.method(reader, "openPage", async (...args) => calls.push(args));
  game.packs.set(PACK_ID, { apps: [reader] });
  env.api.registerCompendiumReader();
  env.hooks.get("ready")();
  assert.equal(env.listeners.length, 1);
  const [eventName, listener, options] = env.listeners[0];
  assert.equal(eventName, "click");
  assert.equal(options.capture, true);
  const prefix = `Compendium.${PACK_ID}.JournalEntry.`;
  const pageLink = clickEvent(`${prefix}entry.JournalEntryPage.page`, { hash: "heading" });
  listener(pageLink);
  const sidebarLink = clickEvent(`${prefix}otherEntry`, { action: true });
  listener(sidebarLink);
  assert.deepEqual(calls, [["entry", "page", "heading"], ["otherEntry", null, undefined]]);
  assert.equal(pageLink.prevented && pageLink.stopped, true);
  assert.equal(sidebarLink.prevented && sidebarLink.stopped, true);
  const unrelated = clickEvent("Compendium.other.pack.JournalEntry.entry");
  listener(unrelated);
  const rightClick = clickEvent(`${prefix}entry`, { button: 2 });
  listener(rightClick);
  assert.equal(unrelated.prevented || unrelated.stopped, false);
  assert.equal(rightClick.prevented || rightClick.stopped, false);
  assert.equal(calls.length, 2);
});
