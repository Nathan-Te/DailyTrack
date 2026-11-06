import { PerspectiveCamera, Vector3 } from "three";

// La caméra de Rush (lots BR0b, BR0c). Haute (plongée de 46° au-dessus de l'horizon), LOIN (34 m), champ SERRÉ (25°) : on voit presque toute l'arène, le chevalier fait environ 8 % de la hauteur de l'écran (comme dans `cible-ia.png`), sans
// la déformation d'un grand angle. Le même cadre vaut pour le jeu ET la vitrine.
//  · le point regardé suit le chevalier à moitié (il parcourt la moitié du chemin du centre de l'arène au chevalier) : l'arène reste cadrée, le chevalier se promène dans l'image ;
//  · le golem (jusqu'au sommet de sa tête) et les cercles qui vont tomber restent dans l'image : si besoin la caméra recule un peu (jamais de plus de ×1,25) puis se décale.
// Les trois réglages (`?debug&tune`) sont l'angle, la distance de base et le champ. Ce fichier ne dessine rien : il pose une `PerspectiveCamera`.

export interface ReglageCamera {
  /** L'angle de plongée, en degrés au-dessus de l'horizon (90 : à la verticale). */
  angle: number;
  /** La distance de base de la caméra à ce qu'elle regarde, en mètres (elle s'allonge pour garder le golem dans le champ). */
  distance: number;
  /** Le champ vertical, en degrés. */
  champ: number;
}
// Lot BR1 : 41° (au lieu de 46°) pour que le chevalier montre son corps et sa direction ; l'arène reste cadrée (`test/camera.test.ts`).
export const CAMERA_DEFAUT: ReglageCamera = { angle: 41, distance: 34, champ: 25 };

/** Un point du monde à garder dans l'image : (x, z) au sol, `haut` en hauteur, `r` le rayon de marge autour de lui au sol. */
export interface PointCadre {
  x: number;
  z: number;
  haut?: number;
  r?: number;
}

const RAD = Math.PI / 180;
/** La part du chemin du centre de l'arène au chevalier que le point regardé parcourt. */
const SUIVI = 0.5;
/** Le point regardé est un peu au SUD du centre (valeur négative = vers le sud) : à cette hauteur le haut de l'écran voit plus loin que le bas ne voit près ; ainsi le muret du nord, les îles et les nuages restent dans l'image, et le bas ne coupe qu'un peu de l'arène. */
const DECALAGE_NORD = -1.0;
/** Où les points à garder doivent tenir (écran de −1 à 1) : à gauche et à droite 0,92 ; en haut 0,92 ; en bas 0,8 (la barre du golem et les boutons occupent le bas de l'écran). */
const MARGE_X = 0.92;
const HAUT_MAX = 0.92;
const BAS_MAX = 0.8;
/** La caméra ne s'éloigne jamais de plus de ce facteur de sa distance de base pour garder le golem (au-delà, tout rapetisse : mieux vaut en laisser sortir un bout). */
const RECUL_MAX = 1.25;
/** Au moins cette largeur de sol dans l'image (mètres) : le portrait ne coupe pas l'arène. */
const LARGEUR_MIN = 11;

const v = new Vector3();
const essai = new PerspectiveCamera();

/** La position de la caméra qui regarde (tx, 0, tz) de `distance` mètres, à l'angle donné, depuis le sud (+z : le bas de l'écran). */
function poser(c: PerspectiveCamera, tx: number, tz: number, distance: number, angle: number): void {
  const phi = angle * RAD;
  c.position.set(tx, Math.sin(phi) * distance, tz + Math.cos(phi) * distance);
  c.lookAt(tx, 0, tz);
  c.updateMatrixWorld(true);
}

/** Les coordonnées d'écran (−1 à 1) d'un point du monde vu de `c`. */
function ecran(c: PerspectiveCamera, x: number, y: number, z: number): [number, number] {
  v.set(x, y, z).project(c);
  return [v.x, v.y];
}

/** Les points de l'écran (−1 à 1) des points à garder, et leurs étendues. */
function etendues(c: PerspectiveCamera, points: readonly PointCadre[]): { xmin: number; xmax: number; ymin: number; ymax: number } {
  let xmin = Infinity;
  let xmax = -Infinity;
  let ymin = Infinity;
  let ymax = -Infinity;
  for (const p of points) {
    const r = p.r ?? 0;
    const pts: [number, number, number][] = p.haut ? [[p.x, p.haut, p.z]] : [];
    if (r > 0) pts.push([p.x + r, 0, p.z], [p.x - r, 0, p.z], [p.x, 0, p.z + r], [p.x, 0, p.z - r]);
    else if (!p.haut) pts.push([p.x, 0, p.z]);
    for (const [x, y, z] of pts) {
      const [sx, sy] = ecran(c, x, y, z);
      if (sx < xmin) xmin = sx;
      if (sx > xmax) xmax = sx;
      if (sy < ymin) ymin = sy;
      if (sy > ymax) ymax = sy;
    }
  }
  return { xmin, xmax, ymin, ymax };
}

