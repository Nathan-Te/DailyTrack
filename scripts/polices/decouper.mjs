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
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
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

const resultats = [];
for (const f of readdirSync(join(POLICES, "originaux")).filter((x) => x.endsWith(".woff2")).sort()) {
  const source = join(POLICES, "originaux", f);
  const sortie = join(POLICES, f);
  execFileSync("pyftsubset", [source, `--unicodes=${unicodes}`, "--flavor=woff2", "--layout-features=*", "--name-IDs=*", "--notdef-outline", `--output-file=${sortie}`], { stdio: "inherit" });
  resultats.push({ fichier: f, avant: statSync(source).size, apres: statSync(sortie).size, sha256: sha(sortie) });
  console.log(`${f} : ${resultats.at(-1).avant} → ${resultats.at(-1).apres} o`);
}
const total = (k) => resultats.reduce((n, r) => n + r[k], 0);
writeFileSync(join(POLICES, "decoupe.json"), JSON.stringify({ outil: `pyftsubset (fonttools ${fonttools})`, caracteres: jeu.size, polices: resultats }, null, 2) + "\n");
console.log(`${resultats.length} polices : ${total("avant")} → ${total("apres")} o (${total("avant") - total("apres")} o de moins)`);
