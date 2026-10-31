import { MARGE_CONTACT, PHYSIQUE } from "./constantes";

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

export const PHYSIQUE_REGLEE_DEFAUT: Readonly<ReglagesPhysique> = {
  frottement: PHYSIQUE.frottement,
  rebond: PHYSIQUE.rebond,
  ventPeriodeTicks: 10,
  ventPas8: 1,
  frottementGlissant: 0.05,
  echellePetite4: 2,
  echelleGeante4: 8,
  margeContact: MARGE_CONTACT,
  distanceSoudure: 0.03,
};

/** Les réglages d'essai complets : les défauts, puis ce que `partiel` change. */
export function physiqueResolue(partiel: Partial<ReglagesPhysique> | undefined): ReglagesPhysique {
  return { ...PHYSIQUE_REGLEE_DEFAUT, ...(partiel ?? {}) };
}

/** Un seul de ces réglages diffère-t-il des défauts (c'est une partie d'essai) ? */
export function physiqueEstDEssai(p: Readonly<ReglagesPhysique>): boolean {
  return (Object.keys(PHYSIQUE_REGLEE_DEFAUT) as (keyof ReglagesPhysique)[]).some((k) => p[k] !== PHYSIQUE_REGLEE_DEFAUT[k]);
}

