import {
  CELL,
  CUVE_LEFT,
  CUVE_LIP,
  CUVE_RAMP,
  CUVE_RAMP_ARC,
  CUVE_RATIO,
  CUVE_RIGHT,
  WALL_HEIGHT,
  canonVecToWorld,
  curveCenter,
  isCurve,
  turnsLeft,
  type Block,
  type SurfaceKind,
} from "./track";

// Cuves (lot 18) : une paroi qui se relève d'un côté de la route, en quart de cercle puis à la verticale.
//
// Le profil est décrit en travers de la route : `m` = écart à l'axe vers le côté de la paroi (m), `y` = hauteur au-dessus du fond.
//   - le fond est plat jusqu'à `m = f` ;
//   - puis un quart de cercle de rayon `R` centré en (f, R), qui devient vertical en `m = W` (la demi-largeur de la route : `f + R = W`) ;
//   - puis une paroi verticale jusqu'à la hauteur `top` ; au-delà, c'est le vide (la voiture passe par-dessus).
// `R = a × CUVE_RATIO × W` où `a` ∈ [0, 1] est l'amplitude (0 = route plate à rebord de 1,4 m, 1 = cuve complète) : la paroi monte en
// rampe à l'entrée et à la sortie d'une cuve. Un côté sans cuve garde `a = 0` : un simple rebord de `WALL_HEIGHT`.
//
// Pour un virage, le profil est celui de la distance au centre du virage (une surface de révolution) : la normale reste dans
// le plan (rayon, vertical), ce qui est exact. Pour une droite, c'est un cylindre le long de la route (la rampe d'entrée varie
// avec l'avance, ce que la normale ignore : l'écart est faible sur 14 m).
//
// Pas de trigonométrie ici : un quart de cercle se traite avec des racines carrées.

export interface ShellHit {
  /** Distance signée du point à la surface (m) : > 0 dans l'air, < 0 dans la matière. */
  d: number;
  /** Normale unitaire de la surface, vers l'air. */
  nx: number;
  ny: number;
  nz: number;
  /** Direction d'avance de la route à cet endroit (vecteur unitaire horizontal). */
  qx: number;
  qz: number;
  /** Vrai pour une cuve droite (la vitesse « colle » alors la voiture à la paroi : voir `shellStickLo` / `shellStickHi`, car.ts). */
  straight: boolean;
  /** Revêtement du bloc. */
  kind: SurfaceKind;
}

export const createShellHit = (): ShellHit => ({ d: 0, nx: 0, ny: 1, nz: 0, qx: 0, qz: 1, straight: true, kind: "road" });

const smooth = (t: number) => {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * (3 - 2 * c);
};

/**
 * Amplitude (0–1) de la paroi d'un côté du bloc (`bit` = `CUVE_LEFT` ou `CUVE_RIGHT`) au point canonique (p, q) : 0 sans cuve de ce côté,
 * rampe depuis l'entrée et la sortie du bloc sauf si le voisin la prolonge.
 */
export function cuveAmplitude(b: Block, bit: number, p: number, q: number): number {
  if (!(b.cuve & bit)) return 0;
  let tIn: number;
  let tOut: number;
  if (isCurve(b.kind)) {
    // Avancement dans l'arc, sans trigonométrie : q / (q + |dp|) vaut 0 à l'entrée, 1 à la sortie, ½ au milieu.
    const dp = p - curveCenter(b.kind).cp;
    const adp = dp < 0 ? -dp : dp;
    const sum = q + adp;
    const t = sum > 1e-9 ? q / sum : 0;
    tIn = t / CUVE_RAMP_ARC;
    tOut = (1 - t) / CUVE_RAMP_ARC;
  } else {
    tIn = q / CUVE_RAMP;
    tOut = (CELL - q) / CUVE_RAMP;
  }
  const a0 = b.cuveIn & bit ? 1 : smooth(tIn);
  const a1 = b.cuveOut & bit ? 1 : smooth(tOut);
  return a0 * a1;
}

