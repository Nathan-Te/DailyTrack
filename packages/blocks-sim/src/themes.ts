// Les SIX thèmes de Blocks (lot B3, seed § 7) : ceux de Tower, **les mêmes palettes** (module commun `@cdj/visuels/blocs`), tirés par le sac de thèmes commun des jeux (`@cdj/core`, lot V1) : chaque thème une fois par cycle de
// six jours, jamais deux jours de suite le même. Blocks est un jeu neuf : aucun jour n'a été servi par une ancienne règle (`estAncien` toujours faux). Un thème n'a **aucun effet de jeu** : ni la partie ni le bot ne le lisent
// (il n'entre pas dans `empreinteContenu`) ; seul le rendu s'en sert (`apps/blocks/src/couleurs.ts`).
import { type ReglesSac, themeDuSac } from "@cdj/core";

export const THEMES_BLOCKS = ["port", "chantier", "canyon", "banquise", "jungle", "nuit"] as const;
export type ThemeBlocks = (typeof THEMES_BLOCKS)[number];

/** Sel du sac de Blocks (propre au jeu : l'ordre de ses thèmes n'est celui d'aucun autre jeu, Tower compris). */
const SEL_THEMES = 0xb10c5e;

export const REGLES_THEMES: ReglesSac = { n: THEMES_BLOCKS.length, sel: SEL_THEMES, ancien: () => 0, estAncien: () => false };

/** Le thème d'un jour (numéro de jour civil) selon le sac. */
export const themeDuJour = (jour: number): ThemeBlocks => THEMES_BLOCKS[themeDuSac(jour, REGLES_THEMES)]!;

export const estTheme = (nom: string | null | undefined): nom is ThemeBlocks => (THEMES_BLOCKS as readonly string[]).includes(nom ?? "");
