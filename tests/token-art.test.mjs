import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import test from "node:test";

const nativeRoot = [process.env.FOUNDRY_APP_PATH, process.env.LOCALAPPDATA && path.join(
  process.env.LOCALAPPDATA, "Programs/Foundry Virtual Tabletop/resources/app")]
  .find(root => root && fs.existsSync(path.join(root, "common/documents/actor.mjs")));
let NativeActor;
if (nativeRoot) {
  const resolver = registerHooks({
    resolve(specifier, context, next) {
      if (specifier.startsWith("@common/")) {
        specifier = pathToFileURL(path.join(nativeRoot, "common", specifier.slice(8))).href;
      }
      return next(specifier, context);
    }
  });
  try {
    await import(pathToFileURL(path.join(nativeRoot, "common/server.mjs")));
    NativeActor = (await import(pathToFileURL(path.join(nativeRoot, "common/documents/actor.mjs")))).default;
  } finally {
    resolver.deregister();
  }
}

const DEFAULT_TOKEN = globalThis.CONST?.DEFAULT_TOKEN ?? "icons/svg/mystery-man.svg";
const getProperty = (object, key) => key.split(".").reduce((value, part) => value?.[part], object);
function merge(target, source) {
  for (const [key, value] of Object.entries(source)) {
    const parts = key.split(".");
    const last = parts.pop();
    let parent = target;
    for (const part of parts) parent = parent[part] ??= {};
    if (value && typeof value === "object" && !Array.isArray(value)) {
      merge(parent[last] ??= {}, value);
    } else parent[last] = structuredClone(value);
  }
  return target;
}
function tokenSource(data = {}) {
  return merge({ name: "Token independente", texture: { src: "", scaleX: .8, scaleY: .7 },
    randomImg: true, ring: { enabled: true, subject: { texture: "token-ring.webp" } },
    sight: { enabled: true, range: 20 }, width: 2, height: 2 }, data);
}
function token(data) {
  const _source = structuredClone(data);
  return { _source,
    get texture() { return _source.texture; },
    get randomImg() { return _source.randomImg; },
    get name() { return _source.name; },
    toObject() { return structuredClone(_source); },
    updateSource(changes) { merge(_source, changes); }
  };
}

// Apenas a construção/esquema é substituída. Quando instalado, o Foundry real
// executa os dois hooks que podem copiar o retrato para o token padrão.
class ActorFixture {
  static DEFAULT_ICON = DEFAULT_TOKEN;
  static getDefaultArtwork() { return { img: DEFAULT_TOKEN, texture: { src: DEFAULT_TOKEN } }; }
  constructor(data) {
    const source = this._initializeSource(data, {});
    Object.assign(this, { name: "Nexus", img: "portrait.webp", type: "character", isToken: false,
      ...source, system: { level: 1, attributes: {}, invokerId: "", ...source.system } });
    this.prototypeToken = token(source.prototypeToken);
  }
  _initializeSource(data) {
    const source = merge({}, data);
    source.prototypeToken = tokenSource(source.prototypeToken);
    // Mesmo fallback da inicialização do Actor nativo, sem criar um banco de mundo.
    source.prototypeToken.texture.src ||= source.img;
    return source;
  }
  toObject() {
    return { name: this.name, img: this.img, type: this.type, system: structuredClone(this.system),
      prototypeToken: this.prototypeToken.toObject() };
  }
  getRollData() { return structuredClone(this.system); }
  async _preCreate(...args) {
    if (this.denyCreate) return false;
    const allowed = await NativeActor?.prototype._preCreate.call(this, ...args);
    this.nativeCreatedTexture = this.prototypeToken.texture.src;
    return allowed;
  }
  async _preUpdate(...args) {
    if (this.denyUpdate) return false;
    return NativeActor?.prototype._preUpdate.call(this, ...args);
  }
}
globalThis.Actor = ActorFixture;
globalThis.Item = class {};
globalThis.foundry ??= { utils: { getProperty } };
globalThis.game = { actors: new Map() };
const { NexusActor } = await import("../module/documents.mjs");
const gm = { id: "gm", isGM: true };
const types = ["character", "curse", "shikigami"];

