// Retouche 38b — palier 2, pas « reflets » : une carte d'environnement **calculée à partir du ciel du thème** (dégradé, soleil, sol, bande
// d'horizon), préfiltrée une fois (PMREM, 64 px par face : ≈ 0,7 Mo) au moment de construire la scène. Posée sur `scene.environment`, elle
// éclaire et se reflète dans tous les matériaux physiques de la scène — les portiques en métal, les panneaux, et **la voiture** (sans toucher à
// son modèle). Aucun fichier, aucune image par image : elle coûte une lecture de texture par pixel éclairé.
import { BackSide, Color, Mesh, PMREMGenerator, Scene, ShaderMaterial, SphereGeometry, Vector3, type Texture, type WebGLRenderer, type WebGLRenderTarget } from "three";

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
  scene.add(new Mesh(new SphereGeometry(10, 32, 16), mat));
  const pmrem = new PMREMGenerator(renderer);
  const rt: WebGLRenderTarget = pmrem.fromScene(scene, 0.02, 0.1, 100, { size: 64 });
  pmrem.dispose();
  mat.dispose();
  (scene.children[0] as Mesh).geometry.dispose();
  // Cible « cube UV » de PMREM : 3 × max(64, 112) par 4 × 64 pixels, demi-flottants (8 octets par pixel).
  const octets = rt.width * rt.height * 8;
  return { texture: rt.texture, octets, dispose: () => rt.dispose() };
}