/** Rayon du quart de cercle (m) pour une demi-largeur `W` et une amplitude `a`. */
export const cuveRadius = (W: number, a: number): number => a * CUVE_RATIO * W;
/** Hauteur de la paroi verticale (m) : au moins un rebord ordinaire. */
export const cuveTop = (W: number, a: number): number => {
  const t = cuveRadius(W, a) + a * CUVE_LIP;
  return t > WALL_HEIGHT ? t : WALL_HEIGHT;
};

/** Amplitude à partir de laquelle la paroi verticale est prolongée sans limite de hauteur (physique seulement). */
const CUVE_CONTAIN = 0.5;
const prof = { d: 0, nm: 0, ny: 1 };
/** Lot 58b : la distance rendue au-dessus du vide d'un mur roulable (aucun contact). */
const VIDE = 1e3;
/** Lot 58b : hauteur (m) de la paroi d'un mur roulable au-dessus de son quart de cercle (celle qu'on dessine) : la bande où l'on roule. */
export const MUR_ROULABLE_HAUT = 14;
/** Lot 58b : sous cette part du rayon du quart de cercle, un mur roulable n'a rien (le vide). */
export const MUR_ROULABLE_BAS = 0.5;
const wv = { x: 0, z: 0 };

/** Distance signée et normale (composante vers l'extérieur `nm`, verticale `ny`) du point (m, y) au profil d'un côté. */
function profile(m: number, y: number, W: number, a: number, mur = false, sansFond = false): void {
  const R = cuveRadius(W, a);
  const f = W - R;
  // Lot 58b — mur roulable : ni fond, ni bas du quart de cercle, ni côté opposé au mur ; seuls le haut du quart de cercle (au-dessus de `MUR_ROULABLE_BAS`
  // × son rayon) et la paroi verticale portent la voiture (on y est monté avant ; un contact continu, sans fausse réception au passage du vide).
  if (sansFond && (!mur || m <= f || y < R * MUR_ROULABLE_BAS)) {
    prof.d = VIDE;
    prof.nm = 0;
    prof.ny = 1;
    return;
  }
  if (m <= f) {
    prof.d = y;
    prof.nm = 0;
    prof.ny = 1;
    return;
  }
  if (R > 1e-6 && y < R) {
    // Le quart de cercle : l'air est à l'intérieur du cercle de centre (f, R).
    const dx = m - f;
    const dy = y - R;
    const dist = Math.sqrt(dx * dx + dy * dy);
    prof.d = R - dist;
    if (dist > 1e-9) {
      prof.nm = -dx / dist;
      prof.ny = -dy / dist;
    } else {
      prof.nm = 0;
      prof.ny = 1;
    }
    return;
  }
  // Lot 58b — le mur roulable a une crête (`MUR_ROULABLE_HAUT` au-dessus du quart de cercle) : au-delà, on passe par-dessus et l'on tombe.
  const top = sansFond ? R + MUR_ROULABLE_HAUT : cuveTop(W, a);
  // Une cuve pleine retient la voiture sans limite de hauteur : la crête dessinée n'est qu'une façon de voir (une voiture lancée vers le
  // haut, trop vite, retombe dans la cuve au lieu de passer de l'autre côté). Une paroi en rampe, elle, a sa crête : on passe par-dessus.
  if (y <= top || (a >= CUVE_CONTAIN && !sansFond)) {
    // La paroi, ou (au pied d'un rebord sans quart de cercle, ou sous le fond) le fond : la matière est l'union de la dalle du fond et de
    // la paroi, donc la distance est la plus petite des deux — une voiture tombée le long d'un rebord ne s'enfonce pas sous le fond.
    const dw = W - m;
    if (y < dw && !sansFond) {
      prof.d = y;
      prof.nm = 0;
      prof.ny = 1;
    } else {
      prof.d = dw;
      prof.nm = -1;
      prof.ny = 0;
    }
    return;
  }
  // Au-dessus de la paroi : le plus proche est son arête.
  const dm = m - W;
  const dy = y - top;
  const dist = Math.sqrt(dm * dm + dy * dy);
  prof.d = dist;
  prof.nm = dm / dist;
  prof.ny = dy / dist;
}

