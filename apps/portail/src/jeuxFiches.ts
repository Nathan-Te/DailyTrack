import type { ProjectionPortail } from "@cdj/core/fiche";
import projection from "../../../config/jeux/projections/portail.json";

// Lots K1 et K1b (plateforme) : **les jeux qui ont une fiche** (`config/jeux/<id>.json` : Jump, Tower), lus à la construction dans la projection `portail` (`npm run fiches`) — le portail n'embarque que cette
// projection, sans requête de plus. Un jeu qui en a une n'est plus nommé en dur dans les cartouches, les titres, les accroches, le classement du jour ni le partage ; Track (sans fiche jusqu'au lot K1c)
// garde son code d'aujourd'hui, dans chaque consommateur : « lit la fiche d'un jeu qui en a une, sinon garde son code ».

/** Une fiche telle que le portail la lit : la projection (qui n'écrit pas ce qui va de soi) avec ses valeurs par défaut rétablies. */
export type FichePortail = Required<Pick<ProjectionPortail["jeux"][number], "code" | "format">> & Omit<ProjectionPortail["jeux"][number], "code" | "format" | "cumul"> & { cumul: boolean };
export const FICHES: readonly FichePortail[] = (projection as ProjectionPortail).jeux.map((j) => ({ code: j.id, cumul: true, format: "temps" as const, ...j }));

/** La fiche d'un jeu d'après son dossier sur le site (`jump`, `tower`), ou `undefined` (Track : son code d'avant). */
export const ficheDuJeu = (id: string): FichePortail | undefined => FICHES.find((f) => f.id === id);
/** La fiche d'un jeu d'après son code au registre du serveur (`cdj`, `jump`, `tower`), ou `undefined` (Track). */
export const ficheDuRegistre = (code: string): FichePortail | undefined => FICHES.find((f) => f.code === code);
/** Le titre d'une cartouche d'un jeu à fiche : sa clé `titre` du catalogue si elle en a une, sinon son nom en capitales (la forme que Tower a toujours eue). */
export function titreDeCarte(fiche: FichePortail, t: { t: (cle: never) => string }, nom: string): string {
  return fiche.titre ? t.t(fiche.titre as never) : nom.toUpperCase();
}

