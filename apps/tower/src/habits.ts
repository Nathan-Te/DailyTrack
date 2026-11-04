import type { Box8 } from "@cdj/tower-sim/lab/pieces";
import type { Effet, Taille } from "@cdj/tower-sim";
import { Group } from "three";
import { BORD, ENCRE, melanger } from "@cdj/visuels/blocs";
import { boite, pointesEncre, poly, polyEncre, rond, rondEncre, trait } from "./polygones";

// Lot T9 — **l'habit des effets** : la pièce porte son effet sur tout son corps, tant qu'il dure — ce n'est plus un liseré. Figée : un habit de CHANTIER boulonné (plaques d'acier aux coins, bande rayée jaune et noire,
// deux équerres vissées avec leurs étincelles, une clé) ; lierre : une liane, des feuilles, une feuille-agrafe à chaque soudure ; glissante : prise dans le VERGLAS (bord de glace épais — dans `construirePiece` —, facettes
// blanches, glaçons, gouttes de fonte, flocons, traits de glissade) ; petite : des étincelles et le contour pointillé de la taille normale qui se resserre ; géante : une bande d'ombre, des rivets, une goutte de sueur
// (les fissures et la poussière de sa pose sont dans `taquetFx.ts`) ; coup de vent : un tourbillon et des feuilles qui volent.
//
// **Tout est de l'affichage**, dessiné dans le repère de la pièce (mètres, centre de masse à l'origine), en aplats bordés d'encre, sans dégradé ni image. Les soudures du lierre sont LUES dans les joints de Rapier
// (`Partie.soudures()`, une lecture seule entre deux ticks) ; rien n'est écrit dans la simulation. Chargé À LA DEMANDE, à la première pièce qui porte un effet (jamais dans l'accueil ni dans le jeu).

const VERT = "#5DBB63";
const VERT_FONCE = "#2F7D3A";
const ACIER = "#A7A9AC";
const ACIER_FONCE = "#6B6E72";
const JAUNE = "#F2B705";
const ETINCELLE = "#F2B544";
const GLACE = "#BFE6F5";
const BLANC = "#FFFFFF";
const SUEUR = "#BFE6F5";

/** Une soudure du lierre (`Partie.soudures()`), centres en mètres du monde. */
export interface Soudure {
  id: number;
  vers: number;
  x: number;
  y: number;
  px: number;
  py: number;
}
/** Ce que la scène donne à un habit à chaque image. */
export interface ContexteHabit {
  /** Le temps d'affichage (s) et l'âge de la pièce (s depuis qu'elle est dessinée). */
  t: number;
  age: number;
  reduit: boolean;
  /** Le sens du vent (−1, 0, 1) pour la pièce en main, l'angle de la pièce, les soudures de la partie. */
  sensVent: number;
  angle: number;
  soudures: readonly Soudure[];
}
export interface Habit {
  maj(c: ContexteHabit): void;
}
export interface DemandeHabit {
  bs: readonly Box8[];
  id: number;
  effet: Effet | null;
  fixe: boolean;
  taille: Taille;
  couleur: string;
}

