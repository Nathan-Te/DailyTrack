import type { PisteServie, Reglages } from "./types";

// La logique pure de la musique : choix du morceau suivant, courbes du fondu, niveau final, réglages communs, reprise d'une page à l'autre. Aucun accès à
// Web Audio, au stockage ni à l'horloge : tout est injecté, tout est testé par Vitest.

/** Durée du fondu entre deux morceaux (secondes). */
export const FONDU_S = 3;
/** Durée du fondu quand le joueur demande « Morceau suivant » (plus court : il attend). */
export const FONDU_SAUT_S = 1.2;
/** Durée d'un fondu d'entrée au démarrage ou après un changement de page (secondes). */
export const FONDU_ENTREE_S = 1.5;
/** Durée du fondu quand le jeu change de scène (de l'accueil à un niveau, d'un thème à l'autre). */
export const FONDU_SCENE_S = 2;
/**
 * Niveau de base : le morceau tel qu'il est préparé (−18 LUFS) quand le volume du joueur est à 100 % et que le jeu ne baisse rien. **Mesuré au lot « musique » (31/10/2026) : à 0,5, avec 40 % de
 * volume (au carré) et 35 % en course, la musique sortait à ≈ −49 dBFS en course de Track, contre ≈ −22 dBFS pour le moteur : on ne l'entendait pas.** Un compresseur doux est sur la sortie.
 */
export const NIVEAU_DE_BASE = 1;
/** Une reprise plus vieille que ça (ms) n'en est pas une : on repart d'un morceau tiré au sort. */
export const VALIDITE_REPRISE_MS = 5 * 60_000;
/** Volume par défaut (musique allumée) : le curseur est quadratique, 0,8 vaut 0,64 du niveau de base (−3,9 dB). */
export const VOLUME_PAR_DEFAUT = 0.8;

export const REGLAGES_DEFAUT: Readonly<Reglages> = { volume: VOLUME_PAR_DEFAUT, coupee: false };
export const CLE_REGLAGES = "cdj:musique";
/** La reprise est gardée dans le stockage de **l'onglet** (jamais dans celui de l'appareil) : elle ne vaut que pour la navigation en cours. */
export const CLE_REPRISE = "cdj:musique:reprise";

/**
 * Les morceaux d'une scène (le jeu a déjà été choisi) : ceux qui la nomment ; sinon ceux qui passent partout (aucune scène) ; sinon **aucun** (le silence : un jeu qui n'a rien pour son
 * menu ne joue pas la musique d'un niveau). **Pas de scène** (le jeu n'en annonce pas : un scénario d'essai) : tous les morceaux du jeu.
 */
export function pistesDeLaScene(pistes: readonly PisteServie[], scene: string | null): PisteServie[] {
  if (scene === null) return [...pistes];
  const exactes = pistes.filter((p) => p.scenes.includes(scene));
  return exactes.length > 0 ? exactes : pistes.filter((p) => p.scenes.length === 0);
}

/**
 * Le morceau suivant : un tirage pondéré (`poids`) parmi les morceaux **sauf le précédent**, donc jamais deux fois le même d'affilée. Un seul morceau : il revient.
 * `hasard` ∈ [0, 1[ (injecté). Liste vide : `null`.
 */
export function choisirSuivante(pistes: readonly PisteServie[], precedentId: string | null, hasard: () => number): PisteServie | null {
  if (pistes.length === 0) return null;
  const candidats = pistes.length > 1 ? pistes.filter((p) => p.id !== precedentId) : pistes;
  const total = candidats.reduce((s, p) => s + p.poids, 0);
  let r = Math.min(Math.max(hasard(), 0), 0.999999999) * total;
  for (const p of candidats) {
    r -= p.poids;
    if (r < 0) return p;
  }
  return candidats[candidats.length - 1]!;
}

/** Les deux courbes d'un fondu enchaîné à puissance constante (le niveau perçu ne creuse pas au milieu) : `entree` monte de 0 à 1, `sortie` descend de 1 à 0. */
export function courbeFondu(n = 32): { entree: Float32Array; sortie: Float32Array } {
  const entree = new Float32Array(n);
  const sortie = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    entree[i] = Math.sin((t * Math.PI) / 2);
    sortie[i] = Math.cos((t * Math.PI) / 2);
  }
  return { entree, sortie };
}

