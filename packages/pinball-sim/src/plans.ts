import { mixSeed, Rng } from "@cdj/core";
import type { Module } from "./generateur";
import { miroirDePlan, orbite, porteDeLOrbite, theme, trou } from "./plans-outils";
import { PLANS_ESSAI } from "./plans-essai";
import type { ThemePinball } from "./themes";

export { miroirDePlan, orbite, porteDeLOrbite } from "./plans-outils";
export { PLANS_ESSAI } from "./plans-essai";

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
  /** Lot PBT0 : les paramètres d'une orbite faite par `orbite()` (`xg`, `xd`, `y`, `r`, `hauteur`, `ag`, `ad`, `yd`) — le miroir la refait avec les bouches échangées, pour qu'elle longe toujours l'arc du châssis (qui n'est pas symétrique dans l'axe 184). */
  orb?: readonly [number, number, number, number, number, number, number, number];
}

/** Le mini-batteur : un troisième batteur en haut de la table, qui suit le bouton du batteur du même côté. Son pivot est donné **dans le repère du côté gauche** ; du côté droit il est l'image dans l'axe de la table. */
export interface DefMini {
  cote: 0 | 1;
  x: number;
  y: number;
  /** Sa longueur (px). */
  longueur: number;
}

/**
 * **La porte** (lot PBG3) : un petit passage incliné, deux murs parallèles (`largeur` px entre eux, `profondeur` px de long) fermés à leur bout par un battant. **Fermé, le battant est un mur** (la bille qui vient d'en
 * bas le heurte et ressort ; celle qui tombe dessus glisse sur son côté, d'où l'inclinaison) ; **ouvert, la bille passe** et le passage rapporte gros. `x`, `y` : le milieu du battant ; `angle` : la direction du passage en
 * degrés autour de la verticale (0 : vers le haut, négatif : vers le haut et la gauche), un multiple de 5, **toujours vers le haut** (|angle| < 90) : le battant est le haut du passage, la bille qui est dedans retombe par le bas — une porte qui regarderait vers le bas ferait une coupe où la bille s'arrêterait. Les murs sont de la table (`construireTable`), le passage se lit sur la ligne du battant.
 */
export interface DefPorte {
  x: number;
  y: number;
  angle: number;
  largeur: number;
  profondeur: number;
}

/** **L'aiguillage** (lot PBG3) : la dérivation d'une rampe du plan (son rang dans `rampes`). `partie` : où elle se trouve sur la rampe, en ‰ de sa longueur. Le point exact est calculé par la table. */
export interface DefAiguillage {
  rampe: number;
  partie: number;
}

export interface Plan {
  id: string;
  /** Lot PBT0 : l'idée du plan, en une phrase (les plans d'essai t1 à t6 : la fiche de tir du README du lot). */
  idee?: string;
  emplacements: readonly Emplacement[];
  rampes: readonly DefRail[];
  /** `null` seulement pour le plan d'essai (`PLAN_CLASSIQUE`) : tout plan du jour a son orbite. */
  orbite: DefRail | null;
  mini?: DefMini;
  /** Lot PBG3 : la porte et l'aiguillage ; seul le plan d'essai n'en a pas. */
  porte?: DefPorte;
  aiguillage?: DefAiguillage;
}

