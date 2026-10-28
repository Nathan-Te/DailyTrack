import type { KeyValue } from "./memory";
import { storageKey } from "./storage";

// Le choix du fantôme de Jump (lot G1 de la plateforme, charte rév. 12 : le fantôme reste en vue en partie), **logique seule** (testée sous Node).
//
//   - **Un seul choix à la fois**, qui tourne : « le tien » → « le premier » → « le Diamant » → « aucun » → « le tien »… (touche G, bouton de la partie, entrée de
//     la pause, ligne de l'accueil : une seule fonction, `nextChoice`). On **saute** un choix indisponible : pas de premier lu (ou c'est toi), Diamant verrouillé
//     (niveau du jour pas fini) ou pas chargé. « Le tien » et « aucun » existent toujours.
//   - **« Le tien »** est le comportement d'avant le lot : ton fantôme (ton meilleur essai du jour), avec celui du premier à côté si le réglage « Fantôme du
//     premier » est à oui. « Le premier » montre le premier seul (sans regarder ce réglage), « le Diamant » la trajectoire de l'auteur seule.
//   - **Mémorisé** sous la clé qui existait déjà, `jump:fantome` (aucune clé nouvelle) : `"1"` = le tien et `"0"` = aucun (les valeurs d'avant), `"premier"` et
//     `"diamant"` (les nouvelles). Lectures et écritures protégées : le jeu marche sans stockage.
//
// Un fantôme ne touche jamais la simulation du joueur : ce module ne sait rien d'elle.

export type GhostChoice = "mien" | "premier" | "diamant" | "aucun";
/** L'ordre du cycle. */
export const GHOST_CHOICES: readonly GhostChoice[] = ["mien", "premier", "diamant", "aucun"];

/** Ce qui existe en ce moment : « le tien » et « aucun » sont toujours possibles. */
export interface GhostAvailability {
  premier: boolean;
  diamant: boolean;
}

const available = (c: GhostChoice, a: GhostAvailability): boolean => (c === "premier" ? a.premier : c === "diamant" ? a.diamant : true);

/** Le choix suivant (en bouclant), en sautant ceux qui n'existent pas. Un choix courant qui n'existe plus (Diamant perdu) mène au suivant possible. */
export function nextChoice(current: GhostChoice, a: GhostAvailability): GhostChoice {
  const i = GHOST_CHOICES.indexOf(current);
  for (let k = 1; k <= GHOST_CHOICES.length; k++) {
    const c = GHOST_CHOICES[(i + k) % GHOST_CHOICES.length]!;
    if (available(c, a)) return c;
  }
  return "mien";
}

/** Le texte mémorisé → le choix (une valeur inconnue, ou rien : « le tien », comme avant le lot). */
export function parseChoice(raw: string | null | undefined): GhostChoice {
  return raw === "0" ? "aucun" : raw === "premier" || raw === "diamant" ? raw : "mien";
}

/** Le choix → le texte mémorisé (les valeurs d'avant le lot pour « le tien » et « aucun »). */
export function serializeChoice(c: GhostChoice): string {
  return c === "mien" ? "1" : c === "aucun" ? "0" : c;
}

export function loadGhostChoice(store: KeyValue | null): GhostChoice {
  try {
    return parseChoice(store?.getItem(storageKey("fantome")));
  } catch {
    return "mien";
  }
}

export function saveGhostChoice(store: KeyValue | null, c: GhostChoice): void {
  try {
    store?.setItem(storageKey("fantome"), serializeChoice(c));
  } catch {
    /* rien */
  }
}

/**
 * Le choix de départ : `?ghost=` l'impose sans toucher à ce qui est mémorisé — `off` aucun, `first` le premier seul, `best` le tien (sans le premier à côté :
 * `firstGhostOff`), rien : ce qui est mémorisé.
 */
export function startChoice(ghost: "off" | "best" | "first" | null, stored: GhostChoice): GhostChoice {
  return ghost === "off" ? "aucun" : ghost === "first" ? "premier" : ghost === "best" ? "mien" : stored;
}

/** Ce que chaque fantôme montre pour ce choix (le premier peut accompagner le tien : réglage et `?ghost=best`). */
export function shown(c: GhostChoice, firstAlongside: boolean): { own: boolean; first: boolean; diamond: boolean } {
  return { own: c === "mien", first: c === "premier" || (c === "mien" && firstAlongside), diamond: c === "diamant" };
}
