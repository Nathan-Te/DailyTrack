import { LASER_THICKNESS, UNITS_PER_TILE, type LaserBar } from "@cdj/jump-sim";
import { Art } from "./artKit";

/** Mélange de deux couleurs (0 : a, 1 : b) ; copie locale pour ne pas dépendre de `feel.ts`, qui lit les couleurs d'ici. */
function mixColor(a: number, b: number, t: number): number {
  const ch = (c: number, s: number) => (c >> s) & 255;
  const m = (s: number) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t) << s;
  return m(16) | m(8) | m(0);
}

// Le dessin d'un laser (lot 25), **logique pure** : couleurs, dimensions, géométrie du rayon et des émetteurs. `laserArt.ts` en fait des objets Three.js ; la simulation
// (`packages/jump-sim`) ne connaît rien de tout cela.
//   - **Le rayon allumé porte le rouge des dangers** (`palette.hazard`, jamais écrit ici) : un fin rayon à cœur clair, **exactement la bande mortelle** (`LASER_THICKNESS` =
//     ¼ de tuile, au milieu des tuiles du rayon, sur toute leur longueur) en trois bandes qui se touchent sans se recouvrir (rouge, cœur clair, rouge) : l'estompage du carnage
//     ne s'additionne pas.
//   - **La visée** (`LASER_LOOK.aim`, `--dj-papier`, neutre) : un rayon plus fin que le rayon rouge, posé sur sa ligne médiane, dont l'opacité croît avec l'annonce
//     (`laserLook().warn`, `announce.ts`). Jamais le rouge des dangers, jamais un clignotement.
//   - **Les émetteurs suivent le style du néon** (cyan `5ff3ff` et rose `ff6ad5` du thème, boîtier violet sombre) : un museau en retrait sur la tuile pleine qui borne le rayon
//     (laser fixe : la tuile est déjà dessinée par la scène, on n'y pose que la décoration) ou à chaque bout d'une barre (aucun plein, aucun danger). Leur lentille s'allume avec
//     l'annonce (laser fixe) ou avec la vitesse de la barre (son ralenti se voit).
//   - **Trajet d'une barre** : deux rails en pointillés neutres (crème et encre qui alternent, comme les plateformes) et l'empreinte de chaque extrémité.

/** Épaisseur du rayon rouge (tuiles) : exactement la bande mortelle de la simulation. */
export const RAY = LASER_THICKNESS / UNITS_PER_TILE;
/** Épaisseur du cœur clair du rayon (tuiles), au milieu : les deux bandes rouges se partagent le reste. */
export const CORE = 0.09;
/** Épaisseur de la visée (tuiles) : plus fine que le rayon. */
export const AIM = 0.06;
/** Opacité de la visée à l'annonce pleine (elle croît avec `warn` depuis 0). */
export const AIM_OPACITY = 0.85;
/** Profondeur du museau d'un émetteur (tuiles, le long du rayon) et sa demi-hauteur ; liseré rose en haut et en bas. */
export const NOSE = 0.3;
export const NOSE_HALF = 0.34;
export const NOSE_TRIM = 0.04;
/** Part de la lueur de la lentille d'une barre à l'arrêt (aux extrémités de son trajet) : elle va de là à 1 à pleine vitesse. */
export const BAR_GLOW_REST = 0.25;

export const LASER_LOOK = {
  /** La visée : `--dj-papier`, la crème neutre de la charte. */
  aim: 0xfff6e0,
  /** Le boîtier de l'émetteur (violet sombre du néon), son liseré (rose) et sa lentille (cyan). */
  body: 0x2a1040,
  trim: 0xff6ad5,
  lens: 0x5ff3ff,
  /** Le pointillé du trajet (comme les plateformes) : crème et encre. */
  rail: 0xfff6e0,
  railInk: 0x2a1e16,
} as const;

/** La lentille éteinte : le cyan assombri vers le boîtier. */
export const LENS_DIM = mixColor(LASER_LOOK.lens, LASER_LOOK.body, 0.7);

/** La lueur de la lentille (0 à 1) : sa couleur va de `LENS_DIM` à `LASER_LOOK.lens`. */
export const lensColor = (glow: number): number => mixColor(LENS_DIM, LASER_LOOK.lens, Math.max(0, Math.min(1, glow)));

/** La lueur d'une barre à la vitesse `speed` (part de sa pointe) : jamais éteinte, pleine à pleine vitesse. */
export const barGlow = (speed: number): number => BAR_GLOW_REST + (1 - BAR_GLOW_REST) * Math.max(0, Math.min(1, speed));

/** La couleur du cœur clair, tirée du rouge du thème. */
export const coreColor = (hazard: number): number => mixColor(hazard, 0xffffff, 0.8);

/**
 * Le rayon allumé d'un laser de `length` tuiles, à plat : le long de +x depuis x = 0, centré en y = 0 (y vers le haut). Trois bandes qui se touchent par leur bord :
 * le rouge du danger (au-dessus et au-dessous) et le cœur clair au milieu ; la hauteur totale est exactement `RAY`.
 */
