// Les réglages de la sensation qui touchent à la simulation (`?debug&tune`). Tous entiers. **Les valeurs par défaut sont celles de la partie classée** ; une partie jouée avec d'autres réglages n'est pas classable
// (le jeu le dit : `classable`). Les réglages qui ne changent rien à la simulation (arrêt sur image, secousse, éclats) sont dans le jeu (`apps/rush/src/sensations.ts`), jamais ici.

export interface Reglages {
  /** La vitesse du chevalier, en cm/s. */
  vitesse: number;
  /** La portée du coup (rayon de l'arc), en cm. */
  portee: number;
  /** La demi-ouverture de l'arc du coup, en degrés (30 à 90). */
  arc: number;
  /** La cadence des coups : la durée d'un coup (premier et deuxième), en ticks (lot BR0c : 30, soit une demi-seconde). Le troisième, le coup final, dure 40 % de plus (42). */
  cadence: number;
  /** L'anticipation d'un coup (lot BR0c) : les ticks avant l'impact (l'épée ramenée en arrière, le corps qui pivote) ; le coup final en prend 4/3 (8). Le reste du coup est la phase active puis la récupération. */
  anticipation: number;
  /** Les dégâts d'un coup, en % du dégât de base (lot BR0c : 160 = ×1,6 ; un point de vie du jeu vaut 10 unités). */
  degats: number;
  /** Le coup final (le troisième) frappe ce % d'un coup ordinaire (lot BR0c : 250 = ×2,5). */
  coupFinal: number;
  /** L'engagement (lot BR0c) : pendant un coup le chevalier avance à ce % de sa vitesse de marche (dans la direction tenue, sinon vers où il frappe jusqu'à la fin de la phase active). */
  engagement: number;
  /** La force du recul infligé aux monstres, en cm par tick au premier tick (il décroît de 20 % par tick) ; le coup final repousse deux fois plus fort (lot BR0c). */
  recul: number;
  /** La fenêtre d'invincibilité de l'esquive, en ticks (la course de l'esquive en dure 12). */
  fenetreEsquive: number;
  /** Les points de vie du golem (lot BR0c : un coup ordinaire en ôte 16, le coup final 40 ; la gelée en a 30, la chauve-souris 10). */
  golemVie: number;
  /** Le repos du golem entre deux attaques, en ticks (phase 1 ; il est réduit d'un tiers en phase 2). */
  golemCadence: number;
  /** Le rythme des ennemis, en % (lot BR0b) : 100 = les valeurs par défaut. Il multiplie d'un coup les vitesses (×rythme/100) et divise toutes les durées (annonces, récupérations, repos, cycles) de tous les ennemis. */
  rythme: number;
  /** La course hors combat (lot BR1b) : les ticks sans frapper, sans être touché et sans ennemi alerté à moins de `courseRayon` avant que la vitesse monte (72 = 1,2 s). */
  courseDelai: number;
  /** La montée de la vitesse jusqu'au facteur de la course, en ticks (24 = 0,4 s), tant que le chevalier marche. */
  courseMontee: number;
  /** La vitesse de course, en % de la marche (160 = ×1,6). 100 : pas de course. */
  courseFacteur: number;
  /** Le rayon, en cm, autour du chevalier où un ennemi alerté interdit la course (1 000 = 10 m). */
  courseRayon: number;
  // --- Lot BR2 : l'XP. Un monstre tué et un obstacle brisé lâchent une gemme qui vaut ce nombre de points d'XP ; le niveau 2 s'atteint à `xpBase` points, puis chaque niveau coûte `xpPas` points de plus que le précédent. ---
  xpGelee: number;
  xpChauve: number;
  xpRonces: number;
  xpCaisse: number;
  xpBase: number;
  xpPas: number;
  /** L'XP d'un monstre d'un CAMP (au bout d'un détour) en % de celle d'un monstre du chemin : le détour est un pari, il rapporte plus. */
  xpCamp: number;
  /** Le rayon d'aimant des gemmes, en cm (elles volent vers le chevalier dans ce rayon et ne disparaissent jamais). */
  aimant: number;
  // --- Lot BR2 : la force d'un palier de chaque amélioration (`ameliorations.ts`). Les pourcentages sont ajoutés par palier. ---
  /** Lame lourde : + % de dégâts, et un coup + % plus long. */
  lourdeDegats: number;
  lourdeLenteur: number;
  /** Allonge : + % de portée et + degrés de demi-ouverture de l'arc. */
  allongePortee: number;
  allongeArc: number;
  /** Cadence : un coup − % plus court. */
  cadenceGain: number;
  /** Onde d'épée : les dégâts de l'onde en % du 3ᵉ coup, et sa portée en cm. */
  ondeDegats: number;
  ondePortee: number;
  /** Bottes légères : + % de vitesse de marche et de course. */
  bottesVitesse: number;
  /** Esquive longue : + % de longueur. Esquive vive : − ticks d'attente. Esquive tranchante : les dégâts de l'esquive en % d'un coup ordinaire. */
  esquiveLongue: number;
  esquiveVive: number;
  tranchanteDegats: number;
  /** Vol de vie : un cœur tous les N monstres tués. */
  volVie: number;
  /** Brise-pierre : + % de dégâts contre le boss. */
  briseDegats: number;
  /** Aimant : + % de rayon par palier. */
  aimantGain: number;
}

