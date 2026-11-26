import { createCatalogClient } from "./catalog-client.mjs";

const CATALOG_ID = "721519fc8756e498";
const PAGES = Object.freeze({
  "6029271a66a7a2ec": "standard",
  "d85ffedeb94ae7d7": "clans",
  "ecf1b8a7d9406523": "origins"
});
const ASSET = "systems/nexus-jjk/assets/journal/";
// As mídias já distribuídas continuam disponíveis quando imagem está vazia no banco.
const TECHNIQUE_MEDIA = Object.freeze(Object.fromEntries([
  "firecast-016-tec-da-obra.gif", "firecast-017-tec-da-obra.gif", "firecast-018-tec-da-obra.gif",
  "firecast-019-tec-da-obra.gif", "firecast-020-tec-da-obra.gif", "firecast-021-tec-da-obra.gif",
  "firecast-022-tec-da-obra.gif", "firecast-023-tec-da-obra.gif", "firecast-024-tec-da-obra.mp4",
  "firecast-026-tec-de-cla.gif", "firecast-027-tec-de-cla.gif", "firecast-028-tec-de-cla.webp",
  "firecast-030-tec-de-cla.gif", "firecast-032-tec-de-cla.gif", "firecast-034-tec-de-cla.gif"
].map((file, index) => [String(index + 1), `${ASSET}${file}`])));
const CLAN_MEDIA = Object.freeze({
  1: `${ASSET}firecast-006-zenin.webp`, 2: `${ASSET}firecast-002-kamo.webp`,
  3: `${ASSET}firecast-010-inumaki.webp`, 4: `${ASSET}firecast-008-fujiwara.webp`
});
const ORIGIN_MEDIA = Object.freeze({
  1: `${ASSET}origem-amaldicoado.gif`, 2: `${ASSET}origem-hibrido.gif`,
  3: `${ASSET}origem-receptaculo.gif`, 4: `${ASSET}origem-gemeos.gif`
});
const escape = value => String(value).replace(/[&<>"']/gu, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[char]);
const ordered = rows => [...rows].sort((a, b) => String(a.id).localeCompare(String(b.id), "pt-BR", { numeric: true }));
const assetFor = (map, id) => Object.hasOwn(map, id) ? map[id] : "";
let client;

export function catalogPageKind(entryId, pageId) {
  return entryId === CATALOG_ID && Object.hasOwn(PAGES, pageId) ? PAGES[pageId] : null;
}

function rows(data, key) {
  const list = data?.[key];
  if (!Array.isArray(list) || list.some(row => !row || typeof row !== "object" ||
      !["number", "string"].includes(typeof row.id) || typeof row.nome !== "string" || !row.nome.trim())) {
    throw new Error(`O catálogo recebeu dados inválidos em ${key}. Confira os campos id e nome.`);
  }
  const ids = list.map(row => String(row.id));
  if (new Set(ids).size !== ids.length) throw new Error(`O catálogo recebeu identificadores repetidos em ${key}.`);
  return ordered(list);
}

function imageURL(value, fallback) {
  const url = typeof value === "string" ? value.trim() : "";
  if (!url) return fallback ?? "";
  if (/[\u0000-\u001f\u007f\\]/u.test(url)) return fallback ?? "";
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" && !parsed.username && !parsed.password) return url;
  } catch { /* Também aceita os caminhos de mídia do próprio Foundry. */ }
  if (/^(?:systems\/nexus-jjk\/assets\/|worlds\/|modules\/)/u.test(url) &&
      !url.split(/[/?#]/u).includes("..") && !/%(?:2e|2f|5c)/iu.test(url)) return url;
  return fallback ?? "";
}

function media(value, fallback, name, banner = false) {
  const url = imageURL(value, fallback);
  if (!url) return banner ? "" : '<div class="catalogo-sem-imagem"><i class="fa-solid fa-image" aria-hidden="true"></i><span>Sem imagem</span></div>';
  const path = new URL(url, "https://foundry.invalid/").pathname;
  if (/\.(?:mp4|webm|ogg)$/iu.test(path)) {
    return `<video src="${escape(url)}" controls muted loop playsinline preload="none" aria-label="${escape(name)}"></video>`;
  }
  return `<img${banner ? ' class="catalogo-banner"' : ""} src="${escape(url)}" alt="${escape(name)}" loading="lazy" referrerpolicy="no-referrer">`;
}

function amount(value) {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function card(row, isOrigin = false) {
  const current = amount(row.vagas);
  const maximum = amount(isOrigin ? row.vagas_max : row.vagas_maxima);
  const price = amount(row.valor);
  const vacancies = `${current === null ? "—" : Math.floor(current)} / ${maximum === null ? "—" : Math.floor(maximum)}`;
  const formattedPrice = price === null ? "Preço não informado" : new Intl.NumberFormat("pt-BR", {
    style: "currency", currency: "BRL"
  }).format(price);
  return `<article class="catalogo-item"><h2>${escape(row.nome)}</h2>${media(row.imagem,
    assetFor(isOrigin ? ORIGIN_MEDIA : TECHNIQUE_MEDIA, row.id), row.nome)}<p class="catalogo-disponibilidade"><strong>Vagas: ${vacancies}</strong><span>${escape(formattedPrice)}</span></p></article>`;
}

/** Dados do catálogo são texto e URLs; nunca são executados nem inseridos como HTML do banco. */
export function renderCatalogContent(kind, data) {
  let html;
  if (kind === "origins") {
    const origins = rows(data, "origins");
    html = origins.length ? `<div class="catalogo-grade">${origins.map(row => card(row, true)).join("")}</div>`
      : '<p class="catalogo-vazio">Nenhuma origem cadastrada no catálogo.</p>';
  } else {
    const techniques = rows(data, "techniques");
    if (kind === "standard") {
      const standard = techniques.filter(row => row.clan === null || row.clan === undefined || row.clan === "");
      html = standard.length ? `<div class="catalogo-grade">${standard.map(row => card(row)).join("")}</div>`
        : '<p class="catalogo-vazio">Nenhuma técnica da obra cadastrada no catálogo.</p>';
    } else if (kind === "clans") {
      const clans = rows(data, "clans");
      const groups = clans.map(clan => ({ clan, techniques: techniques.filter(row => String(row.clan) === String(clan.id)) }));
      const known = new Set(clans.map(clan => String(clan.id)));
      const orphaned = techniques.filter(row => row.clan !== null && row.clan !== undefined && row.clan !== "" && !known.has(String(row.clan)));
      if (orphaned.length) groups.push({ clan: { nome: "Clã não encontrado" }, techniques: orphaned });
      html = groups.map(({ clan, techniques: list }) => `<section class="catalogo-cla"><h2 class="catalogo-nome-cla">${escape(clan.nome)}</h2>${media(clan.imagem, assetFor(CLAN_MEDIA, clan.id), clan.nome, true)}${list.length ? `<div class="catalogo-grade">${list.map(row => card(row)).join("")}</div>` : '<p class="catalogo-vazio">Nenhuma técnica cadastrada neste clã.</p>'}</section>`).join("")
        || '<p class="catalogo-vazio">Nenhum clã cadastrado no catálogo.</p>';
    } else throw new Error("Página de catálogo desconhecida.");
  }
  return `<div class="nexus-wiki nexus-book-page nexus-catalogo-online">${html}</div>`;
}

export async function loadCatalogContent(kind, { refresh = false, catalogClient } = {}) {
  const source = catalogClient ?? (client ??= createCatalogClient());
  const snapshot = await source.load({ refresh });
  const html = renderCatalogContent(kind, snapshot);
  const updatedAt = new Date(snapshot.fetchedAt).toLocaleString("pt-BR");
  const status = snapshot.stale
    ? `Cópia salva em ${updatedAt}. ${snapshot.error ?? "Não foi possível atualizar o catálogo."}`
    : `Catálogo ${snapshot.cached ? "em cache" : "online"} · Atualizado em ${updatedAt}`;
  return { html, status, stale: snapshot.stale, updatedAt: snapshot.fetchedAt };
}
