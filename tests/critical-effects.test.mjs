import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire, registerHooks } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import test, { beforeEach } from "node:test";
import { hasCriticalD20, createCriticalOffer, chooseCriticalEffect, registerCriticalEffects } from "../module/critical-effects.mjs";

let environment;
const getProperty = (object, key) => key.split(".").reduce((value, part) => value?.[part], object);
function setProperty(object, key, value) {
  const parts = key.split(".");
  const last = parts.pop();
  const target = parts.reduce((value, part) => value[part] ??= {}, object);
  target[last] = value;
}
const critical = message => message.flags?.["nexus-jjk"]?.criticalEffect;
const die = (result = 20, extra = {}) => ({ faces: 20, results: [{ result, active: true, ...extra }] });
const d20Roll = (result = 20, total = result) => ({ dice: [die(result)], total });

function message(data = {}) {
  const record = { id: `m${environment.nextId++}`, uuid: "", author: "player", speaker: { actor: "hero" },
    speakerActor: environment.actor, whisper: [], blind: false, rolls: [], flags: {}, isContentVisible: true,
    ...data,
    getFlag(scope, key) { return this.flags[scope]?.[key]; },
    canUserModify(user) { return user.isGM || (user.id === (this.author?.id ?? this.author)); },
    async update(changes) {
      environment.updates.push({ id: this.id, changes: structuredClone(changes) });
      for (const [key, value] of Object.entries(changes)) setProperty(this, key, structuredClone(value));
      return this;
    }
  };
  record.uuid ||= `ChatMessage.${record.id}`;
  game.messages.set(record.id, record);
  return record;
}

beforeEach(() => {
  environment = { actor: { documentName: "Actor", uuid: "Actor.hero", isOwner: true },
    messages: [], updates: [], warnings: [], errors: [], rolls: [], hooks: new Map(), nextId: 1, outcome: 2 };
  globalThis.game = { user: { id: "player", isGM: false }, messages: new Map() };
  globalThis.fromUuid = async uuid => uuid === environment.actor.uuid ? environment.actor : null;
  globalThis.ui = { notifications: { warn: value => environment.warnings.push(value), error: value => environment.errors.push(value) } };
  globalThis.ChatMessage = {
    getSpeakerActor: () => environment.actor,
    async create(data, options) {
      if (environment.createFailure) return null;
      const result = message(data);
      environment.messages.push({ message: result, options });
      return result;
    }
  };
  globalThis.Roll = class {
    constructor(formula) { this.formula = formula; }
    async evaluate(options) {
      environment.rolls.push({ formula: this.formula, options });
      this.total = environment.outcome;
      if (environment.pendingRoll) await environment.pendingRoll;
      return this;
    }
    async render() { return `<div class="dice-roll"><div class="dice-formula">1d2</div><div class="dice-total">${this.total}</div></div>`; }
  };
  globalThis.Hooks = { on(name, callback) { environment.hooks.set(name, callback); } };
});

test("crítico usa o resultado natural mantido do d20, nunca o total com modificadores", () => {
  assert.equal(hasCriticalD20({ rolls: [d20Roll(20, 4)] }), true);
  assert.equal(hasCriticalD20({ rolls: [d20Roll(19, 20)] }), false);
  assert.equal(hasCriticalD20({ rolls: [d20Roll(19, 50)] }), false);
  for (const excluded of [{ active: false }, { discarded: true }, { rerolled: true }]) {
    assert.equal(hasCriticalD20({ rolls: [{ dice: [die(20, excluded)] }] }), false);
  }
  assert.equal(hasCriticalD20({ rolls: [{ dice: [{ faces: 12, results: [{ result: 20, active: true }] }] }] }), false);
});

test("mensagem de movimento considera somente os índices da rolagem de ataque", () => {
  const record = { rolls: [d20Roll(19), d20Roll(20), d20Roll(20)], flags: { "nexus-jjk": { criticalRollIndexes: [0] } } };
  assert.equal(hasCriticalD20(record), false, "20 no custo e efeito não é um acerto crítico");
  record.rolls[0] = d20Roll(20);
  assert.equal(hasCriticalD20(record), true);
  record.flags["nexus-jjk"].criticalRollIndexes = [];
  assert.equal(hasCriticalD20(record), false, "movimento sem teste de ataque não dispara crítico");
});

