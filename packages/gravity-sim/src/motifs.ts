import type { Rng } from "@cdj/core";
import { ALTERNE_BATTEMENT, CASE, CLIGNOTANT_CYCLE, LARGEUR_MORCEAU, LASER_CYCLE, LASER_ALLUME, LIGNES } from "./constantes";
import { ALTERNE_A, ALTERNE_B, BLOC, CLIGNOTANT, FRAGILE, GLACE, INVERSEUR, PIQUE, TAPIS, VENT, VIDE, type Bonus, type Etape, type Laser, type Objet, type Portail, type Scie } from "./monde";
import type { PlanDuJour } from "./plan";
import type { Regles } from "./regles";
import type { ThemeGravity } from "./themes";
import { colonnesParcourues, pasDeTraversee } from "./traversee";

// LES MOTIFS DE GRAVITÉ (lot GR7) : la construction de chaque motif du catalogue (`catalogue.ts`), **dans le morceau de 16 colonnes**. Ceux d'avant le GR7 sont portés tels quels (le code du lot GR1 à GR6), avec des variantes ;
// les nouveaux combinent l'existant et portent les trois dangers. **Chaque construction lit une variante `v`** (0 à `variantes − 1`) : jamais un tirage au hasard hors du `rng` du morceau.
//
// **Le cadre** : les rangées 0-1 sont le plafond, 10-11 le sol, 2 à 9 l'espace ; le joueur est posé sur le sol à la rangée 9, accroché au plafond à la rangée 2. Un motif est écrit pour une première étape de gravité `g1` ; `orienter(g1, meme)`
// le pose à l'endroit ou en miroir (`meme` : on arrive du côté de `g1`). **« Jamais tout droit » (seed) : le danger est du côté d'où l'on arrive**, ou demande une inversion à un moment que le décor annonce ; `test/jamais-tout-droit.test.ts`
// le prouve (un joueur qui ne fait rien meurt dans le morceau), le laboratoire (`tools/labo.ts`) le mesure motif par motif, à toutes les vitesses.
//
// **Les dangers sont calés sur l'arrivée du joueur** (`c.arrivee(col)` : le pas où il arrive à une colonne, vu la caméra et les portails de vitesse) : une scie est au milieu de son rail, un laser brûle, un sol fragile craque au pas où l'on
// y arrive : aller tout droit échoue.

export interface Ctx {
  /** Le morceau : son rang absolu, sa colonne de départ, la difficulté (0 à 100), la gravité d'arrivée, le thème, les règles. */
  readonly m: number;
  readonly x0: number;
  readonly d: number;
  readonly entree: 1 | -1;
  readonly theme: ThemeGravity;
  readonly REG: Regles;
  readonly rng: Rng;
  readonly plan: PlanDuJour;
  /** Le morceau est-il abordé vite (au-delà de 10 cases/s environ : un vol de 3 cases fait 5 colonnes) ? */
  readonly vite: boolean;
  readonly cases: Uint8Array;
  readonly pieces: Objet[];
  readonly gemmes: Objet[];
  readonly bonus: Bonus[];
  readonly chemin: Etape[];
  readonly portails: Portail[];
  readonly scies: Scie[];
  readonly lasers: Laser[];
  /** Le décalage du battement des cases qui battent. */
  decalage: number;
  rangeeEnLAir: number | null;
  miroir: boolean;
  R(r: number): number;
  G(g: 1 | -1): 1 | -1;
  orienter(g1: 1 | -1, meme: boolean): void;
  poser(c: number, r: number, type: number): void;
  centre(c: number, r: number): Objet;
  trou(de: number, a: number, haut: boolean): void;
  voie(de: number, a: number, rangee: number, g: 1 | -1): void;
  etape(de: number, a: number, rangee: number, g: 1 | -1): void;
  enLAir(de: number, a: number, rangee: number): void;
  gemme(c: number, r: number): void;
  n(): number;
  rangeeEn(c: number): number;
  /** Les colonnes que le joueur parcourt en `pas` pas à la colonne `colonne` (sous le facteur de vitesse qui y vaut). */
  cp(pas: number, colonne: number): number;
  /** Les colonnes d'un vol vertical de `h` cases (de l'arrêt), au milieu du morceau. */
  vol(h: number): number;
  /** Le pas où le joueur arrive à la colonne `col` du morceau (le bord gauche de la colonne), s'il suit la caméra. */
  arrivee(col: number): number;
  /** Une scie sur un rail de `(colA, rangéeA)` à `(colB, rangéeB)` (colonnes et rangées avant miroir, centres), `periode` pas par sens, **au point `frac`/1000 de son rail au pas `tCible`**. */
  scie(colA: number, rangeeA: number, colB: number, rangeeB: number, periode: number, tCible: number, frac?: number): void;
  /** Un laser dans la colonne `col`, des rangées `r0` à `r1` (avant miroir), qui **brûle autour du pas `tCible`** (l'arrivée du joueur) ; un émetteur solide est posé à son bout. */
  laser(col: number, r0: number, r1: number, tCible: number): void;
  /** Un sol fragile sur la rangée `r` des colonnes `de` à `a` (exclue) : une seule rangée, le vide dessous. */
  fragile(de: number, a: number, r: number): void;
  /** Les pièces au-dessus (ou dessous) de la voie, en arc, autour de la colonne `col`. */
  arc(col: number, rangee: number, haut: number): void;
}

const DEMI = CASE >> 1;
export type Construction = (c: Ctx, v: number) => void;

