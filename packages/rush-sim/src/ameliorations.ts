import { mixSeed, Rng } from "@cdj/core";
import { NB_CARTES } from "./constantes";

// Le catalogue des améliorations de Rush (lot BR2) : à chaque niveau gagné, le monde se fige et le joueur choisit UNE carte parmi trois. Ce fichier ne porte que l'IDENTITÉ des cartes (leur ordre, leur famille, leur nombre de paliers) et
// le TIRAGE ; leur FORCE est dans les réglages (`reglagesSim.ts`, un entier par effet, tous des curseurs de `?debug&tune`) et leur effet dans `partie.ts`. **L'ordre de la liste ne change jamais sans monter `RUSH_SIM_VERSION`** (le tirage et la
// rediffusion — l'index de la carte — en dépendent).

export type Famille = "coup" | "mouvement" | "survie" | "special";
export interface Amelioration {
  id: string;
  famille: Famille;
  /** Le nombre de fois qu'on peut la prendre (« une seule fois » : 1). `Infinity` : le soin, qui peut revenir. */
  max: number;
  /** Le premier niveau gagné où elle peut être proposée : les cartes RARES (les plus fortes) ne viennent qu'à partir d'un certain niveau, donc seulement à qui a fait des détours. */
  nvMin: number;
}

export const AMELIORATIONS: readonly Amelioration[] = [
  { id: "lame-lourde", famille: "coup", max: 3, nvMin: 1 },
  { id: "allonge", famille: "coup", max: 3, nvMin: 1 },
  { id: "cadence", famille: "coup", max: 3, nvMin: 1 },
  { id: "tourbillon", famille: "coup", max: 1, nvMin: 4 },
  { id: "onde-epee", famille: "coup", max: 1, nvMin: 6 },
  { id: "bottes-legeres", famille: "mouvement", max: 3, nvMin: 1 },
  { id: "esquive-longue", famille: "mouvement", max: 3, nvMin: 1 },
  { id: "esquive-vive", famille: "mouvement", max: 3, nvMin: 1 },
  { id: "esquive-tranchante", famille: "mouvement", max: 1, nvMin: 6 },
  { id: "coeur-en-plus", famille: "survie", max: 3, nvMin: 3 },
  { id: "soin", famille: "survie", max: Infinity, nvMin: 1 },
  { id: "vol-de-vie", famille: "survie", max: 1, nvMin: 5 },
  { id: "brise-pierre", famille: "special", max: 3, nvMin: 5 },
  { id: "aimant", famille: "special", max: 3, nvMin: 2 },
];
export const NB_AMELIORATIONS = AMELIORATIONS.length;
/** L'indice d'une amélioration dans le catalogue, ou −1. */
export const indiceAmelioration = (id: string): number => AMELIORATIONS.findIndex((a) => a.id === id);

/** Les indices (dans l'ordre) de la liste d'identifiants d'une adresse (`&ameliorations=tourbillon,lame-lourde`) ; un identifiant inconnu est ignoré. */
export function ameliorationsDe(ids: readonly string[]): string[] {
  return ids.filter((id) => indiceAmelioration(id) >= 0);
}

const SEL_CARTES = 0xca4d5;

/**
 * Les trois cartes du niveau `nv` : un MÉLANGE du catalogue tiré de la graine du jour et du numéro du niveau (donc le même pour tous les joueurs), dont on garde les trois premières qui ne sont pas au maximum de leurs paliers
 * (`paliers[i]` : combien de fois la carte `i` a été prise). Un joueur qui n'a rien pris au maximum voit exactement le tirage de tout le monde. Pas de relance.
 */
export function tirageDeCartes(graine: number, nv: number, paliers: ArrayLike<number>): number[] {
  const ordre = new Rng(mixSeed(mixSeed(graine, SEL_CARTES), nv)).shuffle(Array.from({ length: NB_AMELIORATIONS }, (_, i) => i));
  return ordre.filter((i) => (paliers[i] ?? 0) < AMELIORATIONS[i]!.max && nv >= AMELIORATIONS[i]!.nvMin).slice(0, NB_CARTES);
}
