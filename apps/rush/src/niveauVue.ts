import { BoxGeometry, BufferAttribute, BufferGeometry, ConeGeometry, Color, CylinderGeometry, Group, Mesh, MeshBasicMaterial, SphereGeometry, Vector3, type MeshToonMaterial, type Texture } from "three";
import { CASE, MUR, PONT, SOL, VIDE, Z_ARENE, Z_CHEMIN, Z_PORTE, type Niveau } from "@cdj/rush-sim/niveau";
import { M, RAYON_ARENE } from "@cdj/rush-sim/constantes";
import { piece, plat } from "./cel";
import { monterDecor, nuages, type Decor } from "./decor";
import { aleatoire, bloc, colorier, fusionner, placer, roche, teindre } from "./formes";
import { PALETTES, type PaletteMonde } from "./palette";

// Le décor du NIVEAU (lot BR1), construit à partir de la grille de la simulation, **en mètres** (x = unités / 4 096, z = y / 4 096, le sol à y = 0). **DA figée jusqu'à BR-A : des formes simples, dans le style actuel ; seule la lisibilité compte.**
// Regroupé par MORCEAUX de 16 × 16 cases (32 m) : par morceau, un maillage de SOL (dalles, falaise, gros blocs rocheux dessous : l'île flotte) et un maillage de RELIEF (murs bas, décor du thème, ponts) — jamais un maillage par case, chacun
// d'un seul appel de dessin, coupé hors du champ par le moteur. Seul le relief projette une ombre. L'arène du golem est le décor du prototype (plateau, muret OUVERT à l'entrée, île) posé à son centre.
// Le relief s'efface par TRAMAGE (un motif de Bayer) là où il est entre la caméra et le chevalier : aucun mur, aucun arbre ne le cache.

/** Le côté d'un morceau, en cases. */
export const PAS_MORCEAU = 16;
const CM = CASE / M; // la case, en mètres (2)
/** Les murs bas ne dépassent jamais cette hauteur (mètres) : on voit par-dessus. */
export const MUR_MAX = 1.3;
const EPAISSEUR = 1.6;

export type ThemeVu = "prairie" | "carriere" | "sous-bois";

