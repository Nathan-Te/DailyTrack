import { DepthTexture, FloatType, HalfFloatType, LinearFilter, ShaderMaterial, UniformsUtils, Vector2, WebGLRenderTarget, UnsignedByteType, type PerspectiveCamera, type Scene, type WebGLRenderer } from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";
import { CALQUE_COQUE, CONTOUR_PX_1080, regler } from "./cel";
import { ENCRE } from "./palette";

// Le pipeline de rendu de Rush (lot BR0c), à DEUX niveaux de qualité. **Chargé à la demande** (avec la scène : `corps.ts`).
//  · HAUTE : la scène est dessinée dans une cible en virgule flottante (avec sa profondeur) ; puis, à demi-résolution, le BLOOM (ce qui dépasse 1 : les yeux du golem, les éclats, les bords des cercles), un flou séparable en deux passes ;
//    puis UNE passe de composition (le contour d'après la PROFONDEUR : un trait fin et régulier de ~2,5 px à 1080 sur les silhouettes seulement ; le bloom ; l'étalonnage chaud ; le vignettage ; le passage en sRGB) ; puis le FXAA.
//    Les OMBRES PORTÉES (une lumière directionnelle, une carte d'ombre de 1024 serrée sur l'arène) sont allumées.
//  · BASSE : la scène est dessinée directement à l'écran (anticrénelage matériel), sans post-traitement ni carte d'ombre : les ombres sont des disques doux sous les personnages et le contour est la coque inversée à épaisseur constante à l'écran.
// Le contour par la profondeur se lit sur la dérivée seconde de 1/z (nulle sur tout plan, même en perspective : seules les silhouettes et les arêtes vives de la profondeur la font monter).

export type Qualite = "haute" | "basse";

/**
 * Lot BR-A3 : la demi-largeur du contour du post-traitement, en pixels PHYSIQUES, pour une image de `h` pixels physiques de haut (la hauteur CSS × la densité de pixels) : le trait fait toujours
 * `CONTOUR_PX_1080` / 1080 de la hauteur de l'image, quelles que soient la définition, la densité de pixels et le plein écran. Le décalage peut être NON ENTIER (la profondeur est interpolée entre texels : `invX`, `invY`),
 * donc aucun plancher : le plancher d'un pixel du lot BR0c épaississait le trait sous 864 pixels de haut, et l'arrondi au texel le changeait d'une définition à l'autre (`test/clipsTiers.test.ts`).
 * L'interpolation élargit la bande détectée d'un texel : le trait vaut 2 × la demi-largeur + 1 texel ; on retire ce texel pour que le TRAIT ENTIER reste `CONTOUR_PX_1080` / 1080 de la hauteur (mesuré : `mesure_contour.py`).
 */
export function demiLargeurContour(h: number): number {
  return Math.max(0.2, ((CONTOUR_PX_1080 * h) / 1080 - 1) / 2);
}
/** Le trait entier (pixels physiques) pour une demi-largeur donnée : la bande détectée. */
export const traitContour = (h: number): number => 2 * demiLargeurContour(h) + 1;

const VERTEX = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";

/** Un flou gaussien à 9 coups sur une direction ; le premier passage applique en plus le seuil du bloom (ce qui dépasse 1 en lumière linéaire). */
const FLOU = (premier: boolean): string => `
  varying vec2 vUv; uniform sampler2D tex; uniform vec2 dir;
  vec3 prise(vec2 uv){ vec3 c = texture2D(tex, uv).rgb; ${premier ? "return max(c - vec3(0.92), vec3(0.0));" : "return c;"} }
  void main(){
    vec3 s = prise(vUv) * 0.2270;
    s += (prise(vUv + dir * 1.3846) + prise(vUv - dir * 1.3846)) * 0.3162;
    s += (prise(vUv + dir * 3.2308) + prise(vUv - dir * 3.2308)) * 0.0703;
    gl_FragColor = vec4(s, 1.0);
  }`;

