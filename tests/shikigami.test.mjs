import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

// Os stubs representam apenas os serviços do Foundry usados pelas regras abaixo.
class Field {
  constructor(options = {}) { this.options = options; }
}
class SchemaField extends Field {
  constructor(fields, options = {}) { super(options); this.fields = fields; }
}
function initialData(fields) {
  return Object.fromEntries(Object.entries(fields).map(([key, field]) => [key,
    field instanceof SchemaField ? initialData(field.fields) : structuredClone(field.options.initial)]));
}
class TypeDataModel {
  constructor(data = {}) { Object.assign(this, initialData(this.constructor.defineSchema()), data); }
  prepareDerivedData() {}
}
class Collection extends Map {
  [Symbol.iterator]() { return this.values(); }
  filter(predicate) { return [...this.values()].filter(predicate); }
  find(predicate) { return [...this.values()].find(predicate); }
  get contents() { return [...this.values()]; }
}
class BaseActor {
  constructor(data = {}) {
    Object.assign(this, { documentName: "Actor", id: "summon", uuid: "Actor.summon", isOwner: true,
      items: new Collection(), system: {}, ...data });
    this._source = structuredClone({ type: this.type, system: this.system });
    this.prototypeToken = { _source: {}, texture: {}, updateSource() {} };
    Object.defineProperty(this.system, "parent", { value: this, configurable: true });
  }
  async _preCreate() { return true; }
  async _preUpdate() { return true; }
  getRollData() { return structuredClone(this.system); }
  prepareData() {
    this.prepareCount = (this.prepareCount ?? 0) + 1;
    this.system.prepareDerivedData?.();
  }
}

globalThis.Actor = BaseActor;
globalThis.Item = class {};
globalThis.foundry = {
  abstract: { TypeDataModel },
  data: { fields: { BooleanField: Field, FilePathField: Field, HTMLField: Field,
    NumberField: Field, SchemaField, StringField: Field } },
  utils: { getProperty: (object, path) => path.split(".").reduce((value, key) => value?.[key], object) }
};

const { NexusCharacterData, NexusShikigamiData } = await import("../module/data-models.mjs");
const { NexusActor } = await import("../module/documents.mjs");
const { NexusFormulaEngine } = await import("../module/formula-engine.mjs");
const { getShikigamiInvoker, getShikigamiReference, registerShikigamiReferenceSync } = await import("../module/shikigami.mjs");

let environment;
beforeEach(() => {
  environment = { warnings: [], errors: [], messages: [], updates: [], rolls: [], prompts: [] };
  globalThis.game = { user: { id: "gm", isGM: true }, actors: new Collection(),
    settings: { get: () => "public" } };
  globalThis.ui = { notifications: {
    warn: message => environment.warnings.push(message), error: message => environment.errors.push(message)
  } };
  globalThis.ChatMessage = {
    getSpeaker: ({ actor }) => ({ actor: actor.id }),
    async create(message) { environment.messages.push(message); return message; }
  };
  globalThis.Roll = class {
    constructor(formula) { this.formula = formula; environment.rolls.push(formula); }
    static safeEval(formula) {
      if (!/^[\d\s.+*/()%-]+$/u.test(formula)) throw new Error("Expressão de teste inválida");
      return Function(`"use strict"; return (${formula});`)();
    }
    async evaluate() { this.total = Roll.safeEval(this.formula.replace(/1d20/giu, "10")); return this; }
    async render() { return `<span>${this.total}</span>`; }
  };
  foundry.applications = { api: { DialogV2: {
    async input(options) { environment.prompts.push(options); return { value: "1" }; }
  } } };
});

