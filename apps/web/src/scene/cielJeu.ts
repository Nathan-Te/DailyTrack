// Lot 46 — **le pas « ciel » du jeu** (palier 3 ; et le groupe « vie et ciel » des téléphones récents, `GROUPE_VIE_CIEL`), chargé à la demande
// (`PAS_DU_JEU.ciel`, un `import()`) : le dôme dessiné et ses nuages par thème qui dérivent (`nuages`), et la brume de profondeur (`brume` : une brume de
// hauteur, dense au ras du sol lointain, qui prend la couleur du soleil quand on le regarde — le soleil, ou la lune, posé du bon côté depuis le lot 43).
// Le code est celui de la vitrine (`lumiere3.ts`, retouche 38b), branché sur la scène du palier 1 (`composerP1.ts`). **La Nuit garde son ciel de nuit** :
// le dôme y est sombre, la lune et les étoiles du palier 1 (transparentes, dessinées après lui) restent devant ses nuages.
// Aucune passe plein écran : un appel de rendu (le dôme), la brume n'en ajoute aucun (un morceau de nuanceur des matériaux).
// Les nuages dérivent sur un temps d'affichage, jamais sur l'état de la course.
import type { Material, Mesh, Object3D } from "three";
import { brancherPas } from "./socle";
import { THEMES_C } from "./lumiere";
import { CIEL_3, brumeDeProfondeur, domeDuCiel, uniformesBrume } from "./lumiere3";
import type { PasScene } from "./types";

export const CIEL: PasScene = {
  id: "ciel",
  poser({ scene, x, soleil, coupes, sansDom }) {
    const tc = THEMES_C[x.palette];
    const t3 = CIEL_3[x.palette];
    const dome = coupes.has("nuages") ? null : domeDuCiel(tc.ciel, soleil, tc.soleil[0], t3, !sansDom);
    if (dome) {
      dome.userData.vie = "nuages";
      scene.add(dome);
    }
    let brume = 0;
    // Les uniformes sont partagés par tous les matériaux de la scène ; la voiture et les fantômes, ajoutés ensuite, gardent la brume du thème (ils sont près).
    const u = coupes.has("brume") ? null : uniformesBrume(t3, x.floorY, soleil);
    const vus = new Set<Material>();
    const embrumer = (o: Object3D) => {
      const m = (o as Mesh).material as Material | Material[] | undefined;
      for (const mat of Array.isArray(m) ? m : m ? [m] : []) {
        if (!u || vus.has(mat) || !(mat as { fog?: boolean }).fog) continue;
        vus.add(mat);
        brumeDeProfondeur(mat, u);
        brume++;
      }
    };
    scene.traverse(embrumer);
    return {
      // Lot 45 : le décor qui se pose après la construction (il arrive à la demande, lot 44) prend la brume lui aussi ; avant, il en restait privé.
      habiller: embrumer,
      animer(t, camera) {
        if (!dome) return;
        dome.position.copy(camera.position);
        dome.material.uniforms.uTemps!.value = t;
      },
      stats: () => ({ nuages: !!dome, brume }),
    };
  },
};

brancherPas("ciel", CIEL);
