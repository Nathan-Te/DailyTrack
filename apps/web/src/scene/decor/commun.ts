// Lot 44 — **le décor du palier 1**, ce que les huit thèmes partagent (chargé à la demande avec le premier thème demandé : un morceau commun) :
//   - **le sol relevé** (`terrainDe`) : un talus, puis une pente douce, entre le bord de la piste et le décor ; à 1,5 m sous la route la plus basse alentour,
//     il redescend au sol lointain plus loin. Il ne touche jamais la surface roulante (rien dans une cellule de la piste), **la simulation ne le voit pas**
//     (aucun appui pour la voiture : c'est un maillage du décor) ; il reste au sol lointain près d'un bloc sans rebords (la voiture peut y tomber) et d'un
//     vide de saut (on voit le vide qu'on franchit) ;
//   - **la pose sur ce sol** (`poserSurTerrain`) : chaque élément est construit, mesuré, posé sur le point le plus bas du sol sous lui (rien en l'air), refusé
//     s'il touche la route (`MARGE_DECOR`) ou s'il est trop enfoui (pente trop forte) — un élément refusé a consommé ses tirages au sort ;
//   - les places (`placesDeDecor`), la tribune du départ, les pièces communes (pneus, drapeaux, panneaux publicitaires, foule, sapins, rochers, cactus…),
//     l'assemblage (`construireDecor`) : un thème ne donne que ses recettes (`decor/<thème>.ts`).
// Règles de pose du lot 37 (apps/web/CLAUDE.md, « Décor : règles de pose ») : un appui, rien au-dessus du vide, rien dans le passage ni devant la caméra, un
// rôle par élément ; tout passe par le relevé (`PoseLog`), le test de pose (`test/decorPose.test.ts`) le vérifie contre la simulation. **Rendu seul.**
import { CELL, NO_GROUND, WALL_HEIGHT, blockHalfWidth, cellKey, createSurface, trackWorld, turnsLeft, type Block, type Track, type World } from "@cdj/sim";
import { mix, seeded, shade, world as auMonde, type Box, type Builder, type V3 } from "../../meshKit";
import { MARGE_DECOR, type PoseKind, type PoseLog } from "../../decorPose";
import { boite, boiteChanfreinee, pt, repereBloc, tube, type Repere } from "../outils";
import { MARQUE } from "../pieces";
import { CAOUTCHOUC, METAL, METAL_SOMBRE } from "../piste";
import { onBlock } from "../route";
import { VENT, ROUGE_PISTE } from "../palier1";
import { rectSponsor, sponsorsDuTheme } from "../sponsors";
import { THEMES_C } from "../lumiere";
import { SOLS_C, grain, texturedSol, uvMonde } from "./matiereC";
import type { CalquesDecor, Contexte, DecorTheme, ModuleDecor, PlaceDecor } from "../types";

// --- Le sol relevé ---------------------------------------------------------------------------------------------------------------------

/** Le haut du talus est à `TALUS_SOUS_ROUTE` m sous la route la plus basse alentour (le rebord, lui, monte à 1,4 m au-dessus d'elle). */
export const TALUS_SOUS_ROUTE = 1.5;
/** Largeur (m) du replat au-delà de la cellule de la piste, puis pente douce (m de descente par m) jusqu'au sol lointain. */
export const REPLAT = 36;
export const PENTE = 0.22;
/** Près d'un bloc sans rebords ou d'un vide de saut : le sol lointain sur `REPLAT_VIDE` m, puis une pente pour rejoindre le talus. */
export const REPLAT_VIDE = 10;
export const PENTE_VIDE = 0.4;
/** Pas de la grille du sol (m) : deux carrés par côté de cellule. */
export const PAS_TERRAIN = CELL / 2;
/** Le sol relevé s'étend à `PORTEE_TERRAIN` cellules de la piste. */
export const PORTEE_TERRAIN = 3;
/** Un sommet du sol qui est au sol lointain est enfoncé d'autant (pas de scintillement avec le plan du sol). */
const SOUS_LE_SOL = 0.3;
/** Un élément de décor plus enfoui que cela d'un côté (pente forte sous lui) n'est pas posé. */
export const ENFOUI_MAX = 1.6;

/** Un bloc près duquel le sol se relève : ni sans rebords (la voiture peut tomber à côté), ni vide de saut. */
export const releve = (b: Block): boolean => !b.open && b.kind !== "gap";
const bas = (b: Block) => Math.min(b.y0, b.y0 + b.rise);

