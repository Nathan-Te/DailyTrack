// Retouche 38b — palier 3, famille « lumière » : la brume de profondeur (elle s'épaissit en contrebas et se teinte du soleil quand on le regarde),
// le ciel dessiné avec ses nuages, et les réglages par thème de tout le palier 3 (brume, nuages, particules, étalonnage, halo). Les ombres nettes
// et lointaines sont un réglage du compositeur (`composerPalier.ts`) ; l'occlusion, une passe de `post.ts`.
import { BackSide, CanvasTexture, Color, LinearFilter, Mesh, RepeatWrapping, ShaderMaterial, SphereGeometry, Vector3, type Material, type WebGLProgramParametersWithUniforms } from "three";
import type { PaletteName } from "@cdj/sim";
import { fractal, graine } from "./bruit";

/** Les particules d'un thème (`vie.ts`). */
export type SorteParticules = "poussiere" | "neige" | "lucioles" | "pollen" | "confettis" | "ville";

/** Le palier 3 d'un thème : brume, nuages, particules, étalonnage, halo. */
export interface Theme3 {
  /** Brume de profondeur : densité (par m) en bas, hauteur (m au-dessus du sol lointain) où elle a perdu 63 %, couleur côté soleil, force. */
  brume: { densite: number; epaisseur: number; soleil: number; force: number };
  /** Nuages : couverture (0–1), couleur éclairée, couleur à l'ombre, vitesse de dérive. */
  nuages: { couverture: number; clair: number; sombre: number; vitesse: number };
  particules: { sorte: SorteParticules; nombre: number; couleurs: readonly number[]; taille: number };
  /** Étalonnage (après la tonalité) : contraste, saturation, teinte des ombres et des lumières (± par canal), force. */
  etalonnage: { contraste: number; saturation: number; ombres: readonly [number, number, number]; lumieres: readonly [number, number, number] };
  /** Halo des lumières : force, seuil (luminance **linéaire**, avant la tonalité : la peinture blanche au soleil y dépasse 1), rayon. */
  halo: { force: number; seuil: number; rayon: number };
  /** Lumière du ciel renvoyée par la carte d'environnement (palier 2, reflets). */
  environnement: number;
}

