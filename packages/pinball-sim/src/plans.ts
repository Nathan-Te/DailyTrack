import { mixSeed, Rng } from "@cdj/core";
import { AXE, TOUR, NORME } from "./constantes";
import { cosinus, div, sinus } from "./entiers";
import type { Module } from "./generateur";
import type { ThemePinball } from "./themes";

// LES TABLES DESSINÉES (lot PBT1) — décision de Nathan du 21/11/2026 : **les tables ne sont plus tirées en emplacements, elles sont dessinées**. Trois tables sur le même châssis : la table A « Classique », la table B
// « Rampe et orbite », la table C « Mini-batteur », chacune jouable **en miroir** (gauche-droite, autour de l'axe x = 184). Le jour tire le thème, la table et le miroir : 6 dispositions × 4 thèmes = 24 tables
// (`generateur.ts`). **Le bas de la table ne change pas** (batteurs, lance-pierres, couloirs de retour, lanceur, couloirs du haut : `table.ts`).
//
// **Une nouvelle table se dessine d'abord avec Nathan**, sur le châssis, et ses lignes de tir sont vérifiées avant d'écrire le code (`packages/pinball-sim/CLAUDE.md`). Une table est une donnée : tout est en pixels de la
// table (375 × 760), entiers, aucun hasard ; la simulation les passe en unités. Les coordonnées ci-dessous sont celles de la version « de gauche » ; le miroir (`miroirDuPlan`) les reflète autour de l'axe.
// **Ajouter une table** : une entrée de `PLANS`, une ligne `plan.<id>` dans les catalogues du jeu, `PINBALL_GENERATOR_VERSION` + 1.

/** Un segment en pixels de la table : `[ax, ay, bx, by]`. */
export type Seg = readonly [number, number, number, number];
/** **Une banque de cibles dessinée** : ses cibles (trois segments, tournés vers un batteur) et son mur de fond, en pixels, entiers. */
export interface DefBanque {
  cibles: readonly Seg[];
  fond: Seg;
}
/** **Un guide** : un mur du plateau dessiné avec la table — le guide intérieur du couloir de l'orbite, les deux guides de la bouche d'une rampe. `points` : une ligne brisée, en pixels ; `genre` : ce qu'elle guide. */
export interface DefGuide {
  genre: "orbite" | "bouche";
  points: readonly (readonly [number, number])[];
}

/** Un emplacement de module : son centre, le module qu'on y pose, et ce qu'y posent les thèmes à la place. */
export interface Emplacement {
  x: number;
  y: number;
  /** La géométrie dessinée du module, quand elle n'est pas celle du module posé en son centre : les centres des bumpers (le dernier est l'astéroïde dans l'espace), un spinner ou une coulée **sans murs** (dans le couloir de l'orbite). */
  points?: readonly (readonly [number, number])[];
  banque?: DefBanque;
  sansMurs?: boolean;
  /** Les modules permis dans les thèmes qui ne s'en servent pas. **Un seul module permis : l'emplacement est fixe** (le trou). Seul le plan d'essai en a plusieurs. */
  permis: readonly Module[];
  /** L'élément que le thème pose ici, toujours (le manège, le trou noir, un portail, l'astéroïde…). */
  fixe?: Readonly<Partial<Record<ThemePinball, Module>>>;
  /** L'élément que le thème peut poser ici : **un seul des emplacements qui le portent est tiré du jour**. Seul le plan d'essai en a. */
  optionnel?: Readonly<Partial<Record<ThemePinball, Module>>>;
}

/** Un rail : une rampe (on y entre par un bout, on en sort par l'autre) ou l'orbite (une bouche). `points` : les points de contrôle de la courbe, de l'entrée à la sortie. */
export interface DefRail {
  genre: "rampe" | "orbite";
  points: readonly (readonly [number, number])[];
  /** La hauteur du rail au-dessus du plateau, au rendu seulement (px). */
  hauteur: number;
  /** La demi-largeur de la bouche (px) : la bille est prise quand son centre est à moins de cette distance du milieu de la bouche. */
  demiPorte: number;
  /** Lot PBT1 : une orbite qui n'a qu'une bouche (à son entrée) : elle ne se prend pas par l'autre bout. */
  unSens?: boolean;
}

