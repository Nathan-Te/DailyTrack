import { STALACTITE_SHAKE_TICKS, STALACTITE_TILES, TICK_RATE, UNITS_PER_TILE, stalactiteOffset } from "@cdj/jump-sim";
import { Art } from "./artKit";

// Le dessin d'une stalactite (lot 24), **logique pure** : couleurs, géométrie, annonce du tremblement, position pendant la chute. `stalactiteArt.ts` en fait des objets Three.js ;
// la simulation (`packages/jump-sim`) ne connaît rien de tout cela.
//   - **Danger selon la charte** : un pic de glace (bleu pâle, cerné de bleu nuit), dont **la pointe est rouge** (`palette.hazard`, le rouge réservé aux dangers : la pointe tue, le
//     reste de la glace dit « glace »). Le corps est un dessin de `STALACTITE_TILES` (2) tuiles de haut qui ne dépasse jamais sa boîte mortelle sans que ce soit de la glace sans
//     danger (il est plus large que la boîte en haut, jamais plus étroit à hauteur du danger).
//   - **Annonce** (principe du lot 18) : dès le déclenchement et pendant tout le tremblement (`STALACTITE_SHAKE_TICKS`, 0,5 s) elle **tremble** (balancement de plus en plus ample,
//     `TREMBLE_HZ` = 2,9 Hz, sous `FLICKER_MAX_HZ`) et **laisse tomber de fines particules de glace** en continu (`stalactiteDrips`, quatre gouttes décalées, chacune sur 0,4 s, qui
//     apparaissent et disparaissent en douceur) : un signe continu, jamais un clignotement. Pendant la chute, plus de tremblement ni de gouttes : elle tombe, simplement.
//     Tout est une **fonction pure de l'âge** (pas de la simulation), identique avec ou sans mouvement réduit.
//   - **Casse** : au premier contact avec un plein (événement `stalactiteCasse`), des éclats de glace (`feel.ts`), un tintement ; **aucune secousse de caméra** (règle du lot 14).
//   - **Carnage** (lot 17) : son état dépend de chaque vie ; le carnage la dessine **intacte** (jamais en train de trembler ni de tomber, jamais brisée) à 35 % d'opacité, comme les
//     éléments à horloge (`scene.clockFade`). Ses pièces **ne se recouvrent pas** (faces, cerne, pointe, collier), pour que l'estompage ne s'additionne pas.

export const STALACTITE_LOOK = {
  /** La glace : face éclairée, face à l'ombre. */
  light: 0xcdeeff,
  shade: 0x8fc7ea,
  /** Le cerne (bleu nuit) et le collier de givre à la racine. */
  outline: 0x14304a,
  frost: 0xe8f6ff,
  /** Les gouttes de glace qui tombent pendant le tremblement. */
  drip: 0xe8f6ff,
} as const;

/** Amplitude du balancement à l'annonce pleine (tuiles) et sa fréquence (Hz, bien sous `FLICKER_MAX_HZ`). */
export const TREMBLE = 0.07;
export const TREMBLE_HZ = 2.9;
/** Gouttes : leur nombre, la durée de chacune (pas : 0,4 s, donc 2,5 Hz par goutte au plus), leur taille (tuiles) et de combien elles tombent (tuiles). */
export const DRIP_COUNT = 4;
export const DRIP_TICKS = 48;
export const DRIP_SIZE = 0.07;
export const DRIP_FALL = 1.1;

/** Longueur du corps (tuiles) : de la racine (sous le plafond) à la pointe. */
export const BODY = STALACTITE_TILES;
/** Où commence la pointe rouge (tuiles sous la racine) : elle va jusqu'au bout du corps. */
export const TIP_FROM = 1.55;

/** Le dessin d'une stalactite à l'âge `age` : 0 intacte, 1 à `STALACTITE_SHAKE_TICKS` elle tremble, au-delà elle tombe, −1 brisée (invisible). */
export interface StalactiteLook {
  /** Dessinée ? (faux : brisée). */
  visible: boolean;
  /** Amplitude du balancement, de 0 (au repos, en chute) à 1 (au dernier pas du tremblement) : strictement croissante pendant le tremblement. */
  shake: number;
  /** De combien elle est descendue (tuiles). */
  drop: number;
}

/** Ce que le dessin montre à l'âge `age` : fonction pure. */
export function stalactiteLook(age: number): StalactiteLook {
  if (age < 0) return { visible: false, shake: 0, drop: 0 };
  const shake = age >= 1 && age <= STALACTITE_SHAKE_TICKS ? age / STALACTITE_SHAKE_TICKS : 0;
  return { visible: true, shake, drop: stalactiteOffset(age) / UNITS_PER_TILE };
}

