// Retouche 38b — palier 3, famille « vie » : ce qui bouge sans toucher à la course. Drapeaux et banderoles qui ondulent, foule des tribunes,
// écrans à diodes et chronomètre, particules d'ambiance par thème. Tout est animé **par la carte graphique** (un temps en uniforme) : rien n'est
// créé ni recalculé image par image, un appel de rendu par famille. Présentation seule : rien ne lit ni n'écrit la simulation.
import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NormalBlending,
  Points,
  RepeatWrapping,
  ShaderMaterial,
  SRGBColorSpace,
  Vector3,
  Vector4,
  type Material,
  type PerspectiveCamera,
} from "three";
import { CELL, WALL_HEIGHT, blockHalfWidth, type PaletteName } from "@cdj/sim";
import { Builder } from "../meshKit";
import type { Drapeaux } from "./drapeaux";
import type { Affiches } from "./outils";
import { METAL_SOMBRE } from "./piste";
import { onBlock } from "./route";
import { SPONSORS, encreDe, sponsorsDuTheme } from "./sponsors";
import type { SorteParticules, Theme3 } from "./lumiere3";
import type { Calques, Contexte } from "./types";

/** Le temps de la scène (s), partagé par toutes les animations. */
export interface Temps {
  uTemps: { value: number };
}

/** Ajoute le temps à un matériau et y injecte un bout de nuanceur de sommets après `begin_vertex` (déformation). */
function animer(m: Material, t: Temps, entetes: string, deformation: string, cle: string) {
  m.onBeforeCompile = (s) => {
    s.uniforms.uTemps = t.uTemps;
    s.vertexShader = `uniform float uTemps;\n${entetes}\n${s.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>\n${deformation}`)}`;
  };
  m.customProgramCacheKey = () => cle;
}

// --- Drapeaux -----------------------------------------------------------------------------------------------------------------------

/**
 * Les drapeaux qui flottent : le tissu se déplace perpendiculairement à lui-même, d'autant plus loin de la hampe ; une vague et une petite
 * vibration. À t = 0 la pose est celle des drapeaux figés du palier 2 (`Drapeaux.verser`).
 */
export function drapeauxAnimes(d: Drapeaux, t: Temps): Mesh {
  const mat = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, flatShading: true, roughness: 0.8 });
  animer(
    mat,
    t,
    "attribute vec3 aFlot;\nattribute vec3 aOndule;",
    "transformed += aOndule * (sin(uTemps * 3.1 + aFlot.y) + 0.25 * sin(uTemps * 7.3 + aFlot.y * 2.0)) * aFlot.z * aFlot.x / 1.25;",
    "drapeaux38b",
  );
  const m = new Mesh(d.geometry(), mat);
  m.castShadow = true;
  m.userData.vie = "drapeaux";
  return m;
}

// --- Foule --------------------------------------------------------------------------------------------------------------------------

const PEAUX = [0xf1c27d, 0xc68642, 0x8d5524, 0xe0ac69];

/**
 * La foule des tribunes : un spectateur = un corps et une tête (deux boîtes), **tous dans un seul maillage** (un appel de rendu pour toute la foule).
 * Chacun sautille à son rythme (`aRythme`, le même pour tous ses sommets) ; maillot et peau sont des couleurs de sommet. Les boîtes sont alignées sur les
 * axes (les tribunes le sont : le bloc de départ est droit) et tournées d'un quart de tour selon le cap. Lot 46 : un maillage fusionné plutôt que des
 * instances (`InstancedMesh`) — même appel unique, même nuanceur, mais la classe `InstancedMesh` de three.js serait entrée dans le morceau partagé de
 * three.js, donc dans le premier chargement du jeu (+1 ko compressé mesuré).
 */
export function fouleAnimee(gens: readonly { x: number; y: number; z: number; cap: number; couleur: number }[], t: Temps, e = 1): Mesh | null {
  if (gens.length === 0) return null;
  const g = new Builder();
  const rythme: number[] = [];
  gens.forEach((p, i) => {
    const n0 = g.pos.length;
    // Les épaules (0,44 m) en travers du regard, la profondeur (0,28 m) dans son sens.
    const [lx, lz] = Math.abs(Math.sin(p.cap)) > 0.7 ? [0.14, 0.22] : [0.22, 0.14];
    g.box(p.x - lx * e, p.y, p.z - lz * e, p.x + lx * e, p.y + 1.2 * e, p.z + lz * e, p.couleur);
    g.box(p.x - 0.13 * e, p.y + 1.22 * e, p.z - 0.12 * e, p.x + 0.13 * e, p.y + 1.52 * e, p.z + 0.12 * e, PEAUX[i % PEAUX.length]!);
    for (let k = n0; k < g.pos.length; k += 3) rythme.push(1.5 + ((i * 7) % 10) * 0.25, (i * 2.399) % 6.283);
  });
  const geo = g.geometry();
  geo.setAttribute("aRythme", new Float32BufferAttribute(rythme, 2));
  const mat = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 });
  mat.onBeforeCompile = (s) => {
    s.uniforms.uTemps = t.uTemps;
    s.vertexShader = `uniform float uTemps;\nattribute vec2 aRythme;\n${s.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed.y += max(0.0, sin(uTemps * aRythme.x + aRythme.y)) * 0.22;")}`;
  };
  mat.customProgramCacheKey = () => "foule46";
  const m = new Mesh(geo, mat);
  m.userData.vie = "foule";
  m.userData.spectateurs = gens.length;
  return m;
}