test("dados serializados e termos aninhados reconhecem o d20 e ignoram cartas derivadas", () => {
  const record = { rolls: [JSON.stringify({ terms: [{ rolls: [{ terms: [die()] }] }] })] };
  assert.equal(hasCriticalD20(record), true);
  record.flags = { "nexus-jjk": { criticalEffect: { kind: "result" } } };
  assert.equal(hasCriticalD20(record), false);
  assert.equal(hasCriticalD20({ rolls: ["invalid json"] }), false);
});

test("oferta aparece uma vez no cliente autor e conserva a privacidade da rolagem", async () => {
  const source = message({ author: { id: "player" }, rolls: [d20Roll()], whisper: ["gm", "ally"], blind: true });
  const offer = await createCriticalOffer(source);
  assert.ok(offer);
  assert.match(offer.content, /EFEITO CRÍTICO/u);
  assert.match(offer.content, /Escolha seu efeito/u);
  assert.match(offer.content, />Kokusen</u);
  assert.match(offer.content, />Outro Efeito</u);
  assert.deepEqual(offer.whisper, source.whisper);
  assert.equal(offer.blind, true);
  assert.equal(environment.messages[0].options, undefined, "não aplica um messageMode que mudaria os destinatários");
  assert.equal(critical(offer).actorUuid, environment.actor.uuid);
  await createCriticalOffer(source);
  assert.equal(environment.messages.length, 1);
  const another = message({ author: "other", rolls: [d20Roll()] });
  assert.equal(await createCriticalOffer(another), undefined);
  assert.equal(environment.messages.length, 1);
});

test("só o autor ou mestre com acesso à ficha pode resolver o crítico", async () => {
  const offer = await createCriticalOffer(message({ rolls: [d20Roll()] }));
  game.user = { id: "other", isGM: false };
  assert.equal(await chooseCriticalEffect(offer.id, "kokusen"), undefined);
  assert.equal(critical(offer).state, "pending");
  game.user = { id: "player", isGM: false };
  environment.actor.isOwner = false;
  assert.equal(await chooseCriticalEffect(offer.id, "kokusen"), undefined);
  assert.equal(critical(offer).state, "pending");
  environment.actor.isOwner = true;
  game.user = { id: "gm", isGM: true };
  assert.ok(await chooseCriticalEffect(offer.id, "kokusen"));
  assert.equal(environment.rolls.length, 1);
});

test("autor não escolhe carta de rolagem cega cujo conteúdo não pode ver", async () => {
  const offer = await createCriticalOffer(message({ rolls: [d20Roll()], blind: true, whisper: ["gm"] }));
  offer.isContentVisible = false;
  assert.equal(await chooseCriticalEffect(offer.id, "kokusen"), undefined);
  assert.equal(environment.rolls.length, 0);
});

