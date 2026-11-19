export const SHIKIGAMI_ATTRIBUTE_KEYS = Object.freeze(["forca", "destreza", "agilidade", "vigor"]);

/** O vínculo usa o personagem atual do mundo, sem copiar seus atributos. */
export function getShikigamiInvoker(actor) {
  if (actor?.type !== "shikigami" || !actor.system?.invokerId) return null;
  const invoker = globalThis.game?.actors?.get(actor.system.invokerId);
  return invoker?.type === "character" ? invoker : null;
}

export function getShikigamiLevel(actor) {
  const invoker = getShikigamiInvoker(actor);
  if (!invoker) return null;
  const level = Number(invoker.system.level);
  return Number.isInteger(level) && level >= 0 ? level : null;
}

export function getShikigamiReference(actor) {
  const invoker = getShikigamiInvoker(actor);
  if (!invoker) return null;
  const attributes = invoker.system.attributes ?? {};
  const jujutsu = Number(attributes.jujutsu) || 0;
  return {
    invoker,
    occultism: jujutsu + (Number(attributes.fdv) || 0) + (Number(attributes.inteligencia) || 0),
    maxDistance: jujutsu
  };
}

function documents(collection) {
  return collection?.contents ?? collection?.values?.() ?? collection ?? [];
}

function shikigamiActors() {
  const actors = new Set(documents(globalThis.game?.actors));
  for (const scene of documents(globalThis.game?.scenes)) {
    for (const token of documents(scene.tokens)) {
      if (token.actor) actors.add(token.actor);
    }
  }
  return [...actors].filter(actor => actor.type === "shikigami");
}

/** Recalcula dependências antes de refazer as fichas abertas, sem gravar atores. */
async function refreshReferences(invoker, { loadSourceHp = false } = {}) {
  if (invoker && invoker.type !== "character") return;
  const renders = [];
  for (const actor of shikigamiActors()) {
    if (invoker && actor.system.invokerId !== invoker.id) continue;
    try {
      // Na carga inicial, uma referência ainda indisponível pode ter limitado
      // o HP derivado antes de todos os personagens entrarem na coleção.
      const currentHp = Number(loadSourceHp
        ? actor._source?.system?.hp?.value ?? actor.system.hp.value
        : actor.system.hp.value);
      actor.prepareData();
      if (Number.isFinite(currentHp)) {
        actor.system.hp.value = Math.min(Math.max(currentHp, 0), actor.system.hp.max);
      }
    } catch (error) {
      console.error("Nexus JJK | Não foi possível recalcular os dados do shikigami.", error);
      continue;
    }
    for (const app of Object.values(actor.apps ?? {})) {
      if (app.rendered) renders.push(Promise.resolve().then(() => app.render()));
    }
  }
  await Promise.all(renders.map(render => render.catch(error => {
    console.error("Nexus JJK | Não foi possível atualizar as referências do shikigami.", error);
  })));
}

export function registerShikigamiReferenceSync() {
  Hooks.on("updateActor", invoker => refreshReferences(invoker));
  Hooks.on("deleteActor", invoker => refreshReferences(invoker));
  Hooks.once("ready", () => refreshReferences(null, { loadSourceHp: true }));
}