/** Le facteur dont il faut éloigner la caméra pour que tous les points tiennent dans l'image (1 : ils tiennent déjà). */
export function facteurDeCadrage(c: PerspectiveCamera, points: readonly PointCadre[]): number {
  const e = etendues(c, points);
  return Math.max(1, (e.ymax - e.ymin) / (BAS_MAX + HAUT_MAX), (e.xmax - e.xmin) / (2 * MARGE_X));
}

/** Le niveau du jour (lot BR1) : la caméra SUIT le chevalier le long du chemin (amorti, regard un peu en avant dans le sens du déplacement) et se fond dans le cadrage de l'arène quand il s'en approche. */
export interface ModeNiveau {
  /** Le centre de l'arène (mètres). */
  arene: { x: number; z: number };
  /** 0 : suit le chevalier ; 1 : cadre l'arène (comme au BR0c). */
  melange: number;
}
/** Le regard en avant : la vitesse du chevalier (m/s) × ce temps, au plus `AVANCE_MAX` mètres. */
const AVANCE_S = 0.6;
const AVANCE_MAX = 3.4;
/** En suivi, le point regardé est un peu devant le chevalier (vers le haut de l'écran) : on voit plus loin devant que derrière. */
const DEVANT = 2.4;

export class CameraRush {
  readonly camera = new PerspectiveCamera(CAMERA_DEFAUT.champ, 2, 0.5, 200);
  private tx = 0;
  private tz = 0;
  private dist = CAMERA_DEFAUT.distance;
  private neuf = true;
  /** Lot BR1 : la vitesse lissée du chevalier (m/s), pour regarder devant. */
  private px = 0;
  private pz = 0;
  private vx = 0;
  private vz = 0;
  private pose = false;

  /** Où la caméra regarde, au sol (mètres) : de quoi suivre l'ombre portée du soleil. */
  get regard(): { x: number; z: number } {
    return { x: this.tx, z: this.tz };
  }

  /** Le point regardé et la distance en SUIVI (hors de l'arène) : devant le chevalier, dans le sens où il va. Pure. */
  butSuivi(reg: ReglageCamera, aspect: number, cx: number, cz: number, vx: number, vz: number): { tx: number; tz: number; distance: number } {
    const champ = reg.champ;
    const largeurMin = LARGEUR_MIN / (2 * Math.tan((champ * RAD) / 2) * Math.max(0.3, aspect));
    const vit = Math.hypot(vx, vz);
    const avance = Math.min(AVANCE_MAX, vit * AVANCE_S);
    const k = vit > 0.01 ? avance / vit : 0;
    return { tx: cx + vx * k, tz: cz + vz * k - DEVANT, distance: Math.max(reg.distance, largeurMin) };
  }

