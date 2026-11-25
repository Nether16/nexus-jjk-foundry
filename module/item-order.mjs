import { movementWrites } from "./movement-macros.mjs";

const ITEM_TYPES = new Set(["equipment", "technique", "attack"]);
const SORT_STEP = 100000;
const writes = new WeakMap();

function itemsOf(actor) {
  return Array.from(actor?.items?.contents ?? actor?.items?.values?.() ?? actor?.items ?? []);
}

function numericSort(item) {
  const value = Number(item.sort);
  return Number.isFinite(value) ? value : 0;
}

function requireType(type) {
  if (!ITEM_TYPES.has(type)) throw new Error("Esta lista não pode ser reordenada.");
}

function requireEditable(actor) {
  if (!actor?.isOwner ||
      (typeof actor.canUserModify === "function" && !actor.canUserModify(globalThis.game?.user, "update"))) {
    throw new Error("Você precisa poder editar a ficha para reordenar os registros.");
  }
  if (typeof actor.updateEmbeddedDocuments !== "function") {
    throw new Error("Não foi possível atualizar a ordem dos registros.");
  }
}

/** Empates antigos conservam a ordem de inserção, sem gravar nada ao abrir a ficha. */
export function getOrderedItems(actor, type) {
  requireType(type);
  return itemsOf(actor).filter(item => item.type === type)
    .map((item, index) => ({ item, index }))
    .sort((a, b) => numericSort(a.item) - numericSort(b.item) || a.index - b.index)
    .map(({ item }) => item);
}

function enqueue(actor, callback) {
  const previous = writes.get(actor) ?? Promise.resolve();
  const result = previous.catch(() => undefined).then(callback);
  writes.set(actor, result);
  return result.finally(() => {
    if (writes.get(actor) === result) writes.delete(actor);
  });
}

async function finishMovementWrites(actor) {
  const awaited = new Set();
  while (true) {
    const pending = itemsOf(actor).filter(item => item.type === "attack")
      .map(item => movementWrites.get(item)).filter(write => write && !awaited.has(write));
    if (!pending.length) return;
    for (const write of pending) awaited.add(write);
    if ((await Promise.all(pending)).some(result => result === false)) {
      throw new Error("Salve as alterações do movimento antes de reordenar os registros.");
    }
  }
}

function sortUpdates(items) {
  return items.map((item, index) => ({ _id: item.id, sort: (index + 1) * SORT_STEP }))
    .filter((update, index) => Number(items[index].sort) !== update.sort);
}

async function saveOrder(actor, items) {
  const updates = sortUpdates(items);
  if (!updates.length) return [];
  const result = await actor.updateEmbeddedDocuments("Item", updates);
  if (!Array.isArray(result) || result.length !== updates.length) {
    throw new Error("Não foi possível salvar a ordem de todos os registros.");
  }
  return result;
}

/** Move somente registros da mesma lista e persiste apenas o campo sort dos itens. */
export function reorderActorItems(actor, { type, id, targetId, before = true } = {}) {
  requireType(type);
  requireEditable(actor);
  return enqueue(actor, async () => {
    requireEditable(actor);
    await finishMovementWrites(actor);
    requireEditable(actor);
    const items = getOrderedItems(actor, type);
    const source = items.find(item => item.id === id);
    const target = items.find(item => item.id === targetId);
    if (!source || !target) throw new Error("O registro não está mais disponível nesta lista.");
    if (id === targetId) return [];
    const reordered = items.filter(item => item !== source);
    reordered.splice(reordered.indexOf(target) + (before ? 0 : 1), 0, source);
    if (reordered.every((item, index) => item === items[index])) return [];
    return saveOrder(actor, reordered);
  });
}

/** Novos registros ficam no fim; ordens legadas extremas são normalizadas quando necessário. */
export function nextItemSort(actor, type) {
  requireType(type);
  requireEditable(actor);
  return enqueue(actor, async () => {
    requireEditable(actor);
    const items = getOrderedItems(actor, type);
    const highest = Math.max(0, ...items.map(numericSort));
    const next = highest + SORT_STEP;
    if (Number.isSafeInteger(next)) return next;
    await finishMovementWrites(actor);
    requireEditable(actor);
    const current = getOrderedItems(actor, type);
    await saveOrder(actor, current);
    return (current.length + 1) * SORT_STEP;
  });
}
