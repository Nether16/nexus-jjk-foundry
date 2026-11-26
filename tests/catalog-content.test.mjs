import assert from "node:assert/strict";
import test from "node:test";
import { catalogPageKind, loadCatalogContent, renderCatalogContent } from "../module/catalog-content.mjs";

function snapshot() {
  return {
    clans: [{ id: 1, nome: "Zen'in", imagem: "" }],
    techniques: [
      { id: 1, nome: "Técnica da obra", imagem: "", clan: null, vagas: 0, vagas_maxima: 1, valor: 50 },
      { id: 10, nome: "Técnica de clã", imagem: "", clan: 1, vagas: 1, vagas_maxima: 2, valor: 55.5 }
    ],
    origins: [{ id: 2, nome: "Híbrido", imagem: "", vagas: 2, vagas_max: 4, valor: 50 }],
    fetchedAt: 1_795_641_600_000, cached: false, stale: false, error: null
  };
}

test("somente as três páginas do Catálogo usam a fonte remota", () => {
  assert.equal(catalogPageKind("721519fc8756e498", "6029271a66a7a2ec"), "standard");
  assert.equal(catalogPageKind("721519fc8756e498", "d85ffedeb94ae7d7"), "clans");
  assert.equal(catalogPageKind("721519fc8756e498", "ecf1b8a7d9406523"), "origins");
  for (const id of ["toString", "__proto__", "outra-página"]) assert.equal(catalogPageKind("721519fc8756e498", id), null);
  assert.equal(catalogPageKind("outra-entrada", "6029271a66a7a2ec"), null);
});

test("obra, clãs e origens mostram seus dados reais e os dois nomes de vagas máximas", () => {
  const data = snapshot();
  const standard = renderCatalogContent("standard", data);
  assert.match(standard, /Técnica da obra/u);
  assert.doesNotMatch(standard, /Técnica de clã/u);
  assert.match(standard, /Vagas: 0 \/ 1/u);
  assert.match(standard, /R\$\s50,00/u);
  assert.match(standard, /firecast-016-tec-da-obra.gif/u);
  const clans = renderCatalogContent("clans", data);
  assert.match(clans, /Zen&#39;in/u);
  assert.match(clans, /Técnica de clã/u);
  assert.match(clans, /Vagas: 1 \/ 2/u);
  assert.match(clans, /55,50/u);
  assert.doesNotMatch(clans, /Técnica da obra/u);
  const origins = renderCatalogContent("origins", data);
  assert.match(origins, /Híbrido/u);
  assert.match(origins, /Vagas: 2 \/ 4/u);
  assert.match(origins, /origem-hibrido.gif/u);
});

test("nomes e URLs do banco nunca executam HTML ou protocolos de script", () => {
  const data = snapshot();
  data.origins = [{ id: "__proto__", nome: '<img src=x onerror="alert(1)">', imagem: "javascript:alert(1)", vagas: 1, vagas_max: 1, valor: 5 }];
  const html = renderCatalogContent("origins", data);
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/u);
  assert.doesNotMatch(html, /<img|javascript:|\[object Object\]/u);
  assert.match(html, /Sem imagem/u);
  data.origins[0].imagem = 'https://example.com/a.gif?q=" onerror="alert(2)';
  assert.match(renderCatalogContent("origins", data), /src="https:\/\/example.com\/a.gif\?q=&quot; onerror=&quot;alert\(2\)"/u);
  data.origins[0].imagem = "data:image/svg+xml,<svg onload=alert(1)>";
  assert.doesNotMatch(renderCatalogContent("origins", data), /data:image|<svg/u);
});

test("mídia personalizada substitui a local, inclusive vídeo com parâmetros", () => {
  const data = snapshot();
  data.techniques[0].imagem = "https://cdn.example.com/skill.webm?token=public";
  const html = renderCatalogContent("standard", data);
  assert.match(html, /<video src="https:\/\/cdn.example.com\/skill.webm\?token=public"/u);
  assert.doesNotMatch(html, /firecast-016/u);
});

test("catálogo vazio é explícito e vínculo de clã ausente não esconde técnicas", () => {
  const empty = { clans: [], techniques: [], origins: [] };
  assert.match(renderCatalogContent("standard", empty), /Nenhuma técnica da obra/u);
  assert.match(renderCatalogContent("clans", empty), /Nenhum clã/u);
  assert.match(renderCatalogContent("origins", empty), /Nenhuma origem/u);
  const data = snapshot();
  data.clans = [];
  assert.match(renderCatalogContent("clans", data), /Clã não encontrado.*Técnica de clã/u);
  assert.throws(() => renderCatalogContent("origins", { origins: [{ id: 1 }] }), /dados inválidos/u);
});

test("atualizar usa o cliente e indica a cópia anterior quando a rede falha", async () => {
  const data = snapshot();
  const calls = [];
  const catalogClient = { async load(options) { calls.push(options); return data; } };
  const online = await loadCatalogContent("origins", { catalogClient, refresh: true });
  assert.deepEqual(calls, [{ refresh: true }]);
  assert.match(online.status, /Catálogo online/u);
  data.cached = true;
  data.stale = true;
  data.error = "Sem conexão.";
  const cached = await loadCatalogContent("origins", { catalogClient });
  assert.match(cached.status, /Cópia salva.*Sem conexão/u);
  assert.equal(cached.stale, true);
  assert.equal(cached.html, online.html);
});
