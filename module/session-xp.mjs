let distributions = Promise.resolve();
let pendingDialog = null;

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/gu, character =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function requireGM() {
  if (!game.user?.isGM) throw new Error("Apenas o mestre pode distribuir XP.");
}

function characters() {
  return [...(game.actors?.contents ?? game.actors?.values?.() ?? [])]
    .filter(actor => actor.type === "character" && !actor.pack && !actor.compendium && !actor.isToken)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

function validateAmount(value) {
  if (!["number", "string"].includes(typeof value) || String(value).trim() === "") {
    throw new Error("Informe uma quantidade inteira de XP maior que zero.");
  }
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("Informe uma quantidade inteira de XP maior que zero.");
  }
  return amount;
}

function reportError(error) {
  console.error("Nexus JJK | Não foi possível distribuir XP.", error);
  ui.notifications.error(error.message || "Não foi possível distribuir XP.");
}

async function distribute(actorIds, value) {
  requireGM();
  const amount = validateAmount(value);
  if (!Array.isArray(actorIds) || !actorIds.length || actorIds.some(id => typeof id !== "string" || !id)) {
    throw new Error("Selecione ao menos uma ficha de personagem para receber XP.");
  }
  const recipients = new Map(characters().map(actor => [actor.id, actor]));
  const ids = [...new Set(actorIds)];
  if (ids.some(id => !recipients.has(id))) {
    throw new Error("Uma das fichas selecionadas não está mais disponível. Abra a distribuição de XP novamente.");
  }
  const actors = ids.map(id => recipients.get(id));
  for (const actor of actors) {
    const current = Number(actor.system.xp.value);
    if (!Number.isSafeInteger(current) || current < 0 || !Number.isSafeInteger(current + amount)) {
      throw new Error(`O XP de ${actor.name} está fora do intervalo permitido.`);
    }
  }

  const received = [];
  const failed = [];
  for (const actor of actors) {
    try {
      // O próprio documento calcula a progressão de nível e conserva o XP restante.
      requireGM();
      if (game.actors.get(actor.id) !== actor) throw new Error("Ficha removida durante a distribuição.");
      const updated = await actor.update({ "system.xp.value": Number(actor.system.xp.value) + amount });
      if (!updated) throw new Error("A atualização da ficha foi recusada.");
      received.push(actor);
    } catch (error) {
      console.error(`Nexus JJK | Não foi possível dar XP a ${actor.name}.`, error);
      failed.push(actor);
    }
  }
  if (failed.length) {
    ui.notifications.error(`XP não aplicado a: ${failed.map(actor => actor.name).join(", ")}. As demais fichas foram processadas; não repita a distribuição completa.`);
  }
  if (!received.length) return { amount, received: [], failed: failed.map(actor => actor.id), message: null };

  const names = received.map(actor => actor.name).join(", ");
  let message = null;
  try {
    message = await ChatMessage.create({
      author: game.user.id,
      speaker: { alias: "Nexus" },
      whisper: [],
      blind: false,
      content: '<section class="nexus-chat-card nexus-session-xp">' +
        '<strong class="nexus-chat-title">Sessão encerrada</strong>' +
        '<div class="nexus-chat-section"><strong>XP Recebido:</strong></div>' +
        `<div class="nexus-chat-section"><strong>${amount} XP</strong></div>` +
        `<footer class="nexus-xp-recipients">${escapeHTML(names)}</footer></section>`,
      flags: { "nexus-jjk": { sessionXP: { amount, actorIds: received.map(actor => actor.id) } } }
    }, { messageMode: "public" });
    if (!message) throw new Error("A mensagem de XP foi recusada.");
  } catch (error) {
    console.error("Nexus JJK | XP aplicado, mas a mensagem não foi publicada.", error);
    ui.notifications.error(`O XP foi aplicado a ${names}, mas não foi possível publicar no chat. Não repita a distribuição.`);
  }
  return { amount, received: received.map(actor => actor.id), failed: failed.map(actor => actor.id), message };
}

/** Soma XP aos personagens escolhidos; requer mestre e usa a progressão da ficha. */
export function awardXP(actorIds, amount) {
  const result = distributions.catch(() => undefined).then(() => distribute(actorIds, amount));
  distributions = result.catch(() => undefined);
  return result;
}

async function chooseXP(initialAmount) {
  requireGM();
  const actors = characters();
  if (!actors.length) throw new Error("Crie uma ficha de personagem antes de distribuir XP.");
  const initial = initialAmount === undefined ? "" : String(validateAmount(initialAmount));
  const rows = actors.map(actor =>
    `<label class="nexus-xp-recipient"><input type="checkbox" name="recipients.${escapeHTML(actor.id)}"` +
    `${actor.hasPlayerOwner ? " checked" : ""}><span>${escapeHTML(actor.name)}</span></label>`).join("");
  const response = await foundry.applications.api.DialogV2.input({
    window: { title: "Distribuir XP — Sessão encerrada" },
    classes: ["nexus-xp-dialog"],
    position: { width: 430 },
    content: '<div class="form-group"><label for="nexus-session-xp-amount">XP por personagem</label>' +
      `<input id="nexus-session-xp-amount" name="amount" type="number" min="1" step="1" value="${initial}" required autofocus></div>` +
      '<fieldset><legend>Personagens que receberão XP</legend>' +
      '<div class="nexus-xp-recipients-list">' + rows + '</div></fieldset>',
    ok: { label: "Distribuir XP", icon: "fa-solid fa-star" },
    modal: true,
    rejectClose: false
  });
  if (!response) return null;
  requireGM();
  const ids = actors.filter(actor => response.recipients?.[actor.id] === true ||
    response[`recipients.${actor.id}`] === true).map(actor => actor.id);
  return awardXP(ids, response.amount);
}

/** Uma única janela de distribuição evita aberturas repetidas do mesmo comando. */
export function promptXP(initialAmount) {
  if (pendingDialog) return pendingDialog;
  pendingDialog = chooseXP(initialAmount).finally(() => { pendingDialog = null; });
  return pendingDialog;
}

function handleXPCommand(message) {
  const text = String(message ?? "").trim();
  if (!/^\/(?:xp|adicionarxp)(?:\s|$)/iu.test(text)) return;
  const match = text.match(/^\/(?:xp|adicionarxp)(?:\s+(\d+))?\s*$/iu);
  if (!match) {
    ui.notifications.warn("Use /xp para escolher a quantidade e os personagens, ou /xp 50 para preencher a quantidade.");
    return false;
  }
  void promptXP(match[1]).catch(reportError);
  return false;
}

export function registerSessionXP() {
  game.nexus ??= {};
  game.nexus.awardXP = awardXP;
  game.nexus.promptXP = promptXP;
  const registries = new Set([
    globalThis.foundry?.applications?.sidebar?.tabs?.ChatLog?.CHAT_COMMANDS,
    globalThis.CONFIG?.ui?.chat?.CHAT_COMMANDS
  ].filter(registry => registry && typeof registry === "object"));
  if (registries.size) {
    // O parser nativo remove o <p> do chat rico antes de procurar o comando.
    // O hook chatMessage recebe o HTML bruto e não deve interpretar esse formato.
    for (const registry of registries) {
      registry.nexusSessionXP = {
        rgx: /^\/(?:xp|adicionarxp)(?:\s|$)[\s\S]*$/iu,
        fn(_command, match) { return handleXPCommand(match[0]); }
      };
    }
    return;
  }
  Hooks.on("chatMessage", (_chat, message) => handleXPCommand(message));
}
