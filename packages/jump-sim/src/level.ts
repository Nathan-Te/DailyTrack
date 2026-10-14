import { UNITS_PER_TILE } from "./constants";

// Un niveau est une grille ASCII, une ligne de texte par rangée de tuiles, la rangée 0 en haut :
//   `#` bloc plein · `.` vide · `S` départ · `F` arrivée (ces deux-là sont des tuiles vides repérées).
// `parseLevel` ne fait que lire le texte ; aucune règle de jeu ici (les éléments de niveau arrivent avec les lots suivants).

export const TILE_EMPTY = 0;
export const TILE_SOLID = 1;
export type Tile = typeof TILE_EMPTY | typeof TILE_SOLID;

/** Une tuile, par colonne (de gauche à droite) et rangée (de haut en bas). */
export interface Cell {
  col: number;
  row: number;
}

export interface Level {
  width: number;
  height: number;
  /** Rangée par rangée, la rangée 0 en haut : `tiles[row * width + col]`. */
  tiles: Tile[];
  start: Cell;
  finish: Cell;
}

export class LevelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LevelError";
  }
}

/** Lit une grille ASCII. Refuse tout ce qui est mal formé (lignes de longueurs différentes, caractère inconnu, pas exactement un `S` et un `F`). */
export function parseLevel(text: string): Level {
  const lines = text.replace(/\r/g, "").split("\n");
  while (lines.length > 0 && lines[0]!.trim() === "") lines.shift();
  while (lines.length > 0 && lines[lines.length - 1]!.trim() === "") lines.pop();
  if (lines.length === 0) throw new LevelError("Niveau vide");
  const width = lines[0]!.length;
  const height = lines.length;
  const tiles: Tile[] = [];
  const starts: Cell[] = [];
  const finishes: Cell[] = [];
  for (let row = 0; row < height; row++) {
    const line = lines[row]!;
    if (line.length !== width) throw new LevelError(`Ligne ${row + 1} : ${line.length} colonnes au lieu de ${width}`);
    for (let col = 0; col < width; col++) {
      const c = line[col]!;
      if (c === "#") tiles.push(TILE_SOLID);
      else if (c === "." || c === "S" || c === "F") {
        tiles.push(TILE_EMPTY);
        if (c === "S") starts.push({ col, row });
        if (c === "F") finishes.push({ col, row });
      } else throw new LevelError(`Ligne ${row + 1}, colonne ${col + 1} : caractère « ${c} » inconnu`);
    }
  }
  if (starts.length !== 1) throw new LevelError(`Il faut exactement un départ « S » (${starts.length} trouvés)`);
  if (finishes.length !== 1) throw new LevelError(`Il faut exactement une arrivée « F » (${finishes.length} trouvées)`);
  return { width, height, tiles, start: starts[0]!, finish: finishes[0]! };
}

/** La tuile en (col, row). Hors de la grille : plein (le monde est clos ; le lot 1 pourra en décider autrement). */
export function tileAt(level: Level, col: number, row: number): Tile {
  if (col < 0 || row < 0 || col >= level.width || row >= level.height) return TILE_SOLID;
  return level.tiles[row * level.width + col]!;
}

/** Coin haut-gauche d'une tuile, en unités entières (x vers la droite, y vers le bas, comme les rangées). */
export function cellOrigin(cell: Cell): { x: number; y: number } {
  return { x: cell.col * UNITS_PER_TILE, y: cell.row * UNITS_PER_TILE };
}