const hash = (i: number, j: number, graine = 0): number => {
  let h = Math.imul((i * 73856093) ^ (j * 19349663) ^ (graine * 83492791), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};

/** Le thème d'une palette (par identité) ; la prairie à défaut. */
export function themeDe(a: PaletteMonde): ThemeVu {
  for (const k of Object.keys(PALETTES)) if (PALETTES[k] === a) return k as ThemeVu;
  return "prairie";
}

// --- Les modèles (un petit nombre de variantes par thème, copiés et posés par case) ----------------------------------------------------------------------------------------------------------------
const FLEUR = [0xff7a8a, 0xffd447, 0xffffff];
const CRISTAL = [0x8fd0ff, 0xc9a0ff];
const CHAMPIGNON = { chapeau: 0xd8473a, pied: 0xf2ead8 };

interface Modeles {
  /** Le mur bas : quelques variantes (hauteur ≤ MUR_MAX). */
  murs: BufferGeometry[];
  /** Le décor posé sur un mur, de la plus rare à la plus fréquente : [probabilité cumulée, variantes, haut du mur en mètres où le poser]. */
  decors: { jusqua: number; formes: BufferGeometry[]; haut: boolean }[];
}

const cone = (r: number, h: number, seg: number, p: { x?: number; y?: number; z?: number; rx?: number; rz?: number }, c: number): BufferGeometry => teindre(placer(new ConeGeometry(r, h, seg), { ...p, y: (p.y ?? 0) + h / 2 }), c);
const sph = (r: number, p: { x?: number; y?: number; z?: number; s?: [number, number, number] }, c: number): BufferGeometry => teindre(placer(new SphereGeometry(r, 7, 5), p), c);
const cyl = (r0: number, r1: number, h: number, p: { x?: number; y?: number; z?: number }, c: number): BufferGeometry => teindre(placer(new CylinderGeometry(r1, r0, h, 7), { ...p, y: (p.y ?? 0) + h / 2 }), c);

function modeles(theme: ThemeVu, a: PaletteMonde): Modeles {
  const rnd = aleatoire(theme.length * 101);
  const variantes = (n: number, f: (k: number) => BufferGeometry): BufferGeometry[] => Array.from({ length: n }, (_, k) => f(k));
  if (theme === "carriere") {
    return {
      // des rochers : des blocs de pierre irréguliers, un peu étirés
      murs: variantes(6, (k) => colorier(roche(1.0 + rnd() * 0.15, 400 + k, { detail: 1, bruit: 0.22, etire: [1, 0.55 + rnd() * 0.25, 1] }), [a.mur, a.murHaut, a.mur], 40 + k)),
      decors: [
        { jusqua: 0.16, haut: true, formes: variantes(3, (k) => fusionner([cone(0.16, 0.9 + k * 0.25, 5, { x: 0, z: 0 }, CRISTAL[k % 2]!), cone(0.12, 0.6, 5, { x: 0.28, z: 0.1, rz: -0.25 }, CRISTAL[(k + 1) % 2]!), cone(0.1, 0.5, 5, { x: -0.25, z: -0.12, rz: 0.3 }, CRISTAL[k % 2]!)])) },
        { jusqua: 0.28, haut: false, formes: variantes(2, (k) => fusionner([teindre(placer(new BoxGeometry(0.9, 0.7, 0.9), { y: 0.35, ry: 0.3 * k }), a.bois), teindre(placer(new BoxGeometry(0.62, 0.5, 0.62), { y: 0.95, ry: 0.5 + k, x: 0.05 }), a.bois2)])) },
      ],
    };
  }
  const sombre = theme === "sous-bois";
  const murs = variantes(6, (k) => bloc(1.7 + rnd() * 0.2, 0.85 + rnd() * 0.35, 1.7 + rnd() * 0.2, { couleur: a.mur, dessus: a.murHaut, variation: 0.14, graine: 300 + k, rayon: 0.55, irregulier: 0.14, segments: 1 }));
  if (theme === "prairie") {
    return {
      murs,
      decors: [
        // un arbre : un tronc et une boule de feuilles
        { jusqua: 0.1, haut: false, formes: variantes(3, (k) => fusionner([cyl(0.28, 0.2, 1.7 + k * 0.2, {}, a.bois2), sph(1.45 + k * 0.15, { y: 2.9 + k * 0.2, s: [1, 0.9, 1] }, a.herbe2), sph(0.95, { x: 0.7, y: 3.4, z: 0.2 }, a.herbe)])) },
        // des fleurs sur la haie
        { jusqua: 0.28, haut: true, formes: variantes(3, (k) => fusionner([sph(0.13, { x: 0.3, z: 0.2 }, FLEUR[k % 3]!), sph(0.13, { x: -0.3, z: 0.3, y: 0.1 }, FLEUR[(k + 1) % 3]!), sph(0.13, { x: 0.05, z: -0.35 }, FLEUR[(k + 2) % 3]!), sph(0.13, { x: -0.4, z: -0.2, y: 0.05 }, FLEUR[k % 3]!)])) },
        // des touffes d'herbe
        { jusqua: 0.55, haut: true, formes: variantes(3, (k) => fusionner([cone(0.1, 0.55, 4, { x: 0.2, z: 0.1, rz: 0.2 }, k % 2 ? a.herbe : a.herbe2), cone(0.1, 0.6, 4, { x: -0.15, z: 0.2, rx: 0.2 }, a.herbe2), cone(0.1, 0.5, 4, { x: 0.0, z: -0.25, rz: -0.2 }, a.herbe)])) },
      ],
    };
  }
  return {
    murs,
    decors: [
      // un sapin : trois étages de cônes sur un tronc
      { jusqua: 0.14, haut: false, formes: variantes(3, (k) => fusionner([cyl(0.25, 0.2, 1.1, {}, a.bois2), cone(1.35 + k * 0.1, 1.9, 7, { y: 0.9 }, a.herbe2), cone(1.0 + k * 0.1, 1.7, 7, { y: 2.1 }, a.herbe), cone(0.65, 1.5, 7, { y: 3.2 }, a.herbe2)])) },
      // des champignons sur la haie
      { jusqua: 0.32, haut: true, formes: variantes(2, (k) => fusionner([cyl(0.09, 0.08, 0.35, { x: 0.25 }, CHAMPIGNON.pied), sph(0.24, { x: 0.25, y: 0.38, s: [1, 0.55, 1] }, CHAMPIGNON.chapeau), cyl(0.07, 0.06, 0.25, { x: -0.3, z: 0.25 }, CHAMPIGNON.pied), sph(0.17, { x: -0.3, y: 0.27, z: 0.25, s: [1, 0.55, 1] }, k ? 0xe6a23a : CHAMPIGNON.chapeau)])) },
      // des souches
      { jusqua: sombre ? 0.44 : 0.4, haut: false, formes: variantes(2, (k) => fusionner([cyl(0.5 + k * 0.1, 0.42, 0.55, {}, a.bois2), teindre(placer(new CylinderGeometry(0.42, 0.42, 0.04, 8), { y: 0.57 }), a.bois)])) },
    ],
  };
}

// --- Les morceaux (sans navigateur : de la géométrie) --------------------------------------------------------------------------------------------------------------------------------------------------
export interface Morceau {
  ci: number;
  cj: number;
  sol: BufferGeometry | null;
  relief: BufferGeometry | null;
}
export interface Construit {
  morceaux: Morceau[];
  /** Les nuages (zone en mètres). */
  etendue: { x0: number; x1: number; z0: number; z1: number };
  /** Les cases de mur qui portent un décor et ce qu'il y a d'éléments posés sur une case marchable (doit être 0). */
  stats: { murs: number; decors: number; ponts: number; decorsSurSol: number };
}

function geometrie(positions: number[], couleurs: number[], normales: number[]): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  g.setAttribute("normal", new BufferAttribute(new Float32Array(normales), 3));
  g.setAttribute("color", new BufferAttribute(new Float32Array(couleurs), 3));
  return g;
}