const gm = { id: "gm", isGM: true };
const player = { id: "player", isGM: false };
function shikigami(data = {}) {
  const system = new NexusShikigamiData();
  const actor = new NexusActor({ type: "shikigami", system, ...data });
  actor.prepareData();
  return actor;
}
function invoker(id = "master", attributes = {}, level = 1) {
  const actor = new NexusActor({ id, uuid: `Actor.${id}`, name: `Invocador ${id}`, type: "character",
    system: { level, attributes: { jujutsu: 4, fdv: 3, inteligencia: 2, ...attributes }, ea: { value: 100 } } });
  game.actors.set(id, actor);
  return actor;
}
function trackedUpdate(actor) {
  actor.update = async changes => {
    environment.updates.push({ actor, changes });
    if ("system.ea.value" in changes) actor.system.ea.value = changes["system.ea.value"];
    return actor;
  };
}

test("shikigami começa sem vínculo e deslocamento, com somente quatro atributos físicos", () => {
  const actor = shikigami();
  assert.deepEqual(Object.keys(actor.system.attributes), ["forca", "destreza", "agilidade", "vigor"]);
  assert.equal(actor.system.invokerId, "");
  assert.equal(actor.system.movement, null);
  assert.equal(actor.system.level, null, "sem invocador não há nível conhecido");
  for (const key of ["xp", "ea", "origin", "attributePoints", "attributeMax"]) {
    assert.equal(key in actor.system, false, `${key} não pertence às regras do shikigami`);
  }
  const movement = NexusShikigamiData.defineSchema().movement.options;
  assert.equal(movement.nullable, true);
  assert.notEqual(movement.persisted, false, "o deslocamento informado deve sobreviver ao recarregamento");
  assert.equal(NexusShikigamiData.defineSchema().level.options.persisted, false,
    "o nível é uma referência calculada, sem valor próprio salvo");
});

test("HP do shikigami segue nível do invocador sem bônus de constituição nem cura automática", () => {
  const actor = shikigami();
  assert.equal(actor.system.hp.value, 50);
  assert.equal(actor.system.hp.max, 50);
  const master = invoker();
  actor.system.invokerId = master.id;
  actor.prepareData();
  assert.equal(actor.system.level, 1);
  master.system.level = 2;
  actor.system.attributes.vigor = 99;
  actor.prepareData();
  assert.equal(actor.system.level, 2);
  assert.equal(actor.system.hp.max, 75);
  assert.equal(actor.system.hp.value, 50, "subir o máximo não cura o shikigami");
  master.system.level = 5;
  actor.system.hp.value = 999;
  actor.prepareData();
  assert.equal(actor.system.level, 5);
  assert.equal(actor.system.hp.max, 150);
  assert.equal(actor.system.hp.value, 150, "vida atual é limitada ao máximo do novo nível");
  master.system.level = 1;
  actor.prepareData();
  assert.equal(actor.system.hp.value, 50);
});

test("trocar ou remover o invocador recalcula nível e máximo sem aumentar a vida atual", () => {
  const first = invoker("first", {}, 4);
  const second = invoker("second", {}, 2);
  const actor = shikigami();
  actor.system.hp.value = 35;
  actor.system.invokerId = first.id;
  actor.prepareData();
  assert.equal(actor.system.level, 4);
  assert.equal(actor.system.hp.max, 125);
  assert.equal(actor.system.hp.value, 35);
  actor.system.level = 99;
  actor.prepareData();
  assert.equal(actor.system.level, 4, "um nível próprio informado é substituído pelo do invocador");
  actor.system.invokerId = second.id;
  actor.prepareData();
  assert.equal(actor.system.level, 2);
  assert.equal(actor.system.hp.max, 75);
  assert.equal(actor.system.hp.value, 35);
  actor.system.invokerId = "";
  actor.prepareData();
  assert.equal(actor.system.level, null);
  assert.equal(actor.system.hp.max, 50);
  assert.equal(actor.system.hp.value, 35);
});

test("deslocamento manual persiste ao recalcular atributos e nível", () => {
  const actor = shikigami();
  const master = invoker("master", {}, 4);
  actor.system.invokerId = master.id;
  actor.system.movement = 12.5;
  actor.system.attributes.agilidade = 40;
  actor.prepareData();
  assert.equal(actor.system.movement, 12.5);
  actor.system.movement = null;
  actor.prepareData();
  assert.equal(actor.system.movement, null, "nenhuma base é aplicada ao campo vazio");
});

