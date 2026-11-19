import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire, registerHooks } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import test, { beforeEach } from "node:test";
import {
  NexusFormulaEngine, evaluateNumeric, prepareDiceFormula, resolveFormula
} from "../module/formula-engine.mjs";

let environment;
const getProperty = (object, key) => key.split(".").reduce((value, part) => value?.[part], object);

// Substitui somente os serviços externos; os cálculos vêm do motor em teste.
class TestRoll {
  static CHAT_TEMPLATE = "templates/dice/roll.hbs";
  constructor(formula) { this.formula = formula; environment.formulas.push(formula); }
  static safeEval(formula) {
    const safe = formula.replace(/\b(abs|ceil|floor|max|min|pow|round|sqrt)\b/gu, "Math.$1");
    if (!/^[\d\s.+*/(),%-]+$/u.test(safe.replace(/Math\.(abs|ceil|floor|max|min|pow|round|sqrt)/gu, ""))) {
      throw new Error("Fórmula inválida no serviço de teste");
    }
    return Function(`"use strict"; return (${safe});`)();
  }
  async evaluate(options) {
    environment.rollOptions.push(options);
    const formula = this.formula.replace(/(\d+)d(\d+)/giu, (_whole, number, faces) => {
      if (Number(faces) < 1) throw new Error("Dado inválido");
      return String(Number(number) * Math.min(10, Number(faces)));
    });
    this.total = TestRoll.safeEval(formula);
    return this;
  }
  async _prepareChatRenderContext() { return { formula: this.formula, total: this.total, tooltip: "" }; }
}

beforeEach(() => {
  environment = { messages: [], updates: [], warnings: [], errors: [], formulas: [], prompts: [],
    values: [], rollOptions: [], renderContexts: [], chatFailure: null, updateFailure: false };
  globalThis.Roll = TestRoll;
  globalThis.foundry = { utils: { getProperty }, applications: { api: { DialogV2: {
    async input(options) {
      environment.prompts.push(options);
      return environment.values.length ? environment.values.shift() : { value: "0" };
    }
  } }, handlebars: {
    async renderTemplate(template, context) {
      environment.renderContexts.push({ template, context: structuredClone(context) });
      return `<div class="dice-formula">${context.formula}</div><span class="roll-total">${context.total}</span>`;
    }
  } } };
  globalThis.game = { user: { id: "player" }, settings: { get: () => "blind" } };
  globalThis.ui = { notifications: {
    warn: message => environment.warnings.push(message), error: message => environment.errors.push(message)
  } };
  globalThis.ChatMessage = {
    getSpeaker: ({ actor }) => ({ actor: actor.id }),
    async create(data) {
      if (environment.chatFailure === "throw") throw new Error("Falha de rede");
      if (environment.chatFailure === "cancel") return null;
      environment.messages.push(data);
      return data;
    }
  };
});

function actor({ type = "character", ea = 20, owner = true } = {}) {
  return { id: "actor", type, isOwner: owner, weaponDamage: 7, weaponAccuracy: 3,
    system: { attributes: { forca: 3, destreza: 4 }, ea: { value: ea },
      hp: { value: 100, max: 150 }, level: 1 },
    async update(changes) {
      environment.updates.push(changes);
      if (environment.updateFailure) return null;
      this.system.ea.value = changes["system.ea.value"];
      return this;
    }
  };
}

const item = (system = {}) => ({ name: "Golpe", img: "", system: { attack: "", cost: "", effect: "", ...system } });
const totals = message => message.rolls.map(json => JSON.parse(json).total);
const plain = html => html.replace(/<div class="dice-formula">[^]*?<\/div>/gu, "")
  .replace(/<[^>]*>/gu, " ").replace(/\s+/gu, " ").trim();

test("evaluateNumeric e subexpressões mantêm a precisão antes do resultado final", () => {
  assert.equal(evaluateNumeric("3 / 2"), 1.5);
  assert.equal(evaluateNumeric("sqrt(2)"), Math.sqrt(2));
  assert.equal(evaluateNumeric(prepareDiceFormula("(3 / 2) * 2")), 3);
  assert.equal(prepareDiceFormula("sqrt(2) + floor(7 / 2)"), "sqrt(2) + floor(7 / 2)");
  assert.equal(prepareDiceFormula("min((3 / 2), 2.8)"), "min(1.5, 2.8)");
});

