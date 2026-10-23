// Lot 46 — **le pas « vie » du jeu** (palier 3 ; et le groupe « vie et ciel » des téléphones récents, `GROUPE_VIE_CIEL`), chargé à la demande
// (`PAS_DU_JEU.vie`, un `import()`) : drapeaux qui ondulent sur les portiques et la tribune, foule de la tribune du départ qui sautille, écrans à diodes
// (les sponsors fictifs du lot 43 qui défilent, le chronomètre du portique), particules par thème — au Stade, des confettis **à l'arrivée seulement**
// (décision du 23/10/2026). Le code est celui de la vitrine (`vie.ts`, retouche 38b), branché sur la scène du palier 1 (`composerP1.ts`) par ses crochets.
//
// Règles (direction.md § 9, lot 46) :
//   - **un appel de rendu au plus par famille** : un maillage de drapeaux, un pour la foule, un maillage pour tous les écrans, un nuage de points ;
//   - **tout s'anime sur un temps d'affichage** (`animer(t)`), jamais sur l'état de la course ; seuls les feux de départ du lot 43 lisent le décompte ;
//   - **rien ne bouge dans le champ de la piste devant la voiture** : drapeaux, foule et écrans sont à côté de la piste ou au-dessus du passage (≥ 11 m),
//     les drapeaux ne projettent pas d'ombre (elle onduleraient sur la route), les particules s'effacent dans le couloir de la piste devant la caméra et
//     près de l'objectif (jamais une particule plein écran).
// Présentation seule : rien ne lit ni n'écrit la simulation.
import type { BufferGeometry, Material, Mesh, Points, ShaderMaterial } from "three";
import type { Block } from "@cdj/sim";
import { brancherPas } from "./socle";
import { Drapeaux } from "./drapeaux";
import { Affiches, boite, pt, repereBloc } from "./outils";
import { MARQUE } from "./pieces";
import { METAL } from "./piste";
import { VENT, ecartP } from "./palier1";
import { Q_ARRIVEE, Q_DEPART } from "./composerP1";
import { Chronometre, PARTICULES_3, RUBAN_RAPPORT, ecransDuDepart, ecransEtChrono, drapeauxAnimes, fouleAnimee, particules, rubanDesEcrans, suivreCamera, type Temps } from "./vie";
import type { Calques, PasScene } from "./types";

/** Durée (s) d'une salve de confettis (elle s'efface entre 5 et 8 s : `vie.ts`). */
export const SALVE_S = 8;
/** Taille des spectateurs de la tribune d'aujourd'hui (des gradins de 1 m) : un peu plus petits que ceux de la vitrine. */
const ECHELLE_FOULE = 0.85;
/** Hauteur (m) de la hampe d'un drapeau de portique au-dessus de son pilier, et d'un mât de tribune au-dessus du toit. */
const HAMPE = 2.6;
const MAT = 2.4;
/** Le haut d'un pilier de portique (lot 43 : poutre à 8,6 m, panneau de 3 m). */
const HAUT_PORTIQUE = 11.6;

/** Les drapeaux d'un portique, en haut de ses piliers (comme le pas « géométrie » du palier 2, qui les pose lui-même quand il est là). */
function drapeauxDuPortique(d: Drapeaux, c: Calques, b: Block, q: number, couleurs: readonly number[]) {
  const r = repereBloc(b, q);
  const w = ecartP(b, q);
  for (const s of [-1, 1]) {
    const haut = pt(r, s * (w + 0.4), HAUT_PORTIQUE, 0);
    c.solide.box(haut[0] - 0.05, haut[1], haut[2] - 0.05, haut[0] + 0.05, haut[1] + HAMPE, haut[2] + 0.05, METAL);
    d.drapeau([haut[0], haut[1] + HAMPE - 0.05, haut[2]], VENT, 1.7, 1.05, couleurs, s * 1.3 + b.index);
  }
}

