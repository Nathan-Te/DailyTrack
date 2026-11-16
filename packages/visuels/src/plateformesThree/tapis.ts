import { BELT_BAND, BELT_GAP, BELT_PERIOD, BELT_Z, CHEVRON_LAG, STRIPE, type Grille } from "../plateformes";
import type { CodesTuiles } from "./tuiles";

// Les chevrons des tapis roulants (lot PG1, repris du jeu d'origine sans changement), **purs** : un tampon par tronçon de colonnes, pour **un seul matériau** (`BELT_VERTEX` / `BELT_FRAGMENT`). Le défilement est un décalage de phase dans le
// shader (l'uniform `uTime`, `beltTime` de `@cdj/visuels/plateformes`) : rien n'est créé en jeu. Le temps vaut 0 avec le mouvement réduit et les effets « aucun » : les chevrons restent visibles, immobiles. Ce fichier n'importe pas
// `three` : le jeu fait de ces tampons des `BufferGeometry` (`position`, `aDir`, `aBand`, l'index) et du shader un `ShaderMaterial` (`uniforms: { uTime, uColor }`, `transparent`, `BELT_Z` pour la profondeur).
// Le jeu dit ce que sont ses cases par `CodesTuiles` (`sensTapis`, `vide`) ; il pose la couleur (`BELT_STYLE.chevron` du thème).

export interface BeltChunk {
  col0: number;
  col1: number;
  /** x y z par sommet ; sens du tapis (−1 / 1) et position dans la hauteur de la bande (0 bas … 1 haut) par sommet. */
  pos: number[];
  dir: number[];
  band: number[];
  idx: number[];
  triangles: number;
}

export interface BeltArt {
  chunks: BeltChunk[];
  /** Tuiles de tapis dessinées. */
  tiles: number;
}

/** La face du dessus de (col, row) est-elle libre ? (une case vide au-dessus : là seulement la surface se voit et agit) */
export function topExposed(grille: Grille, vide: number, col: number, row: number): boolean {
  if (row - 1 < 0) return false;
  return grille.tiles[(row - 1) * grille.width + col] === vide;
}

/** Les chevrons de tous les tapis (une bande par tuile de tapis exposée), par tronçons de `chunkColumns` colonnes. */
export function buildBeltArt(grille: Grille, codes: Pick<CodesTuiles, "sensTapis" | "vide">, chunkColumns: number): BeltArt {
  const chunks: BeltChunk[] = [];
  let tiles = 0;
  for (let c0 = 0; c0 < grille.width; c0 += chunkColumns) {
    const c1 = Math.min(grille.width, c0 + chunkColumns);
    const chunk: BeltChunk = { col0: c0, col1: c1, pos: [], dir: [], band: [], idx: [], triangles: 0 };
    for (let row = 0; row < grille.height; row++) {
      for (let col = c0; col < c1; col++) {
        const dir = codes.sensTapis(grille.tiles[row * grille.width + col]!);
        if (dir === 0 || !topExposed(grille, codes.vide, col, row)) continue;
        tiles++;
        const yTop = -row - BELT_GAP;
        const yBot = yTop - BELT_BAND;
        const v = chunk.pos.length / 3;
        for (const [x, y, b] of [[col, yBot, 0], [col + 1, yBot, 0], [col + 1, yTop, 1], [col, yTop, 1]] as const) {
          chunk.pos.push(x, y, BELT_Z);
          chunk.dir.push(dir);
          chunk.band.push(b);
        }
        chunk.idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
        chunk.triangles += 2;
      }
    }
    chunks.push(chunk);
  }
  return { chunks, tiles };
}

export const BELT_VERTEX = /* glsl */ `
attribute float aDir;
attribute float aBand;
varying float vDir;
varying vec2 vP;
void main() {
  vDir = aDir;
  vP = vec2(position.x, aBand);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const BELT_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
varying float vDir;
varying vec2 vP;
void main() {
  float w = abs(vP.y - 0.5) * 2.0;
  float f = vDir * vP.x / ${BELT_PERIOD.toFixed(3)} - uTime + w * ${CHEVRON_LAG.toFixed(3)};
  float q = fract(f);
  float a = smoothstep(0.0, 0.05, q) * (1.0 - smoothstep(${(STRIPE - 0.05).toFixed(3)}, ${STRIPE.toFixed(3)}, q));
  // Les deux bords de la bande (liserés) restent nus : le chevron ne touche ni le haut ni le bas.
  a *= 1.0 - smoothstep(0.84, 0.96, w);
  if (a < 0.02) discard;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}
`;