test("funções preservam vírgulas de argumentos e decimais usam vírgula fora das funções", () => {
  const values = new Map();
  const current = actor();
  const formula = resolveFormula(current, "max(1.7, 2.8) + min(6.5, 4.9) + 1,5", values);
  assert.equal(evaluateNumeric(formula), 9.2);
  assert.equal(evaluateNumeric(resolveFormula(current, "(3,5 / 2) * 2", values)), 3.5);
});

test("aliases de acerto consultam o valor atual sem confundir dano da arma", () => {
  const current = actor();
  for (const alias of ["ARMA_ACERTO", "armaacerto", "Acerto_Arma", "ACERTOARMA", "@{Arma acerto}", "@{Acerto arma}"]) {
    assert.equal(evaluateNumeric(resolveFormula(current, `${alias} + ARMA + DES`, new Map())), 14, alias);
    current.weaponAccuracy = 5;
    assert.equal(evaluateNumeric(resolveFormula(current, alias, new Map())), 5, alias);
    current.weaponAccuracy = 3;
  }
  for (const accuracy of [undefined, null, -1, NaN, Infinity]) {
    current.weaponAccuracy = accuracy;
    assert.equal(evaluateNumeric(resolveFormula(current, "ARMA_ACERTO", new Map())), 0);
  }
});

test("acerto em ataque, custo e efeito resolve sem prompts e mantém débito de EA", async () => {
  const current = actor();
  const movement = item({ attack: "1d20 + DES + @{Arma acerto}", cost: "ARMAACERTO - 0.1",
    effect: "Acerto: ACERTO_ARMA | Dano: ARMA + FOR | Soma: acertoarma + 1" });
  const saved = structuredClone(movement);
  const message = await NexusFormulaEngine.rollItem(current, movement);
  assert.deepEqual(totals(message), [17]);
  assert.equal(current.system.ea.value, 18);
  assert.deepEqual(environment.updates, [{ "system.ea.value": 18 }]);
  assert.match(plain(message.content), /Custo em EA 2 EA Acerto: 3 Dano: 10 Soma: 4/u);
  assert.deepEqual(environment.prompts, []);
  assert.deepEqual(environment.errors, []);
  assert.deepEqual(movement, saved);
});

test("arma afiliada não acrescenta acerto quando a fórmula de ataque não o solicita", async () => {
  const current = actor();
  current.weaponAccuracy = 5;
  const message = await NexusFormulaEngine.rollItem(current, item({ attack: "1d20 + DES", cost: "2.9" }));
  assert.deepEqual(totals(message), [14]);
  assert.equal(current.system.ea.value, 18);
  assert.deepEqual(environment.prompts, []);
});

for (const type of ["character", "curse"]) {
  test(`${type}: custo decimal gasta o inteiro inferior e preserva a fórmula salva`, async () => {
    const current = actor({ type, ea: 2 });
    const movement = item({ cost: "2,9", effect: "1.9" });
    const original = structuredClone(movement);
    const message = await NexusFormulaEngine.rollItem(current, movement);
    assert.ok(message);
    assert.equal(current.system.ea.value, 0);
    assert.deepEqual(environment.updates, [{ "system.ea.value": 0 }]);
    assert.match(plain(message.content), /Custo em EA 2 EA Efeito 1/u);
    assert.deepEqual(movement, original);
  });
}

test("custo e efeito só arredondam depois de multiplicações e divisões intermediárias", async () => {
  const current = actor();
  const message = await NexusFormulaEngine.rollItem(current, item({ cost: "(3 / 2) * 2", effect: "(3.8 / 2) * 2" }));
  assert.equal(current.system.ea.value, 17);
  assert.match(plain(message.content), /Custo em EA 3 EA Efeito 3/u);
});

test("variáveis solicitadas continuam fracionárias durante todos os cálculos", async () => {
  environment.values = [{ value: "1.9" }];
  const message = await NexusFormulaEngine.rollItem(actor(), item({
    attack: "1d20 + (Bonus / 2) * 2", cost: "Bonus * 2", effect: "Dano: (Bonus / 2) * 2"
  }));
  assert.equal(environment.prompts.length, 1);
  assert.deepEqual(totals(message), [11]);
  assert.match(plain(message.content), /Custo em EA 3 EA Dano: 1/u);
});

