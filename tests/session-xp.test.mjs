import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { awardXP, promptXP, registerSessionXP } from "../module/session-xp.mjs";

let environment;
const hooks = new Map();

class ActorFixture {
  constructor(data) { Object.assign(this, data); }
  async _preUpdate() { return true; }
}
globalThis.Actor = ActorFixture;
globalThis.Item = class {};
const { NexusActor } = await import("../module/documents.mjs");

beforeEach(() => {
  hooks.clear();
  environment = { dialogs: [], messages: [], errors: [], warnings: [], updates: [], answer: null,
    chatFailure: false };
  globalThis.game = { user: { id: "gm", isGM: true }, actors: new Map() };
  globalThis.CONFIG = { ui: {} };
  globalThis.Hooks = { on: (name, callback) => hooks.set(name, callback) };
  globalThis.ui = { notifications: { error: value => environment.errors.push(value),
    warn: value => environment.warnings.push(value) } };
  globalThis.foundry = { applications: { api: { DialogV2: { async input(options) {
    environment.dialogs.push(options);
    return environment.answer;
  } } } } };
  globalThis.ChatMessage = { async create(data, options) {
    if (environment.chatFailure) return null;
    const message = { ...data, options };
    environment.messages.push(message);
    return message;
  } };
});

function character(id = "hero", { xp = 0, level = 1, type = "character", ...data } = {}) {
  const actor = new NexusActor({ id, name: `Personagem ${id}`, type, isOwner: true,
    hasPlayerOwner: true, ...data, system: { level, xp: { value: xp }, attributes: {} } });
  actor.update = async changes => {
    if (actor.beforeUpdate) await actor.beforeUpdate(changes);
    if (actor.failure) throw new Error("Sem conexão");
    const allowed = await actor._preUpdate(changes, {}, game.user);
    if (allowed === false) return null;
    environment.updates.push({ id, changes: structuredClone(changes) });
    for (const [key, value] of Object.entries(changes)) {
      if (key === "system.xp.value") actor.system.xp.value = value;
      else if (key === "system.level") actor.system.level = value;
      else if (key === "system") Object.assign(actor.system, value);
    }
    return actor;
  };
  game.actors.set(id, actor);
  return actor;
}

const silence = t => t.mock.method(console, "error", () => {});
const nextTick = () => new Promise(resolve => setImmediate(resolve));

test("distribuição soma XP e usa a progressão real do documento, sem duplicar destinatários", async () => {
  const first = character("first", { xp: 80 });
  const second = character("second", { xp: 10, level: 4 });
  const result = await awardXP([first.id, first.id, second.id], 50);
  assert.deepEqual(result.received, [first.id, second.id]);
  assert.equal(first.system.level, 2);
  assert.equal(first.system.xp.value, 30);
  assert.equal(second.system.level, 4);
  assert.equal(second.system.xp.value, 60);
  assert.equal(environment.updates.length, 2);
  assert.equal(environment.messages.length, 1);
  const message = environment.messages[0];
  assert.match(message.content, /Sessão encerrada/u);
  assert.match(message.content, /XP Recebido:/u);
  assert.match(message.content, /50 XP/u);
  assert.deepEqual(message.flags["nexus-jjk"].sessionXP, { amount: 50, actorIds: ["first", "second"] });
  assert.equal(message.options.messageMode, "public", "XP de sessão é publicado, sem herdar rolagem cega");
  assert.deepEqual(message.whisper, []);
  assert.equal(message.blind, false);
});

test("o mestre pode dar XP suficiente para atravessar mais de um nível", async () => {
  const actor = character("hero", { xp: 75, level: 4 });
  await awardXP([actor.id], 350);
  assert.equal(actor.system.level, 7);
  assert.equal(actor.system.xp.value, 25);
});

test("distribuições concorrentes releem o XP após a atualização anterior", async () => {
  const actor = character("hero");
  let release;
  let entered;
  const started = new Promise(resolve => { entered = resolve; });
  actor.beforeUpdate = async () => {
    entered();
    actor.beforeUpdate = null;
    await new Promise(resolve => { release = resolve; });
  };
  const first = awardXP([actor.id], 20);
  await started;
  const second = awardXP([actor.id], 30);
  await nextTick();
  assert.equal(environment.updates.length, 0);
  release();
  await Promise.all([first, second]);
  assert.equal(actor.system.xp.value, 50);
  assert.equal(environment.messages.length, 2);
});

