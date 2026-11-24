import { getCurseOrigin } from "../curse-config.mjs";

const NAMESPACE = "nexus-jjk";
const CATALOG_SETTING = "wallpaperCatalog";
const IMAGE_EXTENSIONS = Object.freeze(["png", "jpg", "jpeg", "webp", "avif", "gif", "svg"]);

export const WALLPAPER_DIRECTORY = "systems/nexus-jjk/assets/images/wallpapers";

export const APPEARANCE_DEFAULTS = Object.freeze({
  accent: "#c57ce0",
  frame: "#7b18b4",
  cardBorder: "#74408c",
  highlight: "#d979ff",
  text: "#ffffff",
  wallpaper: `${WALLPAPER_DIRECTORY}/Sukuna.png`
});

export const COLOR_FIELDS = Object.freeze([
  { key: "accent", label: "Cor principal", css: "--nexus-cor-destaque" },
  { key: "frame", label: "Borda da ficha", css: "--nexus-cor-moldura" },
  { key: "cardBorder", label: "Bordas dos cards", css: "--nexus-cor-borda-painel" },
  { key: "highlight", label: "Realce", css: "--nexus-cor-realce" },
  { key: "text", label: "Texto", css: "--nexus-cor-texto" }
].map(field => Object.freeze(field)));

function colorToHSL(color) {
  const [red, green, blue] = [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16) / 255);
  const highest = Math.max(red, green, blue);
  const lowest = Math.min(red, green, blue);
  const difference = highest - lowest;
  const lightness = (highest + lowest) / 2;
  if (!difference) return { hue: 0, saturation: 0, lightness };
  let hue;
  if (highest === red) hue = ((green - blue) / difference) % 6;
  else if (highest === green) hue = ((blue - red) / difference) + 2;
  else hue = ((red - green) / difference) + 4;
  return {
    hue: ((hue * 60) + 360) % 360,
    saturation: difference / (1 - Math.abs((2 * lightness) - 1)),
    lightness
  };
}

function hslToColor({ hue, saturation, lightness }) {
  const sector = (((hue % 360) + 360) % 360) / 60;
  const chroma = (1 - Math.abs((2 * lightness) - 1)) * saturation;
  const secondary = chroma * (1 - Math.abs((sector % 2) - 1));
  const offset = lightness - (chroma / 2);
  const channels = [
    [chroma, secondary, 0], [secondary, chroma, 0], [0, chroma, secondary],
    [0, secondary, chroma], [secondary, 0, chroma], [chroma, 0, secondary]
  ][Math.floor(sector)];
  return "#" + channels.map(channel =>
    Math.min(255, Math.max(0, Math.round((channel + offset) * 255))).toString(16).padStart(2, "0")
  ).join("");
}

