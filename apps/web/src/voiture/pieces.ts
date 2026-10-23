// Lot 40 — de quoi construire une voiture en **peu de maillages** : des pièces (géométries de three placées, ou triangles écrits à la main)
// fondues en une seule géométrie, chacune avec sa couleur, son opacité, sa rugosité, son métal et son vernis. Un seul matériau les dessine toutes :
// la rugosité, le métal et le vernis passent par sommet (`aPbr`) au lieu d'un matériau par pièce, et ce qui tourne avec la roue (pneu, jante,
// moyeu) est tourné **dans le shader** (`aSpin`, un angle commun aux quatre roues) : une roue complète = un maillage, un appel de rendu (deux avec son
// ombre). Rendu seul : rien ici ne touche à la simulation.
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  MeshDepthMaterial,
  type Material,
  type Matrix4,
} from "three";
import { GLSL_LIVREE_COULEUR, GLSL_LIVREE_PARS, type LivreeNuanceur } from "./nuanceurLivree";

export type V3 = readonly [number, number, number];

/** Ce qu'une pièce porte, sommet par sommet : couleur (linéaire), opacité, rugosité, métal, vernis (facteur de `clearcoat`), tourne avec la roue. */
export interface Fini {
  couleur: Color;
  alpha?: number;
  rugosite?: number;
  metal?: number;
  vernis?: number;
  tourne?: boolean;
  /** Vue de face seulement, dans un matériau à double face (l'envers est écarté dans le shader). */
  recto?: boolean;
  /** Peinte par la livrée (motifs, numéro, joints : dessinés dans le nuanceur en coordonnées de la voiture, lot 40c). */
  livree?: boolean;
  /** Une vitre : teinte sombre et silhouette d'intérieur à peine suggérée (nuanceur de la livrée). */
  vitre?: boolean;
  /** Ombrage lissé (normales moyennées avec les faces voisines proches : `construire(…, lisse)`). */
  lisse?: boolean;
  /** Groupe de lissage (lot 40c) : seules les faces d'un même groupe se moyennent ; 0 (et `lisse` faux) : facettes. `lisse` seul : le groupe 1. */
  groupe?: number;
}

/** Une couleur écrite telle quelle dans le tampon (comme le faisaient les voitures du lot 9 : la valeur hexadécimale lue comme linéaire). */
export const brute = (hex: number): Color =>
  new Color().setRGB(
    ((hex >> 16) & 255) / 255,
    ((hex >> 8) & 255) / 255,
    (hex & 255) / 255,
    "srgb-linear",
  );
/** Une couleur de matériau (sRGB, convertie en linéaire comme `material.color`). */
export const srgb = (hex: number): Color => new Color(hex);