/** Le sol relevé d'un circuit : une grille de hauteurs (pas de `PAS_TERRAIN` m), la hauteur en tout point, et la cellule (piste ou non) d'un point. */
export interface Terrain {
  readonly sol: number;
  /** Hauteur du sol visible en (x, z) : le talus, ou le sol lointain. Interpolée sur les mêmes triangles que le maillage. */
  hauteur(x: number, z: number): number;
  /** Les triangles du sol relevé, construits dans `g` (couleurs du thème) ; `garder(cx, cz)` : seulement ces cellules (miniatures). */
  construire(g: Builder, couleurs: readonly [number, number], garder?: (cx: number, cz: number) => boolean): void;
  /** Hauteur d'un sommet de la grille (i, k) : x = i · pas, z = k · pas. */
  sommet(i: number, k: number): number;
  /** Les carrés de la grille construits (indices du coin bas), pour les tests. */
  readonly carres: readonly [number, number][];
}

/** Le sol relevé d'un circuit (pur : aucun DOM ; la même chose pour tout le monde). */
export function terrainDe(track: Track, sol: number): Terrain {
  const P = PAS_TERRAIN;
  const parCellule = CELL / P;
  let i0 = Infinity;
  let i1 = -Infinity;
  let k0 = Infinity;
  let k1 = -Infinity;
  for (const key of track.cells.keys()) {
    const cx = Math.floor(key / 4096) - 1024;
    const cz = (key % 4096) - 1024;
    i0 = Math.min(i0, (cx - PORTEE_TERRAIN) * parCellule);
    i1 = Math.max(i1, (cx + 1 + PORTEE_TERRAIN) * parCellule);
    k0 = Math.min(k0, (cz - PORTEE_TERRAIN) * parCellule);
    k1 = Math.max(k1, (cz + 1 + PORTEE_TERRAIN) * parCellule);
  }
  const ni = i1 - i0 + 1;
  const h = new Float32Array(ni * (k1 - k0 + 1));
  const portee = PORTEE_TERRAIN;
  // Les cellules alentour, dans une grille (bien plus rapide qu'une table à chaque sommet) : 0 rien, 1 un bloc qui relève le sol (et sa hauteur), 2 un bloc qui le
  // garde au sol lointain (sans rebords, vide de saut).
  const c0x = i0 / parCellule - portee;
  const c0z = k0 / parCellule - portee;
  const nc = i1 / parCellule - c0x + portee + 1;
  const mc = k1 / parCellule - c0z + portee + 1;
  const sorte = new Uint8Array(nc * mc);
  const dessus = new Float32Array(nc * mc);
  for (const [key, b] of track.cells) {
    const idx = (Math.floor(key / 4096) - 1024 - c0x) + ((key % 4096) - 1024 - c0z) * nc;
    sorte[idx] = releve(b) ? 1 : 2;
    dessus[idx] = bas(b) - TALUS_SOUS_ROUTE;
  }
  for (let k = k0; k <= k1; k++) {
    for (let i = i0; i <= i1; i++) {
      const x = i * P;
      const z = k * P;
      const ccx = Math.floor(x / CELL);
      const ccz = Math.floor(z / CELL);
      let haut = -Infinity;
      let plafond = Infinity;
      for (let dz = -portee; dz <= portee; dz++) {
        const gz = ccz + dz - c0z;
        if (gz < 0 || gz >= mc) continue;
        const cz = ccz + dz;
        const ez = Math.max(cz * CELL - z, 0, z - (cz + 1) * CELL);
        for (let dx = -portee; dx <= portee; dx++) {
          const gx = ccx + dx - c0x;
          if (gx < 0 || gx >= nc) continue;
          const idx = gx + gz * nc;
          const t = sorte[idx]!;
          if (t === 0) continue;
          const cx = ccx + dx;
          const ex = Math.max(cx * CELL - x, 0, x - (cx + 1) * CELL);
          const d = ex === 0 ? ez : ez === 0 ? ex : Math.sqrt(ex * ex + ez * ez);
          if (t === 1) {
            const top = dessus[idx]!;
            haut = Math.max(haut, top - PENTE * Math.max(0, d - REPLAT));
            plafond = Math.min(plafond, top + 0.5 * d);
          } else plafond = Math.min(plafond, sol + PENTE_VIDE * Math.max(0, d - REPLAT_VIDE));
        }
      }
      const v = Math.min(Math.max(sol, haut), plafond);
      h[(k - k0) * ni + (i - i0)] = v <= sol + 0.01 ? sol - SOUS_LE_SOL : v;
    }
  }
  const sommet = (i: number, k: number) => (i < i0 || i > i1 || k < k0 || k > k1 ? sol - SOUS_LE_SOL : h[(k - k0) * ni + (i - i0)]!);
  // Les carrés construits : hors de la piste, et pas tout entiers au sol lointain.
  const carres: [number, number][] = [];
  for (let k = k0; k < k1; k++) {
    for (let i = i0; i < i1; i++) {
      if (track.cells.has(cellKey(Math.floor((i * P + 1) / CELL), Math.floor((k * P + 1) / CELL)))) continue;
      if (Math.max(sommet(i, k), sommet(i + 1, k), sommet(i, k + 1), sommet(i + 1, k + 1)) <= sol) continue;
      carres.push([i, k]);
    }
  }
  return {
    sol,
    sommet,
    carres,
    hauteur(x, z) {
      const fx = x / P;
      const fz = z / P;
      const i = Math.floor(fx);
      const k = Math.floor(fz);
      const u = fx - i;
      const v = fz - k;
      // Deux triangles par carré, coupés selon la diagonale (i, k) → (i + 1, k + 1), comme le maillage.
      const a = sommet(i, k);
      const c = sommet(i + 1, k + 1);
      const y = u >= v ? a + (sommet(i + 1, k) - a) * u + (c - sommet(i + 1, k)) * v : a + (sommet(i, k + 1) - a) * v + (c - sommet(i, k + 1)) * u;
      return Math.max(sol, y);
    },
    construire(g, couleurs, garder) {
      for (const [i, k] of carres) {
        if (garder && !garder(Math.floor((i * P) / CELL), Math.floor((k * P) / CELL))) continue;
        const p = (di: number, dk: number): V3 => [(i + di) * P, sommet(i + di, k + dk), (k + dk) * P];
        const teinte = couleurs[(i + k) & 1]!;
        g.tri(p(0, 0), p(1, 1), p(1, 0), teinte);
        g.tri(p(0, 0), p(0, 1), p(1, 1), shade(teinte, 0.97));
      }
    },
  };
}

