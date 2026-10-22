// Retouche 38b — palier 3, famille « post-traitement » : occlusion ambiante à l'écran (GTAO), halo des lumières (bloom), tonalité, étalonnage par
// thème, anticrénelage (SMAA), **chacun commutable**. La scène est dessinée dans une cible multi-échantillonnée (MSAA ×4, comme l'écran du jeu :
// allumer l'étalonnage seul ne perd pas l'anticrénelage du jeu), puis les passes se renvoient deux cibles. La charte « Cartouches » (ni flou, ni
// transparence, ni dégradé) vaut pour l'interface ; pour la scène, c'est Nathan qui décide : la vitrine montre chaque effet avec et sans.
//
// Coût : surtout la carte graphique (des passes plein écran) et la mémoire des cibles (comptée par `octets()`). Le rendu logiciel de la CI
// n'en dit qu'une partie : voir le README de la retouche 38b.
import { HalfFloatType, Vector2, WebGLRenderTarget, type Object3D, type PerspectiveCamera, type Scene, type WebGLRenderer } from "three";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import type { Pass } from "three/examples/jsm/postprocessing/Pass.js";
import type { Theme3 } from "./lumiere3";

/** Ce que la chaîne doit faire pour une image. */
export interface ReglagesPost {
  occlusion: boolean;
  halo: boolean;
  etalonnage: boolean;
  anticrenelage: boolean;
  theme: Theme3;
  /** Exposition du thème (tonalité). */
  exposition: number;
  /** Masqué pendant la passe d'occlusion (le dôme du ciel n'est pas une surface). */
  dome?: Object3D | null;
}

/** L'étalonnage : contraste, saturation et teinte des ombres et des lumières, appliqués après la tonalité (couleurs de l'écran). */
const ETALONNAGE = {
  name: "Etalonnage38b",
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

/** La chaîne de post-traitement d'un moteur de rendu : créée une fois, ses passes à la demande, à la taille de l'image. */
export class ChainePost {
  private scene: WebGLRenderTarget | null = null;
  private a: WebGLRenderTarget | null = null;
  private b: WebGLRenderTarget | null = null;
  private gtao: GTAOPass | null = null;
  private bloom: UnrealBloomPass | null = null;
  private sortie: OutputPass | null = null;
  private grade: ShaderPass | null = null;
  private smaa: SMAAPass | null = null;
  private w = 0;
  private h = 0;

  constructor(private readonly renderer: WebGLRenderer) {}

  private taille(w: number, h: number) {
    if (w === this.w && h === this.h && this.scene) return;
    this.w = w;
    this.h = h;
    if (!this.scene) {
      this.scene = new WebGLRenderTarget(w, h, { type: HalfFloatType, samples: 4 });
      this.a = new WebGLRenderTarget(w, h, { type: HalfFloatType, depthBuffer: false });
      this.b = new WebGLRenderTarget(w, h, { type: HalfFloatType, depthBuffer: false });
    } else {
      this.scene.setSize(w, h);
      this.a!.setSize(w, h);
      this.b!.setSize(w, h);
    }
    this.gtao?.setSize(w, h);
    this.bloom?.setSize(w, h);
    this.smaa?.setSize(w, h);
  }

  /** Dessine `scene` vue par `camera` à l'écran (le canvas du moteur), à `w` × `h` pixels, avec les passes demandées. */
  rendre(scene: Scene, camera: PerspectiveCamera, w: number, h: number, r: ReglagesPost) {
    const renderer = this.renderer;
    this.taille(w, h);
    const passes: Pass[] = [];
    if (r.occlusion) {
      this.gtao ??= Object.assign(new GTAOPass(scene, camera, w, h), { blendIntensity: 0.9 });
      this.gtao.scene = scene;
      this.gtao.camera = camera;
      this.gtao.updateGtaoMaterial({ radius: 1.6, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: 12 });
      passes.push(this.gtao);
    }
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
      this.smaa ??= new SMAAPass();
      this.smaa.setSize(w, h);
      passes.push(this.smaa);
    }
    // La scène dans sa cible (tonalité et espace de couleur : par la passe de sortie).
    renderer.toneMappingExposure = r.exposition;
    renderer.setRenderTarget(this.scene);
    renderer.clear();
    renderer.render(scene, camera);
    let lire = this.scene!;
    let ecrire = this.a!;
    for (let i = 0; i < passes.length; i++) {
      const p = passes[i]!;
      p.renderToScreen = i === passes.length - 1;
      const dome = p === this.gtao && r.dome ? r.dome : null;
      if (dome) dome.visible = false;
      p.render(renderer, ecrire, lire, 0, false);
      if (dome) dome.visible = true;
      if (p.needsSwap) {
        lire = ecrire;
        ecrire = ecrire === this.a ? this.b! : this.a!;
      }
    }
    renderer.setRenderTarget(null);
  }

  /**
   * Mémoire des cibles de la chaîne (octets, estimée) : la cible de la scène (demi-flottants, MSAA ×4 et profondeur), les deux cibles des passes,
   * celles de l'occlusion, du halo (chaîne de demi-résolutions) et de l'anticrénelage. Sur un téléphone à carreaux, les échantillons du MSAA restent
   * souvent dans la puce : ce chiffre est un plafond.
   */
  octets(r: Pick<ReglagesPost, "occlusion" | "halo" | "anticrenelage">): number {
    let o = pixels(this.scene, 8 + 4 * (8 + 4)) + pixels(this.a, 8) + pixels(this.b, 8);
    if (r.occlusion && this.gtao) o += this.w * this.h * (4 + 4 + 4 + 4);
    if (r.halo) o += this.w * this.h * 8 * 0.95;
    if (r.anticrenelage) o += this.w * this.h * 8;
    return Math.round(o);
  }

  dispose() {
    this.scene?.dispose();
    this.a?.dispose();
    this.b?.dispose();
    this.gtao?.dispose();
    this.bloom?.dispose();
    this.sortie?.dispose();
    this.grade?.dispose();
    this.smaa?.dispose();
    this.scene = this.a = this.b = null;
    this.gtao = null;
    this.bloom = null;
    this.sortie = null;
    this.grade = null;
    this.smaa = null;
    this.w = this.h = 0;
  }
}