/** Le décor de toutes les cases, par morceaux. */
export function construireNiveau(n: Niveau, a: PaletteMonde, theme: ThemeVu = themeDe(a)): Construit {
  const ox = n.ox / M;
  const oy = n.oy / M;
  const cSol = [new Color(a.sol), new Color(a.sol2)];
  const cTranche = new Color(a.tranche);
  const cRoche = [new Color(a.falaise), new Color(a.falaise2)];
  const cBois = [new Color(a.bois), new Color(a.bois2)];
  const zone = (i: number, j: number): number => (i < 0 || j < 0 || i >= n.l || j >= n.h ? 0 : n.zones[j * n.l + i]!);
  const type = (i: number, j: number): number => (i < 0 || j < 0 || i >= n.l || j >= n.h ? VIDE : n.cases[j * n.l + i]!);
  const marchable = (i: number, j: number): boolean => type(i, j) === SOL || type(i, j) === PONT;
  const voisin8 = (i: number, j: number, z: readonly number[]): boolean => {
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if ((di || dj) && z.includes(zone(i + di, j + dj))) return true;
    return false;
  };
  const mod = modeles(theme, a);
  const nx = Math.ceil(n.l / PAS_MORCEAU);
  const ny = Math.ceil(n.h / PAS_MORCEAU);
  interface Tas {
    pos: number[];
    col: number[];
    nor: number[];
    sous: BufferGeometry[];
    relief: BufferGeometry[];
  }
  const tas: Tas[] = Array.from({ length: nx * ny }, () => ({ pos: [], col: [], nor: [], sous: [], relief: [] }));
  const dans = (x: number, z: number): Tas => tas[Math.min(ny - 1, Math.max(0, Math.floor((z - oy) / CM / PAS_MORCEAU))) * nx + Math.min(nx - 1, Math.max(0, Math.floor((x - ox) / CM / PAS_MORCEAU)))]!;
  const stats = { murs: 0, decors: 0, ponts: 0, decorsSurSol: 0 };
  const copie = (g: BufferGeometry, pose: Parameters<typeof placer>[1]): BufferGeometry => placer(g.clone(), pose);

  for (let j = 0; j < n.h; j++) {
    for (let i = 0; i < n.l; i++) {
      const t = type(i, j);
      const z = zone(i, j);
      const x0 = ox + i * CM;
      const z0 = oy + j * CM;
      const x1 = x0 + CM;
      const z1 = z0 + CM;
      const cx = x0 + CM / 2;
      const cz = z0 + CM / 2;
      const T = tas[Math.floor(j / PAS_MORCEAU) * nx + Math.floor(i / PAS_MORCEAU)]!;
      const quad = (p: number[][], nxx: number, nyy: number, nzz: number, c: Color): void => {
        for (const k of [0, 1, 2, 0, 2, 3]) {
          T.pos.push(...p[k]!);
          T.nor.push(nxx, nyy, nzz);
          T.col.push(c.r, c.g, c.b);
        }
      };
      const flancs = (couleur: Color, ouvert: (di: number, dj: number) => boolean): void => {
        if (ouvert(0, -1)) quad([[x0, 0, z0], [x1, 0, z0], [x1, -EPAISSEUR, z0], [x0, -EPAISSEUR, z0]], 0, 0, -1, couleur);
        if (ouvert(0, 1)) quad([[x1, 0, z1], [x0, 0, z1], [x0, -EPAISSEUR, z1], [x1, -EPAISSEUR, z1]], 0, 0, 1, couleur);
        if (ouvert(-1, 0)) quad([[x0, 0, z1], [x0, 0, z0], [x0, -EPAISSEUR, z0], [x0, -EPAISSEUR, z1]], -1, 0, 0, couleur);
        if (ouvert(1, 0)) quad([[x1, 0, z0], [x1, 0, z1], [x1, -EPAISSEUR, z1], [x1, -EPAISSEUR, z0]], 1, 0, 0, couleur);
      };
      if (t === SOL) {
        // Le plateau de l'arène est dessiné par `monterDecor` ; ses cases ne le sont que là où elles touchent le chemin (pas de trou entre le plateau et le chemin qui y entre).
        if (z === Z_ARENE && !voisin8(i, j, [Z_CHEMIN, Z_PORTE])) continue;
        const c = cSol[(i + j) % 2]!.clone().multiplyScalar(0.96 + hash(i, j) * 0.08);
        quad([[x0, 0, z1], [x1, 0, z1], [x1, 0, z0], [x0, 0, z0]], 0, 1, 0, c);
        flancs(cTranche, (di, dj) => type(i + di, j + dj) === VIDE);
      } else if (t === MUR) {
        // Sous un mur bas : un pan de roche (le mur ne flotte pas au-dessus du vide).
        if (!voisin8(i, j, [Z_ARENE]) || voisin8(i, j, [Z_CHEMIN, Z_PORTE])) {
          flancs(cTranche, (di, dj) => type(i + di, j + dj) === VIDE);
          stats.murs++;
          const h = hash(i, j, 5);
          const v = Math.floor(hash(i, j, 6) * mod.murs.length);
          const mur = copie(mod.murs[v]!, { x: cx, y: theme === "carriere" ? 0.3 : 0.5, z: cz, ry: hash(i, j, 7) * 6.28, s: [0.95 + hash(i, j, 8) * 0.15, 1, 0.95 + hash(i, j, 9) * 0.15] });
          T.relief.push(mur);
          const hMur = Math.min(MUR_MAX, theme === "carriere" ? 0.9 : 1.05);
          // le décor du thème : posé SUR un mur (jamais sur une case marchable)
          for (const d of mod.decors) {
            if (h >= d.jusqua) continue;
            const f = d.formes[Math.floor(hash(i, j, 11) * d.formes.length)]!;
            T.relief.push(copie(f, { x: cx + (hash(i, j, 12) - 0.5) * 0.5, y: d.haut ? hMur - 0.1 : -0.05, z: cz + (hash(i, j, 13) - 0.5) * 0.5, ry: hash(i, j, 14) * 6.28 }));
            stats.decors++;
            break;
          }
        }
      } else if (t === PONT) {
        stats.ponts++;
        // Un pont : des planches en travers, des poteaux de rambarde du côté du vide, un pilier de temps en temps.
        const dX = marchable(i - 1, j) || marchable(i + 1, j); // le pont court selon x
        const dZ = marchable(i, j - 1) || marchable(i, j + 1);
        const alongX = dX && !(dZ && !dX);
        const planches: BufferGeometry[] = [];
        for (let k = 0; k < 4; k++) {
          const o = -0.75 + k * 0.5;
          planches.push(teindre(placer(new BoxGeometry(alongX ? 0.42 : CM - 0.06, 0.12, alongX ? CM - 0.06 : 0.42), { x: cx + (alongX ? o : 0), y: -0.06, z: cz + (alongX ? 0 : o) }), cBois[(k + i + j) % 2]!.getHex()));
        }
        T.relief.push(...planches);
        for (const s of [-1, 1]) {
          const di = alongX ? 0 : s;
          const dj = alongX ? s : 0;
          if (type(i + di, j + dj) !== VIDE) continue;
          const px = cx + di * (CM / 2 - 0.1);
          const pz = cz + dj * (CM / 2 - 0.1);
          T.relief.push(teindre(placer(new BoxGeometry(0.14, 0.85, 0.14), { x: px, y: 0.36, z: pz }), a.bois2));
          T.relief.push(teindre(placer(new BoxGeometry(alongX ? CM : 0.08, 0.08, alongX ? 0.08 : CM), { x: px, y: 0.78, z: pz }), a.bois));
        }
        if ((i + j) % 3 === 0) T.relief.push(teindre(placer(new BoxGeometry(0.3, 5, 0.3), { x: cx, y: -2.6, z: cz }), a.bois2));
      }
    }
  }

  // Sous chaque clairière : de gros blocs rocheux qui rétrécissent vers le bas (l'île flotte) ; sous un chemin, de petits blocs tous les ~9 m.
  const rnd = aleatoire(77);
  const roc = (x: number, z: number, taille: number, creux: number, graine: number): void => {
    const k = 0.8 + rnd() * 0.4;
    dans(x, z).sous.push(placer(bloc(taille * k * 1.3, taille * k * 1.5, taille * k * 1.3, { couleur: cRoche[graine % 2]!.getHex(), dessus: a.falaise2, variation: 0.12, graine, rayon: taille * 0.3, irregulier: 0.1, segments: 1 }), { x, y: -EPAISSEUR - creux - taille * 0.6, z, ry: rnd() * 3 }));
  };
  n.clairieres.forEach((c, ci) => {
    if (c.genre === "arene") return;
    const r = c.r / M;
    const x = c.x / M;
    const z = c.y / M;
    roc(x, z, r * 0.55, 0.0, 600 + ci * 7);
    for (let k = 0; k < 4; k++) {
      const t = ((k + rnd() * 0.6) / 4) * Math.PI * 2;
      roc(x + Math.cos(t) * r * 0.55, z + Math.sin(t) * r * 0.55, r * 0.34, 0.1 + rnd() * 0.5, 610 + ci * 7 + k);
    }
    roc(x + (rnd() - 0.5) * r * 0.4, z + (rnd() - 0.5) * r * 0.4, r * 0.3, r * 0.5, 650 + ci);
  });
  for (const l of n.liens) {
    if (l.pont) continue;
    const A = n.clairieres[l.a]!;
    const B = n.clairieres[l.b]!;
    const L = Math.hypot(B.x - A.x, B.y - A.y) / M;
    for (let s = 6; s < L - 6; s += 9) {
      const u = s / L;
      roc(((A.x + (B.x - A.x) * u) / M), ((A.y + (B.y - A.y) * u) / M), 1.6, 0, 700 + Math.round(s));
    }
  }

  const morceaux: Morceau[] = [];
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  tas.forEach((T, k) => {
    const sol = T.pos.length > 0 || T.sous.length > 0 ? fusionner([...(T.pos.length > 0 ? [geometrie(T.pos, T.col, T.nor)] : []), ...T.sous]) : null;
    const relief = T.relief.length > 0 ? fusionner(T.relief) : null;
    if (!sol && !relief) return;
    const ci = k % nx;
    const cj = Math.floor(k / nx);
    x0 = Math.min(x0, ox + ci * PAS_MORCEAU * CM);
    x1 = Math.max(x1, ox + (ci + 1) * PAS_MORCEAU * CM);
    z0 = Math.min(z0, oy + cj * PAS_MORCEAU * CM);
    z1 = Math.max(z1, oy + (cj + 1) * PAS_MORCEAU * CM);
    morceaux.push({ ci, cj, sol, relief });
  });
  return { morceaux, etendue: { x0, x1, z0, z1 }, stats };
}

