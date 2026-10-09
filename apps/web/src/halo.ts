// Halos (lot 23) : un point lumineux flou sur les néons, turbos, lampadaires et portes. Un seul `Points` additif pour toute la
// scène (un appel de dessin). La taille est donnée en mètres ; à l'écran elle est plafonnée (les petites cartes graphiques limitent
// la taille d'un point) et le halo s'efface quand il devient trop gros (on passe tout près). Présentation seule.
import { AdditiveBlending, BufferGeometry, Color, Float32BufferAttribute, Points, ShaderMaterial } from "three";
import type { HaloSpec } from "./meshKit";

const VERTEX = `
attribute float size;
uniform float scale;
varying vec3 vColor;
varying float vFade;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float px = -mv.z > 0.5 ? size * scale / -mv.z : 0.0;
  vFade = clamp((190.0 - px) / 90.0, 0.0, 1.0) * clamp(px / 6.0, 0.0, 1.0);
  gl_PointSize = min(px, 160.0);
  gl_Position = projectionMatrix * mv;
  vColor = color;
}`;

const FRAGMENT = `
varying vec3 vColor;
varying float vFade;
void main() {
  float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
  float a = pow(max(0.0, 1.0 - d), 2.2);
  gl_FragColor = vec4(vColor * a * vFade, 1.0);
}`;

export interface Halos {
  points: Points;
  /** À appeler quand la hauteur de la fenêtre (pixels) ou le champ de vision change. */
  setView(heightPx: number, fovDeg: number): void;
}

/** `strength` : 0 coupe les halos (thème de jour), 1 plein. */
export function buildHalos(specs: readonly HaloSpec[], strength: number): Halos | null {
  if (specs.length === 0 || strength <= 0) return null;
  const pos: number[] = [];
  const col: number[] = [];
  const size: number[] = [];
  const c = new Color();
  for (const s of specs) {
    c.set(s.color);
    pos.push(s.x, s.y, s.z);
    col.push(c.r * strength, c.g * strength, c.b * strength);
    size.push(s.size);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new Float32BufferAttribute(col, 3));
  g.setAttribute("size", new Float32BufferAttribute(size, 1));
  const material = new ShaderMaterial({
    uniforms: { scale: { value: 400 } },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const points = new Points(g, material);
  points.frustumCulled = false;
  points.renderOrder = 5;
  points.userData.level = 1; // visible à partir de la qualité 1
  return {
    points,
    setView(heightPx, fovDeg) {
      material.uniforms.scale!.value = heightPx / (2 * Math.tan((fovDeg * Math.PI) / 360));
    },
  };
}
