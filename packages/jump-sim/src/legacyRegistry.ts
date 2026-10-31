import type { CatalogFile } from "./modules";

// Lot 30 : le catalogue **d'avant le maintien minimal du saut** (solutions des versions 3 à 12 de la simulation, générateurs g3 à g23). Le jeu ne l'embarque pas : le catalogue en
// vigueur (`catalog.ts`) a été re-résolu pour la version 13. Les tests et les outils qui régénèrent un niveau d'une version d'avant appellent `useLegacyCatalog()`
// (`src/legacy/index.ts`) ; sans cela, `dailyLevel(jour, thème, 12)` et ses voisins refusent avec un message qui le dit.

/** Ce qui change d'un catalogue à l'autre : les solutions et les trois listes de variantes refusées. */
export interface LegacyCatalog {
  solutions: CatalogFile;
  phaseRefused: Readonly<Record<string, readonly number[]>>;
  altBRefused: Readonly<Record<string, readonly number[]>>;
  parasiteClosed: Readonly<Record<string, readonly number[]>>;
}

let registered: LegacyCatalog | null = null;

export function registerLegacyCatalog(c: LegacyCatalog): void {
  registered = c;
}

/** Le catalogue d'avant le lot 30, ou une erreur claire s'il n'a pas été chargé. */
export function legacyCatalog(): LegacyCatalog {
  if (!registered) throw new Error("Catalogue d'avant la version 13 non chargé : appeler useLegacyCatalog() (@cdj/jump-sim/legacy) avant de générer un niveau d'une version d'avant la 13");
  return registered;
}

export const hasLegacyCatalog = (): boolean => registered !== null;