// --- Le fondu des éléments entre la caméra et le chevalier (tramage de Bayer) --------------------------------------------------------------------------------------------------------------------------
/** Ce qui s'efface : tout ce qui est à moins de `RAYON_FONDU` mètres du segment caméra → chevalier, et plus près de la caméra que lui. Il reste `OPACITE_FONDU` des pixels (un motif de Bayer 4 × 4). */
export const RAYON_FONDU = 1.7;
export const OPACITE_FONDU = 0.25;

interface UniformsFondu {
  uChev: { value: Vector3 };
  uCam: { value: Vector3 };
}

/** Le matériau du relief : un toon à couleurs par sommet dont le fragment s'efface s'il est entre la caméra et le chevalier. */
function matiereRelief(u: UniformsFondu): MeshToonMaterial {
  const m = plat(0xffffff, true, 0);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uChev = u.uChev;
    sh.uniforms.uCam = u.uCam;
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vMonde;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvMonde = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vMonde; uniform vec3 uChev; uniform vec3 uCam;\nfloat bayer4(vec2 p){ ivec2 q = ivec2(mod(p, 4.0)); int i = q.x + q.y * 4; float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.); return (m[i] + 0.5) / 16.0; }`)
      .replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>
        {
          vec3 ab = uChev - uCam; float L = length(ab); vec3 d = ab / L;
          float s = dot(vMonde - uCam, d);
          float r = length(vMonde - uCam - d * s);
          float proche = 1.0 - smoothstep(L - 1.6, L - 0.6, s);
          float dans = (1.0 - smoothstep(${RAYON_FONDU.toFixed(2)} - 0.5, ${RAYON_FONDU.toFixed(2)}, r)) * proche * step(0.0, s);
          float opacite = mix(1.0, ${OPACITE_FONDU.toFixed(2)}, dans);
          if (opacite < 0.999 && bayer4(floor(gl_FragCoord.xy)) > opacite) discard;
        }`,
      );
  };
  m.customProgramCacheKey = () => "rush-relief-fondu";
  return m;
}

