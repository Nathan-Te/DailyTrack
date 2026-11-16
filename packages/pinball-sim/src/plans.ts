import { mixSeed, Rng } from "@cdj/core";
import type { Module } from "./generateur";
import type { ThemePinball } from "./themes";

// LES PLANS DE TABLE (lot PBG1) — seed « Le contenu des tables » : **le bas de la table ne change toujours pas** (batteurs, lance-pierres, couloirs de retour, lanceur) ; **le haut suit un plan tiré du jour**, parmi
// plusieurs. Un plan fixe la place des rampes, de l'orbite, du mini-batteur, du trou (le verrou du lot suivant) et des emplacements de modules ; ensuite les modules sont tirés dans les emplacements du plan.
// **Ajouter un plan** : une entrée de `PLANS` (ses emplacements, ses rails, son mini-batteur s'il en a un), une ligne `plan.<id>` dans les catalogues du jeu, et `PINBALL_GENERATOR_VERSION` + 1 (le cycle des plans change : un
// jour servi ne change pas parce qu'il est figé dans son fichier). Tout est en pixels de la table (375 × 760) ; la simulation les passe en unités. Un plan est une donnée : aucun hasard, aucun flottant.

/** Un emplacement de module : son centre, les modules communs qu'on y tire (répéter un module le rend plus probable), et ce qu'y posent les thèmes. */
export interface Emplacement {
  x: number;
  y: number;
  /** Les modules permis dans les thèmes qui ne s'en servent pas. **Un seul module permis : l'emplacement est fixe** (le trou). */
  permis: readonly Module[];
  /** L'élément que le thème pose ici, toujours (le manège, le trou noir, un portail, l'astéroïde…). */
  fixe?: Readonly<Partial<Record<ThemePinball, Module>>>;
  /** L'élément que le thème peut poser ici : **un seul des emplacements qui le portent est tiré du jour** (le geyser du volcan). */
  optionnel?: Readonly<Partial<Record<ThemePinball, Module>>>;
}

/** Un rail : une rampe (on y entre par un bout, on en sort par l'autre) ou l'orbite (on y entre par un bout ou l'autre). `points` : les points de contrôle de la courbe, de l'entrée à la sortie. */
export interface DefRail {
  genre: "rampe" | "orbite";
  points: readonly (readonly [number, number])[];
  /** La hauteur du rail au-dessus du plateau, au rendu seulement (px). */
  hauteur: number;
  /** La demi-largeur de la bouche (px) : la bille est prise quand son centre est à moins de cette distance du milieu de la bouche. */
  demiPorte: number;
}

/** Le mini-batteur : un troisième batteur en haut de la table, qui suit le bouton du batteur du même côté. Son pivot est donné **dans le repère du côté gauche** ; du côté droit il est l'image dans l'axe de la table. */
export interface DefMini {
  cote: 0 | 1;
  x: number;
  y: number;
  /** Sa longueur (px). */
  longueur: number;
}

export interface Plan {
  id: string;
  emplacements: readonly Emplacement[];
  rampes: readonly DefRail[];
  /** `null` seulement pour le plan d'essai (`PLAN_CLASSIQUE`) : tout plan du jour a son orbite. */
  orbite: DefRail | null;
  mini?: DefMini;
}

/** L'emplacement de l'élément du thème : le manège, le tourbillon, le trou noir ou la coulée. */
const theme = (x: number, y: number): Emplacement => ({ x, y, permis: ["manege"], fixe: { foire: "manege", ocean: "tourbillon", espace: "trouNoir", volcan: "coulee" } });
/** Le trou : toujours là, dans tous les thèmes (la Pieuvre de l'océan) ; il servira de verrou au lot suivant. */
const trou = (x: number, y: number): Emplacement => ({ x, y, permis: ["trou"] });

/**
 * L'orbite : un couloir le long de l'arc du haut (rayon `r` px autour de (196,25 ; 205)), de la bouche gauche (`xg`, `y`) à la bouche droite (`xd`, `y`). Les bouches regardent vers le haut : la bille qui y monte assez vite
 * fait le tour et sort de l'autre côté.
 */
