import { BLOCKS_GENERATOR_VERSION, PLAFOND_PIECES, RAMPE_PAR_DEFAUT, type Rampe } from "./constantes";
import { type Grille } from "./grille";
import type { Seuils } from "./medailles";
import { genererSuite, graineDuJour } from "./suite";

// Le contenu du jour : la suite des pièces (ids du catalogue, série de trois après série de trois), `PLAFOND_PIECES` pièces. **Pure** : la graine vient du numéro de jour civil, jamais d'une horloge.
// Un contenu peut aussi être un SCÉNARIO d'essai (`scenarios.ts` : grille de départ et début de suite fixés) ou porter une rampe réglée (`?debug&tune`) : jamais classé, jamais envoyé.

export interface Contenu {
  /** Le numéro de jour civil (0 pour un scénario). */
  jour: number;
  /** La version du tirage qui l'a produit. */
  g: number;
  /** Les ids des pièces, dans l'ordre : la série `s` est `suite[3s]`, `suite[3s + 1]`, `suite[3s + 2]` (règles v2) ; en v1 (`g` 3, jour figé), `suite[i]` est la pièce du moment après `i` poses. */
  suite: readonly number[];
  /** La grille de départ d'un scénario (vide sinon). */
  depart?: Grille;
  /** Le nom du scénario d'essai, s'il y en a un : la rediffusion nomme alors le scénario et non le jour. */
  scenario?: string;
  /** La rampe, quand elle n'est pas celle du jeu : le contenu est alors « réglé » et ne se classe pas. */
  rampe?: Rampe;
  /** Les seuils des médailles **figés avec le jour** (fichier de jour, format 2) : quand ils sont là, ils font foi et le bot n'est pas appelé — un changement du bot ne change jamais un jour figé. */
  seuilsFiges?: Seuils;
}

export class ErreurGenerateur extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurGenerateur";
  }
}

/**
 * Les ANCIENS tirages qu'on sait relire (le v3, règles v1) : `v1.ts` s'y inscrit quand le serveur appelle `activerReglesV1` (`@cdj/blocks-sim/v1`). **Le jeu ne les charge jamais** : il ne sait pas jouer les règles v1, et leur code ne doit pas
 * alourdir son premier chargement. Sans inscription, un jour figé en v1 ne se relit pas (`lireJourFige` rend `null`).
 */
export const anciensTirages = new Map<number, (jour: number) => readonly number[]>();
/** La version des règles qui va avec une version du tirage : v1 jusqu'au tirage v3, v2 depuis le tirage v4. */
export const reglesDe = (g: number): number => (g >= 4 ? 2 : 1);

/** Le contenu d'un jour. La version courante du tirage se joue ; la v3 (règles v1) ne se relit que pour rejouer un jour figé en v1, une fois `activerReglesV1` appelée (le serveur). Une rampe réglée ne s'applique qu'à la version courante. */
export function dailyBlocks(jour: number, version: number = BLOCKS_GENERATOR_VERSION, rampe?: Rampe): Contenu {
  const ancien = anciensTirages.get(version);
  if (ancien) return { jour, g: version, suite: ancien(jour) };
  if (version !== BLOCKS_GENERATOR_VERSION) throw new ErreurGenerateur(`version de tirage inconnue : ${version}`);
  const regle = rampe && (rampe.pente !== RAMPE_PAR_DEFAUT.pente || rampe.rangMax !== RAMPE_PAR_DEFAUT.rangMax);
  return { jour, g: version, suite: genererSuite(graineDuJour(jour), rampe ?? RAMPE_PAR_DEFAUT, PLAFOND_PIECES), ...(regle ? { rampe } : {}) };
}

/** Le contenu est-il celui que le serveur sert (ni scénario, ni rampe réglée) ? Seul celui-là s'envoie. */
export const estClassable = (c: Contenu): boolean => c.scenario === undefined && c.rampe === undefined;

/** L'empreinte du contenu (FNV-1a 32 bits sur ses entiers) : un texte de huit hexadécimaux. */
export function empreinteContenu(contenu: Contenu): string {
  let h = 0x811c9dc5;
  const octet = (n: number): void => {
    h = Math.imul(h ^ (n & 0xff), 0x01000193) >>> 0;
  };
  for (const n of [contenu.jour, contenu.g, ...contenu.suite]) {
    octet(n);
    octet(n >>> 8);
    octet(n >>> 16);
  }
  return h.toString(16).padStart(8, "0");
}
