// Retouche 38b, lot 47 — la chaîne de post-traitement du palier 3 (ordinateur seulement) : **halo** des lumières fortes (bloom), tonalité, **étalonnage** par
// thème, **anticrénelage FXAA**, chacun commutable. **Ni occlusion GTAO ni SMAA** (décisions de Nathan du 22/10/2026 : l'occlusion redessine toute la scène pour un
// gain que l'occlusion par sommets donne déjà ; FXAA pèse 2 ko contre 38 et tient en une passe). La scène est dessinée dans une cible en demi-flottants
// multi-échantillonnée (MSAA ×4, comme l'écran du jeu : le FXAA vient en plus), puis les passes se renvoient deux cibles. La charte « Cartouches » (ni flou, ni
// transparence, ni dégradé) vaut pour l'interface ; pour la scène, c'est Nathan qui a décidé (halo : oui).
//
// Les cibles ont **la taille réelle de l'image** (le tampon de dessin du moteur : largeur × hauteur × densité) et suivent ses changements de taille. Au-delà de
// `PIXELS_MSAA` (≈ 2,8 millions : plus qu'un écran 1080p, moins qu'un 1440p) la scène n'est plus multi-échantillonnée : le FXAA reste, la mémoire ne grimpe pas.
// Mémoire : `octets()` (calculée, un plafond : les échantillons du MSAA restent souvent dans la puce).
//
// Coût : surtout la carte graphique (des passes plein écran) et la mémoire des cibles ; le rendu logiciel de la CI n'en dit qu'une partie.
import { HalfFloatType, Vector2, WebGLRenderTarget, type PerspectiveCamera, type Scene, type WebGLRenderer } from "three";
import { FXAAPass } from "three/examples/jsm/postprocessing/FXAAPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import type { Pass } from "three/examples/jsm/postprocessing/Pass.js";
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

/** Pixels au-delà desquels la scène n'est plus multi-échantillonnée (le FXAA reste) : 1080p oui (2,07 millions), 1440p non (3,69). */
export const PIXELS_MSAA = 2_800_000;

