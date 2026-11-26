import assert from "node:assert/strict";
import test from "node:test";
import { createCatalogClient, DEFAULT_CATALOG_CONFIG } from "../module/catalog-client.mjs";

function storage() {
  const entries = new Map();
  return { entries, getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) };
}

function api({ clans = [{ id: 1 }], techniques = [{ id: 2 }], origins = [{ id: 3 }], maximum = Infinity } = {}) {
  const calls = [];
  const fetch = async (href, options) => {
    const url = new URL(href);
    const rows = { Clas: clans, Tecnicas: techniques, Origens: origins }[url.pathname.split("/").at(-1)];
    const offset = Number(url.searchParams.get("offset"));
    const limit = Math.min(Number(url.searchParams.get("limit")), maximum);
    calls.push({ url, options });
    const page = rows.slice(offset, offset + limit);
    return new Response(JSON.stringify(page), { headers: { "content-range": `${offset}-${offset + page.length - 1}/${rows.length}` } });
  };
  return { calls, fetch };
}

test("consulta só GET com apikey pública, sem cookie ou Authorization; preserva nomes das tabelas", async () => {
  const remote = api();
  const result = await createCatalogClient({ fetch: remote.fetch, storage: null, now: () => 1000 }).load();
  assert.deepEqual(result, { clans: [{ id: 1 }], techniques: [{ id: 2 }], origins: [{ id: 3 }], fetchedAt: 1000,
    cached: false, stale: false, error: null });
  assert.equal(remote.calls.length, 3);
  for (const { url, options } of remote.calls) {
    assert.equal(url.origin, DEFAULT_CATALOG_CONFIG.url);
    assert.equal(url.searchParams.get("order"), "id.asc");
    assert.equal(options.method, "GET");
    assert.equal(options.headers.apikey, DEFAULT_CATALOG_CONFIG.publishableKey);
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.credentials, "omit");
    assert.equal(options.redirect, "error");
  }
});

test("buscas simultâneas compartilham requisições, TTL evita consultas e refresh força atualização", async () => {
  let time = 1000;
  const remote = api();
  const client = createCatalogClient({ fetch: remote.fetch, storage: null, now: () => time, ttlMs: 100 });
  const [first, second] = await Promise.all([client.load(), client.load()]);
  assert.deepEqual(second, first);
  assert.equal(remote.calls.length, 3);
  first.clans[0].id = 999;
  assert.equal((await client.load()).clans[0].id, 1);
  assert.equal(remote.calls.length, 3);
  assert.equal((await client.load({ refresh: true })).cached, false);
  assert.equal(remote.calls.length, 6);
  time += 100;
  await client.load();
  assert.equal(remote.calls.length, 9);
});

test("paginação não trunca tabelas maiores que 1000 nem ignora limite menor do servidor", async () => {
  const remote = api({ clans: Array.from({ length: 1250 }, (_, id) => ({ id })), techniques: [], origins: [], maximum: 200 });
  const result = await createCatalogClient({ fetch: remote.fetch, storage: null }).load();
  assert.equal(result.clans.length, 1250);
  assert.deepEqual(result.clans.map(row => row.id), Array.from({ length: 1250 }, (_, id) => id));
  assert.deepEqual(result.techniques, []);
  assert.deepEqual(result.origins, []);
  assert.equal(remote.calls.filter(call => call.url.pathname.endsWith("/Clas")).length, 7);
});

test("sem content-range pagina até o fim e falha explicitamente ao exceder o máximo", async () => {
  let calls = 0;
  const fetch = async url => {
    calls++;
    const offset = Number(new URL(url).searchParams.get("offset"));
    return new Response(JSON.stringify(offset < 4 ? [{ id: offset }, { id: offset + 1 }] : []));
  };
  assert.equal((await createCatalogClient({ fetch, storage: null, pageSize: 2 }).load()).clans.length, 4);
  assert.equal(calls, 9);
  await assert.rejects(createCatalogClient({ fetch, storage: null, pageSize: 2, maxRows: 3 }).load(), /limite de 3/);
});

test("401 e 403 nunca viram catálogo vazio; resposta HTTP e payload inválidos falham", async () => {
  for (const status of [401, 403]) {
    await assert.rejects(createCatalogClient({ fetch: async () => new Response("{}", { status }), storage: null }).load(), /SELECT\/RLS/);
  }
  for (const [body, status, pattern] of [["{}", 404, /tabela.*API/], ["{}", 503, /HTTP 503/],
    ["not json", 200, /resposta inválida/], ['{"rows":[]}', 200, /lista inválida/], ["[null]", 200, /lista inválida/]]) {
    await assert.rejects(createCatalogClient({ fetch: async () => new Response(body, { status }), storage: null }).load(), pattern);
  }
  const result = await createCatalogClient({ fetch: async () => new Response("[]"), storage: null }).load();
  assert.deepEqual(result.clans, []);
  assert.equal(result.stale, false);
});

