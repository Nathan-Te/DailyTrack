import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, CylinderGeometry, DoubleSide, Group, Mesh, NormalBlending, Points, Quaternion, ShaderMaterial, Vector2, Vector3, type PerspectiveCamera } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { aleatoire } from "./formes";
import type { PaletteMonde } from "./palette";

// L'AMBIANCE d'un thème (lot BR-A2) : ce qui flotte dans l'air et ne se touche pas. Trois objets, **trois appels de dessin** en tout, tous autour du point regardé (ils se recyclent : ce qui sort de la boîte rentre de l'autre côté, le monde n'est jamais vide
// ni plein) et tous calculés dans le sommet à partir du temps (aucune mise à jour de géométrie) :
//  · des PARTICULES (un seul `Points`) : du pollen qui monte lentement dans la prairie, de la poussière en suspension dans la carrière, des lucioles qui clignotent dans le sous-bois (plus claires que 1 : le bloom les fait fleurir) ;
//  · des RAIS de lumière (sous-bois surtout) : de longs cylindres translucides le long de la direction du soleil, fondus sur leurs bords ;
//  · une BRUME BASSE : de grands disques à plat, tout près du sol, qui dérivent (le sous-bois en a beaucoup, la carrière un peu).
// Rien ici n'est un danger : aucune couleur n'approche du rouge. La basse qualité garde la moitié des particules, sans rais ni brume.

const BOITE = new Vector3(46, 9, 46);
const PORTEE_RAIS = 40;

const PARTICULES_VS = `
  attribute vec4 graine; uniform float uTemps; uniform vec2 uFoyer; uniform vec3 uBoite; uniform float uGenre; uniform float uTaille; uniform float uEchelle; uniform float uNombre;
  varying float vAlpha; varying float vGenre;
  void main(){
    vec3 p = position * uBoite;
    float t = uTemps;
    vec3 d;
    if (uGenre < 0.5) d = vec3(sin(t * 0.35 + graine.x * 6.28) * 0.5, t * 0.22, cos(t * 0.3 + graine.y * 6.28) * 0.5);            // le pollen : il monte, il tangue
    else if (uGenre < 1.5) d = vec3(t * 0.9 + sin(t * 0.5 + graine.x * 6.28) * 0.8, sin(t * 0.3 + graine.z * 6.28) * 0.3, t * 0.25);  // la poussière : portée par le vent
    else d = vec3(sin(t * 0.5 + graine.x * 6.28) * 1.4, sin(t * 0.7 + graine.y * 6.28) * 0.5, cos(t * 0.43 + graine.z * 6.28) * 1.4);  // les lucioles : des boucles paresseuses
    p += d;
    vec2 q = mod(p.xz - uFoyer + uBoite.xz * 0.5, uBoite.xz) - uBoite.xz * 0.5;
    float y = mod(p.y, uBoite.y);
    vec3 w = vec3(uFoyer.x + q.x, 0.4 + y * (uGenre > 1.5 ? 0.45 : 1.0), uFoyer.y + q.y);
    vec4 mv = viewMatrix * vec4(w, 1.0);
    gl_Position = projectionMatrix * mv;
    float k = 0.7 + 0.6 * graine.w;
    gl_PointSize = max(1.5, uTaille * k * uEchelle / max(1.0, -mv.z));
    float rang = step(graine.z, uNombre);                                                                                              // la moitié en basse qualité
    float fondu = 1.0 - smoothstep(0.38, 0.5, abs(q.x / uBoite.x)) * 1.0; fondu *= 1.0 - smoothstep(0.38, 0.5, abs(q.y / uBoite.z));
    float vie = uGenre > 1.5 ? pow(0.5 + 0.5 * sin(t * (0.9 + graine.x) + graine.y * 40.0), 3.0) : (0.55 + 0.45 * sin(t * 1.3 + graine.x * 20.0));
    vAlpha = fondu * vie * rang * (uGenre < 0.5 ? 0.85 : uGenre < 1.5 ? 0.3 : 1.0);
    vGenre = uGenre;
  }`;
const PARTICULES_FS = `
  uniform vec3 uCouleur; uniform vec3 uCouleur2; varying float vAlpha; varying float vGenre;
  void main(){
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, vGenre > 1.5 ? 0.0 : 0.2, d);
    vec3 c = mix(uCouleur, uCouleur2, smoothstep(0.35, 0.0, d));
    if (vGenre > 1.5) c *= 2.2;
    gl_FragColor = vec4(c, a * vAlpha);
  }`;