// --- Les places du décor -----------------------------------------------------------------------------------------------------------

/**
 * Les places de décor (lot 38, reprises ici) : des points au sol dans les cellules vides à `portee` cellules au plus d'un bloc. **Rien dans le passage** : une
 * cellule voisine entourée par la piste (trois cellules de piste ou plus autour d'elle : l'intérieur d'un virage ou d'une épingle) reste vide — ses tirages au
 * sort sont faits quand même, le reste du décor ne bouge pas. `parCellule(anneau)` : combien d'éléments dans une cellule de cet anneau (1 = voisine d'un bloc).
 */
export function placesDeDecor(track: Track, rnd: () => number, parCellule: (anneau: number) => number, portee = 2, terrain?: Terrain): PlaceDecor[] {
  const out: PlaceDecor[] = [];
  const seen = new Set<number>();
  const piste = (cx: number, cz: number) => track.cells.has(cellKey(cx, cz));
  for (const b of track.blocks) {
    for (let dx = -portee; dx <= portee; dx++) {
      for (let dz = -portee; dz <= portee; dz++) {
        const cx = b.cx + dx;
        const cz = b.cz + dz;
        const key = cellKey(cx, cz);
        if (piste(cx, cz) || seen.has(key)) continue;
        seen.add(key);
        // L'anneau et le bloc le plus proche (distance de Tchebychev entre cellules).
        let best = b;
        let bestD = Infinity;
        for (const o of track.blocks) {
          const d = Math.max(Math.abs(o.cx - cx), Math.abs(o.cz - cz));
          if (d < bestD) {
            bestD = d;
            best = o;
          }
        }
        const anneau = bestD;
        let voisines = 0;
        for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) if ((i || j) && piste(cx + i, cz + j)) voisines++;
        const n = parCellule(anneau);
        if (anneau === 1 && voisines >= 3) continue; // le passage : tirage fait (même suite de nombres), rien de posé
        for (let i = 0; i < n; i++) {
          const x = cx * CELL + 3 + rnd() * (CELL - 6);
          const z = cz * CELL + 3 + rnd() * (CELL - 6);
          const c = auMonde(best, CELL / 2, CELL / 2, best.y0);
          const vx = c[0] - x;
          const vz = c[2] - z;
          const l = Math.hypot(vx, vz) || 1;
          out.push({ x, z, y: terrain ? terrain.hauteur(x, z) : track.voidY - 4, anneau, versRoute: [vx / l, vz / l], yRoute: best.y0, cx, cz });
        }
      }
    }
  }
  return out;
}

// --- La pose sur le sol relevé -------------------------------------------------------------------------------------------------------

const probe = createSurface();

/**
 * Vrai si le plan de `box`, élargi de `marge` m, ne touche rien de ce que la voiture roule (route, bas-côté, paroi de cuve) : son pourtour (un point par mètre) et
 * son centre, comme le lot 37 — une route (14 m au moins) ne peut pas passer entre deux points du pourtour sans en toucher un.
 */