/** L'étalonnage : contraste, saturation et teinte des ombres et des lumières, appliqués après la tonalité (couleurs de l'écran). */
const ETALONNAGE = {
  name: "Etalonnage",
  uniforms: {
    tDiffuse: { value: null },
    uContraste: { value: 1 },
    uSaturation: { value: 1 },
    uOmbres: { value: [0, 0, 0] },
    uLumieres: { value: [0, 0, 0] },
  },
  vertexShader: /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse;
uniform float uContraste;
uniform float uSaturation;
uniform vec3 uOmbres;
uniform vec3 uLumieres;
varying vec2 vUv;
void main() {
  vec4 t = texture2D(tDiffuse, vUv);
  vec3 c = t.rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSaturation);
  c = (c - 0.5) * uContraste + 0.5;
  c += uOmbres * (1.0 - smoothstep(0.0, 0.55, l)) + uLumieres * smoothstep(0.45, 1.0, l);
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), t.a);
}`,
};

const pixels = (rt: WebGLRenderTarget | null | undefined, octetsParPixel: number) => (rt ? rt.width * rt.height * octetsParPixel : 0);

/**
 * Octets par pixel de la cible de la scène : multi-échantillonnée, la cible résolue en demi-flottants (8) et par échantillon un demi-flottant (8) et la profondeur (4) ;
 * sans multi-échantillonnage, la cible (8) et sa profondeur (4).
 */
const octetsScene = (echantillons: number) => (echantillons > 0 ? 8 + echantillons * (8 + 4) : 8 + 4);

/** La chaîne de post-traitement d'un moteur de rendu : créée une fois, ses passes à la demande, à la taille de l'image. */
export class ChainePost {
  /** La cible de la scène (lecture : tests, `?debug`). */
  scene: WebGLRenderTarget | null = null;
  private a: WebGLRenderTarget | null = null;
  private b: WebGLRenderTarget | null = null;
  private bloom: UnrealBloomPass | null = null;
  private sortie: OutputPass | null = null;
  private grade: ShaderPass | null = null;
  private fxaa: FXAAPass | null = null;
  private w = 0;
  private h = 0;
  /** Échantillons voulus pour la scène (4, ou 0 au-delà de `PIXELS_MSAA` ou si la carte graphique a refusé la cible multi-échantillonnée). */
  private echantillons = 4;
  private verifiee = false;
  /** Ce que la dernière image a dessiné : appels et triangles de la scène seule (sans les passes), pour `?debug`. */
  appels = 0;
  triangles = 0;

  constructor(private readonly renderer: WebGLRenderer) {}

  /** Échantillons de la cible de la scène à cette taille. */
  private voulus(w: number, h: number): number {
    return w * h > PIXELS_MSAA ? 0 : this.echantillons;
  }

  private taille(w: number, h: number) {
    const n = this.voulus(w, h);
    if (w === this.w && h === this.h && this.scene && this.scene.samples === n) return;
    this.w = w;
    this.h = h;
    if (!this.scene || this.scene.samples !== n) {
      this.scene?.dispose();
      this.scene = new WebGLRenderTarget(w, h, { type: HalfFloatType, samples: n });
      this.verifiee = false;
    } else this.scene.setSize(w, h);
    if (!this.a) {
      this.a = new WebGLRenderTarget(w, h, { type: HalfFloatType, depthBuffer: false });
      this.b = new WebGLRenderTarget(w, h, { type: HalfFloatType, depthBuffer: false });
    } else {
      this.a.setSize(w, h);
      this.b!.setSize(w, h);
    }
    this.bloom?.setSize(w, h);
    this.fxaa?.setSize(w, h);
  }

  /**
   * Dessine `scene` vue par `camera` à l'écran (le canvas du moteur), à `w` × `h` pixels, avec les passes demandées. Rend faux si la carte graphique refuse la
   * cible (framebuffer incomplet : demi-flottants non rendables, mémoire) — rien n'est alors dessiné, l'appelant dessine directement ; une cible multi-échantillonnée
   * refusée est d'abord retentée sans multi-échantillonnage.
   */
  rendre(scene: Scene, camera: PerspectiveCamera, w: number, h: number, r: ReglagesPost): boolean {
    const renderer = this.renderer;
    this.taille(w, h);
    if (!this.verifiee) {
      renderer.setRenderTarget(this.scene);
      const gl = renderer.getContext();
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        renderer.setRenderTarget(null);
        if (this.scene!.samples > 0) {
          this.echantillons = 0;
          this.taille(w, h);
          return this.rendre(scene, camera, w, h, r);
        }
        return false;
      }
      this.verifiee = true;
    }
    const passes: Pass[] = [];
    if (r.halo) {
      this.bloom ??= new UnrealBloomPass(new Vector2(w, h), 0.5, 0.4, 0.85);
      this.bloom.strength = r.theme.halo.force;
      this.bloom.threshold = r.theme.halo.seuil;
      this.bloom.radius = r.theme.halo.rayon;
      passes.push(this.bloom);
    }
    this.sortie ??= new OutputPass();
    passes.push(this.sortie);
    if (r.etalonnage) {
      this.grade ??= new ShaderPass(ETALONNAGE);
      const e = r.theme.etalonnage;
      const u = this.grade.uniforms as Record<string, { value: unknown }>;
      u.uContraste!.value = e.contraste;
      u.uSaturation!.value = e.saturation;
      u.uOmbres!.value = e.ombres;
      u.uLumieres!.value = e.lumieres;
      passes.push(this.grade);
    }
    if (r.anticrenelage) {
      this.fxaa ??= new FXAAPass();
      this.fxaa.setSize(w, h);
      passes.push(this.fxaa);
    }
    // La scène dans sa cible (tonalité et espace de couleur : par la passe de sortie). Les compteurs du moteur sont remis à zéro une fois par image, pas à
    // chaque `render` : `info.render.calls` donne la scène et ses passes (la scène seule : `appels`).
    renderer.info.autoReset = false;
    renderer.info.reset();
    try {
      renderer.toneMappingExposure = r.exposition;
      renderer.setRenderTarget(this.scene);
      renderer.clear();
      renderer.render(scene, camera);
      this.appels = renderer.info.render.calls;
      this.triangles = renderer.info.render.triangles;
      let lire = this.scene!;
      let ecrire = this.a!;
      for (let i = 0; i < passes.length; i++) {
        const p = passes[i]!;
        p.renderToScreen = i === passes.length - 1;
        p.render(renderer, ecrire, lire, 0, false);
        if (p.needsSwap) {
          lire = ecrire;
          ecrire = ecrire === this.a ? this.b! : this.a!;
        }
      }
    } finally {
      renderer.setRenderTarget(null);
      renderer.info.autoReset = true;
    }
    return true;
  }

  /**
   * Mémoire des cibles de la chaîne (octets, estimée) : la cible de la scène (demi-flottants, multi-échantillonnée et sa profondeur), les deux cibles des passes,
   * celles du halo (chaîne de demi-résolutions) ; le FXAA n'a pas de cible. Sur une carte graphique à carreaux, les échantillons du MSAA restent souvent dans la
   * puce : ce chiffre est un plafond.
   */
  octets(r: Pick<ReglagesPost, "halo">): number {
    let o = pixels(this.scene, octetsScene(this.scene?.samples ?? 0)) + pixels(this.a, 8) + pixels(this.b, 8);
    if (r.halo) o += this.w * this.h * 8 * 0.95;
    return Math.round(o);
  }

  dispose() {
    this.scene?.dispose();
    this.a?.dispose();
    this.b?.dispose();
    this.bloom?.dispose();
    this.sortie?.dispose();
    this.grade?.dispose();
    this.fxaa?.dispose();
    this.scene = this.a = this.b = null;
    this.bloom = null;
    this.sortie = null;
    this.grade = null;
    this.fxaa = null;
    this.w = this.h = 0;
    this.verifiee = false;
  }
}

/** Octets par pixel de la chaîne complète (halo compris) avec ou sans multi-échantillonnage : le calcul du README (`octets()` à l'échelle d'une image). */
export const octetsParPixel = (echantillons: number, halo = true): number => octetsScene(echantillons) + 16 + (halo ? 8 * 0.95 : 0);
