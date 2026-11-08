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
  // --- Lot BR5 : le TEMPS DE RECHARGE des compétences (une jauge de rage au premier jet, remplacée à la demande de Nathan par un délai, plus lisible). La compétence choisie au départ est prête au début ; la lancer la met en recharge (en ticks, selon la compétence ;
  // « Recharge vive » le raccourcit, « Écho » en laisse une part la première fois) ; un vase peut rendre `rechargeVase` ticks. Dans un scénario d'essai le délai est divisé par 4 (de quoi juger une compétence à froid). ---
  rechargeTourbillon: number;
  rechargeBond: number;
  rechargeBouclier: number;
  rechargeVase: number;
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
  /** Les VASES : la part (%) qui contient une gemme d'XP, la part (%) qui contient une recharge (le reste : un cœur, rarement) — le tirage de chaque vase est dans le niveau, ces seuils s'appliquent à la lecture — et l'XP d'un vase / d'un gélaton. */
  vaseGemme: number;
  vaseRecharge: number;
  xpVase: number;
  xpGelaton: number;
  /** Le COUP D'ÉLAN : frapper en pleine course fait une fente de `elanDistance` cm, dégâts à `elanDegats` % et recul à `elanRecul` %. */
  elanDistance: number;
  elanDegats: number;
  elanRecul: number;
  /** Les cartes de compétence : Recharge vive (− % de temps de recharge par palier, jamais sous 40 %), Maîtrise (+ % de dégâts et + % de zone par palier), Écho (la part du temps de recharge à attendre après la première utilisation, en %), la carte propre à chaque compétence (Tourbillon : + % de durée ; Bond : + ticks d'étourdissement ; Bouclier : + cibles traversées, par palier). */
  rechargeVive: number;
  maitriseDegats: number;
  maitriseZone: number;
  echoRecharge: number;
  signatureTourbillon: number;
  signatureBond: number;
  signatureBouclier: number;
  /** Lot BR6 : l'XP des quatre nouveaux ennemis (cracheur, chaman, totem, porte-bouclier), celle d'un monstre de la salle d'épreuve en % (`xpEpreuve`) et celle d'un élite en % (`xpElite` : ×10, plus un cœur garanti). */
  xpCracheur: number;
  xpChaman: number;
  xpTotem: number;
  xpPorteBouclier: number;
  xpEpreuve: number;
  xpElite: number;
  /** Lot BR6 : la part (%) des dégâts que le bouclier d'un chaman retire à l'allié qu'il protège (−70 %), la vie d'un élite (× ce nombre), sa taille (%) et la rapidité de ses attaques (la durée de ses annonces et de son cycle, en %). */
  protectionChaman: number;
  eliteVie: number;
  eliteTaille: number;
  eliteRapidite: number;
  /** Lot BR6 — les cartes de fin de partie. Lame enflammée : les dégâts de chaque pulsation de la zone qui brûle en % d'un coup ordinaire, sa durée (ticks) et son rayon (cm). Frénésie : − % de durée des coups par palier de cadence accumulé (jusqu'à 5), et le temps (ticks) avant qu'elle retombe. Écrasement : + % de dégâts contre un ennemi étourdi. Bond sismique : l'onde de la seconde secousse en % de la première (dégâts) et de rayon. Bouclier ricochet : le nombre de rebonds. Seconde charge : rien (elle ajoute une charge). */
  flammeDegats: number;
  flammeDuree: number;
  flammeRayon: number;
  frenesieGain: number;
  frenesieDuree: number;
  ecrasementDegats: number;
  sismiqueDegats: number;
  sismiqueRayon: number;
  ricochetRebonds: number;
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
  golemVie: 7500,
  golemCadence: 80,
  rythme: 100,
  courseDelai: 42,
  courseMontee: 12,
  courseFacteur: 160,
  courseRayon: 1000,
  xpGelee: 8,
  xpChauve: 7,
  xpBase: 70,
  xpPas: 25,
  xpCamp: 600,
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
  rechargeTourbillon: 900,
  rechargeBond: 600,
  rechargeBouclier: 480,
  rechargeVase: 180,
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
  vaseGemme: 60,
  vaseRecharge: 20,
  xpVase: 3,
  xpGelaton: 2,
  elanDistance: 300,
  elanDegats: 150,
  elanRecul: 200,
  rechargeVive: 15,
  maitriseDegats: 30,
  maitriseZone: 15,
  echoRecharge: 50,
  signatureTourbillon: 40,
  signatureBond: 60,
  signatureBouclier: 2,
  xpCracheur: 10,
  xpChaman: 14,
  xpTotem: 20,
  xpPorteBouclier: 16,
  xpEpreuve: 150,
  xpElite: 1000,
  protectionChaman: 70,
  eliteVie: 5,
  eliteTaille: 150,
  eliteRapidite: 80,
  flammeDegats: 60,
  flammeDuree: 180,
  flammeRayon: 170,
  frenesieGain: 5,
  frenesieDuree: 90,
  ecrasementDegats: 100,
  sismiqueDegats: 70,
  sismiqueRayon: 150,
  ricochetRebonds: 4,
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
  golemVie: [100, 20000],
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
  xpCamp: [50, 1000],
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
  rechargeTourbillon: [120, 3600],
  rechargeBond: [120, 3600],
  rechargeBouclier: [120, 3600],
  rechargeVase: [0, 1200],
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
  vaseRecharge: [0, 100],
  xpVase: [0, 100],
  xpGelaton: [0, 100],
  elanDistance: [0, 600],
  elanDegats: [100, 400],
  elanRecul: [50, 500],
  rechargeVive: [0, 30],
  maitriseDegats: [0, 100],
  maitriseZone: [0, 50],
  echoRecharge: [0, 100],
  signatureTourbillon: [0, 100],
  signatureBond: [0, 200],
  signatureBouclier: [0, 5],
  xpCracheur: [0, 200],
  xpChaman: [0, 200],
  xpTotem: [0, 200],
  xpPorteBouclier: [0, 200],
  xpEpreuve: [50, 1000],
  xpElite: [100, 3000],
  protectionChaman: [0, 95],
  eliteVie: [1, 10],
  eliteTaille: [100, 250],
  eliteRapidite: [40, 100],
  flammeDegats: [10, 300],
  flammeDuree: [30, 600],
  flammeRayon: [80, 400],
  frenesieGain: [1, 15],
  frenesieDuree: [20, 300],
  ecrasementDegats: [10, 300],
  sismiqueDegats: [10, 300],
  sismiqueRayon: [100, 300],
  ricochetRebonds: [1, 10],
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
