// **Les réglages de « Pile poil », dans un seul objet** : les valeurs `DEFAUT` de la maquette (unités : millièmes de jauge — la jauge fait `LONGUEUR` = 1 000 000 — et pas de 1/120 s), plus `attenteMax`.
// `?debug&tune` les change pour une partie d'essai (jamais classée) ; le serveur rejoue toujours avec `REGLAGES`. Changer une valeur ici change les parties rejouées : `PILEPOIL_SIM_VERSION` monte (et le golden).

export interface Reglages {
  /** Millièmes de jauge par pas, 1re jauge (≈ 2,2 jauges par seconde). */
  vitesseDebut: number;
  /** … 10e jauge. Chaque jauge ajoute 0 à 399 de hasard. */
  vitesseFin: number;
  /** Demi-largeur de la cible, 1re jauge. */
  demiCibleDebut: number;
  /** … 10e jauge. */
  demiCibleFin: number;
  /** Tolérance du « pile au centre ». */
  parfait: number;
  /** Bonus du premier « pile ». */
  bonusParfait: number;
  /** + par « pile » d'affilée. */
  bonusEnchaine: number;
  /** Pas d'arrêt entre deux jauges (0,55 s). */
  pauseResultat: number;
  /** La cible bouge à partir de la jauge n (1 à 10 ; 11 : jamais). */
  bougeDes: number;
  /** Amplitude du mouvement de la cible. */
  ampliBouge: number;
  /** Vitesse du mouvement, en millièmes de tour par pas. */
  vitesseBouge: number;
  /**
   * Lot PA2 (absent de la maquette, où le curseur va et vient sans fin) : sans appui pendant ce nombre de pas, la jauge est ratée et la suivante vient. Il faut une partie finie (le kit attend sa fin, le serveur
   * borne son rejeu). 15 s : plus d'un aller-retour à la vitesse la plus lente du réglage (≈ 7,6 s à `vitesseDebut`).
   */
  attenteMax: number;
}

export const REGLAGES: Readonly<Reglages> = Object.freeze({
  vitesseDebut: 2200,
  vitesseFin: 6200,
  demiCibleDebut: 120000,
  demiCibleFin: 38000,
  parfait: 9000,
  bonusParfait: 50,
  bonusEnchaine: 25,
  pauseResultat: 66,
  bougeDes: 8,
  ampliBouge: 160000,
  vitesseBouge: 30,
  attenteMax: 1800,
});

/** Les réglages, entiers et positifs, complétés par ceux du jeu : ce que `?debug&tune` peut donner. Une valeur absente ou illisible garde celle du jeu. */
export function reglagesDe(saisie: Readonly<Record<string, unknown>> | null | undefined): Reglages {
  const r: Reglages = { ...REGLAGES };
  if (!saisie) return r;
  for (const k of Object.keys(REGLAGES) as (keyof Reglages)[]) {
    const v = saisie[k];
    if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 10_000_000) r[k] = v;
  }
  if (r.pauseResultat < 1) r.pauseResultat = 1;
  if (r.attenteMax < 1) r.attenteMax = 1;
  return r;
}