/** Le mini-batteur : un troisième batteur sur un flanc de la table, qui suit le bouton du batteur du même côté. Son pivot est donné **dans le repère du côté gauche** ; du côté droit il est l'image dans l'axe de la table. */
export interface DefMini {
  cote: 0 | 1;
  x: number;
  y: number;
  /** Sa longueur (px). */
  longueur: number;
}

/**
 * **La porte** : un battant qui ferme un passage. `x`, `y` : le milieu du battant ; `angle` : la direction du passage en degrés autour de la verticale (0 : vers le haut, négatif : vers le haut et la gauche), un multiple de
 * 5, **toujours vers le haut** (|angle| < 90) ; `largeur` : la longueur du battant ; `profondeur` : la longueur des deux murs du passage. **Lot PBT1 : la porte d'une table dessinée est posée sur la bouche de l'orbite**,
 * sans murs (`sansMurs` : les guides du couloir font les murs) et **à sens unique** (`sensUnique` : fermée, elle arrête la bille qui monte ; la bille qui descend d'en haut la traverse — sinon elle s'y poserait et resterait
 * coincée). Les murs du passage sont de la table (`construireTable`), le passage se lit sur la ligne du battant.
 */
export interface DefPorte {
  x: number;
  y: number;
  angle: number;
  largeur: number;
  profondeur: number;
  sansMurs?: boolean;
  sensUnique?: boolean;
}

/** **L'aiguillage** : la dérivation d'une rampe du plan (son rang dans `rampes`). `partie` : où elle se trouve sur la rampe, en ‰ de sa longueur. Le point exact est calculé par la table. */
export interface DefAiguillage {
  rampe: number;
  partie: number;
}

export interface Plan {
  id: string;
  emplacements: readonly Emplacement[];
  /** Lot PBT1 : les éléments de plus qu'un thème pose (les portails de l'espace, la coulée du volcan) : ils suivent les emplacements, dans l'ordre. */
  extras?: Readonly<Partial<Record<ThemePinball, readonly Emplacement[]>>>;
  /** Lot PBT1 : les murs du plateau dessinés avec la table (le guide du couloir de l'orbite, les guides de la bouche d'une rampe). */
  guides?: readonly DefGuide[];
  rampes: readonly DefRail[];
  /** `null` : pas d'orbite (la table C, le plan d'essai). */
  orbite: DefRail | null;
  mini?: DefMini;
  porte?: DefPorte;
  aiguillage?: DefAiguillage;
  /** Vrai pour la table dessinée en miroir (`miroirDuPlan`). */
  miroir?: boolean;
}

/** Les emplacements d'une table dans un thème : ceux du plan, puis ce que le thème y ajoute. Le contenu d'un jour (`Contenu.modules`) a un module par emplacement, dans cet ordre. */
export const emplacementsDe = (plan: Plan, theme: ThemePinball): readonly Emplacement[] => (plan.extras?.[theme] ? [...plan.emplacements, ...plan.extras[theme]!] : plan.emplacements);

/** L'emplacement de l'élément du thème : le manège, le tourbillon, le trou noir ou le geyser (la mission est le tir central de chaque table). */
const theme = (x: number, y: number, volcan: Module = "geyser"): Emplacement => ({ x, y, permis: ["manege"], fixe: { foire: "manege", ocean: "tourbillon", espace: "trouNoir", volcan } });
/** Le trou : toujours là, dans tous les thèmes (la Pieuvre de l'océan) ; c'est le verrou. */
const trou = (x: number, y: number): Emplacement => ({ x, y, permis: ["trou"] });
/** Les trois bumpers groupés sous les couloirs du haut ; l'astéroïde de l'espace est le dernier des trois. */
const bumpers = (cx: number, cy: number, points: readonly (readonly [number, number])[]): Emplacement => ({ x: cx, y: cy, points, permis: ["bumpers"], fixe: { espace: "asteroide" } });
/** Un spinner dans le couloir de l'orbite : rien que son capteur (les murs du couloir sont ceux de l'orbite). */
const spinnerDuCouloir = (x: number, y: number): Emplacement => ({ x, y, permis: ["spinner"], sansMurs: true });
/** Les éléments de plus de l'espace — les deux portails, de part et d'autre du trou noir — et du volcan — l'accélération du couloir de l'orbite. */
const portails = (x: number, y: number): readonly Emplacement[] => [{ x: x - 30, y, permis: ["portailA"] }, { x: x + 30, y, permis: ["portailB"] }];

