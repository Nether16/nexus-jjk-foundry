/** Somente a chave pública: a leitura continua sujeita aos GRANTs e às políticas RLS. */
export const DEFAULT_CATALOG_CONFIG = Object.freeze({
  url: "https://afixrtplfqummbstxdsw.supabase.co",
  publishableKey: "sb_publishable_oJm0DGolKQw-URHKOhAtJw_SKSf0hth",
  clansTable: "Clas",
  techniquesTable: "Tecnicas",
  originsTable: "Origens"
});

const copy = value => JSON.parse(JSON.stringify(value));
const rowsValid = (rows, maximum) => Array.isArray(rows) && rows.length <= maximum &&
  rows.every(row => row !== null && typeof row === "object" && !Array.isArray(row));

function browserStorage() {
  try { return globalThis.localStorage ?? null; }
  catch { return null; }
}

function readConfig(value) {
  const config = { ...DEFAULT_CATALOG_CONFIG, ...value };
  let url;
  try { url = new URL(config.url); }
  catch { throw new Error("O endereço do catálogo é inválido."); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
    !["", "/"].includes(url.pathname)) throw new Error("Use o endereço HTTPS do projeto do catálogo.");
  if (typeof config.publishableKey !== "string" || !/^sb_publishable_[\w-]+$/u.test(config.publishableKey)) {
    throw new Error("O catálogo precisa de uma chave pública sb_publishable_.");
  }
  for (const field of ["clansTable", "techniquesTable", "originsTable"]) {
    if (typeof config[field] !== "string" || !/^[\p{L}_][\p{L}\p{N}_ ]{0,127}$/u.test(config[field])) {
      throw new Error("O nome da tabela do catálogo é inválido.");
    }
  }
  return { ...config, url: url.origin };
}

/**
 * Cliente de leitura independente do Foundry e das colunas do catálogo.
 * load() informa quando devolve cache desatualizado; erros nunca viram listas vazias.
 */
export function createCatalogClient({ config: configuration, fetch: fetcher = globalThis.fetch,
  storage = browserStorage(), now = Date.now, ttlMs = 60_000, timeoutMs = 12_000,
  pageSize = 500, maxRows = 10_000 } = {}) {
  const config = readConfig(configuration);
  if (typeof fetcher !== "function" || typeof now !== "function") throw new Error("Cliente do catálogo inválido.");
  if (!Number.isFinite(ttlMs) || ttlMs < 0 || !Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 60_000 ||
    !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1000 ||
    !Number.isInteger(maxRows) || maxRows < 1 || maxRows > 100_000) {
    throw new Error("Os limites de consulta do catálogo são inválidos.");
  }
  // O token faz parte da identidade para não reaproveitar dados de outra conexão.
  const cacheKey = `nexus-jjk.catalog.v2:${encodeURIComponent(JSON.stringify([
    config.url, config.publishableKey, config.clansTable, config.techniquesTable, config.originsTable
  ]))}`;
  let snapshot = null;
  let pending = null;
  let lastError = null;
  try {
    const saved = JSON.parse(storage?.getItem(cacheKey) ?? "null");
    if (saved?.version === 2 && Number.isFinite(saved.fetchedAt) && saved.fetchedAt >= 0 &&
      saved.fetchedAt <= now() + 60_000 && rowsValid(saved.clans, maxRows) && rowsValid(saved.techniques, maxRows) &&
      rowsValid(saved.origins, maxRows)) {
      snapshot = { clans: saved.clans, techniques: saved.techniques, origins: saved.origins, fetchedAt: saved.fetchedAt };
    }
  } catch { /* Cache indisponível ou corrompido não impede a leitura remota. */ }

  async function queryPage(table, offset, limit) {
    const url = new URL(`${config.url}/rest/v1/${encodeURIComponent(table)}`);
    url.search = new URLSearchParams({ select: "*", order: "id.asc", limit: String(limit), offset: String(offset) });
    const controller = new AbortController();
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error("O catálogo demorou para responder. Tente atualizar novamente."));
      }, timeoutMs);
    });
    try {
      return await Promise.race([(async () => {
        const response = await Promise.resolve().then(() => fetcher(url.href, {
          method: "GET", headers: { apikey: config.publishableKey, Accept: "application/json", Prefer: "count=exact" },
          signal: controller.signal, credentials: "omit", redirect: "error"
        })).catch(cause => {
          throw new Error("Não foi possível conectar ao catálogo. Confira a conexão e tente atualizar.", { cause });
        });
        if (!response.ok) {
          if ([401, 403].includes(response.status)) {
            throw new Error(`Não foi possível ler ${table}. Confira a chave pública e as permissões de leitura (SELECT/RLS) no Supabase.`);
          }
          if (response.status === 404) throw new Error(`A tabela ${table} não está disponível na API do catálogo.`);
          throw new Error(`Não foi possível atualizar o catálogo (HTTP ${response.status}).`);
        }
        let rows;
        try { rows = await response.json(); }
        catch { throw new Error("A API do catálogo retornou uma resposta inválida."); }
        if (!rowsValid(rows, limit)) throw new Error("A API do catálogo retornou uma lista inválida.");
        const range = response.headers?.get("content-range") ?? "";
        const match = /\/(\d+)$/u.exec(range);
        const total = match ? Number(match[1]) : null;
        return { rows, total };
      })(), timeout]);
    } finally { clearTimeout(timer); }
  }

  async function queryTable(table) {
    const rows = [];
    while (true) {
      const limit = Math.min(pageSize, maxRows - rows.length + 1);
      const page = await queryPage(table, rows.length, limit);
      if (page.total > maxRows || rows.length + page.rows.length > maxRows) {
        throw new Error(`A tabela ${table} ultrapassou o limite de ${maxRows} entradas do catálogo.`);
      }
      rows.push(...page.rows);
      if (page.total !== null && rows.length >= page.total) return rows;
      if (page.total === null && page.rows.length < limit) return rows;
      if (!page.rows.length) throw new Error("A paginação do catálogo retornou uma resposta incompleta.");
    }
  }

  const result = (cached, stale = false, error = null) => ({ ...copy(snapshot), cached, stale, error });
  return {
    load({ refresh = false } = {}) {
      if (pending) return pending;
      const age = snapshot ? now() - snapshot.fetchedAt : Infinity;
      if (!refresh && age >= 0 && age < ttlMs) return Promise.resolve(result(true, Boolean(lastError), lastError));
      pending = (async () => {
        try {
          const [clans, techniques, origins] = await Promise.all([
            queryTable(config.clansTable), queryTable(config.techniquesTable), queryTable(config.originsTable)
          ]);
          snapshot = { clans, techniques, origins, fetchedAt: now() };
          lastError = null;
          try { storage?.setItem(cacheKey, JSON.stringify({ version: 2, ...snapshot })); }
          catch { /* Quota ou bloqueio do armazenamento: mantém o cache em memória. */ }
          return result(false);
        } catch (cause) {
          const error = cause instanceof Error ? cause : new Error("Não foi possível consultar o catálogo.");
          if (snapshot) {
            lastError = error.message;
            return result(true, true, lastError);
          }
          throw error;
        }
      })().finally(() => { pending = null; });
      return pending;
    }
  };
}
