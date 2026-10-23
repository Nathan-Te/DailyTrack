// Lot 38 — le poids de chaque partie de la scène **si elle entrait dans le jeu** : `node apps/web/vitrine/poids-parties.mjs` (lot 44 : les directions
// du lot 38 sont parties ; le décor du palier 1 est mesuré thème par thème — la mesure qui fait foi est celle du jeu construit, `e2e/mesureDecor.mjs`).
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
const PAS = ["finition", "drapeaux", "matiere", "bruit", "reflets", "lumiere3", "vie", "post", "vieJeu", "cielJeu", "ombres3"];
/** Le palier 1 et ce qu'il tire (lot 38 compris) : déjà là quand on mesure un pas. */
const PALIER1 = ["composerPalier", "palier1", "piste", "sponsors", "composerP1", "paliers", "memoire", "ciel", "lumiere", "route", "outils", "pieces", "types", "textures", "decor", "decor/commun", "decor/matiereC"];

/** Les parties : un nom, le module de src/scene, les noms qu'on en importe ; options : entrée écrite, garder trackMesh, modules vides, dehors. */
const PARTIES = [
  ["socle : route paramétrable", "route", ["construireRoute", "STYLE_ORIGINE"]],
  ["socle : outils, pièces, types, horizons", "pieces", ["MARQUE", "textureBandeau", "bandeau", "damierSol", "chevronSol"]],
  ["Existant : trackMesh.ts, trackProps.ts et l'assemblage (scene/existant.ts : à la demande depuis le lot 43)", null, ["composerExistant"], { entree: `import { composerExistant } from "./existant";`, garder: true }],
  // Lot 43 : la scène du jeu, au palier 1, dans le premier chargement (compositeur, piste, éléments, lumière de C, le décor d'aujourd'hui).
  ["Palier 1 du jeu (lots 43 et 44) : composerP1, palier1, piste, route, lumière de C, registre du décor", null, ["composerP1", "chargerDecor"], { entree: `import { composerP1 } from "./composerP1"; import { chargerDecor } from "./decor";`, garder: true, dehors: ["decor/stade", "decor/rallye", "decor/banquise", "decor/nuit", "decor/campagne", "decor/canyon", "decor/col", "decor/ville"] }],
  // --- Retouche 38b : les paliers ---
  ["Palier 1 : tout (compositeur des paliers, direction P, route, lumière et matière de C, décor, ce qu'il garde de trackMesh.ts et trackProps.ts), sans les modules des pas", "composerPalier", ["composerPalier"], { garder: true, vides: PAS }],
  // Lot 44 : le décor du palier 1 dans le jeu, à la demande : le morceau commun (sol relevé, pose, tribune, pièces, matière de C), puis chaque thème.
  ["Palier 1 : décor du jeu, morceau commun (decor/commun.ts, decor/matiereC.ts) — à la demande", null, ["moduleDecor"], { entree: `import { moduleDecor } from "./decor/commun";`, dehors: PALIER1.filter((m) => m !== "decor/commun" && m !== "decor/matiereC" && m !== "decor") }],
  ["Palier 1 : décor du jeu, Stade (decor/stade.ts ; decor/commun.ts laissé dehors) — à la demande", null, ["DECOR"], { entree: `import { DECOR } from "./decor/stade";`, dehors: [...PALIER1.filter((m) => m !== "decor/commun" && m !== "decor/matiereC"), "commun"].filter((m) => m !== "decor"), garder: false }],
  ["Palier 1 : décor du jeu, Rallye (decor/rallye.ts ; decor/commun.ts laissé dehors) — à la demande", null, ["DECOR"], { entree: `import { DECOR } from "./decor/rallye";`, dehors: [...PALIER1.filter((m) => m !== "decor/commun" && m !== "decor/matiereC"), "commun"].filter((m) => m !== "decor"), garder: false }],
  ["Palier 1 : décor du jeu, Banquise (decor/banquise.ts ; decor/commun.ts laissé dehors) — à la demande", null, ["DECOR"], { entree: `import { DECOR } from "./decor/banquise";`, dehors: [...PALIER1.filter((m) => m !== "decor/commun" && m !== "decor/matiereC"), "commun"].filter((m) => m !== "decor"), garder: false }],
  ["Palier 1 : décor du jeu, Nuit (decor/nuit.ts ; decor/commun.ts laissé dehors) — à la demande", null, ["DECOR"], { entree: `import { DECOR } from "./decor/nuit";`, dehors: [...PALIER1.filter((m) => m !== "decor/commun" && m !== "decor/matiereC"), "commun"].filter((m) => m !== "decor"), garder: false }],
  ["Palier 1 : décor du jeu, Campagne (decor/campagne.ts ; decor/commun.ts laissé dehors) — à la demande", null, ["DECOR"], { entree: `import { DECOR } from "./decor/campagne";`, dehors: [...PALIER1.filter((m) => m !== "decor/commun" && m !== "decor/matiereC"), "commun"].filter((m) => m !== "decor"), garder: false }],
  ["Palier 1 : décor du jeu, Canyon (decor/canyon.ts ; decor/commun.ts laissé dehors) — à la demande", null, ["DECOR"], { entree: `import { DECOR } from "./decor/canyon";`, dehors: [...PALIER1.filter((m) => m !== "decor/commun" && m !== "decor/matiereC"), "commun"].filter((m) => m !== "decor"), garder: false }],
  ["Palier 1 : décor du jeu, Col (decor/col.ts ; decor/commun.ts laissé dehors) — à la demande", null, ["DECOR"], { entree: `import { DECOR } from "./decor/col";`, dehors: [...PALIER1.filter((m) => m !== "decor/commun" && m !== "decor/matiereC"), "commun"].filter((m) => m !== "decor"), garder: false }],
  ["Palier 1 : décor du jeu, Ville (decor/ville.ts ; decor/commun.ts laissé dehors) — à la demande", null, ["DECOR"], { entree: `import { DECOR } from "./decor/ville";`, dehors: [...PALIER1.filter((m) => m !== "decor/commun" && m !== "decor/matiereC"), "commun"].filter((m) => m !== "decor"), garder: false }],
  ["Palier 2 — géométrie et variété (finition.ts)", "finition", ["boulons", "coins", "hauban", "cablePendant", "pneusEmpiles", "banderole", "Drapeaux", "colonneChanfreinee", "marque", "varierInstance", "varierParPosition", "teinteVoisine"], { dehors: PALIER1 }],
  ["Palier 2 — matière (matiere.ts, bruit.ts : matière sobre, variation de teinte large, traces et marquages)", "matiere", ["matiereAsphalte", "matiereBeton", "matiereMetal", "matiereDecor", "teinteLarge", "tracesEtMarquages", "matieresDessinees"], { dehors: PALIER1 }],
  ["Palier 2 — reflets (reflets.ts : carte d'environnement du ciel)", "reflets", ["carteEnvironnement"], { dehors: PALIER1 }],
  ["Palier 3 — lumière (lumiere3.ts : brume de profondeur, ciel et nuages, réglages par thème)", "lumiere3", ["CIEL_3", "brumeDeProfondeur", "uniformesBrume", "domeDuCiel"], { dehors: PALIER1 }],
  ["Palier 3 — vie (vie.ts : drapeaux, foule, écrans, chronomètre, particules)", "vie", ["drapeauxAnimes", "fouleAnimee", "rubanDesEcrans", "Chronometre", "maillageEcrans", "particules", "PARTICULES_3"], { dehors: [...PALIER1, "lumiere3"] }],
  // Lot 46 : les pas « vie », « ciel » et « ombres » du jeu (à la demande, ligne « vie et ciel à la demande » de budgets.md : 8 ko au plus ; la mesure qui fait foi
  // est celle des morceaux du jeu construit, `e2e/perf.spec.ts`). Le palier 1 du jeu est déjà là (premier chargement).
  ["Palier 3 du jeu (lot 46) — vie (vieJeu.ts, vie.ts, drapeaux.ts, réglages des thèmes)", "vieJeu", ["VIE"], { dehors: [...PALIER1, "socle"] }],
  ["Palier 3 du jeu (lot 46) — ciel (cielJeu.ts, lumiere3.ts, bruit.ts)", "cielJeu", ["CIEL"], { dehors: [...PALIER1, "socle"] }],
  ["Palier 3 du jeu (lot 46) — vie et ciel ensemble", null, ["VIE", "CIEL", "OMBRES"], { entree: `import { VIE } from "./vieJeu"; import { CIEL } from "./cielJeu"; import { OMBRES } from "./ombres3";`, dehors: [...PALIER1, "socle"] }],
  ["Palier 3 — post-traitement (post.ts et les passes de three.js : occlusion GTAO, halo, sortie, étalonnage, SMAA)", "post", ["ChainePost"], { dehors: [...PALIER1, "lumiere3"] }],
  ["Palier 3 — post : occlusion seule (GTAOPass)", null, ["GTAOPass"], { entree: `import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";` }],
  ["Palier 3 — post : halo seul (UnrealBloomPass)", null, ["UnrealBloomPass"], { entree: `import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";` }],
  ["Palier 3 — post : anticrénelage seul (SMAAPass, ses deux textures comprises)", null, ["SMAAPass"], { entree: `import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";` }],
  ["Palier 3 — post : sortie et étalonnage (OutputPass, ShaderPass)", null, ["OutputPass", "ShaderPass"], { entree: `import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js"; import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";` }],
  ["Pour comparer : FXAA (FXAAPass), un anticrénelage plus léger que SMAA", null, ["FXAAPass"], { entree: `import { FXAAPass } from "three/examples/jsm/postprocessing/FXAAPass.js";` }],
  // --- Lot 40 : la voiture. `carMesh.ts` et `voiture/pieces.ts` sont dans le premier chargement depuis la partie 1 : laissés dehors pour les modèles.
  ["Existant : carMesh.ts (la voiture du jeu, six maillages depuis le lot 40, avec voiture/pieces.ts)", null, ["createCarMesh"], { entree: `import { createCarMesh } from "../carMesh";` }],
  ["Voiture : pieces.ts seul (fusion des pièces, matériaux par sommet ; dans le premier chargement depuis la partie 1)", null, ["Pieces", "finiParSommet", "ombreDeRoue", "ombreDesFeux", "normalesLissees", "projeter"], { entree: `import { Pieces, finiParSommet, ombreDeRoue, ombreDesFeux, normalesLissees, projeter } from "../voiture/pieces";` }],
  ["Voiture : ce que la 40b garderait de carMesh.ts (ombre portée, constantes des roues)", null, ["createShadow", "placeShadow", "clampTravel", "WHEEL_RADIUS"], { entree: `import { createShadow, placeShadow, clampTravel, WHEEL_RADIUS } from "../carMesh";` }],
  ["Voiture : socle commun (forme, livrée et palette, constructeur, matériaux du palier 1)", null, ["construireVoiture", "MATERIAUX_1", "PALETTE"], { entree: `import { construireVoiture, MATERIAUX_1 } from "../voiture/modele"; import { PALETTE } from "../voiture/livree";`, dehors: ["carMesh", "pieces"] }],
  ["Voiture : le fantôme simple (dans le morceau du Salon, chargé à la demande)", null, ["construireFantome"], { entree: `import { construireFantome } from "../voiture/modele";`, dehors: ["carMesh", "pieces", "forme", "livree"] }],
  ["Voiture : modèle civile (son plan, retouche 40b)", null, ["PLAN_CIVILE"], { entree: `import { PLAN_CIVILE } from "../voiture/modeleCivile";`, dehors: ["carMesh", "pieces", "modele", "forme", "livree"] }],
  ["Voiture : modèle A (son plan)", null, ["PLAN_A"], { entree: `import { PLAN_A } from "../voiture/modeleA";`, dehors: ["carMesh", "pieces", "modele", "forme", "livree"] }],
  ["Voiture : modèle B (son plan)", null, ["PLAN_B"], { entree: `import { PLAN_B } from "../voiture/modeleB";`, dehors: ["carMesh", "pieces", "modele", "forme", "livree"] }],
  ["Voiture : modèle C (son plan)", null, ["PLAN_C"], { entree: `import { PLAN_C } from "../voiture/modeleC";`, dehors: ["carMesh", "pieces", "modele", "forme", "livree"] }],
  ["Voiture : matériaux des paliers 2 et 3 (materiaux2.ts, à la demande ; MeshPhysicalMaterial compté à part, dans three.js)", null, ["MATERIAUX_2"], { entree: `import { MATERIAUX_2 } from "../voiture/materiaux2";`, dehors: ["carMesh", "pieces", "modele", "forme", "livree"] }],
];

/** Un module vide qui exporte les mêmes noms (le palier 1 mesuré sans les modules des pas). */
function moduleVide(chemin) {
  const src = readFileSync(chemin, "utf8");
  // Lot 46 : les réexportations aussi (`export { Drapeaux } from "./drapeaux"`, finition.ts).
  const noms = [...src.matchAll(/^export (?:async )?(?:function|const|class|let) (\w+)/gm), ...[...src.matchAll(/^export \{ ([\w, ]+) \} from/gm)].flatMap((m) => m[1].split(/,\s*/).map((n) => [, n]))].map((m) => m[1]);
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
            if (o.dehors?.includes("carMesh") && /\/carMesh$/.test(a.path)) return { path: a.path, external: true };
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