test("ataque, custo com dado e módulos de efeito têm totais inteiros consistentes", async () => {
  const current = actor();
  const message = await NexusFormulaEngine.rollItem(current, item({ attack: "1d20 / 3 + 1.9",
    cost: "1d20 / 3", effect: 'Dano: FOR * 1.5 | Cura: 1d20 / 4 | Nota: "DPT 2.5 por turno"' }));
  assert.deepEqual(totals(message), [5, 3, 2]);
  assert.equal(current.system.ea.value, 17);
  assert.match(plain(message.content), /Dano: 4 Cura: 2 Nota: DPT 2.5 por turno/u);
  assert(environment.formulas.every(formula => formula.startsWith("floor(")));
  assert(environment.rollOptions.every(options => options.allowInteractive === false));
});

test("chat oculta só o floor automático de ataque, custo e efeito sem mudar os Rolls", async () => {
  const current = actor();
  const movement = item({ attack: "floor(1d20 / 3) + 1.9", cost: "1d20 / 4",
    effect: "Dano: 1d20 / 3 + 0.9" });
  const saved = structuredClone(movement);
  const message = await NexusFormulaEngine.rollItem(current, movement);
  assert.deepEqual(environment.renderContexts.map(({ template, context }) => ({ template, formula: context.formula })), [
    { template: TestRoll.CHAT_TEMPLATE, formula: "floor(1d20 / 3) + 1.9" },
    { template: TestRoll.CHAT_TEMPLATE, formula: "1d20 / 4" },
    { template: TestRoll.CHAT_TEMPLATE, formula: "1d20 / 3 + 0.9" }
  ]);
  assert.deepEqual(totals(message), [4, 2, 4]);
  assert.equal(current.system.ea.value, 18);
  assert.deepEqual(message.rolls.map(json => JSON.parse(json).formula), [
    "floor(floor(1d20 / 3) + 1.9)", "floor(1d20 / 4)", "floor(1d20 / 3 + 0.9)"
  ]);
  assert.match(message.content, /class="dice-formula">floor\(1d20 \/ 3\) \+ 1\.9<\/div>/u);
  assert.doesNotMatch(message.content, /class="dice-formula">floor\(floor\(/u);
  assert.deepEqual(movement, saved);
});

test("floor padrão combina com floor, ceil, min, max e sqrt explícitos", async () => {
  const message = await NexusFormulaEngine.rollItem(actor(), item({
    attack: "1d20 + min(4.8, 7.2) / 2", cost: "max(1.2, 2.8)",
    effect: "A: floor(7 / 2) + 0.9 | B: ceil(7 / 2) + 0.9 | C: sqrt(2) * 3"
  }));
  assert.deepEqual(totals(message), [12]);
  assert.match(plain(message.content), /Custo em EA 2 EA A: 3 B: 4 C: 4/u);
  assert.deepEqual(environment.errors, []);
});

test("funções unárias preservam decimais com vírgula em português", async () => {
  const message = await NexusFormulaEngine.rollItem(actor(), item({
    attack: "1d20 + ceil(1,5) * 3", cost: "abs(-2,9)",
    effect: "A: ceil(1,5) * 3 | B: sqrt(6,25) * 3 | C: round(1,5) * 2"
  }));
  assert.deepEqual(totals(message), [16]);
  assert.match(plain(message.content), /Custo em EA 2 EA A: 6 B: 7 C: 4/u);
});

test("valores negativos de efeito arredondam para baixo, texto literal fica intacto e escapado", async () => {
  const message = await NexusFormulaEngine.rollItem(actor(), item({
    effect: 'Penalidade: -0.2 | Texto: "1.9 < 2.5" | Estado: Derrubado'
  }));
  assert.match(message.content, /-1/u);
  assert.match(message.content, /1\.9 &lt; 2\.5/u);
  assert.match(message.content, /Derrubado/u);
});

for (const cost of ["-0.2", "1 / 0", "1d0", "texto"]) {
  test(`custo inválido/negativo ${JSON.stringify(cost)} não altera EA nem publica`, async () => {
    const current = actor();
    assert.equal(await NexusFormulaEngine.rollItem(current, item({ attack: "1d20", cost })), undefined);
    assert.equal(current.system.ea.value, 20);
    assert.deepEqual(environment.updates, []);
    assert.deepEqual(environment.messages, []);
    assert.equal(environment.errors.length, 1);
  });
}

test("EA insuficiente usa o custo inteiro e impede rolar o ataque", async () => {
  const current = actor({ ea: 2 });
  assert.equal(await NexusFormulaEngine.rollItem(current, item({ attack: "1d20", cost: "3.9" })), undefined);
  assert.deepEqual(environment.formulas, []);
  assert.match(environment.warnings[0], /custa 3 EA e você tem 2 EA/u);
  assert.deepEqual(environment.updates, []);
});

test("custo fracionário menor que um é zero, sem escrita de EA", async () => {
  const message = await NexusFormulaEngine.rollItem(actor({ ea: 0, owner: false }), item({ cost: "0.9" }));
  assert.ok(message);
  assert.match(plain(message.content), /Custo em EA 0 EA/u);
  assert.deepEqual(environment.updates, []);
});

for (const failure of ["throw", "cancel"]) {
  test(`falha de chat (${failure}) devolve exatamente o custo inteiro debitado`, async () => {
    environment.chatFailure = failure;
    const current = actor();
    assert.equal(await NexusFormulaEngine.rollItem(current, item({ cost: "2.9" })), undefined);
    assert.equal(current.system.ea.value, 20);
    assert.deepEqual(environment.updates, [{ "system.ea.value": 18 }, { "system.ea.value": 20 }]);
    assert.equal(environment.errors.length, 1);
  });
}

test("falha ao gravar EA não publica e não tenta reembolsar débito não concluído", async () => {
  environment.updateFailure = true;
  assert.equal(await NexusFormulaEngine.rollItem(actor(), item({ cost: "2.9" })), undefined);
  assert.deepEqual(environment.updates, [{ "system.ea.value": 18 }]);
  assert.deepEqual(environment.messages, []);
});

test("fórmula inválida de ataque ou efeito não gasta EA", async () => {
  for (const system of [{ attack: "1d0", cost: "2.9" }, { effect: "1 / 0", cost: "2.9" }]) {
    const current = actor();
    assert.equal(await NexusFormulaEngine.rollItem(current, item(system)), undefined);
    assert.equal(current.system.ea.value, 20);
  }
  assert.deepEqual(environment.updates, []);
});

test("cancelar ou informar variável inválida interrompe sem alterações", async () => {
  for (const value of [null, { value: "não é número" }]) {
    environment.values = [value];
    assert.equal(await NexusFormulaEngine.rollItem(actor(), item({ cost: "Bonus * 2" })), undefined);
  }
  assert.deepEqual(environment.messages, []);
  assert.deepEqual(environment.updates, []);
});

test("custo de shikigami continua informativo, incluindo texto e números fracionários", async () => {
  const current = actor({ type: "shikigami" });
  delete current.system.ea;
  for (const cost of ["2.9", "1d20 + custoEspecial", "energia do invocador"]) {
    const message = await NexusFormulaEngine.rollItem(current, item({ cost, effect: '"DPT 2.5"' }));
    assert.ok(message.content.includes(cost));
  }
  assert.deepEqual(environment.prompts, []);
  assert.deepEqual(environment.formulas, []);
  assert.deepEqual(environment.updates, []);
});

// Integração opcional com os fontes nativos instalados; os demais testes não dependem do Foundry.
const foundryRoot = [process.env.FOUNDRY_APP_PATH,
  process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA,
    "Programs/Foundry Virtual Tabletop/resources/app")]
  .find(root => root && fs.existsSync(path.join(root, "client/dice/roll.mjs")));
test("Foundry 14 nativo: floor mantém dados, tooltip, serialização e chat consistentes", {
  skip: !foundryRoot
}, async () => {
  const require = createRequire(import.meta.url);
  const peggy = require(path.join(foundryRoot, "node_modules/peggy"));
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (specifier.startsWith("@common/")) specifier = pathToFileURL(path.join(foundryRoot, "common", specifier.slice(8))).href;
      return next(specifier, context);
    },
    load(url, context, next) {
      if (url.endsWith(".pegjs")) return { format: "module", shortCircuit: true,
        source: peggy.generate(fs.readFileSync(fileURLToPath(url), "utf8"), { output: "source", format: "es" }) };
      return next(url, context);
    }
  });
  try {
    await import(pathToFileURL(path.join(foundryRoot, "common/server.mjs")));
    const NativeRoll = (await import(pathToFileURL(path.join(foundryRoot, "client/dice/roll.mjs")))).default;
    const terms = await import(pathToFileURL(path.join(foundryRoot, "client/dice/terms/_module.mjs")));
    const RollParser = (await import(pathToFileURL(path.join(foundryRoot, "client/dice/parser.mjs")))).default;
    const RollGrammar = await import(pathToFileURL(path.join(foundryRoot, "client/dice/grammar.pegjs")));
    foundry.dice = { Roll: NativeRoll, terms, RollParser, RollGrammar };
    globalThis.Roll = NativeRoll;
    globalThis.CONFIG = { debug: { dice: false, rollParsing: false }, Dice: {
      rolls: [NativeRoll], parser: RollParser, functions: {}, termTypes: terms,
      terms: { d: terms.Die, c: terms.Coin, f: terms.FateDie }, randomUniform: () => 0.5,
      fulfillment: { defaultMethod: "digital", methods: { digital: { interactive: false } } }
    } };
    game.settings.get = (_scope, key) => key === "messageMode" ? "blind" : {};
    const renderContexts = [];
    foundry.applications = { api: { DialogV2: { input: async () => ({ value: "0" }) } }, handlebars: {
      async renderTemplate(template, context) {
        renderContexts.push({ template, context });
        return template.endsWith("tooltip.hbs") ? "<div>tooltip</div>" : `<span>${context.total}</span>`;
      }
    } };
    const current = actor();
    const message = await NexusFormulaEngine.rollItem(current, item({ attack: "1d20 / 3 + 1.9",
      cost: "1d20 / 3", effect: "Valor: 1d20 + min(4.8, 7.2) / 2" }));
    assert.ok(message);
    assert.deepEqual(totals(message), [5, 3, 12]);
    assert.equal(current.system.ea.value, 17);
    const cards = renderContexts.filter(render => render.template === NativeRoll.CHAT_TEMPLATE);
    assert.equal(cards.length, 3);
    assert(cards.every(({ context }) => !context.formula.startsWith("floor(")));
    assert(message.rolls.every(json => JSON.parse(json).formula.startsWith("floor(")));
    for (const json of message.rolls) {
      const restored = NativeRoll.fromJSON(json);
      assert.equal(restored.dice.length, 1);
      assert.equal(restored.dice[0].results[0].result, 10);
      assert(Number.isInteger(restored.total));
      assert.equal((await restored._prepareChatRenderContext({ isPrivate: false })).total, restored.total);
    }
    const tooltips = renderContexts.filter(render => render.template.endsWith("tooltip.hbs"));
    assert(tooltips.length >= 3);
    assert(tooltips.every(({ context }) => context.parts[0].rolls[0].result === "10"));
    const functions = await NexusFormulaEngine.rollItem(actor(), item({
      attack: "1d20 + ceil(1,5) + min(4.8, 7.2)", cost: "max(1.2, 2.9)",
      effect: "A: sqrt(6,25) * 3 | B: floor(7 / 2) + 0.9 | C: ceil(7 / 2) + 0.9"
    }));
    assert.deepEqual(totals(functions), [16]);
    assert.match(plain(functions.content), /Custo em EA 2 EA A: 7 B: 3 C: 4/u);
    const explicit = await NexusFormulaEngine.rollItem(actor(), item({ attack: "floor(1d20 / 3) + 1.9" }));
    assert.deepEqual(totals(explicit), [4]);
    assert.equal(renderContexts.filter(render => render.template === NativeRoll.CHAT_TEMPLATE).at(-1).context.formula,
      "floor(1d20 / 3) + 1.9");
    const explicitRoll = NativeRoll.fromJSON(explicit.rolls[0]);
    assert.equal(explicitRoll.formula, "floor(floor(1d20 / 3) + 1.9)");
    assert.equal(explicitRoll.dice[0].results[0].result, 10);
    assert.deepEqual(environment.errors, []);
  } finally { hooks.deregister(); }
});
