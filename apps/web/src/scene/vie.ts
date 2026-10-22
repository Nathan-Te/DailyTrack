// Retouche 38b — palier 3, famille « vie » : ce qui bouge sans toucher à la course. Drapeaux et banderoles qui ondulent, foule des tribunes,
// écrans à diodes et chronomètre, particules d'ambiance par thème. Tout est animé **par la carte graphique** (un temps en uniforme) : rien n'est
// créé ni recalculé image par image, un appel de rendu par famille. Présentation seule : rien ne lit ni n'écrit la simulation.
import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NormalBlending,
  Points,
  RepeatWrapping,
  ShaderMaterial,
  SRGBColorSpace,
  Vector3,
  type Material,
} from "three";
import type { Drapeaux } from "./finition";
import type { Affiches } from "./outils";
import { SPONSORS, type Logo } from "./directionB";
import type { SorteParticules, Theme3 } from "./lumiere3";
import type { PaletteName } from "@cdj/sim";

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
 * La foule des tribunes : un spectateur = un corps et une tête (24 triangles), en instances (un appel de rendu pour toute la foule). Chacun
 * sautille à son rythme ; la couleur du maillot est par instance, celle de la peau par sommet.
 */
export function fouleInstanciee(gens: readonly { x: number; y: number; z: number; cap: number; couleur: number }[], t: Temps): InstancedMesh | null {
  if (gens.length === 0) return null;
  const corps = new BoxGeometry(0.44, 1.2, 0.28).translate(0, 0.6, 0);
  const tete = new BoxGeometry(0.26, 0.3, 0.24).translate(0, 1.37, 0);
  const tab = (a: ArrayLike<number>) => Array.from(a);
  const pos = [...tab(corps.getAttribute("position").array), ...tab(tete.getAttribute("position").array)];
  const nor = [...tab(corps.getAttribute("normal").array), ...tab(tete.getAttribute("normal").array)];
  const idx = [...tab(corps.index!.array), ...tab(tete.index!.array).map((i) => i + corps.getAttribute("position").count)];
  const estCorps = [...new Array<number>(corps.getAttribute("position").count).fill(1), ...new Array<number>(tete.getAttribute("position").count).fill(0)];
  corps.dispose();
  tete.dispose();
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new Float32BufferAttribute(nor, 3));
  g.setAttribute("aCorps", new Float32BufferAttribute(estCorps, 1));
  g.setIndex(idx);
  const n = gens.length;
  const maillot = new Float32Array(n * 3);
  const peau = new Float32Array(n * 3);
  const rythme = new Float32Array(n * 2);
  const c = new Color();
  for (let i = 0; i < n; i++) {
    c.set(gens[i]!.couleur);
    maillot.set([c.r, c.g, c.b], i * 3);
    c.set(PEAUX[i % PEAUX.length]!);
    peau.set([c.r, c.g, c.b], i * 3);
    rythme.set([1.5 + ((i * 7) % 10) * 0.25, (i * 2.399) % 6.283], i * 2);
  }
  g.setAttribute("aMaillot", new InstancedBufferAttribute(maillot, 3));
  g.setAttribute("aPeau", new InstancedBufferAttribute(peau, 3));
  g.setAttribute("aRythme", new InstancedBufferAttribute(rythme, 2));
  const mat = new MeshStandardMaterial({ flatShading: true, roughness: 0.9 });
  mat.onBeforeCompile = (s) => {
    s.uniforms.uTemps = t.uTemps;
    s.vertexShader = `uniform float uTemps;\nattribute float aCorps;\nattribute vec3 aMaillot;\nattribute vec3 aPeau;\nattribute vec2 aRythme;\nvarying vec3 vTeinte;\n${s.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvTeinte = mix(aPeau, aMaillot, aCorps);\ntransformed.y += max(0.0, sin(uTemps * aRythme.x + aRythme.y)) * 0.22;",
    )}`;
    s.fragmentShader = `varying vec3 vTeinte;\n${s.fragmentShader.replace("vec4 diffuseColor = vec4( diffuse, opacity );", "vec4 diffuseColor = vec4( diffuse * vTeinte, opacity );")}`;
  };
  mat.customProgramCacheKey = () => "foule38b";
  const m = new InstancedMesh(g, mat, n);
  const mx = new Matrix4();
  for (let i = 0; i < n; i++) {
    const p = gens[i]!;
    mx.makeRotationY(p.cap).setPosition(p.x, p.y, p.z);
    m.setMatrixAt(i, mx);
  }
  m.instanceMatrix.needsUpdate = true;
  m.computeBoundingSphere();
  m.userData.vie = "foule";
  return m;
}

