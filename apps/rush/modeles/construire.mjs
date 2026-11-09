// Les MODÈLES de Rush (lot BR-A1), de bout en bout : Blender construit chaque modèle par son script (`construire.py`, un script par modèle) et l'exporte en glTF binaire NON compressé dans `build/`, puis gltfpack le
// compresse (meshopt, quantification) dans `apps/rush/public/modeles/<nom>.glb`, la partie chargée à la demande. Le tableau (triangles, poids brut, compressé, gzip) est écrit dans `build/mesures.json` et affiché.
//   npm run modeles -w @cdj/rush [-- golem gelee] [-- --vignettes] [-- --blend] [-- --sans-blender]
// Blender : la variable BLENDER, sinon le chemin habituel de Windows. gltfpack : la version 1.1.0, comme le décodeur de Three.js (`meshopt_decoder.module.js`, construit depuis meshoptimizer 1.1), par `npx` (aucune dépendance
// ajoutée au dépôt). Les options : `-cc` (la compression meshopt la plus forte), `-kn` (garder les nœuds nommés : les PIÈCES), `-km`.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const ICI = dirname(fileURLToPath(import.meta.url));
const BUILD = join(ICI, "build");
const PUBLIC = resolve(ICI, "../public/modeles");
const GLTFPACK = "gltfpack@1.1.0";
const BLENDER = process.env.BLENDER ?? "C:/Program Files/Blender Foundation/Blender 5.1/blender.exe";

const args = process.argv.slice(2);
const noms = args.filter((a) => !a.startsWith("--"));
if (!args.includes("--sans-blender")) {
  execFileSync(BLENDER, ["-b", "--factory-startup", "-P", join(ICI, "construire.py"), "--", ...noms, ...args.filter((a) => a === "--vignettes" || a === "--blend")], { stdio: ["ignore", "inherit", "inherit"] });
}
mkdirSync(PUBLIC, { recursive: true });
const rapport = JSON.parse(readFileSync(join(BUILD, "rapport.json"), "utf8"));
const fichiers = readdirSync(BUILD).filter((f) => f.endsWith(".glb") && (noms.length === 0 || noms.includes(f.slice(0, -4))));
const mesures = existsSync(join(BUILD, "mesures.json")) ? JSON.parse(readFileSync(join(BUILD, "mesures.json"), "utf8")) : {};
for (const f of fichiers) {
  const nom = f.slice(0, -4);
  const entree = join(BUILD, f);
  const sortie = join(PUBLIC, f);
  // gltfpack (WASI) veut des chemins absolus à barres obliques. Sous Windows, son processus finit parfois sur une assertion de libuv APRÈS avoir écrit le fichier : on juge sur le fichier écrit, pas sur le code de retour.
  rmSync(sortie, { force: true });
  const r = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", ["--yes", GLTFPACK, "-i", entree.replaceAll("\\", "/"), "-o", sortie.replaceAll("\\", "/"), "-cc", "-kn", "-km"], { stdio: "pipe", shell: process.platform === "win32" });
  if (!existsSync(sortie) || statSync(sortie).size < 64) throw new Error(`gltfpack n'a pas écrit ${sortie} : ${r.stderr?.toString() ?? ""}`);
  const brut = statSync(entree).size;
  const compresse = statSync(sortie).size;
  const gzip = gzipSync(readFileSync(sortie), { level: 9 }).length;
  mesures[nom] = { triangles: rapport[nom]?.triangles ?? mesures[nom]?.triangles, pieces: rapport[nom]?.pieces ?? mesures[nom]?.pieces, brut, compresse, gzip };
}
writeFileSync(join(BUILD, "mesures.json"), JSON.stringify(mesures, null, 1));
const ligne = (n, m) => `| ${n} | ${m.triangles} | ${(m.brut / 1024).toFixed(1)} Ko | ${(m.compresse / 1024).toFixed(1)} Ko | ${(m.gzip / 1024).toFixed(1)} Ko |`;
console.log("| modèle | triangles | glb brut | compressé | gzip |\n|---|---|---|---|---|");
for (const [n, m] of Object.entries(mesures)) console.log(ligne(n, m));
const total = Object.values(mesures).reduce((s, m) => s + m.gzip, 0);
console.log(`total gzip : ${(total / 1024).toFixed(1)} Ko`);
