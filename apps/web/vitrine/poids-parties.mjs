// Lot 38 — le poids de chaque partie d'une direction **si elle entrait dans le jeu** : `node apps/web/vitrine/poids-parties.mjs`.
// Chaque partie est empaquetée seule (esbuild, minifiée, puis gzip), en laissant dehors ce que le premier chargement du jeu contient déjà (three.js,
// la simulation, `trackMesh.ts`, `trackProps.ts`, `meshKit.ts`, `signage.ts`, `speedFeel.ts`, `halo.ts`) : le chiffre est le code **ajouté**. Les parties
// partagent du code (outils, pièces) : la somme des parties dépasse un peu le poids de leur réunion, qui est donné aussi. Méthode du README du lot 38.
//
// Retouche 38b : les paliers. Le palier 1 se mesure **sans les modules des pas** (remplacés par des modules vides : un lot de mise en œuvre les
// charge à la demande, avant de construire, quand un pas est allumé) ; chaque pas se mesure seul, le palier 1 laissé dehors (déjà là). Les passes de
// post-traitement de three.js (`three/examples/jsm`) ne sont pas dans le jeu : elles comptent. `construire.mjs` écrit le résultat dans
// `dist/vitrine/poids-parties.json`, que la vitrine affiche.
import { build } from "esbuild";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const SCENE = fileURLToPath(new URL("../src/scene/", import.meta.url));
// Déjà dans le premier chargement du jeu : laissés dehors.
const DEJA = ["three", "@cdj/sim", "*/trackMesh", "*/trackProps", "*/meshKit", "*/signage", "*/speedFeel", "*/halo"];
/** Les modules des pas (retouche 38b) : hors du palier 1. */
const PAS = ["finition", "matiere", "matiereDetaillee", "bruit", "reflets", "lumiere3", "vie", "post"];
/** Le palier 1 et ce qu'il tire (lot 38 compris) : déjà là quand on mesure un pas. */
const PALIER1 = ["composerPalier", "palier1", "paliers", "memoire", "composer", "route", "outils", "pieces", "types", "origine", "directionA", "directionB", "directionC", "directionM", "textures"];

/** Les parties : un nom, le module de src/scene, les noms qu'on en importe ; options : entrée écrite, garder trackMesh, modules vides, dehors. */
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
  ["Mélange : premier chargement complet (socle + piste + lumière de C + ce qu'il garde de trackMesh.ts et trackProps.ts)", null, ["PISTE_M", "appliquerLumiereC", "composerScene", "construireRoute"], { entree: `import { PISTE_M } from "./directionM"; import { appliquerLumiereC } from "./directionC"; import { composerScene } from "./composer"; import { construireRoute } from "./route";`, garder: true }],
  ["Existant : le socle, trackMesh.ts et trackProps.ts (dans le premier chargement aujourd'hui)", null, ["buildTrackScene"], { entree: `import { buildTrackScene } from "./socle";`, garder: true }],
  // --- Retouche 38b : les paliers ---
  ["Palier 1 : tout (compositeur des paliers, direction P, route, lumière et matière de C, décor, ce qu'il garde de trackMesh.ts et trackProps.ts), sans les modules des pas", "composerPalier", ["composerPalier"], { garder: true, vides: PAS }],
  ["Palier 1 : décor (tribune, recettes de B allégées, atlas des sponsors) — à la demande dans le jeu", "palier1", ["decorP", "atlasB"], { entree: `import { decorP } from "./palier1"; import { atlasB } from "./directionB";`, vides: PAS, dehors: ["composer", "route", "outils", "pieces", "types", "origine", "directionA", "composerPalier", "paliers", "memoire"] }],
  ["Palier 2 — géométrie et variété (finition.ts)", "finition", ["boulons", "coins", "hauban", "cablePendant", "pneusEmpiles", "banderole", "Drapeaux", "colonneChanfreinee", "marque", "varierInstance", "varierParPosition", "teinteVoisine"], { dehors: PALIER1 }],
  ["Palier 2 — matière (matiere.ts, bruit.ts : matière sobre, variation de teinte large, traces et marquages)", "matiere", ["matiereAsphalte", "matiereBeton", "matiereMetal", "matiereDecor", "teinteLarge", "tracesEtMarquages", "matieresDessinees"], { dehors: PALIER1 }],
  ["Palier 2 — matière détaillée (matiereDetaillee.ts : l'ancienne matière du 38b, comparaison seulement, matiere.ts et bruit.ts laissés dehors)", "matiereDetaillee", ["detailleeAsphalte", "detailleeBeton", "detailleeMetal", "detailleeDecor", "carteDeNormales"], { dehors: [...PALIER1, "matiere", "bruit"] }],
  ["Palier 2 — reflets (reflets.ts : carte d'environnement du ciel)", "reflets", ["carteEnvironnement"], { dehors: PALIER1 }],
  ["Palier 3 — lumière (lumiere3.ts : brume de profondeur, ciel et nuages, réglages par thème)", "lumiere3", ["THEMES_3", "brumeDeProfondeur", "uniformesBrume", "domeDuCiel"], { dehors: PALIER1 }],
  ["Palier 3 — vie (vie.ts : drapeaux, foule, écrans, chronomètre, particules)", "vie", ["drapeauxAnimes", "fouleInstanciee", "rubanDesEcrans", "Chronometre", "maillageEcrans", "particules"], { dehors: [...PALIER1, "lumiere3"] }],
  ["Palier 3 — post-traitement (post.ts et les passes de three.js : occlusion GTAO, halo, sortie, étalonnage, SMAA)", "post", ["ChainePost"], { dehors: [...PALIER1, "lumiere3"] }],
  ["Palier 3 — post : occlusion seule (GTAOPass)", null, ["GTAOPass"], { entree: `import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";` }],
  ["Palier 3 — post : halo seul (UnrealBloomPass)", null, ["UnrealBloomPass"], { entree: `import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";` }],
  ["Palier 3 — post : anticrénelage seul (SMAAPass, ses deux textures comprises)", null, ["SMAAPass"], { entree: `import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";` }],
  ["Palier 3 — post : sortie et étalonnage (OutputPass, ShaderPass)", null, ["OutputPass", "ShaderPass"], { entree: `import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js"; import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";` }],
  ["Pour comparer : FXAA (FXAAPass), un anticrénelage plus léger que SMAA", null, ["FXAAPass"], { entree: `import { FXAAPass } from "three/examples/jsm/postprocessing/FXAAPass.js";` }],
];