/** Les plans. Le premier emplacement est celui de l'élément du thème, le deuxième le trou ; les suivants portent, selon le thème, l'astéroïde et les portails de l'espace et le geyser du volcan. */
export const PLANS: readonly Plan[] = [
  {
    // « Doublette » : deux rampes qui se croisent au sommet, chacune ramène la bille dans le couloir de retour de l'autre côté. Lot PBL2 : les bouches des rampes sont sur l'éventail des tirs (l'une au centre, l'autre à droite,
    // côte à côte avec la bouche libre de l'orbite), la porte ferme la bouche droite de l'orbite (le battant penché à 35° : une bille posée dessus glisse), le trou (verrou) est devant le batteur droit et l'élément du thème au centre.
    id: "doublette",
    emplacements: [
      theme(206, 250, "geyser"),
      trou(195, 383),
      { x: 90, y: 400, permis: ["bumpers", "bumpers", "bumpers", "mini"], fixe: { espace: "asteroide" } },
      { x: 262, y: 212, permis: ["mini"], fixe: { espace: "portailB" } },
      { x: 270, y: 160, permis: ["cibles", "spinner", "mini"], fixe: { espace: "portailA", volcan: "coulee" } },
      { x: 205, y: 150, permis: ["mini"] },
    ],
    rampes: [
      { genre: "rampe", points: [[262, 345], [277, 304], [276, 220], [218, 140], [138, 126], [68, 175], [35, 270], [32, 448]], hauteur: 30, demiPorte: 17 },
      { genre: "rampe", points: [[153, 343], [153, 299], [92, 220], [150, 140], [230, 126], [300, 175], [333, 270], [336, 448]], hauteur: 44, demiPorte: 17 },
    ],
    orbite: orbite(88, 298, 295, 150, 20, 0, 35, 285),
    // l'aiguillage est sur la rampe de gauche, qui passe près du trou
    porte: porteDeLOrbite(298, 285, 35, 60, 24),
    aiguillage: { rampe: 0, partie: 130 },
  },
  {
    // « Tremplin » : une rampe qui monte du centre de la table et traverse le haut, et un mini-batteur à droite qui l'alimente. Lot PBL2 : les objectifs sont sur l'éventail des tirs — le verrou (le trou) à gauche du centre
    // et le geyser en bas à droite (l'emplacement du haut à gauche, entre la rampe et l'orbite, ne laissait à la plaque de la mission de place que sur un rail), l'élément du thème à droite (tirs croisés du batteur gauche), la bouche de la rampe devant le batteur gauche, la porte sur la bouche gauche de l'orbite
    // (le batteur droit y monte ; le battant, penché à 40°, la ferme) et la bouche droite de l'orbite libre ; aucun module à murs dans la zone de tir.
    id: "tremplin",
    emplacements: [
      theme(208, 238),
      trou(164, 308),
      { x: 101, y: 209, permis: ["bumpers", "bumpers", "mini"], fixe: { espace: "asteroide" } },
      { x: 135, y: 162, permis: ["spinner", "mini"], fixe: { espace: "portailB" } },
      { x: 252, y: 385, permis: ["cibles", "bumpers"], fixe: { espace: "portailA" }, optionnel: { volcan: "geyser" } },
      { x: 254, y: 170, permis: ["mini", "bumpers"] },
    ],
    rampes: [{ genre: "rampe", points: [[119, 388], [97, 350], [226, 250], [250, 175], [262, 120], [214, 82], [150, 90], [80, 150], [38, 250], [32, 448]], hauteur: 32, demiPorte: 17 }],
    orbite: orbite(114, 298, 268, 150, 20, -40, 15, 300),
    mini: { cote: 1, x: 52, y: 405, longueur: 38 },
    porte: porteDeLOrbite(114, 268, -40, 52, 20),
    aiguillage: { rampe: 0, partie: 420 },
  },
  {
    // « Bretelle » : une rampe qui contourne le haut, et un mini-batteur à gauche. Lot PBL2 : la bouche de la rampe devant le batteur droit, la porte sur la bouche gauche de l'orbite (le battant penché à 25°), la bouche droite libre, le trou
    // (verrou) devant le batteur droit et le geyser en haut à droite (l'emplacement du bas à gauche, au pied du mini-batteur, est un tir difficile : les tables du geyser qui s'y trouve sont refusées).
    id: "bretelle",
    emplacements: [
      theme(200, 268, "geyser"),
      trou(194, 390),
      { x: 90, y: 400, permis: ["bumpers", "mini", "cibles"], fixe: { espace: "asteroide" } },
      { x: 270, y: 208, permis: ["mini"], fixe: { espace: "portailB" } },
      { x: 278, y: 146, permis: ["cibles", "spinner", "bumpers"], fixe: { espace: "portailA", volcan: "coulee" } },
      { x: 205, y: 150, permis: ["mini"] },
    ],
    rampes: [
      { genre: "rampe", points: [[153, 347], [153, 303], [100, 280], [118, 190], [170, 120], [250, 105], [310, 150], [336, 240], [337, 448]], hauteur: 34, demiPorte: 17 },
    ],
    orbite: orbite(88, 290, 295, 150, 22, 0, 35, 310),
    mini: { cote: 1, x: 46, y: 405, longueur: 38 },
    porte: porteDeLOrbite(290, 310, 35, 60, 24),
    aiguillage: { rampe: 0, partie: 560 },
  },
  {
    // « Boucle » : une grande boucle autour du haut qui part du centre de la table et revient dans le couloir gauche, et les deux bouches de l'orbite. Lot PBL2 : le trou (verrou) devant le batteur droit, la bouche de la
    // boucle au centre, la porte sur la bouche droite de l'orbite (le battant penché à 35°) et la bouche gauche libre.
    id: "boucle",
    emplacements: [
      theme(206, 250, "geyser"),
      trou(195, 383),
      { x: 90, y: 400, permis: ["bumpers", "mini"], fixe: { espace: "asteroide" } },
      { x: 262, y: 212, permis: ["mini"], fixe: { espace: "portailB" } },
      { x: 270, y: 160, permis: ["bumpers", "mini", "spinner"], fixe: { espace: "portailA", volcan: "coulee" } },
      { x: 205, y: 150, permis: ["mini"] },
    ],
    rampes: [
      { genre: "rampe", points: [[153, 347], [153, 303], [302, 250], [272, 170], [210, 135], [150, 160], [100, 230], [60, 330], [32, 448]], hauteur: 34, demiPorte: 17 },
    ],
    orbite: orbite(88, 298, 295, 150, 20, 0, 35, 285),
    porte: porteDeLOrbite(298, 285, 35, 60, 24),
    aiguillage: { rampe: 0, partie: 470 },
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
    { x: 92, y: 385, permis: ["cibles", "trou", "spinner"], fixe: { espace: "portailA" } },
    { x: 276, y: 385, permis: ["cibles", "trou", "mini"], fixe: { ocean: "trou" } },
    theme(184, 320),
  ],
  rampes: [],
  orbite: null,
};

export const NB_PLANS = PLANS.length;
export const IDS_PLANS: readonly string[] = PLANS.map((p) => p.id);
/** Un plan d'essai peut être demandé retourné (`t1m`) : `<id>m` est le miroir de `<id>`. */
const SUFFIXE_MIROIR = "m";
/**
 * Le plan d'un identifiant : un plan du jour, `classique` (l'essai des règles), **un plan d'essai du lot PBT0 (`t1` à `t6`, jamais tirés)** ou le miroir de l'un d'eux (`<id>m`, `miroirDePlan`).
 * Un identifiant inconnu est une erreur.
 */
export const planDe = (id: string): Plan => {
  const direct = id === PLAN_CLASSIQUE.id ? PLAN_CLASSIQUE : (PLANS.find((q) => q.id === id) ?? PLANS_ESSAI.find((q) => q.id === id));
  if (direct) return direct;
  if (id.endsWith(SUFFIXE_MIROIR)) {
    const base = id.slice(0, -1);
    const p = base === PLAN_CLASSIQUE.id ? undefined : (PLANS.find((q) => q.id === base) ?? PLANS_ESSAI.find((q) => q.id === base));
    if (p) return miroirDePlan(p, id);
  }
  throw new Error(`plan inconnu : ${id}`);
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
