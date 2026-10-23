// Lot 45 — **le pas « finition » du jeu : le palier 2** (et le palier 3, qui le contient), chargé à la demande (`PAS_DU_JEU.finition`, un `import()`) et
// branché sur la scène du palier 1 (`composerP1.ts`) par ses crochets. Le code est celui de la vitrine (retouches 38b et 38c), sans rien réécrire :
//   - **géométrie** (`finition.ts`) : piliers chanfreinés, socles prolongés et leurs pneus, boulons, câbles, banderoles, drapeaux en haut des piliers, arche
//     plus ronde, semelles et jambes de force des panneaux, catadioptres ; rebords complets de chaque thème (`rebordsComplets.ts`) ; virages deux fois plus fins ;
//   - **variété** : chaque instance du décor varie un peu (une autre suite que celle du décor : il reste à sa place), bandes de rebord et pièces inégales ;
//   - **matière sobre** (`matiere.ts`, décision de Nathan, 38c : un cran au-dessus du palier 1, rien qui imite une photo) : asphalte, métal, décor ;
//   - **traces** de pneus et de freinage, discrètes (dans le calque de la route) ;
//   - **reflets ciblés** (38b, « d'autres pas », n° 5) : la carte d'environnement du thème posée **sur le métal des portiques et sur la voiture seulement**
//     (`envMap` par matériau), **jamais sur `scene.environment`** : la route et le décor ne la lisent pas (c'était le pas le plus cher par pixel).
// **Aucun appel de rendu de plus que le palier 1** : tout est versé dans les calques existants (les rebords variés dans la route), un matériau reste un matériau ;
// les drapeaux sont ceux du pas « vie » (le palier 2 du jeu la prend avec lui : la vitrine, elle, les fige au palier 2 sans la vie). Chaque partie se coupe (`?reglages=2-reflets`, `2-geometrie`…). Présentation seule : rien ne touche à la simulation.
import { Color, type Mesh, type MeshStandardMaterial } from "three";
import type { PaletteName } from "@cdj/sim";
import { Builder, mix, seeded } from "../meshKit";
import { brancherPas } from "./socle";
import { FINITION_ELEMENTS, marque, varierInstance, varierParPosition, type Marque } from "./finition";
import { THEMES_C } from "./lumiere";
import { matiereAsphalte, matiereDecor, matiereMetal, teinteLarge, tracesEtMarquages } from "./matiere";
import { routeP } from "./palier1";
import { bordureVideB, rebordB } from "./rebordsComplets";
import { carteEnvironnement } from "./reflets";
import { couleurRouteOrigine } from "./route";
import { uvMonde } from "./uvMonde";
import type { Calques, PasScene } from "./types";

/** Les parties du pas, chacune coupable par l'adresse (recette et aperçus). */
export const PARTIES_FINITION = ["geometrie", "variete", "matiere", "traces", "reflets"] as const;

/** La part de lumière renvoyée par la carte d'environnement (celle de la vitrine, `THEMES_3`) : moins la nuit, plus sur la neige. */
const ENVIRONNEMENT: Partial<Record<PaletteName, number>> = { stade: 0.55, nuit: 0.3, neon: 0.3, neige: 0.6, alpin: 0.6 };

/** Verse un calque dans un autre (les rebords variés dans la route : un seul maillage, un seul appel). */
function verser(de: Builder, vers: Builder) {
  for (const v of de.pos) vers.pos.push(v);
  for (const v of de.col) vers.col.push(v);
  vers.halos.push(...de.halos);
}

export const FINITION: PasScene = {
  id: "finition",
  avant(c, x, coupes) {
    if (!coupes.has("variete")) {
      const varie = (x.varie = seeded(`${x.track.id}:${x.palette}:variete`));
      x.varierDecor = { marque: (d) => marque(d as Calques), varier: (d, m, px, sol, pz) => varierInstance(d as Calques, m as Marque, px, sol, pz, varie) };
      c.rebords = new Builder(); // le temps de les varier (`apres`), puis versés dans la route
    }
    if (coupes.has("geometrie")) return;
    // Les drapeaux des portiques sont ceux de la vie (le palier 2 du jeu la prend toujours : `GROUPE_VIE_CIEL`) : la finition n'en pose pas (sans `Calques.drapeaux`).
    x.finition = FINITION_ELEMENTS;
    return { style: routeP(x.palette, { rebord: (nom, sorte) => rebordB(nom, sorte), bordureVide: bordureVideB }), options: { lissage: 2 } };
  },
  apres(c, x, coupes) {
    if (!coupes.has("traces")) tracesEtMarquages(c.route, x.track, (b) => couleurRouteOrigine(b, x.pal), x.pal.dash);
    if (c.rebords) {
      varierParPosition(c.rebords, 4, 0.07, 38);
      varierParPosition(c.solide, 3, 0.04, 39);
      verser(c.rebords, c.route);
      delete c.rebords;
    }
  },
  poser({ x, soleil, coupes, sansDom }) {
    const matiere = !coupes.has("matiere") && !sansDom;
    const reflets = !coupes.has("reflets");
    const habilles = new Set<MeshStandardMaterial>();
    const metaux: MeshStandardMaterial[] = [];
    let env: ReturnType<typeof carteEnvironnement> | null = null;
    const intensite = ENVIRONNEMENT[x.palette] ?? 0.5;
    return {
      habiller(m: Mesh) {
        const mat = m.material as MeshStandardMaterial;
        const calque = m.userData.calque as string;
        if (habilles.has(mat)) return;
        habilles.add(mat);
        const t = !matiere ? null : calque === "route" ? matiereAsphalte() : calque === "solide" ? matiereMetal() : calque === "decor" || calque === "dense" ? matiereDecor() : null;
        if (t) {
          // Une unité de texture tous les 4 m (le décor a déjà les siennes) ; la texture est presque blanche, multipliée aux couleurs des sommets.
          if (calque === "route" || calque === "solide") uvMonde(m.geometry, 4);
          mat.map = t.map;
          teinteLarge(mat, t.teinte);
          mat.needsUpdate = true;
        }
        if (reflets && calque === "solide") {
          // Le métal des portiques et des panneaux : satiné, il reflète le ciel du thème (`environnement`).
          mat.roughness = 0.42;
          mat.metalness = 0.35;
          metaux.push(mat);
        }
      },
      environnement(renderer) {
        if (!reflets) return null;
        if (!env) {
          const tc = THEMES_C[x.palette];
          env = carteEnvironnement(renderer, { ciel: tc.ciel, sol: new Color(tc.sol[0]).getHex(), soleil: { direction: soleil, couleur: tc.soleil[0], force: Math.min(1.5, tc.soleil[1] / 2) }, horizon: mix(x.pal.mountain, tc.brume[0], tc.silhouettes) });
          for (const mat of metaux) {
            mat.envMap = env.texture;
            mat.envMapIntensity = intensite;
            mat.needsUpdate = true;
          }
        }
        return { texture: env.texture, intensite };
      },
      dispose() {
        // Les textures de matière sont partagées par toutes les scènes (dessinées une fois) : la scène ne doit pas les libérer.
        for (const mat of habilles) if (matiere) mat.map = null;
        env?.dispose();
      },
      stats: () => ({ ...Object.fromEntries(PARTIES_FINITION.map((p) => [p, !coupes.has(p)])), matiere, reflets: !!env }),
    };
  },
};

brancherPas("finition", FINITION);