export const THEMES_3: Record<PaletteName, Theme3> = {
  stade: {
    brume: { densite: 0.0015, epaisseur: 10, soleil: 0xfff4d8, force: 0.25 },
    nuages: { couverture: 0.35, clair: 0xffffff, sombre: 0xb9cde6, vitesse: 0.004 },
    particules: { sorte: "confettis", nombre: 500, couleurs: [0xe8552d, 0x2e7dff, 0xffd23f, 0xf4f4f4], taille: 0.16 },
    etalonnage: { contraste: 1.08, saturation: 1.12, ombres: [-0.01, 0, 0.02], lumieres: [0.015, 0.01, 0] },
    halo: { force: 0.14, seuil: 2.4, rayon: 0.4 },
    environnement: 0.55,
  },
  desert: {
    brume: { densite: 0.004, epaisseur: 14, soleil: 0xffd9a0, force: 0.55 },
    nuages: { couverture: 0.12, clair: 0xfff2e0, sombre: 0xe4c39a, vitesse: 0.003 },
    particules: { sorte: "poussiere", nombre: 900, couleurs: [0xd9a35f, 0xe8c08a], taille: 0.09 },
    etalonnage: { contraste: 1.06, saturation: 1.05, ombres: [0.015, 0, -0.02], lumieres: [0.03, 0.015, -0.01] },
    halo: { force: 0.12, seuil: 2.4, rayon: 0.4 },
    environnement: 0.5,
  },
  neige: {
    brume: { densite: 0.007, epaisseur: 18, soleil: 0xffffff, force: 0.2 },
    nuages: { couverture: 0.85, clair: 0xf4f7fa, sombre: 0xc8d4e0, vitesse: 0.002 },
    particules: { sorte: "neige", nombre: 1400, couleurs: [0xffffff], taille: 0.11 },
    etalonnage: { contraste: 1.04, saturation: 0.95, ombres: [-0.015, 0, 0.025], lumieres: [0, 0.005, 0.015] },
    halo: { force: 0.1, seuil: 2.8, rayon: 0.4 },
    environnement: 0.6,
  },
  nuit: {
    brume: { densite: 0.005, epaisseur: 9, soleil: 0x8ea6ff, force: 0.25 },
    nuages: { couverture: 0.4, clair: 0x2a3466, sombre: 0x070a18, vitesse: 0.003 },
    particules: { sorte: "lucioles", nombre: 420, couleurs: [0xffc46a, 0xfff0b0], taille: 0.12 },
    etalonnage: { contraste: 1.1, saturation: 1.1, ombres: [-0.01, 0, 0.03], lumieres: [0.03, 0.015, -0.01] },
    halo: { force: 0.55, seuil: 0.95, rayon: 0.55 },
    environnement: 0.3,
  },
  campagne: {
    brume: { densite: 0.0035, epaisseur: 12, soleil: 0xffc070, force: 0.6 },
    nuages: { couverture: 0.45, clair: 0xffe4c0, sombre: 0xc89aa0, vitesse: 0.003 },
    particules: { sorte: "pollen", nombre: 600, couleurs: [0xfff2b0, 0xffffff], taille: 0.07 },
    etalonnage: { contraste: 1.05, saturation: 1.08, ombres: [0.01, -0.005, 0.015], lumieres: [0.035, 0.02, -0.015] },
    halo: { force: 0.14, seuil: 2.2, rayon: 0.45 },
    environnement: 0.5,
  },
  canyon: {
    brume: { densite: 0.005, epaisseur: 16, soleil: 0xff9a50, force: 0.7 },
    nuages: { couverture: 0.25, clair: 0xffb27a, sombre: 0x8a5a8c, vitesse: 0.003 },
    particules: { sorte: "poussiere", nombre: 1000, couleurs: [0xd49a55, 0xe8b07a], taille: 0.1 },
    etalonnage: { contraste: 1.08, saturation: 1.06, ombres: [0.01, -0.01, 0.03], lumieres: [0.04, 0.015, -0.02] },
    halo: { force: 0.14, seuil: 2.2, rayon: 0.45 },
    environnement: 0.5,
  },
  alpin: {
    brume: { densite: 0.005, epaisseur: 20, soleil: 0xfff6e6, force: 0.3 },
    nuages: { couverture: 0.3, clair: 0xffffff, sombre: 0xa9c0dc, vitesse: 0.004 },
    particules: { sorte: "neige", nombre: 800, couleurs: [0xffffff], taille: 0.09 },
    etalonnage: { contraste: 1.07, saturation: 1.1, ombres: [-0.015, 0, 0.03], lumieres: [0.01, 0.01, 0] },
    halo: { force: 0.12, seuil: 2.6, rayon: 0.4 },
    environnement: 0.6,
  },
  ville: {
    brume: { densite: 0.004, epaisseur: 22, soleil: 0xfff0d8, force: 0.3 },
    nuages: { couverture: 0.7, clair: 0xe6eaf0, sombre: 0x9aa6b4, vitesse: 0.002 },
    particules: { sorte: "ville", nombre: 500, couleurs: [0xc9ced6, 0xa9adb4], taille: 0.06 },
    etalonnage: { contraste: 1.06, saturation: 0.94, ombres: [-0.01, 0.005, 0.02], lumieres: [0.015, 0.01, -0.005] },
    halo: { force: 0.16, seuil: 2.0, rayon: 0.45 },
    environnement: 0.5,
  },
  neon: {
    brume: { densite: 0.005, epaisseur: 9, soleil: 0xff9af0, force: 0.3 },
    nuages: { couverture: 0.4, clair: 0x3a1a66, sombre: 0x0a0518, vitesse: 0.003 },
    particules: { sorte: "lucioles", nombre: 420, couleurs: [0xff4fd8, 0x00f0ff], taille: 0.12 },
    etalonnage: { contraste: 1.1, saturation: 1.15, ombres: [0.01, -0.01, 0.03], lumieres: [0.02, 0, 0.02] },
    halo: { force: 0.65, seuil: 0.9, rayon: 0.6 },
    environnement: 0.3,
  },
};

