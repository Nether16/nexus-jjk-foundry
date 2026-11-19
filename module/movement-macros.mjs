import { NexusFormulaEngine } from "./formula-engine.mjs";

export const movementWrites = new WeakMap();
const rollingActors = new Set();
const DEFAULT_ICON = "systems/nexus-jjk/assets/icons/d20Icon.png";
let assignments = Promise.resolve();

function warn(message) {
  ui.notifications.warn(message);
}

function reportError(error) {
  console.error("Nexus JJK | Erro na macro de movimento", error);
  ui.notifications.error(error.message || "Não foi possível preparar a macro do movimento.");
}

function escapeHTML(value) {
  return foundry.utils.escapeHTML(String(value ?? ""));
}

async function resolveMovement(itemOrUuid) {
  const uuid = typeof itemOrUuid === "string" ? itemOrUuid : itemOrUuid?.uuid;
  let item;
  try {
    if (uuid) item = await fromUuid(uuid);
  } catch (error) {
    console.warn("Nexus JJK | Movimento indisponível", error);
  }
  const actor = item?.parent;
  if (item?.documentName !== "Item" || item.type !== "attack" ||
      actor?.documentName !== "Actor" || !["character", "curse"].includes(actor.type) ||
      actor.pack || actor.compendium ||
      actor.items.get(item.id) !== item) {
    warn("Este movimento não existe mais ou não pertence a uma ficha de personagem ou maldição.");
    return null;
  }
  if (!actor.isOwner) {
    warn("Você precisa poder editar a ficha para usar este movimento.");
    return null;
  }
  return item;
}

async function finishMovementWrites(item) {
  let write;
  while ((write = movementWrites.get(item))) {
    if (await write === false) return false;
    if (movementWrites.get(item) === write) break;
  }
  return true;
}

async function readyMovement(itemOrUuid) {
  if (typeof itemOrUuid === "object" && await finishMovementWrites(itemOrUuid) === false) return null;
  let item = await resolveMovement(itemOrUuid);
  while (item) {
    const write = movementWrites.get(item);
    if (!write) return item;
    if (await finishMovementWrites(item) === false) return null;
    const current = await resolveMovement(item.uuid);
    if (!current) return null;
    if (current === item && movementWrites.get(current) === write) return current;
    item = current;
  }
  return null;
}

/** Ficha e macro compartilham a mesma trava durante prompts, rolagem e gasto de EA. */
export async function rollMovement(actor, itemOrUuid) {
  let key = actor?.uuid;
  let locked = false;
  if (key) {
    if (rollingActors.has(key)) return;
    rollingActors.add(key);
    locked = true;
  }
  try {
    let item = await resolveMovement(itemOrUuid);
    if (!item || (actor && actor.uuid !== item.parent.uuid)) return;
    if (!locked) {
      key = item.parent.uuid;
      if (rollingActors.has(key)) return;
      rollingActors.add(key);
      locked = true;
    }
    // Uma gravação ou exclusão pode ter substituído a instância do Item enquanto aguardávamos.
    item = await readyMovement(itemOrUuid);
    if (!item || item.parent.uuid !== key) return;
    return await NexusFormulaEngine.rollItem(item.parent, item);
  } catch (error) {
    reportError(error);
  } finally {
    if (locked) rollingActors.delete(key);
  }
}

function macroCommand(uuid) {
  return `await game.nexus.rollMovement(${JSON.stringify(uuid)});`;
}

