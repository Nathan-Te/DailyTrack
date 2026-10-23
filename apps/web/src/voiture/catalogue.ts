// Retouche 40b — le catalogue des voitures (contrat commun des lots 40b, 41 et 42) : `VOITURES`, une fiche par voiture. Les voitures sont
// **purement cosmétiques** : toutes ont la même simulation (mêmes `CarParams`, même boîte de collision, mêmes points de contact), le classement
// du jour reste équitable, golden et rediffusions ne bougent pas. Une seule fiche a `deblocage.type === "defaut"` : la civile, toujours là.
// Chaque modèle se charge à la demande (`charger()` : un `import()` de son plan) ; la civile est déjà dans le premier chargement (c'est elle
// qu'on montre tant que la voiture choisie n'est pas prête).
import { DEBLOCAGES, type Deblocage } from "@cdj/sim";
import type { PlanVoiture } from "./modele";
import { PLAN_CIVILE } from "./modeleCivile";

// Lot 41 : comment une voiture se débloque vient de la table des règles du Garage (`DEBLOCAGES`, packages/sim/src/garage.ts), la même que celle du
// serveur : `medailles` (un nombre de circuits du jour avec au moins cette médaille ; `or` : l'or ou l'auteur), `jours` (jours joués),
// `abonnement` (réservé : aucune voiture, jamais affiché).
export type { Deblocage };

export interface FicheVoiture {
  id: string;
  /** Clés de catalogue (fr + en) : `voiture.<id>.nom`, `voiture.<id>.description`. */
  nom: string;
  description: string;
  deblocage: Deblocage;
  /** Le plan du modèle, chargé à la demande. */
  charger(): Promise<PlanVoiture>;
}

/** La voiture par défaut, et celle sur laquelle tout retombe (choix illisible, voiture non débloquée). */
export const VOITURE_DEFAUT = "civile";

// Les déblocages : la table du Garage (lot 41, décision de Nathan du 23/10/2026), une ligne par voiture dans packages/sim/src/garage.ts.
export const VOITURES: FicheVoiture[] = [
  { id: "civile", nom: "voiture.civile.nom", description: "voiture.civile.description", deblocage: DEBLOCAGES.civile, charger: () => Promise.resolve(PLAN_CIVILE) },
  { id: "evolution", nom: "voiture.evolution.nom", description: "voiture.evolution.description", deblocage: DEBLOCAGES.evolution, charger: () => import("./modeleA").then((m) => m.PLAN_A) },
  { id: "gt", nom: "voiture.gt.nom", description: "voiture.gt.description", deblocage: DEBLOCAGES.gt, charger: () => import("./modeleB").then((m) => m.PLAN_B) },
  { id: "proto", nom: "voiture.proto.nom", description: "voiture.proto.description", deblocage: DEBLOCAGES.proto, charger: () => import("./modeleC").then((m) => m.PLAN_C) },
];

/** La fiche d'une voiture, ou `undefined`. */
export function ficheVoiture(id: string): FicheVoiture | undefined {
  return VOITURES.find((v) => v.id === id);
}
