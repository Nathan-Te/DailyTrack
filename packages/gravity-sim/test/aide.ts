import { CASE, LARGEUR_MORCEAU, LIGNES, Partie, terrainDeTest, type Bonus, type Objet, type Terrain } from "../src/index";

// Des aides pour les tests de règles : un terrain écrit en texte (`terrainDeTest`) et quelques lectures.

/** Les douze lignes d'un morceau : le couloir par défaut (plafond et sol de deux cases), modifié par `modifs` : `[colonne, rangée, caractère]`. */
export function morceau(modifs: readonly (readonly [number, number, string])[] = []): string[] {
  const g = Array.from({ length: LIGNES }, (_, r) => (r < 2 || r >= LIGNES - 2 ? "#".repeat(LARGEUR_MORCEAU) : ".".repeat(LARGEUR_MORCEAU)).split(""));
  for (const [c, r, ch] of modifs) g[r]![c] = ch;
  return g.map((l) => l.join(""));
}
/** Un trou au sol ou au plafond de la colonne `de` à `a` exclue. */
export const trou = (de: number, a: number, haut = false): [number, number, string][] =>
  Array.from({ length: a - de }, (_, i) => (haut ? ([[de + i, 0, "."], [de + i, 1, "."]] as const) : ([[de + i, 10, "."], [de + i, 11, "."]] as const))).flat().map(([c, r, ch]) => [c, r, ch]);

export const centreDe = (colonne: number, rangee: number): Objet => ({ x: colonne * CASE + CASE / 2, y: rangee * CASE + CASE / 2 });
export const bonus = (colonne: number, rangee: number, type: Bonus["type"]): Bonus => ({ ...centreDe(colonne, rangee), type });

export function partieSur(grilles: readonly (readonly string[])[], objets: { pieces?: readonly Objet[]; gemmes?: readonly Objet[]; bonus?: readonly Bonus[] } = {}): Partie {
  return new Partie(terrainDeTest(grilles, objets));
}
export function avancer(p: Partie, n: number): Partie {
  for (let i = 0; i < n && !p.finie; i++) p.avancer();
  return p;
}
/** Avance jusqu'à ce que `cond` soit vraie (au plus `max` pas) ; rend le pas où elle l'est devenue, ou −1. */
export function jusqua(p: Partie, cond: (p: Partie) => boolean, max = 3000): number {
  for (let i = 0; i < max && !p.finie; i++) {
    if (cond(p)) return p.tick;
    p.avancer();
  }
  return cond(p) ? p.tick : -1;
}
/** Le terrain sans rien d'écrit : des couloirs à l'infini. */
export const couloirs = (): Terrain => terrainDeTest([]);
