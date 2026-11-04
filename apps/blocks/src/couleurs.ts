import type { Famille } from "@cdj/blocks-sim";
import { ENCRE, type Forme, melanger, PALETTE_PORT, PAPIER, type PaletteTheme } from "@cdj/visuels/blocs";

// Les COULEURS de Blocks (lot B3) : **les palettes par thème de Tower**, celles du module commun `@cdj/visuels/blocs` (le port ici, dans le premier chargement du module ; les cinq autres dans `@cdj/visuels/blocs/themes`, à la demande :
// `chargerPalette`). Aucune couleur n'est écrite ici : tout vient du module, ou s'en déduit par `melanger` (un mélange de deux couleurs de la palette, ou d'une couleur de la palette avec l'encre / le papier de la charte).
//
// Les 8 familles de pièces, 7 formes dans la palette : chaque famille prend la couleur d'une forme, **la famille « rectangle » prend le mélange à parts égales du J (bleu) et du S (vert)** — un bleu-vert qu'aucune des sept formes ne porte.
// `test/palettes.test.ts` vérifie, pour les six thèmes, que les huit couleurs sont à ΔE ≥ 25 les unes des autres et que chacune se distingue des fonds (ciel, sol).
const FORME_DE_FAMILLE: Readonly<Record<Exclude<Famille, "rectangle">, Forme>> = { petite: "O", barre: "I", carre: "J", coin: "S", l: "L", grandL: "Z", tsz: "T" };
export const FAMILLES: readonly Famille[] = ["petite", "barre", "carre", "coin", "l", "grandL", "tsz", "rectangle"];

/** La couleur d'une famille de pièces dans une palette de thème. */
export const couleurDeFamille = (p: PaletteTheme, f: Famille): string => (f === "rectangle" ? melanger(p.pieces.J, p.pieces.S, 0.5) : p.pieces[FORME_DE_FAMILLE[f]]);

/** Le thème est-il sombre (un ciel de nuit) ? Les textes posés sur le fond passent alors en clair. */
export const estSombre = (p: PaletteTheme): boolean => {
  const c = (i: number): number => parseInt(p.ciel.slice(1 + 2 * i, 3 + 2 * i), 16);
  return 0.2126 * c(0) + 0.7152 * c(1) + 0.0722 * c(2) < 110;
};

/** Ce que la scène peint, déduit d'une palette de thème (et de l'encre et du papier de la charte). */
export interface CouleursTheme {
  /** Le fond de toute la scène : le ciel du thème. */
  fond: string;
  /** Le fond de la grille (entre les cases) : le sol du thème. */
  grille: string;
  /** Une case vide. */
  caseVide: string;
  /** Le cadre de la grille. */
  cadre: string;
  /** « Ta pièce » (saisissable) et « Suivante » (pour information). */
  zone: string;
  zoneSuivante: string;
  /** Les cases d'un scénario déjà posées au départ : la plateforme du thème. */
  depart: string;
  /** Le thème est sombre : les textes de la scène passent en clair. */
  sombre: boolean;
  /** Les huit familles. */
  familles: Readonly<Record<Famille, string>>;
}

export function couleursDeTheme(p: PaletteTheme): CouleursTheme {
  const sombre = estSombre(p);
  return {
    fond: p.ciel,
    grille: p.sol,
    caseVide: melanger(p.sol, sombre ? p.plateforme : PAPIER, sombre ? 0.45 : 0.24),
    cadre: sombre ? PAPIER : ENCRE,
    // Les deux zones sont des cartes de papier posées sur la scène, claires dans tous les thèmes : leurs étiquettes restent en encre.
    zone: melanger(p.ciel, PAPIER, sombre ? 0.82 : 0.6),
    zoneSuivante: melanger(p.ciel, PAPIER, sombre ? 0.62 : 0.3),
    depart: p.plateforme,
    sombre,
    familles: Object.fromEntries(FAMILLES.map((f) => [f, couleurDeFamille(p, f)])) as Record<Famille, string>,
  };
}

let courante: PaletteTheme = PALETTE_PORT;
/** La palette de la partie en cours (le port tant qu'aucune autre n'est posée) : `corps.ts` la pose en chargeant le jour, avant que la scène se construise. */
export const paletteCourante = (): PaletteTheme => courante;
export function poserPalette(p: PaletteTheme): void {
  courante = p;
}

/** La palette d'un thème : le port tout de suite, les autres par un fichier à part (chargé à la demande, avec le corps du jeu). */
export async function chargerPalette(theme: string): Promise<PaletteTheme> {
  if (theme === "port") return PALETTE_PORT;
  const { PALETTES } = await import("@cdj/visuels/blocs/themes");
  return PALETTES[theme as keyof typeof PALETTES] ?? PALETTE_PORT;
}
