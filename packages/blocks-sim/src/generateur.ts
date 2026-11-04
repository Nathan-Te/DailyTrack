import { BLOCKS_GENERATOR_VERSION, PLAFOND_PIECES, RAMPE_PAR_DEFAUT, type Rampe } from "./constantes";
import { type Grille } from "./grille";
import { genererSuite, graineDuJour } from "./suite";

// Le contenu du jour : la suite des pièces (ids du catalogue), `PLAFOND_PIECES` rangs. **Pure** : la graine vient du numéro de jour civil, jamais d'une horloge.
// Un contenu peut aussi être un SCÉNARIO d'essai (`scenarios.ts` : grille de départ et début de suite fixés) ou porter une rampe réglée (`?debug&tune`) : jamais classé, jamais envoyé.

export interface Contenu {
  /** Le numéro de jour civil (0 pour un scénario). */
  jour: number;
  /** La version du tirage qui l'a produit. */
  g: number;
  /** Les ids des pièces, dans l'ordre : `suite[i]` est la pièce du moment après `i` poses. */
  suite: readonly number[];
  /** La grille de départ d'un scénario (vide sinon). */
  depart?: Grille;
  /** Le nom du scénario d'essai, s'il y en a un : la rediffusion nomme alors le scénario et non le jour. */
  scenario?: string;
  /** La rampe, quand elle n'est pas celle du jeu : le contenu est alors « réglé » et ne se classe pas. */
  rampe?: Rampe;
}

export class ErreurGenerateur extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurGenerateur";
  }
}

/** Le contenu d'un jour. Les anciennes versions du tirage restent appelables tant qu'un jour figé les nomme (ici : une seule). */
export function dailyBlocks(jour: number, version: number = BLOCKS_GENERATOR_VERSION, rampe?: Rampe): Contenu {
  if (version !== 1) throw new ErreurGenerateur(`version de tirage inconnue : ${version}`);
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
