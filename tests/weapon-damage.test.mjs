import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

// Serviços mínimos do Foundry; os cálculos e documentos testados são os do sistema.
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
}
class BaseActor {
  constructor(data) {
    Object.assign(this, { documentName: "Actor", id: "hero", uuid: "Actor.hero", isOwner: true,
      items: new Collection(), ...data });
    Object.defineProperty(this.system, "parent", { value: this });
  }
  getRollData() { return structuredClone(this.system); }
  prepareData() {
    // Foundry prepara os itens antes dos dados derivados do ator.
    for (const item of this.items) item.prepareData?.();
    this.system.prepareDerivedData?.();
  }
}
class BaseItem {
  constructor(data, { parent = null } = {}) {
    Object.assign(this, { documentName: "Item", ...data, parent });
    this.uuid = `${parent?.uuid ?? "Item"}.Item.${this.id}`;
    this._source = structuredClone({ type: this.type, name: this.name, system: this.system });
  }
  get actor() { return this.parent instanceof BaseActor ? this.parent : null; }
  async _preCreate() { return true; }
  async _preUpdate() { return true; }
}

globalThis.Actor = BaseActor;
globalThis.Item = BaseItem;
globalThis.foundry = {
  abstract: { TypeDataModel },
  data: { fields: { BooleanField: Field, FilePathField: Field, HTMLField: Field,
    NumberField: Field, SchemaField, StringField: Field } },
  utils: { getProperty: (object, path) => path.split(".").reduce((value, key) => value?.[key], object) }
};

const { NexusCharacterData, NexusItemData, NexusShikigamiData } = await import("../module/data-models.mjs");
const { NexusActor, NexusItem } = await import("../module/documents.mjs");
const { getWeaponDamageDetails } = await import("../module/weapon-damage.mjs");
const { NexusFormulaEngine, resolveFormula, evaluateNumeric } = await import("../module/formula-engine.mjs");
const { rollMovement } = await import("../module/movement-macros.mjs");