export function planLibre(world: World, box: Box, marge: number): boolean {
  const x0 = box.x0 - marge;
  const x1 = box.x1 + marge;
  const z0 = box.z0 - marge;
  const z1 = box.z1 + marge;
  const hit = (x: number, z: number) => {
    world.sample(x, z, probe);
    return probe.height !== NO_GROUND;
  };
  if (hit((x0 + x1) / 2, (z0 + z1) / 2)) return false;
  const nx = Math.max(1, Math.ceil(x1 - x0));
  const nz = Math.max(1, Math.ceil(z1 - z0));
  for (let i = 0; i <= nx; i++) {
    const x = x0 + ((x1 - x0) * i) / nx;
    if (hit(x, z0) || hit(x, z1)) return false;
  }
  for (let j = 1; j < nz; j++) {
    const z = z0 + ((z1 - z0) * j) / nz;
    if (hit(x0, z) || hit(x1, z)) return false;
  }
  return true;
}

/** Le sol le plus bas et le plus haut sous le plan d'une boîte (un point tous les 2 m au plus). */
export function solSous(t: Terrain, box: Box): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  const nx = Math.max(1, Math.ceil((box.x1 - box.x0) / 2));
  const nz = Math.max(1, Math.ceil((box.z1 - box.z0) / 2));
  for (let i = 0; i <= nx; i++) {
    for (let j = 0; j <= nz; j++) {
      const y = t.hauteur(box.x0 + ((box.x1 - box.x0) * i) / nx, box.z0 + ((box.z1 - box.z0) * j) / nz);
      lo = Math.min(lo, y);
      hi = Math.max(hi, y);
    }
  }
  return [lo, hi];
}

/** Ce que la pose connaît du circuit : le sol relevé, ce que roule la voiture, le relevé (tests). */
export interface Sol {
  terrain: Terrain;
  world: World;
  log?: PoseLog;
}

/**
 * Pose un élément de décor sur le sol relevé : `run` le construit (à la hauteur du sol à sa place), puis il est **descendu sur le point le plus bas du sol sous
 * lui** (rien en l'air : de l'autre côté d'une pente, il est un peu enfoui), refusé s'il touche la surface roulante (`MARGE_DECOR`) ou s'il serait enfoui de
 * plus de `ENFOUI_MAX` (pente trop forte). Refusé, il est retiré (`rollback`) mais a consommé ses tirages au sort : le reste du décor ne bouge pas. Rend vrai
 * s'il est posé.
 */
export function poserSurTerrain(s: Sol, c: CalquesDecor, kind: PoseKind, style: string, run: () => void, marge = MARGE_DECOR): boolean {
  const builders = [...new Set([c.decor, c.decorLumineux, c.dense])];
  const marks = builders.map((b) => b.mark());
  const aff = c.affiches.pos.length;
  const affUv = c.affiches.uv.length;
  run();
  let box: Box | null = null;
  let tris = 0;
  builders.forEach((b, i) => {
    const bb = b.boxSince(marks[i]!);
    tris += (b.pos.length - marks[i]!.pos) / 9;
    if (bb) box = box ? { x0: Math.min(box.x0, bb.x0), y0: Math.min(box.y0, bb.y0), z0: Math.min(box.z0, bb.z0), x1: Math.max(box.x1, bb.x1), y1: Math.max(box.y1, bb.y1), z1: Math.max(box.z1, bb.z1) } : bb;
  });
  if (!box) {
    // Constructeurs muets (miniatures, hors du cadre) : les tirages sont faits, rien à poser (les affiches non plus).
    c.affiches.pos.length = aff;
    c.affiches.uv.length = affUv;
    return true;
  }
  const b0: Box = box;
  // Une structure qui descend jusqu'au sol lointain (les immeubles de la Ville) y a son appui : elle traverse le talus, on ne la déplace pas.
  const auSol = b0.y0 <= s.terrain.sol + 0.01;
  const [lo, hi] = auSol ? [b0.y0, b0.y0] : solSous(s.terrain, b0);
  const retirer = () => {
    builders.forEach((b, i) => b.rollback(marks[i]!));
    c.affiches.pos.length = aff;
    c.affiches.uv.length = affUv;
  };
  if (hi - lo > ENFOUI_MAX || !planLibre(s.world, b0, marge)) {
    retirer();
    return false;
  }
  const dy = lo - b0.y0;
  if (Math.abs(dy) > 1e-6) {
    builders.forEach((b, i) => {
      for (let k = marks[i]!.pos + 1; k < b.pos.length; k += 3) b.pos[k]! += dy;
      for (let k = marks[i]!.halos; k < b.halos.length; k++) b.halos[k]!.y += dy;
    });
    for (let k = aff + 1; k < c.affiches.pos.length; k += 3) c.affiches.pos[k]! += dy;
  }
  s.log?.push({ kind, part: "pied", appui: auSol ? "sol" : "terrain", group: s.log.group(), block: -1, style }, { ...b0, y0: b0.y0 + dy, y1: b0.y1 + dy }, tris);
  return true;
}

// --- Pièces communes ---------------------------------------------------------------------------------------------------------------

