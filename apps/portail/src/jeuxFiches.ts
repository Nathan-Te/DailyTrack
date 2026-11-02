import type { ProjectionPortail } from "@cdj/core/fiche";
import projection from "../../../config/jeux/projections/portail.json";

// Lot K1 (plateforme) : **les jeux qui ont une fiche** (`config/jeux/<id>.json`), lus à la construction dans la projection `portail` (`npm run fiches`) — le portail n'embarque que cette projection, sans
// requête de plus. Un jeu qui en a une n'est plus nommé en dur dans les cartouches, les titres, les accroches, le classement du jour ni le partage ; Track et Jump (sans fiche jusqu'aux lots K1b et K1c)
// gardent leur code d'aujourd'hui, dans chaque consommateur : « lit la fiche d'un jeu qui en a une, sinon garde son code ».

export type FichePortail = ProjectionPortail["jeux"][number];
export const FICHES: readonly FichePortail[] = (projection as ProjectionPortail).jeux;

/** La fiche d'un jeu d'après son dossier sur le site (`tower`), ou `undefined` (Track et Jump : leur code d'avant). */
export const ficheDuJeu = (id: string): FichePortail | undefined => FICHES.find((f) => f.id === id);
/** La fiche d'un jeu d'après son code au registre du serveur (`cdj`, `jump`, `tower`), ou `undefined`. */
export const ficheDuRegistre = (code: string): FichePortail | undefined => FICHES.find((f) => f.code === code);
/** Le titre d'une cartouche d'un jeu à fiche : sa clé `titre` du catalogue si elle en a une, sinon son nom en capitales (la forme que Tower a toujours eue). */
export function titreDeCarte(fiche: FichePortail, t: { t: (cle: never) => string }, nom: string): string {
  return fiche.titre ? t.t(fiche.titre as never) : nom.toUpperCase();
}

