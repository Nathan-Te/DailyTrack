import { TILE_EMPTY, TILE_ICE, isSpikeTile, type Level } from "@cdj/jump-sim";
import { CHUNK_COLUMNS, RIM, TILE_Z, TRIM_BUMP, buildTileArt as buildTileArtGrille, insideTiles as insideTilesGrille, type CodesTuiles, type TileArt, type TileChunk } from "@cdj/visuels/plateformes/three";
import type { Art } from "./artKit";
import { isMatterTile } from "./autotile";
import { keepoutField, keepouts, type Keepout } from "./decor";
import { beltDirection } from "./surfaceArt";
import type { TileStyle } from "./themes";

// Dessin des blocs pleins (lot 9), **pur** : chaque tuile `#` selon ses 8 voisins (`autotile.ts`) — coins extérieurs arrondis ou chanfreinés,
// coins intérieurs raccordés, contour clair sur les faces exposées (plus clair dessus, plus sombre dessous), garniture du thème sur les
// faces du dessus, plein qui s'assombrit avec la profondeur (couleur par sommet : un dégradé, pas des carrés) et un motif procédural
// déterministe à l'intérieur. Tout est **fusionné** : un tampon par tronçon de `CHUNK_COLUMNS` colonnes (un appel de dessin chacun,
// écarté par la caméra hors champ). La géométrie ne déborde jamais d'une tuile, sauf de petites bosses de garniture (≤ `TRIM_BUMP`)
// au-dessus d'une face libre.
//
// Lot 11 : un tapis roulant (`[` `]`) ou de la glace (`~`) est un bloc plein comme un autre pour l'auto-tuilage ; seule sa **face du dessus** change :
// tapis = une bande sombre cernée de deux liserés (les chevrons qui défilent sont un autre tampon, `surfaceArt.ts`, animé dans un shader) ;
// glace = un bloc bleu nuit à croûte claire épaisse et éclats en biais (statique). Pas de garniture du thème sur ces faces.
//
// Lisibilité : une face qui porte un pic n'a **ni contour ni garniture** (le pic, cerné de sombre, s'y détache sur le plein sombre) ; pas de
// bosse de garniture à moins de 1,5 tuile d'un danger, d'un ressort, d'un fanion ou de l'arrivée.
//
// Lot DA2 : le dessin (tuile par tuile, sur une grille et des prédicats) est dans `@cdj/visuels/plateformes/three` ; ce fichier dit ce que sont les
// cases de Jump (matière, glace, pic, tapis) et ce que la garniture doit éviter (`keepouts`, `decor.ts`), puis garde ses noms et ses exports.

export { CHUNK_COLUMNS, RIM, TILE_Z, TRIM_BUMP };
export type { TileArt, TileChunk };

const CODES: CodesTuiles = {
  estMatiere: isMatterTile,
  estGlace: (t) => t === TILE_ICE,
  estPic: isSpikeTile,
  sensTapis: beltDirection,
  vide: TILE_EMPTY,
};

/**
 * Construit le dessin des blocs pleins d'un niveau. `list` : ce que la garniture doit éviter (par défaut, `keepouts(level)`).
 */
export function buildTileArt(level: Level, style: TileStyle, list: readonly Keepout[] = keepouts(level)): TileArt {
  return buildTileArtGrille(level, style, CODES, keepoutField(level, list));
}

/** Vrai si toute la géométrie d'un tronçon reste dans ses tuiles pleines, aux bosses de garniture près (au plus `slack` au-dessus d'une face). */
export function insideTiles(level: Level, art: Art, slack = TRIM_BUMP): boolean {
  return insideTilesGrille(level, art, isMatterTile, slack);
}