test("timeout limita inclusive fetch que ignora AbortSignal", async () => {
  await assert.rejects(createCatalogClient({ fetch: () => new Promise(() => {}), storage: null, timeoutMs: 15 }).load(), /demorou/);
});

test("cache persistente sobrevive à reabertura e falha remota mantém snapshot com aviso", async () => {
  const saved = storage();
  const remote = api();
  await createCatalogClient({ fetch: remote.fetch, storage: saved, now: () => 1000 }).load();
  let attempts = 0;
  const unavailable = async () => { attempts++; throw new Error("Conexão interrompida"); };
  const client = createCatalogClient({ fetch: unavailable, storage: saved, now: () => 1100 });
  const fresh = await client.load();
  assert.equal(fresh.cached, true);
  assert.equal(fresh.stale, false);
  assert.equal(attempts, 0);
  const fallback = await client.load({ refresh: true });
  assert.deepEqual(fallback.clans, [{ id: 1 }]);
  assert.equal(fallback.stale, true);
  assert.match(fallback.error, /Não foi possível conectar/);
  assert.equal(attempts, 3);
  assert.equal((await client.load()).error, fallback.error);
});

test("cache se separa por projeto, token e tabelas; armazenamento bloqueado ou corrupto é ignorado", async () => {
  const saved = storage();
  const remote = api();
  await createCatalogClient({ fetch: remote.fetch, storage: saved }).load();
  for (const config of [{ url: "https://other.supabase.co" }, { publishableKey: "sb_publishable_another" },
    { clansTable: "Other" }, { techniquesTable: "Other" }, { originsTable: "Other" }]) {
    const client = createCatalogClient({ config, storage: saved, fetch: async () => { throw new Error("offline"); } });
    await assert.rejects(client.load(), /Não foi possível conectar/);
  }
  for (const value of ["broken", "{}", '{"version":1,"fetchedAt":1,"clans":[],"techniques":[]}',
    '{"version":2,"fetchedAt":1,"clans":[],"techniques":[]}',
    '{"version":2,"fetchedAt":1,"clans":[null],"techniques":[],"origins":[]}']) {
    for (const key of saved.entries.keys()) saved.entries.set(key, value);
    const client = createCatalogClient({ storage: saved, fetch: async () => { throw new Error("offline"); } });
    await assert.rejects(client.load(), /Não foi possível conectar/);
  }
  const blocked = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("quota"); } };
  assert.equal((await createCatalogClient({ storage: blocked, fetch: remote.fetch }).load()).cached, false);
});

test("limites e configuração inválidos são recusados antes de transmitir a chave", () => {
  for (const config of [{ url: "http://example.com" }, { url: "https://user:pass@example.com" },
    { url: "https://example.com/?token=a" }, { url: "https://example.com/rest/v1" },
    { publishableKey: "sb_secret_privileged" }, { publishableKey: "eyJlegacy" }, { clansTable: "Clas?select=secret" },
    { originsTable: "Origens?select=secret" }]) {
    assert.throws(() => createCatalogClient({ config, storage: null }));
  }
  for (const options of [{ ttlMs: -1 }, { timeoutMs: 0 }, { pageSize: 1001 }, { maxRows: 0 }]) {
    assert.throws(() => createCatalogClient({ ...options, storage: null }));
  }
});

test("as três tabelas formam um snapshot atômico e falha em Origens conserva o conjunto anterior", async () => {
  const saved = storage();
  const initial = api({ clans: [{ id: 1, nome: "Antes" }], techniques: [{ id: 2 }], origins: [{ id: 3 }] });
  const updated = api({ clans: [{ id: 11, nome: "Depois" }], techniques: [{ id: 22 }], origins: [{ id: 33 }] });
  let phase = "initial";
  const fetch = (href, options) => {
    if (phase === "initial") return initial.fetch(href, options);
    if (phase === "failure" && new URL(href).pathname.endsWith("/Origens")) {
      return Promise.resolve(new Response("{}", { status: 403 }));
    }
    return updated.fetch(href, options);
  };
  const client = createCatalogClient({ fetch, storage: saved, now: () => 1000 });
  const first = await client.load();
  const previousCache = [...saved.entries.values()][0];
  phase = "failure";
  const fallback = await client.load({ refresh: true });
  assert.equal(fallback.stale, true);
  assert.match(fallback.error, /Origens/);
  for (const key of ["clans", "techniques", "origins"]) assert.deepEqual(fallback[key], first[key]);
  assert.equal([...saved.entries.values()][0], previousCache);
  phase = "success";
  const fresh = await client.load({ refresh: true });
  assert.equal(fresh.stale, false);
  assert.equal(fresh.error, null);
  assert.deepEqual(fresh.clans, [{ id: 11, nome: "Depois" }]);
  assert.deepEqual(fresh.techniques, [{ id: 22 }]);
  assert.deepEqual(fresh.origins, [{ id: 33 }]);
  assert.equal(JSON.parse([...saved.entries.values()][0]).version, 2);
});
