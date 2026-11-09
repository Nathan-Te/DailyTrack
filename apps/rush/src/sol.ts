import { Color, DataTexture, LinearFilter, RGBAFormat, UnsignedByteType, Vector4, type MeshToonMaterial } from "three";
import { CASE, MUR, PONT, SOL, VIDE, Z_ARENE, Z_PORTE, type Niveau } from "@cdj/rush-sim/niveau";
import { M } from "@cdj/rush-sim/constantes";
import { plat } from "./cel";
import type { PaletteMonde } from "./palette";

// LE SOL (lot BR-A2). Les cases de 2 m du niveau sont dessinées en quads de couleur par sommet ; le SOL lui-même (ce qu'on voit au-dessus) est calculé à l'image dans le matériau : trois matières mélangées d'après un MASQUE (une petite texture,
// un texel par case, filtrée : les transitions sont douces) et d'un bruit qui les rend irrégulières.
//  · DALLES — un damier de dalles de 2 m (l'arène, la salle d'épreuve) : deux tons de sable (ceux du thème), une variation par dalle, un biseau clair en haut à gauche et sombre en bas à droite, des joints, des dalles fêlées, des grains ;
//  · TERRE BATTUE — les chemins et les clairières : deux tons, des cailloux, des grains ;
//  · HERBE — les bords des chemins et des clairières, et le dessus des murs bas : deux tons, des touffes claires.
// Rien n'est une image : le masque est une `DataTexture` de quelques milliers d'octets, le reste est du calcul. Le damier est aligné sur la grille du niveau (l'origine de la carte), donc sur les cases.

/** Le côté d'une dalle (mètres) : une case. */
export const DALLE = CASE / M;

export interface Masque {
  /** Un texel RGBA par case, ligne par ligne : R = dalles (0 à 255), G = terre, B = herbe, A = 255. */
  data: Uint8Array;
  l: number;
  h: number;
}

const marchable = (t: number): boolean => t === SOL || t === PONT;

/**
 * Le masque d'un niveau (sans navigateur, testé) : **dalles** dans l'arène et dans la salle d'épreuve ; **terre** sur tout autre sol marchable ; **herbe** sur les murs bas et sur les cases marchables qui touchent un mur ou le vide (le bord).
 * Les trois canaux se recouvrent : l'ordre de superposition (terre, puis herbe, puis dalles) est dans le matériau.
 */
export function masqueDuNiveau(n: Niveau): Masque {
  const data = new Uint8Array(n.l * n.h * 4);
  const type = (i: number, j: number): number => (i < 0 || j < 0 || i >= n.l || j >= n.h ? VIDE : n.cases[j * n.l + i]!);
  const E = n.epreuve;
  const ox = n.ox;
  const oy = n.oy;
  for (let j = 0; j < n.h; j++) {
    for (let i = 0; i < n.l; i++) {
      const t = type(i, j);
      const k = (j * n.l + i) * 4;
      data[k + 3] = 255;
      if (t === VIDE) continue;
      const z = n.zones[j * n.l + i]!;
      const cx = ox + i * CASE + CASE / 2;
      const cy = oy + j * CASE + CASE / 2;
      const dansSalle = t === SOL && Math.hypot(cx - E.x, cy - E.y) <= E.r + CASE * 0.3;
      if (t === SOL && (z === Z_ARENE || dansSalle) && z !== Z_PORTE) data[k] = 255;
      else if (marchable(t)) data[k + 1] = 255;
      if (t === MUR) data[k + 2] = 255;
      else if (marchable(t)) {
        // une case marchable qui touche un mur ou le vide (à sa suite, en croix ou en diagonale) : à moitié herbe (le mur est à 255 : l'herbe s'arrête à ~0,8 m du mur)
        let bord = false;
        for (let dj = -1; dj <= 1 && !bord; dj++) for (let di = -1; di <= 1 && !bord; di++) if ((di || dj) && (type(i + di, j + dj) === MUR || type(i + di, j + dj) === VIDE)) bord = true;
        if (bord) data[k + 2] = 140;
      }
    }
  }
  // Le vide prend, pour les dalles et l'herbe, la valeur de ses voisines en croix (sans quoi la matière s'éteindrait au bord de la case : le bord de la falaise serait nu).
  const copie = data.slice();
  for (let j = 0; j < n.h; j++) {
    for (let i = 0; i < n.l; i++) {
      if (type(i, j) !== VIDE) continue;
      const k = (j * n.l + i) * 4;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        if (type(i + di, j + dj) === VIDE) continue;
        const q = ((j + dj) * n.l + (i + di)) * 4;
        data[k] = Math.max(data[k]!, copie[q]!);
        data[k + 2] = Math.max(data[k + 2]!, type(i + di, j + dj) === MUR ? 255 : 255);
      }
    }
  }
  return { data, l: n.l, h: n.h };
}

