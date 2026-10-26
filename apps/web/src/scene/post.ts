// Lot 50 — la chaîne de post-traitement du palier 3 (ordinateur seulement), réécrite pour une carte graphique intégrée, **à l'image presque identique** à celle du
// lot 47 (`post47.ts`, gardée le temps du lot pour le banc d'essai). Sur une carte intégrée, ce qui coûte est la **bande passante** : chaque écriture et
// relecture de tout l'écran. D'où :
//   - **une seule passe de fin** (`FIN`) : tonalité et espace de l'écran (l'ancienne `OutputPass`), étalonnage et anticrénelage FXAA dans un seul nuanceur
//     plein écran, qui écrit directement l'écran ; le FXAA y lit l'image **finale** de chaque voisin (tonalité, étalonnage), comme quand il passait en dernier ;
//   - **le halo seulement la Nuit** (`avecHalo` : le Néon et la Nuit ; le jour il ne touchait que le disque du soleil) et **sans aucune passe plein écran** :
//     la chaîne de demi-résolutions floutées d'`UnrealBloomPass` (mêmes niveaux, mêmes flous, mêmes poids), composée à la demi-résolution et lue par la passe
//     de fin — plus de mélange additif sur tout l'écran ;
//   - **la scène dans une cible de 4 octets par pixel** en lumière linéaire (`R11F_G11F_B10F` : des flottants sans alpha ; repli en demi-flottants, 8 octets) ;
//     multi-échantillonnée ×4 sous `PIXELS_MSAA` (réglable au banc), et **l'écran sans multi-échantillonnage** quand la chaîne dessine (`main.ts` crée le
//     moteur sans `antialias` : jamais deux multi-échantillonnages) ;
//   - **rien par image qui parcourt les matériaux** : les nuanceurs d'écran lisent `SORTIE_LINEAIRE` (halo.ts), mis à 1 le temps de la scène ;
//   - **les programmes précompilés hors course** (`preparer` : `compileAsync` de la scène dans la cible, et des passes).
// Commutable partie par partie (halo, étalonnage, FXAA) ; le banc (`?banc`) mesure chaque forme (`FormeChaine`).
import {
  BufferGeometry,
  Float32BufferAttribute,
  HalfFloatType,
  Mesh,
  RGBFormat,
  Scene,
  ShaderMaterial,
  UnsignedInt101111Type,
  WebGLRenderTarget,
  type Camera,
  type Object3D,
  type PerspectiveCamera,
  type Texture,
  type WebGLRenderer,
} from "three";
import { SORTIE_LINEAIRE } from "./socle";
import type { Theme3 } from "./lumiere3";

/** Ce que la chaîne doit faire pour une image. */
export interface ReglagesPost {
  halo: boolean;
  etalonnage: boolean;
  anticrenelage: boolean;
  theme: Pick<Theme3, "halo" | "etalonnage">;
  /** Exposition du thème (tonalité). */
  exposition: number;
}

/** La forme de la chaîne : celle du jeu (`FORME_JEU`), ou une autre au banc d'essai. */
export interface FormeChaine {
  /** Multi-échantillonnage de la scène (0 : le FXAA seul) ; jamais au-delà de `PIXELS_MSAA`. */
  echantillons: 0 | 2 | 4;
  /** Format de la cible de la scène : `r11` (4 octets par pixel), `demi` (demi-flottants, 8 octets : celui du lot 47). */
  format: "r11" | "demi";
  /** Première résolution du halo : 1 = la moitié de l'écran (comme `UnrealBloomPass`), 2 = le quart. */
  haloDepart: 1 | 2;
  /** Niveaux du halo (5 : comme `UnrealBloomPass`). */
  haloNiveaux: number;
}
export const FORME_JEU: Readonly<FormeChaine> = { echantillons: 4, format: "r11", haloDepart: 1, haloNiveaux: 5 };
/**
 * **Jamais deux multi-échantillonnages** : la forme du jeu selon l'écran du moteur. Un moteur créé avec le sien (la chaîne demandée en cours de page : `antialias`
 * ne change plus après la création) garde la scène de la chaîne sans multi-échantillonnage (le FXAA lisse) jusqu'au prochain chargement.
 */
