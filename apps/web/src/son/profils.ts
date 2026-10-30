// Lot 55 (partie B) — le caractère sonore de chaque voiture : un profil de moteur par voiture du Garage. Données pures, testées ; elles ne servent qu'au son
// (la simulation, les rediffusions et le classement n'en savent rien : toutes les voitures ont la même physique).
// Module à la demande, comme tout le nouveau son : jamais dans le premier chargement.
import type { IdVoiture } from "@cdj/sim";

/** Les vitesses (m/s) auxquelles chaque rapport atteint le régime de passage : six rapports, la voiture du jeu n'en a pas. Même étagement que le son d'avant (`GEAR_SPEEDS`). */
export const ETAGEMENT: readonly number[] = [11, 20, 29, 38, 48, 70];

export interface TimbreMoteur {
  /** Décroissance des harmoniques (amplitude 1/kᵖ) : petite = riche et agressif, grande = rond. */
  pente: number;
  /** Nombre d'harmoniques de l'onde (plafonné par le navigateur au-dessus de Nyquist). */
  harmoniques: number;
  /** ∈ [0, 1] : l'harmonique ½ (un cylindre qui allume un peu autrement) — le « lope » d'un gros moteur, le ralenti qui bat. */
  grondement: number;
  /** ∈ [0, 1] : désaccord entre deux voix du moteur et tremblement d'amplitude — un moteur fatigué, mal réglé. */
  rugosite: number;
  /** Niveau du souffle d'admission (bruit filtré qui suit le régime et la charge). */
  souffle: number;
  /** Coupure (Hz) du filtre passe-bas à plein gaz : au ralenti, au rouge. Lever le pied la ferme (le moteur s'étouffe). */
  coupure: readonly [number, number];
  /** ∈ [0, 1] : la saturation douce (le grain du moteur sous charge). */
  saturation: number;
}

export interface ProfilMoteur {
  id: IdVoiture;
  /** Cylindres (4 temps : l'allumage a lieu cylindres ÷ 2 fois par tour). */
  cylindres: number;
  /** Régime (tr/min) au ralenti et au rouge. */
  ralenti: number;
  rouge: number;
  /** Fraction du rouge où l'on monte un rapport, et où on le rétrograde. */
  monte: number;
  descend: number;
  timbre: TimbreMoteur;
  /** Pétarade au lever de pied à haut régime. */
  petards: boolean;
  /** Niveau relatif du moteur de cette voiture dans le mélange ∈ [0, 1] (un V8 de muscle car couvre plus que le quatre-cylindres d'une compacte). */
  niveau: number;
  /**
   * Étalonnage de chaque approche : le facteur qui met le niveau efficace de l'accélération à fond au même endroit pour les trois (≈ 0,24 × `niveau`), mesuré par
   * `rendreHorsLigne` sur la planche (une comparaison à l'oreille ne vaut rien si l'une des approches est plus forte). À refaire si un timbre change.
   */
  etalon: { synthese: number; echantillons: number; enregistre: number };
}

/**
 * Les quatre profils de la planche (la planche écoute des types de moteur très différents ; les six autres suivent au choix de l'approche, voir le README du lot 55).
 * Sparrow : petit quatre-cylindres de compacte. Boar : V8 de muscle car. Sailfish : monoplace, haut régime et criarde. Pelican : vieux moteur fatigué de fourgonnette.
 */
export const PROFILS: Partial<Record<IdVoiture, ProfilMoteur>> = {
  civile: {
    id: "civile",
    cylindres: 4,
    ralenti: 900,
    rouge: 6800,
    monte: 0.92,
    descend: 0.42,
    timbre: { pente: 1.35, harmoniques: 18, grondement: 0.12, rugosite: 0.1, souffle: 0.5, coupure: [900, 4200], saturation: 0.35 },
    petards: false,
    niveau: 0.9,
    etalon: { synthese: 0.67, echantillons: 1.9, enregistre: 0.9 },
  },
  muscle: {
    id: "muscle",
    cylindres: 8,
    ralenti: 700,
    rouge: 5600,
    monte: 0.9,
    descend: 0.38,
    timbre: { pente: 1.05, harmoniques: 22, grondement: 0.55, rugosite: 0.3, souffle: 0.45, coupure: [650, 3000], saturation: 0.6 },
    petards: true,
    niveau: 1,
    etalon: { synthese: 0.5, echantillons: 1.8, enregistre: 0.85 },
  },
  monoplace: {
    id: "monoplace",
    cylindres: 8,
    ralenti: 4200,
    rouge: 12400,
    monte: 0.94,
    descend: 0.5,
    timbre: { pente: 0.8, harmoniques: 26, grondement: 0.05, rugosite: 0.04, souffle: 0.35, coupure: [2400, 9000], saturation: 0.25 },
    petards: false,
    niveau: 0.8,
    etalon: { synthese: 1.27, echantillons: 2.2, enregistre: 1.0 },
  },
  fourgon: {
    id: "fourgon",
    cylindres: 4,
    ralenti: 780,
    rouge: 4900,
    monte: 0.9,
    descend: 0.4,
    timbre: { pente: 1.7, harmoniques: 12, grondement: 0.35, rugosite: 0.65, souffle: 0.7, coupure: [520, 2300], saturation: 0.45 },
    petards: true,
    niveau: 0.95,
    etalon: { synthese: 0.55, echantillons: 1.7, enregistre: 0.9 },
  },
};

/** Les profils que la planche propose, dans l'ordre. */
export const PROFILS_PLANCHE: readonly IdVoiture[] = ["civile", "muscle", "monoplace", "fourgon"];

/** Fréquence d'allumage (Hz) : le fondamental du son d'un moteur à 4 temps. */
export function frequenceAllumage(rpm: number, cylindres: number): number {
  return ((rpm < 0 ? 0 : rpm) / 60) * (cylindres / 2);
}

export function profilDe(id: IdVoiture): ProfilMoteur {
  return PROFILS[id] ?? PROFILS.civile!;
}