export const REGLAGES_DEFAUT: Reglages = {
  vitesse: 468,
  portee: 240,
  arc: 60,
  cadence: 30,
  anticipation: 6,
  degats: 160,
  coupFinal: 250,
  engagement: 40,
  recul: 48,
  fenetreEsquive: 16,
  golemVie: 1400,
  golemCadence: 80,
  rythme: 100,
  courseDelai: 72,
  courseMontee: 24,
  courseFacteur: 160,
  courseRayon: 1000,
  xpGelee: 12,
  xpChauve: 10,
  xpRonces: 8,
  xpCaisse: 16,
  xpBase: 40,
  xpPas: 20,
  xpCamp: 300,
  aimant: 300,
  lourdeDegats: 70,
  lourdeLenteur: 5,
  allongePortee: 20,
  allongeArc: 8,
  cadenceGain: 25,
  ondeDegats: 80,
  ondePortee: 700,
  bottesVitesse: 30,
  esquiveLongue: 25,
  esquiveVive: 10,
  tranchanteDegats: 100,
  volVie: 8,
  briseDegats: 90,
  aimantGain: 33,
};

/** Les bornes de chaque réglage (le curseur de `?tune` et la validation d'un JSON collé). */
export const BORNES: Readonly<Record<keyof Reglages, readonly [number, number]>> = {
  vitesse: [300, 900],
  portee: [140, 400],
  arc: [30, 90],
  cadence: [10, 60],
  anticipation: [2, 14],
  degats: [50, 400],
  coupFinal: [100, 500],
  engagement: [0, 100],
  recul: [0, 90],
  fenetreEsquive: [6, 36],
  golemVie: [100, 4000],
  golemCadence: [20, 240],
  rythme: [40, 200],
  courseDelai: [0, 300],
  courseMontee: [1, 120],
  courseFacteur: [100, 250],
  courseRayon: [200, 2500],
  xpGelee: [0, 200],
  xpChauve: [0, 200],
  xpRonces: [0, 200],
  xpCaisse: [0, 200],
  xpBase: [10, 1000],
  xpPas: [0, 500],
  xpCamp: [50, 500],
  aimant: [100, 1500],
  lourdeDegats: [0, 100],
  lourdeLenteur: [0, 40],
  allongePortee: [0, 50],
  allongeArc: [0, 30],
  cadenceGain: [0, 25],
  ondeDegats: [10, 300],
  ondePortee: [300, 1500],
  bottesVitesse: [0, 30],
  esquiveLongue: [0, 60],
  esquiveVive: [0, 20],
  tranchanteDegats: [10, 400],
  volVie: [1, 30],
  briseDegats: [0, 100],
  aimantGain: [0, 100],
};

export const CLES_REGLAGES = Object.keys(REGLAGES_DEFAUT) as (keyof Reglages)[];

/** Les réglages d'un objet quelconque (un JSON collé) : les clés connues, entières, ramenées dans leurs bornes ; les autres valent leur défaut. */
export function reglagesDe(brut: unknown): Reglages {
  const r: Reglages = { ...REGLAGES_DEFAUT };
  if (typeof brut !== "object" || brut === null) return r;
  for (const k of CLES_REGLAGES) {
    const v = (brut as Record<string, unknown>)[k];
    if (typeof v === "number" && Number.isFinite(v)) r[k] = Math.min(BORNES[k][1], Math.max(BORNES[k][0], Math.round(v)));
  }
  return r;
}

export const sontLesReglagesParDefaut = (r: Reglages): boolean => CLES_REGLAGES.every((k) => r[k] === REGLAGES_DEFAUT[k]);
