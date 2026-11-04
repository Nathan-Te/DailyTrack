import { parseDay } from "@cdj/core";
import type { ProjectionPortail } from "@cdj/core/fiche";
import { categorieLe, type CategorieJeu } from "@cdj/core/jeux";
import projection from "../../../config/jeux/projections/portail.json";

// Lots K1, K1b et K1c (plateforme) : **les jeux** (`config/jeux/<id>.json` : Track, Jump, Tower), lus à la construction dans la projection `portail` (`npm run fiches`) — le portail n'embarque que cette
// projection, sans requête de plus. Aucun jeu n'est plus nommé en dur dans les cartouches, les titres, les accroches, le classement du jour ni le partage : il n'y a plus de jeu sans fiche.

/** Une fiche telle que le portail la lit : la projection (qui n'écrit pas ce qui va de soi) avec ses valeurs par défaut rétablies. */
export type FichePortail = Required<Pick<ProjectionPortail["jeux"][number], "code" | "format">> & Omit<ProjectionPortail["jeux"][number], "code" | "format" | "cumul" | "categorie"> & { cumul: boolean; categorie: CategorieJeu };
export const FICHES: readonly FichePortail[] = (projection as ProjectionPortail).jeux.map((j) => ({ code: j.id, cumul: true, format: "temps" as const, categorie: "jour" as const, ...j }));

/** La fiche d'un jeu d'après son dossier sur le site (`track`, `jump`, `tower`), ou `undefined` (un dossier qui n'est pas un jeu). */
export const ficheDuJeu = (id: string): FichePortail | undefined => FICHES.find((f) => f.id === id);
/** La fiche d'un jeu d'après son code au registre du serveur (`cdj`, `jump`, `tower`), ou `undefined` (un jeu que le portail ne connaît pas). */
export const ficheDuRegistre = (code: string): FichePortail | undefined => FICHES.find((f) => f.code === code);
/** Le titre d'une cartouche d'un jeu à fiche : sa clé `titre` du catalogue si elle en a une, sinon son nom en capitales (la forme que Tower a toujours eue). */
export function titreDeCarte(fiche: FichePortail, t: { t: (cle: never) => string }, nom: string): string {
  return fiche.titre ? t.t(fiche.titre as never) : nom.toUpperCase();
}


/**
 * Lot A3 : la catégorie d'un jeu ce jour-là. Le serveur fait foi quand il a répondu (`serveur` : le jeu du jour tel qu'il le rend ; il n'écrit `categorie` que pour l'arcade) ; sans réponse, la fiche
 * (`categorieLe`, avec le premier jour de la catégorie).
 */
export function categorieDuJeu(code: string, jour: number, serveur?: { categorie?: CategorieJeu }): CategorieJeu {
  if (serveur) return serveur.categorie ?? "jour";
  const f = ficheDuJeu(code);
  return f ? categorieLe(f.categorie, f.categorieDepuis ? parseDay(f.categorieDepuis) : null, jour) : "jour";
}
