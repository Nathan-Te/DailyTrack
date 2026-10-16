import { TILE_BELT_LEFT, TILE_BELT_RIGHT, TILE_ICE, TILE_EMPTY, type Level } from "@cdj/jump-sim";
import { isMatterTile } from "./autotile";

// Les deux surfaces du lot 11 — tapis roulants `[` `]` et glace `~` — côté affichage, **pur** (aucune dépendance à Three.js ni au DOM, testé
// sous Node) : on lit la grille, jamais la simulation. Une surface est un **bloc plein** dont seule la face du dessus a un traitement propre
// (`tileArt.ts` dessine le bloc et sa bande ; ce fichier trouve les surfaces et construit les chevrons qui défilent).
//
// - `beltRuns` / `iceRuns` : les **plages** de surface exposée (une rangée, des colonnes consécutives, même sens pour un tapis) — l'unité du
//   son spatialisé (`audioLogic.beltMix`) et de la surimpression `?debug&hitbox`.
// - `buildBeltArt` : les chevrons d'un tapis, **un seul tampon par tronçon de colonnes** (jamais un maillage par tuile), pour **un seul
//   matériau** (`BELT_VERTEX` / `BELT_FRAGMENT`) : le défilement est un décalage de phase dans le shader (uniform `uTime`), rien n'est créé
//   en jeu. Le temps vaut 0 avec le mouvement réduit et les effets « aucun » : les chevrons restent visibles, immobiles.
//
// Lisibilité (testée, `themes.test.ts`) : le fond de la bande est très sombre (mêmes seuils que les pleins vis-à-vis des dangers et du
// personnage) ; les chevrons sont clairs et peu saturés (ils se lisent en niveaux de gris et ne prennent la teinte ni du danger ni du
// personnage ni d'un ressort) ; ils pointent dans le sens du tapis et **défilent dans ce sens**.

/** Hauteur de la bande d'un tapis (tuiles), posée sous le contour clair de la face du dessus ; marge au-dessus. */
export const BELT_BAND = 0.22;
export const BELT_GAP = 0.05;
/** Période des chevrons (tuiles) et vitesse d'affichage de leur défilement (tuiles/s : la moitié de la vitesse du tapis, pour ne pas hacher l'image). */
export const BELT_PERIOD = 0.8;
export const BELT_FLOW = 2.4;
/** Profondeur de dessin des chevrons : juste au-dessus de la garniture (`TILE_Z.trim`), sous les dangers (0,05). */
export const BELT_Z = 0.0075;

/** Sens d'un tapis : −1 vers la gauche, 1 vers la droite, 0 pour toute autre tuile. */
export function beltDirection(tile: number): number {
  return tile === TILE_BELT_LEFT ? -1 : tile === TILE_BELT_RIGHT ? 1 : 0;
}

/** Une plage de surface exposée : rangée `row`, colonnes `col0` à `col1` incluses ; `dir` pour un tapis, 0 pour la glace. */
export interface SurfaceRun {
  kind: "tapis" | "glace";
  row: number;
  col0: number;
  col1: number;
  dir: number;
}

/** La face du dessus de (col, row) est-elle libre ? (une case vide au-dessus : là seulement la surface se voit et agit) */
export function topExposed(level: Pick<Level, "width" | "height" | "tiles">, col: number, row: number): boolean {
  if (row - 1 < 0) return false;
  return level.tiles[(row - 1) * level.width + col] === TILE_EMPTY;
}

function runsOf(level: Pick<Level, "width" | "height" | "tiles">, kind: SurfaceRun["kind"]): SurfaceRun[] {
  const out: SurfaceRun[] = [];
  for (let row = 0; row < level.height; row++) {
    let open: SurfaceRun | null = null;
    for (let col = 0; col < level.width; col++) {
      const t = level.tiles[row * level.width + col]!;
      const dir = kind === "tapis" ? beltDirection(t) : 0;
      const mine = kind === "tapis" ? dir !== 0 : t === TILE_ICE;
      if (mine && topExposed(level, col, row) && isMatterTile(t)) {
        if (open && open.col1 === col - 1 && open.dir === dir) open.col1 = col;
        else {
          open = { kind, row, col0: col, col1: col, dir };
          out.push(open);
        }
      } else open = null;
    }
  }
  return out;
}

/** Les tapis roulants du niveau (plages exposées, rangée par rangée, de gauche à droite). */
export function beltRuns(level: Pick<Level, "width" | "height" | "tiles">): SurfaceRun[] {
  return runsOf(level, "tapis");
}

/** La glace du niveau (plages exposées). */
export function iceRuns(level: Pick<Level, "width" | "height" | "tiles">): SurfaceRun[] {
  return runsOf(level, "glace");
}

/** Le niveau contient-il un tapis ou de la glace ? */
export function hasSurfaces(level: Pick<Level, "tiles">): boolean {
  for (const t of level.tiles) if (t === TILE_BELT_LEFT || t === TILE_BELT_RIGHT || t === TILE_ICE) return true;
  return false;
}

// ——— Les chevrons : un tampon par tronçon, un matériau ———

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

/** Les chevrons de tous les tapis (une bande par tuile de tapis exposée), par tronçons de `chunkColumns` colonnes. */
export function buildBeltArt(level: Pick<Level, "width" | "height" | "tiles">, chunkColumns: number): BeltArt {
  const chunks: BeltChunk[] = [];
  let tiles = 0;
  for (let c0 = 0; c0 < level.width; c0 += chunkColumns) {
    const c1 = Math.min(level.width, c0 + chunkColumns);
    const chunk: BeltChunk = { col0: c0, col1: c1, pos: [], dir: [], band: [], idx: [], triangles: 0 };
    for (let row = 0; row < level.height; row++) {
      for (let col = c0; col < c1; col++) {
        const dir = beltDirection(level.tiles[row * level.width + col]!);
        if (dir === 0 || !topExposed(level, col, row)) continue;
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

/**
 * Phase des chevrons (tuiles de défilement) à l'instant `clock` (s) : `flow` × temps, ou 0 (figés) sans mouvement. Le shader en tire
 * `uTime` ; la fonction est pure pour qu'un test vérifie « figé » et le sens.
 */
export function beltTime(clock: number, motion: boolean): number {
  return motion ? clock * (BELT_FLOW / BELT_PERIOD) : 0;
}

/**
 * Position (tuiles) du centre du chevron le plus proche de `x0` à la rangée centrale de la bande, au temps `uTime`, pour un tapis de sens
 * `dir` : la même formule que le shader (`f = dir·x / période − t`), pour que les tests vérifient le sens du défilement sans WebGL.
 */
export function chevronAt(x0: number, dir: number, uTime: number): number {
  // fract(f) < STRIPE : le chevron est là ; son bord avant est à f = 0 → x = dir·(t + k)·période.
  const f = (dir * x0) / BELT_PERIOD - uTime;
  const k = Math.floor(f);
  return dir * (uTime + k + STRIPE / 2) * BELT_PERIOD;
}

/** Part de la période occupée par un chevron (le reste est du fond). */
export const STRIPE = 0.42;
/** Retard des bords du chevron sur sa pointe (périodes) : il pointe dans le sens du tapis. */
export const CHEVRON_LAG = 0.38;

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
