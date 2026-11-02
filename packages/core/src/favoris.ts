// Lot F1 (plateforme) — « Mes jeux » : les règles pures des jeux épinglés, communes au serveur (journée, série, partage) et au portail. Aucune lecture du
// temps ni du réseau : tout vient des paramètres (testé, à dates fixes : `test/favoris.test.ts`).
//
// **La règle de la journée** : la journée parfaite, « n fini sur m », la série et la ligne de partage portent sur **mes jeux** (les jeux épinglés), ou sur tous les
// jeux de la journée quand le joueur n'en a épinglé aucun. **Un changement de favoris compte à partir du lendemain** (comme `live_from` du lot P) : l'ensemble d'une
// journée est celui qui était en vigueur à son début — personne ne retire un jeu à 23 h 59 pour obtenir une journée parfaite. Exception : un joueur dont le profil a été créé
// aujourd'hui n'a pas de début de journée à protéger (c'est sa première visite) : son premier choix compte tout de suite.
// Le serveur garde un **historique** (une période `[du, liste]` par changement) pour que la série à cheval sur un changement donne le même résultat qu'avant : chaque jour est jugé
// avec la liste qui était la sienne.

/** Au plus autant de favoris (largement plus que les jeux du registre) : une liste plus longue est refusée. */
export const FAVORIS_MAX = 12;
/** Combien de jours la pastille « Nouveau » reste sur un jeu qui vient d'être ouvert (le jour de son ouverture compris). */
export const NOUVEAU_JOURS = 7;

/** Une période : à partir de ce jour de Paris (numéro de jour), cette liste de jeux (leur dossier sur le site : `track`, `jump`…) est celle du joueur. */
export type PeriodeFavoris = readonly [du: number, jeux: readonly string[]];

const CODE_DE_JEU = /^[a-z0-9][a-z0-9-]{0,31}$/;

/**
 * La liste envoyée par un client, lue strictement : un tableau de noms de jeux (dossiers du site), sans doublon, d'au plus `FAVORIS_MAX` entrées. `null` : refusée.
 * L'ordre n'est pas un choix du joueur (l'ordre manuel est hors périmètre) : la liste rendue suit l'ordre de la plateforme, c'est l'affaire de l'appelant.
 */
export function listeDeFavoris(brut: unknown): string[] | null {
  if (!Array.isArray(brut) || brut.length > FAVORIS_MAX) return null;
  const vus = new Set<string>();
  for (const x of brut) {
    if (typeof x !== "string" || !CODE_DE_JEU.test(x)) return null;
    vus.add(x);
  }
  return [...vus];
}

/** Les jeux d'une ligne de la base (JSON) ; illisible : liste vide (une ligne abîmée ne bloque personne). */
export function jeuxDeLaBase(texte: string | null | undefined): string[] {
  try {
    return listeDeFavoris(JSON.parse(texte ?? "[]")) ?? [];
  } catch {
    return [];
  }
}

/**
 * La liste en vigueur ce jour-là : celle de la dernière période qui a commencé (`du <= jour`), ou `null` si aucune (le joueur n'avait rien choisi : tous les jeux).
 * `periodes` est triée par `du` croissant.
 */
export function favorisLe(periodes: readonly PeriodeFavoris[], jour: number): readonly string[] | null {
  let trouvee: readonly string[] | null = null;
  for (const [du, jeux] of periodes) {
    if (du > jour) break;
    trouvee = jeux;
  }
  return trouvee;
}

/**
 * Les jeux de la journée d'un joueur : parmi les jeux qui comptent ce jour-là (`comptent`, leur dossier), ses favoris ; **si aucun ne compte** (aucun favori, ou des favoris
 * tous éteints ou pas encore comptés), tous les jeux qui comptent. L'ordre est celui de `comptent` (l'ordre de la plateforme).
 */
export function mesJeuxDuJour(comptent: readonly string[], favoris: readonly string[] | null): string[] {
  if (!favoris) return [...comptent];
  const choisis = comptent.filter((j) => favoris.includes(j));
  return choisis.length > 0 ? choisis : [...comptent];
}

/**
 * Le premier jour où un changement de favoris compte : **demain** (`aujourdhui + 1`), sauf pour un joueur dont le profil est créé aujourd'hui (`premiereVisite`) : son choix
 * compte tout de suite (aujourd'hui).
 */
export const jourDEffet = (aujourdhui: number, premiereVisite: boolean): number => (premiereVisite ? aujourdhui : aujourdhui + 1);

/**
 * La liste enregistrée après un choix : ce que le joueur a demandé pour les jeux qu'il peut épingler (`epinglables` : ceux qui sont ouverts), plus — inchangés — ses favoris
 * actuels qui ne le sont pas (un jeu éteint disparaît de l'accueil sans que son étoile soit perdue : il revient avec lui). Les jeux demandés qui ne sont pas épinglables sont écartés.
 */
export function listeApresChoix(demandes: readonly string[], actuels: readonly string[], epinglables: ReadonlySet<string>): string[] {
  const gardes = actuels.filter((j) => !epinglables.has(j));
  return [...demandes.filter((j) => epinglables.has(j)), ...gardes];
}

/**
 * La pastille « Nouveau » : un jeu ouvert depuis moins de `NOUVEAU_JOURS` jours. `debutPeriode` est le premier jour où le jeu compte dans la journée (`live_from`, le lendemain de son
 * ouverture : `null` ou 0 pour les jeux d'avant l'interrupteur, jamais nouveaux). L'ouverture est donc la veille de ce jour.
 */
export function estNouveau(debutPeriode: number | null, aujourdhui: number): boolean {
  if (debutPeriode === null || debutPeriode <= 0) return false;
  const ouverture = debutPeriode - 1;
  return aujourdhui >= ouverture && aujourdhui - ouverture < NOUVEAU_JOURS;
}