// --- Écrans à diodes ----------------------------------------------------------------------------------------------------------------

/** La grille des diodes, dessinée par-dessus (des points sombres entre les diodes). */
function diodes(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
  for (let x = 0; x < w; x += 4) ctx.fillRect(x, 0, 1, h);
}

/** Les sponsors d'un ruban : les quatre premiers du thème (lot 46 : les sponsors fictifs du lot 43, `sponsors.ts`, à la place de ceux de B). */
export const SPONSORS_PAR_RUBAN = 4;

const css = (c: number) => `#${c.toString(16).padStart(6, "0")}`;

/**
 * Le ruban des écrans (1024 × 64 : `RUBAN_RAPPORT` = 16) : les sponsors du thème à la suite, il défile (`map.offset`). Lot 46 : les sponsors fictifs du
 * lot 43 (`sponsors.ts`), avec leur encre atténuée : un écran n'est jamais plus lisible qu'un panneau de course.
 */
export function rubanDesEcrans(palette: PaletteName): CanvasTexture {
  const w = 1024;
  const h = 64;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const logos = sponsorsDuTheme(palette).slice(0, SPONSORS_PAR_RUBAN);
  const pas = w / logos.length;
  logos.forEach((k, i) => {
    const sp = SPONSORS[k]!;
    ctx.fillStyle = css(sp.fond);
    ctx.fillRect(i * pas, 0, pas, h);
    ctx.fillStyle = css(encreDe(sp));
    ctx.font = "italic 800 44px 'Barlow Condensed', 'Archivo', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(sp.nom, i * pas + pas / 2, h / 2 + 2, pas - 12);
  });
  diodes(ctx, w, h);
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** Le chronomètre à diodes (256 × 128), redessiné dix fois par seconde au plus. Lot 51 : `afficher(s)` montre le temps `s` (secondes) en minutes, secondes et dixièmes. */
export class Chronometre {
  readonly texture: CanvasTexture;
  private readonly ctx: CanvasRenderingContext2D;
  private dernier = -1;
  constructor() {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;
    this.ctx = canvas.getContext("2d")!;
    this.texture = new CanvasTexture(canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.afficher(0);
  }
  afficher = (s: number) => {
    const d = (s * 10) | 0;
    if (d === this.dernier) return;
    this.dernier = d;
    const c = this.ctx;
    c.fillStyle = "#0B0D12";
    c.fillRect(0, 0, 256, 128);
    c.fillStyle = "#FFB000";
    c.font = "700 64px 'JetBrains Mono', monospace";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(`${(d / 600) | 0}:${String(((d / 10) | 0) % 60).padStart(2, "0")}.${d % 10}`, 128, 68); // M:SS.d
    diodes(c, 256, 128);
    this.texture.needsUpdate = true;
  }
}

/** Rapport largeur / hauteur du ruban des écrans : pour qu'un écran de L × H m garde ses lettres droites, u va de 0 à (L / H) / RAPPORT. */
export const RUBAN_RAPPORT = 16;

/**
 * Les panneaux à diodes le long de la ligne droite du départ, posés sur les rebords (palier 3, pas « écrans ») : à côté de la piste, jamais dessus. Lot 46 :
 * déplacé de `decorP1.ts` (la vitrine) pour que le jeu les pose sans tirer le décor de la vitrine.
 */
export function ecransDuDepart(c: Calques, x: Contexte) {
  const b = x.track.blocks[0]!;
  if (!c.ecrans || b.open) return;
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
    // Le dos des écrans (un caisson sombre) : ils ne sont pas des feuilles.
    c.solide.box(Math.min(p0[0], p1[0]) - 0.05, p0[1] - 0.05, Math.min(p0[2], p1[2]) - 0.05, Math.max(p0[0], p1[0]) + 0.05, p0[1], Math.max(p0[2], p1[2]) + 0.05, METAL_SOMBRE);
  }
}

/** Un maillage d'écrans (quadrilatères d'`Affiches`), sans éclairage : lisible de jour comme de nuit, et assez lumineux pour le halo. */
export function maillageEcrans(a: Affiches, texture: CanvasTexture): Mesh | null {
  if (a.pos.length === 0) return null;
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(a.pos, 3));
  g.setAttribute("uv", new Float32BufferAttribute(a.uv, 2));
  const m = new Mesh(g, new MeshBasicMaterial({ map: texture, side: DoubleSide, color: new Color(1.25, 1.25, 1.25) }));
  m.userData.vie = "ecrans";
  return m;
}

