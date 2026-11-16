import { TILE_BELT_LEFT, TILE_BELT_RIGHT, TILE_ICE, TILE_EMPTY, type Level } from "@cdj/jump-sim";
import { isMatterTile } from "./autotile";
import { BELT_BAND, BELT_FLOW, BELT_GAP, BELT_PERIOD, BELT_Z, CHEVRON_LAG, STRIPE, beltTime, chevronAt } from "@cdj/visuels/plateformes";
import { BELT_FRAGMENT, BELT_VERTEX, buildBeltArt as buildBeltArtCommun, topExposed as topExposedCommun, type BeltArt, type BeltChunk } from "@cdj/visuels/plateformes/three/tapis"; // sans `three` : ce fichier est dans le premier chargement (`beltRuns`)

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

// Lot DA2 : la bande d'un tapis (hauteur, marge) est dans `@cdj/visuels/plateformes`. Lot PG1 : **les chevrons aussi** — période, vitesse, profondeur, `beltTime`, `chevronAt`, le tampon par tronçon (`buildBeltArt`) et
// le shader (`BELT_VERTEX`, `BELT_FRAGMENT`) : Jump ne garde ici que ce qui lit sa grille (les codes de ses cases, `beltRuns`, `iceRuns`) ; `apps/jump/test/dessinFige.test.ts` garde l'empreinte des chevrons.
export { BELT_BAND, BELT_GAP, BELT_FLOW, BELT_PERIOD, BELT_Z, CHEVRON_LAG, STRIPE, beltTime, chevronAt, BELT_FRAGMENT, BELT_VERTEX };
export type { BeltArt, BeltChunk };

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
  return topExposedCommun(level, TILE_EMPTY, col, row);
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

// ——— Les chevrons : un tampon par tronçon, un matériau (le dessin est dans `@cdj/visuels/plateformes/three`) ———

/** Les chevrons de tous les tapis (une bande par tuile de tapis exposée), par tronçons de `chunkColumns` colonnes. */
export function buildBeltArt(level: Pick<Level, "width" | "height" | "tiles">, chunkColumns: number): BeltArt {
  return buildBeltArtCommun(level, { sensTapis: beltDirection, vide: TILE_EMPTY }, chunkColumns);
}