function macroImage(item) {
  const image = String(item.img ?? "").trim();
  if (!image || /\.(?:mp4|webm|mov|m4v)(?:[?#]|$)/iu.test(image) ||
      /(?:^|\/)icons\/svg\/(?:image|item-bag)\.svg$/iu.test(image)) return DEFAULT_ICON;
  return image;
}

function findMovementMacro(uuid, command) {
  return game.macros.find(macro => macro.type === "script" &&
    (macro.author?.id ?? macro.author) === game.user.id && macro.command === command &&
    (!macro.getFlag("nexus-jjk", "movementUuid") || macro.getFlag("nexus-jjk", "movementUuid") === uuid));
}

function hotbarLabel(slot) {
  const macroId = game.user.hotbar?.[slot];
  return macroId ? (game.macros.get(macroId)?.name || "Macro indisponível") : "Livre";
}

async function assign(itemOrUuid, absoluteSlot, confirmReplace = false) {
  if (!["number", "string"].includes(typeof absoluteSlot) ||
      (typeof absoluteSlot === "string" && !absoluteSlot.trim())) {
    throw new Error("Escolha uma posição válida da barra de macros.");
  }
  const slot = Number(absoluteSlot);
  if (!Number.isInteger(slot) || slot < 1 || slot > 50) throw new Error("Escolha uma posição válida da barra de macros.");
  let item = await readyMovement(itemOrUuid);
  if (!item) return;
  const command = macroCommand(item.uuid);
  let macro = findMovementMacro(item.uuid, command);

  if (confirmReplace && game.user.hotbar?.[slot] && game.user.hotbar[slot] !== macro?.id) {
    const accepted = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Substituir atalho" },
      content: `<p>Substituir <strong>${escapeHTML(hotbarLabel(slot))}</strong> na página ${Math.ceil(slot / 10)}, tecla ${slot % 10}?</p>`,
      yes: { label: "Substituir" },
      no: { label: "Cancelar" },
      modal: true,
      rejectClose: false
    });
    if (accepted !== true) return;
    item = await readyMovement(item.uuid);
    if (!item) return;
  }

  const appearance = { name: item.name || "Movimento", img: macroImage(item) };
  if (!macro) {
    const MacroClass = foundry.documents.Macro.implementation;
    if (!game.user.hasPermission("MACRO_SCRIPT") || !MacroClass.canUserCreate(game.user)) {
      throw new Error("Você não tem permissão para criar macros de script. Peça ao mestre para liberar essa permissão.");
    }
    macro = await MacroClass.create({
      ...appearance,
      type: "script",
      author: game.user.id,
      command,
      ownership: { default: 0, [game.user.id]: 3 },
      flags: { "nexus-jjk": { movementUuid: item.uuid } }
    });
    if (!macro) throw new Error("Não foi possível criar a macro. Verifique sua permissão para macros de script.");
  } else if (macro.isOwner && macro.canUserModify(game.user, "update", appearance) &&
      (macro.name !== appearance.name || macro.img !== appearance.img)) {
    await macro.update(appearance);
  }
  if (!macro.canExecute) throw new Error("Você não tem permissão para executar esta macro.");
  await game.user.assignHotbarMacro(macro, slot);
  return macro;
}

function enqueueAssignment(task) {
  const result = assignments.then(task);
  assignments = result.catch(() => undefined);
  return result.catch(reportError);
}

/** O slot desta API é absoluto (1–50), igual ao recebido pelo Foundry no drag-and-drop. */
export function assignMovementMacro(itemOrUuid, absoluteSlot) {
  return enqueueAssignment(() => assign(itemOrUuid, absoluteSlot));
}

export async function promptMovementMacro(itemOrUuid) {
  try {
    const item = await resolveMovement(itemOrUuid);
    if (!item) return;
    const page = Math.clamp(Number(ui.hotbar?.page) || 1, 1, 5);
    const pages = Array.from({ length: 5 }, (_, index) => index + 1);
    const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
    const options = keys.map(key => {
      const slot = (page - 1) * 10 + (key || 10);
      return `<option value="${key}">${key} — ${escapeHTML(hotbarLabel(slot))}</option>`;
    }).join("");
    const choice = await foundry.applications.api.DialogV2.input({
      window: { title: "Macro de movimento" },
      content: `<p>Adicionar <strong>${escapeHTML(item.name || "Movimento")}</strong> à barra de macros.</p>` +
        `<div class="form-group"><label>Página</label><select name="page" aria-label="Página">${pages.map(value =>
          `<option value="${value}" ${value === page ? "selected" : ""}>${value}</option>`).join("")}</select></div>` +
        `<div class="form-group"><label>Tecla</label><select name="slot" aria-label="Tecla">${options}</select></div>`,
      ok: { label: "Adicionar atalho" },
      modal: true,
      rejectClose: false,
      render: (_event, dialog) => {
        const pageSelect = dialog.element.querySelector('[name="page"]');
        const slotSelect = dialog.element.querySelector('[name="slot"]');
        pageSelect.addEventListener("change", () => {
          for (const option of slotSelect.options) {
            const key = Number(option.value);
            option.textContent = `${key} — ${hotbarLabel((Number(pageSelect.value) - 1) * 10 + (key || 10))}`;
          }
        });
      }
    });
    if (!choice) return;
    const selectedPage = Number(choice.page);
    const selectedKey = Number(choice.slot);
    if (!Number.isInteger(selectedPage) || !pages.includes(selectedPage) || !keys.includes(selectedKey)) {
      throw new Error("Escolha a página e a tecla do atalho.");
    }
    const slot = (selectedPage - 1) * 10 + (selectedKey || 10);
    return await enqueueAssignment(() => assign(item.uuid, slot, true));
  } catch (error) {
    reportError(error);
  }
}

export function registerMovementMacros() {
  game.nexus ??= {};
  game.nexus.rollMovement = uuid => rollMovement(null, uuid);
  Hooks.on("hotbarDrop", (_hotbar, data, slot) => {
    if (data?.type !== "Item" || data.nexusMovement !== true) return;
    void assignMovementMacro(data.uuid, slot);
    return false;
  });
}
