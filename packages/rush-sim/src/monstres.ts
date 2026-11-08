import { RAYON_CHAUVE, RAYON_CHAMAN, RAYON_CRACHEUR, RAYON_GELEE, RAYON_PORTE_BOUCLIER, RAYON_TOTEM, cm } from "./constantes";

// Les TYPES de monstres de Rush, partagés par le générateur du niveau et par la partie (lot BR6). L'ordre ne change jamais sans monter `RUSH_SIM_VERSION` : le niveau et la rediffusion en dépendent.
// **Aucun monstre ne blesse au contact (lot BR6)** : chacun ne blesse que par une attaque ANNONCÉE (le bond d'une gelée ou d'un gélaton, le plongeon d'une chauve-souris, le projectile d'un cracheur, le coup de bouclier d'un
// porte-bouclier). Le chaman ne blesse pas du tout (il protège) et le totem invoque.
export const GELEE = 0;
export const CHAUVE = 1;
/** Lot BR5 : le gélaton — une petite gelée en meute (6 à 12), un coup chacun. */
export const GELATON = 2;
/** Lot BR6 : le CRACHEUR (distance : il garde ses distances et crache un projectile annoncé par une ligne au sol), le CHAMAN (soutien : un bouclier sur les alliés proches, il fuit), le TOTEM (invocateur : trois gélatons toutes les ~6 s)
 * et le PORTE-BOUCLIER (tank : il bloque les coups de face). */
export const CRACHEUR = 3;
export const CHAMAN = 4;
export const TOTEM = 5;
export const PORTE_BOUCLIER = 6;
export const NB_TYPES = 7;

export const MONSTRES_IDS = ["gelee", "chauve-souris", "gelaton", "cracheur", "chaman", "totem", "porte-bouclier"] as const;
export type MonstreId = (typeof MONSTRES_IDS)[number];
/** L'indice d'un monstre d'après son identifiant d'adresse (`&ennemis=cracheur,chaman`), ou −1. Les alias courts (`gelee`, `chauve`) passent aussi. */
export function indiceMonstre(id: string): number {
  const k = MONSTRES_IDS.indexOf(id as MonstreId);
  if (k >= 0) return k;
  return id === "chauve" ? CHAUVE : id === "bouclier" ? PORTE_BOUCLIER : -1;
}

/** Le rayon de collision (unités) de chaque type, un élite l'a × `eliteTaille` %. */
export const RAYON_TYPE: readonly number[] = [RAYON_GELEE, RAYON_CHAUVE, cm(30), RAYON_CRACHEUR, RAYON_CHAMAN, RAYON_TOTEM, RAYON_PORTE_BOUCLIER];
/** Les points de vie (dixièmes : un coup ordinaire en ôte 16, le coup final 40) : la gelée 30, la chauve-souris 10, le gélaton 10, le cracheur 20 (fragile), le chaman 30, le totem 90, le porte-bouclier 70. */
export const VIE_TYPE: readonly number[] = [30, 10, 10, 20, 30, 90, 70];
/** Le rayon d'alerte (cm) d'un monstre isolé de chaque type (un groupe a le sien, 10 à 12 m). */
export const ALERTE_TYPE_CM: readonly number[] = [700, 1000, 700, 1100, 800, 1200, 800];

// --- La courbe de difficulté le long du niveau (lot BR6). `prog` : l'avancée sur le chemin principal, de 0 (le départ) à 100 (l'arène). Au début : gelées, gélatons et chauves-souris ; au milieu s'ajoutent les cracheurs et les chamans ; à la fin, les
// porte-boucliers et les totems. Les élites arrivent à partir du milieu. ---
export const PROG_SOUTIEN = 35;
export const PROG_TANK = 65;
export const PROG_ELITE = 45;
/** Les poids de tirage d'un monstre de camp à l'avancée `prog` (même ordre que les types). */
export function poidsAuProgres(prog: number, totem: boolean): readonly number[] {
  if (prog < PROG_SOUTIEN) return [33, 22, 45, 0, 0, 0, 0];
  if (prog < PROG_TANK) return [22, 14, 30, 20, 8, 0, 0];
  return [16, 10, 24, 18, 8, totem ? 6 : 0, 16];
}
/** Les plafonds par camp ou par vague : au plus ce nombre de chaque type (le chaman protège, mais deux suffisent ; le totem est unique). */
export const PLAFOND_TYPE: readonly number[] = [99, 99, 99, 4, 2, 1, 3];
/** Les poids d'un monstre ÉPARS (seul sur le chemin) : ni gélaton, ni chaman, ni totem. */
export function poidsEpars(prog: number): readonly number[] {
  if (prog < PROG_SOUTIEN) return [70, 30, 0, 0, 0, 0, 0];
  if (prog < PROG_TANK) return [45, 20, 0, 35, 0, 0, 0];
  return [30, 15, 0, 30, 0, 0, 25];
}