/** Preserve the default palette's HSL relationships when a base color changes. */
export function deriveAppearancePalette(color, { source = "accent" } = {}) {
  if (typeof color !== "string" || !/^#[0-9a-f]{6}$/iu.test(color)) return {};
  if (source !== "accent" && source !== "cardBorder") return {};
  const base = colorToHSL(color);
  const original = colorToHSL(APPEARANCE_DEFAULTS[source]);
  const limits = { frame: [0.20, 0.56], cardBorder: [0.28, 0.58], highlight: [0.56, 0.88] };
  const variants = source === "accent" ? ["frame", "cardBorder", "highlight"] : ["highlight"];
  const palette = { [source]: color.toLowerCase() };
  for (const key of variants) {
    const reference = colorToHSL(APPEARANCE_DEFAULTS[key]);
    const [minimum, maximum] = limits[key];
    palette[key] = hslToColor({
      hue: base.hue + reference.hue - original.hue,
      saturation: Math.min(1, Math.max(0, base.saturation * reference.saturation / original.saturation)),
      lightness: Math.min(maximum, Math.max(minimum, base.lightness * reference.lightness / original.lightness))
    });
  }
  return palette;
}

/** Accept native image selections and HTTP(S) links without losing signed URL parameters. */
export function wallpaperPath(value) {
  if (typeof value !== "string") return null;
  const path = value.trim();
  if (!path || /[\u0000-\u001f\u007f]/u.test(path)) return null;
  if (/^https?:\/\//iu.test(path)) {
    try {
      const url = new URL(path);
      return ["http:", "https:"].includes(url.protocol) ? url.href : null;
    } catch {
      return null;
    }
  }

  // FilePicker paths are relative to Foundry's data directory, never an OS path.
  if (path.startsWith("/") || /[\\:?#]/u.test(path)) return null;
  let segments;
  try {
    segments = path.split("/").map(segment => decodeURIComponent(segment));
  } catch {
    return null;
  }
  if (segments.some(segment => !segment || segment !== segment.trim() ||
      [".", ".."].includes(segment) || /[\\/:\u0000-\u001f\u007f]|%[a-f0-9]{2}/iu.test(segment))) return null;
  const extension = segments.at(-1).match(/\.([a-z0-9]+)$/iu)?.[1].toLowerCase();
  if (!IMAGE_EXTENSIONS.includes(extension)) return null;
  return path;
}

/** Use the same URL for the sheet background and the appearance dialog preview. */
export function wallpaperURL(value) {
  const path = wallpaperPath(value) ?? APPEARANCE_DEFAULTS.wallpaper;
  if (/^https?:\/\//iu.test(path)) return path;
  const encoded = path.split("/").map(segment =>
    encodeURIComponent(decodeURIComponent(segment)).replace(/[!'()*]/gu, character =>
      `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
  ).join("/");
  return globalThis.foundry?.utils?.getRoute?.(encoded) ?? `/${encoded}`;
}

export function normalizeAppearance(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const appearance = { ...APPEARANCE_DEFAULTS };
  for (const { key } of COLOR_FIELDS) {
    if (Object.hasOwn(source, key) && typeof source[key] === "string" && /^#[0-9a-f]{6}$/iu.test(source[key])) {
      appearance[key] = source[key].toLowerCase();
    }
  }
  if (Object.hasOwn(source, "wallpaper")) {
    appearance.wallpaper = wallpaperPath(source.wallpaper) ?? APPEARANCE_DEFAULTS.wallpaper;
  }
  return appearance;
}

export function getAppearanceDefaults(actor) {
  if (actor?.type !== "curse") return { ...APPEARANCE_DEFAULTS };
  return normalizeAppearance({ ...APPEARANCE_DEFAULTS, ...getCurseOrigin(actor.system?.origin?.key).appearance });
}

export function readAppearance(actor) {
  let raw;
  try {
    raw = actor?.getFlag?.(NAMESPACE, "appearance");
  } catch {
    // A document without system flags still uses the default visual theme.
  }
  if (actor?.type === "curse") {
    const overrides = raw?.followGrade === true ? { wallpaper: raw.wallpaper } : raw;
    return normalizeAppearance({ ...getAppearanceDefaults(actor), ...overrides });
  }
  return normalizeAppearance(raw);
}

export function applyAppearance(element, raw) {
  const appearance = normalizeAppearance(raw);
  if (!element?.style?.setProperty) return appearance;
  for (const { key, css } of COLOR_FIELDS) element.style.setProperty(css, appearance[key]);
  element.style.setProperty("--nexus-cor-fundo", "#000000");
  element.style.setProperty("--nexus-cor-painel", "#08000b");
  const url = wallpaperURL(appearance.wallpaper).replace(/\\/gu, "\\\\").replace(/"/gu, '\\"');
  element.style.setProperty("--nexus-wallpaper", `url("${url}")`);
  return appearance;
}

export function registerAppearanceSettings() {
  const settings = globalThis.game?.settings;
  if (!settings || settings.settings?.has(`${NAMESPACE}.${CATALOG_SETTING}`)) return;
  settings.register(NAMESPACE, CATALOG_SETTING, {
    scope: "world",
    config: false,
    type: Array,
    default: []
  });
}

export function canBrowseWallpapers() {
  const user = globalThis.game?.user;
  if (user?.isGM) return true;
  try {
    return Boolean(user?.can?.("FILES_BROWSE"));
  } catch {
    return false;
  }
}

export function canImportWallpapers() {
  const user = globalThis.game?.user;
  if (user?.isGM) return true;
  try {
    return Boolean(user?.can?.("FILES_UPLOAD"));
  } catch {
    return false;
  }
}

function wallpaperPicker() {
  const configured = globalThis.CONFIG?.ux?.FilePicker;
  const fallback = globalThis.foundry?.applications?.apps?.FilePicker;
  return configured?.implementation ?? configured ?? fallback?.implementation ?? fallback;
}

/** Native document upload creates persistent world assets and gives each file a unique name. */
export async function importWallpaper(actor, file) {
  if (!canImportWallpapers()) throw new Error("Você não tem permissão para enviar arquivos ao Foundry.");
  if (!actor?.uuid) throw new Error("Salve o personagem antes de importar um wallpaper.");
  const extension = file?.name?.match(/\.([a-z0-9]+)$/iu)?.[1].toLowerCase();
  if (!file?.size || !IMAGE_EXTENSIONS.includes(extension) || (file.type && !file.type.startsWith("image/"))) {
    throw new Error("Escolha um arquivo de imagem para usar como wallpaper.");
  }
  const Picker = wallpaperPicker();
  if (typeof Picker?.upload !== "function") throw new Error("O envio de arquivos do Foundry está indisponível.");
  const name = file.name.slice(0, file.name.lastIndexOf(".")).trim()
    .replace(/[^\p{L}\p{N} _.-]/gu, "-").replace(/^[.\s]+/u, "").slice(0, 80) || "wallpaper";
  const upload = new File([file], `${name}.${extension}`, { type: file.type });
  const result = await Picker.upload("data", "", upload, { uuid: actor.uuid }, { notify: false });
  const value = wallpaperPath(result?.path);
  if (!value) throw new Error("Não foi possível importar o wallpaper. Confira a permissão de envio de arquivos.");
  return { value, label: name };
}

function wallpaperLabel(path) {
  return decodeURIComponent(path.slice(WALLPAPER_DIRECTORY.length + 1))
    .replace(/\.[^.]+$/u, "").replace(/[_-]+/gu, " ").trim();
}

function catalogPaths(raw) {
  const paths = new Set([APPEARANCE_DEFAULTS.wallpaper]);
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      const path = wallpaperPath(typeof entry === "string" ? entry : entry?.value);
      if (path?.startsWith(`${WALLPAPER_DIRECTORY}/`) &&
          !path.slice(WALLPAPER_DIRECTORY.length + 1).includes("/")) paths.add(path);
    }
  }
  return [...paths].sort((a, b) =>
    wallpaperLabel(a).localeCompare(wallpaperLabel(b), "pt-BR", { numeric: true, sensitivity: "base" }) || a.localeCompare(b, "pt-BR"));
}

function cachedCatalog() {
  try {
    return catalogPaths(globalThis.game?.settings?.get(NAMESPACE, CATALOG_SETTING));
  } catch {
    return catalogPaths([]);
  }
}

let warnedAboutCatalog = false;

/**
 * The GM publishes the fixed-directory catalog for players without file browsing.
 * Browsing is fresh for each configuration opening; no polling or socket relay.
 */
export async function getWallpaperChoices({ refresh = true } = {}) {
  const cached = cachedCatalog();
  let paths = cached;
  if (refresh && canBrowseWallpapers()) {
    try {
      const Picker = wallpaperPicker();
      if (typeof Picker?.browse !== "function") throw new Error("FilePicker indisponível");
      const result = await Picker.browse("data", WALLPAPER_DIRECTORY, {
        extensions: IMAGE_EXTENSIONS.map(extension => `.${extension}`)
      });
      if (!Array.isArray(result?.files)) throw new Error("Catálogo de wallpapers indisponível");
      paths = catalogPaths(result.files);
      if (globalThis.game?.user?.isGM && JSON.stringify(paths) !== JSON.stringify(cached)) {
        await game.settings.set(NAMESPACE, CATALOG_SETTING, paths);
      }
    } catch (error) {
      // Keep the cached list (or the fresh browse result if publishing alone failed).
      if (!warnedAboutCatalog) {
        console.warn("Nexus JJK | Não foi possível atualizar o catálogo de wallpapers.", error);
        warnedAboutCatalog = true;
      }
    }
  }
  return paths.map(value => ({ value, label: wallpaperLabel(value) }));
}

/** Store only the theme flag, without rerendering or changing character rules. */
export async function saveAppearance(actor, raw) {
  let permitted = actor?.isOwner === true;
  if (typeof actor?.canUserModify === "function") {
    try {
      permitted = Boolean(actor.canUserModify(globalThis.game?.user, "update"));
    } catch {
      permitted = false;
    }
  }
  if (!permitted || typeof actor?.update !== "function") {
    throw new Error("Você não tem permissão para alterar a aparência desta ficha.");
  }
  const appearance = normalizeAppearance(raw);
  let stored = appearance;
  if (actor.type === "curse") {
    const defaults = getAppearanceDefaults(actor);
    stored = {
      ...appearance,
      followGrade: COLOR_FIELDS.every(({ key }) => appearance[key] === defaults[key])
    };
  }
  await actor.update({ [`flags.${NAMESPACE}.appearance`]: stored }, { render: false });
  return appearance;
}