/** Des pièces fondues en une géométrie. */
export class Pieces {
  readonly pos: number[] = [];
  readonly nor: number[] = [];
  readonly col: number[] = [];
  readonly pbr: number[] = [];
  readonly spin: number[] = [];
  readonly recto: number[] = [];
  readonly livree: number[] = [];
  readonly lisses: number[] = [];
  private groupeSuivant = 2;
  /** Un nouveau groupe de lissage (une pièce arrondie qui ne se moyenne pas avec les autres). */
  nouveauGroupe(): number {
    return this.groupeSuivant++;
  }
  /** Nombre de sommets écrits. */
  get sommets(): number {
    return this.pos.length / 3;
  }
  private pousser(f: Fini, n: number) {
    const c = f.couleur;
    for (let i = 0; i < n; i++) {
      this.col.push(c.r, c.g, c.b, f.alpha ?? 1);
      this.pbr.push(f.rugosite ?? 1, f.metal ?? 0, f.vernis ?? 1);
      this.spin.push(f.tourne ? 1 : 0);
      this.recto.push(f.recto ? 1 : 0);
      this.livree.push(f.vitre ? 2 : f.livree ? 1 : 0);
      this.lisses.push(f.groupe ?? (f.lisse ? 1 : 0));
    }
  }
  /** Ajoute une géométrie de three (indexée ou non), transformée par `m`. */
  geometrie(g: BufferGeometry, m: Matrix4 | null, f: Fini): this {
    const geo = (g.index ? g.toNonIndexed() : g.clone()) as BufferGeometry;
    if (m) geo.applyMatrix4(m);
    if (!geo.getAttribute("normal")) geo.computeVertexNormals();
    const p = geo.getAttribute("position");
    const nr = geo.getAttribute("normal");
    for (let i = 0; i < p.count; i++) {
      this.pos.push(p.getX(i), p.getY(i), p.getZ(i));
      this.nor.push(nr.getX(i), nr.getY(i), nr.getZ(i));
    }
    this.pousser(f, p.count);
    geo.dispose();
    return this;
  }
  /** Nombre de triangles. */
  get triangles(): number {
    return this.pos.length / 9;
  }
  /** Un triangle (normale de sa face) ; un triangle plat (aire nulle) n'est pas écrit. */
  tri(a: V3, b: V3, c: V3, f: Fini): this {
    const ux = b[0] - a[0],
      uy = b[1] - a[1],
      uz = b[2] - a[2];
    const vx = c[0] - a[0],
      vy = c[1] - a[1],
      vz = c[2] - a[2];
    let nx = uy * vz - uz * vy,
      ny = uz * vx - ux * vz,
      nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz);
    if (l < 1e-7) return this;
    nx /= l;
    ny /= l;
    nz /= l;
    for (const p of [a, b, c]) {
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(nx, ny, nz);
    }
    this.pousser(f, 3);
    return this;
  }
  quad(a: V3, b: V3, c: V3, d: V3, f: Fini): this {
    return this.tri(a, b, c, f).tri(a, c, d, f);
  }
  /**
   * La géométrie : `alpha` = couleurs à quatre composantes (opacité par sommet, pour un matériau transparent) ; `normales` : d'autres normales
   * que celles des faces (`normalesLissees`).
   */
  construire(alpha = false, normales?: number[]): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(this.pos, 3));
    g.setAttribute(
      "normal",
      new Float32BufferAttribute(normales ?? this.nor, 3),
    );
    const col = alpha ? this.col : this.col.filter((_, i) => i % 4 !== 3);
    g.setAttribute(
      "color",
      new BufferAttribute(new Float32Array(col), alpha ? 4 : 3),
    );
    g.setAttribute("aPbr", new Float32BufferAttribute(this.pbr, 3));
    if (this.spin.some((s) => s > 0))
      g.setAttribute("aSpin", new Float32BufferAttribute(this.spin, 1));
    if (this.recto.some((s) => s > 0))
      g.setAttribute("aRecto", new Float32BufferAttribute(this.recto, 1));
    if (this.livree.some((s) => s > 0)) g.setAttribute("aLivree", new Float32BufferAttribute(this.livree, 1));
    return g;
  }
}

/**
 * Lisse les normales : chaque sommet moyenne les faces de son **groupe** (`Fini.groupe`, ou `lisse` : le groupe 1) qui le partagent et dont l'angle avec
 * la sienne est sous `degres` (une arête plus vive reste vive), pondérées par leur aire. Les faces sans groupe gardent leur facette.
 */
export function normalesLissees(p: Pieces, degres: number): number[] {
  const cos = Math.cos((degres * Math.PI) / 180);
  const P = p.pos;
  const N = p.nor;
  const nt = p.triangles;
  const face: number[] = [];
  const aire: number[] = [];
  for (let t = 0; t < nt; t++) {
    face.push(N[t * 9]!, N[t * 9 + 1]!, N[t * 9 + 2]!);
    const i = t * 9;
    const ux = P[i + 3]! - P[i]!, uy = P[i + 4]! - P[i + 1]!, uz = P[i + 5]! - P[i + 2]!;
    const vx = P[i + 6]! - P[i]!, vy = P[i + 7]! - P[i + 1]!, vz = P[i + 8]! - P[i + 2]!;
    aire.push(Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx));
  }
  const cle = (i: number) => `${p.lisses[i]}:${Math.round(P[i * 3]! * 1e4)},${Math.round(P[i * 3 + 1]! * 1e4)},${Math.round(P[i * 3 + 2]! * 1e4)}`;
  const groupes = new Map<string, number[]>();
  for (let i = 0; i < p.sommets; i++) {
    if (!p.lisses[i]) continue;
    const k = cle(i);
    let g = groupes.get(k);
    if (!g) groupes.set(k, (g = []));
    g.push(i);
  }
  const sortie = N.slice();
  for (const g of groupes.values()) {
    for (const i of g) {
      const ti = Math.floor(i / 3);
      let sx = 0,
        sy = 0,
        sz = 0;
      for (const j of g) {
        const tj = Math.floor(j / 3);
        const d = face[ti * 3]! * face[tj * 3]! + face[ti * 3 + 1]! * face[tj * 3 + 1]! + face[ti * 3 + 2]! * face[tj * 3 + 2]!;
        if (d < cos) continue;
        const w = aire[tj]!;
        sx += face[tj * 3]! * w;
        sy += face[tj * 3 + 1]! * w;
        sz += face[tj * 3 + 2]! * w;
      }
      const l = Math.hypot(sx, sy, sz) || 1;
      sortie[i * 3] = sx / l;
      sortie[i * 3 + 1] = sy / l;
      sortie[i * 3 + 2] = sz / l;
    }
  }
  return sortie;
}