const BRUIT = `
  float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float vn(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h12(i), h12(i + vec2(1.0, 0.0)), f.x), mix(h12(i + vec2(0.0, 1.0)), h12(i + vec2(1.0, 1.0)), f.x), f.y); }`;

/** Les trois matières et leur mélange : les fonctions GLSL ajoutées au fragment du matériau toon. */
const MATIERES = `
  varying vec3 vMonde; varying float vProc;
  uniform sampler2D uMasque; uniform vec4 uCarte; uniform vec4 uArene; uniform vec4 uAccent;
  uniform vec3 uSol1; uniform vec3 uSol2; uniform vec3 uTerre1; uniform vec3 uTerre2; uniform vec3 uHerbe1; uniform vec3 uHerbe2;
  ${BRUIT}
  vec3 dalles(vec2 p){
    vec2 q = (p - uCarte.xy) / ${DALLE.toFixed(3)};
    vec2 id = floor(q); vec2 f = fract(q);
    float par = mod(id.x + id.y, 2.0);
    float v = h12(id);
    vec3 c = mix(uSol1, uSol2, par) * (0.95 + 0.09 * v) * mix(1.03, 0.95, par);
    float d = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
    // le biseau : clair en haut à gauche, sombre en bas à droite
    c += 0.055 * (step(f.x, 0.07) + step(f.y, 0.07)) - 0.06 * (step(0.93, f.x) + step(0.93, f.y));
    // une dalle sur neuf est fêlée
    if (v > 0.88) {
      vec2 c0 = vec2(0.3 + 0.4 * h12(id + 3.1), 0.3 + 0.4 * h12(id + 7.7));
      float w = abs(vn(q * 4.0 + id * 7.0) - 0.5);
      c *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 0.045, w)) * (1.0 - smoothstep(0.18, 0.34, length(f - c0))) * step(0.08, d);
    }
    // les joints
    c *= 1.0 - 0.34 * (1.0 - smoothstep(0.010, 0.032, d));
    // les grains
    c *= 0.965 + 0.07 * h12(floor(p * 22.0));
    c *= 0.97 + 0.06 * vn(p * 0.7);
    return c;
  }
  vec3 terre(vec2 p){
    float t = vn(p * 0.45) * 0.6 + vn(p * 1.9) * 0.4;
    vec3 c = mix(uTerre1, uTerre2, t);
    vec2 g = p * 3.4; float k = h12(floor(g)); vec2 fg = fract(g) - 0.5;
    c *= 1.0 - 0.16 * step(0.9, k) * (1.0 - smoothstep(0.1, 0.22, length(fg)));
    c *= 0.96 + 0.08 * h12(floor(p * 17.0));
    return c;
  }
  vec3 herbe(vec2 p){
    float t = vn(p * 0.8) * 0.55 + vn(p * 3.1) * 0.45;
    vec3 c = mix(uHerbe1, uHerbe2, t);
    vec2 g = p * 5.0; float k = h12(floor(g)); vec2 fg = fract(g) - 0.5;
    c = mix(c, c * 1.22, step(0.85, k) * (1.0 - smoothstep(0.12, 0.3, length(fg))));
    c *= 0.95 + 0.1 * h12(floor(p * 13.0));
    return c;
  }
  vec3 sol(vec2 p){
    float w1 = vn(p * 0.8); float w2 = vn(p * 0.8 + 19.7);
    vec2 uv = (p + (vec2(w1, w2) - 0.5) * 1.5 - uCarte.xy) * uCarte.zw;
    vec4 m = texture2D(uMasque, uv);
    float herb = smoothstep(0.52, 0.86, m.b + (w1 - 0.5) * 0.3);
    float dal = smoothstep(0.42, 0.62, m.r + (w2 - 0.5) * 0.16);
    // l'arène (un disque : le plateau) : des dalles dedans, de l'herbe sur la lèvre dehors
    if (uArene.w > 0.0) { float da = length(p - uArene.xy); dal = 1.0 - smoothstep(uArene.z - 0.12, uArene.z + 0.12, da); herb = 1.0 - dal; }
    vec3 c = terre(p);
    c = mix(c, herbe(p), herb);
    c = mix(c, dalles(p), dal);
    // l'accent du boss : un anneau incrusté près du bord de l'arène et des encoches (leur nombre dit le boss)
    if (uArene.w > 0.0 && uAccent.w > 0.0) {
      vec2 d = p - uArene.xy; float da = length(d);
      float ring = 1.0 - smoothstep(0.05, 0.14, abs(da - (uArene.z - 1.5)));
      float f = fract(atan(d.y, d.x) / 6.28318 * uAccent.w);
      float tk = (1.0 - smoothstep(0.012, 0.03, abs(f - 0.5))) * step(uArene.z - 2.0, da) * step(da, uArene.z - 1.0);
      c = mix(c, uAccent.rgb * 0.92, max(ring * 0.75, tk * 0.8));
    }
    return c;
  }`;