function orbite(xg: number, xd: number, y: number, r: number, hauteur: number): DefRail {
  const arc = (a: number): [number, number] => {
    // `a` en degrés, de 180 (à gauche) à 0 (à droite) ; les sinus et cosinus sont ceux des multiples de 20° : écrits ici, tout en entiers
    const t: Record<number, [number, number]> = { 180: [-1000, 0], 160: [-940, 342], 140: [-766, 643], 120: [-500, 866], 100: [-174, 985], 80: [174, 985], 60: [500, 866], 40: [766, 643], 20: [940, 342], 0: [1000, 0] };
    const [c, s] = t[a]!;
    return [196 + Math.trunc((c * r) / 1000), 205 - Math.trunc((s * r) / 1000)];
  };
  return {
    genre: "orbite",
    points: [[xg, y], [xg, y - 44], ...[160, 140, 120, 100, 80, 60, 40, 20].map(arc), [xd, y - 44], [xd, y]],
    hauteur,
    demiPorte: 13,
  };
}

/** Les plans. Le premier emplacement est celui de l'élément du thème, le deuxième le trou ; les suivants portent, selon le thème, l'astéroïde et les portails de l'espace et le geyser du volcan. */
export const PLANS: readonly Plan[] = [
  {
    // « Doublette » : deux rampes qui se croisent au sommet, chacune ramène la bille dans le couloir de retour de l'autre côté
    id: "doublette",
    emplacements: [
      theme(184, 300),
      trou(184, 394),
      { x: 184, y: 222, permis: ["bumpers", "bumpers", "bumpers", "mini"], fixe: { espace: "asteroide" }, optionnel: { volcan: "geyser" } },
      { x: 118, y: 252, permis: ["cibles", "spinner", "mini"], fixe: { espace: "portailB" } },
      { x: 250, y: 252, permis: ["cibles", "spinner", "mini"], fixe: { espace: "portailA" }, optionnel: { volcan: "geyser" } },
      { x: 190, y: 150, permis: ["mini", "spinner"] },
    ],
    rampes: [
      { genre: "rampe", points: [[76, 385], [76, 310], [92, 220], [150, 140], [230, 126], [300, 175], [333, 270], [336, 448]], hauteur: 30, demiPorte: 14 },
      { genre: "rampe", points: [[292, 385], [292, 310], [276, 220], [218, 140], [138, 126], [68, 175], [35, 270], [32, 448]], hauteur: 44, demiPorte: 14 },
    ],
    orbite: orbite(38, 334, 300, 150, 20),
  },
  {
    // « Tremplin » : une rampe qui monte au milieu et traverse la table, et un mini-batteur à droite qui l'alimente
    id: "tremplin",
    emplacements: [
      theme(120, 300),
      trou(170, 185),
      { x: 120, y: 215, permis: ["bumpers", "bumpers", "mini"], fixe: { espace: "asteroide" }, optionnel: { volcan: "geyser" } },
      { x: 84, y: 380, permis: ["cibles", "spinner", "mini"], fixe: { espace: "portailB" } },
      { x: 268, y: 215, permis: ["cibles", "spinner", "bumpers"], fixe: { espace: "portailA" }, optionnel: { volcan: "geyser" } },
      { x: 270, y: 325, permis: ["mini", "bumpers"] },
    ],
    rampes: [{ genre: "rampe", points: [[214, 390], [214, 330], [226, 250], [250, 175], [262, 120], [214, 82], [150, 90], [80, 150], [38, 250], [32, 448]], hauteur: 32, demiPorte: 14 }],
    orbite: orbite(38, 334, 290, 146, 20),
    mini: { cote: 1, x: 52, y: 405, longueur: 38 },
  },
  {
    // « Bretelle » : une rampe à gauche qui contourne le haut, une rampe courte à droite, et un mini-batteur à gauche
    id: "bretelle",
    emplacements: [
      theme(200, 310),
      trou(240, 170),
      { x: 150, y: 195, permis: ["bumpers", "mini", "cibles"], fixe: { espace: "asteroide" }, optionnel: { volcan: "geyser" } },
      { x: 280, y: 270, permis: ["cibles", "spinner", "mini"], fixe: { espace: "portailB" } },
      { x: 99, y: 290, permis: ["cibles", "spinner", "bumpers"], fixe: { espace: "portailA" }, optionnel: { volcan: "geyser" } },
      { x: 291, y: 190, permis: ["mini", "spinner"] },
    ],
    rampes: [
      { genre: "rampe", points: [[110, 400], [110, 350], [100, 280], [118, 190], [170, 120], [250, 105], [310, 150], [336, 240], [337, 448]], hauteur: 34, demiPorte: 14 },
    ],
    orbite: orbite(38, 334, 310, 152, 22),
    mini: { cote: 0, x: 46, y: 405, longueur: 38 },
  },
  {
    // « Boucle » : une grande boucle autour du haut qui part du bas de la table et revient du même côté, et les deux mini-bouches de l'orbite
    id: "boucle",
    emplacements: [
      theme(184, 330),
      trou(184, 235),
      { x: 112, y: 190, permis: ["bumpers", "mini", "spinner"], fixe: { espace: "asteroide" }, optionnel: { volcan: "geyser" } },
      { x: 262, y: 190, permis: ["cibles", "spinner", "mini"], fixe: { espace: "portailB" } },
      { x: 190, y: 130, permis: ["bumpers", "mini", "spinner"], fixe: { espace: "portailA" }, optionnel: { volcan: "geyser" } },
      { x: 111, y: 398, permis: ["mini", "spinner"] },
    ],
    rampes: [
      { genre: "rampe", points: [[292, 400], [292, 340], [302, 250], [272, 170], [210, 135], [150, 160], [100, 230], [60, 330], [32, 448]], hauteur: 34, demiPorte: 14 },
    ],
    orbite: orbite(38, 334, 280, 152, 20),
  },
];