export const BETON = 0xb9bbbe;
export const BOIS = 0x8a5a36;
export const BOIS_CLAIR = 0xb88454;
export const PEAU = [0xf1c27d, 0xc68642, 0x8d5524, 0xe0ac69] as const;
/** Les maillots des spectateurs : vifs, mais **pas d'orange** (lot 43 : l'orange est à la voiture seule). */
export const MAILLOTS = [ROUGE_PISTE, 0x2e7dff, MARQUE.moutarde, 0xf4f4f4, 0x21a35a, 0xc084fc, 0x1f5fbf] as const;
const tirer = <T>(liste: readonly T[], rnd: () => number): T => liste[Math.floor(rnd() * liste.length)]!;

export const versRoute = (p: PlaceDecor) => Math.atan2(p.versRoute[0], p.versRoute[1]);

/** Une pile de `n` pneus (prismes à six pans), le haut peint en `haut`. */
export function pneus(g: Builder, x: number, y: number, z: number, n: number, haut = CAOUTCHOUC, r = 0.42) {
  for (let i = 0; i < n; i++) g.prism(x, y + i * 0.3, z, r, r * 0.92, 0.29, 6, i === n - 1 ? haut : CAOUTCHOUC, i === n - 1 ? haut : CAOUTCHOUC, i * 0.4);
}

/** Un mât et son drapeau, tourné vers `a`. */
export function drapeau(g: Builder, x: number, y: number, z: number, h: number, couleur: number, a: number) {
  g.box(x - 0.05, y, z - 0.05, x + 0.05, y + h, z + 0.05, METAL);
  const f: V3 = [Math.cos(a), 0, Math.sin(a)];
  const P = (d: number, hh: number, w: number): V3 => [x + f[0] * d, y + h - hh + w, z + f[2] * d];
  g.quad(P(0.05, 0.1, 0), P(0.9, 0.2, 0.05), P(0.9, 1.1, 0.05), P(0.05, 1.1, 0), couleur);
  g.quad(P(0.9, 0.2, 0.05), P(1.7, 0.1, 0), P(1.7, 1.0, 0), P(0.9, 1.1, 0.05), shade(couleur, 0.85));
}

/** Panneau publicitaire sur deux pieds, un sponsor fictif du thème sur les deux faces (l'atlas des sponsors du jeu). */
export function panneauPub(c: CalquesDecor, x: Contexte, r: Repere, w: number, h: number, rnd: () => number, haut = 0.6) {
  const logo = rectSponsor(tirer(sponsorsDuTheme(x.palette), rnd));
  for (const s of [-1, 1]) boite(c.decor, r, s * (w - 0.3) - 0.07, s * (w - 0.3) + 0.07, 0, haut + 0.2, -0.07, 0.07, METAL_SOMBRE);
  boite(c.decor, r, -w - 0.08, w + 0.08, haut - 0.08, haut + h + 0.08, -0.12, 0.12, METAL_SOMBRE);
  c.affiches.face(r, -w, w, haut, haut + h, -0.13, logo);
  c.affiches.quad(pt(r, -w, haut, 0.13), pt(r, w, haut, 0.13), pt(r, w, haut + h, 0.13), pt(r, -w, haut + h, 0.13), logo);
}

/** Une rangée de spectateurs (deux boîtes chacun : corps de couleur, tête), sur une estrade basse. */
export function foule(g: Builder, r: Repere, n: number, largeur: number, rnd: () => number, estrade = true) {
  if (estrade) boite(g, r, -largeur / 2 - 0.3, largeur / 2 + 0.3, 0, 0.4, -0.8, 0.8, BOIS_CLAIR);
  for (let i = 0; i < n; i++) {
    const gx = -largeur / 2 + (i + 0.5) * (largeur / n) + (rnd() - 0.5) * 0.3;
    const a = (rnd() - 0.5) * 0.6;
    const h = estrade ? 0.4 : 0;
    const t = 1.5 + rnd() * 0.25;
    boite(g, r, gx - 0.22, gx + 0.22, h, h + t - 0.35, a - 0.14, a + 0.14, tirer(MAILLOTS, rnd));
    boite(g, r, gx - 0.13, gx + 0.13, h + t - 0.33, h + t, a - 0.12, a + 0.12, tirer(PEAU, rnd));
  }
}

/** Une camionnette d'assistance. */
export function camionnette(g: Builder, r: Repere, couleur: number) {
  boiteChanfreinee(g, r, -1.1, 1.1, 0.5, 2.6, -2.6, 1.2, 0.15, couleur);
  boiteChanfreinee(g, r, -1.05, 1.05, 0.5, 2.0, 1.2, 2.6, 0.25, couleur);
  boite(g, r, -0.95, 0.95, 1.35, 1.9, 2.6, 2.62, 0x22303f);
  for (const [gg, aa] of [[-1.1, -1.8], [1.1, -1.8], [-1.1, 1.8], [1.1, 1.8]] as const) tube(g, pt(r, gg - 0.15 * Math.sign(gg), 0.42, aa), pt(r, gg + 0.12 * Math.sign(gg), 0.42, aa), 0.42, 6, CAOUTCHOUC);
}

