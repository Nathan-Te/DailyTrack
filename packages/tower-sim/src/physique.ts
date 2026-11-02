import { MARGE_CONTACT, PHYSIQUE, TOWER_SIM_VERSION, VENT_PAS8_V5, VENT_PERIODE_TICKS, VENT_PERIODE_TICKS_V5 } from "./constantes";

// Lot T5 — hors de `constantes.ts` pour que le premier chargement (l'accueil lit `constantes`) ne porte pas ces réglages d'essai.
/**
 * Les réglages de physique et d'effets que les curseurs de `?debug&tune` peuvent essayer (lot T5). **Ce ne sont PAS des `Reglages` de rediffusion** : ils n'entrent ni dans l'en-tête d'une
 * rediffusion, ni dans l'empreinte, ni dans une version. Une partie qui en change un (`Partie.physiqueDEssai`) est une partie d'ESSAI : le jeu ne l'envoie jamais au classement et
 * le serveur la refuserait (il rejoue avec `PHYSIQUE_REGLEE_DEFAUT`). Tous les défauts sont les constantes ci-dessus : sans option, la partie est exactement celle d'avant le lot T5
 * (golden, rediffusions de référence et fichiers de jours inchangés). Les valeurs qui entrent dans Rapier restent des multiples du huitième de mètre (`ventPas8`) ou des flottants
 * simples d'un réglage d'essai (frottement, rebond, marges).
 */
export interface ReglagesPhysique {
  /** Frottement des pièces et de la plateforme (0,6). */
  frottement: number;
  /** Rebond des pièces et de la plateforme (0). */
  rebond: number;
  /** Ticks entre deux poussées du coup de vent (10). */
  ventPeriodeTicks: number;
  /** Force du coup de vent : huitièmes de mètre par poussée (1 = 12,5 cm, soit 0,75 m/s avec la période de 10). */
  ventPas8: number;
  /** Frottement de la pièce glissante (0,05). */
  frottementGlissant: number;
  /** Taille de la petite pièce, en quarts de la taille normale (2 = la moitié). */
  echellePetite4: number;
  /** Taille de la pièce géante, en quarts de la taille normale (8 = le double). */
  echelleGeante4: number;
  /** Seuil de contact du lâcher, en mètres (0,03). */
  margeContact: number;
  /** Seuil de contact du lierre et de la pièce figée, en mètres (0,03). */
  distanceSoudure: number;
}

/** Les réglages de la simulation 3 et 4 : le coup de vent pousse d'un huitième tous les 10 ticks. */
export const PHYSIQUE_REGLEE_V4: Readonly<ReglagesPhysique> = {
  frottement: PHYSIQUE.frottement,
  rebond: PHYSIQUE.rebond,
  ventPeriodeTicks: VENT_PERIODE_TICKS,
  ventPas8: 1,
  frottementGlissant: 0.05,
  echellePetite4: 2,
  echelleGeante4: 8,
  margeContact: MARGE_CONTACT,
  distanceSoudure: 0.03,
};

/** Lot T8 — les réglages de la simulation 5 (ceux d'une partie nouvelle) : le coup de vent pousse d'une demi-case tous les 40 ticks (la même dérive moyenne, la pièce reste sur la grille). */
export const PHYSIQUE_REGLEE_DEFAUT: Readonly<ReglagesPhysique> = { ...PHYSIQUE_REGLEE_V4, ventPeriodeTicks: VENT_PERIODE_TICKS_V5, ventPas8: VENT_PAS8_V5 };

/** Les défauts de la simulation `version`. */
export const physiqueDeLaVersion = (version: number): Readonly<ReglagesPhysique> => (version >= 5 ? PHYSIQUE_REGLEE_DEFAUT : PHYSIQUE_REGLEE_V4);

/** Les réglages d'essai complets : les défauts de la version (la courante par défaut), puis ce que `partiel` change. */
export function physiqueResolue(partiel: Partial<ReglagesPhysique> | undefined, version: number = TOWER_SIM_VERSION): ReglagesPhysique {
  return { ...physiqueDeLaVersion(version), ...(partiel ?? {}) };
}

/** Un seul de ces réglages diffère-t-il des défauts de la version (c'est une partie d'essai) ? */
export function physiqueEstDEssai(p: Readonly<ReglagesPhysique>, version: number = TOWER_SIM_VERSION): boolean {
  const d = physiqueDeLaVersion(version);
  return (Object.keys(d) as (keyof ReglagesPhysique)[]).some((k) => p[k] !== d[k]);
}
