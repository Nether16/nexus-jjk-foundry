import assert from "node:assert/strict";
import test from "node:test";
import { getOrderedItems, nextItemSort, reorderActorItems } from "../module/item-order.mjs";
import { movementWrites } from "../module/movement-macros.mjs";

function actor(records = [{ id: "a" }, { id: "b" }, { id: "c" }]) {
  const document = { isOwner: true, uuid: "Actor.hero", writes: [],
    system: { equippedWeaponId: "a" }, items: new Map(records.map((entry, index) => [entry.id, {
      type: "equipment", sort: index * 100000, name: entry.id,
      uuid: `Actor.hero.Item.${entry.id}`, system: { description: "Texto", attack: "1d20 + FOR" }, ...entry
    }])),
    canUserModify() { return this.isOwner; },
    async updateEmbeddedDocuments(type, updates) {
      assert.equal(type, "Item");
      this.writes.push(structuredClone(updates));
      if (this.wait) await this.wait;
      return updates.map(update => Object.assign(this.items.get(update._id), { sort: update.sort }));
    }
  };
  return document;
}
const ids = (document, type = "equipment") => getOrderedItems(document, type).map(item => item.id);

test("ordens legadas empatadas mantêm a inserção sem gravar nada", () => {
  const document = actor([{ id: "a", sort: 0 }, { id: "b", sort: 0 }, { id: "c", sort: undefined }]);
  assert.deepEqual(ids(document), ["a", "b", "c"]);
  assert.deepEqual(document.writes, []);
});

for (const type of ["equipment", "technique", "attack"]) {
  test(`${type}: mover para cima e para baixo persiste apenas sort e sobrevive à reabertura`, async () => {
    const document = actor([{ id: "a", type }, { id: "b", type }, { id: "c", type }, { id: "other", type: "talent", sort: 7 }]);
    const before = structuredClone([...document.items.values()]);
    await reorderActorItems(document, { type, id: "c", targetId: "a", before: true });
    assert.deepEqual(ids(document, type), ["c", "a", "b"]);
    await reorderActorItems(document, { type, id: "c", targetId: "b", before: false });
    assert.deepEqual(ids(document, type), ["a", "b", "c"]);
    for (const update of document.writes.flat()) assert.deepEqual(Object.keys(update).sort(), ["_id", "sort"]);
    assert.deepEqual(document.items.get("other"), before[3]);
    assert.equal(document.system.equippedWeaponId, "a");
    assert.deepEqual([...document.items.values()].map(({ sort, ...item }) => item), before.map(({ sort, ...item }) => item));
    const reopened = actor(structuredClone([...document.items.values()]).reverse());
    assert.deepEqual(ids(reopened, type), ["a", "b", "c"]);
  });
}

test("soltar na própria posição não grava", async () => {
  const document = actor();
  await reorderActorItems(document, { type: "equipment", id: "a", targetId: "a" });
  await reorderActorItems(document, { type: "equipment", id: "a", targetId: "b", before: true });
  assert.deepEqual(document.writes, []);
});

test("não mistura tipos nem aceita IDs removidos ou usuário sem edição", async () => {
  const document = actor([{ id: "a" }, { id: "move", type: "attack" }]);
  await assert.rejects(reorderActorItems(document, { type: "equipment", id: "a", targetId: "move" }));
  await assert.rejects(reorderActorItems(document, { type: "equipment", id: "missing", targetId: "a" }));
  assert.throws(() => reorderActorItems(document, { type: "talent", id: "a", targetId: "a" }));
  document.isOwner = false;
  assert.throws(() => reorderActorItems(document, { type: "equipment", id: "a", targetId: "a" }), /editar/u);
  assert.deepEqual(document.writes, []);
});

test("reordenação aguarda o salvamento pendente das fórmulas do movimento", async () => {
  const document = actor([{ id: "a", type: "attack" }, { id: "b", type: "attack" }]);
  const movement = document.items.get("a");
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  movementWrites.set(movement, pending);
  const sorting = reorderActorItems(document, { type: "attack", id: "b", targetId: "a" });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(document.writes.length, 0);
  movement.system.attack = "1d20 + DES";
  release(movement);
  await sorting;
  assert.equal(movement.system.attack, "1d20 + DES");
  assert.deepEqual(ids(document, "attack"), ["b", "a"]);
  movementWrites.delete(movement);
});

test("movimento cujo salvamento falhou não dispara escrita da ordem", async () => {
  const document = actor([{ id: "a", type: "attack" }, { id: "b", type: "attack" }]);
  movementWrites.set(document.items.get("a"), Promise.resolve(false));
  await assert.rejects(reorderActorItems(document, { type: "attack", id: "b", targetId: "a" }), /Salve/u);
  assert.deepEqual(document.writes, []);
});

test("novos itens entram no final, inclusive após uma reordenação", async () => {
  const document = actor();
  await reorderActorItems(document, { type: "equipment", id: "c", targetId: "a" });
  const sort = await nextItemSort(document, "equipment");
  document.items.set("new", { id: "new", type: "equipment", sort });
  assert.deepEqual(ids(document), ["c", "a", "b", "new"]);
});

test("movimentos rápidos na mesma ficha entram em fila e usam a ordem atual", async () => {
  const document = actor();
  let release;
  document.wait = new Promise(resolve => { release = resolve; });
  const first = reorderActorItems(document, { type: "equipment", id: "c", targetId: "a" });
  await new Promise(resolve => setImmediate(resolve));
  const second = reorderActorItems(document, { type: "equipment", id: "b", targetId: "c" });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(document.writes.length, 1);
  release();
  await Promise.all([first, second]);
  assert.deepEqual(ids(document), ["b", "c", "a"]);
});