test("atributos físicos do shikigami aceitam valores acima do teto de personagem", async () => {
  const actor = shikigami();
  assert.notEqual(await actor._preUpdate({ "system.attributes.forca": 40 }, {}, player), false);
  assert.notEqual(await actor._preUpdate({ system: { attributes: { destreza: 32, agilidade: 25, vigor: 30 } } }, {}, player), false);
  assert.deepEqual(environment.warnings, []);
  for (const value of [-1, 2.5, "", "inválido"]) {
    assert.equal(await actor._preUpdate({ "system.attributes.forca": value }, {}, player), false);
  }
});

test("dados de rolagem do shikigami oferecem DEX e CONS sem depender de campos de personagem", () => {
  const actor = shikigami();
  Object.assign(actor.system.attributes, { forca: 8, destreza: 6, agilidade: 4, vigor: 10 });
  const data = actor.getRollData();
  assert.equal(data.FOR, 8);
  assert.equal(data.DEX, 6);
  assert.equal(data.AGI, 4);
  assert.equal(data.CONS, 10);
  assert.equal(data.HP, 50);
  assert.equal("EA" in data, false);
});

test("deslocamento vazio ou decimal é aceito e esquema impede deslocamento negativo", async () => {
  const actor = shikigami();
  for (const movement of [null, 0, 12.5]) {
    assert.notEqual(await actor._preUpdate({ "system.movement": movement }, {}, player), false);
  }
  const field = NexusShikigamiData.defineSchema().movement.options;
  assert.equal(field.min, 0);
  assert.notEqual(field.integer, true, "o esquema deve preservar distâncias fracionadas");
});

test("somente mestre pode atribuir ou remover o invocador, inclusive por update direto", async () => {
  const master = invoker();
  const actor = shikigami();
  assert.equal(await actor._preUpdate({ "system.invokerId": master.id }, {}, player), false);
  assert.equal(await actor._preUpdate({ system: { invokerId: master.id } }, {}, player), false);
  actor.system.invokerId = master.id;
  assert.equal(await actor._preUpdate({ "system.invokerId": "" }, {}, player), false);
  assert.equal(await actor._preUpdate({ "system.-=invokerId": null }, {}, player), false);
  assert.equal(await actor._preUpdate({ system: { "-=invokerId": null } }, {}, player), false);
  assert.equal(await actor._preUpdate({ "-=system": null }, {}, player), false);
  assert.equal(await actor._preUpdate({ system: null }, {}, player), false);
  assert.notEqual(await actor._preUpdate({ "system.invokerId": master.id }, {}, gm), false);
  assert.notEqual(await actor._preUpdate({ "system.invokerId": "" }, {}, gm), false);
});

test("criação de shikigami com invocador também exige mestre", async () => {
  const master = invoker();
  const actor = shikigami();
  const data = { type: "shikigami", system: { invokerId: master.id } };
  assert.equal(await actor._preCreate(data, {}, player), false);
  assert.notEqual(await actor._preCreate(data, {}, gm), false);
  assert.notEqual(await actor._preCreate({ type: "shikigami", system: { invokerId: "" } }, {}, player), false);
  actor.system.invokerId = master.id;
  assert.equal(await actor._preCreate({ type: "shikigami" }, {}, player), false,
    "o documento já preenchido não pode contornar a permissão omitindo o campo no payload");
});

test("vínculo aceita somente um personagem existente no mundo", async () => {
  const actor = shikigami();
  invoker();
  game.actors.set("curse", { id: "curse", type: "curse" });
  game.actors.set("summon", actor);
  for (const id of ["missing", "curse", "summon"]) {
    assert.equal(await actor._preUpdate({ "system.invokerId": id }, {}, gm), false);
    assert.equal(await actor._preCreate({ type: "shikigami", system: { invokerId: id } }, {}, gm), false);
  }
  assert.notEqual(await actor._preUpdate({ "system.invokerId": "master" }, {}, gm), false);
});