export const VIE: PasScene = {
  id: "vie",
  foule: true,
  elements(c, x, coupes) {
    const depart = x.track.blocks.find((b) => b.mark === "start");
    const arrivee = x.track.blocks.find((b) => b.mark === "finish");
    if (!coupes.has("drapeaux")) {
      const d = (c.drapeaux = new Drapeaux());
      // Le pas « géométrie » (palier 2, lot 45) pose déjà ceux des portiques quand il est là (`x.finition`).
      if (!x.finition) {
        if (depart) drapeauxDuPortique(d, c, depart, Q_DEPART, [MARQUE.livree, MARQUE.asphalte]); // la livrée en hauteur, sur le portique de départ
        if (arrivee) drapeauxDuPortique(d, c, arrivee, Q_ARRIVEE, [MARQUE.encre, MARQUE.creme, MARQUE.encre]);
      }
    }
    if (!coupes.has("ecrans")) {
      c.ecrans = new Affiches();
      c.chrono = new Affiches();
      // Les panneaux du départ, sur les rebords de la ligne droite (le ruban de la tribune vient avec le décor : `decor`).
      ecransDuDepart(c, x);
      // Le chronomètre à diodes au-dessus de la poutre du portique de départ (2,8 × 1,4 m, face à qui arrive), dans son caisson.
      if (depart) {
        const r = repereBloc(depart, Q_DEPART);
        boite(c.solide, r, -1.55, 1.55, 11.55, 13.15, -0.6, 0, MARQUE.encre); // au-dessus du pilier (11,6 m)
        c.chrono.face(r, -1.4, 1.4, 11.65, 13.05, -0.62, [0, 0, 1, 1]);
      }
    }
  },
  poser({ scene, calques: c, x, coupes, sansDom }) {
    const temps: Temps = { uTemps: { value: 0 } };
    // Une famille, un maillage : drapeaux et écrans sont refaits quand le décor apporte ceux de sa tribune (lot 44 : il arrive à la demande).
    const remplacer = <M extends Mesh>(ancien: M | null, neuf: M | null): M | null => {
      if (ancien) {
        scene.remove(ancien);
        ancien.geometry.dispose();
        (ancien.material as Material).dispose();
      }
      if (neuf) scene.add(neuf);
      return neuf;
    };
    // Drapeaux : un maillage, déformé par la carte graphique. Pas d'ombre : elle onduleraient sur la route devant la voiture.
    let drapeaux: Mesh | null = null;
    const faireDrapeaux = () => {
      const m = c.drapeaux && !c.drapeaux.vide ? drapeauxAnimes(c.drapeaux, temps) : null;
      if (m) m.castShadow = false;
      drapeaux = remplacer(drapeaux, m);
    };
    faireDrapeaux();
    // Écrans : rubans et chronomètre dans un seul maillage.
    const ruban = sansDom || !c.ecrans ? null : rubanDesEcrans(x.palette);
    const chrono = sansDom || !c.ecrans ? null : new Chronometre();
    let ecrans: ReturnType<typeof ecransEtChrono> = null;
    const faireEcrans = () => {
      ecrans = remplacer(ecrans, c.ecrans && c.chrono ? ecransEtChrono(c.ecrans, c.chrono, ruban, chrono?.texture ?? null) : null);
    };
    faireEcrans();
    // Foule : les spectateurs de la tribune du départ (décision du 23/10 : seulement là), quand le décor est posé.
    let foule: Mesh | null = null;
    // Particules du thème ; au Stade, une salve de confettis à l'arrivée et rien d'autre.
    const salve = x.palette === "stade";
    let pts: Points<BufferGeometry, ShaderMaterial> | null = null;
    if (!coupes.has("particules")) {
      pts = particules({ particules: PARTICULES_3[x.palette] }, temps, salve ? { salve: true, sorte: "confettis" } : {});
      pts.userData.level = 1; // masquées à la qualité 0
      if (salve) pts.visible = false;
      scene.add(pts);
    }
    let debutSalve = -Infinity;
    let salves = 0;
    return {
      decor({ tribune, foule: gens, decor }) {
        if (tribune && c.drapeaux) {
          // Trois mâts sur le toit de la tribune du départ (jamais l'orange : il est à la voiture et au portique de départ).
          for (const [i, m] of tribune.mats.entries()) {
            decor.box(m[0] - 0.04, m[1], m[2] - 0.04, m[0] + 0.04, m[1] + MAT, m[2] + 0.04, METAL);
            c.drapeaux.drapeau([m[0], m[1] + MAT - 0.05, m[2]], VENT, 1.4, 0.9, i === 1 ? [MARQUE.moutarde, MARQUE.encre] : [0x2e7dff, 0xf4f4f4], i * 0.7);
          }
          faireDrapeaux();
        }
        if (tribune && c.ecrans) {
          // Le ruban sur la façade de la tribune.
          const [a, f] = tribune.facade;
          const H = 0.75;
          const L = Math.hypot(f[0] - a[0], f[2] - a[2]);
          c.ecrans.quad(a, f, [f[0], f[1] + H, f[2]], [a[0], a[1] + H, a[2]], [0, 0, L / H / RUBAN_RAPPORT, 1]);
          faireEcrans();
        }
        const m = gens && !coupes.has("foule") ? fouleAnimee(gens, temps, ECHELLE_FOULE) : null;
        if (m) m.userData.heavy = true; // comme le décor : masquée à la qualité 0 (QualityGovernor, lot 9)
        foule = remplacer(foule, m);
      },
      animer(t, camera, hauteurPx) {
        temps.uTemps.value = t;
        if (pts) {
          suivreCamera(pts, camera, hauteurPx);
          if (salve) {
            const s = t - debutSalve;
            pts.visible = s >= 0 && s < SALVE_S;
            pts.material.uniforms.uSalve!.value = pts.visible ? s : -1;
          }
        }
        if (ecrans) ecrans.material.uniforms.uDefile!.value = (t * 0.06) % 1;
        chrono?.afficher(t);
      },
      arrivee(t) {
        if (!salve || !pts) return;
        debutSalve = t;
        salves++;
      },
      dispose() {
        chrono?.texture.dispose();
        ruban?.dispose();
        foule?.dispose();
      },
      // `?debug` (`__cdj.render.pas.vie`) : les maillages de chaque famille, la sorte des particules, les salves de confettis et si elles se voient.
      stats: () => ({ appels: appelsParFamille(scene), particules: pts?.material.uniforms.uSorte!.value, salves, confettis: salve && !!pts?.visible }),
    };
  },
};

/** Le nombre de maillages de chaque famille de la vie dans une scène (un appel de rendu chacun) : le critère « un appel au plus par famille ». */
export function appelsParFamille(scene: { traverse(f: (o: { userData: Record<string, unknown> }) => void): void }): Record<string, number> {
  const n: Record<string, number> = {};
  scene.traverse((o) => {
    const f = o.userData.vie as string | undefined;
    if (f) n[f] = (n[f] ?? 0) + 1;
  });
  return n;
}

brancherPas("vie", VIE);