/** La position horizontale du balancement (tuiles) à l'instant `seconds` de l'horloge de la scène, pour une amplitude `shake` (0 à 1) : un sinus lent. */
export function stalactiteSway(shake: number, seconds: number): number {
  return shake === 0 ? 0 : Math.sin(seconds * TREMBLE_HZ * Math.PI * 2) * TREMBLE * shake;
}

export interface Drip {
  /** Position par rapport à la pointe du corps (tuiles : dx vers la droite, dy vers le bas, ≥ 0) et opacité (0 à 1, 0 aux deux bouts de sa vie). */
  dx: number;
  dy: number;
  opacity: number;
}

/**
 * Les gouttes de glace de l'âge `age` : `DRIP_COUNT` gouttes décalées d'un quart de leur durée qui partent de la pointe, tombent de `DRIP_FALL` tuiles et s'estompent en douceur
 * (opacité en `sin(π × part)` : 0 au début et à la fin, jamais de saut). Seulement pendant le tremblement (âges 1 à `STALACTITE_SHAKE_TICKS`) ; sinon aucune. Fonction pure.
 */
export function stalactiteDrips(age: number): Drip[] {
  if (age < 1 || age > STALACTITE_SHAKE_TICKS) return [];
  const out: Drip[] = [];
  for (let k = 0; k < DRIP_COUNT; k++) {
    const t = (age + (k * DRIP_TICKS) / DRIP_COUNT) % DRIP_TICKS;
    const part = t / DRIP_TICKS;
    // Chaque goutte a sa colonne (deux de chaque côté de la pointe) et la reprend à chaque cycle.
    const cycle = Math.floor((age + (k * DRIP_TICKS) / DRIP_COUNT) / DRIP_TICKS);
    const side = ((k * 7 + cycle * 3) % 5) - 2; // -2 .. 2
    out.push({ dx: side * 0.06, dy: part * DRIP_FALL, opacity: Math.sin(Math.PI * part) });
  }
  return out;
}

/** Durée d'une goutte en secondes (pour les tests de fréquence). */
export const DRIP_SECONDS = DRIP_TICKS / TICK_RATE;

/**
 * La géométrie d'une stalactite « pendante » : origine au milieu de sa racine (y = 0), le corps vers le bas (y < 0) sur `BODY` tuiles. Pièces qui ne se recouvrent pas : le collier
 * de givre, deux faces (éclairée à gauche, à l'ombre à droite) en deux tronçons, deux bandes de cerne, la pointe rouge (`tip`, la couleur du danger du thème).
 */
export function buildStalactiteArt(tip: number): Art {
  const art = new Art();
  const L = STALACTITE_LOOK;
  // Les points du profil (demi-largeur à chaque hauteur) : la boîte mortelle est à ±0,25, le dessin ne la rétrécit jamais avant la pointe.
  const top = 0.12;
  const profile: readonly [y: number, half: number][] = [
    [-top, 0.45],
    [-1.0, 0.31],
    [-TIP_FROM, 0.26],
  ];
  // Le collier de givre (à la racine).
  art.rect(-0.5, -top, 0.5, 0, 0.05, L.frost);
  for (let i = 0; i + 1 < profile.length; i++) {
    const [y0, h0] = profile[i]!;
    const [y1, h1] = profile[i + 1]!;
    // Faces : gauche éclairée, droite à l'ombre, jointes sur l'axe.
    art.quad([-h0, y0, 0, y0, 0, y1, -h1, y1], 0.05, L.light);
    art.quad([0, y0, h0, y0, h1, y1, 0, y1], 0.05, L.shade);
    // Cerne : une bande de 0,06 le long de chaque flanc, hors de la face.
    art.quad([-h0 - 0.06, y0, -h0, y0, -h1, y1, -h1 - 0.06, y1], 0.05, L.outline);
    art.quad([h0, y0, h0 + 0.06, y0, h1 + 0.06, y1, h1, y1], 0.05, L.outline);
  }
  // La pointe : un triangle rouge du bout du profil au bout du corps.
  const h = profile[profile.length - 1]![1];
  const a = art.vertex(-h, -TIP_FROM, 0.06, tip);
  const b = art.vertex(h, -TIP_FROM, 0.06, tip);
  const c = art.vertex(0, -BODY, 0.06, tip);
  art.tri(a, b, c);
  // Le cerne de la pointe : deux fines bandes qui prolongent celles du corps jusqu'au bout.
  art.quad([-h - 0.06, -TIP_FROM, -h, -TIP_FROM, 0, -BODY, -0.02, -BODY], 0.05, L.outline);
  art.quad([h, -TIP_FROM, h + 0.06, -TIP_FROM, 0.02, -BODY, 0, -BODY], 0.05, L.outline);
  return art;
}
