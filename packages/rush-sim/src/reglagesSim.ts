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
  /** La course hors combat (lot BR1b) : les ticks sans frapper, sans être touché et sans ennemi alerté à moins de `courseRayon` avant que la vitesse monte (lot BR5 : 42 = 0,7 s ; 72 = 1,2 s au BR1b). */
  courseDelai: number;
  /** La montée de la vitesse jusqu'au facteur de la course, en ticks (lot BR5 : 12 = 0,2 s, plus franche ; 24 = 0,4 s au BR1b), tant que le chevalier marche. */
  courseMontee: number;
  /** La vitesse de course, en % de la marche (160 = ×1,6). 100 : pas de course. */
  courseFacteur: number;
  /** Le rayon, en cm, autour du chevalier où un ennemi alerté interdit la course (1 000 = 10 m). */
  courseRayon: number;
  // --- Lot BR2 : l'XP. Un monstre tué et un obstacle brisé lâchent une gemme qui vaut ce nombre de points d'XP ; le niveau 2 s'atteint à `xpBase` points, puis chaque niveau coûte `xpPas` points de plus que le précédent. ---
  xpGelee: number;
  xpChauve: number;
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
  /** Lot BR3 — l'AFFINITÉ du boss : chaque palier d'une carte que le boss favorise (`bosses.ts`, hors Brise-pierre qui a la sienne) MULTIPLIE les dégâts contre lui par (100 + ce %) / 100 : les paliers se composent. */
  affinite: number;
  // --- Lot BR5 : la RAGE (la jauge des compétences). Elle monte quand on touche (`rageTouche`), qu'on tue (`rageTue`), qu'on casse un vase (`rageVase`) et très lentement avec le temps (`rageTemps` par seconde) ; elle ne se vide pas toute seule ;
  // pleine (`rageMax`) elle permet UNE compétence, qui la vide. Un vase qui contient de la rage en rend `rageButin`. Les coups d'une compétence ne remplissent pas la jauge. ---
  rageMax: number;
  rageTouche: number;
  rageTue: number;
  rageVase: number;
  rageTemps: number;
  rageButin: number;
  /** Tourbillon : la durée (ticks), le rayon (cm), les dégâts de chaque passe en % d'un coup ordinaire (une passe tous les 12 ticks) et la vitesse de déplacement pendant la compétence en % de la marche. */
  tourbillonDuree: number;
  tourbillonRayon: number;
  tourbillonDegats: number;
  tourbillonVitesse: number;
  /** Bond écrasant : la portée du saut (cm), le rayon de l'onde de choc (cm), ses dégâts en % d'un coup ordinaire, l'étourdissement des ennemis touchés (ticks). */
  bondPortee: number;
  bondRayon: number;
  bondDegats: number;
  bondEtourdi: number;
  /** Lancer de bouclier : la portée (cm), le nombre de cibles qu'il traverse avant de revenir, ses dégâts en % d'un coup ordinaire. */
  bouclierPortee: number;
  bouclierCibles: number;
  bouclierDegats: number;
  /** Les VASES : la part (%) qui contient une gemme d'XP, la part (%) qui contient de la rage (le reste : un cœur, rarement) — le tirage de chaque vase est dans le niveau, ces seuils s'appliquent à la lecture — et l'XP d'un vase / d'un gélaton. */
  vaseGemme: number;
  vaseRage: number;
  xpVase: number;
  xpGelaton: number;
  /** Le COUP D'ÉLAN : frapper en pleine course fait une fente de `elanDistance` cm, dégâts à `elanDegats` % et recul à `elanRecul` %. */
  elanDistance: number;
  elanDegats: number;
  elanRecul: number;
  /** Les cartes de compétence : Rage vive (+ % de rage gagnée par palier), Maîtrise (+ % de dégâts et + % de zone par palier), Écho (la part de la jauge rendue après une utilisation, en %), la carte propre à chaque compétence (Tourbillon : + % de durée ; Bond : + ticks d'étourdissement ; Bouclier : + cibles traversées, par palier). */
  rageVive: number;
  maitriseDegats: number;
  maitriseZone: number;
  echoRend: number;
  signatureTourbillon: number;
  signatureBond: number;
  signatureBouclier: number;
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
  courseDelai: 42,
  courseMontee: 12,
  courseFacteur: 160,
  courseRayon: 1000,
  xpGelee: 12,
  xpChauve: 10,
  xpBase: 40,
  xpPas: 20,
  xpCamp: 450,
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
  affinite: 30,
  rageMax: 1000,
  rageTouche: 10,
  rageTue: 30,
  rageVase: 14,
  rageTemps: 1,
  rageButin: 150,
  tourbillonDuree: 72,
  tourbillonRayon: 280,
  tourbillonDegats: 100,
  tourbillonVitesse: 45,
  bondPortee: 700,
  bondRayon: 380,
  bondDegats: 250,
  bondEtourdi: 90,
  bouclierPortee: 900,
  bouclierCibles: 3,
  bouclierDegats: 220,
  vaseGemme: 70,
  vaseRage: 25,
  xpVase: 5,
  xpGelaton: 3,
  elanDistance: 300,
  elanDegats: 150,
  elanRecul: 200,
  rageVive: 35,
  maitriseDegats: 30,
  maitriseZone: 15,
  echoRend: 50,
  signatureTourbillon: 40,
  signatureBond: 60,
  signatureBouclier: 2,
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
  affinite: [0, 100],
  rageMax: [100, 5000],
  rageTouche: [0, 200],
  rageTue: [0, 500],
  rageVase: [0, 200],
  rageTemps: [0, 50],
  rageButin: [0, 1000],
  tourbillonDuree: [24, 180],
  tourbillonRayon: [150, 500],
  tourbillonDegats: [20, 400],
  tourbillonVitesse: [0, 100],
  bondPortee: [300, 1000],
  bondRayon: [200, 700],
  bondDegats: [50, 600],
  bondEtourdi: [0, 240],
  bouclierPortee: [400, 1500],
  bouclierCibles: [1, 8],
  bouclierDegats: [50, 600],
  vaseGemme: [0, 100],
  vaseRage: [0, 100],
  xpVase: [0, 100],
  xpGelaton: [0, 100],
  elanDistance: [0, 600],
  elanDegats: [100, 400],
  elanRecul: [50, 500],
  rageVive: [0, 100],
  maitriseDegats: [0, 100],
  maitriseZone: [0, 50],
  echoRend: [0, 100],
  signatureTourbillon: [0, 100],
  signatureBond: [0, 200],
  signatureBouclier: [0, 5],
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
