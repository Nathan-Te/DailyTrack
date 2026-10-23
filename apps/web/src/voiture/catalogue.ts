// Retouche 40b — le catalogue des voitures (contrat commun des lots 40b, 41 et 42) : `VOITURES`, une fiche par voiture. Les voitures sont
// **purement cosmétiques** : toutes ont la même simulation (mêmes `CarParams`, même boîte de collision, mêmes points de contact), le classement
// du jour reste équitable, golden et rediffusions ne bougent pas. Une seule fiche a `deblocage.type === "defaut"` : la civile, toujours là.
// Chaque modèle se charge à la demande (`charger()` : un `import()` de son plan) ; la civile est déjà dans le premier chargement (c'est elle
// qu'on montre tant que la voiture choisie n'est pas prête).
import type { PlanVoiture } from "./modele";
import { PLAN_CIVILE } from "./modeleCivile";

/**
 * Comment une voiture se débloque. `medailles` : un nombre de circuits du jour avec au moins cette médaille (`or` : or ou auteur) ; `jours` :
 * un nombre de jours joués. `abonnement` est réservé : aucune voiture ne l'utilise pour l'instant, et il ne s'affiche nulle part.
 */
export type Deblocage = { type: "defaut" } | { type: "medailles"; medaille: "or" | "auteur"; nombre: number } | { type: "jours"; nombre: number } | { type: "abonnement" };

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

// Seuils de déblocage : une proposition de la retouche 40b (le Garage du lot 41 les montre et les vérifie avec le serveur).
export const VOITURES: FicheVoiture[] = [
  { id: "civile", nom: "voiture.civile.nom", description: "voiture.civile.description", deblocage: { type: "defaut" }, charger: () => Promise.resolve(PLAN_CIVILE) },
  { id: "evolution", nom: "voiture.evolution.nom", description: "voiture.evolution.description", deblocage: { type: "jours", nombre: 7 }, charger: () => import("./modeleA").then((m) => m.PLAN_A) },
  { id: "gt", nom: "voiture.gt.nom", description: "voiture.gt.description", deblocage: { type: "medailles", medaille: "or", nombre: 5 }, charger: () => import("./modeleB").then((m) => m.PLAN_B) },
  { id: "proto", nom: "voiture.proto.nom", description: "voiture.proto.description", deblocage: { type: "medailles", medaille: "auteur", nombre: 3 }, charger: () => import("./modeleC").then((m) => m.PLAN_C) },
];

/** La fiche d'une voiture, ou `undefined`. */
export function ficheVoiture(id: string): FicheVoiture | undefined {
  return VOITURES.find((v) => v.id === id);
}