/** Un sapin à étages, sommet enneigé (ou non : `neige` = null). */
export function sapin(g: Builder, x: number, y: number, z: number, h: number, vert: number, neige: number | null, etages = 3) {
  g.box(x - 0.2, y, z - 0.2, x + 0.2, y + h * 0.2, z + 0.2, 0x5b3d26);
  for (let t = 0; t < etages; t++) {
    const f = t / etages;
    g.prism(x, y + h * (0.14 + f * 0.26), z, (2.0 - f * 1.2) * (h / 8), 0.05, h * 0.38, 6, shade(vert, 1 - f * 0.08), neige ?? shade(vert, 1.2), t * 0.4);
  }
}

/** Un cactus à bras. */
export function cactus(g: Builder, x: number, y: number, z: number, h: number, rnd: () => number) {
  const v = mix(0x3f7a38, 0x5a9a48, rnd());
  g.prism(x, y, z, 0.4, 0.3, h, 6, v, shade(v, 1.15));
  for (const s of [-1, 1]) {
    if (rnd() < 0.25) continue;
    const ay = y + h * (0.3 + rnd() * 0.3);
    g.box(x + s * 0.3 - 0.2, ay, z - 0.2, x + s * 1.0 + 0.2, ay + 0.36, z + 0.2, v);
    g.prism(x + s * 1.0, ay + 0.1, z, 0.24, 0.2, 1 + rnd(), 6, v, shade(v, 1.15));
  }
}

/** Un rocher et son éclat. */
export function rocher(g: Builder, x: number, y: number, z: number, r: number, couleur: number, rnd: () => number) {
  g.prism(x, y, z, r, r * 0.6, r * 0.7, 6, couleur, shade(couleur, 1.12), rnd() * 3);
  g.prism(x + r * 0.5, y, z + r * 0.3, r * 0.5, r * 0.3, r * 0.5, 5, shade(couleur, 0.9), couleur, rnd() * 3);
}

/** Un lampadaire de rue : un socle, un mât, une crosse et sa lampe (lumineuse, un halo). */
export function lampadaire(c: CalquesDecor, r: Repere, h: number, lumiere: number) {
  boite(c.decor, r, -0.3, 0.3, 0, 0.5, -0.3, 0.3, BETON);
  tube(c.decor, pt(r, 0, 0.5, 0), pt(r, 0, h, 0), 0.1, 5, METAL_SOMBRE, 0.07);
  tube(c.decor, pt(r, 0, h, 0), pt(r, 0, h + 0.3, 1.4), 0.06, 4, METAL_SOMBRE);
  boite(c.decor, r, -0.28, 0.28, h, h + 0.35, 1.1, 1.9, METAL_SOMBRE);
  boite(c.decorLumineux, r, -0.22, 0.22, h - 0.02, h + 0.02, 1.2, 1.8, lumiere);
  c.decorLumineux.halo(...pt(r, 0, h - 0.1, 1.5), lumiere, 6);
}

// --- La tribune du départ ------------------------------------------------------------------------------------------------------------

/** Rapport largeur / hauteur du ruban des écrans (`vie.ts`) : pour qu'un écran de L × H m garde ses lettres droites, u va de 0 à (L / H) / RAPPORT. */
export const RUBAN_RAPPORT = 16;

/**
 * La tribune du départ (celle de B) : gradins, toit sur poteaux, sponsors, **socle plein jusqu'au sol lointain**. Du côté opposé au premier virage, sinon de
 * l'autre (une suite à part), sinon nulle part : elle ne touche jamais la route (lot 37). Les spectateurs sont tirés **de la même façon** à tous les paliers ; ils
 * sont dessinés dans le décor, ou confiés à la foule animée (palier 3, `foule`). Palier 2 : des drapeaux sur le toit ; palier 3 : un ruban d'écrans.
 */
export function tribune(s: Sol, c: CalquesDecor, x: Contexte, rnd: () => number) {
  const b = x.track.blocks[0]!;
  const premier = turnsLeft(x.track.blocks.find((o) => o.kind !== "straight")?.kind ?? "straight") ? -1 : 1;
  for (const [cote, suite] of [[premier, rnd], [-premier as 1 | -1, seeded(`${x.track.id}:tribune`)]] as const) {
    const m = c.decor.mark();
    const aff = c.affiches.pos.length;
    const affUv = c.affiches.uv.length;
    const foule0 = c.foule?.length ?? 0;
    const r = construireTribune(c, x, b, suite, cote);
    const box = c.decor.boxSince(m);
    if (!box) return; // muet (miniature hors du cadre)
    if (planLibre(s.world, box, MARGE_DECOR)) {
      s.log?.push({ kind: "tribune", part: "pied", appui: "sol", group: s.log.group(), block: -1, style: "" }, box, (c.decor.pos.length - m.pos) / 9);
      ornerTribune(c, x, r);
      return;
    }
    c.decor.rollback(m);
    c.affiches.pos.length = aff;
    c.affiches.uv.length = affUv;
    if (c.foule) c.foule.length = foule0;
  }
}

