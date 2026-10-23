// Retouche 38b — palier 2, pas « reflets » : une carte d'environnement **calculée à partir du ciel du thème** (dégradé, soleil, sol, bande
// d'horizon), préfiltrée une fois (PMREM, 64 px par face : ≈ 0,7 Mo) au moment de construire la scène. Aucun fichier, aucune image par image : elle
// coûte une lecture de texture par pixel qui la lit. **Lot 45 : des reflets ciblés** (38b, « d'autres pas », n° 5) — posée par matériau (`envMap`) sur le
// métal des portiques et sur la voiture seulement, **jamais sur `scene.environment`** (la route et le décor la liraient à chaque pixel : c'était le pas le plus
// cher par pixel du palier 2). Le jeu (`finitionJeu.ts`) et la vitrine (`composerPalier.ts`, `refletsCibles`) font de même.
import { BackSide, BoxGeometry, Color, Mesh, PMREMGenerator, Scene, ShaderMaterial, Vector3, type MeshStandardMaterial, type Object3D, type Texture, type WebGLRenderer, type WebGLRenderTarget } from "three";

/** Ce qu'il faut du thème pour peindre son environnement : ciel (zénith, haut, horizon), sol, soleil (direction, couleur, force), horizon. */
export interface CielEnv {
  ciel: readonly [number, number, number];
  sol: number;
  soleil: { direction: Vector3; couleur: number; force: number };
  horizon: number;
}

const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHaut;
uniform vec3 uHorizon;
uniform vec3 uSol;
uniform vec3 uBande;
uniform vec3 uSoleil;
uniform vec3 uSoleilDir;
uniform float uSoleilForce;
varying vec3 vDir;
void main() {
  float y = vDir.y;
  vec3 c = y > 0.0 ? mix(uHorizon, mix(uHaut, uZenith, smoothstep(0.35, 1.0, y)), smoothstep(0.0, 0.35, y)) : mix(uBande, uSol, smoothstep(0.0, -0.25, y));
  // La bande d'horizon (silhouettes lointaines) entre 0 et 6° au-dessus de l'horizon.
  c = mix(c, uBande, (1.0 - smoothstep(0.0, 0.1, y)) * step(0.0, y) * 0.7);
  float s = max(dot(normalize(vDir), uSoleilDir), 0.0);
  c += uSoleil * (pow(s, 600.0) * 18.0 + pow(s, 12.0) * 0.6) * uSoleilForce;
  gl_FragColor = vec4(c, 1.0);
}`;

/** La carte d'environnement d'un thème (à libérer avec la scène). `octets` : sa mémoire sur la carte graphique. */
export function carteEnvironnement(renderer: WebGLRenderer, e: CielEnv): { texture: Texture; octets: number; dispose(): void } {
  const scene = new Scene();
  const col = (c: number) => new Color(c);
  const mat = new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: BackSide,
    depthWrite: false,
    uniforms: {
      uZenith: { value: col(e.ciel[0]) },
      uHaut: { value: col(e.ciel[1]) },
      uHorizon: { value: col(e.ciel[2]) },
      uSol: { value: col(e.sol) },
      uBande: { value: col(e.horizon) },
      uSoleil: { value: col(e.soleil.couleur) },
      uSoleilDir: { value: e.soleil.direction.clone().normalize() },
      uSoleilForce: { value: e.soleil.force },
    },
  });
  // Un cube vu de l'intérieur (le nuanceur ne lit que la direction) : lot 45, `SphereGeometry` serait entrée dans le morceau partagé de three.js, donc dans
  // le premier chargement du jeu (comme le dôme du ciel, lot 46).
  scene.add(new Mesh(new BoxGeometry(10, 10, 10), mat));
  const pmrem = new PMREMGenerator(renderer);
  const rt: WebGLRenderTarget = pmrem.fromScene(scene, 0.02, 0.1, 100, { size: 64 });
  pmrem.dispose();
  mat.dispose();
  (scene.children[0] as Mesh).geometry.dispose();
  // Cible « cube UV » de PMREM : 3 × max(64, 112) par 4 × 64 pixels, demi-flottants (8 octets par pixel).
  const octets = rt.width * rt.height * 8;
  return { texture: rt.texture, octets, dispose: () => rt.dispose() };
}

/**
 * Lot 45 : les reflets ciblés de la vitrine — la carte posée sur les matériaux physiques des calques `solide` et `rythme` (le métal) et sur ce qui n'est pas un
 * calque de la scène (la voiture) ; ni la route, ni les rebords, ni le décor. Idempotent (la vitrine l'appelle avant chaque image : la voiture change).
 */
export function refletsCibles(scene: Object3D, env: Texture, intensite: number) {
  scene.traverse((o) => {
    const calque = o.userData.calque as string | undefined;
    if (calque !== undefined && calque !== "solide" && calque !== "rythme") return;
    for (const m of [(o as Mesh).material].flat() as MeshStandardMaterial[]) {
      if (!m?.isMeshStandardMaterial || m.envMap === env) continue;
      m.userData.envBase ??= m.envMapIntensity;
      m.envMap = env;
      m.envMapIntensity = m.userData.envBase * intensite;
      m.needsUpdate = true;
    }
  });
}