/** Fabrique le contexte d'un morceau. Les listes sont remplies par les constructions, le générateur les lit ensuite. */
export function creerCtx(base: { m: number; x0: number; d: number; entree: 1 | -1; theme: ThemeGravity; REG: Regles; rng: Rng; plan: PlanDuJour; vite: boolean }): Ctx {
  const { x0, REG, plan, rng, d } = base;
  const cases = new Uint8Array(LARGEUR_MORCEAU * LIGNES);
  for (let c = 0; c < LARGEUR_MORCEAU; c++) for (let r = 0; r < LIGNES; r++) cases[c * LIGNES + r] = r < 2 || r >= LIGNES - 2 ? BLOC : VIDE;
  const ctx: Ctx = {
    ...base,
    cases,
    pieces: [],
    gemmes: [],
    bonus: [],
    chemin: [],
    portails: [],
    scies: [],
    lasers: [],
    decalage: 0,
    rangeeEnLAir: null,
    miroir: false,
    R: (r) => (ctx.miroir ? LIGNES - 1 - r : r),
    G: (g) => (ctx.miroir ? ((-g) as 1 | -1) : g),
    orienter(g1, meme) {
      ctx.miroir = meme ? g1 !== base.entree : g1 === base.entree;
    },
    poser(c, r, type) {
      const rr = ctx.R(r);
      if (c >= 0 && c < LARGEUR_MORCEAU && rr >= 0 && rr < LIGNES) cases[c * LIGNES + rr] = type;
    },
    centre: (c, r) => ({ x: (x0 + c) * CASE + DEMI, y: (2 * ctx.R(r) + 1) * DEMI }),
    trou(de, a, haut) {
      for (let c = de; c < Math.min(a, LARGEUR_MORCEAU); c++) {
        ctx.poser(c, haut ? 0 : LIGNES - 2, VIDE);
        ctx.poser(c, haut ? 1 : LIGNES - 1, VIDE);
      }
    },
    voie(de, a, rangee, g) {
      ctx.chemin.push({ c0: de, c1: Math.min(a, LARGEUR_MORCEAU), y: ctx.R(rangee), g: ctx.G(g) });
      for (let c = de; c < a; c += 2) ctx.pieces.push(ctx.centre(c, rangee));
    },
    etape(de, a, rangee, g) {
      ctx.chemin.push({ c0: de, c1: Math.min(a, LARGEUR_MORCEAU), y: ctx.R(rangee), g: ctx.G(g) });
    },
    enLAir(de, a, rangee) {
      ctx.rangeeEnLAir = ctx.R(rangee);
      for (let c = de; c < a; c += 2) ctx.pieces.push(ctx.centre(c, rangee));
    },
    gemme: (c, r) => void ctx.gemmes.push(ctx.centre(c, r)),
    n: () => 3 + rng.int(2 + Math.trunc((d * 4) / 100)),
    rangeeEn: (c) => ctx.chemin.find((e) => e.c0 <= c && c < e.c1)?.y ?? ctx.chemin[ctx.chemin.length - 1]?.y ?? 9,
    cp: (pas, colonne) => colonnesParcourues(pas, colonne, REG, plan.facteurAu(colonne * CASE + DEMI)),
    vol: (h) => ctx.cp(pasDeTraversee(Math.trunc(h * CASE), REG), x0 + 8),
    arrivee: (col) => plan.trajectoire.tickOuLeJoueurArrive((x0 + col) * CASE),
    scie(colA, rangeeA, colB, rangeeB, periode, tCible, frac = 500) {
      const ya = (2 * ctx.R(rangeeA) + 1) * DEMI;
      const yb = (2 * ctx.R(rangeeB) + 1) * DEMI;
      const u = Math.trunc((periode * frac) / 1000);
      const p2 = 2 * periode;
      ctx.scies.push({ x0: (x0 + colA) * CASE + DEMI, y0: ya, x1: (x0 + colB) * CASE + DEMI, y1: yb, periode, decalage: (((u - tCible) % p2) + p2) % p2 });
    },
    laser(col, r0, r1, tCible) {
      const a = Math.min(ctx.R(r0), ctx.R(r1));
      const b = Math.max(ctx.R(r0), ctx.R(r1));
      ctx.lasers.push({ c: col, r0: a, r1: b, decalage: (((LASER_CYCLE - LASER_ALLUME / 2 - tCible) % LASER_CYCLE) + LASER_CYCLE) % LASER_CYCLE });
      // L'émetteur : une case solide au bout du rayon (au plafond ou au sol il est déjà là ; en l'air il est posé).
      for (const e of [a - 1, b + 1]) if (e >= 2 && e < LIGNES - 2 && cases[col * LIGNES + e] === VIDE) cases[col * LIGNES + e] = BLOC;
    },
    fragile(de, a, r) {
      for (let c = de; c < Math.min(a, LARGEUR_MORCEAU); c++) {
        ctx.poser(c, r, FRAGILE);
        // Une seule rangée : la rangée voisine (le sol de deux cases) disparaît, le vide dessous.
        const voisine = r >= 10 ? r + 1 : r <= 1 ? r - 1 : r + 1 < LIGNES && r > 5 ? r + 1 : -1;
        if (voisine >= 0) ctx.poser(c, voisine, VIDE);
      }
    },
    arc(col, rangee, haut) {
      for (let i = -2; i <= 2; i++) {
        const c = col + i * 2;
        if (c >= 0 && c < LARGEUR_MORCEAU) ctx.pieces.push({ ...ctx.centre(c, rangee), y: ctx.centre(c, rangee).y - Math.trunc(((4 - i * i) * haut * CASE) / 4) * (ctx.miroir ? -1 : 1) });
      }
    },
  };
  return ctx;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------
// Les motifs d'avant le GR7, portés (mêmes cases), avec des variantes.

/** Le calme : un couloir, des pièces sur la voie d'arrivée. */
const calme: Construction = (c) => {
  c.orienter(1, true);
  c.voie(2, 14, 9, 1);
};
/** Pour souffler (lot GR7) : un couloir, des pièces à chaque colonne (ou presque), parfois une gemme ; aucun danger. */
const souffle: Construction = (c, v) => {
  c.orienter(1, true);
  c.etape(2, 14, 9, 1);
  const pas = v % 2 === 0 ? 1 : 2;
  for (let col = 2; col < 14; col += pas) c.pieces.push(c.centre(col, 9));
  if (v >= 2) c.gemme(8, 9);
};

/**
 * Un trou : **la surface d'où l'on arrive est trouée**, il faut quitter le sol avant le trou et se tenir au plafond (la voie y est). Variantes : longueur du trou (3, 4 ou 5 colonnes) et début (colonne 4 ou 7).
 * Le trou est plus loin quand on est plus vite : un vol d'une case et demie (de quoi être en l'air au-dessus) se fait en `montee` colonnes.
 */
const trou: Construction = (c, v) => {
  c.orienter(-1, false);
  const l = 3 + (v % 3) + (c.vite ? 1 : 0);
  const a = Math.max(4 + 3 * Math.trunc(v / 3), 2 + c.cp(pasDeTraversee(CASE, c.REG), c.x0 + 8) + 1);
  c.trou(a, a + l, false);
  c.voie(a - 1, a + l + 2, 2, -1);
};

const zigzag: Construction = (c, v) => {
  c.orienter(-1, true);
  // On arrive du plafond : le trou du sol ne gêne pas, celui du plafond demande de descendre avant lui.
  c.trou(2, 2 + 3 + (v % 3), false);
  c.trou(9, 9 + Math.min(6, 3 + Math.trunc(v / 3) + 1), true);
  c.voie(2, 7, 2, -1);
  c.voie(10, 15, 9, 1);
};

/** Un pilier : posé du côté d'où l'on arrive (hauteur 3, 4 ou 5 ; plus loin quand on va vite : il faut le temps de monter au-dessus). */
const pilier: Construction = (c, v) => {
  c.orienter(-1, false);
  const h = 3 + (v % 3);
  const monte = c.cp(pasDeTraversee(h * CASE, c.REG), c.x0 + 8);
  const col = Math.min(13, Math.max(8 + Math.trunc(v / 3) * 2, 2 + monte + 1));
  for (const cc of [col, col + 1]) for (let y = 0; y < h; y++) c.poser(cc, 9 - y, BLOC);
  c.voie(3, 15, 2, -1);
};

/** Des piques sur la surface d'où l'on arrive : on les passe au plafond. Longueur 4, 5 ou 6, début colonne 4 ou 6. */
const pics: Construction = (c, v) => {
  c.orienter(-1, false);
  const l = 4 + (v % 3);
  const a = 4 + 2 * Math.trunc(v / 3);
  for (let cc = a; cc < Math.min(LARGEUR_MORCEAU, a + l); cc++) c.poser(cc, 9, PIQUE);
  c.voie(a - 1, a + l + 1, 2, -1);
};

const milieu: Construction = (c, v) => {
  // Une plateforme de deux cases au milieu, sol et plafond troués : on se tient dessus (rangée 4) ou dessous (rangée 7), du côté qu'on atteint d'une inversion depuis la surface d'où l'on vient.
  c.orienter(1, false);
  const sortie = c.cp(pasDeTraversee(5 * CASE, c.REG), c.x0 + 12) + 1;
  const fin = Math.max(8, Math.min(13, LARGEUR_MORCEAU - sortie - (v % 2)));
  c.trou(3, fin, false);
  c.trou(3, fin, true);
  for (let cc = 2; cc < fin + 1; cc++) {
    c.poser(cc, 5, BLOC);
    c.poser(cc, 6, BLOC);
  }
  c.voie(3, fin, 4, 1);
  if (v >= 2) c.gemme(Math.min(8, fin - 2), v === 2 ? 4 : 7);
};

const inverseur: Construction = (c, v) => {
  // Trois cases d'inverseur sur une surface, et cette même surface trouée plus loin : on les touche, la gravité s'inverse, on traverse jusqu'à la surface d'en face.
  c.orienter(1, true);
  const a = 6 - (v % 2);
  for (let cc = a; cc < a + 3; cc++) c.poser(cc, 10, INVERSEUR);
  c.trou(10 + (v >= 2 ? 1 : 0), 15, false);
  c.voie(4, 9, 9, 1);
  c.voie(10 + (v >= 2 ? 1 : 0), 15, 2, -1);
};

const escalier: Construction = (c, v) => {
  // Deux plateformes au milieu, en marches : d'en bas on s'accroche sous la première puis sous la seconde (une inversion au début) ; en miroir, d'en haut on descend de marche en marche sans rien toucher.
  c.orienter(-1, false);
  c.trou(3, 16, false);
  c.trou(3, 15, true);
  for (let cc = 1; cc < 8; cc++) c.poser(cc, 7, BLOC);
  for (let cc = 6; cc < 14; cc++) c.poser(cc, 4, BLOC);
  c.voie(3, 8, 8, -1);
  c.voie(8, 14, 5, -1);
  if (v >= 2) c.gemme(11, 6);
};

const etages: Construction = (c, v) => {
  // Deux étages au milieu de l'écran (voir le lot GR2) : l'étage haut (rangée 4) troué en A, l'étage bas (rangée 7) long de 13 colonnes ; le trou A suit la vitesse.
  const trav = c.cp(pasDeTraversee(Math.trunc((9 * CASE) / 5), c.REG), c.x0 + 8);
  const chute = c.cp(pasDeTraversee(3 * CASE, c.REG), c.x0 + 8);
  const a0 = 5;
  const a1 = Math.min(LARGEUR_MORCEAU - 4, a0 + trav + 3);
  for (let cc = 0; cc < LARGEUR_MORCEAU; cc++) {
    if (cc < a0 || (cc >= a1 && cc < a1 + 3)) c.poser(cc, 4, BLOC);
    if (cc < 13) c.poser(cc, 7, BLOC);
  }
  c.trou(2, 14, false);
  // Arrivé du plafond, il faut en descendre : le plafond est troué au-dessus du premier étage (lot GR7 : on ne reste pas accroché au plafond).
  if (c.entree === -1) c.trou(3, 13, true);
  if (c.entree === -1) {
    c.voie(1, a0 + 1, 3, 1);
    c.voie(Math.min(a0 + chute - 1, 10), 13, 6, 1);
  } else c.voie(1, 13, 8, -1);
  c.voie(14, 16, 2, -1);
  if (v >= 2 && c.rng.chance(70)) c.gemme(14, 2);
};

const ilots: Construction = (c, v) => {
  // Des îlots flottants, en bas puis en haut, au-dessus du vide : on saute de l'un à l'autre en inversant.
  c.orienter(1, false);
  const vol = c.vol(13 / 4);
  const largeur = Math.max(3, Math.min(5, vol));
  const ecart = vol + 4;
  const queue = c.cp(pasDeTraversee(2 * CASE, c.REG), c.x0 + 14) + 1;
  const iles: number[] = [];
  for (let cc = 2; cc + largeur + queue <= LARGEUR_MORCEAU && iles.length < 4; cc += ecart) iles.push(cc);
  if (iles.length === 0) iles.push(2);
  const finVide = Math.min(LARGEUR_MORCEAU, iles[iles.length - 1]! + largeur + 2);
  c.trou(2, finVide, false);
  c.trou(2, finVide, true);
  iles.forEach((c0, k) => {
    const bas = k % 2 === 0;
    for (let cc = c0; cc < c0 + largeur; cc++) c.poser(cc, bas ? 8 : 3, BLOC);
    c.voie(c0, c0 + largeur, bas ? 7 : 4, bas ? 1 : -1);
  });
  void v;
};

// Les cases spéciales de chaque thème.
const specialUsine: Construction = (c, v) => {
  // Des tapis roulants au sol et au plafond, un trou en face de la course : il faut quitter le sol (il pousse plus vite) avant qu'il s'arrête.
  c.orienter(1, true);
  for (let cc = 1; cc < 15; cc++) {
    c.poser(cc, 10, TAPIS);
    c.poser(cc, 1, TAPIS);
  }
  // Le trou est au sol (lot GR7 : du côté d'où l'on arrive, jamais en face : un joueur qui ne fait rien tombe).
  const l = Math.min(5, 3 + (v % 3));
  c.trou(9, 9 + l, false);
  c.voie(2, 5, 9, 1);
  c.voie(10, 15, 2, -1);
};
const specialGlace: Construction = (c, v) => {
  // Une surface de glace : on ne peut pas y prendre appui. On court sur la surface d'en face, puis un trou après la glace oblige à passer de l'autre côté.
  c.orienter(1, true);
  for (let cc = 2; cc < 10; cc++) c.poser(cc, 1, GLACE);
  c.trou(10 + (v % 2), 15, false);
  c.voie(2, 10, 9, 1);
  c.voie(10 + (v % 2), 15, 2, -1);
};
const specialForet: Construction = (c, v) => {
  // Le vent pousse toujours vers le haut : on ne peut pas le poser en miroir. Arrivé du plafond, le morceau est un trou du plafond à passer par le sol (lot GR7 : jamais tout droit).
  if (c.entree === -1) return trou(c, v);
  // Un courant d'air au-dessus d'un trou du sol. On quitte le sol avant le trou, le vent porte d'un coup jusqu'au plafond ; arrivé du plafond, on y reste.
  c.trou(4, 12 - (v % 2), false);
  for (let cc = 5; cc < 11 - (v % 2); cc++) for (let y = 3; y < 10; y++) c.poser(cc, y, VENT);
  if (c.entree === 1) {
    c.etape(2, 4, 9, 1);
    c.etape(7, 16, 2, -1);
  } else c.etape(2, 16, 2, -1);
  c.enLAir(4, 12, 5);
};

/**
 * **La Nuit (lot GR7 : « jamais tout droit »)** : des blocs qui s'allument et s'éteignent sur le sol d'où l'on arrive ; **le cycle est calé sur l'arrivée du joueur pour qu'ils s'éteignent PENDANT qu'il est dessus**, après leur
 * mise en garde (le clignotement) : rester au sol, c'est tomber. Le chemin sûr quitte le sol à temps (une fenêtre de ± 4 pas) pour le plafond, qui reste plein.
 */
const specialNuit: Construction = (c, v) => {
  c.orienter(1, true);
  const l = 5 + (v % 2);
  const a = 4 + Math.trunc(v / 2);
  for (let cc = a; cc < a + l; cc++) {
    c.poser(cc, 10, CLIGNOTANT);
    c.poser(cc, 11, CLIGNOTANT);
  }
  c.voie(2, a, 9, 1);
  c.voie(a + 2, 15, 2, -1);
  // Le bloc s'éteint (cycle : allumé 119 pas puis éteint) quand le joueur est au milieu des blocs : le clignotement avertit pendant les 42 pas qui précèdent.
  const milieu = c.arrivee(a + Math.trunc(l / 2));
  c.decalage = (CLIGNOTANT_CYCLE - ((milieu - 119 + CLIGNOTANT_CYCLE * 4) % CLIGNOTANT_CYCLE)) % CLIGNOTANT_CYCLE;
};
/**
 * **Le Néon (lot GR7)** : deux couleurs, une seule solide à la fois. Le joueur arrive sur la première (colonnes 3 à 7) **qui s'éteint pendant qu'il est dessus** ; il faut inverser avant, pour se poser sur la seconde au plafond.
 */
const specialNeon: Construction = (c, v) => {
  c.orienter(1, true);
  const vol = c.vol(29 / 4);
  const b0 = Math.min(LARGEUR_MORCEAU - 3, 2 + vol);
  const b1 = Math.min(LARGEUR_MORCEAU, 9 + vol);
  c.trou(3, b1, false);
  c.trou(3, b1, true);
  const fin = 7 + (v % 2);
  for (let cc = 3; cc < fin; cc++) c.poser(cc, 10, ALTERNE_A);
  for (let cc = b0; cc < b1; cc++) c.poser(cc, 1, ALTERNE_B);
  c.voie(3, fin, 9, 1);
  c.voie(b0 + 1, b1, 2, -1);
  // La première couleur s'éteint (la bascule A → B) quand le joueur est au milieu d'elle ; la seconde s'allume au même instant.
  const bascule = c.arrivee(Math.trunc((3 + fin) / 2));
  c.decalage = (((ALTERNE_BATTEMENT - bascule) % (2 * ALTERNE_BATTEMENT)) + 2 * ALTERNE_BATTEMENT) % (2 * ALTERNE_BATTEMENT);
  void v;
};

export const CONSTRUCTIONS: Record<string, Construction> = {
  calme,
  souffle,
  trou,
  zigzag,
  pilier,
  pics,
  milieu,
  inverseur,
  escalier,
  etages,
  ilots,
  "special-usine": specialUsine,
  "special-glace": specialGlace,
  "special-foret": specialForet,
  "special-nuit": specialNuit,
  "special-neon": specialNeon,
};

// ---------------------------------------------------------------------------------------------------------------------------------------------------------
// Les motifs nouveaux (lot GR7). Tous écrits pour **arriver sur le sol** (`orienter(1, true)`) ; en miroir quand on arrive du plafond.

/** Les colonnes qu'il faut pour monter de `h` cases à partir du sol (de quoi être au-dessus d'un obstacle bas) : le plus tôt qu'un danger peut être posé. */
const monte = (c: Ctx, h: number): number => c.cp(pasDeTraversee(Math.trunc(h * CASE), c.REG), c.x0 + 8);

/** Des bandes de piques de chaque côté, aux trous alternés : le sol est piqué, puis le plafond, puis le sol. Le plafond ne commence qu'après le temps d'un vol. */
const couloirPiques: Construction = (c, v) => {
  c.orienter(1, true);
  const vol = c.vol(29 / 4);
  const w = 3 + (v % 2);
  const s1 = Math.max(4, 2 + monte(c, 1) + 1) + Math.trunc(v / 3);
  const s2 = s1 + Math.max(w + 2, vol + 1);
  for (let cc = s1; cc < s1 + w; cc++) c.poser(cc, 9, PIQUE);
  if (s2 + w <= 15 && !c.vite) {
    for (let cc = s2; cc < s2 + w; cc++) c.poser(cc, 2, PIQUE);
    c.voie(s1 - 1, s2 + w, 2, -1);
    c.voie(s2 + w, 16, 9, 1);
  } else c.voie(s1 - 1, 16, 2, -1);
};

/** Des piliers l'un après l'autre, du sol puis du plafond, au rythme d'un vol : il faut inverser à chaque fois. */
const slalom: Construction = (c, v) => {
  c.orienter(1, true);
  const h = 3 + (v % 3);
  const espace = Math.max(5, c.cp(84, c.x0 + 8));
  const premier = Math.max(8, 2 + monte(c, h) + 1);
  let k = 0;
  for (let col = premier; col + 1 < 15 && k < 3; col += espace, k++) {
    const bas = k % 2 === 0;
    for (const cc of [col, col + 1]) for (let y = 0; y < h; y++) c.poser(cc, bas ? 9 - y : 2 + y, BLOC);
    c.etape(col - 1, col + 2, bas ? 2 : 9, bas ? -1 : 1);
  }
  c.voie(2, premier - 1, 9, 1);
};

/** Des marches de sol, les unes sur les autres : on saute d'une plate-forme à l'autre. Un **îlot posé au-dessus de piques** : le sol est un lit de piques, des îlots à mi-hauteur. */
const ilotsPiques: Construction = (c, v) => {
  c.orienter(1, false);
  const vol = c.vol(13 / 4);
  const largeur = Math.max(3, Math.min(5, vol));
  const ecart = vol + 4;
  const queue = c.cp(pasDeTraversee(2 * CASE, c.REG), c.x0 + 14) + 1;
  const iles: number[] = [];
  for (let cc = 2; cc + largeur + queue <= LARGEUR_MORCEAU && iles.length < 3; cc += ecart) iles.push(cc);
  if (iles.length === 0) iles.push(2);
  const finVide = Math.min(LARGEUR_MORCEAU, iles[iles.length - 1]! + largeur + 2);
  c.trou(2, finVide, true);
  // Le sol devient un lit de piques sous les îlots.
  for (let cc = 2; cc < finVide; cc++) c.poser(cc, 9, PIQUE);
  iles.forEach((c0, k) => {
    const bas = k % 2 === 0;
    for (let cc = c0; cc < c0 + largeur; cc++) c.poser(cc, bas ? 7 : 3, BLOC);
    c.voie(c0, c0 + largeur, bas ? 6 : 4, bas ? 1 : -1);
  });
  void v;
};

/**
 * **Le faux chemin** : un trou sous les pieds (il faut quitter le sol). Le chemin facile part tôt, au plafond, sans pièces ; **le chemin dur part au dernier moment : la trajectoire passe par une gemme** (elle est sur la courbe d'une
 * inversion donnée au bord du trou).
 */
const fauxChemin: Construction = (c, v) => {
  c.orienter(-1, false);
  const l = 4 + (v % 2) + (c.vite ? 1 : 0);
  const a = Math.max(4 + 2 * Math.trunc(v / 2), 2 + monte(c, 1) + 1);
  c.trou(a, a + l, false);
  c.etape(a - 1, 16, 2, -1);
  // La gemme : un vol qui part du bord du trou, après `t` pas, est en `a + colonnes` à la hauteur `9,6 − 23 t²`.
  const t = 48;
  const colGemme = a + Math.max(2, c.cp(t, c.x0 + a));
  const y = 9 * CASE + 2458 - Math.trunc((((CASE * 46) / 2) * t * t) / (TICKS * TICKS));
  if (colGemme < 15) c.gemmes.push({ x: (c.x0 + colGemme) * CASE + DEMI, y: c.R(0) === 0 ? y : LIGNES * CASE - y });
};
const TICKS = 120;

// --- Les scies ---------------------------------------------------------------------------------------------------------------------------------------------

/** Une scie sur le sol, qui va et vient sur son rail : **au milieu de son rail quand on y arrive**. On passe au plafond. */
const scieSol: Construction = (c, v) => {
  c.orienter(1, true);
  const L = 4 + (v % 3);
  const P = v < 3 ? 110 : 72;
  const a = Math.max(5, 2 + monte(c, 1) + 2);
  c.scie(a, 9, a + L, 9, P, c.arrivee(a + Math.trunc(L / 2)), 500);
  c.voie(a - 1, a + L + 2, 2, -1);
};

/** Une scie qui monte et descend dans une colonne, de bout en bout de l'espace : **elle est en bas quand on arrive**. On passe au plafond. */
const scieVerticale: Construction = (c, v) => {
  c.orienter(1, true);
  const P = v < 3 ? 130 : 90;
  const col = Math.max(7, 2 + monte(c, 6) + 1) + (v % 3 === 2 ? 1 : 0);
  c.scie(col, 3, col, 9, P, c.arrivee(col), 1000);
  c.voie(col - 3, col + 3, 2, -1);
};

/** Deux scies sur le même rail du sol, en opposition de phase : elles se croisent, on passe au plafond. */
const sciesAlternees: Construction = (c, v) => {
  c.orienter(1, true);
  const L = 3 + (v % 2);
  const P = v < 3 ? 100 : 74;
  const a = Math.max(4, 2 + monte(c, 1) + 2);
  c.scie(a, 9, a + L, 9, P, c.arrivee(a + Math.trunc(L / 2)), 500);
  const b = a + L + 2;
  if (b + L < 15) c.scie(b, 9, b + L, 9, P, c.arrivee(b + Math.trunc(L / 2)), 500);
  c.voie(a - 1, 16, 2, -1);
};

/** Une scie sur le sol, des piques sur le plafond plus loin : les deux côtés se paient, un seul instant est sûr. */
const piquesScies: Construction = (c, v) => {
  c.orienter(1, true);
  const vol = c.vol(29 / 4);
  const L = 3 + (v % 2);
  const a = Math.max(4, 2 + monte(c, 1) + 2);
  c.scie(a, 9, a + L, 9, 90, c.arrivee(a + Math.trunc(L / 2)), 500);
  const s2 = a + L + Math.max(2, vol - 2);
  if (s2 + 3 <= 15) {
    for (let cc = s2; cc < s2 + 3; cc++) c.poser(cc, 2, PIQUE);
    c.voie(a - 1, s2 + 3, 2, -1);
    c.voie(s2 + 3, 16, 9, 1);
  } else c.voie(a - 1, 16, 2, -1);
};

/** Des scies au-dessus du vide : les îlots du sol, une scie sur un rail entre eux. */
const scieIlots: Construction = (c, v) => {
  c.orienter(1, false);
  const vol = c.vol(13 / 4);
  const largeur = Math.max(3, Math.min(5, vol));
  const ecart = vol + 4;
  const queue = c.cp(pasDeTraversee(2 * CASE, c.REG), c.x0 + 14) + 1;
  const iles: number[] = [];
  for (let cc = 2; cc + largeur + queue <= LARGEUR_MORCEAU && iles.length < 3; cc += ecart) iles.push(cc);
  if (iles.length === 0) iles.push(2);
  const finVide = Math.min(LARGEUR_MORCEAU, iles[iles.length - 1]! + largeur + 2);
  c.trou(2, finVide, false);
  c.trou(2, finVide, true);
  iles.forEach((c0, k) => {
    const bas = k % 2 === 0;
    for (let cc = c0; cc < c0 + largeur; cc++) c.poser(cc, bas ? 8 : 3, BLOC);
    c.voie(c0, c0 + largeur, bas ? 7 : 4, bas ? 1 : -1);
  });
  // Une scie au-dessus du premier îlot (celui du bas), sur un rail court : elle passe au milieu quand on y arrive.
  const c0 = iles[0]!;
  c.scie(c0, 5, c0 + largeur - 1, 5, 100 - 12 * (v % 3), c.arrivee(c0 + Math.trunc(largeur / 2)), 500);
};

// --- Les sols fragiles -------------------------------------------------------------------------------------------------------------------------------------

/** Un pont fragile à la place du sol : il craque quand on s'y pose et tombe 54 pas plus tard ; **le tronçon est assez long pour qu'on y soit encore à ce moment**. On le quitte pour le plafond avant. */
const fragilePont: Construction = (c, v) => {
  c.orienter(1, true);
  const a = 4 + (v % 3);
  // Le tronçon va jusqu'au bout du morceau : à ce rythme on y serait encore au moment de sa chute.
  c.fragile(a, 16, 10);
  c.voie(2, a + 1, 9, 1);
  c.voie(a + 2, 16, 2, -1);
  void v;
};
/** Des îlots fragiles : les îlots du bas tombent peu après qu'on s'y est posé. */
const fragileIlots: Construction = (c, v) => {
  c.orienter(1, false);
  const vol = c.vol(13 / 4);
  const largeur = Math.max(3, Math.min(5, vol));
  const ecart = vol + 4;
  const queue = c.cp(pasDeTraversee(2 * CASE, c.REG), c.x0 + 14) + 1;
  const iles: number[] = [];
  for (let cc = 2; cc + largeur + queue <= LARGEUR_MORCEAU && iles.length < 3; cc += ecart) iles.push(cc);
  if (iles.length === 0) iles.push(2);
  const finVide = Math.min(LARGEUR_MORCEAU, iles[iles.length - 1]! + largeur + 2);
  c.trou(2, finVide, false);
  c.trou(2, finVide, true);
  iles.forEach((c0, k) => {
    const bas = k % 2 === 0;
    c.fragile(c0, c0 + largeur, bas ? 8 : 3);
    c.voie(c0, c0 + largeur, bas ? 7 : 4, bas ? 1 : -1);
  });
  void v;
};
/** Deux ponts de suite, sur des surfaces opposées : on quitte le premier avant sa chute, on se pose sur le second, qui craque à son tour. */
const fragileRelais: Construction = (c, v) => {
  c.orienter(1, true);
  const vol = c.vol(29 / 4);
  const a = 3 + (v % 2);
  // Le premier pont est assez long pour qu'on y soit encore quand il tombe (54 pas plus tard, plus la marge de la mise en garde).
  const len = Math.max(5, c.cp(70, c.x0 + a) + 1 + Math.trunc(v / 2));
  c.fragile(a, a + len, 10);
  const b = Math.min(12, a + Math.max(len, vol - 1));
  c.fragile(b, 16, 1);
  c.voie(2, a, 9, 1);
  c.voie(b, 16, 2, -1);
};

// --- Les lasers --------------------------------------------------------------------------------------------------------------------------------------------

/** Un laser qui monte du sol : il s'annonce, puis il brûle **quand on y arrive**. On passe au plafond (ou plus haut que lui). */
const laserSimple: Construction = (c, v) => {
  c.orienter(1, true);
  const h = 3 + (v % 3);
  const col = Math.max(6, 2 + monte(c, h) + 1) + Math.trunc(v / 3);
  c.laser(col, 10 - h, 9, c.arrivee(col));
  c.voie(col - 3, col + 4, 2, -1);
};
/** Deux rayons du sol, l'un derrière l'autre. */
const laserDouble: Construction = (c, v) => {
  c.orienter(1, true);
  const h = 3 + (v % 2);
  const col = Math.max(5, 2 + monte(c, h) + 1);
  c.laser(col, 10 - h, 9, c.arrivee(col));
  c.laser(col + 3 + Math.trunc(v / 2), 10 - h, 9, c.arrivee(col + 3 + Math.trunc(v / 2)));
  c.voie(col - 3, 16, 2, -1);
};
/** Des rayons de plus en plus hauts, comme un escalier : il faut être tout en haut. */
const laserEscalier: Construction = (c, v) => {
  c.orienter(1, true);
  const col = Math.max(5, 2 + monte(c, 3) + 1);
  for (let i = 0; i < 3; i++) c.laser(col + 3 * i, 10 - (3 + i), 9, c.arrivee(col + 3 * i));
  c.voie(col - 3, 16, 2, -1);
  void v;
};
/** Des rayons du sol puis du plafond, au rythme d'un vol : à chaque rayon, de l'autre côté. */
const laserRafale: Construction = (c, v) => {
  c.orienter(1, true);
  const vol = c.vol(29 / 4);
  const col = Math.max(5, 2 + monte(c, 3) + 1);
  c.laser(col, 7, 9, c.arrivee(col));
  const col2 = col + Math.max(5, vol + 1);
  if (col2 < 14) {
    c.laser(col2, 2, 4, c.arrivee(col2));
    c.voie(col - 2, col2 + 2, 2, -1);
    c.voie(col2 + 2, 16, 9, 1);
  } else c.voie(col - 2, 16, 2, -1);
  void v;
};
/** Un laser et une scie. */
const laserScies: Construction = (c, v) => {
  c.orienter(1, true);
  const h = 3 + (v % 2);
  const col = Math.max(5, 2 + monte(c, h) + 1);
  c.laser(col, 10 - h, 9, c.arrivee(col));
  const a = col + 3;
  c.scie(a, 9, a + 4, 9, 96, c.arrivee(a + 2), 500);
  c.voie(col - 3, 16, 2, -1);
};
/** Un pont fragile et un laser au bout. */
const fragileLaser: Construction = (c, v) => {
  c.orienter(1, true);
  const a = 4;
  c.fragile(a, 16, 10);
  const h = 3 + (v % 2);
  const col = 12;
  c.laser(col, 10 - h, 9, c.arrivee(col));
  c.voie(2, a + 1, 9, 1);
  c.voie(a + 2, 16, 2, -1);
};

CONSTRUCTIONS["couloirPiques"] = couloirPiques;
CONSTRUCTIONS["slalom"] = slalom;
CONSTRUCTIONS["ilotsPiques"] = ilotsPiques;
CONSTRUCTIONS["fauxChemin"] = fauxChemin;
CONSTRUCTIONS["scieSol"] = scieSol;
CONSTRUCTIONS["scieVerticale"] = scieVerticale;
CONSTRUCTIONS["sciesAlternees"] = sciesAlternees;
CONSTRUCTIONS["piquesScies"] = piquesScies;
CONSTRUCTIONS["scieIlots"] = scieIlots;
CONSTRUCTIONS["fragilePont"] = fragilePont;
CONSTRUCTIONS["fragileIlots"] = fragileIlots;
CONSTRUCTIONS["fragileRelais"] = fragileRelais;
CONSTRUCTIONS["laserSimple"] = laserSimple;
CONSTRUCTIONS["laserDouble"] = laserDouble;
CONSTRUCTIONS["laserEscalier"] = laserEscalier;
CONSTRUCTIONS["laserRafale"] = laserRafale;
CONSTRUCTIONS["laserScies"] = laserScies;
CONSTRUCTIONS["fragileLaser"] = fragileLaser;

// --- Quelques motifs de plus, sur le même principe (le danger est du côté d'où l'on arrive) ---------------------------------------------------------------------

/** Deux piliers du côté d'où l'on arrive, de hauteurs différentes : on passe au plafond. */
const pilierDouble: Construction = (c, v) => {
  c.orienter(-1, false);
  const h1 = 3 + (v % 2);
  const h2 = 3 + Math.trunc(v / 2);
  const col = Math.max(7, 2 + monte(c, Math.max(h1, h2)) + 1);
  const col2 = Math.min(13, col + 4 + (v % 2));
  for (const [cc, h] of [[col, h1], [col2, h2]] as const) for (const x of [cc, cc + 1]) for (let y = 0; y < h; y++) c.poser(x, 9 - y, BLOC);
  c.voie(3, 15, 2, -1);
};
/** Un gouffre : un trou long (7 à 9 colonnes) sous les pieds, une gemme au-dessus de son milieu ; on le franchit au plafond. */
const gouffre: Construction = (c, v) => {
  c.orienter(-1, false);
  const l = 7 + (v % 3);
  const a = Math.max(4, 2 + monte(c, 1) + 1);
  c.trou(a, Math.min(LARGEUR_MORCEAU, a + l), false);
  c.voie(a - 1, 16, 2, -1);
  if (v >= 2 && a + 4 < 14) c.gemme(a + 4, 3);
};
/** Un escalier de plate-formes dont le dessus est hérissé de piques : on le suit par-dessous. */
const escalierPiques: Construction = (c, v) => {
  escalier(c, v);
  for (let cc = 1; cc < 8; cc++) c.poser(cc, 6, PIQUE);
  for (let cc = 6; cc < 14; cc++) c.poser(cc, 3, PIQUE);
};
/** Des bandes de piques qui se suivent, du sol, du plafond, du sol : une inversion à chaque fois, au rythme d'un vol. */
const inversionsRapides: Construction = (c, v) => {
  c.orienter(1, true);
  const vol = c.vol(29 / 4);
  const w = 3;
  const pas = Math.max(w + 2, vol + 1);
  const s1 = Math.max(4, 2 + monte(c, 1) + 1);
  const bandes: number[] = [];
  for (let cc = s1, k = 0; cc + w <= 15 && k < 3; cc += pas, k++) bandes.push(cc);
  bandes.forEach((cc, k) => {
    for (let x = cc; x < cc + w; x++) c.poser(x, k % 2 === 0 ? 9 : 2, PIQUE);
  });
  bandes.forEach((cc, k) => c.voie(cc - 1, k + 1 < bandes.length ? bandes[k + 1]! - 1 : 16, k % 2 === 0 ? 2 : 9, k % 2 === 0 ? -1 : 1));
  void v;
};
CONSTRUCTIONS["pilierDouble"] = pilierDouble;
CONSTRUCTIONS["gouffre"] = gouffre;
CONSTRUCTIONS["escalierPiques"] = escalierPiques;
CONSTRUCTIONS["inversionsRapides"] = inversionsRapides;