// --- Les sinus et cosinus des multiples de 10° (×1 000), pour dessiner un arc en entiers.
const SIN10: Readonly<Record<number, number>> = { 0: 0, 10: 174, 20: 342, 30: 500, 40: 643, 50: 766, 60: 866, 70: 940, 80: 985, 90: 1000 };
const sin = (a: number): number => (a <= 90 ? SIN10[a]! : SIN10[180 - a]!);
const cos = (a: number): number => (a <= 90 ? SIN10[90 - a]! : -SIN10[a - 90]!);
/** Le point d'angle `a` (degrés, de 90 en haut à 180 à gauche) de l'arc de centre (196, 205) et de rayon `r` — l'arc du haut du couloir de l'orbite. */
const arc = (a: number, r: number): [number, number] => [196 + Math.trunc((cos(a) * r) / 1000), 205 - Math.trunc((sin(a) * r) / 1000)];
const ANGLES = [180, 160, 140, 120, 100, 90];

/**
 * **L'orbite gauche** : un couloir de 32 px le long du mur gauche puis de l'arc du haut. Son **guide intérieur** est un mur du plateau, vertical en x = 52 de `yBas` à y = 205, puis en arc (centre (196, 205), rayon 144)
 * jusqu'à (196, 61) ; la bille en ressort en haut, dans les couloirs et les bumpers. **Le rail** (`orbiteDuCouloir`) prend la bille à **sa bouche**, large et basse (`xm`, `ym` : le milieu, `demi` : sa demi-largeur), puis la
 * mène par le milieu du couloir (rayon 160) jusqu'au sommet ; le spinner et la coulée du couloir se déclenchent à son passage. **La bouche est là où l'éventail du batteur droit passe large** (lot PBT1, option 1 de
 * Nathan : le pied du couloir de 32 px, à 370 px du batteur, ne donnait que 5 ms) : elle recueille les tirs directs et ceux qui rebondissent sur le mur gauche. La porte (`porteDuCouloir`) la ferme, 26 px plus bas.
 */
export const guideDeLOrbite = (yBas: number): DefGuide => ({ genre: "orbite", points: [[52, yBas], ...ANGLES.map((a) => arc(a, 144))] });
export const orbiteDuCouloir = (xm: number, ym: number, hauteur: number, demi = 38): DefRail => ({
  genre: "orbite",
  points: [[xm, ym], [xm - 4, ym - 34], [36, ym - 68], ...ANGLES.map((a) => arc(a, 160))],
  hauteur,
  demiPorte: demi,
  unSens: true,
});
/** La porte de l'orbite : un battant de `largeur` px, centré en `x`, à 26 px sous la bouche (`ym`), sans murs, à sens unique. */
export const porteDuCouloir = (x: number, ym: number, largeur: number): DefPorte => ({ x, y: ym + 26, angle: 0, largeur, profondeur: 0, sansMurs: true, sensUnique: true });

/**
 * **Une banque de cibles dessinée en diagonale** : trois cibles de 20 px centrées en `centres`, sur une droite inclinée de `angle` degrés (−28 : en montant vers la droite), tournées vers le batteur droit, et un mur de fond
 * (`ecart` px derrière elles, de 36 px de part et d'autre du milieu) pour que la bille ne passe pas derrière. Tout en entiers.
 */
