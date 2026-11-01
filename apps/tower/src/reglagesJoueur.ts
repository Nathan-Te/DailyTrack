import { storageKey } from "./stockage";

// Les réglages d'affichage du joueur (lot T7, Réglages › Affichage) : ce que Nathan a demandé de pouvoir choisir, **gardé dans une seule clé, `tower:reglages`** (une donnée de jeu du navigateur :
// la plateforme la nomme dans les mentions légales et la remise à zéro — voir le rapport du lot). Ils ne touchent JAMAIS à la simulation ni à une rediffusion : seuls l'affichage et le départ
// d'une partie les lisent. Les effets sonores (`tower:sons`, lot T5) et la musique (`cdj:musique`, commune) ont chacun leur clé ; les touches, `cdj:commandes:tower` (règle M2).
// Pur : le stockage est injecté ; absent, refusé ou abîmé, chaque champ reprend son défaut, sans erreur.

export const CLE_REGLAGES = storageKey("reglages");
/** Version du format : un autre numéro ramène les défauts. */
export const VERSION_REGLAGES = 1;

/** Un niveau d'effet : normal, réduit (la moitié), aucun. */
export type Niveau = "normal" | "reduit" | "aucun";
/** Le fantôme du départ : aucun, ou ta meilleure partie du jour (le Diamant se choisit en jeu, au bouton). */
export type FantomeDepart = "aucun" | "meilleure";

export interface ReglagesJoueur {
  /** Le fantôme posé au départ d'une partie (`meilleure` s'il existe, comme avant le lot T7). */
  fantome: FantomeDepart;
  /** Les secousses de la caméra (une pièce perdue) : normales, réduites ou aucune — en plus de `prefers-reduced-motion`, qui les coupe déjà. */
  secousses: Niveau;
  /** La panique des yeux (écarquillés, tremblants) : normale, réduite ou aucune. Les yeux restent dessinés. */
  yeux: Niveau;
  /** La visée (lot T6 : la grille et la ligne de chute) : branchée à la fusion du lot T6 (`visee` n'a pas encore de lecteur). */
  visee: boolean;
}
export const REGLAGES_JOUEUR_DEFAUT: Readonly<ReglagesJoueur> = { fantome: "meilleure", secousses: "normal", yeux: "normal", visee: true };

/** Le facteur d'un niveau (1, 0,5 ou 0) : celui qui multiplie la secousse et le gain de la panique. */
export const facteurDe = (n: Niveau): number => (n === "normal" ? 1 : n === "reduit" ? 0.5 : 0);

type Lecture = Pick<Storage, "getItem"> | null;
type Ecriture = Pick<Storage, "setItem"> | null;

const niveau = (v: unknown): Niveau => (v === "reduit" || v === "aucun" ? v : "normal");

/** Lit les réglages : un stockage absent, vide, abîmé ou d'un autre format rend les défauts ; un champ invalide reprend le sien (les défauts sont le premier choix de chaque liste). */
export function lireReglagesJoueur(s: Lecture): ReglagesJoueur {
  try {
    const o = JSON.parse(s?.getItem(CLE_REGLAGES) ?? "null") as Partial<Record<keyof ReglagesJoueur | "v", unknown>> | null;
    if (o?.v !== VERSION_REGLAGES) return { ...REGLAGES_JOUEUR_DEFAUT };
    return { fantome: o.fantome === "aucun" ? "aucun" : "meilleure", secousses: niveau(o.secousses), yeux: niveau(o.yeux), visee: o.visee !== false };
  } catch {
    return { ...REGLAGES_JOUEUR_DEFAUT };
  }
}

/** Écrit les réglages ; sans stockage (ou s'il refuse) ils valent le temps de la page. */
export function ecrireReglagesJoueur(s: Ecriture, r: ReglagesJoueur): void {
  try {
    s?.setItem(CLE_REGLAGES, JSON.stringify({ v: VERSION_REGLAGES, ...r }));
  } catch {
    /* quota ou stockage refusé : le réglage vaut pour la page */
  }
}
