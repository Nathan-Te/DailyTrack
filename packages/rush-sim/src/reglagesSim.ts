// Les réglages de la sensation qui touchent à la simulation (`?debug&tune`). Tous entiers. **Les valeurs par défaut sont celles de la partie classée** ; une partie jouée avec d'autres réglages n'est pas classable
// (le jeu le dit : `classable`). Les réglages qui ne changent rien à la simulation (arrêt sur image, secousse, éclats) sont dans le jeu (`apps/rush/src/sensations.ts`), jamais ici.

export interface Reglages {
  /** La vitesse du chevalier, en cm/s. */
  vitesse: number;
  /** La portée du coup (rayon de l'arc), en cm. */
  portee: number;
  /** La demi-ouverture de l'arc du coup, en degrés (30 à 90). */
  arc: number;
  /** La cadence des coups : la durée d'un coup (premier et deuxième), en ticks. Le troisième dure 40 % de plus. */
  cadence: number;
  /** La force du recul infligé aux monstres, en cm par tick au premier tick (il décroît de 20 % par tick). */
  recul: number;
  /** La fenêtre d'invincibilité de l'esquive, en ticks (la course de l'esquive en dure 12). */
  fenetreEsquive: number;
  /** Les points de vie du golem. */
  golemVie: number;
  /** Le repos du golem entre deux attaques, en ticks (phase 1 ; il est réduit d'un tiers en phase 2). */
  golemCadence: number;
  /** Le rythme des ennemis, en % (lot BR0b) : 100 = les valeurs par défaut. Il multiplie d'un coup les vitesses (×rythme/100) et divise toutes les durées (annonces, récupérations, repos, cycles) de tous les ennemis. */
  rythme: number;
}

export const REGLAGES_DEFAUT: Reglages = {
  vitesse: 520,
  portee: 240,
  arc: 60,
  cadence: 17,
  recul: 36,
  fenetreEsquive: 16,
  golemVie: 120,
  golemCadence: 80,
  rythme: 100,
};

/** Les bornes de chaque réglage (le curseur de `?tune` et la validation d'un JSON collé). */
export const BORNES: Readonly<Record<keyof Reglages, readonly [number, number]>> = {
  vitesse: [300, 900],
  portee: [140, 400],
  arc: [30, 90],
  cadence: [8, 36],
  recul: [0, 90],
  fenetreEsquive: [6, 36],
  golemVie: [10, 400],
  golemCadence: [20, 240],
  rythme: [40, 200],
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