export interface NiveauVu {
  groupe: Group;
  /** La texture du ciel (`scene.background`). */
  ciel: Texture;
  /** À chaque image : le chevalier et la caméra (mètres) pour le fondu des éléments entre eux, et la fermeture de la barrière (0 ouverte, 1 fermée). */
  maj(chevalier: { x: number; z: number }, camera: Vector3, fermeture: number): void;
  detruire(): void;
}

export function monterNiveauVu(n: Niveau, a: PaletteMonde, theme: ThemeVu = themeDe(a)): NiveauVu {
  const groupe = new Group();
  const c = construireNiveau(n, a, theme);
  const uniforms: UniformsFondu = { uChev: { value: new Vector3() }, uCam: { value: new Vector3(0, 100, 100) } };
  const mRelief = matiereRelief(uniforms);
  const mSol = plat(0xffffff, true, 0);
  const geos: BufferGeometry[] = [];
  for (const m of c.morceaux) {
    if (m.sol) {
      geos.push(m.sol);
      const s = new Mesh(m.sol, mSol);
      s.receiveShadow = true;
      groupe.add(s);
    }
    if (m.relief) {
      geos.push(m.relief);
      const p = piece(m.relief, 0xffffff, true, true, mRelief);
      p.corps.castShadow = true;
      p.corps.receiveShadow = true;
      groupe.add(p.groupe);
    }
  }
  // Les nuages lointains : sur toute l'étendue du niveau.
  const marge = 40;
  const gn = nuages(a, { x0: c.etendue.x0 - marge, x1: c.etendue.x1 + marge, z0: c.etendue.z0 - marge, z1: c.etendue.z1 + marge });
  geos.push(gn);
  const nuage = new Mesh(gn, new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.94 }));
  groupe.add(nuage);
  // La barrière de l'arène : une palissade de pieux pointus en travers de la porte, qui sort du sol quand elle se referme.
  const porte = new Group();
  const ax = n.arene.x / M;
  const az = n.arene.y / M;
  const dirA = (n.arene.dir * Math.PI * 2) / 128;
  const R = RAYON_ARENE / M;
  porte.position.set(ax + Math.cos(dirA) * (R + 0.5), 0, az + Math.sin(dirA) * (R + 0.5));
  porte.rotation.y = -dirA;
  const pieux: BufferGeometry[] = [];
  for (let k = 0; k < 8; k++) {
    const h = 3.0 + (k % 2) * 0.5;
    const z = (k - 3.5) * 0.92;
    pieux.push(teindre(placer(new BoxGeometry(0.62, h, 0.62), { x: 0, y: h / 2, z }), k % 2 ? a.bois : a.bois2), teindre(placer(new ConeGeometry(0.44, 0.7, 4), { x: 0, y: h + 0.35, z, ry: Math.PI / 4 }), a.bois2));
  }
  pieux.push(teindre(placer(new BoxGeometry(0.4, 0.3, 7.6), { x: 0.3, y: 1.0 }), a.bois), teindre(placer(new BoxGeometry(0.4, 0.3, 7.6), { x: 0.3, y: 2.1 }), a.bois));
  const gPorte = fusionner(pieux);
  geos.push(gPorte);
  const palissade = piece(gPorte, 0xffffff, true, true, mRelief);
  palissade.corps.castShadow = true;
  porte.add(palissade.groupe);
  porte.visible = false;
  groupe.add(porte);
  // L'arène : plateau, muret OUVERT à l'entrée (l'angle de la porte), île.
  const decor: Decor = monterDecor(R, a, { niveau: true, ouverture: { angle: dirA, largeur: 7.4 } });
  decor.groupe.position.set(ax, 0, az);
  groupe.add(decor.groupe);
  return {
    groupe,
    ciel: decor.ciel,
    maj(chev, cam, fermeture) {
      uniforms.uChev.value.set(chev.x, 0.9, chev.z);
      uniforms.uCam.value.copy(cam);
      porte.visible = fermeture > 0.01;
      porte.scale.y = Math.max(0.01, Math.min(1, fermeture));
    },
    detruire() {
      for (const g of geos) g.dispose();
      mRelief.dispose();
      mSol.dispose();
      decor.detruire();
    },
  };
}

/** Pour les tests : le thème de chaque palette connue. */
export const THEMES_VUS: readonly ThemeVu[] = ["prairie", "carriere", "sous-bois"];