export interface EntreeNiveau {
  reglages: Reglages;
  /** Ce que le jeu demande (1 = pleine, 0,4 = plus basse en course…) ∈ [0, 1]. */
  baisse: number;
  /** Le jeu a coupé tout son (muet de Track, « Son : non » de Jump). */
  sourdine: boolean;
}

/** Le niveau du bus de la musique : le niveau de base × le volume du joueur (au carré : l'oreille suit une courbe, pas une droite) × la baisse du jeu ; 0 si coupée. */
export function niveauFinal(e: EntreeNiveau): number {
  if (e.reglages.coupee || e.sourdine) return 0;
  const v = Math.min(1, Math.max(0, e.reglages.volume));
  const b = Math.min(1, Math.max(0, e.baisse));
  return NIVEAU_DE_BASE * v * v * b;
}

/** Le gain d'un morceau pour sa correction en décibels. */
export function gainDeDb(db: number): number {
  return Math.pow(10, db / 20);
}

const unite = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : null);

/** Les réglages lus (JSON gardé sous `cdj:musique`) : ce qui est illisible retrouve sa valeur par défaut, jamais d'exception. */
export function lireReglages(brut: string | null | undefined): Reglages {
  const r = { ...REGLAGES_DEFAUT };
  if (!brut) return r;
  try {
    const o = JSON.parse(brut) as { volume?: unknown; coupee?: unknown };
    r.volume = unite(o.volume) ?? r.volume;
    if (typeof o.coupee === "boolean") r.coupee = o.coupee;
  } catch {
    /* illisible : les valeurs par défaut */
  }
  return r;
}

export function ecrireReglages(r: Reglages): string {
  return JSON.stringify({ v: 1, volume: Math.round(r.volume * 100) / 100, coupee: r.coupee });
}

/** Où le morceau en cours en était quand la page s'est fermée (gardé dans le stockage de l'onglet). */
export interface Reprise {
  id: string;
  /** Position en secondes. */
  t: number;
  /** Heure (ms) à laquelle elle a été notée. */
  at: number;
}

export function lireReprise(brut: string | null | undefined): Reprise | null {
  if (!brut) return null;
  try {
    const o = JSON.parse(brut) as Partial<Reprise>;
    if (typeof o.id === "string" && typeof o.t === "number" && Number.isFinite(o.t) && o.t >= 0 && typeof o.at === "number" && Number.isFinite(o.at)) return { id: o.id, t: o.t, at: o.at };
  } catch {
    /* illisible */
  }
  return null;
}

export function ecrireReprise(r: Reprise): string {
  return JSON.stringify({ id: r.id, t: Math.round(r.t * 10) / 10, at: Math.round(r.at) });
}

export interface Depart {
  piste: PisteServie;
  /** Position de départ en secondes (0 pour un morceau neuf). */
  depart: number;
  /** Vrai si on reprend le même morceau là où il était. */
  repris: boolean;
}

/**
 * Par où commencer sur cette page : **le même morceau, là où il en était**, si la reprise est récente et si le morceau passe dans ce jeu ; sinon un morceau
 * tiré au sort (jamais celui de la reprise : il vient d'être entendu), qui entre en fondu.
 */
export function departDeLaPage(pistes: readonly PisteServie[], reprise: Reprise | null, maintenant: number, hasard: () => number): Depart | null {
  if (pistes.length === 0) return null;
  if (reprise && maintenant - reprise.at >= 0 && maintenant - reprise.at <= VALIDITE_REPRISE_MS) {
    const p = pistes.find((x) => x.id === reprise.id);
    if (p && (p.duree <= 0 || reprise.t < p.duree - FONDU_S)) return { piste: p, depart: reprise.t, repris: true };
  }
  const piste = choisirSuivante(pistes, reprise && maintenant - reprise.at <= VALIDITE_REPRISE_MS ? reprise.id : null, hasard);
  return piste ? { piste, depart: 0, repris: false } : null;
}
