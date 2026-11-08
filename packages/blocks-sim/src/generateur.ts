import { BLOCKS_GENERATOR_VERSION, type ReglageSaisi } from "./constantes";
import { type Grille } from "./grille";
import type { Seuils } from "./medailles";
import { empreinteDeLaMarche } from "./empreinte";
import { graineDuJour, reglageEstCeluiDuJeu } from "./suite";

// Le contenu du jour : **la graine** (lot B8c, tirage v6 : les séries dépendent de la grille du joueur, elles se tirent pendant la partie, `suite.ts`). **Pure** : la graine vient du numéro de jour civil, jamais d'une horloge.
// Un contenu peut aussi être un SCÉNARIO d'essai (`scenarios.ts` : grille de départ et séries imposées) ou porter un réglage du tirage (`?debug&tune`) : jamais classé, jamais envoyé.

export interface Contenu {
  /** Le numéro de jour civil (0 pour un scénario). */
  jour: number;
  /** La version du tirage qui l'a produit. */
  g: number;
  /** La graine du jour (`graineDuJour`) : avec le rang de la série et la grille du moment, elle tire chaque série (tirage v6). */
  graine: number;
  /** Les séries imposées d'un scénario d'essai (ids de pièces, trois par série) : les séries suivantes sont tirées comme un jour ordinaire, pour la grille du moment. */
  imposees?: readonly (readonly number[])[];
  /** Règles v1 seulement (`g` 3, jour figé avant le lot B8) : `suite[i]` est la pièce du moment après `i` poses. Les règles v2 et v3 n'ont pas de suite : les séries se tirent pendant la partie. */
  suite?: readonly number[];
  /** La grille de départ d'un scénario (vide sinon). */
  depart?: Grille;
  /** Le nom du scénario d'essai, s'il y en a un : la rediffusion nomme alors le scénario et non le jour. */
  scenario?: string;
  /** Le réglage du tirage, quand il n'est pas celui du jeu : le contenu est alors « réglé » et ne se classe pas. */
  reglage?: ReglageSaisi;
  /** Les seuils des médailles **figés avec le jour** (fichier de jour) : quand ils sont là, ils font foi — un changement des seuils de la fiche ne change jamais un jour figé. */
  seuilsFiges?: Seuils;
}

/** Ce qu'il faut pour jouer une partie (règles v2 et v3) : la graine, la grille de départ, les séries imposées d'un scénario et le réglage du tirage. */
export type ContenuJouable = Pick<Contenu, "graine" | "depart" | "imposees" | "reglage">;

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
/** La version des règles qui va avec une version du tirage : v1 jusqu'au tirage v3, v2 pour les tirages v4 et v5 (plus jouables), v3 depuis le tirage v6. */
export const reglesDe = (g: number): number => (g >= 6 ? 3 : g >= 4 ? 2 : 1);

/** Le contenu d'un jour. La version courante du tirage se joue ; la v3 (règles v1) ne se relit que pour rejouer un jour figé en v1, une fois `activerReglesV1` appelée (le serveur). Un réglage du tirage ne s'applique qu'à la version courante. */
export function dailyBlocks(jour: number, version: number = BLOCKS_GENERATOR_VERSION, reglage?: ReglageSaisi): Contenu {
  const ancien = anciensTirages.get(version);
  if (ancien) return { jour, g: version, graine: graineDuJour(jour), suite: ancien(jour) };
  if (version !== BLOCKS_GENERATOR_VERSION) throw new ErreurGenerateur(`version de tirage inconnue : ${version}`);
  return { jour, g: version, graine: graineDuJour(jour), ...(reglage && !reglageEstCeluiDuJeu(reglage) ? { reglage } : {}) };
}

/** Le contenu est-il celui que le serveur sert (ni scénario, ni tirage réglé) ? Seul celui-là s'envoie. */
export const estClassable = (c: Contenu): boolean => c.scenario === undefined && c.reglage === undefined;

/**
 * L'empreinte du contenu (FNV-1a 32 bits sur ses entiers) : un texte de huit hexadécimaux. Règles v1 : le jour, la version et la suite. Depuis le tirage v6 il n'y a plus de suite à hacher : l'empreinte couvre le jour, la version, la graine et
 * **les séries que tire une partie de référence** (`empreinte.ts` : une marche fixe qui pose chaque pièce au premier endroit où elle tient), donc le tirage lui-même — grille comprise.
 */
export function empreinteContenu(contenu: Contenu): string {
  let h = 0x811c9dc5;
  const octet = (n: number): void => {
    h = Math.imul(h ^ (n & 0xff), 0x01000193) >>> 0;
  };
  const nombres = contenu.suite ? [contenu.jour, contenu.g, ...contenu.suite] : [contenu.jour, contenu.g, contenu.graine & 0xffff, contenu.graine >>> 16, ...empreinteDeLaMarche(contenu)];
  for (const n of nombres) {
    octet(n);
    octet(n >>> 8);
    octet(n >>> 16);
  }
  return h.toString(16).padStart(8, "0");
}
