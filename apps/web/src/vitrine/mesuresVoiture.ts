// Lot 40 — les mesures de référence de la planche « Voiture » (`MESURE=1 npx playwright test mesure-lot40 -g "partie 2"`, Chromium, processeur
// ×4, **rendu logiciel**) : le temps d'une image de la vue à l'arrêt (Stade, 844 × 390, la voiture de près : elle couvre ≈ 40 % de l'image), avec
// la voiture de chaque colonne puis sans elle, aux paliers 1 et 2 ; 30 images. En rendu logiciel, chaque pixel de la voiture se paie au prix fort
// (la peinture à deux couches surtout) : l'écart dit l'ordre de grandeur, pas le chiffre d'un téléphone. Sur un téléphone, le compteur de la vue en
// mouvement donne le vrai chiffre. Appels : 28 avec la voiture, 15 sans (six maillages et leurs ombres, et la tache d'ombre).
import type { ModeleId } from "../voiture/modele";

type Mesure = { avecMs: number; sansMs: number };
export const MESURES_VOITURE: { appels: { avec: number; sans: number }; colonnes: Partial<Record<"existant" | ModeleId, { p1: Mesure; p2: Mesure }>> } = {
  appels: { avec: 28, sans: 15 },
  colonnes: {
    existant: { p1: { avecMs: 209.7, sansMs: 201.7 }, p2: { avecMs: 539.7, sansMs: 521.7 } },
    A: { p1: { avecMs: 215.8, sansMs: 185.9 }, p2: { avecMs: 618.7, sansMs: 511.6 } },
    B: { p1: { avecMs: 222.4, sansMs: 197.5 }, p2: { avecMs: 610.8, sansMs: 499.3 } },
    C: { p1: { avecMs: 231.9, sansMs: 207.1 }, p2: { avecMs: 611.5, sansMs: 498.6 } },
  },
};