/** L'angle des roues, commun à toutes les roues d'une voiture (un uniforme partagé par leur matériau et leur matériau d'ombre). */
export interface AngleRoues {
  value: number;
}

const TOURNE = /* glsl */ `
#ifdef USE_SPIN
  if (aSpin > 0.5) {
    float cs = cos(uSpin);
    float sn = sin(uSpin);
    transformed.yz = mat2(cs, sn, -sn, cs) * transformed.yz;
  }
#endif`;
const TOURNE_NORMALE = /* glsl */ `
#ifdef USE_SPIN
  if (aSpin > 0.5) {
    float csn = cos(uSpin);
    float snn = sin(uSpin);
    objectNormal.yz = mat2(csn, snn, -snn, csn) * objectNormal.yz;
  }
#endif`;
const ENTETE_SPIN =
  "#ifdef USE_SPIN\nattribute float aSpin;\nuniform float uSpin;\n#endif\n";

/** Options de `finiParSommet`. */
export interface OptionsFini {
  /** Tourne les sommets marqués `aSpin` autour de l'axe des roues (x). */
  angle?: AngleRoues;
  /** Écarte l'envers des faces marquées `aRecto` (matériau à double face) ; `"ombre"` : leur endroit (la carte d'ombres ne dessine que l'envers
   *  d'une face simple, comme three.js le fait de lui-même pour un matériau à simple face). */
  recto?: boolean | "ombre";
  /** La livrée (lot 40c : motifs, numéro, joints, doublures, intérieur des vitres, dessinés dans le nuanceur) : posée sur les faces marquées `aLivree`. */
  livree?: LivreeNuanceur;
  /** Retouche 40b : la Nuit (0 à 1) allume légèrement ce que la livrée dessine (rayures, plaque, numéro). */
  nuit?: { value: number };
  /**
   * Lot 40c : des reflets sans carte d'environnement (palier 1) : la lumière hémisphérique de la scène (ciel et sol du thème) est reflétée dans la
   * direction du regard, avec une ligne d'horizon ; 0 : aucun. Les paliers 2 et 3 ont la vraie carte d'environnement du thème.
   */
  reflets?: number;
}

/**
 * Le matériau d'une voiture lit sa rugosité, son métal et son vernis par sommet (`aPbr`) ; avec `angle`, il tourne les sommets marqués `aSpin`
 * autour de l'axe des roues (x) ; avec `recto`, l'envers des faces marquées `aRecto` n'est pas dessiné. Clé de programme propre, pour ne pas
 * partager un programme avec un matériau ordinaire.
 */
