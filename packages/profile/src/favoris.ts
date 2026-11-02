// Lot F1 de la plateforme — « Mes jeux » côté client : les jeux épinglés du profil commun. **Le serveur fait foi** (table `favoris_jeux`, `PUT /api/portail/favoris`, lue avec
// `GET /api/portail/jour`) : la liste suit le joueur sur tous ses appareils (code de transfert). Le stockage local (`cdj:favoris`) sert à deux choses seulement : la liste d'un
// **visiteur sans profil** (il n'existe sur le serveur qu'après sa première arrivée classée), reprise dans le profil dès que le serveur le connaît ; et l'accueil hors ligne.
// Règles pures (testées) ; le stockage et le réseau sont injectés (comme le reste du module). Les règles de la journée sur « mes jeux » sont côté serveur (`@cdj/core/favoris`) ;
// ce module n'importe aucun paquet, la forme d'un nom de jeu y est donc recopiée (testée contre celle de `@cdj/core`). L'écriture au serveur est dans `favorisReseau.ts`, **à la demande** (premier toucher d'une étoile : rien dans le premier chargement du portail).

/** Le stockage local : `{ jeux, attente }`. Une donnée de joueur (effacée au « Nouveau départ »), pas un réglage de l'appareil. */
export const FAVORIS_KEY = "cdj:favoris";
/** Au plus autant de favoris (le serveur refuse davantage). */
export const FAVORIS_MAX = 12;

const CODE_DE_JEU = /^[a-z0-9][a-z0-9-]{0,31}$/;

/** Ce que le navigateur garde : la liste, et si elle attend d'être reprise dans le profil (`attente` : choisie sans profil connu du serveur). */
export interface FavorisLocaux {
  jeux: string[];
  attente: boolean;
}

/** Une liste lue avec prudence (une donnée illisible ou abîmée : liste vide), sans doublon, d'au plus `FAVORIS_MAX` noms de jeux. */
export function listeLue(brut: unknown): string[] {
  if (!Array.isArray(brut)) return [];
  const vus = new Set<string>();
  for (const x of brut) if (typeof x === "string" && CODE_DE_JEU.test(x) && vus.size < FAVORIS_MAX) vus.add(x);
  return [...vus];
}

/** Lit les favoris du navigateur ; sans stockage, ou illisibles : aucun. Ne lève jamais. */
export function lireFavorisLocaux(storage: Pick<Storage, "getItem"> | null): FavorisLocaux {
  try {
    const brut = JSON.parse(storage?.getItem(FAVORIS_KEY) ?? "null") as { jeux?: unknown; attente?: unknown } | null;
    return { jeux: listeLue(brut?.jeux), attente: brut?.attente === true };
  } catch {
    return { jeux: [], attente: false };
  }
}

/** Écrit les favoris du navigateur (refusé par le navigateur : sans effet, rien ne casse). Une liste vide efface la clé. */
export function ecrireFavorisLocaux(storage: Pick<Storage, "setItem" | "removeItem"> | null, local: FavorisLocaux): void {
  try {
    if (local.jeux.length === 0) storage?.removeItem(FAVORIS_KEY);
    else storage?.setItem(FAVORIS_KEY, JSON.stringify({ jeux: listeLue(local.jeux), attente: local.attente }));
  } catch {
    /* stockage refusé : l'accueil garde la liste en mémoire pour cette visite */
  }
}

/** La liste après un toucher d'étoile : le jeu y entre s'il n'y est pas, en sort sinon. */
export const basculer = (liste: readonly string[], site: string): string[] => (liste.includes(site) ? liste.filter((j) => j !== site) : [...liste, site].slice(0, FAVORIS_MAX));

/**
 * La liste que l'accueil dessine : celle du serveur dès qu'il connaît le joueur (`null` : il n'a jamais rien choisi, ou est revenu au choix par défaut), sinon celle du navigateur
 * (visiteur, ou serveur injoignable).
 */
export function listeAffichee(serveur: readonly string[] | null | undefined, joueurConnu: boolean, local: FavorisLocaux): string[] {
  if (joueurConnu) return serveur ? [...serveur] : [];
  return [...local.jeux];
}

/**
 * Faut-il reprendre la liste du navigateur dans le profil ? Oui quand le serveur connaît le joueur, qu'il n'a rien de choisi (`null`) et que la liste du navigateur a été faite sans
 * profil (`attente`) : une liste d'un autre appareil, déjà confirmée, ne ressuscite jamais un choix défait ailleurs.
 */
export const aReprendre = (serveur: readonly string[] | null | undefined, local: FavorisLocaux): boolean => serveur === null && local.attente && local.jeux.length > 0;