const COMPOSITION = `
  varying vec2 vUv;
  uniform sampler2D tScene; uniform sampler2D tProfondeur; uniform sampler2D tBloom;
  uniform vec2 px; uniform float proche; uniform float loin; uniform float largeur; uniform vec3 encre; uniform vec3 teinte;
  uniform float vignette; uniform float forceBloom; uniform float saturation; uniform float contraste;
  float inv(vec2 uv){ float z = texture2D(tProfondeur, uv).r * 2.0 - 1.0; return (loin + proche - z * (loin - proche)) / (2.0 * proche * loin); }
  // Lot BR-A3 : 1/z à un décalage NON ENTIER de texels (la profondeur se lit au plus proche) : interpolé entre les deux texels voisins, en 1/z (linéaire à l'écran sur un plan : un plan reste à zéro).
  // Sans cela, le décalage s'arrondissait (1,67 px à 1 440 de haut devenait 2) : le trait changeait d'épaisseur d'une définition à l'autre.
  float invX(vec2 uv){ float t = uv.x / px.x - 0.5; float b = floor(t); return mix(inv(vec2((b + 0.5) * px.x, uv.y)), inv(vec2((b + 1.5) * px.x, uv.y)), t - b); }
  float invY(vec2 uv){ float t = uv.y / px.y - 0.5; float b = floor(t); return mix(inv(vec2(uv.x, (b + 0.5) * px.y)), inv(vec2(uv.x, (b + 1.5) * px.y)), t - b); }
  vec3 srgb(vec3 c){ return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c)); }
  void main(){
    vec4 brut = texture2D(tScene, vUv);
    vec3 c = brut.rgb + texture2D(tBloom, vUv).rgb * forceBloom;
    // Lot BR-A3 : un modèle TEXTURÉ porte sa marque dans l'alpha (MARQUE_TEXTURE de cel.ts) : on n'y trace que la silhouette, jamais de trait intérieur (la texture dessine déjà ses détails).
    float texture_ = step(brut.a, 0.75);
    // Étalonnage chaud : une teinte, un peu de saturation, une courbe douce, l'épaule des hautes lumières.
    c *= teinte;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(l), c, saturation);
    c = max((c - 0.45) * contraste + 0.45, vec3(0.0));
    vec3 haut = max(c - vec3(0.8), vec3(0.0));
    c = min(c, vec3(0.8)) + vec3(0.2) * (vec3(1.0) - exp(-haut * 5.0));
    vec2 q = vUv * 2.0 - 1.0;
    c *= 1.0 - vignette * smoothstep(0.55, 1.45, dot(q, q * vec2(0.8, 1.0)));
    vec3 o = srgb(c);
    // Le contour : la dérivée seconde de 1/z, sur deux axes, à \`largeur\` pixels.
    vec2 d = px * largeur;
    float c0 = inv(vUv);
    float e = (abs(invX(vUv - vec2(d.x, 0.0)) + invX(vUv + vec2(d.x, 0.0)) - 2.0 * c0) + abs(invY(vUv - vec2(0.0, d.y)) + invY(vUv + vec2(0.0, d.y)) - 2.0 * c0)) / c0;
    // Deux traits (lot BR-A2) : la SILHOUETTE (un saut de profondeur : plein, il s'estompe dans la brume des îles lointaines) et les TRAITS INTÉRIEURS (un pli de la profondeur sans saut : les arêtes d'un bloc, le contour d'une plaque) — plus fins en intensité,
    // qui s'éteignent avec la distance : un décor dense ne se couvre pas de bruit.
    float dist = 1.0 / max(c0, 1e-5);
    float sil = smoothstep(0.0009, 0.0035, e) * (1.0 - 0.75 * smoothstep(80.0, 150.0, dist));
    float pli = smoothstep(0.00035, 0.0012, e) * (1.0 - smoothstep(0.0009, 0.0035, e)) * (1.0 - smoothstep(28.0, 62.0, dist)) * 0.55 * (1.0 - texture_);
    o = mix(o, srgb(encre), max(sil * 0.96, pli));
    gl_FragColor = vec4(o, 1.0);
  }`;

