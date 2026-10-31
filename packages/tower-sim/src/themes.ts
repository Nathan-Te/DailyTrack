// Lot T3 — les thèmes de Tower : une palette, un fond et une plateforme par thème (le rendu est dans `apps/tower/src/palette.ts`). **Un thème n'a aucun effet physique** : la simulation
// ne le lit jamais (il entre dans le contenu du jour, donc dans `empreinteContenu`, mais ni la partie ni le bot ne s'en servent).
// Tirage : le sac de thèmes commun des jeux (`@cdj/core`, lot V1) — chaque thème une fois par cycle de six jours, jamais deux jours de suite le même. Tower est un jeu neuf : aucun jour
// n'a été servi par une ancienne règle (`estAncien` toujours faux), le sac s'applique tel quel dès le premier jour.
import { type ReglesSac, themeDuSac } from "@cdj/core";

export const THEMES_TOWER = ["port", "chantier", "canyon", "banquise", "jungle", "nuit"] as const;
export type ThemeTower = (typeof THEMES_TOWER)[number];

/** Sel du sac de Tower (propre au jeu : l'ordre de ses thèmes n'est celui d'aucun autre jeu). */
const SEL_THEMES = 0x70e13;

export const REGLES_THEMES: ReglesSac = { n: THEMES_TOWER.length, sel: SEL_THEMES, ancien: () => 0, estAncien: () => false };

/** Le thème d'un jour (numéro de jour civil) selon le sac. Le générateur de version 1 n'en tire pas : tous ses jours sont `port`. */
export const themeDuJour = (jour: number): ThemeTower => THEMES_TOWER[themeDuSac(jour, REGLES_THEMES)]!;