test("jogador não pode distribuir XP pela API nem abrir a janela", async () => {
  const actor = character();
  game.user.isGM = false;
  await assert.rejects(awardXP([actor.id], 50), /Apenas o mestre/u);
  await assert.rejects(promptXP(), /Apenas o mestre/u);
  assert.deepEqual(environment.updates, []);
  assert.deepEqual(environment.dialogs, []);
});

test("quantidades inválidas são recusadas antes de qualquer atualização", async () => {
  const actor = character();
  for (const amount of [0, -1, 1.5, NaN, Infinity, "", "abc", null, true, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(awardXP([actor.id], amount), /quantidade inteira/u);
  }
  assert.deepEqual(environment.updates, []);
});

test("destinatários precisam ser personagens do mundo válidos", async () => {
  const actor = character();
  character("curse", { type: "curse" });
  character("summon", { type: "shikigami" });
  character("compendium", { pack: "nexus.heroes" });
  character("synthetic", { isToken: true });
  for (const ids of [[], null, ["missing"], [actor.id, "missing"], ["curse"], ["summon"],
    ["compendium"], ["synthetic"], [null]]) {
    await assert.rejects(awardXP(ids, 50));
  }
  assert.deepEqual(environment.updates, []);
});

test("XP inválido ou acima da precisão segura não atualiza nenhuma ficha", async () => {
  const actor = character();
  const invalid = character("bad", { xp: Number.MAX_SAFE_INTEGER });
  await assert.rejects(awardXP([actor.id, invalid.id], 50), /intervalo permitido/u);
  assert.deepEqual(environment.updates, []);
});

test("falha parcial lista apenas as fichas que receberam na mensagem, sem repetir XP", async t => {
  silence(t);
  const first = character("first");
  const failed = character("failed");
  failed.failure = true;
  const last = character("last");
  const result = await awardXP([first.id, failed.id, last.id], 50);
  assert.deepEqual(result.received, [first.id, last.id]);
  assert.deepEqual(result.failed, [failed.id]);
  assert.equal(first.system.xp.value, 50);
  assert.equal(failed.system.xp.value, 0);
  assert.equal(last.system.xp.value, 50);
  assert.ok(!result.message.content.includes("Personagem failed"));
  assert.match(environment.errors[0], /Personagem failed.*não repita/u);
});

test("sem nenhum destinatário atualizado não anuncia sessão com XP no chat", async t => {
  silence(t);
  const actor = character();
  actor.failure = true;
  const result = await awardXP([actor.id], 50);
  assert.deepEqual(result.received, []);
  assert.equal(result.message, null);
  assert.deepEqual(environment.messages, []);
});

test("falha no chat avisa que o XP já foi aplicado, sem reverter ou repetir a progressão", async t => {
  silence(t);
  const actor = character("hero", { xp: 80 });
  environment.chatFailure = true;
  const result = await awardXP([actor.id], 50);
  assert.equal(actor.system.level, 2);
  assert.equal(actor.system.xp.value, 30);
  assert.deepEqual(result.received, [actor.id]);
  assert.equal(result.message, null);
  assert.match(environment.errors[0], /XP foi aplicado.*Não repita/u);
});

test("fallback de chat antigo intercepta /xp e /adicionarxp sem afetar outros comandos", async () => {
  character();
  registerSessionXP();
  const command = hooks.get("chatMessage");
  assert.equal(command({}, "/xp 50"), false);
  await nextTick();
  assert.equal(environment.dialogs.length, 1);
  assert.match(environment.dialogs[0].content, /name="amount"[^>]*value="50"/u);
  assert.match(environment.dialogs[0].content, /name="recipients.hero"/u);
  assert.equal(command({}, "/adicionarxp"), false);
  await nextTick();
  assert.equal(environment.dialogs.length, 2);
  assert.equal(command({}, "/r 1d20"), undefined);
  assert.equal(command({}, "/xp -1"), false);
  assert.equal(environment.warnings.length, 1);
});

test("Foundry 14 registra o comando no chat nativo e no chat customizado sem duplicar o hook", async () => {
  character();
  const rollCommand = { rgx: /^\/r /u, fn() {} };
  const nativeCommands = { roll: rollCommand };
  const customCommands = { roll: rollCommand };
  foundry.applications.sidebar = { tabs: { ChatLog: { CHAT_COMMANDS: nativeCommands } } };
  CONFIG.ui.chat = { CHAT_COMMANDS: customCommands };
  registerSessionXP();
  registerSessionXP();
  assert.equal(hooks.has("chatMessage"), false);
  assert.equal(nativeCommands.roll, rollCommand);
  assert.equal(customCommands.roll, rollCommand);
  assert.equal(Object.keys(nativeCommands).filter(key => key === "nexusSessionXP").length, 1);
  const command = customCommands.nexusSessionXP;
  assert.equal(command.fn("nexusSessionXP", "/xp 50".match(command.rgx)), false);
  await nextTick();
  assert.equal(environment.dialogs.length, 1);
  assert.match(environment.dialogs[0].content, /name="amount"[^>]*value="50"/u);
  assert.equal(command.rgx.test("/r 1d20"), false);
  assert.equal(command.rgx.test("/xpextra"), false);
});

test("o comando nativo valida argumentos, mantém o alias e bloqueia jogadores", async t => {
  silence(t);
  character();
  const commands = {};
  foundry.applications.sidebar = { tabs: { ChatLog: { CHAT_COMMANDS: commands } } };
  registerSessionXP();
  const command = commands.nexusSessionXP;
  for (const text of ["/xp -1", "/xp abc", "/xp 5.5"]) {
    assert.equal(command.fn("nexusSessionXP", text.match(command.rgx)), false);
  }
  assert.equal(environment.warnings.length, 3);
  assert.equal(environment.dialogs.length, 0);
  assert.equal(command.fn("nexusSessionXP", "/adicionarxp 25".match(command.rgx)), false);
  await nextTick();
  assert.equal(environment.dialogs.length, 1);
  game.user = { id: "player", isGM: false };
  assert.equal(command.fn("nexusSessionXP", "/xp 25".match(command.rgx)), false);
  await nextTick();
  assert.equal(environment.dialogs.length, 1);
  assert.match(environment.errors.at(-1), /Apenas o mestre/u);
  assert.equal(environment.updates.length, 0);
});

test("a janela premia somente as fichas marcadas e cancelar não altera nada", async () => {
  const first = character("first");
  const second = character("second");
  environment.answer = { amount: "25", recipients: { first: false, second: true } };
  const result = await promptXP();
  assert.deepEqual(result.received, [second.id]);
  assert.equal(first.system.xp.value, 0);
  assert.equal(second.system.xp.value, 25);
  environment.answer = null;
  assert.equal(await promptXP(), null);
  assert.equal(environment.updates.length, 1);
});

test("a janela aceita nomes pontuados planos retornados pelo FormDataExtended nativo", async () => {
  const first = character("first");
  const second = character("second");
  environment.answer = { amount: 15, "recipients.first": false, "recipients.second": true };
  assert.deepEqual((await promptXP()).received, [second.id]);
  assert.equal(first.system.xp.value, 0);
  assert.equal(second.system.xp.value, 15);
});

test("sem fichas ou sem nenhuma seleção a distribuição não atualiza nem publica", async () => {
  await assert.rejects(promptXP(), /Crie uma ficha/u);
  character();
  environment.answer = { amount: 25, "recipients.hero": false };
  await assert.rejects(promptXP(), /Selecione ao menos uma ficha/u);
  assert.deepEqual(environment.updates, []);
  assert.deepEqual(environment.messages, []);
});

test("uma janela pendente é reutilizada e não duplica o prêmio", async () => {
  character();
  let release;
  foundry.applications.api.DialogV2.input = async () => new Promise(resolve => { release = resolve; });
  const first = promptXP();
  const second = promptXP();
  assert.equal(first, second);
  release({ amount: 20, recipients: { hero: true } });
  await Promise.all([first, second]);
  assert.equal(environment.updates.length, 1);
});

test("nome de personagem no diálogo e no chat é texto, sem HTML executável", async () => {
  const actor = character("hero", { name: '<img src=x onerror="oops">' });
  environment.answer = { amount: 20, recipients: { hero: true } };
  await promptXP();
  assert.ok(!environment.dialogs[0].content.includes("<img"));
  assert.ok(!environment.messages[0].content.includes("<img"));
  assert.equal(actor.system.xp.value, 20);
});
