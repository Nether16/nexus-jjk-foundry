import assert from "node:assert/strict";
import test from "node:test";

let importId = 0;

async function setup(t) {
  const names = ["foundry", "CONFIG", "ui"];
  const originals = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  t.after(() => {
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  const pickers = [];
  const configs = [];
  const errors = [];
  class ActorSheet {
    constructor({ document }) {
      this.actor = document;
      this.isEditable = true;
      this.position = { top: 20, left: 30 };
      this.element = { querySelectorAll: () => [] };
    }
    async _prepareContext() { return { rootId: "token-sheet" }; }
    async _onRender() {}
    _onClose() {}
    async render() { return this; }
    async _processSubmitData(_event, _form, data) {
      await this.actor.update(data);
      return { updated: this.actor };
    }
  }
  globalThis.foundry = { applications: {
    sheets: { ActorSheetV2: ActorSheet },
    api: { HandlebarsApplicationMixin: Parent => class extends Parent {} },
    apps: { FilePicker: { implementation: class {
      constructor(options) { this.options = options; pickers.push(this); }
      async browse() { return this; }
    } } }
  } };
  globalThis.CONFIG = { Token: { prototypeSheetClass: class {
    constructor(options) { this.options = options; configs.push(this); }
    render(options) { this.renderOptions = options; return this; }
  } } };
  globalThis.ui = { notifications: { error: message => errors.push(message) } };
  const { NexusTokenSheet } = await import(`../module/sheets/nexus-token-sheet.mjs?test=${++importId}`);
  const writes = [];
  const actor = { img: "portraits/portrait.webp", name: "Figurante", isOwner: true,
    prototypeToken: { texture: { src: "tokens/art.webp" } },
    async update(changes) { writes.push(changes); return this; } };
  const sheet = new NexusTokenSheet({ document: actor });
  const actions = NexusTokenSheet.DEFAULT_OPTIONS.actions;
  return { NexusTokenSheet, actor, sheet, actions, writes, pickers, configs, errors };
}

test("ficha mínima usa a arte do token e aceita preview de vídeo sem depender dos atributos", async t => {
  const { actor, sheet } = await setup(t);
  const context = await sheet._prepareContext({});
  assert.equal(context.image, "tokens/art.webp");
  assert.equal(context.editable, true);
  assert.equal(context.isVideo, false);
  actor.token = { texture: { src: "https://images.example.com/token.webm?key=public" } };
  const placed = await sheet._prepareContext({});
  assert.equal(placed.image, actor.token.texture.src);
  assert.equal(placed.isVideo, true);
  actor.isOwner = false;
  assert.equal((await sheet._prepareContext({})).editable, false);
});

test("wildcard usa um retrato válido no preview sem substituir o caminho do token", async t => {
  const { actor, sheet } = await setup(t);
  actor.prototypeToken.texture.src = "tokens/figurante-*.webp";
  const context = await sheet._prepareContext({});
  assert.equal(context.image, "tokens/figurante-*.webp");
  assert.equal(context.preview, actor.img);
});

test("editar a ficha de um token colocado atualiza apenas seu nome e sua textura", async t => {
  const { actor, sheet, actions, writes, pickers } = await setup(t);
  const tokenWrites = [];
  actor.isToken = true;
  actor.token = { name: "Nome na cena", texture: { src: "tokens/scene.webp" },
    async update(data) { tokenWrites.push(data); } };
  assert.equal((await sheet._prepareContext({})).name, "Nome na cena");
  const submitted = { name: "Vigia", prototypeToken: { texture: { src: "tokens/vigia.webp" } } };
  await sheet._processSubmitData(null, null, submitted);
  assert.deepEqual(writes, [submitted]);
  assert.deepEqual(tokenWrites, [{ name: "Vigia", "texture.src": "tokens/vigia.webp" }]);
  await actions.chooseTokenImage.call(sheet);
  await pickers[0].options.callback("tokens/outro.webp");
  assert.deepEqual(tokenWrites.at(-1), { "texture.src": "tokens/outro.webp" });
  actor.isOwner = false;
  await sheet._processSubmitData(null, null, { name: "Proibido" });
  assert.equal(writes.length, 2);
});

test("seletor nativo salva imagem e ignora callbacks depois de fechar e reabrir a ficha", async t => {
  const { actor, sheet, actions, writes, pickers } = await setup(t);
  await actions.chooseTokenImage.call(sheet);
  assert.equal(pickers[0].options.document, actor);
  assert.equal(pickers[0].options.type, "image");
  await pickers[0].options.callback("  worlds/mesa/retrato.png  ");
  assert.deepEqual(writes, [{ img: "worlds/mesa/retrato.png" }]);
  sheet._onClose({});
  await sheet._onRender({}, {});
  await pickers[0].options.callback("old-picker.png");
  assert.equal(writes.length, 1);
});

test("callbacks antigos e perda de permissão não alteram a imagem", async t => {
  const { actor, sheet, actions, writes, pickers } = await setup(t);
  await actions.chooseTokenImage.call(sheet);
  await actions.chooseTokenImage.call(sheet);
  await pickers[0].options.callback("old-picker.png");
  assert.equal(writes.length, 0);
  actor.isOwner = false;
  await pickers[1].options.callback("forbidden.png");
  await actions.chooseTokenImage.call(sheet);
  assert.equal(writes.length, 0);
  assert.equal(pickers.length, 2);
  actor.isOwner = true;
  sheet.isEditable = false;
  await actions.chooseTokenImage.call(sheet);
  assert.equal(pickers.length, 2);
});

test("configuração usa a janela nativa correta e observa propriedade e edição", async t => {
  const { actor, sheet, actions, configs } = await setup(t);
  actions.configureTokenSettings.call(sheet);
  assert.equal(configs[0].options.prototype, actor.prototypeToken);
  assert.deepEqual(configs[0].renderOptions, { force: true });
  let placedConfig = 0;
  actor.isToken = true;
  actor.token = { sheet: { render(options) { assert.deepEqual(options, { force: true }); placedConfig++; } } };
  actions.configureTokenSettings.call(sheet);
  assert.equal(placedConfig, 1);
  actor.isOwner = false;
  actions.configureTokenSettings.call(sheet);
  assert.equal(placedConfig, 1);
  sheet.isEditable = false;
  actor.isOwner = true;
  actions.configureTokenSettings.call(sheet);
  assert.equal(placedConfig, 1);
});

test("falha ao salvar arte informa o erro sem deixar rejeição no callback", async t => {
  const { actor, sheet, actions, pickers, errors } = await setup(t);
  t.mock.method(console, "error", () => {});
  actor.update = async () => { throw new Error("Permission changed"); };
  await actions.chooseTokenImage.call(sheet);
  await pickers[0].options.callback("worlds/mesa/arte.png");
  assert.equal(errors.length, 1);
  assert.match(errors[0], /salvar a imagem/u);
});
