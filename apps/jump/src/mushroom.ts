import { MUSHROOM_DOWN, MUSHROOM_LEFT, MUSHROOM_RIGHT, MUSHROOM_UP, type Mushroom } from "@cdj/jump-sim";
import { Art } from "./artKit";

// Le dessin d'un champignon rebond (lot 23), **logique pure** : couleurs, pose selon l'orientation, écrasement au contact, géométrie. `mushroomArt.ts` en fait des objets
// Three.js ; la simulation (`packages/jump-sim`) ne connaît rien de tout cela.
//   - **Couleur** : un chapeau **violet** (la forêt a des verts et des bruns ; le rouge est réservé aux dangers, le jaune au personnage, le bleu clair aux ressorts), des
//     taches claires, un pied crème, un cerne très sombre. Jamais rouge, jamais jaune : `test/champignons.test.ts` le vérifie (teinte) ainsi que la lisibilité (3:1 sur le
//     ciel et chaque plan de la forêt).
//   - **Orientation** : un champignon est dessiné « debout » (pied en bas, chapeau en haut, origine au milieu de la face du support) puis tourné : le chapeau est **toujours
//     du côté où il lance** (le dôme se lit au premier coup d'œil : sol vers le haut, plafond vers le bas, mur vers l'opposé du mur).
//   - **Écrasement** : au contact, le champignon s'écrase vers son support (`mushroomSquash`, 0,32 de la hauteur ; 0,5 pour un rebond renforcé) puis revient avec un
//     dépassement amorti ; sans mouvement, il revient tout droit, sans dépassement. **Aucune secousse de caméra** (règle du lot 14).

export const MUSHROOM_LOOK = {
  cap: 0xb98cff,
  capLight: 0xdcc6ff,
  capDark: 0x6a3fb0,
  spot: 0xf4ecff,
  stem: 0xe9dfc8,
  stemShade: 0xb9ab8c,
  outline: 0x140f2a,
} as const;

/** Profondeur de l'écrasement (part de la hauteur) d'un rebond simple et d'un rebond renforcé. */
export const SQUASH_DEPTH = 0.32;
export const SQUASH_DEPTH_BOOST = 0.5;
/** Durée de la compression (s), pulsation et amortissement du retour (1/s), durée après laquelle le champignon est au repos (s). */
export const SQUASH_IN = 0.04;
export const SQUASH_OMEGA = 22;
export const SQUASH_DECAY = 8;
export const SQUASH_SECONDS = 0.6;
/** Retour sans mouvement : tout droit, en cette durée (s). */
export const SQUASH_STILL_SECONDS = 0.15;

/** Pose d'un champignon dans le monde affiché (tuiles, y vers le haut) : l'origine est le milieu de la face du support, et la rotation (rad, sens trigonométrique) tourne le « haut » du dessin vers le chapeau. */
export function mushroomPose(m: Pick<Mushroom, "col" | "row" | "dir">): { x: number; y: number; rotation: number } {
  switch (m.dir) {
    case MUSHROOM_UP:
      return { x: m.col + 0.5, y: -(m.row + 1), rotation: 0 };
    case MUSHROOM_DOWN:
      return { x: m.col + 0.5, y: -m.row, rotation: Math.PI };
    case MUSHROOM_RIGHT:
      return { x: m.col, y: -(m.row + 0.5), rotation: -Math.PI / 2 };
    case MUSHROOM_LEFT:
      return { x: m.col + 1, y: -(m.row + 0.5), rotation: Math.PI / 2 };
    default:
      throw new RangeError(`mushroomPose : l'orientation ${m.dir} n'existe pas`);
  }
}

/** Le sens (vecteur unitaire, monde affiché, y vers le haut) vers lequel le chapeau regarde : le « haut » du dessin après rotation. */
export function mushroomFacing(m: Pick<Mushroom, "col" | "row" | "dir">): { x: number; y: number } {
  const r = mushroomPose(m).rotation;
  return { x: Math.round(-Math.sin(r)) + 0, y: Math.round(Math.cos(r)) + 0 };
}

/**
 * L'écrasement `ago` secondes après un rebond : 1 au repos, entre `1 − profondeur` et ≈ `1 + 0,16` (dépassement du retour d'un rebond renforcé). Avec mouvement : compression en `SQUASH_IN`, puis retour qui dépasse
 * et s'amortit (`SQUASH_OMEGA`, `SQUASH_DECAY`) ; sans mouvement : retour tout droit en `SQUASH_STILL_SECONDS` (aucun dépassement). Fonction pure de l'âge.
 */
export function mushroomSquash(ago: number, boost: boolean, animate: boolean): number {
  if (!(ago >= 0) || ago >= SQUASH_SECONDS) return 1;
  const depth = boost ? SQUASH_DEPTH_BOOST : SQUASH_DEPTH;
  if (!animate) return ago < SQUASH_STILL_SECONDS ? 1 - depth * (1 - ago / SQUASH_STILL_SECONDS) : 1;
  if (ago < SQUASH_IN) return 1 - depth * (ago / SQUASH_IN);
  const t = ago - SQUASH_IN;
  // Part restante de la compression : elle commence à 1, passe par 0 et dépasse (négative), s'amortit.
  const spring = Math.exp(-SQUASH_DECAY * t) * Math.cos(SQUASH_OMEGA * t);
  return 1 - depth * spring;
}

/**
 * La géométrie d'un champignon « debout » dans une tuile : origine au milieu de la face du support (y = 0), le chapeau — un dôme de rayon 0,5 — au-dessus d'un pied de
 * 0,5 de haut, donc du support à la tuile suivante : le dôme occupe la moitié de la tuile du côté du chapeau, **là où le contact compte** (`mushroomPad`).
 */
export function buildMushroomArt(): Art {
  const art = new Art();
  const L = MUSHROOM_LOOK;
  // Le cerne : un dôme un peu plus grand et un pied un peu plus large, derrière.
  art.half(0, 0.5, 0.54, 0, L.outline, 14);
  art.rect(-0.17, 0, 0.17, 0.52, 0, L.outline);
  // Le pied, avec une ombre à droite.
  art.rect(-0.13, 0, 0.13, 0.52, 0.01, L.stem);
  art.rect(0.03, 0, 0.13, 0.52, 0.012, L.stemShade);
  // Le chapeau : dôme plein, bande sombre dessous, reflet près du haut, taches.
  art.half(0, 0.5, 0.5, 0.02, L.cap, 14);
  art.rect(-0.48, 0.5, 0.48, 0.58, 0.03, L.capDark);
  art.arcBand(0, 0.5, 0.34, 0.4, (40 / 180) * Math.PI, (125 / 180) * Math.PI, 0.04, L.capLight, 6);
  art.disc(-0.22, 0.74, 0.075, 0.05, L.spot, 8);
  art.disc(0.12, 0.84, 0.06, 0.05, L.spot, 8);
  art.disc(0.27, 0.68, 0.05, 0.05, L.spot, 8);
  return art;
}