  /** Le point regardé et la distance voulus (sans amorti) pour un chevalier en (cx, cz) et ce qu'il faut garder dans l'image : une fonction pure de ses arguments, que les tests lisent. */
  but(reg: ReglageCamera, aspect: number, cx: number, cz: number, golem: { x: number; z: number } | null, garder: readonly PointCadre[], arene?: { x: number; z: number }): { tx: number; tz: number; distance: number } {
    if (arene && (arene.x !== 0 || arene.z !== 0)) {
      // Le cadrage de l'arène se calcule autour de son centre.
      const r = this.but(reg, aspect, cx - arene.x, cz - arene.z, golem ? { x: golem.x - arene.x, z: golem.z - arene.z } : null, garder.map((p) => ({ ...p, x: p.x - arene.x, z: p.z - arene.z })));
      return { tx: r.tx + arene.x, tz: r.tz + arene.z, distance: r.distance };
    }
    const champ = reg.champ;
    const largeurMin = LARGEUR_MIN / (2 * Math.tan((champ * RAD) / 2) * Math.max(0.3, aspect));
    const base = Math.max(reg.distance, largeurMin);
    let tx = cx * SUIVI;
    let tz = cz * SUIVI - DECALAGE_NORD;
    if (golem) {
      // Un peu vers le golem : l'image se centre entre le chevalier et lui.
      tx += golem.x * 0.08;
      tz += golem.z * 0.08;
    }
    let distance = base;
    essai.fov = champ;
    essai.aspect = aspect;
    essai.updateProjectionMatrix();
    const points: PointCadre[] = [{ x: cx, z: cz, haut: 1.5, r: 0.5 }, ...garder];
    // Reculer juste assez pour que tout tienne (jamais de plus de RECUL_MAX fois la distance de base), puis se décaler de ce qu'il faut. La perspective n'est pas linéaire : quelques passes.
    for (let i = 0; i < 6; i++) {
      poser(essai, tx, tz, distance, reg.angle);
      const e = etendues(essai, points);
      const k = Math.max((e.ymax - e.ymin) / (BAS_MAX + HAUT_MAX), (e.xmax - e.xmin) / (2 * MARGE_X));
      if (k > 1.001 && distance < base * RECUL_MAX) distance = Math.min(base * RECUL_MAX, distance * Math.min(k, 1.2));
      poser(essai, tx, tz, distance, reg.angle);
      const f = etendues(essai, points);
      const dy = f.ymax > HAUT_MAX ? HAUT_MAX - f.ymax : f.ymin < -BAS_MAX ? -BAS_MAX - f.ymin : 0;
      if (dy !== 0) {
        // Combien vaut un mètre de sol en plus (vers le bas de l'écran) ? mesuré, pas supposé.
        poser(essai, tx, tz + 1, distance, reg.angle);
        const parMetre = etendues(essai, points).ymin - f.ymin;
        if (Math.abs(parMetre) > 1e-4) tz += dy / parMetre;
      }
      poser(essai, tx, tz, distance, reg.angle);
      const ex = etendues(essai, points);
      const dx = ex.xmin < -MARGE_X ? -MARGE_X - ex.xmin : ex.xmax > MARGE_X ? MARGE_X - ex.xmax : 0;
      if (dx !== 0) {
        poser(essai, tx + 1, tz, distance, reg.angle);
        const px = etendues(essai, points).xmin - ex.xmin;
        if (Math.abs(px) > 1e-4) tx += dx / px;
      }
    }
    return { tx, tz, distance };
  }

  /** Une image : amortit vers le but et pose la caméra. `secousse` décale le tout (mètres, au sol). */
  maj(dt: number, reg: ReglageCamera, aspect: number, cx: number, cz: number, golem: { x: number; z: number } | null, garder: readonly PointCadre[], secousse: { x: number; z: number } = { x: 0, z: 0 }, niveau?: ModeNiveau): void {
    // La vitesse lissée du chevalier (le regard en avant).
    if (this.pose && dt > 0) {
      const f = 1 - Math.exp(-dt * 4);
      this.vx += ((cx - this.px) / dt - this.vx) * f;
      this.vz += ((cz - this.pz) / dt - this.vz) * f;
    }
    this.px = cx;
    this.pz = cz;
    this.pose = true;
    let b: { tx: number; tz: number; distance: number };
    if (niveau) {
      const a = this.but(reg, aspect, cx, cz, golem, garder, niveau.arene);
      if (niveau.melange >= 1) b = a;
      else {
        const s = this.butSuivi(reg, aspect, cx, cz, this.vx, this.vz);
        const m = niveau.melange;
        b = { tx: s.tx + (a.tx - s.tx) * m, tz: s.tz + (a.tz - s.tz) * m, distance: s.distance + (a.distance - s.distance) * m };
      }
    } else b = this.but(reg, aspect, cx, cz, golem, garder);
    if (this.neuf) {
      this.tx = b.tx;
      this.tz = b.tz;
      this.dist = b.distance;
      this.neuf = false;
    } else {
      const k = 1 - Math.exp(-dt * (niveau && niveau.melange < 0.5 ? 5 : 7));
      const kd = 1 - Math.exp(-dt * (b.distance > this.dist ? 4 : 2));
      this.tx += (b.tx - this.tx) * k;
      this.tz += (b.tz - this.tz) * k;
      this.dist += (b.distance - this.dist) * kd;
    }
    const c = this.camera;
    if (c.fov !== reg.champ || c.aspect !== aspect) {
      c.fov = reg.champ;
      c.aspect = aspect;
      c.updateProjectionMatrix();
    }
    poser(c, this.tx + secousse.x, this.tz + secousse.z, this.dist, reg.angle);
  }

  /** La caméra est reposée d'un coup au prochain `maj` (un nouveau départ). */
  recommencer(): void {
    this.neuf = true;
    this.pose = false;
    this.vx = 0;
    this.vz = 0;
  }
}