export function buildRayArt(length: number, hazard: number): Art {
  const art = new Art();
  const edge = (RAY - CORE) / 2;
  art.rect(0, CORE / 2, length, CORE / 2 + edge, 0, hazard);
  art.rect(0, -CORE / 2, length, CORE / 2, 0, coreColor(hazard));
  art.rect(0, -CORE / 2 - edge, length, -CORE / 2, 0, hazard);
  return art;
}

/** Le rayon de visée, à plat comme `buildRayArt` : une seule bande de `AIM` de haut, neutre. */
export function buildAimArt(length: number): Art {
  const art = new Art();
  art.rect(0, -AIM / 2, length, AIM / 2, 0, LASER_LOOK.aim);
  return art;
}

/**
 * Le boîtier d'un émetteur : sa face est en u = 0 (du côté du rayon) et son museau s'étend de u = 0 à `NOSE` (du côté opposé), centré en v = 0. Quatre bandes qui ne se recouvrent
 * pas : boîtier et liseré rose au-dessus et au-dessous de la lentille (la lentille a sa propre géométrie, `buildLensArt`, de la hauteur du rayon).
 */
export function buildEmitterArt(): Art {
  const art = new Art();
  const lens = RAY / 2;
  const trim = NOSE_HALF - NOSE_TRIM;
  art.rect(0, lens, NOSE, trim, 0, LASER_LOOK.body);
  art.rect(0, trim, NOSE, NOSE_HALF, 0, LASER_LOOK.trim);
  art.rect(0, -trim, NOSE, -lens, 0, LASER_LOOK.body);
  art.rect(0, -NOSE_HALF, NOSE, -trim, 0, LASER_LOOK.trim);
  return art;
}

/** La lentille d'un émetteur : un rectangle de la hauteur du rayon et de la profondeur du museau (une couleur, qui change avec la lueur). */
export function buildLensArt(): Art {
  const art = new Art();
  art.rect(0, -RAY / 2, NOSE, RAY / 2, 0, 0xffffff);
  return art;
}

/** Où et comment poser un rayon et ses deux émetteurs dans le repère local d'un laser : la première tuile du rayon est en (0, 0), y vers le haut. */
export interface RayLayout {
  /** Le rayon et la visée : leur point de départ et leur rotation (rad). */
  ray: { x: number; y: number; rotation: number };
  /** Les deux émetteurs (début puis fin du rayon) : la face au bout du rayon, le museau vers l'extérieur. */
  emitters: [{ x: number; y: number; rotation: number }, { x: number; y: number; rotation: number }];
}

export function rayLayout(axis: "h" | "v", length: number): RayLayout {
  if (axis === "h") {
    return {
      ray: { x: 0, y: -0.5, rotation: 0 },
      emitters: [
        { x: 0, y: -0.5, rotation: Math.PI },
        { x: length, y: -0.5, rotation: 0 },
      ],
    };
  }
  return {
    ray: { x: 0.5, y: 0, rotation: -Math.PI / 2 },
    emitters: [
      { x: 0.5, y: 0, rotation: Math.PI / 2 },
      { x: 0.5, y: -length, rotation: -Math.PI / 2 },
    ],
  };
}

/** Le trajet d'une barre (tuiles, repère du monde affiché, y vers le haut) : les deux rails (début et fin du rayon) et l'empreinte de la barre à chaque extrémité. */
export interface BarTrack {
  rails: [x: number, y: number][][];
  prints: [x: number, y: number][][];
}

export function barTrack(b: Pick<LaserBar, "axis" | "length" | "a" | "b">): BarTrack {
  const lay = rayLayout(b.axis, b.length);
  const at = (cell: { col: number; row: number }, p: { x: number; y: number }): [number, number] => [cell.col + p.x, -cell.row + p.y];
  const rails = lay.emitters.map((e) => [at(b.a, e), at(b.b, e)]);
  // L'empreinte : le rectangle que couvrent le rayon et les deux museaux à l'extrémité (le long du rayon : de museau à museau ; en travers : la hauteur du museau).
  const prints = [b.a, b.b].map((cell) => {
    const x0 = cell.col;
    const y0 = -cell.row;
    return b.axis === "h"
      ? ([[x0 - NOSE, y0 - 0.5 + NOSE_HALF], [x0 + b.length + NOSE, y0 - 0.5 + NOSE_HALF], [x0 + b.length + NOSE, y0 - 0.5 - NOSE_HALF], [x0 - NOSE, y0 - 0.5 - NOSE_HALF], [x0 - NOSE, y0 - 0.5 + NOSE_HALF]] as [number, number][])
      : ([[x0 + 0.5 - NOSE_HALF, y0 + NOSE], [x0 + 0.5 + NOSE_HALF, y0 + NOSE], [x0 + 0.5 + NOSE_HALF, y0 - b.length - NOSE], [x0 + 0.5 - NOSE_HALF, y0 - b.length - NOSE], [x0 + 0.5 - NOSE_HALF, y0 + NOSE]] as [number, number][]);
  });
  return { rails, prints };
}