/**
 * Surface d'un bloc de cuve en un point du monde. `p`, `q` : repère canonique du bloc ; `y` : hauteur du point au-dessus du fond.
 * Remplit `out` (distance, normale, direction d'avance) ; l'appelant a vérifié que `b.cuve` n'est pas nul.
 */
export function shellAt(b: Block, p: number, q: number, y: number, out: ShellHit): void {
  const W = b.w0 / 2;
  let lam: number; // écart latéral, positif vers la gauche
  let lp: number; // direction « gauche » en (p, q)
  let lq: number;
  let tp: number; // direction d'avance en (p, q)
  let tq: number;
  if (isCurve(b.kind)) {
    const { cp, r: rc } = curveCenter(b.kind);
    const dp = p - cp;
    const r = Math.sqrt(dp * dp + q * q);
    const inv = r > 1e-9 ? 1 / r : 0;
    if (turnsLeft(b.kind)) {
      lam = rc - r;
      lp = -dp * inv;
      lq = -q * inv;
      tp = q * inv;
      tq = -dp * inv;
    } else {
      lam = r - rc;
      lp = dp * inv;
      lq = q * inv;
      tp = -q * inv;
      tq = dp * inv;
    }
    out.straight = false;
  } else {
    lam = p - CELL / 2;
    lp = 1;
    lq = 0;
    tp = 0;
    tq = 1;
    out.straight = true;
  }
  const left = lam >= 0;
  const bit = left ? CUVE_LEFT : CUVE_RIGHT;
  profile(left ? lam : -lam, y, W, cuveAmplitude(b, bit, p, q), b.floorless === true && (b.cuve & bit) !== 0, b.floorless === true);
  const nl = left ? prof.nm : -prof.nm; // composante de la normale vers la gauche
  out.d = prof.d;
  canonVecToWorld(b.dir, lp, lq, wv);
  out.nx = nl * wv.x;
  out.nz = nl * wv.z;
  out.ny = prof.ny;
  canonVecToWorld(b.dir, tp, tq, wv);
  out.qx = wv.x;
  out.qz = wv.z;
  out.kind = b.surface;
}

/**
 * Hauteur du fond (au-dessus de `b.y0`) au point canonique (p, q), pour les lecteurs qui n'ont besoin que d'une hauteur
 * (échantillons de sol des effets) : la paroi est tronquée à ≈ 80°. Renvoie `NaN` hors de la route.
 */
export function cuveHeight(b: Block, p: number, q: number): number {
  const W = b.w0 / 2;
  let lam: number;
  if (isCurve(b.kind)) {
    const { cp, r: rc } = curveCenter(b.kind);
    const dp = p - cp;
    const r = Math.sqrt(dp * dp + q * q);
    lam = turnsLeft(b.kind) ? rc - r : r - rc;
  } else lam = p - CELL / 2;
  const left = lam >= 0;
  const m = left ? lam : -lam;
  if (m > W) return NaN;
  const a = cuveAmplitude(b, left ? CUVE_LEFT : CUVE_RIGHT, p, q);
  const R = cuveRadius(W, a);
  const f = W - R;
  // Lot 58b — mur roulable : le vide (la paroi, verticale, n'est pas un sol pour ceux qui lisent une hauteur).
  if (b.floorless) return NaN;
  if (m <= f || R < 1e-6) return 0;
  const dx = m - f;
  const lim = 0.985 * R; // ≈ 80° : la dernière hauteur d'un sol qui monte presque à la verticale
  const x = dx > lim ? lim : dx;
  return R - Math.sqrt(R * R - x * x);
}