test("referências usam o invocador atual e ficam vazias sem vínculo válido", () => {
  const first = invoker();
  const second = invoker("other", { jujutsu: 7, fdv: 5, inteligencia: 4 });
  const actor = shikigami();
  assert.equal(getShikigamiInvoker(actor), null);
  assert.equal(getShikigamiReference(actor), null);
  actor.system.invokerId = first.id;
  assert.equal(getShikigamiInvoker(actor), first);
  assert.deepEqual(getShikigamiReference(actor), { invoker: first, occultism: 9, maxDistance: 4 });
  Object.assign(actor.system.attributes, { forca: 20, destreza: 15, agilidade: 12, vigor: 18 });
  assert.equal(getShikigamiReference(actor).occultism, 9,
    "Perícia Ocultista mostra o total do invocador, sem descontar atributos distribuídos");
  first.system.attributes.jujutsu = 6;
  assert.deepEqual(getShikigamiReference(actor), { invoker: first, occultism: 11, maxDistance: 6 });
  actor.system.invokerId = second.id;
  assert.deepEqual(getShikigamiReference(actor), { invoker: second, occultism: 16, maxDistance: 7 });
  game.actors.delete(second.id);
  assert.equal(getShikigamiReference(actor), null);
  game.actors.set(second.id, { ...second, type: "curse" });
  assert.equal(getShikigamiReference(actor), null);
});

test("mudanças no invocador atualizam apenas fichas vinculadas abertas, inclusive tokens", async () => {
  const hooks = new Map();
  globalThis.Hooks = { on: (name, callback) => hooks.set(name, callback),
    once: (name, callback) => hooks.set(name, callback) };
  registerShikigamiReferenceSync();
  const master = invoker();
  const rendered = [];
  const linked = shikigami({ id: "linked" });
  linked.system.invokerId = master.id;
  linked.system.hp.value = 40;
  linked.apps = {
    opened: { rendered: true, render: () => rendered.push({ id: "world", level: linked.system.level,
      max: linked.system.hp.max, value: linked.system.hp.value }) },
    closed: { rendered: false, render: () => rendered.push("closed") }
  };
  const unrelated = shikigami({ id: "unrelated" });
  unrelated.system.invokerId = "other";
  unrelated.apps = { opened: { rendered: true, render: () => rendered.push("unrelated") } };
  const synthetic = shikigami({ id: "synthetic", isToken: true });
  synthetic.system.invokerId = master.id;
  synthetic.system.hp.value = 30;
  synthetic.apps = { opened: { rendered: true, render: () => rendered.push({ id: "token",
    level: synthetic.system.level, max: synthetic.system.hp.max, value: synthetic.system.hp.value }) } };
  game.actors.set(linked.id, linked);
  game.actors.set(unrelated.id, unrelated);
  game.scenes = [{ tokens: [{ actor: synthetic }, { actor: linked }] }];

  // Foundry pode repor os dados persistidos antes de calcular os derivados.
  // A vida efetiva anterior precisa sobreviver a essa preparação de referência.
  const prepareLinked = linked.prepareData.bind(linked);
  linked.prepareData = () => { linked.system.hp.value = 50; prepareLinked(); };

  linked.prepareCount = synthetic.prepareCount = unrelated.prepareCount = 0;
  master.system.level = 2;
  await hooks.get("updateActor")(master, { "system.level": 2 });
  assert.deepEqual(rendered.sort((a, b) => a.id.localeCompare(b.id)), [
    { id: "token", level: 2, max: 75, value: 30 }, { id: "world", level: 2, max: 75, value: 40 }
  ], "os dados devem ser recalculados antes de renderizar");
  assert.equal(linked.prepareCount, 1, "ator presente no mundo e numa cena é preparado uma vez");
  assert.equal(synthetic.prepareCount, 1);
  assert.equal(unrelated.prepareCount, 0);
  rendered.length = 0;
  game.actors.delete(master.id);
  await hooks.get("deleteActor")(master);
  assert.deepEqual(rendered.sort((a, b) => a.id.localeCompare(b.id)), [
    { id: "token", level: null, max: 50, value: 30 }, { id: "world", level: null, max: 50, value: 40 }
  ]);
});