export const formeDuJeu = (ecranMsaa: boolean): Readonly<FormeChaine> => (ecranMsaa ? { ...FORME_JEU, echantillons: 0 } : FORME_JEU);

/** Pixels au-delà desquels la scène n'est plus multi-échantillonnée (le FXAA reste) : 1080p oui (2,07 millions), 1440p non (3,69). */
export const PIXELS_MSAA = 2_800_000;

/** Seuil de halo en dessous duquel un thème a son halo : la Nuit (0,95) et le Néon (0,9). Les thèmes de jour (2 à 2,8) n'en ont plus : il ne touchait que le soleil. */
export const SEUIL_HALO_NUIT = 1.5;
export const avecHalo = (t: Pick<Theme3, "halo">): boolean => t.halo.seuil < SEUIL_HALO_NUIT;

/** Les passes chronométrées (banc d'essai : minuteur de la carte graphique). */
export interface ChronoPasses {
  debut(nom: string): void;
  fin(): void;
}

/** Un triangle qui couvre l'écran (le nuanceur de sommets ignore la caméra). */
const SOMMETS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

/** Le halo : les lumières au-delà du seuil (`LuminosityHighPassShader`) ; `QUART` : la moyenne de 4 × 4 pixels, pour un départ au quart de la résolution. */
const CLAIRS = /* glsl */ `
uniform sampler2D tScene;
uniform vec2 uTexel;
uniform float uSeuil;
varying vec2 vUv;
void main() {
#ifdef QUART
  vec3 t = 0.25 * (texture2D(tScene, vUv + uTexel * vec2(-1.0, -1.0)).rgb + texture2D(tScene, vUv + uTexel * vec2(1.0, -1.0)).rgb + texture2D(tScene, vUv + uTexel * vec2(-1.0, 1.0)).rgb + texture2D(tScene, vUv + uTexel).rgb);
#else
  vec3 t = texture2D(tScene, vUv).rgb;
#endif
  float v = dot(t, vec3(0.2126, 0.7152, 0.0722));
  gl_FragColor = vec4(t * smoothstep(uSeuil, uSeuil + 0.01, v), 1.0);
}`;

/** Le flou séparable d'un niveau (celui d'`UnrealBloomPass` : gaussienne, prises voisines fusionnées en une lecture filtrée). */
const FLOU = /* glsl */ `
uniform sampler2D tSource;
uniform vec2 uPas;
uniform float uCentre;
uniform int uPaires;
uniform float uDecalages[11];
uniform float uPoids[11];
varying vec2 vUv;
void main() {
  vec3 s = texture2D(tSource, vUv).rgb * uCentre;
  for (int i = 0; i < 11; i++) {
    if (i >= uPaires) break;
    vec2 d = uPas * uDecalages[i];
    s += (texture2D(tSource, vUv + d).rgb + texture2D(tSource, vUv - d).rgb) * uPoids[i];
  }
  gl_FragColor = vec4(s, 1.0);
}`;

/** La composition des niveaux du halo (`lerpBloomFactor` d'`UnrealBloomPass`), à la première résolution du halo. */
const COMPOSE = /* glsl */ `
uniform sampler2D tN0;
uniform sampler2D tN1;
uniform sampler2D tN2;
uniform sampler2D tN3;
uniform sampler2D tN4;
uniform float uN[5];
varying vec2 vUv;
void main() {
  vec3 c = uN[0] * texture2D(tN0, vUv).rgb;
#if NIVEAUX > 1
  c += uN[1] * texture2D(tN1, vUv).rgb;
#endif
#if NIVEAUX > 2
  c += uN[2] * texture2D(tN2, vUv).rgb;
#endif
#if NIVEAUX > 3
  c += uN[3] * texture2D(tN3, vUv).rgb;
#endif
#if NIVEAUX > 4
  c += uN[4] * texture2D(tN4, vUv).rgb;
#endif
  gl_FragColor = vec4(c, 1.0);
}`;

