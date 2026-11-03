import projection from "../../../config/jeux/projections/jeu.json";

// La fiche d'un jeu côté client (lot K3) : la projection `jeu` de `config/jeux/projections/jeu.json` (écrite par `npm run fiches`). **À la demande seulement** : ce module embarque les trois
// jeux, il n'est importé que par des morceaux chargés à la demande (l'interrupteur, la suite du jour…), jamais par un premier chargement.

export interface FicheClient {
  id: string;
  code: string;
  nom: { fr: string; en: string };
  prefixe: string;
  messageOu: string;
  etatDepart: string;
}

/** La fiche du jeu `id` ; `undefined` pour un jeu inconnu (le kit ne devine rien). */
export function ficheDeJeu(id: string): FicheClient | undefined {
  return (projection.jeux as FicheClient[]).find((j) => j.id === id);
}
