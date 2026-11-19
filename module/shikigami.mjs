export const SHIKIGAMI_ATTRIBUTE_KEYS = Object.freeze(["forca", "destreza", "agilidade", "vigor"]);

/** O vínculo usa o personagem atual do mundo, sem copiar seus atributos. */
export function getShikigamiInvoker(actor) {
  if (actor?.type !== "shikigami" || !actor.system?.invokerId) return null;
  const invoker = globalThis.game?.actors?.get(actor.system.invokerId);
  return invoker?.type === "character" ? invoker : null;
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

/** Refaz somente fichas abertas que exibem referências ao personagem alterado. */
async function refreshReferences(invoker) {
  if (invoker?.type !== "character") return;
  const actors = new Set(documents(globalThis.game?.actors));
  for (const scene of documents(globalThis.game?.scenes)) {
    for (const token of documents(scene.tokens)) {
      if (token.actor) actors.add(token.actor);
    }
  }
  const renders = [];
  for (const actor of actors) {
    if (actor.type !== "shikigami" || actor.system.invokerId !== invoker.id) continue;
    for (const app of Object.values(actor.apps ?? {})) {
      if (app.rendered) renders.push(Promise.resolve().then(() => app.render()));
    }
  }
  await Promise.all(renders.map(render => render.catch(error => {
    console.error("Nexus JJK | Não foi possível atualizar as referências do shikigami.", error);
  })));
}

export function registerShikigamiReferenceSync() {
  Hooks.on("updateActor", refreshReferences);
  Hooks.on("deleteActor", refreshReferences);
}