const RAIS_VS = `
  attribute vec3 base; uniform vec2 uFoyer; uniform float uTemps; uniform float uForce; uniform float uPortee;
  varying vec3 vN; varying vec3 vV; varying float vH; varying float vAlpha;
  void main(){
    vec2 q = mod(base.xz - uFoyer + vec2(uPortee), vec2(2.0 * uPortee)) - vec2(uPortee);
    vec3 w = position + vec3(uFoyer.x + q.x, 0.0, uFoyer.y + q.y);
    vec4 mv = viewMatrix * vec4(w, 1.0);
    gl_Position = projectionMatrix * mv;
    vN = normalize(mat3(viewMatrix) * normal);
    vV = normalize(-mv.xyz);
    vH = uv.y;
    float bord = 1.0 - smoothstep(0.65, 1.0, length(q) / uPortee);
    vAlpha = uForce * bord * (0.65 + 0.35 * sin(uTemps * 0.45 + base.y * 30.0));
  }`;
const RAIS_FS = `
  uniform vec3 uCouleur; varying vec3 vN; varying vec3 vV; varying float vH; varying float vAlpha;
  void main(){
    float f = abs(dot(normalize(vN), normalize(vV)));
    float a = f * f * f * smoothstep(0.0, 0.25, vH) * (1.0 - smoothstep(0.55, 1.0, vH)) * vAlpha * 0.2;
    gl_FragColor = vec4(uCouleur, a);
  }`;

const BRUME_VS = `
  attribute vec3 base; uniform vec2 uFoyer; uniform float uTemps; uniform float uForce; uniform float uPortee;
  varying vec2 vUv; varying float vAlpha;
  void main(){
    vec2 q = mod(base.xz - uFoyer + vec2(uPortee) + vec2(uTemps * 0.5, uTemps * 0.2), vec2(2.0 * uPortee)) - vec2(uPortee);
    vec3 w = position + vec3(uFoyer.x + q.x, 0.0, uFoyer.y + q.y);
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
    vUv = uv;
    vAlpha = uForce * (1.0 - smoothstep(0.7, 1.0, length(q) / uPortee));
  }`;
const BRUME_FS = `
  uniform vec3 uCouleur; varying vec2 vUv; varying float vAlpha;
  void main(){
    float d = length(vUv - 0.5) * 2.0;
    gl_FragColor = vec4(uCouleur, (1.0 - smoothstep(0.1, 1.0, d)) * vAlpha * 0.3);
  }`;

export interface Ambiance {
  groupe: Group;
  /** À chaque image : le point regardé (mètres), le temps du jeu (secondes), la qualité, la caméra et la hauteur de l'image en pixels (la taille d'une particule suit l'écran). */
  maj(foyer: { x: number; z: number }, temps: number, qualite: "haute" | "basse", camera: PerspectiveCamera, hauteurPx: number): void;
  detruire(): void;
}