test("Kokusen com resultado 2 publica as regras sem alterar recursos ou atributos", async () => {
  const offer = await createCriticalOffer(message({ rolls: [d20Roll()], whisper: ["player"], blind: false }));
  const before = structuredClone(environment.actor);
  const result = await chooseCriticalEffect(offer.id, "kokusen");
  assert.match(result.content, /Kokusen!/u);
  assert.match(result.content, /Raios Negros/u);
  assert.match(result.content, /por 2/u);
  assert.match(result.content, /3 rodadas/u);
  assert.match(result.content, /19/u);
  assert.match(result.content, /20% de diminuição/u);
  assert.match(result.content, /aumentados em 20%/u);
  assert.match(result.content, /dice-formula">1d2/u);
  assert.match(result.content, /dice-total">2/u);
  assert.deepEqual(result.whisper, ["player"]);
  assert.equal(result.blind, false);
  assert.deepEqual(environment.actor, before);
  assert.deepEqual(environment.rolls, [{ formula: "1d2", options: { allowInteractive: true } }]);
  assert.equal(JSON.parse(result.rolls[0]).total, 2);
  assert.equal(critical(offer).state, "resolved");
  assert.equal(critical(offer).resultMessageId, result.id);
  assert.equal(hasCriticalD20(result), false);
});

test("Kokusen com resultado 1 publica Crítico de 130%", async () => {
  environment.outcome = 1;
  const offer = await createCriticalOffer(message({ rolls: [d20Roll()] }));
  const result = await chooseCriticalEffect(offer.id, "kokusen");
  assert.match(result.content, /Crítico!/u);
  assert.match(result.content, /130%/u);
  assert.match(result.content, /dice-total">1/u);
  assert.doesNotMatch(result.content, /20% de diminuição/u);
});

test("Outro Efeito abre escolhas, Faíscas gera Kokusen imediato com título próprio", async () => {
  const offer = await createCriticalOffer(message({ rolls: [d20Roll()] }));
  assert.equal(await chooseCriticalEffect(offer.id, "sparks"), undefined, "ação escondida não é aceita antes de Outro Efeito");
  await chooseCriticalEffect(offer.id, "other");
  assert.equal(critical(offer).state, "alternatives");
  assert.match(offer.content, /Escolhido pelas Faíscas/u);
  assert.match(offer.content, /Efeito Narrativo/u);
  const result = await chooseCriticalEffect(offer.id, "sparks");
  assert.match(result.content, /Escolhido pelas Faíscas/u);
  assert.doesNotMatch(result.content, /Kokusen!/u);
  assert.match(result.content, /Raios Negros/u);
  assert.deepEqual(environment.rolls, [], "Faíscas não faz o teste de 1d2");
});

test("Efeito Narrativo publica apenas Excelente resultado e não rola dados", async () => {
  const offer = await createCriticalOffer(message({ rolls: [d20Roll()] }));
  await chooseCriticalEffect(offer.id, "other");
  const result = await chooseCriticalEffect(offer.id, "narrative");
  assert.equal(result.content.replace(/<[^>]+>/gu, ""), "Excelente resultado!");
  assert.deepEqual(environment.rolls, []);
  assert.equal(critical(offer).state, "resolved");
});

test("escolha sem ator funciona para /r 1d20 e ignora reexecução depois de resolvida", async () => {
  const offer = await createCriticalOffer(message({ rolls: [d20Roll()], speakerActor: null, speaker: {} }));
  assert.equal(critical(offer).actorUuid, environment.actor.uuid, "fallback do speaker nativo usado quando existe");
  ChatMessage.getSpeakerActor = () => null;
  const plainOffer = await createCriticalOffer(message({ rolls: [d20Roll()], speakerActor: null, speaker: {} }));
  assert.equal(critical(plainOffer).actorUuid, null);
  const result = await chooseCriticalEffect(plainOffer.id, "kokusen");
  assert.ok(result);
  assert.equal(await chooseCriticalEffect(plainOffer.id, "kokusen"), undefined);
  assert.equal(environment.rolls.length, 1);
});

test("cliques simultâneos não repetem a rolagem nem o cartão", async () => {
  const offer = await createCriticalOffer(message({ rolls: [d20Roll()] }));
  let release;
  environment.pendingRoll = new Promise(resolve => { release = resolve; });
  const first = chooseCriticalEffect(offer.id, "kokusen");
  const second = chooseCriticalEffect(offer.id, "kokusen");
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(environment.rolls.length, 1);
  release();
  assert.ok(await first);
  assert.equal(await second, undefined);
  assert.equal(environment.messages.length, 2);
});

test("falha ao publicar reabre a escolha sem registrar resultado inexistente", async t => {
  t.mock.method(console, "error", () => {});
  const offer = await createCriticalOffer(message({ rolls: [d20Roll()] }));
  offer.update = async function(changes) {
    for (const [key, value] of Object.entries(changes)) {
      if (key === "flags.nexus-jjk.criticalEffect") Object.assign(critical(this), structuredClone(value));
      else setProperty(this, key, structuredClone(value));
    }
    return this;
  };
  environment.createFailure = true;
  assert.equal(await chooseCriticalEffect(offer.id, "kokusen"), undefined);
  assert.equal(critical(offer).state, "pending");
  assert.equal(critical(offer).resultMessageId, undefined);
  environment.createFailure = false;
  assert.ok(await chooseCriticalEffect(offer.id, "kokusen"));
});

test("registrador usa os hooks nativos e desativa os botões de espectadores", async () => {
  registerCriticalEffects();
  assert.equal(typeof environment.hooks.get("createChatMessage"), "function");
  const offer = await createCriticalOffer(message({ rolls: [d20Roll()] }));
  game.user = { id: "spectator", isGM: false };
  const button = { disabled: false };
  const html = { querySelectorAll: () => [button], addEventListener() {} };
  environment.hooks.get("renderChatMessageHTML")(offer, html);
  assert.equal(button.disabled, true);
});

const nativeRoot = [process.env.FOUNDRY_APP_PATH, process.env.LOCALAPPDATA && path.join(
  process.env.LOCALAPPDATA, "Programs/Foundry Virtual Tabletop/resources/app")]
  .find(root => root && fs.existsSync(path.join(root, "client/dice/roll.mjs")));
test("Foundry 14 nativo: d20 dentro de floor e resultados descartados são detectados corretamente", {
  skip: !nativeRoot
}, async () => {
  const require = createRequire(import.meta.url);
  const peggy = require(path.join(nativeRoot, "node_modules/peggy"));
  const resolver = registerHooks({
    resolve(specifier, context, next) {
      if (specifier.startsWith("@common/")) specifier = pathToFileURL(path.join(nativeRoot, "common", specifier.slice(8))).href;
      return next(specifier, context);
    },
    load(url, context, next) {
      if (url.endsWith(".pegjs")) return { format: "module", shortCircuit: true,
        source: peggy.generate(fs.readFileSync(fileURLToPath(url), "utf8"), { output: "source", format: "es" }) };
      return next(url, context);
    }
  });
  try {
    await import(pathToFileURL(path.join(nativeRoot, "common/server.mjs")));
    const NativeRoll = (await import(pathToFileURL(path.join(nativeRoot, "client/dice/roll.mjs")))).default;
    const terms = await import(pathToFileURL(path.join(nativeRoot, "client/dice/terms/_module.mjs")));
    const RollParser = (await import(pathToFileURL(path.join(nativeRoot, "client/dice/parser.mjs")))).default;
    const RollGrammar = await import(pathToFileURL(path.join(nativeRoot, "client/dice/grammar.pegjs")));
    foundry.dice = { Roll: NativeRoll, terms, RollParser, RollGrammar };
    globalThis.CONFIG = { debug: { dice: false, rollParsing: false }, Dice: {
      rolls: [NativeRoll], parser: RollParser, functions: {}, termTypes: terms,
      terms: { d: terms.Die, c: terms.Coin, f: terms.FateDie }, randomUniform: () => .001,
      fulfillment: { defaultMethod: "digital", methods: { digital: { interactive: false } } }
    } };
    game.settings = { get: () => ({}) };
    const kept = await new NativeRoll("floor(1d20 + 7)").evaluate({ allowInteractive: false });
    assert.equal(kept.total, 27);
    assert.equal(hasCriticalD20({ rolls: [kept] }), true);
    assert.equal(hasCriticalD20({ rolls: [JSON.stringify(kept)] }), true);
    const restored = NativeRoll.fromJSON(JSON.stringify(kept));
    restored.dice[0].results[0].active = false;
    restored.dice[0].results[0].discarded = true;
    assert.equal(hasCriticalD20({ rolls: [restored] }), false);
    CONFIG.Dice.randomUniform = () => .051;
    const modified = await new NativeRoll("1d20 + 1").evaluate({ allowInteractive: false });
    assert.equal(modified.total, 20);
    assert.equal(hasCriticalD20({ rolls: [modified] }), false);
  } finally { resolver.deregister(); }
});