for (const type of types) {
  test(`${type}: novo ator com retrato inicia com token neutro e conserva suas configurações`, async () => {
    const data = { type, img: "portrait.webp" };
    const actor = new NexusActor(data);
    const before = actor.prototypeToken.toObject();
    assert.equal(before.texture.src, DEFAULT_TOKEN, "inicialização não herda a foto");
    assert.notEqual(await actor._preCreate(data, {}, gm), false);
    if (NativeActor) assert.equal(actor.nativeCreatedTexture, "portrait.webp", "hook nativo chegou a copiar a foto");
    assert.deepEqual(actor.prototypeToken.toObject(), before, "Nexus conserva arte e configuração do token");
  });

  test(`${type}: trocar retrato preserva token neutro, personalizado ou previamente igual à foto`, async () => {
    for (const art of [DEFAULT_TOKEN, "custom-token.webp", "portrait.webp"]) {
      const actor = new NexusActor({ type, img: "portrait.webp", prototypeToken: { texture: { src: art } } });
      const before = actor.prototypeToken.toObject();
      const changes = { img: "new-portrait.webp" };
      assert.notEqual(await actor._preUpdate(changes, {}, gm), false);
      const after = merge(actor.toObject(), changes);
      assert.equal(after.img, "new-portrait.webp");
      assert.deepEqual(after.prototypeToken, before);
    }
  });
}

test("criação preserva arte manual, wildcard, anel, escala e visão do token", async () => {
  const data = { type: "character", img: "portrait.webp", prototypeToken: tokenSource({
    texture: { src: "tokens/wildcard-*.webp" }
  }) };
  const actor = new NexusActor(data);
  assert.notEqual(await actor._preCreate(data, {}, gm), false);
  assert.deepEqual(actor.prototypeToken.toObject(), data.prototypeToken);
});

for (const form of ["aninhado", "pontuado", "misto"]) {
  test(`editar retrato e arte do token juntos respeita o caminho ${form}`, async () => {
    for (const art of [DEFAULT_TOKEN, "old-token.webp"]) {
      const actor = new NexusActor({ img: "portrait.webp", prototypeToken: { texture: { src: art } } });
      const before = actor.prototypeToken.toObject();
      const changes = { img: "new-portrait.webp" };
      if (form === "aninhado") changes.prototypeToken = { texture: { src: "manual-token.webp" } };
      if (form === "pontuado") changes["prototypeToken.texture.src"] = "manual-token.webp";
      if (form === "misto") changes.prototypeToken = { "texture.src": "manual-token.webp" };
      assert.notEqual(await actor._preUpdate(changes, {}, gm), false);
      assert.deepEqual(merge(actor.toObject(), changes).prototypeToken,
        merge(before, { texture: { src: "manual-token.webp" } }), `arte anterior: ${art}`);
    }
  });
}

test("arte vazia do token usa o ícone neutro em vez de voltar a herdar o retrato", async () => {
  for (const art of ["", "   "]) {
    const actor = new NexusActor({ img: "portrait.webp", prototypeToken: { texture: { src: art } } });
    assert.equal(actor.prototypeToken.texture.src, DEFAULT_TOKEN);
    const changes = { img: "new-portrait.webp", prototypeToken: { texture: { src: art } } };
    assert.notEqual(await actor._preUpdate(changes, {}, gm), false);
    assert.equal(merge(actor.toObject(), changes).prototypeToken.texture.src, DEFAULT_TOKEN);
  }
});

test("retrato do ator sintético também não altera sua arte de token", async () => {
  const actor = new NexusActor({ isToken: true, img: "portrait.webp",
    prototypeToken: { texture: { src: "scene-token.webp" } } });
  const changes = { img: "synthetic-portrait.webp" };
  const before = actor.prototypeToken.toObject();
  assert.notEqual(await actor._preUpdate(changes, {}, gm), false);
  assert.deepEqual(merge(actor.toObject(), changes).prototypeToken, before);
});

test("cancelamento pelo hook pai continua impedindo criação e atualização", async () => {
  const actor = new NexusActor({ img: "portrait.webp", denyCreate: true, denyUpdate: true });
  const before = actor.prototypeToken.toObject();
  assert.equal(await actor._preCreate({ img: "portrait.webp" }, {}, gm), false);
  assert.equal(await actor._preUpdate({ img: "new-portrait.webp" }, {}, gm), false);
  assert.deepEqual(actor.prototypeToken.toObject(), before);
});

test("tipo token inicia com a própria arte, nome no hover e barras sem atributos", async () => {
  const data = { type: "token", name: "Mercador", img: "merchant.webp", system: {} };
  const actor = new NexusActor(data);
  const proto = actor.prototypeToken.toObject();
  assert.equal(actor.img, "merchant.webp");
  assert.equal(proto.texture.src, "merchant.webp");
  assert.equal(proto.name, "Mercador");
  assert.equal(proto.displayName, CONST.TOKEN_DISPLAY_MODES.HOVER);
  assert.equal(proto.displayBars, CONST.TOKEN_DISPLAY_MODES.NONE);
  assert.equal(proto.bar1.attribute, null);
  assert.equal(proto.bar2.attribute, null);
  assert.notEqual(await actor._preCreate(data, {}, gm), false);
  assert.deepEqual(actor.prototypeToken.toObject(), proto);
});