export function monterAmbiance(a: PaletteMonde): Ambiance {
  const groupe = new Group();
  const p = a.particules;
  const foyer = { value: new Vector2() };
  const temps = { value: 0 };
  const rnd = aleatoire(4242);
  // Les particules : une position dans la boîte (0 à 1) et une graine de quatre nombres par particule.
  const N = p.nombre;
  const pos = new Float32Array(N * 3);
  const graine = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = rnd();
    pos[i * 3 + 1] = rnd();
    pos[i * 3 + 2] = rnd();
    graine[i * 4] = rnd();
    graine[i * 4 + 1] = rnd();
    graine[i * 4 + 2] = i / N; // l'ordre de rang : en basse qualité on ne garde que la moitié des plus petits rangs
    graine[i * 4 + 3] = rnd();
  }
  const gP = new BufferGeometry();
  gP.setAttribute("position", new BufferAttribute(pos, 3));
  gP.setAttribute("graine", new BufferAttribute(graine, 4));
  const genre = p.genre === "pollen" ? 0 : p.genre === "poussiere" ? 1 : 2;
  const mP = new ShaderMaterial({
    vertexShader: PARTICULES_VS,
    fragmentShader: PARTICULES_FS,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    fog: false,
    uniforms: { uTemps: temps, uFoyer: foyer, uBoite: { value: BOITE }, uGenre: { value: genre }, uTaille: { value: p.taille }, uEchelle: { value: 1000 }, uNombre: { value: 1 }, uCouleur: { value: new Color(p.couleur) }, uCouleur2: { value: new Color(p.couleur2) } },
  });
  const particules = new Points(gP, mP);
  particules.frustumCulled = false;
  particules.renderOrder = 3;
  groupe.add(particules);

  // Les rais : des cylindres ouverts le long de la direction du soleil (de la canopée au sol), un `base` par rai qui les place dans le monde.
  let rais: Mesh | null = null;
  let mR: ShaderMaterial | null = null;
  if (a.rais > 0) {
    const dir = new Vector3(...a.soleil).normalize().negate(); // de la lumière vers le sol
    const morceaux: BufferGeometry[] = [];
    const nR = 9;
    for (let i = 0; i < nR; i++) {
      const L = 22 + rnd() * 8;
      const g = new CylinderGeometry(0.9 + rnd() * 0.9, 1.7 + rnd() * 1.4, L, 8, 1, true);
      // le cylindre est vertical, centré : on l'incline le long de `dir`, son pied (en bas) touche le sol
      g.translate(0, L / 2, 0);
      const axe = new Vector3(0, 1, 0);
      const cible = dir.clone().negate(); // du sol vers la lumière
      g.applyQuaternion(quat(axe, cible));
      const n = g.getAttribute("position").count;
      const b = new Float32Array(n * 3);
      const bx = (rnd() * 2 - 1) * PORTEE_RAIS;
      const bz = (rnd() * 2 - 1) * PORTEE_RAIS;
      for (let k = 0; k < n; k++) {
        b[k * 3] = bx;
        b[k * 3 + 1] = i / nR;
        b[k * 3 + 2] = bz;
      }
      g.setAttribute("base", new BufferAttribute(b, 3));
      morceaux.push(g);
    }
    const g = mergeGeometries(morceaux, false)!;
    mR = new ShaderMaterial({ vertexShader: RAIS_VS, fragmentShader: RAIS_FS, transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide, fog: false, uniforms: { uFoyer: foyer, uTemps: temps, uForce: { value: a.rais }, uPortee: { value: PORTEE_RAIS }, uCouleur: { value: new Color(0xfff2b8) } } });
    rais = new Mesh(g, mR);
    rais.frustumCulled = false;
    rais.renderOrder = 3;
    groupe.add(rais);
  }

  // La brume basse : de grands disques à plat à 0,3-0,6 m du sol.
  let brume: Mesh | null = null;
  let mB: ShaderMaterial | null = null;
  if (a.brumeBasse > 0.05) {
    const morceaux: BufferGeometry[] = [];
    const nB = 9;
    for (let i = 0; i < nB; i++) {
      const r = 8 + rnd() * 9;
      const g = new CylinderGeometry(r, r, 0.001, 12, 1, false).toNonIndexed();
      // un disque : on lit le centre dans les uv (le dessus est rempli de l'uv des capuchons du cylindre)
      const pp = g.getAttribute("position");
      const uv = new Float32Array(pp.count * 2);
      for (let k = 0; k < pp.count; k++) {
        uv[k * 2] = pp.getX(k) / (2 * r) + 0.5;
        uv[k * 2 + 1] = pp.getZ(k) / (2 * r) + 0.5;
      }
      g.setAttribute("uv", new BufferAttribute(uv, 2));
      g.translate(0, 0.3 + rnd() * 0.35, 0);
      const b = new Float32Array(pp.count * 3);
      const bx = (rnd() * 2 - 1) * PORTEE_RAIS;
      const bz = (rnd() * 2 - 1) * PORTEE_RAIS;
      for (let k = 0; k < pp.count; k++) {
        b[k * 3] = bx;
        b[k * 3 + 1] = 0;
        b[k * 3 + 2] = bz;
      }
      g.setAttribute("base", new BufferAttribute(b, 3));
      g.deleteAttribute("normal");
      morceaux.push(g);
    }
    const g = mergeGeometries(morceaux, false)!;
    mB = new ShaderMaterial({ vertexShader: BRUME_VS, fragmentShader: BRUME_FS, transparent: true, depthWrite: false, blending: NormalBlending, side: DoubleSide, fog: false, uniforms: { uFoyer: foyer, uTemps: temps, uForce: { value: a.brumeBasse }, uPortee: { value: PORTEE_RAIS }, uCouleur: { value: new Color(a.brume) } } });
    brume = new Mesh(g, mB);
    brume.frustumCulled = false;
    brume.renderOrder = 3;
    groupe.add(brume);
  }

  return {
    groupe,
    maj(f, t, qualite, camera, hauteurPx) {
      foyer.value.set(f.x, f.z);
      temps.value = t;
      mP.uniforms.uEchelle!.value = hauteurPx / (2 * Math.tan((camera.fov * Math.PI) / 360));
      mP.uniforms.uNombre!.value = qualite === "haute" ? 1.01 : 0.5;
      if (rais) rais.visible = qualite === "haute";
      if (brume) brume.visible = qualite === "haute";
    },
    detruire() {
      gP.dispose();
      mP.dispose();
      rais?.geometry.dispose();
      mR?.dispose();
      brume?.geometry.dispose();
      mB?.dispose();
    },
  };
}

/** La rotation qui amène le vecteur `de` sur le vecteur `vers` (unitaires). */
function quat(de: Vector3, vers: Vector3): Quaternion {
  return new Quaternion().setFromUnitVectors(de.clone().normalize(), vers.clone().normalize());
}
