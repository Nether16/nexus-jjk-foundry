let synchronization = Promise.resolve();

export function usesTokenPortrait(actor) {
  return !!actor && !actor.pack && !actor.compendium &&
    ["character", "curse", "shikigami"].includes(actor.type);
}

/** Altera somente a arte; mantém escala, visão, borda e demais configurações. */
export function tokenPortraitChanges(token, image) {
  if (typeof image !== "string" || !image.trim()) return {};
  const source = token._source ?? token;
  const changes = {};
  if (source.texture?.src !== image) changes["texture.src"] = image;
  // Uma imagem própria do anel tem precedência sobre a textura normal do token.
  if (source.ring?.subject?.texture && source.ring.subject.texture !== image) {
    changes["ring.subject.texture"] = image;
  }
  return changes;
}

export function prototypePortraitChanges(actor, image = actor.img) {
  const changes = tokenPortraitChanges(actor.prototypeToken, image);
  if (actor.prototypeToken.randomImg) changes.randomImg = false;
  return changes;
}

function isSynchronizer(actor, userId) {
  const gm = game.users.activeGM;
  if (gm) return gm.id === game.user.id;
  return userId === game.user.id && actor.canUserModify(game.user, "update");
}

function dependentTokens(actor) {
  const tokens = new Map();
  const add = token => {
    const scene = token.parent;
    if (actor.isToken ? token !== actor.token : token.actorId !== actor.id) return;
    if (scene && game.scenes.get(scene.id) === scene && scene.tokens.get(token.id) === token) {
      tokens.set(token.uuid, token);
    }
  };
  for (const token of actor.getDependentTokens({ concreteOnly: true })) add(token);
  // Inclui também cenas inativas, sem depender do registro dos tokens no canvas.
  if (!actor.isToken) {
    for (const scene of game.scenes) {
      for (const token of scene.tokens) {
        if (token.actorId === actor.id) add(token);
      }
    }
  }
  return tokens.values();
}

async function synchronize(actors, { userId, repairPrototypes }) {
  const scenes = new Map();
  for (const actor of actors) {
    if (!usesTokenPortrait(actor) || !isSynchronizer(actor, userId)) continue;
    if (!actor.isToken && game.actors.get(actor.id) !== actor) continue;
    if (actor.isToken && actor.token?.actorId !== actor.id) continue;

    if (repairPrototypes && !actor.isToken) {
      const changes = prototypePortraitChanges(actor);
      if (Object.keys(changes).length && actor.canUserModify(game.user, "update", changes)) {
        try {
          await actor.update(Object.fromEntries(Object.entries(changes).map(([key, value]) =>
            [`prototypeToken.${key}`, value])));
        } catch (error) {
          console.error(`Nexus JJK | Não foi possível atualizar o token padrão de ${actor.name}.`, error);
        }
      }
    }

    if (!isSynchronizer(actor, userId)) continue;
    for (const token of dependentTokens(actor)) {
      const scene = token.parent;
      const entries = scenes.get(scene) ?? new Map();
      entries.set(token.id, { token, actor });
      scenes.set(scene, entries);
    }
  }

  for (const [scene, entries] of scenes) {
    const updates = [];
    for (const { token, actor } of entries.values()) {
      if (!isSynchronizer(actor, userId) || scene.tokens.get(token.id) !== token) continue;
      if (token.actorId !== actor.id) continue;
      // O retrato de um ator sintético pode ser diferente do ator base do NPC.
      const effectiveActor = token.actor;
      if (!usesTokenPortrait(effectiveActor)) continue;
      const changes = tokenPortraitChanges(token, effectiveActor.img);
      if (Object.keys(changes).length && token.canUserModify(game.user, "update", changes)) {
        updates.push({ _id: token.id, ...changes });
      }
    }
    if (!updates.length) continue;
    try {
      await scene.updateEmbeddedDocuments("Token", updates);
    } catch (error) {
      console.error(`Nexus JJK | Não foi possível atualizar os retratos dos tokens em ${scene.name}.`, error);
    }
  }
}

/** Serializa mudanças rápidas e relê os retratos atuais antes de cada atualização. */
export function synchronizeTokenPortraits(actors, { userId = null, repairPrototypes = false } = {}) {
  const documents = [...new Set(actors)];
  synchronization = synchronization.then(() => synchronize(documents, { userId, repairPrototypes }))
    .catch(error => console.error("Nexus JJK | Não foi possível sincronizar os retratos dos tokens.", error));
  return synchronization;
}

export function registerTokenPortraitSync() {
  Hooks.on("preCreateToken", token => {
    const actor = token.actor;
    if (usesTokenPortrait(actor)) token.updateSource(tokenPortraitChanges(token, actor.img));
  });

  Hooks.on("updateActor", (actor, changes, _options, userId) => {
    if (!Object.hasOwn(changes, "img") || !usesTokenPortrait(actor) || !isSynchronizer(actor, userId)) return;
    return synchronizeTokenPortraits([actor], { userId });
  });

  Hooks.once("ready", () => {
    if (game.users.activeGM?.id !== game.user.id) return;
    return synchronizeTokenPortraits(game.actors, { repairPrototypes: true });
  });
}