// --- Écrans à diodes ----------------------------------------------------------------------------------------------------------------

/** Couleurs des sponsors sur le ruban (fond, texte). */
const RUBAN: Record<Logo, [string, string, string]> = {
  dujour: ["#2A1E16", "#EDE3CF", "DU JOUR"],
  volta: ["#16181F", "#FFD23F", "VOLTA"],
  mistral: ["#1F5FBF", "#FFFFFF", "MISTRAL"],
  pneusroc: ["#E8283A", "#FFFFFF", "PNEUS ROC"],
  gazole: ["#21A35A", "#FFFFFF", "GAZOLE+"],
  eclair: ["#E8552D", "#16181F", "ÉCLAIR"],
  boulon: ["#3A3F4D", "#FFFFFF", "BOULON & FILS"],
  cafe: ["#5B3A24", "#F2E2C4", "CAFÉ DU COIN"],
  chrono: ["#0B0D12", "#FFB000", "CHRONO"],
  distance2: ["#16181F", "#FFFFFF", "TRACK"],
  distance1: ["#16181F", "#FFFFFF", "TRACK"],
  col: ["#FFFFFF", "#E8283A", "COL 2 104 m"],
  glacier: ["#BFE3F5", "#1F5FBF", "GLACIER"],
  taxi: ["#FFC61A", "#16181F", "TAXI"],
  motel: ["#16181F", "#FF2BD6", "MOTEL"],
  rodeo: ["#E0A466", "#7A2E14", "RODÉO"],
};

/** La grille des diodes, dessinée par-dessus (des points sombres entre les diodes). */
function diodes(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
  for (let x = 0; x < w; x += 4) ctx.fillRect(x, 0, 1, h);
}

