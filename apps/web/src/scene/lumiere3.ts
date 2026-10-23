// Retouche 38b — palier 3, famille « lumière » : la brume de profondeur (elle s'épaissit en contrebas et se teinte du soleil quand on le regarde),
// le ciel dessiné avec ses nuages, et les réglages par thème de tout le palier 3 (brume, nuages, particules, étalonnage, halo). Les ombres nettes
// et lointaines sont un réglage du compositeur (`composerPalier.ts`) ; l'occlusion, une passe de `post.ts`. Lot 46 : la brume et les nuages de chaque
// thème ici (`CIEL_3`, ce que charge le pas « ciel » du jeu), ses particules dans `vie.ts`, la table entière (`THEMES_3`) dans `themes3.ts`.
import { BufferGeometry, CanvasTexture, Color, DoubleSide, Float32BufferAttribute, LinearFilter, Mesh, RepeatWrapping, ShaderMaterial, Vector3, type Material, type WebGLProgramParametersWithUniforms } from "three";
import type { PaletteName } from "@cdj/sim";
import { fractal, graine } from "./bruit";

/** Les particules d'un thème (`vie.ts`). */
export type SorteParticules = "poussiere" | "neige" | "lucioles" | "pollen" | "confettis" | "ville";

/** Le palier 3 d'un thème : brume, nuages, particules, étalonnage, halo (lot 46 : la table entière est dans `themes3.ts`, pour la vitrine). */
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

/** Lot 46 : ce que lit le pas « ciel » du jeu (brume, nuages) — à part des particules (`PARTICULES_3`, vie.ts) et du post-traitement (`themes3.ts`). */
export type Ciel3 = Pick<Theme3, "brume" | "nuages">;

export const CIEL_3: Record<PaletteName, Ciel3> = {
  stade: {
    brume: { densite: 0.0015, epaisseur: 10, soleil: 0xfff4d8, force: 0.25 },
    nuages: { couverture: 0.35, clair: 0xffffff, sombre: 0xb9cde6, vitesse: 0.004 },
  },
  desert: {
    brume: { densite: 0.004, epaisseur: 14, soleil: 0xffd9a0, force: 0.55 },
    nuages: { couverture: 0.12, clair: 0xfff2e0, sombre: 0xe4c39a, vitesse: 0.003 },
  },
  neige: {
    brume: { densite: 0.007, epaisseur: 18, soleil: 0xffffff, force: 0.2 },
    nuages: { couverture: 0.85, clair: 0xf4f7fa, sombre: 0xc8d4e0, vitesse: 0.002 },
  },
  nuit: {
    brume: { densite: 0.005, epaisseur: 9, soleil: 0x8ea6ff, force: 0.25 },
    nuages: { couverture: 0.4, clair: 0x2a3466, sombre: 0x070a18, vitesse: 0.003 },
  },
  campagne: {
    brume: { densite: 0.0035, epaisseur: 12, soleil: 0xffc070, force: 0.6 },
    nuages: { couverture: 0.45, clair: 0xffe4c0, sombre: 0xc89aa0, vitesse: 0.003 },
  },
  canyon: {
    brume: { densite: 0.005, epaisseur: 16, soleil: 0xff9a50, force: 0.7 },
    nuages: { couverture: 0.25, clair: 0xffb27a, sombre: 0x8a5a8c, vitesse: 0.003 },
  },
  alpin: {
    brume: { densite: 0.005, epaisseur: 20, soleil: 0xfff6e6, force: 0.3 },
    nuages: { couverture: 0.3, clair: 0xffffff, sombre: 0xa9c0dc, vitesse: 0.004 },
  },
  ville: {
    brume: { densite: 0.004, epaisseur: 22, soleil: 0xfff0d8, force: 0.3 },
    nuages: { couverture: 0.7, clair: 0xe6eaf0, sombre: 0x9aa6b4, vitesse: 0.002 },
  },
  neon: {
    brume: { densite: 0.005, epaisseur: 9, soleil: 0xff9af0, force: 0.3 },
    nuages: { couverture: 0.4, clair: 0x3a1a66, sombre: 0x0a0518, vitesse: 0.003 },
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

export function uniformesBrume(t: Ciel3, sol: number, soleil: Vector3): UniformesBrume {
  return {
    uBrumeBase: { value: sol },
    uBrumeDensite: { value: t.brume.densite },
    uBrumeEpaisseur: { value: t.brume.epaisseur },
    uBrumeSoleil: { value: new Color(t.brume.soleil) },
    uBrumeSoleilForce: { value: t.brume.force },
    uBrumeSoleilDir: { value: soleil.clone().normalize() },
  };
}

// Lot 46 : plus d'instances dans la scène (la foule est un maillage fusionné, vie.ts) : la position du monde se lit sans `instanceMatrix`.
const BRUME_VERT = /* glsl */ `
#include <fog_vertex>
#ifdef USE_FOG
  vBrumeMonde = (modelMatrix * vec4(transformed, 1.0)).xyz;
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

/**
 * La densité des nuages (256 px, périodique) : bruit fractal, coupé sous la couverture du thème. Canal alpha = densité, rouge = relief. Lot 46 : 256 px au lieu
 * de 512 (les mêmes sept octaves) — la texture se calcule à la construction de la scène, 4 fois plus vite (≈ +300 ms à processeur ×4 en 512, mesuré en jeu).
 */
function textureNuages(couverture: number): CanvasTexture {
  const cle = couverture.toFixed(2);
  let t = memoNuages.get(cle);
  if (t) return t;
  const n = 256;
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
/**
 * Lot 46 : la voûte est un cube de 2 × 600 m (12 triangles) plutôt qu'une sphère : le nuanceur ne lit que la direction (`normalize(position)`, exacte sur
 * une face plane), et `SphereGeometry` serait entrée dans le morceau partagé de three.js, donc dans le premier chargement du jeu.
 */
function voute(r: number): BufferGeometry {
  const g = new BufferGeometry();
  const p: number[] = [];
  for (let i = 0; i < 8; i++) p.push(i & 1 ? r : -r, i & 2 ? r : -r, i & 4 ? r : -r);
  g.setAttribute("position", new Float32BufferAttribute(p, 3));
  g.setIndex([0, 1, 3, 0, 3, 2, 4, 6, 7, 4, 7, 5, 0, 4, 5, 0, 5, 1, 2, 3, 7, 2, 7, 6, 0, 2, 6, 0, 6, 4, 1, 5, 7, 1, 7, 3]);
  return g;
}

export function domeDuCiel(ciel: readonly [number, number, number], soleilDir: Vector3, soleil: number, t: Ciel3, textures = true): Mesh<BufferGeometry, ShaderMaterial> {
  const col = (c: number) => new Color(c);
  const mat = new ShaderMaterial({
    vertexShader: CIEL_VERT,
    fragmentShader: CIEL_FRAG,
    side: DoubleSide, // lot 46 : un cube vu de dedans (une seule face sous chaque direction)
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
      uNuages: { value: textures ? textureNuages(t.nuages.couverture) : null }, // lot 46 : sans DOM (tests), la forme seule
    },
  });
  const dome = new Mesh(voute(600), mat);
  dome.renderOrder = -3;
  dome.frustumCulled = false;
  dome.userData.dome = true;
  return dome;
}