test("tipo token usa arte explícita do protótipo e preserva configuração manual", async () => {
  const proto = tokenSource({ name: "Nome manual", texture: { src: "manual-token.webp" },
    displayName: CONST.TOKEN_DISPLAY_MODES.ALWAYS, displayBars: CONST.TOKEN_DISPLAY_MODES.OWNER,
    bar1: { attribute: "recurso" }, bar2: { attribute: "outro" } });
  const data = { type: "token", name: "Mercador", img: "portrait.webp", prototypeToken: proto };
  const actor = new NexusActor(data);
  assert.equal(actor.img, "manual-token.webp");
  assert.deepEqual(actor.prototypeToken.toObject(), proto);
  assert.notEqual(await actor._preCreate(data, {}, gm), false);
  assert.deepEqual(actor.prototypeToken.toObject(), proto);
});

test("tipo token aceita apenas a arte do protótipo e também usa ícone neutro sem arte", async () => {
  const actor = new NexusActor({ type: "token", prototypeToken: { texture: { src: "token.webp" } } });
  assert.equal(actor.img, "token.webp");
  assert.equal(actor.prototypeToken.texture.src, "token.webp");
  const empty = new NexusActor({ type: "token", img: "", prototypeToken: { texture: { src: "" } } });
  assert.equal(empty.img, DEFAULT_TOKEN);
  assert.equal(empty.prototypeToken.texture.src, DEFAULT_TOKEN);
});

for (const form of ["aninhado", "pontuado", "misto"]) {
  test(`tipo token sincroniza foto e textura pelo caminho ${form}, preservando escala e visão`, async () => {
    const actor = new NexusActor({ type: "token", img: "old-token.webp" });
    const before = actor.prototypeToken.toObject();
    const fromPortrait = { img: "new-token.webp" };
    assert.notEqual(await actor._preUpdate(fromPortrait, {}, gm), false);
    assert.equal(getProperty(fromPortrait, "prototypeToken.texture.src"), "new-token.webp");
    const changes = { img: "ignored-portrait.webp" };
    if (form === "aninhado") changes.prototypeToken = { texture: { src: "configured-token.webp" } };
    if (form === "pontuado") changes["prototypeToken.texture.src"] = "configured-token.webp";
    if (form === "misto") changes.prototypeToken = { "texture.src": "configured-token.webp" };
    assert.notEqual(await actor._preUpdate(changes, {}, gm), false);
    const after = merge(actor.toObject(), changes);
    assert.equal(after.img, "configured-token.webp");
    assert.deepEqual(after.prototypeToken, merge(before, { texture: { src: "configured-token.webp" } }));
  });
}

test("tipo token acompanha o nome editado e limpar a imagem retorna ao ícone neutro", async () => {
  const actor = new NexusActor({ type: "token", name: "Antigo", img: "token.webp" });
  const changes = { name: "Mercador", img: "" };
  assert.notEqual(await actor._preUpdate(changes, {}, gm), false);
  const after = merge(actor.toObject(), changes);
  assert.equal(after.name, "Mercador");
  assert.equal(after.prototypeToken.name, "Mercador");
  assert.equal(after.img, DEFAULT_TOKEN);
  assert.equal(after.prototypeToken.texture.src, DEFAULT_TOKEN);
});

test("tipo token preserva vídeos e wildcards do configurador sem torná-los retratos inválidos", async () => {
  for (const art of ["tokens/merchant.webm", "tokens/merchant.mp4?x=1", "tokens/*.webp", "tokens/*"]) {
    const actor = new NexusActor({ type: "token", img: "portrait.webp", prototypeToken: { texture: { src: art } } });
    assert.equal(actor.img, "portrait.webp");
    assert.equal(actor.prototypeToken.texture.src, art);
    const changes = { prototypeToken: { texture: { src: art }, width: 3 } };
    assert.notEqual(await actor._preUpdate(changes, {}, gm), false);
    const after = merge(actor.toObject(), changes);
    assert.equal(after.img, "portrait.webp");
    assert.equal(after.prototypeToken.texture.src, art);
    assert.equal(after.prototypeToken.width, 3);
  }
});

test("tipo token funciona com system vazio sem rolagens, CA ou inventário", async () => {
  const actor = new NexusActor({ type: "token", img: "token.webp" });
  actor.system = {};
  assert.deepEqual(actor.getRollData(), {});
  assert.equal(actor.equippedWeapon, null);
  assert.equal(actor.weaponDamage, 0);
  assert.equal(actor.weaponAccuracy, 0);
  await assert.rejects(actor.equipWeapon(), /token não possuem inventário/u);
  assert.equal(await actor.rollAttribute("forca"), undefined);
  assert.equal(await actor.shareDefense(), undefined);
});