export function finiParSommet<M extends Material>(
  mat: M,
  o: OptionsFini = {},
  cle = "voiture",
): M {
  const pbr = "metalness" in mat;
  const { angle, recto, livree, nuit, reflets } = o;
  mat.defines = {
    ...(mat.defines ?? {}),
    ...(angle ? { USE_SPIN: "" } : {}),
    ...(recto
      ? {
          USE_RECTO: "",
          RECTO_ECARTE:
            recto === "ombre" ? "gl_FrontFacing" : "!gl_FrontFacing",
        }
      : {}),
    ...(livree ? { USE_LIVREE: "", ...livree.defines() } : {}),
  };
  mat.onBeforeCompile = (s) => {
    if (angle) s.uniforms.uSpin = angle;
    if (livree) Object.assign(s.uniforms, livree.uniforms);
    if (livree) s.uniforms.uNuit = nuit ?? { value: 0 };
    if (reflets) s.uniforms.uRefletsP1 = { value: reflets };
    const livreeV =
      "#ifdef USE_LIVREE\nattribute float aLivree;\nvarying float vLivree;\nvarying vec3 vOP;\nvarying vec3 vON;\n#endif\n";
    const rectoV =
      "#ifdef USE_RECTO\nattribute float aRecto;\nvarying float vRecto;\n#endif\n";
    let v = s.vertexShader.replace(
      "#include <common>",
      `#include <common>\n${ENTETE_SPIN}${rectoV}${livreeV}${pbr ? "attribute vec3 aPbr;\nvarying vec3 vPbr;\n" : ""}`,
    );
    v = v.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>${TOURNE}${pbr ? "\nvPbr = aPbr;" : ""}\n#ifdef USE_RECTO\nvRecto = aRecto;\n#endif\n#ifdef USE_LIVREE\nvLivree = aLivree;\nvOP = position;\nvON = normal;\n#endif`,
    );
    v = v.replace(
      "#include <beginnormal_vertex>",
      `#include <beginnormal_vertex>${TOURNE_NORMALE}`,
    );
    s.vertexShader = v;
    let f = s.fragmentShader.replace(
      "#include <common>",
      `#include <common>\n${pbr ? "varying vec3 vPbr;\n" : ""}#ifdef USE_RECTO\nvarying float vRecto;\n#endif\n#ifdef USE_LIVREE\n${GLSL_LIVREE_PARS}\n#endif\n${reflets ? "uniform float uRefletsP1;\n" : ""}`,
    );
    f = f.replace(
      "#include <clipping_planes_fragment>",
      "#include <clipping_planes_fragment>\n#ifdef USE_RECTO\nif (vRecto > 0.5 && RECTO_ECARTE) discard;\n#endif",
    );
    f = f.replace("#include <color_fragment>", `#include <color_fragment>\n${GLSL_LIVREE_COULEUR}`);
    // La Nuit : ce que la livrée dessine (rayures, plaque, numéro) brille un peu, de sa propre couleur (la voiture se lit dans le noir).
    f = f.replace(
      "#include <emissivemap_fragment>",
      "#include <emissivemap_fragment>\n#ifdef USE_LIVREE\ntotalEmissiveRadiance += diffuseColor.rgb * gLiv * uNuit * 0.55;\n#endif",
    );
    if (pbr) {
      f = f.replace(
        "#include <metalnessmap_fragment>",
        "#include <metalnessmap_fragment>\nroughnessFactor = vPbr.x;\nmetalnessFactor = vPbr.y;",
      );
      f = f.replace(
        "#include <lights_physical_fragment>",
        "#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\nmaterial.clearcoat *= vPbr.z;\n#endif",
      );
      if (reflets)
        f = f.replace(
          "#include <lights_fragment_maps>",
          `#include <lights_fragment_maps>
#if defined( RE_IndirectSpecular ) && NUM_HEMI_LIGHTS > 0
{
  vec3 rd = reflect( - geometryViewDir, geometryNormal );
  float hz = dot( rd, hemisphereLights[ 0 ].direction );
  vec3 haut = hemisphereLights[ 0 ].skyColor * 1.5;
  vec3 bas = hemisphereLights[ 0 ].groundColor * 0.6;
  // L'horizon : un gris neutre (le mélange du ciel et du sol tirerait sur le vert) ; le ciel au-dessus, le sol au-dessous.
  vec3 hor = vec3( dot( haut + bas, vec3( 0.3333 ) ) * 0.6 );
  vec3 ciel = hz > 0.0 ? mix( hor, haut, smoothstep( 0.0, 0.55, hz ) ) : mix( hor, bas, smoothstep( 0.0, -0.4, hz ) );
  float lisse = 1.0 - roughnessFactor;
  radiance += ciel * lisse * lisse * uRefletsP1;
}
#endif`,
        );
    }
    s.fragmentShader = f;
  };
  mat.customProgramCacheKey = () =>
    `${cle}:${angle ? "roue" : "fixe"}:${recto ? `recto-${recto}` : ""}:${livree ? `livree${livree.defines().MOTIF}-${livree.defines().NJC}${livree.defines().NJT}${livree.defines().NJR}` : ""}:${pbr ? "pbr" : "base"}:${reflets ? "refl" : ""}`;
  return mat;
}

/** Le matériau d'ombre d'une roue : la même rotation que son matériau (sinon l'ombre ne tournerait pas). */
export function ombreDeRoue(angle: AngleRoues): MeshDepthMaterial {
  return finiParSommet(new MeshDepthMaterial(), { angle }, "ombre-roue");
}

/** Le matériau d'ombre des feux : les faces simples (`aRecto`) n'y sont dessinées que par leur envers. */
export function ombreDesFeux(): MeshDepthMaterial {
  return finiParSommet(
    new MeshDepthMaterial(),
    { recto: "ombre" },
    "ombre-feux",
  );
}