export function banqueDiagonale(centres: readonly (readonly [number, number])[], angle: number, ecart = 9): DefBanque {
  const a = div(angle * TOUR, 360);
  const ux = cosinus(a);
  const uy = sinus(a);
  const au = (cx: number, cy: number, o: number): [number, number] => [cx + div(ux * o, NORME), cy + div(uy * o, NORME)];
  const cibles = centres.map(([cx, cy]) => [...au(cx, cy, -10), ...au(cx, cy, 10)] as unknown as Seg);
  const [mx, my] = centres[1]!;
  // le fond est du côté opposé au batteur droit : la normale tournée vers le bas et la droite, à l'envers
  const nx = -uy;
  const ny = ux;
  const [dx, dy] = [div(nx * ecart, NORME), div(ny * ecart, NORME)];
  const f = (o: number): [number, number] => {
    const [x, y] = au(mx, my, o);
    return ny > 0 ? [x - dx, y - dy] : [x + dx, y + dy];
  };
  return { cibles, fond: [...f(-36), ...f(36)] as unknown as Seg };
}

/** Une banque posée sur un flanc, à la verticale : les cibles de 20 px centrées en `x`, aux hauteurs `ys`, et son mur de fond en `xFond`, de `yFond0` à `yFond1`. */
export const banqueDuFlanc = (x: number, ys: readonly number[], xFond: number, yFond0: number, yFond1: number): DefBanque => ({
  cibles: ys.map((y) => [x, y - 10, x, y + 10] as const),
  fond: [xFond, yFond0, xFond, yFond1],
});

/**
 * Les tables. **Le premier emplacement est celui de l'élément du thème (le tir central : la mission), le deuxième le trou (le verrou)** ; les suivants : les bumpers, la banque de cibles, le spinner. Les portails de
 * l'espace et la coulée du volcan sont des `extras`.
 */
export const PLANS: readonly Plan[] = [
  {
    // Table A « Classique » (les flippers des années 70 et 80) : l'orbite gauche (guide intérieur, spinner dans son couloir, porte sur sa bouche), le tir central, le verrou à droite, la banque sur le flanc droit.
    // Pas de rampe, pas d'aiguillage, pas de mini-batteur. L'orbite ressort en haut, dans les couloirs et les bumpers ; la banque complète ouvre la porte.
    id: "A",
    emplacements: [
      theme(190, 285),
      trou(208, 464),
      bumpers(183, 165, [[152, 152], [214, 152], [183, 192]]),
      { x: 335, y: 360, banque: banqueDuFlanc(335, [334, 360, 386], 346, 316, 402), permis: ["cibles"] },
      spinnerDuCouloir(36, 275),
    ],
    extras: { espace: portails(190, 285), volcan: [{ x: 36, y: 300, permis: ["coulee"], sansMurs: true }] },
    guides: [guideDeLOrbite(328)],
    rampes: [],
    orbite: orbiteDuCouloir(52, 340, 20),
    porte: porteDuCouloir(52, 340, 64),
  },
  {
    // Table B « Rampe et orbite » (les flippers des années 90, simplifié) : l'orbite gauche (bouche à y = 330), la banque en diagonale en haut à gauche (tournée vers le batteur droit), le tir central, le verrou, et la
    // rampe droite (bouche entre deux guides, rail par le haut de la table jusqu'au couloir de retour droit) avec son aiguillage vers le verrou. **Le flanc gauche, sous la bouche de l'orbite, reste vide** : c'est le chemin du tir d'orbite depuis le batteur droit.
    id: "B",
    emplacements: [
      theme(176, 300),
      trou(288, 352),
      bumpers(242, 170, [[222, 150], [266, 162], [238, 196]]),
      { x: 124, y: 249, banque: banqueDiagonale([[100, 261], [124, 249], [148, 237]], -28), permis: ["cibles"] },
      spinnerDuCouloir(36, 270),
    ],
    extras: { espace: portails(176, 300), volcan: [{ x: 36, y: 295, permis: ["coulee"], sansMurs: true }] },
    guides: [guideDeLOrbite(328), { genre: "bouche", points: [[250, 322], [272, 300]] }, { genre: "bouche", points: [[311, 332], [304, 310]] }],
    rampes: [{ genre: "rampe", points: [[286, 310], [302, 206], [310, 176], [326, 196], [332, 300], [332, 540]], hauteur: 32, demiPorte: 17 }],
    orbite: orbiteDuCouloir(52, 340, 20),
    porte: porteDuCouloir(52, 340, 64),
    aiguillage: { rampe: 0, partie: 450 },
  },
  {
    // Table C « Mini-batteur » (les tables à batteur du haut) : un mini-batteur sur le flanc gauche, qui tire vers la bouche de la rampe ; la banque en diagonale en haut à gauche ; le tir central **plus bas** que sur un
    // premier dessin (pour sortir de la ligne du mini-batteur vers la rampe) ; le verrou ; la rampe, jusqu'au couloir de retour droit, avec son aiguillage vers le verrou. Pas d'orbite, donc pas de porte.
    id: "C",
    emplacements: [
      theme(205, 350),
      trou(160, 464),
      bumpers(181, 163, [[152, 150], [210, 150], [181, 188]]),
      { x: 92, y: 245, banque: banqueDiagonale([[68, 257], [92, 245], [116, 233]], -28), permis: ["cibles"] },
    ],
    extras: { espace: portails(205, 350) },
    guides: [{ genre: "bouche", points: [[246, 246], [244, 226]] }, { genre: "bouche", points: [[295, 256], [288, 236]] }],
    rampes: [{ genre: "rampe", points: [[270, 236], [290, 150], [300, 120], [320, 140], [332, 300], [332, 540]], hauteur: 32, demiPorte: 17 }],
    orbite: null,
    mini: { cote: 0, x: 46, y: 405, longueur: 38 },
    aiguillage: { rampe: 0, partie: 700 },
  },
];

