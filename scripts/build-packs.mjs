import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const sourcePath = resolve(root, "src/packs/livro-de-regras");
const packPath = resolve(root, "packs/livro-de-regras");
const idPattern = /^[A-Za-z0-9]{16}$/u;
const ids = new Set();
const missingMedia = new Set();

async function readSources(directory) {
  const sources = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) sources.push(...await readSources(path));
    else if (entry.name.endsWith(".json")) sources.push(JSON.parse(await readFile(path, "utf8")));
  }
  return sources;
}

function validateId(document, key) {
  if (!idPattern.test(document._id) || ids.has(document._id)) {
    throw new Error(`ID inválido ou repetido em ${document.name}: ${document._id}`);
  }
  ids.add(document._id);
  if (document._key !== key || !document.name?.trim()) {
    throw new Error(`Nome ou chave de compilação inválidos em ${document._id}.`);
  }
}

const sources = await readSources(sourcePath);
const folders = sources.filter(document => document._key?.startsWith("!folders!"));
const journals = sources.filter(document => document._key?.startsWith("!journal!"));
if (!journals.length || folders.length + journals.length !== sources.length) {
  throw new Error("O livro deve conter somente pastas e diários, com suas páginas incorporadas.");
}

for (const folder of folders) {
  validateId(folder, `!folders!${folder._id}`);
  if (folder.type !== "JournalEntry") throw new Error(`Tipo inválido na pasta ${folder.name}.`);
}

const folderIds = new Set(folders.map(folder => folder._id));
for (const document of sources) {
  if (document.folder && !folderIds.has(document.folder)) {
    throw new Error(`Pasta inexistente em ${document.name}.`);
  }
}

let pageCount = 0;
for (const journal of journals) {
  validateId(journal, `!journal!${journal._id}`);
  if (journal.ownership?.default !== 2 || !Array.isArray(journal.pages)) {
    throw new Error(`Permissão de leitura ou páginas inválidas em ${journal.name}.`);
  }
  for (const page of journal.pages) {
    validateId(page, `!journal.pages!${journal._id}.${page._id}`);
    if (page.type !== "text" || page.text?.format !== 1 || typeof page.text.content !== "string") {
      throw new Error(`Página HTML inválida em ${page.name}.`);
    }
    if (page.ownership?.default !== -1) throw new Error(`A página ${page.name} deve herdar a permissão do diário.`);
    pageCount++;
  }
}

// A variável opcional permite usar ferramentas instaladas fora da pasta do sistema.
const { compilePack } = await import(process.env.NEXUS_FVTT_CLI || "@foundryvtt/foundryvtt-cli");
await compilePack(sourcePath, packPath, {
  recursive: true,
  log: true,
  transformEntry(document) {
    for (const page of document.pages ?? []) {
      if (page.type !== "text") continue;
      // Conserva a referência na fonte sem exibir imagens quebradas no livro.
      page.text.content = page.text.content.replace(/<img\b[^>]*\bsrc="(systems\/nexus-jjk\/assets\/journal\/[^"<>]+)"[^>]*>/gu, (tag, source) => {
        if (existsSync(resolve(root, source.slice("systems/nexus-jjk/".length)))) return tag;
        missingMedia.add(source);
        return `<!-- Mídia pendente: ${source.replaceAll("--", "—")} -->`;
      });
    }
  }
});
console.log(`Livro compilado: ${folders.length} pastas, ${journals.length} diários e ${pageCount} páginas.`);
if (missingMedia.size) console.log(`Mídias pendentes (referências mantidas no JSON):\n${[...missingMedia].sort().join("\n")}`);
