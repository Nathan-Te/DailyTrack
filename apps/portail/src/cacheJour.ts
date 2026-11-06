import { readIdentityRevision, type KeyValueStore } from "@cdj/profile";
import { parseDay } from "@cdj/core";
import { estJour, type Jour } from "./jour";

// La dernière réponse de l'accueil (`GET /api/portail/jour`), gardée dans le navigateur pour que la page s'affiche **tout de suite** à la visite suivante
// (Tower, la série, le classement, les nouveautés) au lieu d'attendre l'aller-retour vers le serveur (mesuré : 0,4 s à 1 s de serveur pour un joueur connu, sa réponse n'étant pas
// partageable par un cache). **Le serveur reste la seule source de vérité** : la réponse fraîche remplace toujours ce qui a été montré. Pur : stockage et instants injectés.
//
// Ce que la copie ne montre jamais :
//   - un autre jour que celui d'aujourd'hui, ni après le prochain minuit de Paris (les niveaux du jour, le décompte et les états seraient faux) ;
//   - les données d'un autre joueur : la copie porte la révision d'identité de la plateforme (`cdj:identite:rev`) et n'est plus lue dès qu'elle a changé (code chargé, code changé),
//     ni celles d'un joueur quand le navigateur n'a plus d'identité ;
//   - un état qui a pu changer depuis (pas joué, en cours : le joueur a peut-être joué ailleurs ou dans l'onglet d'à côté) : seuls les jeux **finis** gardent leur état, un jeu fini le reste ;
//   - le message en direct : il vient de la réponse fraîche (un message retiré ne doit pas réapparaître).
// Clé de donnée de jeu (`cdj:`, hors `CLES_GARDEES`) : effacée au « Nouveau départ » ; nommée dans les deux pages de mentions légales.

export const CLE_CACHE_JOUR = "cdj:portail:jour";
const VERSION = 1;

type Stockage = Pick<KeyValueStore, "getItem" | "setItem"> & { removeItem?: (cle: string) => void };

interface Copie {
  v: number;
  /** La révision d'identité au moment de l'écriture. */
  rev: number;
  jour: Jour;
}

/**
 * Garde la réponse (sans le message en direct). **Seulement pour un navigateur qui a un profil** : la réponse d'un visiteur est publique, déjà gardée par le cache de Hosting, et un visiteur
 * n'a rien à qui on doive laisser une trace de plus. Ne lève jamais : un stockage refusé ou plein, c'est une page un peu moins rapide, rien d'autre.
 */
export function garderJour(stockage: Stockage | null, jour: Jour, aIdentite: boolean): void {
  if (!stockage || !aIdentite) return;
  try {
    const { annonce: _annonce, ...sans } = jour;
    const copie: Copie = { v: VERSION, rev: readIdentityRevision(stockage).rev, jour: sans };
    stockage.setItem(CLE_CACHE_JOUR, JSON.stringify(copie));
  } catch {
    /* rien n'est gardé */
  }
}

/**
 * La copie à montrer en attendant le serveur, ou `null`. `jourLocal` : le jour de Paris d'aujourd'hui (`parisDay`), `maintenant` : l'heure du téléphone en ms,
 * `aIdentite` : le navigateur a-t-il un profil ? Une copie illisible est retirée.
 */
export function jourGarde(stockage: Stockage | null, jourLocal: number, maintenant: number, aIdentite: boolean): Jour | null {
  if (!stockage) return null;
  try {
    const brut = stockage.getItem(CLE_CACHE_JOUR);
    if (brut === null) return null;
    const copie = JSON.parse(brut) as Partial<Copie> | null;
    if (!copie || copie.v !== VERSION || !estJour(copie.jour)) return oublier(stockage);
    const jour = copie.jour;
    if (copie.rev !== readIdentityRevision(stockage).rev) return oublier(stockage);
    // Le bon jour, et pas après minuit (l'heure du téléphone peut être décalée de quelques secondes : cette marge ne montre rien de faux, la réponse fraîche arrive juste après).
    if (parseDay(jour.date) !== jourLocal || !(Date.parse(jour.prochainJour) > maintenant)) return null;
    if (jour.joueur && !aIdentite) return oublier(stockage);
    if (!jour.joueur) return jour;
    // Lot U1 : de même, ce que les amis ont fait aujourd'hui a pu changer (leur classement, leurs jeux faits) : la copie ne le garde pas, la réponse fraîche l'apporte.
    const { classementAmis: _classement, amisDuJour: _amis, ...joueur } = jour.joueur;
    return { ...jour, joueur, jeux: jour.jeux.map(({ etat, ...jeu }) => (etat?.statut === "fini" ? { ...jeu, etat } : jeu)) };
  } catch {
    return null;
  }
}

function oublier(stockage: Stockage): null {
  try {
    stockage.removeItem?.(CLE_CACHE_JOUR);
  } catch {
    /* rien */
  }
  return null;
}