/** La force du bloom, l'étalonnage et le vignettage (par défaut ; la palette du thème peut les changer). */
export interface ReglageRendu {
  bloom: number;
  vignette: number;
  teinte: [number, number, number];
  /** Lot BR-A2 : la saturation (1 : inchangée) et le contraste autour du gris moyen (1 : inchangé). */
  saturation: number;
  contraste: number;
}
export const RENDU_DEFAUT: ReglageRendu = { bloom: 1.1, vignette: 0.22, teinte: [1.0, 1.0, 0.97], saturation: 1, contraste: 1 };

const encre = (hex: number): [number, number, number] => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255].map((v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))) as [number, number, number];

export class Rendu {
  qualite: Qualite;
  private largeur = 2;
  private hauteur = 2;
  private ratio = 1;
  private scene: WebGLRenderTarget | null = null;
  private b1: WebGLRenderTarget | null = null;
  private b2: WebGLRenderTarget | null = null;
  private ldr: WebGLRenderTarget | null = null;
  private readonly quad = new FullScreenQuad();
  private readonly seuil: ShaderMaterial;
  private readonly flouV: ShaderMaterial;
  private readonly compo: ShaderMaterial;
  private readonly fxaa: ShaderMaterial;
  reglage: ReglageRendu = { ...RENDU_DEFAUT };

