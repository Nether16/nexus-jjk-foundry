import assert from "node:assert/strict";
import test from "node:test";

// Os stubs fornecem somente o esquema e a coleção de itens usados pelos modelos.
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
  constructor() { Object.assign(this, initialData(this.constructor.defineSchema())); }
  prepareDerivedData() {}
}
class Collection extends Map {
  [Symbol.iterator]() { return this.values(); }
}

globalThis.foundry = {
  abstract: { TypeDataModel },
  data: { fields: { BooleanField: Field, FilePathField: Field, HTMLField: Field,
    NumberField: Field, SchemaField, StringField: Field } }
};

const { NexusCharacterData, NexusCurseData, NexusShikigamiData } = await import("../module/data-models.mjs");
const RESERVE_NAME = "Reserva de Energia Amaldiçoada";

function talent(overrides = {}) {
  // Talentos anteriores à automação não possuem flags nem metadados de bônus.
  return { name: RESERVE_NAME, type: "talent", ...overrides };
}

function creature({ type = "character", level = 5, origin, items = [] } = {}) {
  const Model = type === "curse" ? NexusCurseData
    : type === "shikigami" ? NexusShikigamiData : NexusCharacterData;
  const system = new Model();
  if (type !== "shikigami") system.level = level;
  if (origin) system.origin.key = origin;
  const actor = { type, system, items: new Collection(items.map((item, index) => [String(index), item])) };
  Object.defineProperty(system, "parent", { value: actor });
  actor.prepareData = () => system.prepareDerivedData();
  actor.prepareData();
  return actor;
}

test("Reserva concede +50 EA retroativos no nível 5 e acompanha o nível 6 sem aumentar HP", () => {
  const actor = creature();
  assert.equal(actor.system.ea.max, 350);
  assert.equal(actor.system.hp.max, 350);
  actor.items.set("reserve", talent());
  actor.prepareData();
  assert.equal(actor.system.ea.max, 400);
  assert.equal(actor.system.hp.max, 350);
  actor.system.level = 6;
  actor.prepareData();
  assert.equal(actor.system.ea.max, 460, "400 EA da origem mais 60 EA do talento");
  assert.equal(actor.system.hp.max, 400);
});

test("selecionar, substituir e remover Reserva recalcula o máximo sem recuperar EA gasta", () => {
  const actor = creature();
  actor.system.ea.value = 120;
  const selected = talent();
  actor.items.set("selected", selected);
  actor.prepareData();
  assert.equal(actor.system.ea.max, 400);
  assert.equal(actor.system.ea.value, 120);

  selected.name = "Perícia em Barreiras";
  actor.prepareData();
  assert.equal(actor.system.ea.max, 350, "trocar a escolha remove o benefício anterior");
  assert.equal(actor.system.ea.value, 120);

  selected.name = RESERVE_NAME;
  actor.prepareData();
  assert.equal(actor.system.ea.max, 400);
  assert.equal(actor.system.ea.value, 120);
  actor.items.delete("selected");
  actor.prepareData();
  assert.equal(actor.system.ea.max, 350);
  assert.equal(actor.system.ea.value, 120);
});

test("perder Reserva limita a EA atual ao novo máximo e recuperá-la não restaura esse excedente", () => {
  const actor = creature({ items: [talent()] });
  actor.system.ea.value = 390;
  actor.items.clear();
  actor.prepareData();
  assert.equal(actor.system.ea.max, 350);
  assert.equal(actor.system.ea.value, 350);
  actor.items.set("reserve", talent());
  actor.prepareData();
  assert.equal(actor.system.ea.max, 400);
  assert.equal(actor.system.ea.value, 350);
});

test("recalcular repetidamente e possuir Reserva em dois itens não acumula o bônus", () => {
  const actor = creature({ items: [talent(), talent()] });
  actor.system.ea.value = 90;
  for (let preparation = 0; preparation < 5; preparation++) actor.prepareData();
  assert.equal(actor.system.ea.max, 400);
  assert.equal(actor.system.ea.value, 90);
  actor.items.delete("0");
  actor.prepareData();
  assert.equal(actor.system.ea.max, 400, "a segunda cópia mantém somente um benefício");
  actor.items.delete("1");
  actor.prepareData();
  assert.equal(actor.system.ea.max, 350);
});

test("Reserva existente sem flags funciona e itens de outros tipos com o mesmo nome não concedem bônus", () => {
  const actor = creature({ items: [talent({ type: "equipment" }), talent({ type: "technique" })] });
  assert.equal(actor.system.ea.max, 350);
  const legacyTalent = talent();
  assert.equal("flags" in legacyTalent, false);
  actor.items.set("legacy", legacyTalent);
  actor.prepareData();
  assert.equal(actor.system.ea.max, 400);
  assert.equal("flags" in legacyTalent, false, "o cálculo não migra o item legado");
});

test("origem sem EA não recebe energia nem converte Reserva em HP", () => {
  const actor = creature({ origin: "restringidoFisico" });
  const hpMax = actor.system.hp.max;
  actor.items.set("reserve", talent());
  actor.prepareData();
  assert.equal(actor.system.ea.max, 0);
  assert.equal(actor.system.ea.value, 0);
  assert.equal(actor.system.hp.max, hpMax);
  assert.equal(hpMax, 475);
});

test("bônus da Reserva soma à progressão da origem e ao atributo Jujutsu", () => {
  const actor = creature({ origin: "restringidoFeiticaria", items: [talent()] });
  actor.system.attributes.jujutsu = 3;
  actor.prepareData();
  assert.equal(actor.system.ea.max, 555, "100 de base + 375 da origem + 30 de Jujutsu + 50 da Reserva");
  actor.system.level = 0;
  actor.prepareData();
  assert.equal(actor.system.ea.max, 130, "nível zero não produz um nível adicional de bônus");
});

test("maldições mantêm sua progressão de EA e HP mesmo com um item Reserva", () => {
  const actor = creature({ type: "curse", items: [talent()] });
  assert.equal(actor.system.ea.max, 475);
  assert.equal(actor.system.hp.max, 475);
  actor.system.level = 6;
  actor.prepareData();
  assert.equal(actor.system.ea.max, 550);
  assert.equal(actor.system.hp.max, 550);
});

test("shikigami continua sem EA e seu HP não recebe bônus da Reserva", () => {
  const actor = creature({ type: "shikigami", items: [talent()] });
  assert.equal("ea" in actor.system, false);
  assert.equal(actor.system.hp.max, 50);
  actor.prepareData();
  assert.equal("ea" in actor.system, false);
  assert.equal(actor.system.hp.max, 50);
});