/**
 * **Le plan d'essai** : la table des lots PB1 à PB4 (six emplacements, ni rampe, ni orbite, ni mini-batteur). Il n'est **jamais tiré** (il n'est pas dans `PLANS`) : les tests des règles y posent leurs modules aux
 * mêmes endroits qu'avant les tables dessinées.
 */
export const PLAN_CLASSIQUE: Plan = {
  id: "classique",
  emplacements: [
    { x: 100, y: 220, permis: ["cibles", "spinner", "mini", "bumpers"] },
    { x: 184, y: 180, permis: ["bumpers", "bumpers", "bumpers", "mini"], fixe: { espace: "asteroide" } },
    { x: 270, y: 220, permis: ["cibles", "spinner", "mini"], fixe: { espace: "portailB" } },
    { x: 92, y: 385, permis: ["cibles", "trou", "spinner"], fixe: { espace: "portailA" } },
    { x: 276, y: 385, permis: ["cibles", "trou", "mini"], fixe: { ocean: "trou" } },
    { x: 184, y: 320, permis: ["manege"], fixe: { foire: "manege", ocean: "tourbillon", espace: "trouNoir", volcan: "coulee" } },
  ],
  rampes: [],
  orbite: null,
};

export const NB_PLANS = PLANS.length;
export const IDS_PLANS: readonly string[] = PLANS.map((p) => p.id);

