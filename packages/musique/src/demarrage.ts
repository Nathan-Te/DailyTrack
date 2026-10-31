import { creerLecteur, type Lecteur, type StockageMin } from "./lecteur";
import { depsNavigateur } from "./navigateur";
import type { JeuMusique } from "./types";

// Le point d'entrée **chargé à la demande** : `branche.ts` l'importe au premier geste, le panneau des réglages à son ouverture. Un seul lecteur par page.

let lecteur: Lecteur | null = null;

export interface Initial {
  baisse: number;
  sourdine: boolean;
  scene: string | null;
}

/** Crée le lecteur de la page (une seule fois) et lui donne ce que le jeu a déjà demandé. */
export function demarrer(jeu: JeuMusique, stockage: StockageMin | null, initial: Initial): Lecteur {
  lecteur ??= creerLecteur(depsNavigateur(jeu, stockage));
  lecteur.baisser(initial.baisse);
  lecteur.sourdine(initial.sourdine);
  lecteur.scene(initial.scene);
  return lecteur;
}

/** Le lecteur de la page, s'il a démarré. */
export function lecteurActuel(): Lecteur | null {
  return lecteur;
}