/** Un module vide qui exporte les mêmes noms (le palier 1 mesuré sans les modules des pas). */
function moduleVide(chemin) {
  const src = readFileSync(chemin, "utf8");
  const noms = [...src.matchAll(/^export (?:async )?(?:function|const|class|let) (\w+)/gm)].map((m) => m[1]);
  return noms.map((n) => `export const ${n} = undefined;`).join("\n");
}

async function poids(module, noms, o = {}) {
  const usages = noms.map((n) => `console.log(${n});`).join("\n");
  const vides = new RegExp(`/(${(o.vides ?? []).join("|") || "\\0"})$`);
  const dehors = new RegExp(`/(${(o.dehors ?? []).join("|") || "\\0"})$`);
  const r = await build({
    stdin: { contents: `${o.entree ?? `import { ${noms.join(", ")} } from "./${module}";`}\n${usages}`, resolveDir: SCENE, loader: "ts" },
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
            if (!o.garder && /\/(trackMesh|trackProps)$/.test(a.path)) return { path: a.path, external: true };
            if (vides.test(a.path)) return { path: join(a.resolveDir, `${a.path}.ts`), namespace: "vide" };
            if (dehors.test(a.path)) return { path: a.path, external: true };
            return undefined;
          });
          b.onLoad({ filter: /.*/, namespace: "vide" }, (a) => ({ contents: moduleVide(a.path), loader: "js" }));
        },
      },
    ],
  });
  return gzipSync(r.outputFiles[0].contents).length;
}

/** Toutes les parties : `[nom, octets gzip]`. */
export async function mesurerParties() {
  const lignes = [];
  for (const [nom, module, noms, o] of PARTIES) lignes.push([nom, await poids(module, noms, o)]);
  return lignes;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const lignes = await mesurerParties();
  const larg = Math.max(...lignes.map(([n]) => n.length));
  console.log(`Poids ajouté au jeu, JS compressé (gzip), hors ${DEJA.join(", ")} :`);
  for (const [nom, o] of lignes) console.log(`  ${nom.padEnd(larg)}  ${(o / 1024).toFixed(1).replace(".", ",")} ko (${o} o)`);
}
