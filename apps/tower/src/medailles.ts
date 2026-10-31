import { type Medailles, NOMS_MEDAILLES, type NomMedaille } from "@cdj/tower-sim";
import type { TypeMedaille } from "@cdj/ui";

// Les médailles côté jeu (lot T3). Les seuils viennent du fichier du jour préparé (le bot de l'auteur, fiables), de l'estimation géométrique (en production sans fichier : PROVISOIRES) ou du
// calcul du bot dans un Web Worker (hors production sans fichier : « en calcul » d'abord). Dans les données le Diamant est la clé `auteur` ; l'interface l'affiche « Diamant » (lot A1).

export interface EtatMedailles {
  medailles: Medailles | null;
  /** Estimation géométrique, pas le bot : le jeu le dit. */
  provisoire: boolean;
  /** Le bot calcule dans son Web Worker : pas de seuils pour l'instant. */
  enCalcul: boolean;
}

export const SANS_MEDAILLES: EtatMedailles = { medailles: null, provisoire: false, enCalcul: false };

/** La clé de donnée d'une médaille vers le type du socle (`auteur` → « Diamant »). */
export const TYPE_MEDAILLE: Readonly<Record<NomMedaille, TypeMedaille>> = { auteur: "diamant", or: "or", argent: "argent", bronze: "bronze" };

/** Garde en MÉMOIRE la meilleure médaille de la session (rien n'est écrit dans le navigateur : cela viendra avec le profil, lot T4). */
export class MemoireMedaille {
  private meilleure: NomMedaille | null = null;
  proposer(nom: NomMedaille | null): void {
    if (nom !== null && (this.meilleure === null || NOMS_MEDAILLES.indexOf(nom) > NOMS_MEDAILLES.indexOf(this.meilleure))) this.meilleure = nom;
  }
  get(): NomMedaille | null {
    return this.meilleure;
  }
}
