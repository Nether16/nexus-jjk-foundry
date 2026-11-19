import assert from "node:assert/strict";
import test from "node:test";

let moduleId = 0;

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

class Collection extends Map {
  find(predicate) { return [...this.values()].find(predicate); }
  filter(predicate) { return [...this.values()].filter(predicate); }
  [Symbol.iterator]() { return this.values(); }
}

async function setup(t, { userId = "gm", gmId = "gm" } = {}) {
  const originals = new Map(["game", "foundry", "Hooks", "fromUuid", "ui"].map(key =>
    [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  t.after(() => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });

  const hooks = new Map();
  const macros = new Collection();
  const documents = new Map();
  const deleted = [];
  const assigned = [];
  const errors = [];
  const warnings = [];
  t.mock.method(console, "error", (...args) => errors.push(args));

  const actor = { documentName: "Actor", type: "character", uuid: "Actor.hero", isOwner: true,
    items: new Collection() };
  const item = { documentName: "Item", type: "attack", id: "move", uuid: "Actor.hero.Item.move",
    name: "Golpe", img: "golpe.png", parent: actor };
  actor.items.set(item.id, item);
  documents.set(item.uuid, item);

  const user = { id: userId, isGM: userId === gmId, hotbar: {}, hasPermission: () => true,
    async assignHotbarMacro(macro, slot) {
      assigned.push({ macro, slot });
      if (environment.onAssign) await environment.onAssign(macro, slot);
      user.hotbar[slot] = macro.id;
    } };

  function macro(id, { uuid = item.uuid, author = userId, allowed = true, command,
    type = "script" } = {}) {
    const flags = { "nexus-jjk": { movementUuid: uuid } };
    const document = { id, name: item.name, img: item.img, type, author, flags,
      command: command ?? `await game.nexus.rollMovement(${JSON.stringify(item.uuid)});`,
      isOwner: true, canExecute: true,
      getFlag: (scope, key) => flags[scope]?.[key],
      canUserModify: (_user, action) => action !== "delete" || allowed,
      async update(changes) { Object.assign(document, changes); },
      async delete() { await MacroClass.deleteDocuments([id]); } };
    macros.set(id, document);
    return document;
  }

  const MacroClass = {
    canUserCreate: () => true,
    async create(data) {
      if (environment.onCreate) await environment.onCreate(data);
      const created = macro("created", { uuid: data.flags["nexus-jjk"].movementUuid,
        author: data.author, command: data.command });
      return created;
    },
    async deleteDocuments(ids) {
      if (environment.onDelete) await environment.onDelete(ids);
      deleted.push(...ids);
      for (const id of ids) macros.delete(id);
    }
  };

  const environment = { actor, item, user, macros, documents, deleted, assigned, errors, warnings,
    macro, hooks, removeItem() { documents.delete(item.uuid); actor.items.delete(item.id); } };
  globalThis.game = { user, users: { activeGM: gmId ? { id: gmId } : null }, macros };
  globalThis.foundry = { documents: { Macro: { implementation: MacroClass } },
    utils: { escapeHTML: value => value } };
  globalThis.Hooks = { on: (name, callback) => hooks.set(name, callback) };
  globalThis.fromUuid = async uuid => documents.get(uuid) ?? null;
  globalThis.ui = { notifications: { warn: message => warnings.push(message),
    error: message => errors.push(message) } };

  const api = await import(`../module/movement-macros.mjs?test=${++moduleId}`);
  api.registerMovementMacros();
  return Object.assign(environment, { api, fireDelete: (deletedItem = item, initiatingUser = "player") =>
    hooks.get("deleteItem")(deletedItem, {}, initiatingUser) });
}

test("excluir movimento remove todas as macros vinculadas, preservando as demais", async t => {
  const env = await setup(t);
  env.macro("player-macro", { author: "player" });
  env.macro("offline-macro", { author: "offline-player" });
  env.macro("manual-same-command", { uuid: undefined });
  // Remover explicitamente a flag simula uma macro manual de mesmo comando/nome.
  delete env.macros.get("manual-same-command").flags["nexus-jjk"].movementUuid;
  env.macro("other-move", { uuid: "Actor.hero.Item.other" });
  env.removeItem();

  await env.fireDelete();

  assert.deepEqual(env.deleted.sort(), ["offline-macro", "player-macro"]);
  assert.deepEqual([...env.macros.keys()].sort(), ["manual-same-command", "other-move"]);
});

test("excluir movimento de maldição também remove a macro", async t => {
  const env = await setup(t);
  env.actor.type = "curse";
  env.macro("curse-macro");
  env.removeItem();
  await env.fireDelete();
  assert.deepEqual(env.deleted, ["curse-macro"]);
});

test("itens de outros tipos, itens soltos e compêndios não apagam macros", async t => {
  const env = await setup(t);
  env.macro("keep");
  const invalidItems = [
    { ...env.item, type: "talent" },
    { ...env.item, parent: null },
    { ...env.item, parent: { ...env.actor, type: "npc" } },
    { ...env.item, parent: { ...env.actor, pack: "nexus.actors" } },
    { ...env.item, parent: { ...env.actor, compendium: {} } }
  ];
  for (const item of invalidItems) await env.fireDelete(item);
  assert.deepEqual(env.deleted, []);
  assert.equal(env.macros.has("keep"), true);
});

test("outro cliente não repete a limpeza executada pelo mestre ativo", async t => {
  const env = await setup(t, { userId: "player", gmId: "gm" });
  env.macro("keep");
  await env.fireDelete(env.item, "player");
  assert.deepEqual(env.deleted, []);
});

test("sem mestre, o solicitante limpa somente macros que pode excluir", async t => {
  const env = await setup(t, { userId: "player", gmId: null });
  env.macro("own");
  env.macro("not-owned", { author: "other", allowed: false });
  await env.fireDelete(env.item, "player");
  assert.deepEqual(env.deleted, ["own"]);
  assert.equal(env.macros.has("not-owned"), true);
});

test("sem mestre, outro jogador não executa a mesma exclusão", async t => {
  const env = await setup(t, { userId: "other", gmId: null });
  env.macro("keep");
  await env.fireDelete(env.item, "player");
  assert.deepEqual(env.deleted, []);
});

test("falha ao excluir macro é tratada sem rejeitar o hook", async t => {
  const env = await setup(t);
  env.macro("protected");
  env.onDelete = async () => { throw new Error("Servidor indisponível"); };
  await assert.doesNotReject(async () => env.fireDelete());
  assert.ok(env.errors.length > 0);
  assert.equal(env.macros.has("protected"), true);
  env.onDelete = undefined;
  await env.fireDelete();
  assert.deepEqual(env.deleted, ["protected"], "a fila continua após uma falha");
});

test("limpezas simultâneas no mesmo cliente não excluem duas vezes", async t => {
  const env = await setup(t);
  env.macro("linked");
  const started = deferred();
  const proceed = deferred();
  env.onDelete = async () => { started.resolve(); await proceed.promise; };
  const first = env.fireDelete();
  await started.promise;
  const second = env.fireDelete();
  proceed.resolve();
  await Promise.all([first, second]);
  assert.deepEqual(env.deleted, ["linked"]);
});

test("exclusão concluída em outro cliente não gera erro ao repetir a requisição", async t => {
  const env = await setup(t);
  env.macro("linked");
  env.onDelete = async ids => {
    for (const id of ids) env.macros.delete(id);
    throw new Error("Macro já removida por outro cliente");
  };
  await env.fireDelete();
  assert.equal(env.macros.size, 0);
  assert.deepEqual(env.errors, []);
});

test("exclusão parcial em outro cliente tenta novamente somente as macros restantes", async t => {
  const env = await setup(t);
  env.macro("first");
  env.macro("second");
  const requests = [];
  env.onDelete = async ids => {
    requests.push([...ids]);
    if (requests.length === 1) {
      env.macros.delete("first");
      throw new Error("Uma macro já foi removida por outro cliente");
    }
  };
  await env.fireDelete();
  assert.deepEqual(requests, [["first", "second"], ["second"]]);
  assert.equal(env.macros.size, 0);
  assert.deepEqual(env.errors, []);
});

test("macro criada enquanto o movimento é apagado não fica órfã", async t => {
  const env = await setup(t, { userId: "player", gmId: "gm" });
  const started = deferred();
  const proceed = deferred();
  env.onCreate = async () => { started.resolve(); await proceed.promise; };
  const assigning = env.api.assignMovementMacro(env.item.uuid, 1);
  await started.promise;
  env.removeItem();
  const deleting = env.fireDelete(env.item, "player");
  proceed.resolve();
  await Promise.all([assigning, deleting]);
  assert.equal(env.macros.size, 0);
  assert.equal(env.assigned.length, 0);
  assert.equal(env.deleted.includes("created"), true);
});

test("exclusão durante gravação da barra também remove a macro", async t => {
  const env = await setup(t, { userId: "player", gmId: null });
  const started = deferred();
  const proceed = deferred();
  env.onAssign = async () => { started.resolve(); await proceed.promise; };
  const assigning = env.api.assignMovementMacro(env.item.uuid, 1);
  await started.promise;
  env.removeItem();
  const deleting = env.fireDelete(env.item, "player");
  proceed.resolve();
  await Promise.all([assigning, deleting]);
  assert.equal(env.macros.size, 0);
  assert.equal(env.deleted.includes("created"), true);
});

test("criação normal mantém a macro e atribui o atalho solicitado", async t => {
  const env = await setup(t, { userId: "player", gmId: null });
  const created = await env.api.assignMovementMacro(env.item.uuid, 12);
  assert.equal(created?.getFlag("nexus-jjk", "movementUuid"), env.item.uuid);
  assert.equal(env.user.hotbar[12], created.id);
  assert.deepEqual(env.deleted, []);
});