/**
 * **La passe de fin** : pour chaque pixel lu, la scène (et le halo) → tonalité du moteur (exposition comprise) → espace de l'écran → étalonnage (`ecran`) ;
 * puis le FXAA (l'algorithme de `FXAAShader` de three.js, NVIDIA / Jasper Flick) sur ces couleurs finales : le mélange de deux pixels voisins le long d'un bord.
 */
const FIN = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tHalo;
uniform vec2 uTexel;
uniform float uContraste;
uniform float uSaturation;
uniform vec3 uOmbres;
uniform vec3 uLumieres;
varying vec2 vUv;
vec3 ecran(vec2 uv) {
  vec3 c = texture2D(tScene, uv).rgb;
#ifdef HALO
  c += texture2D(tHalo, uv).rgb;
#endif
#ifdef TONE_MAPPING
  c = toneMapping(c);
#endif
  c = linearToOutputTexel(vec4(c, 1.0)).rgb;
#ifdef ETALONNAGE
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSaturation);
  c = (c - 0.5) * uContraste + 0.5;
  c += uOmbres * (1.0 - smoothstep(0.0, 0.55, l)) + uLumieres * smoothstep(0.45, 1.0, l);
  c = clamp(c, 0.0, 1.0);
#endif
  return c;
}
#ifdef FXAA
float lum(vec2 uv) { return dot(ecran(uv), vec3(0.3, 0.59, 0.11)); }
const float PAS[6] = float[6](1.0, 1.5, 2.0, 2.0, 2.0, 4.0);
#endif
void main() {
  vec3 m = ecran(vUv);
#ifdef FXAA
  vec2 t = uTexel;
  float lm = dot(m, vec3(0.3, 0.59, 0.11));
  float ln = lum(vUv + vec2(0.0, t.y)), le = lum(vUv + vec2(t.x, 0.0)), ls = lum(vUv - vec2(0.0, t.y)), lw = lum(vUv - vec2(t.x, 0.0));
  float hi = max(max(max(max(ln, le), ls), lw), lm);
  float contraste = hi - min(min(min(min(ln, le), ls), lw), lm);
  if (contraste >= max(0.0312, 0.063 * hi)) {
    float lne = lum(vUv + t), lnw = lum(vUv + vec2(-t.x, t.y)), lse = lum(vUv + vec2(t.x, -t.y)), lsw = lum(vUv - t);
    float f = clamp(abs((2.0 * (ln + le + ls + lw) + lne + lnw + lse + lsw) / 12.0 - lm) / contraste, 0.0, 1.0);
    float melange = smoothstep(0.0, 1.0, f);
    melange *= melange;
    bool horizontal = abs(ln + ls - 2.0 * lm) * 2.0 + abs(lne + lse - 2.0 * le) + abs(lnw + lsw - 2.0 * lw) >= abs(le + lw - 2.0 * lm) * 2.0 + abs(lne + lnw - 2.0 * ln) + abs(lse + lsw - 2.0 * ls);
    float lp = horizontal ? ln : le, lq = horizontal ? ls : lw;
    float pas = horizontal ? t.y : t.x;
    float oppose = lp, gradient = abs(lp - lm);
    if (gradient < abs(lq - lm)) { pas = -pas; oppose = lq; gradient = abs(lq - lm); }
    vec2 bord = vUv + (horizontal ? vec2(0.0, pas * 0.5) : vec2(pas * 0.5, 0.0));
    vec2 le_long = horizontal ? vec2(t.x, 0.0) : vec2(0.0, t.y);
    float lbord = (lm + oppose) * 0.5, seuil = gradient * 0.25;
    vec2 p = bord + le_long * PAS[0];
    float dp = lum(p) - lbord;
    bool finp = abs(dp) >= seuil;
    for (int i = 1; i < 6 && !finp; i++) { p += le_long * PAS[i]; dp = lum(p) - lbord; finp = abs(dp) >= seuil; }
    if (!finp) p += le_long * 8.0;
    vec2 n = bord - le_long * PAS[0];
    float dn = lum(n) - lbord;
    bool finn = abs(dn) >= seuil;
    for (int i = 1; i < 6 && !finn; i++) { n -= le_long * PAS[i]; dn = lum(n) - lbord; finn = abs(dn) >= seuil; }
    if (!finn) n -= le_long * 8.0;
    float distp = horizontal ? p.x - vUv.x : p.y - vUv.y, distn = horizontal ? vUv.x - n.x : vUv.y - n.y;
    bool signe = distp <= distn ? dp >= 0.0 : dn >= 0.0;
    float bordM = signe == (lm - lbord >= 0.0) ? 0.0 : 0.5 - min(distp, distn) / (distp + distn);
    float b = max(melange, bordM);
    if (b > 0.0) m = mix(m, ecran(vUv + (horizontal ? vec2(0.0, pas) : vec2(pas, 0.0))), b);
  }
#endif
  gl_FragColor = vec4(m, 1.0);
}`;

/** Noyaux des cinq niveaux du halo (`UnrealBloomPass`), facteurs de composition. */
const NOYAUX = [6, 10, 14, 18, 22];
const FACTEURS = [1.0, 0.8, 0.6, 0.4, 0.2];

/** Le flou d'un niveau : poids du centre, décalages et poids des lectures filtrées (prises voisines fusionnées), comme `UnrealBloomPass`. */
export function noyau(rayon: number): { centre: number; decalages: number[]; poids: number[] } {
  const sigma = rayon / 3;
  const c: number[] = [];
  for (let i = 0; i < rayon; i++) c.push((0.39894 * Math.exp((-0.5 * i * i) / (sigma * sigma))) / sigma);
  const decalages: number[] = [];
  const poids: number[] = [];
  for (let i = 1; i < rayon; i += 2) {
    const a = c[i]!;
    const b = i + 1 < rayon ? c[i + 1]! : 0;
    decalages.push((i * a + (i + 1) * b) / (a + b));
    poids.push(a + b);
  }
  while (decalages.length < 11) decalages.push(0), poids.push(0);
  return { centre: c[0]!, decalages, poids };
}

/** Les cibles de la scène, dans l'ordre des essais (une cible refusée par la carte graphique : la suivante). */
function cibleScene(w: number, h: number, format: FormeChaine["format"], echantillons: number): WebGLRenderTarget {
  return format === "r11" ? new WebGLRenderTarget(w, h, { format: RGBFormat, type: UnsignedInt101111Type, samples: echantillons }) : new WebGLRenderTarget(w, h, { type: HalfFloatType, samples: echantillons });
}

const passe = (fragmentShader: string, uniforms: Record<string, { value: unknown }>, defines: Record<string, string | number> = {}) =>
  new ShaderMaterial({ vertexShader: SOMMETS, fragmentShader, uniforms, defines, depthTest: false, depthWrite: false });

/** Le halo léger : les lumières fortes, cinq niveaux floutés à des résolutions décroissantes, composés à la première ; aucune passe à la taille de l'écran. */
class Halo {
  private readonly clairs: ShaderMaterial;
  private readonly flou = passe(FLOU, { tSource: { value: null }, uPas: { value: [0, 0] }, uCentre: { value: 0 }, uPaires: { value: 0 }, uDecalages: { value: [] }, uPoids: { value: [] } });
  private readonly compose: ShaderMaterial;
  private readonly noyaux: ReturnType<typeof noyau>[];
  /** Pour chaque niveau : la cible du flou horizontal, puis du vertical. */
  private readonly niveaux: [WebGLRenderTarget, WebGLRenderTarget][] = [];
  private readonly clair = new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthBuffer: false });

  constructor(private readonly forme: FormeChaine) {
    this.clairs = passe(CLAIRS, { tScene: { value: null }, uTexel: { value: [0, 0] }, uSeuil: { value: 1 } }, forme.haloDepart === 2 ? { QUART: 1 } : {});
    const n = Math.max(1, Math.min(5, forme.haloNiveaux));
    this.noyaux = NOYAUX.slice(0, n).map(noyau);
    const u: Record<string, { value: unknown }> = { uN: { value: [0, 0, 0, 0, 0] } };
    for (let i = 0; i < 5; i++) u[`tN${i}`] = { value: null };
    this.compose = passe(COMPOSE, u, { NIVEAUX: n });
    for (let i = 0; i < n; i++) this.niveaux.push([0, 1].map(() => new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthBuffer: false })) as [WebGLRenderTarget, WebGLRenderTarget]);
  }

  /** La texture du halo composé (à lire par la passe de fin). */
  get texture(): Texture {
    return this.niveaux[0]![0].texture;
  }

  materiaux(): ShaderMaterial[] {
    return [this.clairs, this.flou, this.compose];
  }

  taille(w: number, h: number) {
    let x = Math.max(1, Math.round(w / 2 ** this.forme.haloDepart));
    let y = Math.max(1, Math.round(h / 2 ** this.forme.haloDepart));
    this.clair.setSize(x, y);
    for (const [a, b] of this.niveaux) {
      a.setSize(x, y);
      b.setSize(x, y);
      x = Math.max(1, Math.round(x / 2));
      y = Math.max(1, Math.round(y / 2));
    }
  }

  /** Pixels de toutes les cibles du halo (mémoire). */
  pixels(): number {
    return [this.clair, ...this.niveaux.flat()].reduce((s, c) => s + c.width * c.height, 0);
  }

  rendre(r: WebGLRenderer, quad: Mesh, camera: Camera, scene: Texture, w: number, h: number, t: Pick<Theme3, "halo">) {
    const dessiner = (m: ShaderMaterial, cible: WebGLRenderTarget) => {
      quad.material = m;
      r.setRenderTarget(cible);
      r.render(quad, camera);
    };
    const c = this.clairs.uniforms;
    c.tScene!.value = scene;
    c.uTexel!.value = [1 / w, 1 / h];
    c.uSeuil!.value = t.halo.seuil;
    dessiner(this.clairs, this.clair);
    let source = this.clair;
    const f = this.flou.uniforms;
    this.niveaux.forEach(([hor, ver], i) => {
      const k = this.noyaux[i]!;
      f.uCentre!.value = k.centre;
      f.uPaires!.value = Math.ceil((NOYAUX[i]! - 1) / 2);
      f.uDecalages!.value = k.decalages;
      f.uPoids!.value = k.poids;
      f.tSource!.value = source.texture;
      f.uPas!.value = [1 / hor.width, 0];
      dessiner(this.flou, hor);
      f.tSource!.value = hor.texture;
      f.uPas!.value = [0, 1 / ver.height];
      dessiner(this.flou, ver);
      source = ver;
    });
    const u = this.compose.uniforms;
    this.niveaux.forEach(([, ver], i) => (u[`tN${i}`]!.value = ver.texture));
    u.uN!.value = FACTEURS.map((x) => t.halo.force * (x + (1.2 - 2 * x) * t.halo.rayon));
    dessiner(this.compose, this.niveaux[0]![0]);
  }

  dispose() {
    for (const c of [this.clair, ...this.niveaux.flat()]) c.dispose();
    for (const m of this.materiaux()) m.dispose();
  }
}

const octetsScene = (format: FormeChaine["format"], echantillons: number) => {
  const couleur = format === "r11" ? 4 : 8;
  return echantillons > 0 ? couleur + echantillons * (couleur + 4) : couleur + 4;
};

/** La chaîne de post-traitement d'un moteur de rendu : créée une fois, ses passes à la demande, à la taille de l'image. */
export class ChainePost {
  /** La cible de la scène (lecture : tests, `?debug`). */
  scene: WebGLRenderTarget | null = null;
  private halo: Halo | null = null;
  private readonly fins = new Map<string, ShaderMaterial>();
  private readonly quad: Mesh;
  private w = 0;
  private h = 0;
  /** Les cibles à essayer, dans l'ordre : celle de la forme, puis en demi-flottants, puis sans multi-échantillonnage. */
  private essais: { format: FormeChaine["format"]; echantillons: number }[];
  private verifiee = false;
  /** Ce que la dernière image a dessiné : appels et triangles de la scène seule (sans les passes), pour `?debug`. */
  appels = 0;
  triangles = 0;
  /** Banc d'essai : chronométrer les passes (scène, halo, fin) sur la carte graphique. */
  chrono: ChronoPasses | null = null;

  constructor(
    private readonly renderer: WebGLRenderer,
    readonly forme: Readonly<FormeChaine> = FORME_JEU,
  ) {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.quad = new Mesh(g);
    this.quad.frustumCulled = false;
    const e = forme.echantillons;
    this.essais = [{ format: forme.format, echantillons: e }, ...(forme.format === "r11" ? [{ format: "demi" as const, echantillons: e }] : []), ...(e > 0 ? [{ format: "demi" as const, echantillons: 0 }] : [])];
  }

  /** Le format et le multi-échantillonnage de la cible de la scène (`?debug`, banc). */
  get cible(): { format: FormeChaine["format"]; echantillons: number } {
    return { format: this.essais[0]!.format, echantillons: this.scene?.samples ?? 0 };
  }

  private taille(w: number, h: number) {
    const e = this.essais[0]!;
    const n = w * h > PIXELS_MSAA ? 0 : e.echantillons;
    if (w === this.w && h === this.h && this.scene && this.scene.samples === n) return;
    this.w = w;
    this.h = h;
    if (!this.scene || this.scene.samples !== n) {
      this.scene?.dispose();
      this.scene = cibleScene(w, h, e.format, n);
      this.verifiee = false;
    } else this.scene.setSize(w, h);
    this.halo?.taille(w, h);
  }

  /** La cible est-elle acceptée par la carte graphique ? Sinon la suivante (demi-flottants, puis sans multi-échantillonnage) ; plus rien : faux. */
  private verifier(w: number, h: number): boolean {
    const r = this.renderer;
    while (!this.verifiee) {
      this.taille(w, h);
      r.setRenderTarget(this.scene);
      const gl = r.getContext();
      const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      r.setRenderTarget(null);
      if (ok) this.verifiee = true;
      else {
        this.scene?.dispose();
        this.scene = null;
        this.essais.shift();
        if (this.essais.length === 0) return false;
      }
    }
    return true;
  }

  private fin(halo: boolean, etalonnage: boolean, fxaa: boolean): ShaderMaterial {
    const cle = `${+halo}${+etalonnage}${+fxaa}`;
    let m = this.fins.get(cle);
    if (!m) {
      const defines: Record<string, number> = {};
      if (halo) defines.HALO = 1;
      if (etalonnage) defines.ETALONNAGE = 1;
      if (fxaa) defines.FXAA = 1;
      m = passe(FIN, { tScene: { value: null }, tHalo: { value: null }, uTexel: { value: [0, 0] }, uContraste: { value: 1 }, uSaturation: { value: 1 }, uOmbres: { value: [0, 0, 0] }, uLumieres: { value: [0, 0, 0] } }, defines);
      this.fins.set(cle, m);
    }
    return m;
  }

  /**
   * Dessine `scene` vue par `camera` à l'écran (le canvas du moteur), à `w` × `h` pixels, avec les passes demandées. Rend faux si la carte graphique refuse
   * toutes les cibles (framebuffer incomplet) — rien n'est alors dessiné, l'appelant dessine directement.
   */
  rendre(scene: Object3D, camera: PerspectiveCamera, w: number, h: number, r: ReglagesPost): boolean {
    const renderer = this.renderer;
    if (!this.verifier(w, h)) return false;
    this.taille(w, h);
    const halo = r.halo && avecHalo(r.theme);
    if (halo && !this.halo) {
      this.halo = new Halo(this.forme);
      this.halo.taille(w, h);
    }
    const autoClear = renderer.autoClear;
    // Les compteurs du moteur couvrent toute l'image (la scène et ses passes) ; la scène seule : `appels`.
    renderer.info.autoReset = false;
    renderer.info.reset();
    renderer.autoClear = false;
    try {
      renderer.toneMappingExposure = r.exposition;
      this.chrono?.debut("scene");
      renderer.setRenderTarget(this.scene);
      renderer.clear();
      SORTIE_LINEAIRE.value = 1;
      renderer.render(scene, camera);
      SORTIE_LINEAIRE.value = 0;
      this.chrono?.fin();
      this.appels = renderer.info.render.calls;
      this.triangles = renderer.info.render.triangles;
      if (halo) {
        this.chrono?.debut("halo");
        this.halo!.rendre(renderer, this.quad, camera, this.scene!.texture, w, h, r.theme);
        this.chrono?.fin();
      }
      this.chrono?.debut("fin");
      const m = this.fin(halo, r.etalonnage, r.anticrenelage);
      const u = m.uniforms;
      u.tScene!.value = this.scene!.texture;
      u.tHalo!.value = halo ? this.halo!.texture : null;
      u.uTexel!.value = [1 / w, 1 / h];
      const e = r.theme.etalonnage;
      u.uContraste!.value = e.contraste;
      u.uSaturation!.value = e.saturation;
      u.uOmbres!.value = e.ombres;
      u.uLumieres!.value = e.lumieres;
      this.quad.material = m;
      renderer.setRenderTarget(null);
      renderer.render(this.quad, camera);
      this.chrono?.fin();
    } finally {
      SORTIE_LINEAIRE.value = 0;
      renderer.setRenderTarget(null);
      renderer.autoClear = autoClear;
      renderer.info.autoReset = true;
    }
    return true;
  }

  /**
   * **Hors course** : compile d'avance les programmes de la scène dans la cible (lumière linéaire, sans tonalité : d'autres programmes qu'à l'écran) et ceux
   * des passes, sans rien dessiner (`compileAsync` : en parallèle quand la carte graphique le permet). Rien ne se compilera ensuite en pleine course.
   */
  async preparer(scene: Object3D, camera: PerspectiveCamera, w: number, h: number, r: Pick<ReglagesPost, "halo" | "etalonnage" | "anticrenelage" | "theme">): Promise<void> {
    if (!this.verifier(w, h)) return;
    const renderer = this.renderer;
    const halo = r.halo && avecHalo(r.theme);
    if (halo && !this.halo) {
      this.halo = new Halo(this.forme);
      this.halo.taille(w, h);
    }
    const promesses: Promise<unknown>[] = [];
    const avec = (cible: WebGLRenderTarget | null, s: Object3D) => {
      renderer.setRenderTarget(cible);
      promesses.push(renderer.compileAsync(s, camera));
    };
    const passes = (ms: ShaderMaterial[]) => {
      const s = new Scene();
      for (const m of ms) s.add(new Mesh(this.quad.geometry, m));
      return s;
    };
    try {
      avec(this.scene, scene);
      if (halo) avec(this.scene, passes(this.halo!.materiaux()));
      avec(null, passes([this.fin(halo, r.etalonnage, r.anticrenelage)]));
    } finally {
      renderer.setRenderTarget(null);
    }
    await Promise.all(promesses);
  }

  /**
   * Mémoire des cibles de la chaîne (octets, estimée) : la cible de la scène (multi-échantillonnée et sa profondeur) et celles du halo ; la passe de fin n'en a
   * pas. Sur une carte graphique à carreaux, les échantillons restent souvent dans la puce : un plafond.
   */
  octets(r: Pick<ReglagesPost, "halo" | "theme">): number {
    const s = this.scene ? this.scene.width * this.scene.height * octetsScene(this.cible.format, this.scene.samples) : 0;
    return Math.round(s + (r.halo && avecHalo(r.theme) && this.halo ? this.halo.pixels() * 8 : 0));
  }

  dispose() {
    this.scene?.dispose();
    this.halo?.dispose();
    for (const m of this.fins.values()) m.dispose();
    this.quad.geometry.dispose();
    this.scene = null;
    this.halo = null;
    this.fins.clear();
    this.w = this.h = 0;
    this.verifiee = false;
  }
}

/** Octets par pixel de la scène et du halo (au quart des pixels de l'écran, puis ses niveaux) : le calcul du README (`octets()` à l'échelle d'une image). */
export const octetsParPixel = (echantillons: number, halo = true, format: FormeChaine["format"] = "r11"): number => octetsScene(format, echantillons) + (halo ? 8 * (2 * (1 / 4) * (4 / 3) + 1 / 4) : 0);
