import { PHYSIQUE_REGLEE_DEFAUT, type Reglages, REGLAGES_DEFAUT, type ReglagesPhysique } from "@cdj/tower-sim";
import { ENTREES_DEFAUT, type ReglagesEntrees } from "./entrees";
import { VOLUMES_DEFAUT, type VolumesFamilles } from "./sonsLogique";

// Les réglages de sensation de `?debug&tune` (lots T1 et T5), **la partie pure** (sans DOM, testée) : leurs valeurs de départ, leurs bornes, ce qui fait d'une partie une partie d'ESSAI, et le bloc
// JSON que Nathan copie pour le lot T5b. Deux groupes :
//   1. **Sensation et physique** — ce qui change une partie : les entrées (délai et cadence de répétition), la simulation (vitesse de chute, facteur de descente, hauteur d'apparition), la physique
//      et les effets (frottement, rebond, vent, glissante, tailles, seuils de contact) et la largeur de la plateforme. Toute partie jouée avec une valeur autre que celle du jour est une partie
//      d'ESSAI (« réglage d'essai ») : elle n'est jamais envoyée au classement (`peutClasser`, `envoi.ts`) et le serveur la refuserait (il rejoue aux réglages normaux).
//   2. **Rendu et son** — ce qui ne change que l'affichage : la panique des yeux, la secousse, les cris, le vent à l'écran, le volume de chaque famille de sons. Pas de version, pas d'essai.
// Rien n'est gardé dans le navigateur.

/** Le second groupe : ce qui ne touche que l'affichage et le son. */
export interface ReglagesRendu {
  /** Gain de la panique des yeux (1 normal, 0 : jamais affolés). */
  panique: number;
  /** Intensité de la secousse de caméra (1 normal, 0 : aucune). */
  secousse: number;
  /** Volume des cris de panique (0 : aucun cri). */
  cris: number;
  /** Inclinaison de la pièce active au vent, en degrés (0 : aucune). */
  inclinaisonVent: number;
  /** Nombre de traînées de vent visibles (0 à 12). */
  trainees: number;
  /** Volume de chaque famille de sons. */
  volumes: VolumesFamilles;
}
export const RENDU_DEFAUT: Readonly<ReglagesRendu> = { panique: 1, secousse: 1, cris: 0.5, inclinaisonVent: 4, trainees: 10, volumes: { ...VOLUMES_DEFAUT, cris: 0.5 } };

export interface ReglagesTune {
  entrees: ReglagesEntrees;
  sim: Reglages;
  physique: ReglagesPhysique;
  /** La largeur de la plateforme forcée (demi-largeur en huitièmes de mètre) ; `null` : celle du jour. Sans toucher au générateur. */
  plateformeDemi8: number | null;
  rendu: ReglagesRendu;
}

export function reglagesDeDepart(): ReglagesTune {
  return { entrees: { ...ENTREES_DEFAUT }, sim: { ...REGLAGES_DEFAUT }, physique: { ...PHYSIQUE_REGLEE_DEFAUT }, plateformeDemi8: null, rendu: { ...RENDU_DEFAUT, volumes: { ...RENDU_DEFAUT.volumes } } };
}

/** La partie jouée avec ces réglages est-elle une partie d'ESSAI ? Vrai dès qu'une valeur du groupe 1 diffère de la valeur normale (le groupe 2 n'y change rien). Jamais classée. */
export function reglagesEssai(r: ReglagesTune): boolean {
  const diff = <T extends object>(a: T, b: Readonly<T>): boolean => (Object.keys(b) as (keyof T)[]).some((k) => a[k] !== b[k]);
  return diff(r.entrees, ENTREES_DEFAUT) || diff(r.sim, REGLAGES_DEFAUT) || diff(r.physique, PHYSIQUE_REGLEE_DEFAUT) || r.plateformeDemi8 !== null;
}