test("ready calcula vínculo após todos os personagens do mundo serem carregados", async () => {
  const hooks = new Map();
  globalThis.Hooks = { on: (name, callback) => hooks.set(name, callback),
    once: (name, callback) => hooks.set(name, callback) };
  registerShikigamiReferenceSync();
  const actor = shikigami({ id: "early" });
  actor.system.invokerId = "late";
  actor.prepareData();
  assert.equal(actor.system.level, null);
  assert.equal(actor.system.hp.max, 50);
  game.actors.set(actor.id, actor);
  const savedSystem = new NexusShikigamiData();
  savedSystem.invokerId = "late-level5";
  savedSystem.hp.value = 100;
  const savedActor = shikigami({ id: "saved", system: savedSystem });
  game.actors.set(savedActor.id, savedActor);
  assert.equal(savedActor._source.system.hp.value, 100);
  assert.equal(savedActor.system.hp.value, 50, "a primeira derivação ainda não encontra o invocador");
  invoker("late", {}, 6);
  invoker("late-level5", {}, 5);
  await hooks.get("ready")();
  assert.equal(actor.system.level, 6);
  assert.equal(actor.system.hp.max, 175);
  assert.equal(actor.system.hp.value, 50, "ready não cura ao aumentar o máximo");
  assert.equal(savedActor.system.level, 5);
  assert.equal(savedActor.system.hp.max, 150);
  assert.equal(savedActor.system.hp.value, 100,
    "ready recupera o HP salvo que foi limitado temporariamente pela ordem de carga");
});

test("rolagem do shikigami funciona sem EA e trata qualquer custo como informação", async () => {
  const master = invoker();
  const actor = shikigami();
  actor.system.invokerId = master.id;
  actor.system.attributes.forca = 4;
  trackedUpdate(actor);
  trackedUpdate(master);
  for (const cost of ["", "15", "energia do invocador", "1d20 + custoEspecial"]) {
    const message = await NexusFormulaEngine.rollItem(actor, { name: "Investida", img: "",
      system: { attack: "1d20 + FOR", cost, effect: '"Derruba o alvo"' } });
    assert.ok(message, `movimento com custo ${JSON.stringify(cost)} deve chegar ao chat`);
    assert.ok(message.content.includes("Derruba o alvo"));
    if (cost) assert.ok(message.content.includes(cost), "custo informativo é exibido sem interpretação");
  }
  assert.deepEqual(environment.updates, [], "não gasta EA do shikigami nem do invocador");
  assert.deepEqual(environment.prompts, [], "custo informativo não pede variáveis");
  assert.equal(master.system.ea.value, 100);
  assert.deepEqual(environment.warnings, []);
  assert.deepEqual(environment.errors, []);
});

test("personagem mantém HP, EA, teto de atributos, progressão por XP e gasto de movimentos", async () => {
  const system = new NexusCharacterData();
  system.prepareDerivedData();
  assert.equal(system.hp.max, 150);
  assert.equal(system.ea.max, 150);
  assert.equal(system.attributeMax, 5);
  assert.equal(system.movement, 9);
  const actor = new NexusActor({ type: "character", system });
  assert.equal(await actor._preUpdate({ "system.attributes.forca": 40 }, {}, player), false);
  const changes = { "system.xp.value": system.xp.target };
  assert.notEqual(await actor._preUpdate(changes, {}, player), false);
  assert.equal(changes.system?.level ?? changes["system.level"], 2);
  assert.equal(changes["system.xp.value"], 0);
  trackedUpdate(actor);
  const message = await NexusFormulaEngine.rollItem(actor, { name: "Golpe", img: "",
    system: { attack: "1d20 + FOR", cost: "5", effect: "" } });
  assert.ok(message);
  assert.equal(actor.system.ea.value, 145);
  assert.deepEqual(environment.updates.map(({ changes }) => changes), [{ "system.ea.value": 145 }]);
});