/**
 * **Le plan d'essai** : la table des lots PB1 à PB4 (six emplacements, ni rampe, ni orbite, ni mini-batteur). Il n'est **jamais tiré** (il n'est pas dans `PLANS`) : les tests des règles y posent leurs modules aux
 * mêmes endroits qu'avant les plans.
 */
export const PLAN_CLASSIQUE: Plan = {
  id: "classique",
  emplacements: [
    { x: 100, y: 220, permis: ["cibles", "spinner", "mini", "bumpers"] },
    { x: 184, y: 180, permis: ["bumpers", "bumpers", "bumpers", "mini"], fixe: { espace: "asteroide" } },
    { x: 270, y: 220, permis: ["cibles", "spinner", "mini"], fixe: { espace: "portailB" } },
    { x: 92, y: 385, permis: ["cibles", "trou", "spinner"], fixe: { espace: "portailA" }, optionnel: { volcan: "geyser" } },
    { x: 276, y: 385, permis: ["cibles", "trou", "mini"], fixe: { ocean: "trou" }, optionnel: { volcan: "geyser" } },
    theme(184, 320),
  ],
  rampes: [],
  orbite: null,
};

export const NB_PLANS = PLANS.length;
export const IDS_PLANS: readonly string[] = PLANS.map((p) => p.id);
export const planDe = (id: string): Plan => {
  const p = id === PLAN_CLASSIQUE.id ? PLAN_CLASSIQUE : PLANS.find((q) => q.id === id);
  if (!p) throw new Error(`plan inconnu : ${id}`);
  return p;
};

/** Les modules permis à l'emplacement `i` d'un plan, selon le thème (sans les répétitions des poids). */
export function permisDe(theme: ThemePinball, plan: Plan, i: number): readonly Module[] {
  const e = plan.emplacements[i]!;
  const fixe = e.fixe?.[theme];
  if (fixe) return [fixe];
  const opt = e.optionnel?.[theme];
  const base = [...new Set(e.permis)];
  return opt ? [...base, opt] : base;
}

// --- Le plan du jour. **Jamais deux jours de suite le même plan, jonction comprise** — la règle des thèmes (`themes.ts`) avec le nombre de plans : des cycles aussi longs que la liste des plans, alignés sur le numéro de
// jour, un ordre tiré de la graine du cycle, et le premier plan d'un cycle échange sa place avec le deuxième s'il est le dernier du cycle d'avant. Le plan d'un jour se calcule seul, sans état.
const SEL_PLAN = 0x6b3d21;
const tirage = (k: number): number[] => new Rng(mixSeed(k, SEL_PLAN)).shuffle(Array.from({ length: NB_PLANS }, (_, i) => i));
function ordreDuCycle(k: number): number[] {
  const o = tirage(k);
  if (o[0] === tirage(k - 1)[NB_PLANS - 1]) [o[0], o[1]] = [o[1]!, o[0]!];
  return o;
}
/** Le plan d'un jour (numéro de jour civil). Pur, sans état. */
export function planDuJour(jour: number): Plan {
  const k = Math.floor(jour / NB_PLANS);
  return PLANS[ordreDuCycle(k)[jour - k * NB_PLANS]!]!;
}
