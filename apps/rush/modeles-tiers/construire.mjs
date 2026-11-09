// Les MODÈLES TIERS de Rush (lot BR-A3), de bout en bout, sur la machine qui a les packs (jamais en CI : les packs ne sont que là ; seuls les `.glb` compressés de l'étape 3 se commitent, décision de Nathan du 2026-11-09, docs/rush/licences-tiers.md) :
//  1. EXTRACTION : les fichiers utiles de chaque .unitypackage (`sources.json`) dans `.brut/<pack>/` (`extraire.py`, Python sans site : `python -I`) ;
//  2. BLENDER : un script par modèle (`golem.py`, …) → `build/<nom>.glb` non compressé (`construire.py`) ;
//  3. GLTFPACK : la compression (meshopt, quantification, clips compris) dans `apps/rush/public/modeles-tiers/<nom>.glb` (commités) ; le jeu les charge s'ils sont là (sinon : les formes procédurales).
//   npm run modeles-tiers -w @cdj/rush [-- golem gelee] [-- --vignettes] [-- --sans-extraction] [-- --sans-blender]
// Variables : BLENDER (sinon le chemin habituel de Windows), RUSH_ASSET_STORE (sinon %APPDATA%/Unity/Asset Store-5.x), PYTHON (sinon `python`).
// gltfpack 1.1.0 par `npx` (aucune dépendance ajoutée), comme pour les modèles du lot BR-A1 : `-cc` (meshopt), `-kn` (nœuds nommés), `-km`, et les textures gardées en PNG (la version WASI de gltfpack ne compresse pas les textures : README du lot).
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const ICI = dirname(fileURLToPath(import.meta.url));
const BUILD = join(ICI, "build");
const BRUT = join(ICI, ".brut");
const PUBLIC = resolve(ICI, "../public/modeles-tiers");
const GLTFPACK = "gltfpack@1.1.0";
const BLENDER = process.env.BLENDER ?? "C:/Program Files/Blender Foundation/Blender 5.1/blender.exe";
const STORE = process.env.RUSH_ASSET_STORE ?? join(process.env.APPDATA ?? "", "Unity", "Asset Store-5.x");
const PYTHON = process.env.PYTHON ?? "python";
const MODELES = ["golem", "gelee", "chauve-souris", "chevalier"];

const args = process.argv.slice(2);
const noms = args.filter((a) => !a.startsWith("--"));
const choisis = noms.length ? noms : MODELES;
const sources = JSON.parse(readFileSync(join(ICI, "sources.json"), "utf8"));

if (!args.includes("--sans-extraction")) {
  for (const [id, p] of Object.entries(sources.packs)) {
    const paquet = join(STORE, ...p.paquet.split("/"));
    if (!existsSync(paquet)) throw new Error(`pack introuvable : ${paquet} (RUSH_ASSET_STORE ?)`);
    console.log(`[tiers] extraction de ${id}`);
    execFileSync(PYTHON, ["-I", join(ICI, "extraire.py"), paquet, join(BRUT, id), ...p.motifs], { stdio: ["ignore", "ignore", "inherit"] });
  }
}
if (!args.includes("--sans-blender")) {
  execFileSync(BLENDER, ["-b", "--factory-startup", "--python-exit-code", "1", "-P", join(ICI, "construire.py"), "--", ...choisis, ...args.filter((a) => a === "--vignettes")], { stdio: ["ignore", "inherit", "inherit"] });
}
mkdirSync(PUBLIC, { recursive: true });
const rapport = JSON.parse(readFileSync(join(BUILD, "rapport.json"), "utf8"));
const mesures = existsSync(join(BUILD, "mesures.json")) ? JSON.parse(readFileSync(join(BUILD, "mesures.json"), "utf8")) : {};
for (const nom of choisis) {
  const entree = join(BUILD, `${nom}.glb`);
  const sortie = join(PUBLIC, `${nom}.glb`);
  // gltfpack (WASI) veut des chemins absolus à barres obliques ; sous Windows il finit parfois sur une assertion de libuv APRÈS avoir écrit : on juge sur le fichier écrit.
  rmSync(sortie, { force: true });
  const r = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", ["--yes", GLTFPACK, "-i", entree.replaceAll("\\", "/"), "-o", sortie.replaceAll("\\", "/"), "-cc", "-kn", "-km"], { stdio: "pipe", shell: process.platform === "win32" });
  if (!existsSync(sortie) || statSync(sortie).size < 64) throw new Error(`gltfpack n'a pas écrit ${sortie} : ${r.stderr?.toString() ?? ""}`);
  const brut = statSync(entree).size;
  const compresse = statSync(sortie).size;
  const gzip = gzipSync(readFileSync(sortie), { level: 9 }).length;
  const m = rapport[nom] ?? {};
  mesures[nom] = { triangles: m.triangles, os: m.os, clips: Object.keys(m.clips ?? {}).length, hauteur: m.hauteur, echelle: m.echelle, texture: m.texture, brut, compresse, gzip };
}
writeFileSync(join(BUILD, "mesures.json"), JSON.stringify(mesures, null, 1));
console.log("| modèle | triangles | os | clips | hauteur | texture | glb brut | compressé | gzip |\n|---|---|---|---|---|---|---|---|---|");
for (const [n, m] of Object.entries(mesures))
  console.log(`| ${n} | ${m.triangles} | ${m.os} | ${m.clips} | ${m.hauteur?.toFixed(2)} m | ${m.texture?.join(" × ")} | ${(m.brut / 1024).toFixed(1)} Ko | ${(m.compresse / 1024).toFixed(1)} Ko | ${(m.gzip / 1024).toFixed(1)} Ko |`);
const total = Object.values(mesures).reduce((s, m) => s + m.gzip, 0);
console.log(`total gzip : ${(total / 1024).toFixed(1)} Ko`);
