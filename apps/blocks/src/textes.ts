import { CATALOGUE_FR } from "./catalogue.fr";

// Les textes que la SCÈNE écrit elle-même (« +120 », « Combo ×3 », « Plus de place ! ») : le kit ne donne pas son traducteur à `nouvellePartie`, mais `brancherJeu` le rend à `main.ts`, qui le fournit ici.
// Sans traducteur (tests en Node, avant le chargement) : le français du catalogue. Aucune chaîne en dur : tout vient des catalogues `fr` + `en`.
export interface Traduction {
  readonly langue: string;
  t(cle: string, params?: Readonly<Record<string, string | number>>): string;
}
let courant: Traduction | null = null;
export const fournirTraduction = (t: Traduction): void => {
  courant = t;
};

const repli = (cle: string, params?: Readonly<Record<string, string | number>>): string =>
  ((CATALOGUE_FR as Readonly<Record<string, string>>)[cle] ?? cle).replace(/\{(\w+)\}/g, (tout, nom: string) => (params?.[nom] === undefined ? tout : String(params[nom])));

export const texte = (cle: string, params?: Readonly<Record<string, string | number>>): string => (courant ? courant.t(cle, params) : repli(cle, params));

/** Un score écrit pour un joueur : `4 582 pts` (le nombre au format de la langue : « 4 582 » ou « 4,582 »). */
export const ecrireScore = (n: number, langue: string = langueCourante()): string => texte("score.valeur", { n: formaterNombre(n, langue) });

/** La langue courante (`fr` sans traducteur) : pour écrire un nombre au format de la langue. */
export const langueCourante = (): string => courant?.langue ?? "fr";

/** Un nombre au format de la langue (« 4 582 » en français, « 4,582 » en anglais), avec une espace insécable : il ne se coupe jamais en bout de ligne. */
export const formaterNombre = (n: number, langue: string = langueCourante()): string => new Intl.NumberFormat(langue === "en" ? "en-US" : "fr-FR").format(n).replace(/[\u202f\u2009]/g, "\u00a0");

/** La part « combo ×7 » de la ligne à partager ; rien sans combo (un combo de 0 n'est pas à montrer). */
export const ecrireComboPartage = (combo: number): string | null => (combo > 0 ? texte("partage.combo", { n: combo }) : null);
