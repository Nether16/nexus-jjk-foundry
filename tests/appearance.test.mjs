import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import {
  APPEARANCE_DEFAULTS, WALLPAPER_DIRECTORY, applyAppearance, getAppearanceDefaults,
  getWallpaperChoices, importWallpaper, normalizeAppearance, readAppearance, saveAppearance,
  wallpaperPath, wallpaperURL
} from "../module/sheets/nexus-appearance.mjs";

const signedURL = "https://media.discordapp.net/attachments/123/wallpaper.png?ex=ABC&hm=a%2Bb%2Fc&width=1200#preview";
let routes;
let uploads;
beforeEach(() => {
  routes = [];
  uploads = [];
  globalThis.game = { user: { id: "player", isGM: false, can: () => false },
    settings: { get: () => [] } };
  globalThis.foundry = { utils: { getRoute: path => {
    routes.push(path);
    return `/table/${path}`;
  } } };
  globalThis.CONFIG = { ux: { FilePicker: { async upload(...args) {
    uploads.push(args);
    return { path: "worlds/mesa/assets/actors/Wallpaper importado.png" };
  } } } };
});

function actor({ type = "character", owner = true, appearance } = {}) {
  const flags = structuredClone(appearance);
  const document = { uuid: "Actor.hero", type, isOwner: owner, system: { origin: { key: "grau3" } },
    appearance: flags, writes: [], getFlag() { return this.appearance; },
    async update(changes, options) {
      this.writes.push({ changes, options });
      this.appearance = changes["flags.nexus-jjk.appearance"];
      return this;
    }
  };
  return document;
}

test("wallpaper HTTP(S) conserva parâmetros assinados e não exige extensão no link", () => {
  for (const url of [signedURL, "http://images.example.com/wallpaper?signature=a%2Bb%3D",
    "https://images.example.com/render?id=gojo%20satoru"]) {
    assert.equal(wallpaperPath(url), url);
    assert.equal(normalizeAppearance({ wallpaper: url }).wallpaper, url);
    assert.equal(wallpaperURL(url), url);
  }
  assert.deepEqual(routes, [], "links externos não passam pelo getRoute do Foundry");
});

test("seleções locais do FilePicker aceitam pastas de dados e codificam o nome uma única vez", () => {
  for (const path of ["assets/wallpapers/Gojo e Sukuna.png", "assets/wallpapers/Gojo%20e%20Sukuna.png"]) {
    assert.equal(wallpaperPath(path), path);
    assert.equal(wallpaperURL(path), "/table/assets/wallpapers/Gojo%20e%20Sukuna.png");
  }
  const special = "worlds/mesa/assets/Gojo (1)'s.png";
  assert.equal(wallpaperPath(special), special);
  assert.equal(wallpaperURL(special), "/table/worlds/mesa/assets/Gojo%20%281%29%27s.png");
  assert.equal(wallpaperPath("modules/meu-pacote/fundo.webp"), "modules/meu-pacote/fundo.webp");
});

test("wallpapers inválidos não viram URLs executáveis nem caminhos fora dos dados", () => {
  for (const path of ["", "javascript:alert(1)", "data:image/png;base64,AAA", "file:///C:/fundo.png",
    "blob:https://example.com/123", "//example.com/fundo.png", "/etc/fundo.png", "C:\\fundo.png",
    "https://", "https:\\example.com\\fundo.png", "../fundo.png", "assets/../fundo.png",
    "assets/%2e%2e/fundo.png", "assets/%252e%252e/fundo.png", "assets/a%2fb.png",
    "assets/a%5cb.png", "assets/%00fundo.png", "assets/%zz.png", "assets/arquivo.txt",
    "assets/fundo.png?x=1", "https://example.com/a\nfundo.png"]) {
    assert.equal(wallpaperPath(path), null, path);
    assert.equal(normalizeAppearance({ wallpaper: path }).wallpaper, APPEARANCE_DEFAULTS.wallpaper, path);
  }
});