let environment;
beforeEach(() => {
  environment = { warnings: [], errors: [], messages: [], documents: new Map(), prompts: [] };
  globalThis.game = { user: { id: "gm", isGM: true }, settings: { get: () => "public" } };
  globalThis.ui = { notifications: {
    warn: message => environment.warnings.push(message), error: message => environment.errors.push(message)
  } };
  globalThis.fromUuid = async uuid => environment.documents.get(uuid) ?? null;
  globalThis.ChatMessage = {
    getSpeaker: ({ actor }) => ({ actor: actor.id }),
    async create(message) { environment.messages.push(message); return message; }
  };
  globalThis.Roll = class {
    static CHAT_TEMPLATE = "templates/dice/roll.hbs";
    constructor(formula) { this.formula = formula; }
    static safeEval(formula) {
      const safe = formula.replace(/\bfloor\(/gu, "Math.floor(");
      if (!/^[\d\s.+*/()%-]+$/u.test(safe.replace(/Math\.floor/gu, ""))) throw new Error("Fórmula inválida");
      return Function(`"use strict"; return (${safe});`)();
    }
    async evaluate() { this.total = Roll.safeEval(this.formula.replace(/1d20/giu, "10")); return this; }
    async _prepareChatRenderContext() { return { formula: this.formula, total: this.total }; }
  };
  foundry.applications = { api: { DialogV2: {
    async input(options) { environment.prompts.push(options); return { value: "0" }; }
  } }, handlebars: { async renderTemplate(_template, context) { return `<span>${context.total}</span>`; } } };
});

function creature({ type = "character", level = 1 } = {}) {
  const system = new (type === "shikigami" ? NexusShikigamiData : NexusCharacterData)();
  if (type !== "shikigami") system.level = level;
  const actor = new NexusActor({ type, system });
  actor.prepareData();
  return actor;
}
function equipment(actor, overrides = {}) {
  const system = new NexusItemData({ weaponDamage: 15, ...overrides });
  const item = new NexusItem({ id: `weapon${actor.items.size}`, name: "Lâmina", type: "equipment", system }, { parent: actor });
  actor.items.set(item.id, item);
  return item;
}
function tailored(actor, { id = "tailored", name = "Sob Medida 🔒", type = "talent" } = {}) {
  const talent = { id, type, name };
  actor.items.set(id, talent);
  return talent;
}

test("arma comum e arma legada mantêm a base sem bônus nos níveis de progressão", () => {
  const actor = creature();
  const item = equipment(actor);
  assert.equal(item.system.isAffiliatedWeapon, false);
  assert.equal(item.system.isWeapon, null);
  actor.system.equippedWeaponId = item.id;
  for (const level of [1, 4, 5, 9, 10, 14, 15, 19, 20]) {
    actor.system.level = level;
    actor.prepareData();
    assert.equal(item.isWeapon, true);
    assert.equal(item.weaponDamageDetails.total, 15);
    assert.equal(actor.weaponDamage, 15);
  }
});

test("afiliada ganha +15 exatamente nos níveis 5, 10, 15 e 20 e não acumula após 20", () => {
  const actor = creature();
  const item = equipment(actor, { isAffiliatedWeapon: true });
  const source = structuredClone(item._source);
  for (const [level, total] of [[0, 15], [4, 15], [5, 30], [9, 30], [10, 45],
    [14, 45], [15, 60], [19, 60], [20, 75], [25, 75]]) {
    actor.system.level = level;
    actor.prepareData();
    assert.equal(item.weaponDamageDetails.total, total, `nível ${level}`);
    assert.equal(item.system.weaponDamage, 15);
  }
  assert.deepEqual(item._source, source);
});

test("baixar nível e desmarcar afiliada removem somente os bônus correspondentes", () => {
  const actor = creature({ level: 20 });
  const item = equipment(actor, { isAffiliatedWeapon: true });
  assert.equal(item.weaponDamageDetails.total, 75);
  actor.system.level = 9;
  actor.prepareData();
  assert.equal(item.weaponDamageDetails.total, 30);
  item.system.isAffiliatedWeapon = false;
  assert.equal(item.weaponDamageDetails.total, 15);
  assert.equal(item.system.weaponDamage, 15);
});

test("Sob Medida existente sem flags funciona, não duplica e acompanha troca ou remoção", () => {
  const actor = creature();
  const item = equipment(actor, { weaponDamage: 30 });
  const talent = tailored(actor);
  assert.equal("flags" in talent, false);
  assert.equal(item.weaponDamageDetails.total, 45);
  tailored(actor, { id: "duplicate", name: "Sob Medida" });
  assert.equal(item.weaponDamageDetails.total, 45);
  actor.items.delete("duplicate");
  talent.name = "Alma Perseverante 🔒";
  assert.equal(item.weaponDamageDetails.total, 30);
  talent.name = "Sob Medida 🔒";
  assert.equal(item.weaponDamageDetails.total, 45);
  actor.items.delete(talent.id);
  assert.equal(item.weaponDamageDetails.total, 30);
  tailored(actor, { type: "technique" });
  assert.equal(item.weaponDamageDetails.total, 30, "nome de técnica não concede o talento");
});

test("Sob Medida aplica um grau após a progressão da afiliada e respeita Especial", () => {
  const actor = creature({ level: 5 });
  const item = equipment(actor, { isAffiliatedWeapon: true });
  tailored(actor);
  assert.deepEqual(item.weaponDamageDetails, {
    base: 15, affiliatedBonus: 15, tailoredBonus: 15, total: 45, specialAbility: false
  });
  actor.system.level = 15;
  assert.equal(item.weaponDamageDetails.total, 75);
  assert.equal(item.weaponDamageDetails.specialAbility, false, "grau I usa dano Especial");
  actor.system.level = 20;
  assert.equal(item.weaponDamageDetails.total, 75, "Sob Medida não cria grau acima de Especial");
  assert.equal(item.weaponDamageDetails.specialAbility, true);
});

test("Especial legada 75 recebe segunda habilidade e preserva dano 75", () => {
  const actor = creature();
  const item = equipment(actor, { weaponDamage: 75 });
  const source = structuredClone(item._source);
  tailored(actor);
  assert.deepEqual(item.weaponDamageDetails, {
    base: 75, affiliatedBonus: 0, tailoredBonus: 0, total: 75, specialAbility: true
  });
  assert.deepEqual(item._source, source);
  assert.equal(item.system.weaponDamage, 75);
});

test("base personalizada pelo GM permanece intacta ao somar progressão e Sob Medida", () => {
  const actor = creature({ level: 10 });
  const item = equipment(actor, { weaponDamage: 22.5, isAffiliatedWeapon: true });
  tailored(actor);
  assert.equal(item.weaponDamageDetails.total, 67.5);
  assert.equal(item.system.weaponDamage, 22.5);
  item.system.isAffiliatedWeapon = false;
  item.system.weaponDamage = 90;
  assert.equal(item.weaponDamageDetails.total, 90, "dano GM acima de 75 não é truncado");
  assert.equal(item.weaponDamageDetails.specialAbility, true);
});

test("preparação e leitura repetidas são idempotentes, inclusive durante preparação dos itens", () => {
  const actor = creature({ level: 10 });
  const item = equipment(actor, { isAffiliatedWeapon: true });
  actor.system.equippedWeaponId = item.id;
  tailored(actor);
  const originalSystem = structuredClone(item.system);
  const originalSource = structuredClone(item._source);
  const duringPreparation = [];
  item.prepareData = () => duringPreparation.push(getWeaponDamageDetails(item).total);
  for (let count = 0; count < 5; count++) {
    actor.prepareData();
    assert.equal(actor.weaponDamage, 60);
    assert.equal(item.weaponDamageDetails.total, 60);
  }
  assert.deepEqual(duringPreparation, [60, 60, 60, 60, 60]);
  assert.deepEqual(structuredClone(item.system), originalSystem);
  assert.deepEqual(item._source, originalSource);
});

test("sem arma equipada, item não arma e shikigami continuam sem dano de arma", () => {
  const actor = creature({ level: 20 });
  const item = equipment(actor, { isAffiliatedWeapon: true });
  tailored(actor);
  assert.equal(actor.weaponDamage, 0);
  assert.equal(getWeaponDamageDetails(null).total, 0);
  actor.system.equippedWeaponId = item.id;
  item.system.isWeapon = false;
  assert.equal(actor.equippedWeapon, null);
  assert.equal(item.weaponDamageDetails.total, 0);
  assert.equal(actor.getRollData().ARMA, 0);

  const shikigami = creature({ type: "shikigami" });
  const forbidden = equipment(shikigami, { weaponDamage: 75, isWeapon: true, isAffiliatedWeapon: true });
  shikigami.system.equippedWeaponId = forbidden.id;
  tailored(shikigami);
  assert.equal(forbidden.weaponDamageDetails.total, 0);
  assert.equal(shikigami.weaponDamage, 0);
  assert.equal("ARMA" in shikigami.getRollData(), false);
});

test("getRollData, fórmula, movimento direto e macro usam o dano efetivo atual da arma equipada", async () => {
  const actor = creature({ level: 10 });
  const weapon = equipment(actor, { isAffiliatedWeapon: true });
  actor.system.equippedWeaponId = weapon.id;
  tailored(actor);
  actor.system.attributes.forca = 3;
  assert.equal(actor.getRollData().ARMA, 60);
  assert.equal(actor.getRollData().DANO_ARMA, 60);
  for (const alias of ["ARMA", "DANO_ARMA", "danoarma"]) {
    assert.equal(evaluateNumeric(resolveFormula(actor, `${alias} + FOR`, new Map())), 63);
  }
  const movement = new NexusItem({ id: "move", name: "Corte", type: "attack", img: "",
    system: { attack: "", cost: "", effect: "Dano: ARMA + FOR" } }, { parent: actor });
  actor.items.set(movement.id, movement);
  environment.documents.set(movement.uuid, movement);
  const plain = message => message.content.replace(/<[^>]*>/gu, " ").replace(/\s+/gu, " ");
  assert.match(plain(await NexusFormulaEngine.rollItem(actor, movement)), /Dano: 63/u);
  assert.match(plain(await rollMovement(actor, movement.uuid)), /Dano: 63/u);
  actor.system.level = 5;
  assert.match(plain(await rollMovement(null, movement.uuid)), /Dano: 48/u);
  actor.items.delete("tailored");
  assert.match(plain(await rollMovement(null, movement.uuid)), /Dano: 33/u);
  assert.equal(actor.getRollData().ARMA, 30);
  assert.deepEqual(environment.prompts, []);
  assert.deepEqual(environment.errors, []);
});

test("trocar arma equipada muda o total sem transferir a marca de afiliada", () => {
  const actor = creature({ level: 10 });
  const affiliated = equipment(actor, { isAffiliatedWeapon: true });
  const normal = equipment(actor, { weaponDamage: 30 });
  tailored(actor);
  actor.system.equippedWeaponId = affiliated.id;
  assert.equal(actor.weaponDamage, 60);
  actor.system.equippedWeaponId = normal.id;
  assert.equal(actor.weaponDamage, 45);
  assert.equal(normal.system.isAffiliatedWeapon, false);
  assert.equal(affiliated.system.isAffiliatedWeapon, true);
});

test("dano base continua protegido no documento e afiliada é editável pelo jogador", async () => {
  const item = equipment(creature());
  const gm = { isGM: true };
  const player = { isGM: false };
  for (const data of [{ "system.weaponDamage": 30 }, { system: { weaponDamage: 30 } }]) {
    assert.equal(await item._preCreate(data, {}, player), false);
    assert.notEqual(await item._preCreate(data, {}, gm), false);
    assert.equal(await item._preUpdate(data, {}, player), false);
    assert.notEqual(await item._preUpdate(data, {}, gm), false);
  }
  for (const data of [{ "system.-=weaponDamage": null }, { system: { "-=weaponDamage": null } }]) {
    assert.equal(await item._preUpdate(data, {}, player), false);
    assert.notEqual(await item._preUpdate(data, {}, gm), false);
  }
  assert.notEqual(await item._preCreate({ system: { weaponDamage: 0 } }, {}, player), false);
  assert.notEqual(await item._preUpdate({ "system.isAffiliatedWeapon": true }, {}, player), false);
  assert.notEqual(await item._preUpdate({ system: { isAffiliatedWeapon: false } }, {}, player), false);
  assert.equal(item.system.weaponDamage, 15);
});
