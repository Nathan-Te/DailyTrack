import { Fog, Group, Vector3, type PerspectiveCamera } from "three";
import { BOSS_IDS } from "@cdj/rush-sim";
import { animerBoss, bossFictif, cadreDuBoss, creerBoss, type BossVu } from "./bosses";
import { CAMERA_DEFAUT } from "./camera";
import { monterDecor, type Decor } from "./decor";
import type { PaletteMonde } from "./palette";

// `?scenario=bestiaire` (lot BR3) : les CINQ boss côte à côte sur le sol du thème choisi (`&theme=`), FIGÉS — leurs animations d'attente seulement —, la caméra fixe qui les cadre tous à la même échelle de base (la plongée et le champ du jeu), le nom de
// chacun écrit dessous. De quoi juger silhouettes et contrastes d'un coup d'œil ; cette scène est la référence de la passe artistique qui suivra. Un essai, jamais classé, jamais en production.

/** Le rayon du plateau du bestiaire (mètres) : assez large pour la rangée. */
export const RAYON_BESTIAIRE = 26;
/** L'écart entre deux boss (mètres) : le golem (10 m, bras écartés) et le grand-duc (8 m d'envergure) ne se touchent pas. */
export const ECART_BESTIAIRE = 8.4;
/** La largeur de la rangée à garder dans l'image (mètres) : les cinq boss, leurs bras et leurs ailes. */
const LARGEUR_RANGEE = 49;
/** Où l'on écrit leur nom : devant eux (mètres, vers la caméra). */
const DEVANT_ETIQUETTE = 3.7;

export interface Bestiaire {
  decor: Decor;
  groupe: Group;
  vus: readonly BossVu[];
  /** Où se tient chaque boss (mètres) et le rayon de son ombre, pour les disques de la basse qualité. */
  positions: readonly { x: number; z: number; rayon: number; haut: () => number }[];
  /** Une image : l'attente de chaque boss, et son nom à sa place à l'écran. */
  maj(dt: number, temps: number, camera: PerspectiveCamera, largeur: number, hauteur: number): void;
  /** Pose la caméra fixe (position et regard) pour cette forme d'écran. */
  camera(camera: PerspectiveCamera, aspect: number): void;
  detruire(): void;
}

/** La position de la caméra du bestiaire : au sud de la rangée, plongée du jeu, assez loin pour que les cinq tiennent dans la largeur (jamais plus près que la distance du jeu). Pure. */
export function cameraDuBestiaire(aspect: number): { distance: number; regard: [number, number, number]; position: [number, number, number] } {
  const phi = (CAMERA_DEFAUT.angle * Math.PI) / 180;
  const demi = Math.tan((CAMERA_DEFAUT.champ * Math.PI) / 360);
  const distance = Math.max(CAMERA_DEFAUT.distance, LARGEUR_RANGEE / 2 / (demi * Math.max(0.3, aspect)));
  const regard: [number, number, number] = [0, 1.6, 1.5];
  return { distance, regard, position: [regard[0], regard[1] + Math.sin(phi) * distance, regard[2] + Math.cos(phi) * distance] };
}

export function monterBestiaire(hote: HTMLElement, palette: PaletteMonde, scene: { fog: unknown }, nom: (id: string) => string): Bestiaire {
  const decor = monterDecor(RAYON_BESTIAIRE, palette, { niveau: true });
  (scene as { fog: Fog | null }).fog = new Fog(palette.brume, 140, 320); // la rangée est loin de la caméra : pas de brume sur elle
  const groupe = new Group();
  const vus: BossVu[] = [];
  const positions: { x: number; z: number; rayon: number; haut: () => number }[] = [];
  const etiquettes: HTMLElement[] = [];
  BOSS_IDS.forEach((id, k) => {
    const vu = creerBoss(k);
    const x = (k - (BOSS_IDS.length - 1) / 2) * ECART_BESTIAIRE;
    vu.racine.position.set(x, 0, 0);
    groupe.add(vu.racine);
    vus.push(vu);
    positions.push({ x, z: 0, rayon: cadreDuBoss(k).r * 0.62, haut: () => vu.haut });
    const e = document.createElement("div");
    e.className = "rush-etiquette";
    e.dataset.boss = id;
    e.textContent = nom(id);
    hote.append(e);
    etiquettes.push(e);
  });
  const p = new Vector3();
  return {
    decor,
    groupe,
    vus,
    positions,
    maj(dt, temps, camera, largeur, hauteur) {
      vus.forEach((vu, k) => {
        const g = bossFictif(k);
        animerBoss(vu, g, { dt, temps, t: 0, vivant: true, mort: 0, marche: false, sursaut: 0, tick: 0, zones: [], elan: 24, dort: false });
        vu.racine.position.x = positions[k]!.x;
        const e = etiquettes[k]!;
        p.set(positions[k]!.x, 0, DEVANT_ETIQUETTE).project(camera);
        e.style.transform = `translate(${((p.x + 1) / 2) * largeur}px, ${((1 - p.y) / 2) * hauteur}px) translate(-50%, 0)`;
      });
    },
    camera(camera, aspect) {
      const c = cameraDuBestiaire(aspect);
      camera.position.set(...c.position);
      camera.lookAt(...c.regard);
      camera.updateMatrixWorld(true);
    },
    detruire() {
      decor.detruire();
      for (const e of etiquettes) e.remove();
    },
  };
}