function construireTribune(c: CalquesDecor, x: Contexte, b: Block, rnd: () => number, cote: 1 | -1): Repere {
  const hw = blockHalfWidth(b, CELL / 2);
  const r0 = repereBloc(b, 16, cote * (hw + 4.2));
  // De l'autre côté, le repère est retourné : la tribune regarde toujours la route.
  const r: Repere = cote > 0 ? r0 : { o: r0.o, f: [-r0.f[0], 0, -r0.f[2]], l: [-r0.l[0], 0, -r0.l[2]] };
  boite(c.decor, r, 0, 8.5, x.floorY - r.o[1], 0.2, -11, 11, BETON);
  for (let i = 0; i < 3; i++) {
    const g0 = i * 2.4;
    boite(c.decor, r, g0, 8.5, 0, 1 + i * 1.2, -11, 11, shade(BETON, 1 - i * 0.04));
    for (let a = -10.5; a < 10.5; a += 0.75) {
      if (rnd() < 0.15) continue;
      // Un spectateur tourné vers la piste : léger décalage, taille, maillot, peau (cinq tirages).
      const rr: Repere = { o: pt(r, g0 + 1.2, 1 + i * 1.2, a), f: [-r.l[0], 0, -r.l[2]], l: r.f };
      const gx = (rnd() - 0.5) * 0.3;
      const da = (rnd() - 0.5) * 0.6;
      const t = 1.5 + rnd() * 0.25;
      const maillot = tirer(MAILLOTS, rnd);
      const peau = tirer(PEAU, rnd);
      if (c.foule) {
        const p = pt(rr, gx, 0, da);
        c.foule.push({ x: p[0], y: p[1], z: p[2], cap: Math.atan2(rr.f[0], rr.f[2]), couleur: maillot });
      } else {
        boite(c.decor, rr, gx - 0.22, gx + 0.22, 0, t - 0.35, da - 0.14, da + 0.14, maillot);
        boite(c.decor, rr, gx - 0.13, gx + 0.13, t - 0.33, t, da - 0.12, da + 0.12, peau);
      }
    }
  }
  for (const a of [-10.6, 0, 10.6]) boite(c.decor, r, 8.05, 8.35, 0, 7.6, a - 0.15, a + 0.15, METAL_SOMBRE);
  boiteChanfreinee(c.decor, r, -0.8, 8.6, 7.6, 8.0, -11.4, 11.4, 0.1, MARQUE.encre, MARQUE.creme);
  const logos = sponsorsDuTheme(x.palette);
  for (let i = 0; i < 4; i++) c.affiches.quad(pt(r, -0.85, 7.6, -11 + i * 5.5), pt(r, -0.85, 7.6, -11 + (i + 1) * 5.5 - 0.3), pt(r, -0.85, 8.0, -11 + (i + 1) * 5.5 - 0.3), pt(r, -0.85, 8.0, -11 + i * 5.5), rectSponsor(logos[i % logos.length]!));
  return r;
}

/** Les drapeaux du toit (palier 2) et le ruban d'écrans du devant (palier 3) d'une tribune posée : la vitrine seulement. */
function ornerTribune(c: CalquesDecor, x: Contexte, r: Repere) {
  if (c.drapeaux) {
    for (const a of [-10.6, 0, 10.6]) {
      const haut = pt(r, 8.2, 8.0, a);
      c.decor.box(haut[0] - 0.04, haut[1], haut[2] - 0.04, haut[0] + 0.04, haut[1] + 2.4, haut[2] + 0.04, METAL);
      c.drapeaux.drapeau([haut[0], haut[1] + 2.35, haut[2]], VENT, 1.4, 0.9, [a === 0 ? ROUGE_PISTE : 0x2e7dff, 0xf4f4f4], a * 0.7);
    }
  }
  if (x.reglages?.ecrans && c.ecrans) c.ecrans.quad(pt(r, -0.03, 0.2, -10.5), pt(r, -0.03, 0.2, 10.5), pt(r, -0.03, 0.95, 10.5), pt(r, -0.03, 0.95, -10.5), [0, 0, 21 / 0.75 / RUBAN_RAPPORT, 1]);
}