interface B {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}
interface Geo {
  boites: B[];
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}
export function geometrie(bs: readonly Box8[]): Geo {
  const boites = bs.map((b) => ({ x0: (b.cx - b.hw) / 8, x1: (b.cx + b.hw) / 8, y0: (b.cy - b.hh) / 8, y1: (b.cy + b.hh) / 8 }));
  return { boites, x0: Math.min(...boites.map((b) => b.x0)), x1: Math.max(...boites.map((b) => b.x1)), y0: Math.min(...boites.map((b) => b.y0)), y1: Math.max(...boites.map((b) => b.y1)) };
}
const dedans = (g: Geo, x: number, y: number, sauf: B): boolean => g.boites.some((b) => b !== sauf && x > b.x0 + 1e-6 && x < b.x1 - 1e-6 && y > b.y0 + 1e-6 && y < b.y1 - 1e-6);
/** Le coin (sx, sy = ±1) de la boîte `b` est-il un coin convexe de la pièce (rien d'autre à côté, au-dessus ni en diagonale) ? */
const coinExterieur = (g: Geo, b: B, sx: number, sy: number): boolean => {
  const x = sx > 0 ? b.x1 : b.x0;
  const y = sy > 0 ? b.y1 : b.y0;
  const e = 0.05;
  return !dedans(g, x + sx * e, y + sy * e, b) && !dedans(g, x + sx * e, y - sy * e, b) && !dedans(g, x - sx * e, y + sy * e, b);
};
/** Un bord (haut, bas, gauche, droite) de la boîte est-il libre (rien de la pièce de l'autre côté) ? */
const bordLibre = (g: Geo, b: B, cote: "haut" | "bas" | "gauche" | "droite"): boolean => {
  const e = 0.05;
  const cx = (b.x0 + b.x1) / 2;
  const cy = (b.y0 + b.y1) / 2;
  const p = cote === "haut" ? [cx, b.y1 + e] : cote === "bas" ? [cx, b.y0 - e] : cote === "gauche" ? [b.x0 - e, cy] : [b.x1 + e, cy];
  return !dedans(g, p[0]!, p[1]!, b);
};

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// La pièce figée : un habit de chantier boulonné.
function figee(g: Group, geo: Geo): Habit {
  const z = 0.014;
  // La bande rayée jaune et noire, sur la rangée du bas.
  for (const b of geo.boites.filter((b) => b.y0 - geo.y0 < 1e-6)) {
    const h = Math.min(0.26, (b.y1 - b.y0) * 0.28);
    const y = b.y0 + BORD + 0.1 + h / 2;
    const x0 = b.x0 + BORD + 0.06;
    const x1 = b.x1 - BORD - 0.06;
    g.add(boite(JAUNE, (x0 + x1) / 2, y, x1 - x0, h, z));
    for (let x = x0 + 0.04; x + 0.12 + h * 0.8 < x1; x += 0.3) g.add(poly(ENCRE, [x, y - h / 2, x + 0.12, y - h / 2, x + 0.12 + h * 0.8, y + h / 2, x + h * 0.8, y + h / 2], z + 0.001));
  }
  // Les plaques d'acier aux coins convexes, chacune avec son boulon.
  for (const b of geo.boites) {
    const s = Math.min(0.3, 0.3 * Math.min(b.x1 - b.x0, b.y1 - b.y0));
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      if (!coinExterieur(geo, b, sx, sy)) continue;
      const cx = (sx > 0 ? b.x1 : b.x0) - sx * (BORD + s / 2 + 0.02);
      const cy = (sy > 0 ? b.y1 : b.y0) - sy * (BORD + s / 2 + 0.02);
      g.add(polyEncre(ACIER, [cx - s / 2, cy - s / 2, cx + s / 2, cy - s / 2, cx + s / 2, cy + s / 2, cx - s / 2, cy + s / 2], 0.025, z + 0.002));
      g.add(rondEncre(ACIER_FONCE, cx, cy, s * 0.17, 0.02, z + 0.004));
    }
  }
  // Les deux équerres vissées, en bas à gauche et à droite : une barre contre le flanc, un pied sous la pièce, là où elle se fige.
  const bas = geo.y0;
  for (const cote of [-1, 1]) {
    const bord = cote < 0 ? geo.x0 : geo.x1;
    const pts = [bord + cote * 0.04, bas + 0.9, bord - cote * 0.22, bas + 0.9, bord - cote * 0.22, bas - 0.32, bord - cote * 0.95, bas - 0.32, bord - cote * 0.95, bas - 0.06, bord + cote * 0.04, bas - 0.06];
    g.add(polyEncre(ACIER, pts, 0.03, z + 0.003));
    for (const [dx, dy] of [[0.09, 0.62], [0.09, 0.25], [0.55, -0.19]] as const) g.add(rondEncre(ACIER_FONCE, bord - cote * dx, bas + dy, 0.045, 0.02, z + 0.005));
  }
  // La clé (un trait épais et une tête), posée contre le coin haut droit.
  g.add(trait(ACIER_FONCE, geo.x1 + 0.12, geo.y1 - 0.1, geo.x1 + 0.5, geo.y1 + 0.32, 0.1, 0.06));
  g.add(rondEncre(ACIER, geo.x1 + 0.52, geo.y1 + 0.34, 0.13, 0.03, 0.062));
  g.add(rond(ENCRE, geo.x1 + 0.55, geo.y1 + 0.37, 0.05, 0.064));
  // Les étincelles : aux deux pieds, elles brillent quand la pièce se fige puis se calment.
  const etincelles = [-1, 1].map((cote) => {
    const e = pointesEncre(ETINCELLE, 0, 0, 0.2, 0.07, 4, 0.07, 0.4);
    e.position.set((cote < 0 ? geo.x0 : geo.x1) + cote * 0.35, geo.y0 + 0.1, 0);
    g.add(e);
    return e;
  });
  return {
    maj: (c) => {
      const k = c.reduit ? 0.8 : c.age < 1.6 ? 0.85 + 0.3 * Math.sin(c.t * 14) : 0.55;
      etincelles.forEach((e, i) => e.scale.setScalar(k * (i === 0 ? 1 : 0.9)));
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// Le lierre : une liane qui court sur la pièce, des feuilles, une feuille-agrafe à chaque soudure.
const feuille = (cx: number, cy: number, a: number, s = 1): Group => {
  const c = Math.cos(a);
  const sn = Math.sin(a);
  const p = [[-0.15, 0], [0, 0.09], [0.15, 0], [0, -0.09]].flatMap(([x, y]) => [cx + (x! * c - y! * sn) * s, cy + (x! * sn + y! * c) * s]);
  return polyEncre(VERT, p, 0.025, 0.017);
};
function lierre(g: Group, geo: Geo): Habit {
  const z = 0.013;
  const vigne = (x1: number, y1: number, x2: number, y2: number, amp: number): void => {
    const n = Math.max(2, Math.round(Math.hypot(x2 - x1, y2 - y1) / 0.28));
    let px = x1;
    let py = y1;
    for (let i = 1; i <= n; i++) {
      const k = i / n;
      const nx = x1 + (x2 - x1) * k + (y2 === y1 ? 0 : amp * Math.sin(i * 2.1));
      const ny = y1 + (y2 - y1) * k + (y2 === y1 ? amp * Math.sin(i * 2.1 + x1 * 3) : 0);
      g.add(trait(VERT_FONCE, px, py, nx, ny, 0.09, z));
      if (i % 2 === 0) g.add(feuille(nx, ny + (y2 === y1 ? 0.07 : 0), (y2 === y1 ? 0.6 : 1.9) * (i % 4 === 0 ? 1 : -1), 1));
      px = nx;
      py = ny;
    }
  };
  for (const b of geo.boites) {
    if (bordLibre(geo, b, "haut")) vigne(b.x0 + 0.1, b.y1 - 0.15, b.x1 - 0.1, b.y1 - 0.15, 0.06);
    if (bordLibre(geo, b, "gauche")) vigne(b.x0 + 0.13, b.y1 - 0.18, b.x0 + 0.13, b.y0 + 0.15, 0.05);
    if (bordLibre(geo, b, "droite")) vigne(b.x1 - 0.13, b.y1 - 0.18, b.x1 - 0.13, b.y0 + 0.15, 0.05);
  }
  // Les feuilles-agrafes : une par soudure, du côté du corps soudé (calculée dans le repère de la pièce à chaque changement des soudures).
  const agrafes = new Map<number, Group>();
  const demi = { x: (geo.x1 - geo.x0) / 2, y: (geo.y1 - geo.y0) / 2 };
  const milieu = { x: (geo.x0 + geo.x1) / 2, y: (geo.y0 + geo.y1) / 2 };
  let derniere: readonly Soudure[] | null = null;
  return {
    maj: (c) => {
      if (c.soudures === derniere) return;
      derniere = c.soudures;
      const aLui = c.soudures.filter((s) => s.id === idHabit.get(g));
      for (const [k, m] of agrafes) {
        g.remove(m);
        agrafes.delete(k);
      }
      aLui.forEach((s, i) => {
        // Le sens du corps soudé dans le repère de la pièce (tourné de −angle), puis le bord de la boîte englobante dans ce sens.
        const dx = s.px - s.x;
        const dy = s.py - s.y;
        const co = Math.cos(-c.angle);
        const si = Math.sin(-c.angle);
        const lx = dx * co - dy * si;
        const ly = dx * si + dy * co;
        const k = Math.min(1, lx === 0 ? Infinity : demi.x / Math.abs(lx), ly === 0 ? Infinity : demi.y / Math.abs(ly));
        const ax = milieu.x + lx * k * 0.98;
        const ay = milieu.y + ly * k * 0.98;
        const a = polyEncre(VERT, [-0.17, 0, 0.17, 0, 0, -0.36], 0.035, 0.019);
        a.position.set(ax, ay, 0);
        a.rotation.z = Math.atan2(ly, lx) + Math.PI / 2;
        g.add(a);
        agrafes.set(i, a);
      });
    },
  };
}
/** L'identifiant de la pièce d'un groupe (pour filtrer ses soudures). */
const idHabit = new WeakMap<Group, number>();

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// La pièce glissante : prise dans le verglas (le bord de glace épais et la teinte givrée sont posés par `construirePiece`).
function glissante(g: Group, geo: Geo): Habit {
  const z = 0.013;
  const marge = BORD + 0.2;
  for (const b of geo.boites) {
    const s = Math.min(0.32, 0.3 * Math.min(b.x1 - b.x0, b.y1 - b.y0));
    // Les facettes blanches : un triangle au coin haut gauche, un autre plus petit au coin bas droit, à l'intérieur de la glace.
    g.add(poly(BLANC, [b.x0 + marge * 0.55, b.y1 - marge * 0.55, b.x0 + marge * 0.55 + s, b.y1 - marge * 0.55, b.x0 + marge * 0.55, b.y1 - marge * 0.55 - s], z));
    g.add(poly(BLANC, [b.x1 - marge * 0.55, b.y0 + marge * 0.55, b.x1 - marge * 0.55 - s * 0.55, b.y0 + marge * 0.55, b.x1 - marge * 0.55, b.y0 + marge * 0.55 + s * 0.55], z));
  }
  // Les glaçons sous les boîtes du bas, et leurs gouttes de fonte.
  const gouttes: Group[] = [];
  const bas = geo.boites.filter((b) => b.y0 - geo.y0 < 1e-6 && bordLibre(geo, b, "bas"));
  bas.forEach((b, i) => {
    for (const x of [b.x0 + 0.28, b.x1 - 0.34]) {
      g.add(polyEncre(GLACE, [x - 0.09, b.y0 + 0.03, x + 0.09, b.y0 + 0.03, x, b.y0 - 0.3 - 0.06 * (i % 2)], 0.03, 0.011));
      const d = rondEncre(GLACE, x + 0.02, b.y0 - 0.5, 0.05, 0.025, 0.012);
      g.add(d);
      gouttes.push(d);
    }
  });
  // Les flocons, aux coins hauts, et les traits de glissade, derrière.
  const flocons = [[geo.x0 - 0.22, geo.y1 + 0.08], [geo.x1 + 0.2, geo.y1 - 0.2]].map(([x, y]) => {
    const f = new Group();
    for (let k = 0; k < 3; k++) f.add(trait(BLANC, -0.13, 0, 0.13, 0, 0.045, 0.06 + k * 0.0001));
    f.children.forEach((c, k) => (c.rotation.z = (k * Math.PI) / 3));
    f.position.set(x!, y!, 0);
    g.add(f);
    return f;
  });
  const glisse = [trait(ENCRE, geo.x1 + 0.12, geo.y0 + 0.45, geo.x1 + 0.7, geo.y0 + 0.45, 0.06, 0.05), trait(ENCRE, geo.x1 + 0.2, geo.y0 + 0.65, geo.x1 + 0.55, geo.y0 + 0.65, 0.05, 0.05)];
  for (const m of glisse) g.add(m);
  return {
    maj: (c) => {
      gouttes.forEach((d, i) => {
        const k = c.reduit ? 0 : (c.t * 0.5 + i * 0.37) % 1;
        d.position.y = -k * 0.45;
        d.scale.setScalar(1 - k * 0.5);
      });
      flocons.forEach((f, i) => {
        f.rotation.z = c.reduit ? 0 : c.t * 0.6 * (i === 0 ? 1 : -1);
        f.scale.setScalar(c.reduit ? 1 : 0.85 + 0.2 * Math.sin(c.t * 3 + i));
      });
      glisse.forEach((m, i) => (m.visible = c.reduit || Math.sin(c.t * 8 + i * 2) > -0.6));
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// La petite pièce : des étincelles et le contour pointillé de la taille normale, qui se resserre à l'apparition.
function petite(g: Group, geo: Geo): Habit {
  const cx = (geo.x0 + geo.x1) / 2;
  const cy = (geo.y0 + geo.y1) / 2;
  const w = (geo.x1 - geo.x0) * 2;
  const h = (geo.y1 - geo.y0) * 2;
  const contour = new Group();
  const tiret = (x: number, y: number, l: number, ep: number): void => void contour.add(boite("#FFF6E0", x, y, l, ep, 0.012));
  for (let x = -w / 2 + 0.1; x < w / 2 - 0.15; x += 0.3) {
    tiret(x + 0.08, -h / 2, 0.16, 0.06);
    tiret(x + 0.08, h / 2, 0.16, 0.06);
  }
  for (let y = -h / 2 + 0.1; y < h / 2 - 0.15; y += 0.3) {
    tiret(-w / 2, y + 0.08, 0.06, 0.16);
    tiret(w / 2, y + 0.08, 0.06, 0.16);
  }
  contour.position.set(cx, cy, 0);
  g.add(contour);
  const etincelles = [[geo.x1 + 0.28, geo.y1 + 0.1], [geo.x0 - 0.25, geo.y1 - 0.05], [geo.x1 + 0.22, geo.y0 + 0.1]].map(([x, y], i) => {
    const e = pointesEncre(ETINCELLE, 0, 0, 0.17 - i * 0.02, 0.06, 4, 0.07, 0.3);
    e.position.set(x!, y!, 0);
    g.add(e);
    return e;
  });
  return {
    maj: (c) => {
      // Le contour pointillé de la taille normale se resserre sur la petite pièce pendant la première seconde, puis s'efface.
      const k = c.reduit ? 1 : Math.min(1, c.age / 0.9);
      contour.visible = c.age < 1.2;
      contour.scale.setScalar(1.25 - 0.25 * k);
      etincelles.forEach((e, i) => e.scale.setScalar(c.reduit ? 1 : 0.75 + 0.3 * Math.sin(c.t * 5 + i * 2.1)));
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// La pièce géante : une bande d'ombre en aplat, des rivets, une goutte de sueur.
function geante(g: Group, geo: Geo, couleur: string): Habit {
  const z = 0.013;
  const ombre = melanger(couleur, ENCRE, 0.3);
  const marge = BORD * 2.2;
  for (const b of geo.boites) {
    if (bordLibre(geo, b, "bas")) g.add(boite(ombre, (b.x0 + b.x1) / 2, b.y0 + marge + 0.17, b.x1 - b.x0 - 2 * marge, 0.34, z));
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) if (coinExterieur(geo, b, sx, sy)) g.add(rond(ENCRE, (sx > 0 ? b.x1 : b.x0) - sx * (marge + 0.12), (sy > 0 ? b.y1 : b.y0) - sy * (marge + 0.12), 0.07, z + 0.001));
  }
  const grande = geo.boites.reduce((a, b) => (b.x1 - b.x0 > a.x1 - a.x0 ? b : a));
  const goutte = polyEncre(SUEUR, [0, 0.2, 0.09, 0.02, 0.07, -0.06, 0, -0.1, -0.07, -0.06, -0.09, 0.02], 0.025, 0.07);
  goutte.position.set(grande.x1 - 0.3, grande.y1 - 0.25, 0);
  g.add(goutte);
  return { maj: (c) => (goutte.position.y = grande.y1 - 0.25 - (c.reduit ? 0 : ((c.t * 0.45) % 1) * 0.12)) };
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// Le coup de vent : un tourbillon au-dessus de la pièce et des feuilles qui volent dans le sens du vent.
function vent(g: Group, geo: Geo): Habit {
  const haut = geo.y1 + 0.55;
  const cx = (geo.x0 + geo.x1) / 2;
  const tourbillon = new Group();
  for (let k = 0; k < 3; k++) {
    for (let i = 0; i < 6; i++) {
      const a0 = k * 2.1 + i * 0.32;
      const a1 = a0 + 0.32;
      const r0 = 0.1 + i * 0.035;
      const r1 = r0 + 0.035;
      tourbillon.add(trait(ENCRE, Math.cos(a0) * r0, Math.sin(a0) * r0, Math.cos(a1) * r1, Math.sin(a1) * r1, 0.11, 0.07));
      tourbillon.add(trait(BLANC, Math.cos(a0) * r0, Math.sin(a0) * r0, Math.cos(a1) * r1, Math.sin(a1) * r1, 0.06, 0.071));
    }
  }
  tourbillon.position.set(cx, haut, 0);
  g.add(tourbillon);
  const feuilles = [0, 1, 2].map((i) => {
    const f = feuille(0, 0, 0.5 * i, 0.9);
    f.children.forEach((c) => (c.position.z += 0.05));
    g.add(f);
    return f;
  });
  return {
    maj: (c) => {
      const sens = c.sensVent === 0 ? 1 : c.sensVent;
      tourbillon.visible = c.sensVent !== 0;
      tourbillon.rotation.z = c.reduit ? 0 : -c.t * 3 * sens;
      feuilles.forEach((f, i) => {
        f.visible = c.sensVent !== 0;
        const span = geo.x1 - geo.x0 + 2.4;
        const k = c.reduit ? i / 3 : (c.t * 0.55 * sens + i / 3 + 1) % 1;
        f.position.set(cx + (sens > 0 ? k - 0.5 : 0.5 - k) * span, geo.y1 + 0.15 + i * 0.3 + (c.reduit ? 0 : Math.sin(c.t * 5 + i * 2) * 0.12), 0);
        f.rotation.z = c.reduit ? 0 : c.t * 4 * sens + i;
      });
    },
  };
}

/** L'habit d'une pièce (`null` : rien à habiller). Les décors s'ajoutent au groupe de la pièce, dans son repère. */
export function habiller(g: Group, d: DemandeHabit): Habit | null {
  idHabit.set(g, d.id);
  const geo = geometrie(d.bs);
  const effet = d.fixe ? "figee" : d.effet;
  switch (effet) {
    case "figee":
      return figee(g, geo);
    case "lierre":
      return lierre(g, geo);
    case "glissante":
      return glissante(g, geo);
    case "petite":
      return petite(g, geo);
    case "geante":
      return geante(g, geo, d.couleur);
    case "vent":
      return vent(g, geo);
    default:
      return null;
  }
}