export interface SolMatiere {
  matiere: MeshToonMaterial;
  /** La texture du masque (à libérer). */
  detruire(): void;
}

const lin = (h: number): Color => new Color(h);

/**
 * Le matériau du sol : un toon à couleurs par sommet, dont les faces portent un attribut `proc` (1 : le dessus d'une case, calculé ici ; 0 : une falaise, qui garde sa couleur de sommet). `masque` : celui du niveau (`masqueDuNiveau`) avec son origine
 * et son étendue en mètres ; sans masque, tout est dalles. `arene` : un disque (centre en mètres, rayon) dont l'intérieur est dalles et l'extérieur de l'herbe : le plateau de l'arène.
 */
export function matiereDuSol(a: PaletteMonde, niveau: Niveau | null, arene: { x: number; z: number; r: number; accent?: { couleur: number; n: number } } | null = null, origine: { x: number; z: number } | null = null): SolMatiere {
  const masque = niveau ? masqueDuNiveau(niveau) : { data: new Uint8Array([255, 0, 0, 255]), l: 1, h: 1 };
  const tex = new DataTexture(masque.data, masque.l, masque.h, RGBAFormat, UnsignedByteType);
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.needsUpdate = true;
  const ox = niveau ? niveau.ox / M : (origine?.x ?? 0);
  const oz = niveau ? niveau.oy / M : (origine?.z ?? 0);
  const carte = new Vector4(ox, oz, 1 / (masque.l * DALLE), 1 / (masque.h * DALLE));
  const zone = new Vector4(arene?.x ?? 0, arene?.z ?? 0, arene?.r ?? 0, arene ? 1 : 0);
  const accent = arene?.accent ? new Vector4(...new Color(arene.accent.couleur).toArray(), arene.accent.n) : new Vector4(0, 0, 0, 0);
  const m = plat(0xffffff, true, 0);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uMasque = { value: tex };
    sh.uniforms.uCarte = { value: carte };
    sh.uniforms.uArene = { value: zone };
    sh.uniforms.uAccent = { value: accent };
    sh.uniforms.uSol1 = { value: lin(a.sol) };
    sh.uniforms.uSol2 = { value: lin(a.sol2) };
    sh.uniforms.uTerre1 = { value: lin(a.terre) };
    sh.uniforms.uTerre2 = { value: lin(a.terre2) };
    sh.uniforms.uHerbe1 = { value: lin(a.herbeSol) };
    sh.uniforms.uHerbe2 = { value: lin(a.herbeSol2) };
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float proc; varying vec3 vMonde; varying float vProc;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvMonde = (modelMatrix * vec4(transformed, 1.0)).xyz; vProc = proc;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", `#include <common>\n${MATIERES}`).replace(
      "#include <color_fragment>",
      `#include <color_fragment>
       diffuseColor.rgb = mix(diffuseColor.rgb, sol(vMonde.xz), vProc);`,
    );
  };
  m.customProgramCacheKey = () => `rush-sol${arene ? "-arene" : ""}`;
  return {
    matiere: m,
    detruire() {
      tex.dispose();
      m.dispose();
    },
  };
}

/** Pour les tests : un point du sol vu par le masque (un texel : la case `i, j`). */
export const texel = (m: Masque, i: number, j: number): [number, number, number] => [m.data[(j * m.l + i) * 4]!, m.data[(j * m.l + i) * 4 + 1]!, m.data[(j * m.l + i) * 4 + 2]!];
