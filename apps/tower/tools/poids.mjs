// Lot T1 — le poids de Tower, mesuré sur la construction (`npm run build -w @cdj/tower` d'abord) : `node apps/tower/tools/poids.mjs`.
// Octets **compressés** (gzip niveau 9 et brotli niveau 11) pour le JS, le CSS et le `.wasm` ; octets des fichiers pour les polices (déjà en woff2). Distingue ce que le joueur
// télécharge à chaque étape : la page, le jeu (three.js compris), la physique à la demande (le JavaScript de Rapier et son `.wasm`, deux fichiers) et l'anglais à la demande.
// Les chiffres vont dans docs/plateforme/budgets.md (section « Tower »). Aucun test ne les garde encore : branchement à scripts/budgets.mjs et à la CI = lot T4.
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";

const DIST = join(dirname(fileURLToPath(import.meta.url)), "../dist");
const ASSETS = join(DIST, "assets");
const lire = (f) => readFileSync(join(ASSETS, f));
const gz = (b) => gzipSync(b, { level: 9 }).length;
const br = (b) => brotliCompressSync(b, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length;
const fichiers = readdirSync(ASSETS);
const somme = (liste, f) => liste.reduce((n, nom) => n + f(lire(nom)), 0);
const de = (prefixe, ext) => fichiers.filter((f) => f.startsWith(prefixe) && f.endsWith(ext));

const html = readFileSync(join(DIST, "index.html"));
const rapierJs = fichiers.filter((f) => /^rapier-.*\.js$/.test(f) && lire(f).length > 50_000);
const lignes = {
  "page (HTML + main.js)": { gz: gz(html) + somme(de("main-", ".js"), gz), br: br(html) + somme(de("main-", ".js"), br) },
  "jeu : JS (three.js compris)": { gz: somme(de("jeu-", ".js"), gz), br: somme(de("jeu-", ".js"), br) },
  "jeu : CSS": { gz: somme(de("jeu-", ".css"), gz), br: somme(de("jeu-", ".css"), br) },
  "jeu : polices (woff2)": { gz: somme(fichiers.filter((f) => f.endsWith(".woff2")), (b) => b.length), br: somme(fichiers.filter((f) => f.endsWith(".woff2")), (b) => b.length) },
  "physique : JS de Rapier": { gz: somme(rapierJs, gz), br: somme(rapierJs, br) },
  "physique : rapier.wasm": { gz: somme(de("rapier-", ".wasm"), gz), br: somme(de("rapier-", ".wasm"), br) },
  "anglais (à la demande)": { gz: somme(de("catalogue.en-", ".js"), gz), br: somme(de("catalogue.en-", ".js"), br) },
};
for (const [nom, v] of Object.entries(lignes)) console.log(`${nom.padEnd(32)} gzip ${String(v.gz).padStart(9)} o   brotli ${String(v.br).padStart(9)} o`);
const total = (cle) => Object.entries(lignes).filter(([n]) => !n.startsWith("anglais")).reduce((s, [, v]) => s + v[cle], 0);
console.log(`${"TOTAL (sans l'anglais)".padEnd(32)} gzip ${String(total("gz")).padStart(9)} o   brotli ${String(total("br")).padStart(9)} o`);
