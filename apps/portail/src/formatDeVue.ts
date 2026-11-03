import { ficheDuJeu } from "./jeuxFiches";

// Lot K4d : un module à part de `jeuxFiches.ts` — `jeuxFiches` est dans le premier chargement du portail, ce format n'est lu que par les modules à la demande (classement, groupes) : ses octets n'y entrent pas.

/**
 * Lot K4d : le format d'un score dans la vue d'un jeu (`vue` = son dossier sur le site) : au temps, le temps ; sinon celui que dit **la fiche** du jeu (`hauteur` en mètres, `entier` pour des points) —
 * jamais des mètres pour un jeu qui ne mesure pas une hauteur.
 */
export function formatDeVue(vue: string, sens: "temps" | "hauteur"): "temps" | "hauteur" | "entier" {
  return sens === "temps" ? "temps" : ficheDuJeu(vue)?.format === "entier" ? "entier" : "hauteur";
}