/** Le ruban des écrans (1024 × 64 : `RUBAN_RAPPORT` = 16) : les sponsors du thème à la suite, il défile (`map.offset`). */
export function rubanDesEcrans(palette: PaletteName): CanvasTexture {
  const w = 1024;
  const h = 64;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const logos = SPONSORS[palette];
  const pas = w / logos.length;
  logos.forEach((l, i) => {
    const [fond, encre, texte] = RUBAN[l];
    ctx.fillStyle = fond;
    ctx.fillRect(i * pas, 0, pas, h);
    ctx.fillStyle = encre;
    ctx.font = "italic 800 44px 'Barlow Condensed', 'Archivo', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(texte, i * pas + pas / 2, h / 2 + 2, pas - 12);
  });
  diodes(ctx, w, h);
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** Le chronomètre à diodes (256 × 128), redessiné dix fois par seconde au plus. */
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
  afficher(s: number) {
    const d = Math.floor((s % 60) * 10);
    if (d === this.dernier) return;
    this.dernier = d;
    const c = this.ctx;
    c.fillStyle = "#0B0D12";
    c.fillRect(0, 0, 256, 128);
    c.fillStyle = "#FFB000";
    c.font = "700 64px 'JetBrains Mono', monospace";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(`0:${String(Math.floor(d / 10)).padStart(2, "0")}.${d % 10}`, 128, 68);
    diodes(c, 256, 128);
    this.texture.needsUpdate = true;
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

// --- Particules ---------------------------------------------------------------------------------------------------------------------

const PART_VERT = /* glsl */ `
uniform float uTemps;
uniform vec3 uCamera;
uniform float uBoite;
uniform float uTaille;
uniform float uEchelle;
uniform float uSorte;
attribute vec4 aGraine;
varying vec3 vCouleur;
varying float vAlpha;
attribute vec3 color;
void main() {
  // Chaque particule vit dans une boîte qui suit la caméra (elle s'y replie) : il y en a toujours autour, sans rien recréer.
  vec3 p = position;
  float t = uTemps;
  if (uSorte < 0.5) { p += vec3(1.6, 0.1, 0.6) * t + vec3(sin(t * 0.7 + aGraine.x * 6.3), sin(t * 1.3 + aGraine.y * 6.3) * 0.3, cos(t * 0.5 + aGraine.z * 6.3)) * 0.8; }        // poussière
  else if (uSorte < 1.5) { p += vec3(0.4, -1.4 - aGraine.w, 0.2) * t + vec3(sin(t * 1.1 + aGraine.x * 6.3), 0.0, cos(t * 0.9 + aGraine.y * 6.3)) * 0.5; }                     // neige
  else if (uSorte < 2.5) { p += vec3(sin(t * 0.4 + aGraine.x * 6.3), sin(t * 0.6 + aGraine.y * 6.3) * 0.5, cos(t * 0.3 + aGraine.z * 6.3)) * 2.0; }                          // lucioles
  else if (uSorte < 3.5) { p += vec3(0.5, 0.15, 0.3) * t + vec3(sin(t * 0.8 + aGraine.x * 6.3), sin(t * 0.5 + aGraine.y * 6.3), cos(t * 0.7 + aGraine.z * 6.3)) * 0.7; }    // pollen
  else if (uSorte < 4.5) { p += vec3(0.6, -0.9 - aGraine.w * 0.6, 0.3) * t + vec3(sin(t * 3.0 + aGraine.x * 6.3), 0.0, cos(t * 2.6 + aGraine.y * 6.3)) * 0.4; }            // confettis
  else { p += vec3(0.8, 0.05, 0.4) * t + vec3(sin(t * 0.3 + aGraine.x * 6.3), 0.0, cos(t * 0.4 + aGraine.y * 6.3)) * 0.6; }                                                  // ville
  vec3 rel = mod(p - uCamera + uBoite * 0.5, uBoite) - uBoite * 0.5;
  vec4 mv = viewMatrix * vec4(uCamera + rel, 1.0);
  gl_Position = projectionMatrix * mv;
  float d = -mv.z;
  gl_PointSize = clamp(uTaille * uEchelle / max(d, 0.5), 1.0, 48.0);
  vCouleur = color;
  // S'efface au bord de la boîte (pas d'apparition brusque) et tout près de l'œil ; les lucioles clignotent, les confettis scintillent.
  float bord = 1.0 - smoothstep(0.32, 0.5, max(max(abs(rel.x), abs(rel.y)), abs(rel.z)) / uBoite);
  vAlpha = bord * smoothstep(0.8, 2.5, d);
  if (uSorte > 1.5 && uSorte < 2.5) vAlpha *= 0.55 + 0.45 * sin(t * (2.0 + aGraine.w * 3.0) + aGraine.x * 30.0);
  if (uSorte > 3.5 && uSorte < 4.5) vAlpha *= 0.6 + 0.4 * abs(sin(t * 5.0 + aGraine.z * 20.0));
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

const SORTES: Record<SorteParticules, number> = { poussiere: 0, neige: 1, lucioles: 2, pollen: 3, confettis: 4, ville: 5 };

/** Les particules d'ambiance d'un thème, dans une boîte de 70 m autour de la caméra. `uCamera` et `uEchelle` (pixels par mètre à 1 m) à régler à chaque image. */
export function particules(t3: Theme3, t: Temps): Points<BufferGeometry, ShaderMaterial> {
  const p = t3.particules;
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
    uniforms: { uTemps: t.uTemps, uCamera: { value: new Vector3() }, uBoite: { value: boite }, uTaille: { value: p.taille }, uEchelle: { value: 800 }, uSorte: { value: SORTES[p.sorte] } },
  });
  const pts = new Points(g, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 5;
  pts.userData.vie = "particules";
  return pts;
}