// --- Brume de profondeur ------------------------------------------------------------------------------------------------------------

/** Les uniformes de la brume, partagés par tous les matériaux d'une scène (un seul endroit à régler). */
export interface UniformesBrume {
  uBrumeBase: { value: number };
  uBrumeDensite: { value: number };
  uBrumeEpaisseur: { value: number };
  uBrumeSoleil: { value: Color };
  uBrumeSoleilForce: { value: number };
  uBrumeSoleilDir: { value: Vector3 };
}

export function uniformesBrume(t: Theme3, sol: number, soleil: Vector3): UniformesBrume {
  return {
    uBrumeBase: { value: sol },
    uBrumeDensite: { value: t.brume.densite },
    uBrumeEpaisseur: { value: t.brume.epaisseur },
    uBrumeSoleil: { value: new Color(t.brume.soleil) },
    uBrumeSoleilForce: { value: t.brume.force },
    uBrumeSoleilDir: { value: soleil.clone().normalize() },
  };
}

const BRUME_VERT = /* glsl */ `
#include <fog_vertex>
#ifdef USE_FOG
  #ifdef USE_INSTANCING
    vBrumeMonde = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
  #else
    vBrumeMonde = (modelMatrix * vec4(transformed, 1.0)).xyz;
  #endif
#endif`;

const BRUME_FRAG = /* glsl */ `
#ifdef USE_FOG
  vec3 brumeDir = vBrumeMonde - cameraPosition;
  float brumeDist = length(brumeDir);
  // La brume du thème (linéaire, celle du jeu), plus une brume de hauteur : dense au ras du sol lointain, presque nulle à hauteur de piste.
  float brumeLin = smoothstep(fogNear, fogFar, brumeDist);
  float brumeHaut = exp(-max(vBrumeMonde.y - uBrumeBase, 0.0) / uBrumeEpaisseur);
  float brumeBas = 1.0 - exp(-uBrumeDensite * brumeDist * brumeHaut);
  float brumeF = clamp(max(brumeLin, brumeBas), 0.0, 1.0);
  // Vers le soleil, la brume prend sa couleur (la lumière diffusée).
  float brumeS = pow(max(dot(brumeDir / max(brumeDist, 1e-3), uBrumeSoleilDir), 0.0), 6.0) * uBrumeSoleilForce;
  gl_FragColor.rgb = mix(gl_FragColor.rgb, mix(fogColor, uBrumeSoleil, brumeS), brumeF);
#endif`;

/**
 * Remplace la brume d'un matériau par la brume de profondeur (le matériau garde tout le reste). Les uniformes sont partagés ; une seule
 * variante de programme par sorte de matériau (`customProgramCacheKey`).
 */
export function brumeDeProfondeur(m: Material, u: UniformesBrume): void {
  if (!(m as { fog?: boolean }).fog) return;
  const avant = m.onBeforeCompile;
  m.onBeforeCompile = (s: WebGLProgramParametersWithUniforms, r) => {
    avant.call(m, s, r);
    Object.assign(s.uniforms, u);
    s.vertexShader = s.vertexShader.replace("#include <fog_pars_vertex>", "#include <fog_pars_vertex>\n#ifdef USE_FOG\nvarying vec3 vBrumeMonde;\n#endif").replace("#include <fog_vertex>", BRUME_VERT);
    s.fragmentShader = s.fragmentShader
      .replace("#include <fog_pars_fragment>", "#include <fog_pars_fragment>\n#ifdef USE_FOG\nvarying vec3 vBrumeMonde;\nuniform float uBrumeBase;\nuniform float uBrumeDensite;\nuniform float uBrumeEpaisseur;\nuniform vec3 uBrumeSoleil;\nuniform float uBrumeSoleilForce;\nuniform vec3 uBrumeSoleilDir;\n#endif")
      .replace("#include <fog_fragment>", BRUME_FRAG);
  };
  const cle = m.customProgramCacheKey.bind(m);
  m.customProgramCacheKey = () => `${cle()}|brume38b`;
  m.needsUpdate = true;
}