// --- Le miroir : la table reflétée autour de l'axe (x → 368 − x). Les rails et les guides se lisent dans le même ordre, le mini-batteur change de côté (son pivot est dans le repère de son côté), l'angle de la porte s'inverse.
const mx = (x: number): number => 2 * AXE - x;
const miroirSeg = (s: Seg): Seg => [mx(s[0]), s[1], mx(s[2]), s[3]];
const miroirPoints = (p: readonly (readonly [number, number])[]): [number, number][] => p.map(([x, y]) => [mx(x), y]);
const miroirEmplacement = (e: Emplacement): Emplacement => ({
  ...e,
  x: mx(e.x),
  ...(e.points ? { points: miroirPoints(e.points) } : {}),
  ...(e.banque ? { banque: { cibles: e.banque.cibles.map(miroirSeg), fond: miroirSeg(e.banque.fond) } } : {}),
});
const MIROIRS = new Map<string, Plan>();
/** La table reflétée. **Le tir d'un batteur se joue de l'autre côté** : toutes les mesures (fenêtres de tir, validation) se refont sur chacune. */
export function miroirDuPlan(p: Plan): Plan {
  const connu = MIROIRS.get(p.id);
  if (connu) return connu;
  const extras: Partial<Record<ThemePinball, readonly Emplacement[]>> = {};
  for (const [t, liste] of Object.entries(p.extras ?? {})) extras[t as ThemePinball] = liste.map(miroirEmplacement);
  const m: Plan = {
    id: p.id,
    emplacements: p.emplacements.map(miroirEmplacement),
    ...(p.extras ? { extras } : {}),
    ...(p.guides ? { guides: p.guides.map((g) => ({ genre: g.genre, points: miroirPoints(g.points) })) } : {}),
    rampes: p.rampes.map((r) => ({ ...r, points: miroirPoints(r.points) })),
    orbite: p.orbite ? { ...p.orbite, points: miroirPoints(p.orbite.points) } : null,
    ...(p.mini ? { mini: { ...p.mini, cote: p.mini.cote === 0 ? (1 as const) : (0 as const) } } : {}),
    ...(p.porte ? { porte: { ...p.porte, x: mx(p.porte.x), angle: -p.porte.angle } } : {}),
    ...(p.aiguillage ? { aiguillage: p.aiguillage } : {}),
    miroir: true,
  };
  MIROIRS.set(p.id, m);
  return m;
}

/** La table `id`, ou son miroir. */
export const planDe = (id: string, miroir = false): Plan => {
  const p = id === PLAN_CLASSIQUE.id ? PLAN_CLASSIQUE : PLANS.find((q) => q.id === id);
  if (!p) throw new Error(`plan inconnu : ${id}`);
  return miroir ? miroirDuPlan(p) : p;
};

/** Les modules permis à l'emplacement `i` d'une table, selon le thème (le plan d'essai en a plusieurs ; une table dessinée, un seul). */
export function permisDe(theme: ThemePinball, plan: Plan, i: number): readonly Module[] {
  const e = emplacementsDe(plan, theme)[i]!;
  const fixe = e.fixe?.[theme];
  if (fixe) return [fixe];
  const opt = e.optionnel?.[theme];
  const base = [...new Set(e.permis)];
  return opt ? [...base, opt] : base;
}

// --- La disposition du jour : **la table et son miroir**. Jamais deux jours de suite la même disposition, jonction comprise — la règle des thèmes (`themes.ts`) avec six dispositions : des cycles de six jours, alignés
// sur le numéro de jour, un ordre tiré de la graine du cycle, et la première disposition d'un cycle échange sa place avec la deuxième si elle est la dernière du cycle d'avant. Se calcule seule, sans état.
export interface Disposition {
  plan: string;
  miroir: boolean;
}
/** Les six dispositions : chaque table, de face puis en miroir. */
export const DISPOSITIONS: readonly Disposition[] = IDS_PLANS.flatMap((plan) => [{ plan, miroir: false }, { plan, miroir: true }]);
const NB_DISPOSITIONS = DISPOSITIONS.length;
const SEL_PLAN = 0x6b3d21;
const tirage = (k: number): number[] => new Rng(mixSeed(k, SEL_PLAN)).shuffle(Array.from({ length: NB_DISPOSITIONS }, (_, i) => i));
function ordreDuCycle(k: number): number[] {
  const o = tirage(k);
  if (o[0] === tirage(k - 1)[NB_DISPOSITIONS - 1]) [o[0], o[1]] = [o[1]!, o[0]!];
  return o;
}
/** La disposition d'un jour (numéro de jour civil). Pur, sans état. */
export function dispositionDuJour(jour: number): Disposition {
  const k = Math.floor(jour / NB_DISPOSITIONS);
  return DISPOSITIONS[ordreDuCycle(k)[jour - k * NB_DISPOSITIONS]!]!;
}
/** La table d'un jour (de face ou en miroir : `dispositionDuJour`). */
export const planDuJour = (jour: number): Plan => {
  const d = dispositionDuJour(jour);
  return planDe(d.plan, d.miroir);
};