  constructor(
    private readonly renderer: WebGLRenderer,
    private readonly sceneTHREE: Scene,
    private readonly camera: PerspectiveCamera,
    qualite: Qualite,
  ) {
    this.qualite = qualite;
    this.seuil = new ShaderMaterial({ vertexShader: VERTEX, fragmentShader: FLOU(true), uniforms: { tex: { value: null }, dir: { value: new Vector2() } }, depthTest: false, depthWrite: false });
    this.flouV = new ShaderMaterial({ vertexShader: VERTEX, fragmentShader: FLOU(false), uniforms: { tex: { value: null }, dir: { value: new Vector2() } }, depthTest: false, depthWrite: false });
    this.compo = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: COMPOSITION,
      uniforms: {
        tScene: { value: null },
        tProfondeur: { value: null },
        tBloom: { value: null },
        px: { value: new Vector2() },
        proche: { value: 1 },
        loin: { value: 100 },
        largeur: { value: 1.25 },
        encre: { value: encre(ENCRE) },
        teinte: { value: [1.0, 1.0, 0.97] },
        vignette: { value: 0.22 },
        forceBloom: { value: 1.1 },
        saturation: { value: 1 },
        contraste: { value: 1 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.fxaa = new ShaderMaterial({ vertexShader: VERTEX, fragmentShader: FXAAShader.fragmentShader, uniforms: UniformsUtils.clone(FXAAShader.uniforms), depthTest: false, depthWrite: false });
    this.definir(qualite);
  }

  /** Change de niveau de qualité (une seule fois dans le sens « haute → basse » quand les images par seconde chutent). */
  definir(q: Qualite): void {
    this.qualite = q;
    const haute = q === "haute";
    this.renderer.shadowMap.enabled = haute;
    // La coque de contour n'est dessinée qu'en basse qualité (calque 1 de la caméra) ; en haute, le contour vient de la profondeur.
    if (haute) this.camera.layers.disable(CALQUE_COQUE);
    else this.camera.layers.enable(CALQUE_COQUE);
    if (haute) this.allouer();
    else this.liberer();
  }

  /** Les dimensions de l'image en pixels CSS et le rapport de pixels de l'écran. */
  taille(largeur: number, hauteur: number, ratio: number): void {
    this.largeur = Math.max(2, Math.floor(largeur * ratio));
    this.hauteur = Math.max(2, Math.floor(hauteur * ratio));
    this.ratio = ratio;
    regler(largeur, hauteur, ratio);
    if (this.qualite === "haute") {
      this.liberer();
      this.allouer();
    }
  }

  private allouer(): void {
    if (this.scene) return;
    const w = this.largeur;
    const h = this.hauteur;
    // Lot BR-A3 : une profondeur en VIRGULE FLOTTANTE (32 bits) : le contour lit la dérivée seconde de 1/z, qu'une profondeur de 16 ou 24 bits rendrait bruitée sur un grand écran (des traits partout).
    const profondeur = new DepthTexture(w, h, FloatType);
    this.scene = new WebGLRenderTarget(w, h, { type: HalfFloatType, depthBuffer: true, depthTexture: profondeur, minFilter: LinearFilter, magFilter: LinearFilter });
    const moitie = { type: HalfFloatType, depthBuffer: false, minFilter: LinearFilter, magFilter: LinearFilter } as const;
    this.b1 = new WebGLRenderTarget(Math.max(2, w >> 1), Math.max(2, h >> 1), moitie);
    this.b2 = new WebGLRenderTarget(Math.max(2, w >> 1), Math.max(2, h >> 1), moitie);
    this.ldr = new WebGLRenderTarget(w, h, { type: UnsignedByteType, depthBuffer: false, minFilter: LinearFilter, magFilter: LinearFilter });
    this.fxaa.uniforms.resolution!.value.set(1 / w, 1 / h);
  }

  private liberer(): void {
    for (const t of [this.scene, this.b1, this.b2, this.ldr]) t?.dispose();
    this.scene = this.b1 = this.b2 = this.ldr = null;
  }

  private passe(m: ShaderMaterial, cible: WebGLRenderTarget | null): void {
    this.quad.material = m;
    this.renderer.setRenderTarget(cible);
    this.quad.render(this.renderer);
  }

  /** Dessine une image. */
  dessiner(): void {
    const r = this.renderer;
    if (this.qualite === "basse" || !this.scene) {
      r.setRenderTarget(null);
      r.render(this.sceneTHREE, this.camera);
      return;
    }
    const w = this.largeur;
    const h = this.hauteur;
    r.setRenderTarget(this.scene);
    r.clear();
    r.render(this.sceneTHREE, this.camera);
    // Bloom : le seuil et le flou horizontal à demi-résolution, puis le flou vertical.
    this.seuil.uniforms.tex!.value = this.scene.texture;
    this.seuil.uniforms.dir!.value.set(1 / w, 0);
    this.passe(this.seuil, this.b1);
    this.flouV.uniforms.tex!.value = this.b1!.texture;
    this.flouV.uniforms.dir!.value.set(0, 2 / h);
    this.passe(this.flouV, this.b2);
    // La composition.
    const u = this.compo.uniforms;
    u.tScene!.value = this.scene.texture;
    u.tProfondeur!.value = this.scene.depthTexture;
    u.tBloom!.value = this.b2!.texture;
    u.px!.value.set(1 / w, 1 / h);
    u.proche!.value = this.camera.near;
    u.loin!.value = this.camera.far;
    // Le trait fait ~2,5 px à 1080 de haut : la dérivée seconde est prise à la moitié de cette largeur de chaque côté.
    u.largeur!.value = demiLargeurContour(h);
    u.teinte!.value = this.reglage.teinte;
    u.vignette!.value = this.reglage.vignette;
    u.forceBloom!.value = this.reglage.bloom;
    u.saturation!.value = this.reglage.saturation;
    u.contraste!.value = this.reglage.contraste;
    this.passe(this.compo, this.ldr);
    this.fxaa.uniforms.tDiffuse!.value = this.ldr!.texture;
    this.passe(this.fxaa, null);
  }

  detruire(): void {
    this.liberer();
    this.quad.dispose();
    for (const m of [this.seuil, this.flouV, this.compo, this.fxaa]) m.dispose();
  }
}