/**
 * Lot 46 : les écrans du jeu en **un seul maillage** (un appel de rendu) — les rubans qui défilent (`ecrans`) et le chronomètre du portique (`chrono`),
 * chacun sa texture, lues par un même nuanceur (`aEcran` : 0 ruban, 1 chronomètre). Sans éclairage ni brume (des diodes, tout près du départ). Textures `null` :
 * sans DOM (tests), les formes seules.
 */
export function ecransEtChrono(ecrans: Affiches, chrono: Affiches, ruban: CanvasTexture | null, cadran: CanvasTexture | null): Mesh<BufferGeometry, ShaderMaterial> | null {
  const n = ecrans.pos.length / 3;
  if (n + chrono.pos.length === 0) return null;
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute([...ecrans.pos, ...chrono.pos], 3));
  g.setAttribute("uv", new Float32BufferAttribute([...ecrans.uv, ...chrono.uv], 2));
  g.setAttribute("aEcran", new Float32BufferAttribute([...new Array<number>(n).fill(0), ...new Array<number>(chrono.pos.length / 3).fill(1)], 1));
  const m = new Mesh(
    g,
    new ShaderMaterial({
      uniforms: { uRuban: { value: ruban }, uCadran: { value: cadran }, uDefile: { value: 0 } },
      vertexShader: /* glsl */ `
attribute float aEcran;
varying vec2 vUv;
varying float vEcran;
void main() {
  vUv = uv;
  vEcran = aEcran;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
      fragmentShader: /* glsl */ `
uniform sampler2D uRuban;
uniform sampler2D uCadran;
uniform float uDefile;
varying vec2 vUv;
varying float vEcran;
void main() {
  vec3 c = vEcran < 0.5 ? texture2D(uRuban, vec2(vUv.x + uDefile, vUv.y)).rgb : texture2D(uCadran, vUv).rgb;
  gl_FragColor = vec4(c * 1.25, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
      side: DoubleSide,
    }),
  );
  m.userData.vie = "ecrans";
  return m;
}

// --- Particules ---------------------------------------------------------------------------------------------------------------------

const PART_VERT = /* glsl */ `
uniform float uTemps;
uniform vec3 uCamera;
uniform float uTaille;
uniform float uEchelle;
uniform float uSorte;
uniform vec4 uVit;
uniform vec4 uOnd;
uniform float uAmp;
uniform vec3 uAvant;
uniform float uSalve;
attribute vec4 aGraine;
attribute vec3 color;
varying vec3 vCouleur;
varying float vAlpha;
void main() {
  // Chaque particule vit dans une boîte de 70 m qui suit la caméra (elle s'y replie) : il y en a toujours autour, sans rien recréer. Lot 46 : le mouvement de
  // chaque sorte est une dérive (uVit.xyz, la chute propre à chacune uVit.w) et une ondulation (fréquences uOnd.xyz, part verticale uOnd.w, ampleur uAmp).
  float t = uTemps;
  vec3 p = position + (uVit.xyz - vec3(0.0, uVit.w * aGraine.w, 0.0)) * t + vec3(sin(t * uOnd.x + aGraine.x * 6.3), sin(t * uOnd.y + aGraine.y * 6.3) * uOnd.w, cos(t * uOnd.z + aGraine.z * 6.3)) * uAmp;
  vec3 rel = mod(p - uCamera + 35.0, 70.0) - 35.0;
  vec4 mv = viewMatrix * vec4(uCamera + rel, 1.0);
  gl_Position = projectionMatrix * mv;
  float d = -mv.z;
  // Lot 46 : jamais une tache sur l'objectif — au plus 24 pixels, invisible à moins de 4 m de l'œil, entière à 8 m (la caméra de poursuite est à ≈ 6 m de la voiture).
  gl_PointSize = clamp(uTaille * uEchelle / max(d, 0.5), 1.0, 24.0);
  vCouleur = color;
  // S'efface au bord de la boîte (pas d'apparition brusque) et tout près de l'œil ; les lucioles clignotent, les confettis scintillent.
  float bord = 1.0 - smoothstep(0.32, 0.5, max(max(abs(rel.x), abs(rel.y)), abs(rel.z)) / 70.0);
  vAlpha = bord * smoothstep(4.0, 8.0, d);
  if (uSorte > 1.5 && uSorte < 2.5) vAlpha *= 0.55 + 0.45 * sin(t * (2.0 + aGraine.w * 3.0) + aGraine.x * 30.0);
  if (uSorte > 3.5 && uSorte < 4.5) vAlpha *= 0.6 + 0.4 * abs(sin(t * 5.0 + aGraine.z * 20.0));
  // Lot 46 : le couloir de la piste devant la voiture (uAvant.xz : où regarde la caméra, suivreCamera) — rien n'y bouge : à moins de 7 m de l'axe du
  // regard (fondu jusqu'à 10 m), de 2 m derrière l'œil jusqu'au bord de la boîte devant, sous 5 m au-dessus de l'œil, la particule s'efface.
  vAlpha *= 1.0 - (1.0 - smoothstep(7.0, 10.0, abs(rel.x * uAvant.z - rel.z * uAvant.x))) * step(-2.0, dot(rel.xz, uAvant.xz)) * (1.0 - step(5.0, rel.y)) * dot(uAvant.xz, uAvant.xz);
  // Lot 46 : une salve (les confettis du Stade, au passage de la ligne) : rien avant, elle monte en 0,4 s et s'efface entre 5 et 8 s.
  if (uSalve > -1.5) vAlpha *= step(0.0, uSalve) * smoothstep(0.0, 0.4, uSalve) * (1.0 - smoothstep(5.0, 8.0, uSalve));
}`;

const PART_FRAG = /* glsl */ `
varying vec3 vCouleur;
varying float vAlpha;
uniform float uSorte;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float r = length(q);
  if (uSorte > 3.5 && uSorte < 4.5) { if (max(abs(q.x), abs(q.y)) > 0.35) discard; }
  else if (r > 0.5) discard;
  float a = vAlpha * (uSorte > 3.5 && uSorte < 4.5 ? 1.0 : smoothstep(0.5, 0.1, r));
  gl_FragColor = vec4(vCouleur, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** Les particules de chaque thème (retouche 38b ; lot 46 : ici, avec leur nuanceur — le pas « vie » du jeu ne charge pas la table du ciel). */
export const PARTICULES_3: Record<PaletteName, Theme3["particules"]> = {
  stade: { sorte: "confettis", nombre: 500, couleurs: [0xe8552d, 0x2e7dff, 0xffd23f, 0xf4f4f4], taille: 0.16 },
  desert: { sorte: "poussiere", nombre: 900, couleurs: [0xd9a35f, 0xe8c08a], taille: 0.09 },
  neige: { sorte: "neige", nombre: 1400, couleurs: [0xffffff], taille: 0.11 },
  nuit: { sorte: "lucioles", nombre: 420, couleurs: [0xffc46a, 0xfff0b0], taille: 0.12 },
  campagne: { sorte: "pollen", nombre: 600, couleurs: [0xfff2b0, 0xffffff], taille: 0.07 },
  canyon: { sorte: "poussiere", nombre: 1000, couleurs: [0xd49a55, 0xe8b07a], taille: 0.1 },
  alpin: { sorte: "neige", nombre: 800, couleurs: [0xffffff], taille: 0.09 },
  ville: { sorte: "ville", nombre: 500, couleurs: [0xc9ced6, 0xa9adb4], taille: 0.06 },
  neon: { sorte: "lucioles", nombre: 420, couleurs: [0xff4fd8, 0x00f0ff], taille: 0.12 },
};

const SORTES: Record<SorteParticules, number> = { poussiere: 0, neige: 1, lucioles: 2, pollen: 3, confettis: 4, ville: 5 };

/**
 * Le mouvement de chaque sorte (lot 46 : des données plutôt qu'une branche du nuanceur par sorte) : dérive (m/s) et chute propre à chaque particule,
 * fréquences de l'ondulation et sa part verticale, ampleur (m).
 */
const MOUVEMENTS: Record<SorteParticules, readonly [vit: readonly number[], ond: readonly number[], amp: number]> = {
  poussiere: [[1.6, 0.1, 0.6, 0], [0.7, 1.3, 0.5, 0.3], 0.8],
  neige: [[0.4, -1.4, 0.2, 1], [1.1, 0, 0.9, 0], 0.5],
  lucioles: [[0, 0, 0, 0], [0.4, 0.6, 0.3, 0.5], 2],
  pollen: [[0.5, 0.15, 0.3, 0], [0.8, 0.5, 0.7, 1], 0.7],
  confettis: [[0.6, -0.9, 0.3, 0.6], [3, 0, 2.6, 0], 0.4],
  ville: [[0.8, 0.05, 0.4, 0], [0.3, 0, 0.4, 0], 0.6],
};

/** Lot 46 : une salve au lieu d'une ambiance continue (les confettis du Stade, à l'arrivée seulement : `uSalve`, en secondes depuis le passage de la ligne), et une autre sorte que celle du thème. */
export interface OptionsParticules {
  salve?: boolean;
  sorte?: SorteParticules;
}

/** Les particules d'ambiance d'un thème, dans une boîte de 70 m autour de la caméra. `uCamera` et `uEchelle` (pixels par mètre à 1 m) à régler à chaque image (`suivreCamera`). */
export function particules(t3: Pick<Theme3, "particules">, t: Temps, o: OptionsParticules = {}): Points<BufferGeometry, ShaderMaterial> {
  const p = o.sorte ? { ...t3.particules, sorte: o.sorte } : t3.particules;
  const boite = 70;
  const pos = new Float32Array(p.nombre * 3);
  const graines = new Float32Array(p.nombre * 4);
  const col = new Float32Array(p.nombre * 3);
  const c = new Color();
  // Une suite à graine (les mêmes particules pour tout le monde, d'un palier à l'autre).
  let a = 0x38b;
  const rnd = () => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 4294967296;
  };
  for (let i = 0; i < p.nombre; i++) {
    pos.set([rnd() * boite, rnd() * boite * (p.sorte === "lucioles" ? 0.3 : 1), rnd() * boite], i * 3);
    graines.set([rnd(), rnd(), rnd(), rnd()], i * 4);
    c.set(p.couleurs[i % p.couleurs.length]!);
    col.set([c.r, c.g, c.b], i * 3);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("aGraine", new Float32BufferAttribute(graines, 4));
  g.setAttribute("color", new Float32BufferAttribute(col, 3));
  const lumineux = p.sorte === "lucioles";
  const mat = new ShaderMaterial({
    vertexShader: PART_VERT,
    fragmentShader: PART_FRAG,
    transparent: true,
    depthWrite: false,
    blending: lumineux ? AdditiveBlending : NormalBlending,
    uniforms: {
      uTemps: t.uTemps,
      uCamera: { value: new Vector3() },
      uTaille: { value: p.taille },
      uEchelle: { value: 800 },
      uSorte: { value: SORTES[p.sorte] },
      uVit: { value: new Vector4(...MOUVEMENTS[p.sorte][0]) },
      uOnd: { value: new Vector4(...MOUVEMENTS[p.sorte][1]) },
      uAmp: { value: MOUVEMENTS[p.sorte][2] },
      uAvant: { value: new Vector3() },
      uSalve: { value: o.salve ? -1 : -2 },
    },
  });
  const pts = new Points(g, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 5;
  pts.userData.vie = "particules";
  return pts;
}

const avant = new Vector3();

/** Lot 46 : les particules suivent la caméra (la boîte, la taille à l'écran, le couloir de la piste devant elle). `hauteurPx` : la hauteur de l'image en pixels. */
export function suivreCamera(pts: Points<BufferGeometry, ShaderMaterial>, camera: PerspectiveCamera, hauteurPx: number) {
  const u = pts.material.uniforms;
  u.uCamera!.value.copy(camera.position);
  u.uEchelle!.value = hauteurPx / (2 * Math.tan((camera.fov * Math.PI) / 360));
  camera.getWorldDirection(avant);
  const n = Math.hypot(avant.x, avant.z) || 1;
  (u.uAvant!.value as Vector3).set(avant.x / n, 0, avant.z / n);
}