test("prévia CSS usa o mesmo link com assinatura e mantém o fundo preto", () => {
  const properties = new Map();
  const element = { style: { setProperty: (key, value) => properties.set(key, value) } };
  applyAppearance(element, { wallpaper: signedURL });
  assert.equal(properties.get("--nexus-wallpaper"), `url("${signedURL}")`);
  assert.equal(properties.get("--nexus-cor-fundo"), "#000000");
  assert.equal(properties.get("--nexus-cor-painel"), "#08000b");
  assert.deepEqual(routes, []);
});

test("aspas e barras de um link não encerram a string CSS do wallpaper", () => {
  const source = 'https://images.example.com/render?value=\\");color:red;/*';
  const normalized = wallpaperPath(source);
  assert.equal(new URL(normalized).search, new URL(source).search);
  const properties = new Map();
  applyAppearance({ style: { setProperty: (key, value) => properties.set(key, value) } }, { wallpaper: source });
  assert.equal(properties.get("--nexus-wallpaper"), `url("${normalized.replace(/\\/gu, "\\\\")}")`);
  assert.ok(!properties.get("--nexus-wallpaper").includes('");color:red'));
});

test("salvar e reabrir conserva o wallpaper por link sem permissão de upload", async () => {
  const document = actor();
  const result = await saveAppearance(document, { ...APPEARANCE_DEFAULTS, wallpaper: signedURL });
  assert.equal(result.wallpaper, signedURL);
  assert.equal(readAppearance(document).wallpaper, signedURL);
  assert.equal(document.writes.length, 1);
  assert.deepEqual(document.writes[0].options, { render: false });
  assert.equal(document.writes[0].changes["flags.nexus-jjk.appearance"].wallpaper, signedURL);
  assert.deepEqual(uploads, []);
});

test("aparência continua exigindo edição da ficha para salvar", async () => {
  const document = actor({ owner: false });
  await assert.rejects(saveAppearance(document, { wallpaper: signedURL }), /permissão/u);
  assert.deepEqual(document.writes, []);
});

test("tema da maldição acompanha o grau e conserva seu wallpaper externo", async () => {
  const document = actor({ type: "curse", appearance: { followGrade: true, wallpaper: signedURL,
    accent: "#000000" } });
  const appearance = readAppearance(document);
  assert.equal(appearance.wallpaper, signedURL);
  assert.equal(appearance.accent, getAppearanceDefaults(document).accent);
  await saveAppearance(document, appearance);
  assert.equal(document.appearance.followGrade, true);
  assert.equal(document.appearance.wallpaper, signedURL);
});

test("catálogo global continua limitado às imagens da pasta de wallpapers", async () => {
  game.settings.get = () => [signedURL, "assets/outro.png", `${WALLPAPER_DIRECTORY}/Subpasta/fundo.png`,
    `${WALLPAPER_DIRECTORY}/Gojo%20Satoru.png`];
  const choices = await getWallpaperChoices({ refresh: false });
  assert.deepEqual(choices.map(choice => choice.value).sort(), [APPEARANCE_DEFAULTS.wallpaper,
    `${WALLPAPER_DIRECTORY}/Gojo%20Satoru.png`].sort());
  assert.equal(choices.find(choice => choice.value.includes("Gojo")).label, "Gojo Satoru");
});

test("upload de wallpaper continua usando o upload nativo com UUID do personagem", async () => {
  game.user.can = permission => permission === "FILES_UPLOAD";
  const document = actor();
  const file = new File(["image"], "Wallpaper importado.png", { type: "image/png" });
  const choice = await importWallpaper(document, file);
  assert.deepEqual(choice, { value: "worlds/mesa/assets/actors/Wallpaper importado.png", label: "Wallpaper importado" });
  assert.equal(uploads.length, 1);
  assert.deepEqual(uploads[0].slice(3), [{ uuid: document.uuid }, { notify: false }]);
  assert.deepEqual(document.writes, [], "importar não salva a flag antes de confirmar a aparência");
});
