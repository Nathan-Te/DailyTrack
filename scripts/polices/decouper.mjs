// Lot B1 (plateforme) — LA DÉCOUPE DES POLICES, lancée **à la main, une fois** (et de nouveau le jour où un caractère nouveau entre dans un catalogue ou un écran) :
//   node scripts/polices/decouper.mjs            → réduit chaque police d'origine (packages/ui/polices/originaux/*.woff2, copiées des paquets @fontsource) aux caractères utilisés
//                                                  (scripts/polices/caracteres.mjs : français et anglais) et écrit les fichiers servis dans packages/ui/polices/ (mêmes noms : les
//                                                  feuilles `@font-face` ne changent pas) + packages/ui/polices/decoupe.json (octets avant / après, empreintes, glyphes gardés).
//   node scripts/polices/decouper.mjs --liste    → montre le jeu de caractères (ce qu'on garde), sans rien écrire.
// **Outil hors du projet, pas une dépendance** : `pyftsubset` de fonttools, avec le module `brotli` pour écrire du woff2 (`pip install fonttools brotli`). Les fichiers découpés sont versés au
// dépôt, et les originaux restent à côté (`originaux/`) : on peut toujours refaire la découpe avec un autre jeu. Ce qui est gardé tel quel : toutes les tables de composition (kern, liga,
// calt, tnum…), les noms et la licence (SIL OFL), le dessin (hinting inchangé) — **rien ne change à l'écran** pour les caractères gardés. Un caractère qui n'est pas dans le jeu s'affiche avec
// la police de repli (comme un caractère qu'une police n'a jamais eu).
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { jeuDeCaracteres, pointsDeCode } from "./caracteres.mjs";

const POLICES = resolve(dirname(fileURLToPath(import.meta.url)), "../../packages/ui/polices");
const sha = (f) => createHash("sha256").update(readFileSync(f)).digest("hex");

const jeu = jeuDeCaracteres();
const unicodes = pointsDeCode(jeu).map((c) => `U+${c.toString(16)}`).join(",");

if (process.argv.includes("--liste")) {
  console.log(`${jeu.size} caractères :\n${[...jeu].filter((c) => c.codePointAt(0) > 0x7e).join(" ")}`);
  process.exit(0);
}

const version = spawnSync("pyftsubset", ["--help"], { encoding: "utf8" });
if (version.error) {
  console.error("pyftsubset est introuvable : `pip install fonttools brotli` (outil hors du projet, pas une dépendance).");
  process.exit(1);
}
const fonttools = execFileSync("python3", ["-c", "import fontTools, brotli; print(fontTools.version)"], { encoding: "utf8" }).trim();

// Lot K5 — `--seulement=<morceau du nom>` : ne découpe que les polices dont le nom contient ce morceau et laisse les autres lignes de `decoupe.json` (et leurs fichiers) intactes — ajouter une face ne
// change l'empreinte d'aucune autre. Les découpes « profil » (plus bas) sont toujours refaites.
const seulement = process.argv.find((a) => a.startsWith("--seulement="))?.slice("--seulement=".length);
const ancien = seulement ? JSON.parse(readFileSync(join(POLICES, "decoupe.json"), "utf8")) : null;
const resultats = ancien ? ancien.polices.filter((r) => !r.fichier.includes(seulement)) : [];
for (const f of readdirSync(join(POLICES, "originaux")).filter((x) => x.endsWith(".woff2") && (!seulement || x.includes(seulement))).sort()) {
  const source = join(POLICES, "originaux", f);
  const sortie = join(POLICES, f);
  execFileSync("pyftsubset", [source, `--unicodes=${unicodes}`, "--flavor=woff2", "--layout-features=*", "--name-IDs=*", "--notdef-outline", `--output-file=${sortie}`], { stdio: "inherit" });
  resultats.push({ fichier: f, avant: statSync(source).size, apres: statSync(sortie).size, sha256: sha(sortie) });
  console.log(`${f} : ${resultats.at(-1).avant} → ${resultats.at(-1).apres} o`);
}
// Lot K5 — **les découpes « profil »** : hors du jeu (le profil commun, les cartouches compactes) la voix d'un jeu n'écrit que son nom, un numéro, des chiffres : les capitales, les chiffres, l'espace et quelques signes
// (de l'ordre de 3 à 4 Ko au lieu de 10 : seul le crénage est gardé, sans les instructions de hinting). Elles sont servies depuis `polices/profil/` (même nom que l'original) et décrites dans `decoupe.json` (`profil`). Une police de jeu s'y ajoute en nommant son fichier ici.
const PROFIL = ["rubik-mono-one-latin-400-normal.woff2", "bungee-latin-400-normal.woff2"];
const CARACTERES_PROFIL = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -'·.:", ...Array.from({ length: 0xde - 0xc0 + 1 }, (_, i) => String.fromCodePoint(0xc0 + i)).filter((c) => c !== "×"), "Œ"];
const unicodesProfil = CARACTERES_PROFIL.map((c) => `U+${c.codePointAt(0).toString(16)}`).join(",");
mkdirSync(join(POLICES, "profil"), { recursive: true });
const profil = [];
for (const f of PROFIL) {
  const source = join(POLICES, "originaux", f);
  const sortie = join(POLICES, "profil", f);
  execFileSync("pyftsubset", [source, `--unicodes=${unicodesProfil}`, "--flavor=woff2", "--layout-features=kern", "--no-hinting", "--name-IDs=*", "--notdef-outline", `--output-file=${sortie}`], { stdio: "inherit" });
  profil.push({ fichier: f, avant: statSync(source).size, apres: statSync(sortie).size, sha256: sha(sortie) });
  console.log(`profil/${f} : ${profil.at(-1).avant} → ${profil.at(-1).apres} o`);
}
const total = (k) => resultats.reduce((n, r) => n + r[k], 0);
writeFileSync(join(POLICES, "decoupe.json"), JSON.stringify({ outil: `pyftsubset (fonttools ${fonttools})`, caracteres: jeu.size, polices: resultats, profil: { caracteres: CARACTERES_PROFIL.length, polices: profil } }, null, 2) + "\n");
console.log(`${resultats.length} polices : ${total("avant")} → ${total("apres")} o (${total("avant") - total("apres")} o de moins)`);
