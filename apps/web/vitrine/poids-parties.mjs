// Lot 38 — le poids de chaque partie d'une direction **si elle entrait dans le jeu** : `node apps/web/vitrine/poids-parties.mjs`.
// Chaque partie est empaquetée seule (esbuild, minifiée, puis gzip), en laissant dehors ce que le premier chargement du jeu contient déjà (three.js,
// la simulation, `trackMesh.ts`, `trackProps.ts`, `meshKit.ts`, `signage.ts`, `speedFeel.ts`, `halo.ts`) : le chiffre est le code **ajouté**. Les parties
// partagent du code (outils, pièces) : la somme des parties dépasse un peu le poids de leur réunion, qui est donné aussi. Méthode du README du lot 38.
import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const SCENE = fileURLToPath(new URL("../src/scene/", import.meta.url));
// Déjà dans le premier chargement du jeu : laissés dehors.
const DEJA = ["three", "@cdj/sim", "*/trackMesh", "*/trackProps", "*/meshKit", "*/signage", "*/speedFeel", "*/halo"];

/** Les parties : un nom, le module de src/scene et les noms qu'on en importe. */
const PARTIES = [
  ["socle : route paramétrable (remplacerait la route de trackMesh.ts)", "route", ["construireRoute", "STYLE_ORIGINE"]],
  ["socle : compositeur (remplacerait le squelette de buildTrackScene)", "composer", ["composerScene"]],
  ["socle : outils, pièces, types, horizons", "pieces", ["MARQUE", "textureBandeau", "bandeau", "damierSol", "chevronSol"]],
  ["A : route (rebords, vibreurs, lignes)", "directionA", ["routeA"]],
  ["A : éléments (portiques, porte, plaques, panneaux, rythme)", "directionA", ["portiqueDepart", "arrivee", "porte", "plaqueA", "panneau", "rythme"]],
  ["A : palettes et ambiance", "directionA", ["THEMES_A", "ambianceA"]],
  ["A : décor (tribune, recettes)", "directionA", ["decor"]],
  ["A : tout", "directionA", ["DIRECTION_A"]],
  ["B : rebords par thème", "directionB", ["routeB"]],
  ["B : éléments (treillis, feux, arche, plaques, panneaux, rythme)", "directionB", ["portiqueDepartB", "arriveeB", "porteB", "plaqueB", "panneauB", "rythmeB"]],
  ["B : atlas des sponsors", "directionB", ["atlasB"]],
  ["B : décor (tribune, recettes)", "directionB", ["RECETTES_B", "tribuneB"]],
  ["B : tout", "directionB", ["DIRECTION_B"]],
  ["C : lumière (ciel, brume, lumières, ombres, exposition)", "directionC", ["appliquerLumiereC"]],
  ["C : matière (occlusion, grain, sol, ombres de contact, lampes de nuit)", "directionC", ["appliquerMatiereC"]],
  ["C : tout", "directionC", ["appliquerC"]],
  ["Mélange : piste (premier chargement : route, rebords, éléments, feux, horizons)", "directionM", ["PISTE_M"]],
  ["Mélange : décor (à la demande : tribune, recettes de B allégées, atlas)", "directionM", ["DECOR_M"]],
  ["Mélange : tout (sans la lumière de C)", "directionM", ["DIRECTION_M"]],
  // Le premier chargement du mélange, tout compris (socle, piste, lumière de C, et ce qu'il garde de trackMesh.ts et trackProps.ts : palettes,
  // ambiances, glyphes des panneaux), et ce qu'il remplacerait dans le jeu : les deux lignes se comparent telles quelles.
  ["Mélange : premier chargement complet (socle + piste + lumière de C + ce qu'il garde de trackMesh.ts et trackProps.ts)", null, ["PISTE_M", "appliquerLumiereC", "composerScene", "construireRoute"], `import { PISTE_M } from "./directionM"; import { appliquerLumiereC } from "./directionC"; import { composerScene } from "./composer"; import { construireRoute } from "./route";`, true],
  ["Existant : trackMesh.ts et trackProps.ts (dans le premier chargement aujourd'hui)", null, ["buildTrackScene"], `import { buildTrackScene } from "../trackMesh";`, true],
];

async function poids(module, noms, entree, garder = false) {
  const usages = noms.map((n) => `console.log(${n});`).join("\n");
  const r = await build({
    stdin: { contents: `${entree ?? `import { ${noms.join(", ")} } from "./${module}";`}\n${usages}`, resolveDir: SCENE, loader: "ts" },
    bundle: true,
    minify: true,
    format: "esm",
    write: false,
    treeShaking: true,
    target: "es2022",
    logLevel: "silent",
    plugins: [
      {
        name: "deja",
        setup(b) {
          b.onResolve({ filter: /.*/ }, (a) => {
            if (a.path === "three" || a.path.startsWith("@cdj/")) return { path: a.path, external: true };
            if (/\/(meshKit|signage|speedFeel|halo|labels)$/.test(a.path)) return { path: a.path, external: true };
            if (!garder && /\/(trackMesh|trackProps)$/.test(a.path)) return { path: a.path, external: true };
            return undefined;
          });
        },
      },
    ],
  });
  return gzipSync(r.outputFiles[0].contents).length;
}

const lignes = [];
for (const [nom, module, noms, entree, garder] of PARTIES) lignes.push([nom, await poids(module, noms, entree, garder)]);
const larg = Math.max(...lignes.map(([n]) => n.length));
console.log(`Poids ajouté au jeu, JS compressé (gzip), hors ${DEJA.join(", ")} :`);
for (const [nom, o] of lignes) console.log(`  ${nom.padEnd(larg)}  ${(o / 1024).toFixed(1).replace(".", ",")} ko (${o} o)`);
