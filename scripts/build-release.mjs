import { execFile } from "node:child_process";
import { copyFile, lstat, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(await readFile(join(root, "system.json"), "utf8"));
const runtime = ["system.json", "nexus.mjs", "module", "styles", "templates", "lang", "assets"];
const excluded = new Set(["assets/images/Lulatron_3000.webp"]);
const temporaryBase = resolve(tmpdir());
const output = join(root, "dist");

if (manifest.id !== "nexus-jjk" || !/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/u.test(manifest.version)) {
  throw new Error("O manifesto deve identificar nexus-jjk e uma versão válida.");
}
for (const key of ["manifest", "download"]) {
  if (new URL(manifest[key]).protocol !== "https:") {
    throw new Error(`Configure uma URL HTTPS pública no campo ${key} antes de publicar.`);
  }
}
if (manifest.packs?.length !== 1 || manifest.packs[0].path !== "packs/livro-de-regras" ||
    manifest.packs[0].type !== "JournalEntry") {
  throw new Error("Atualize o build de compêndios antes de publicar uma estrutura de packs diferente.");
}

function portable(path) {
  return path.split(sep).join("/");
}

function isExcluded(path) {
  const name = portable(path);
  return excluded.has(name) || (name.startsWith("assets/") && name.toLowerCase().endsWith(".md"));
}

async function copyTree(source, destination, local = "") {
  if (isExcluded(local)) return;
  const info = await lstat(source);
  if (info.isSymbolicLink()) throw new Error(`Link simbólico fora do pacote: ${source}`);
  if (info.isDirectory()) {
    await mkdir(destination, { recursive: true });
    for (const entry of (await readdir(source)).sort()) {
      await copyTree(join(source, entry), join(destination, entry), join(local, entry));
    }
  } else if (info.isFile()) {
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(source, destination);
  } else {
    throw new Error(`Formato de arquivo não suportado: ${source}`);
  }
}

async function collectFiles(directory, target = Object.create(null)) {
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, "en"))) {
    const path = join(directory, entry.name);
    const name = portable(relative(stage, path));
    if (entry.isSymbolicLink()) throw new Error(`Link simbólico fora do ZIP: ${path}`);
    if (entry.isDirectory()) await collectFiles(path, target);
    else if (entry.isFile()) {
      // Estes arquivos são diagnósticos e travas do LevelDB, não dados do compêndio.
      if (name.startsWith("packs/") && ["LOCK", "LOG", "LOG.old"].includes(entry.name)) continue;
      target[name] = await readFile(path);
    }
  }
  return target;
}

const cli = process.env.NEXUS_FVTT_CLI || import.meta.resolve("@foundryvtt/foundryvtt-cli");
const { zipSync, unzipSync } = await import(process.env.NEXUS_FFLATE || "fflate");
const stage = await mkdtemp(join(temporaryBase, "nexus-release-"));
try {
  for (const path of runtime) await copyTree(join(root, path), join(stage, path), path);

  // Compila a partir do JSON, sem abrir ou copiar o banco usado pelo Foundry.
  await copyTree(join(root, "src/packs/livro-de-regras"), join(stage, "src/packs/livro-de-regras"));
  await copyTree(join(root, "scripts/build-packs.mjs"), join(stage, "scripts/build-packs.mjs"));
  const result = await run(process.execPath, [join(stage, "scripts/build-packs.mjs")], {
    env: { ...process.env, NEXUS_FVTT_CLI: cli }
  });
  process.stdout.write(result.stdout);

  const files = Object.create(null);
  for (const path of runtime) {
    const destination = join(stage, path);
    const info = await lstat(destination);
    if (info.isDirectory()) await collectFiles(destination, files);
    else files[path] = await readFile(destination);
  }
  await collectFiles(join(stage, "packs"), files);
  const archive = zipSync(files, { level: 6, mtime: new Date(2000, 0, 1) });

  // Confere o pacote pronto antes de substituir os artefatos anteriores.
  const unpacked = unzipSync(archive);
  if (!unpacked["system.json"] || !unpacked["packs/livro-de-regras/CURRENT"] ||
      !Object.keys(unpacked).every(path => runtime.some(allowed => path === allowed || path.startsWith(`${allowed}/`)) || path.startsWith("packs/"))) {
    throw new Error("O ZIP gerado não contém somente os arquivos de execução esperados.");
  }
  const packedManifest = JSON.parse(new TextDecoder().decode(unpacked["system.json"]));
  if (JSON.stringify(packedManifest) !== JSON.stringify(manifest)) throw new Error("O manifesto do ZIP divergiu da fonte.");

  await mkdir(output, { recursive: true });
  const archiveName = `${manifest.id}-${manifest.version}.zip`;
  await writeFile(join(output, archiveName), archive);
  await writeFile(join(output, "system.json"), unpacked["system.json"]);
  console.log(`Release pronta: dist/${archiveName} e dist/system.json (${Object.keys(files).length} arquivos).`);
} finally {
  // A exclusão fica limitada à pasta temporária criada por esta execução.
  if (dirname(resolve(stage)) !== temporaryBase || !basename(stage).startsWith("nexus-release-")) {
    throw new Error("Caminho temporário inválido; a limpeza foi cancelada.");
  }
  await rm(stage, { recursive: true, force: true });
}