/** Les panneaux à diodes le long de la ligne droite du départ, posés sur les rebords (palier 3, pas « écrans ») : la vitrine seulement. */
function ecransDuDepart(c: CalquesDecor, x: Contexte) {
  const b = x.track.blocks[0]!;
  if (!c.ecrans || !c.solide || b.open) return;
  const rail = x.pal.wallHeight ?? WALL_HEIGHT;
  for (const side of [-1, 1]) {
    const hw = blockHalfWidth(b, CELL / 2);
    const p0 = onBlock(b, side * (hw + 0.2), 0.12, rail + 0.05);
    const p1 = onBlock(b, side * (hw + 0.2), 0.62, rail + 0.05);
    const L = Math.hypot(p1[0] - p0[0], p1[2] - p0[2]);
    const H = 0.8;
    // Le texte se lit dans le sens de la course : à gauche il avance vers l'avant, à droite vers l'arrière (on le regarde en tournant la tête).
    const [a, d] = side > 0 ? [p0, p1] : [p1, p0];
    c.ecrans.quad(a, d, [d[0], d[1] + H, d[2]], [a[0], a[1] + H, a[2]], [0, 0, L / H / RUBAN_RAPPORT, 1]);
    c.solide.box(Math.min(p0[0], p1[0]) - 0.05, p0[1] - 0.05, Math.min(p0[2], p1[2]) - 0.05, Math.max(p0[0], p1[0]) + 0.05, p0[1], Math.max(p0[2], p1[2]) + 0.05, METAL_SOMBRE);
  }
}

// --- L'assemblage ----------------------------------------------------------------------------------------------------------------------

/**
 * Le décor d'un circuit, dans les calques donnés : le sol relevé (dans `decor`), la tribune du départ, les recettes du thème (un ou deux éléments par cellule
 * voisine de la piste, un ou deux plus loin), et à la qualité 2 le remplissage du thème (`dense`, une autre suite de nombres). Graine : `${id}:${palette}` (comme le
 * décor d'avant), `…:dense`. `near` (miniatures) : seules les cellules du cadre sont construites, tous les tirages sont faits (le même décor que dans le jeu).
 */
export function construireDecor(t: DecorTheme, c: CalquesDecor, x: Contexte, near?: (cx: number, cz: number) => boolean): Terrain {
  const terrain = terrainDe(x.track, x.floorY);
  const s: Sol = { terrain, world: trackWorld(x.track), ...(x.log ? { log: x.log } : {}) };
  const muet = (cx: number, cz: number) => {
    c.decor.mute = c.decorLumineux.mute = c.dense.mute = !!near && !near(cx, cz);
  };
  // Le sol relevé : les couleurs du sol lointain du thème, un ton plus sombres (on le voit en pente).
  const [a, b] = THEMES_C[x.palette].sol;
  terrain.construire(c.decor, [shade(parseInt(a.slice(1), 16), 0.94), shade(parseInt(b.slice(1), 16), 0.94)], near);
  const rnd = seeded(`${x.track.id}:${x.palette}`);
  const b0 = x.track.blocks[0]!;
  muet(b0.cx, b0.cz);
  tribune(s, c, x, rnd);
  if (x.reglages?.ecrans) ecransDuDepart(c, x);
  const proche = t.proche ?? 0.5;
  for (const p of placesDeDecor(x.track, rnd, (anneau) => (anneau === 1 ? (rnd() < 0.85 ? 1 : 0) + (rnd() < proche ? 1 : 0) : 1 + (rnd() < 0.6 ? 1 : 0)), 2, terrain)) {
    muet(p.cx, p.cz);
    const v = x.varierDecor?.marque(c);
    if (poserSurTerrain(s, c, "decor", x.palette, () => t.recette(c, x, p, rnd)) && v !== undefined) x.varierDecor!.varier(c, v, p.x, p.y, p.z);
  }
  c.decor.mute = c.decorLumineux.mute = c.dense.mute = false;
  t.plus?.(s, c, x, near);
  // Le remplissage (qualité 2) : un élément simple par cellule de l'anneau 3, sur la pente du talus ; une autre suite.
  const dense = seeded(`${x.track.id}:${x.palette}:dense`);
  const calquesDenses: CalquesDecor = { ...c, decor: c.dense };
  for (const p of placesDeDecor(x.track, dense, (anneau) => (anneau === 3 ? 1 : 0), 3, terrain)) {
    muet(p.cx, p.cz);
    poserSurTerrain(s, calquesDenses, "decor", x.palette, () => t.remplissage(c.dense, x, p, dense));
  }
  c.decor.mute = c.decorLumineux.mute = c.dense.mute = false;
  return terrain;
}

/** Le module d'un thème : ses recettes, assemblées par `construireDecor`. */
export function moduleDecor(t: DecorTheme): ModuleDecor {
  return { theme: t, construire: (c, x, near) => construireDecor(t, c, x, near), grain, sol: (palette) => texturedSol(SOLS_C[palette], THEMES_C[palette].sol[0], THEMES_C[palette].sol[1]), uvMonde };
}