// --- Ciel et nuages -----------------------------------------------------------------------------------------------------------------

const memoNuages = new Map<string, CanvasTexture>();

/** La densité des nuages (512 px, périodique) : bruit fractal, coupé sous la couverture du thème. Canal alpha = densité, rouge = relief. */
function textureNuages(couverture: number): CanvasTexture {
  const cle = couverture.toFixed(2);
  let t = memoNuages.get(cle);
  if (t) return t;
  const n = 512;
  const f = fractal(n, 4, 7, graine(4242));
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = n;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(n, n);
  const seuil = 1 - couverture;
  for (let i = 0; i < n * n; i++) {
    const d = Math.max(0, Math.min(1, (f[i]! - seuil * 0.75 - 0.15) / 0.3));
    img.data[i * 4] = Math.round(f[i]! * 255);
    img.data[i * 4 + 1] = 0;
    img.data[i * 4 + 2] = 0;
    img.data[i * 4 + 3] = Math.round(d * 255);
  }
  ctx.putImageData(img, 0, 0);
  t = new CanvasTexture(canvas);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.magFilter = LinearFilter;
  memoNuages.set(cle, t);
  return t;
}

const CIEL_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const CIEL_FRAG = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHaut;
uniform vec3 uHorizon;
uniform vec3 uSoleil;
uniform vec3 uSoleilDir;
uniform vec3 uClair;
uniform vec3 uSombre;
uniform float uCouverture;
uniform float uTemps;
uniform float uVitesse;
uniform sampler2D uNuages;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float y = d.y;
  vec3 c = mix(uHorizon, mix(uHaut, uZenith, smoothstep(0.42, 1.0, y)), smoothstep(-0.02, 0.42, y));
  float s = max(dot(d, uSoleilDir), 0.0);
  c += uSoleil * (pow(s, 24.0) * 0.35 + pow(s, 4.0) * 0.12);
  if (uCouverture > 0.0 && y > -0.02) {
    // Les nuages sur une voûte : projetés sur un plan à l'altitude 1, compressés vers l'horizon ; ils dérivent avec le temps.
    vec2 uv = d.xz / (y + 0.12) * 0.28 + vec2(uTemps * uVitesse, uTemps * uVitesse * 0.4);
    vec4 n = texture2D(uNuages, uv);
    float dens = n.a * smoothstep(-0.02, 0.18, y);
    vec4 n2 = texture2D(uNuages, uv + uSoleilDir.xz * 0.02);
    float lumiere = clamp(0.55 + (n.a - n2.a) * 2.5 + n.r * 0.3, 0.0, 1.0);
    vec3 nc = mix(uSombre, uClair, lumiere) + uSoleil * pow(s, 8.0) * 0.4;
    c = mix(c, nc, dens);
  }
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** Le dôme du ciel (palier 3, pas « nuages ») : dessiné derrière tout, il suit la caméra (`position`), il dérive avec le temps (`uTemps`). */
export function domeDuCiel(ciel: readonly [number, number, number], soleilDir: Vector3, soleil: number, t: Theme3): Mesh<SphereGeometry, ShaderMaterial> {
  const col = (c: number) => new Color(c);
  const mat = new ShaderMaterial({
    vertexShader: CIEL_VERT,
    fragmentShader: CIEL_FRAG,
    side: BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    uniforms: {
      uZenith: { value: col(ciel[0]) },
      uHaut: { value: col(ciel[1]) },
      uHorizon: { value: col(ciel[2]) },
      uSoleil: { value: col(soleil) },
      uSoleilDir: { value: soleilDir.clone().normalize() },
      uClair: { value: col(t.nuages.clair) },
      uSombre: { value: col(t.nuages.sombre) },
      uCouverture: { value: t.nuages.couverture },
      uTemps: { value: 0 },
      uVitesse: { value: t.nuages.vitesse },
      uNuages: { value: textureNuages(t.nuages.couverture) },
    },
  });
  const dome = new Mesh(new SphereGeometry(600, 48, 24), mat);
  dome.renderOrder = -3;
  dome.frustumCulled = false;
  dome.userData.dome = true;
  return dome;
}
