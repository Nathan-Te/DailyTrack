// Lot 38 — les vues de la vitrine : **un seul moteur WebGL**, hors de la page, qui dessine chaque vue à la demande puis la copie dans le canvas
// 2D de la vue (comme les miniatures, lot 13). Aucun rendu continu : une vue se redessine quand sa scène est prête, quand on tourne autour, ou
// quand on la mesure. On tourne autour au doigt ou à la souris (orbite autour d'un point visé), on zoome à la molette (vue agrandie) ou en pinçant.
import { NeutralToneMapping, PerspectiveCamera, Vector3, WebGLRenderer, type Scene } from "three";

/** Ce qu'il faut pour dessiner une vue : une scène, son exposition, et de quoi la régler avant chaque image (ombres, halos). */
export interface Dessin {
  scene: Scene;
  exposition: number;
  /** Avant chaque image : taille de la vue (pixels) et champ de vision (halos), position de la caméra (fenêtre des ombres). */
  avant?(hauteurPx: number, fov: number, camera: PerspectiveCamera): void;
  /**
   * Retouche 38b : dessine l'image elle-même (paliers : carte d'environnement, animation, chaîne de post-traitement) au lieu de `render` ; rend la
   * mémoire des cibles de la chaîne (octets).
   */
  rendre?(r: WebGLRenderer, camera: PerspectiveCamera, largeurPx: number, hauteurPx: number): number;
  /** Retouche 38b : ce qui demande le moteur, une fois (carte d'environnement) — hors du compte des appels de l'image. */
  preparer?(r: WebGLRenderer): void;
}

/** Orbite : point visé, angle autour (rad), hauteur (rad au-dessus de l'horizon), distance (m). */
export interface Orbite {
  cible: Vector3;
  azimut: number;
  elevation: number;
  distance: number;
  fov: number;
}

/** L'orbite qui place la caméra en `pos` en regardant `cible`. */
export function orbiteDepuis(pos: Vector3, cible: Vector3, fov: number): Orbite {
  const d = pos.clone().sub(cible);
  const distance = d.length() || 1;
  return { cible: cible.clone(), azimut: Math.atan2(d.x, d.z), elevation: Math.asin(Math.max(-1, Math.min(1, d.y / distance))), distance, fov };
}

export function placerCamera(cam: PerspectiveCamera, o: Orbite) {
  const c = Math.cos(o.elevation);
  cam.position.set(o.cible.x + Math.sin(o.azimut) * c * o.distance, o.cible.y + Math.sin(o.elevation) * o.distance, o.cible.z + Math.cos(o.azimut) * c * o.distance);
  cam.fov = o.fov;
  cam.lookAt(o.cible);
}

let moteur: WebGLRenderer | null | undefined;

/** Le moteur partagé (créé à la première vue) ; `null` sans WebGL. */
export function moteurPartage(): WebGLRenderer | null {
  if (moteur !== undefined) return moteur;
  try {
    const canvas = document.createElement("canvas");
    const r = new WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    r.toneMapping = NeutralToneMapping;
    r.shadowMap.enabled = true;
    moteur = r;
  } catch {
    moteur = null;
  }
  return moteur;
}

/** Chiffres de la dernière image d'une vue : appels de rendu et triangles (ombres et passes comprises), temps passé à l'envoyer (ms). */
export interface Chiffres {
  appels: number;
  triangles: number;
  envoiMs: number;
  /** Retouche 38b : mémoire des cibles de la chaîne de post-traitement (octets ; 0 sans chaîne). */
  postOctets: number;
}

/** Une image : par `d.rendre` (paliers) ou `render`, en comptant appels et triangles de toutes les passes (ombres, post-traitement). */
export function image(r: WebGLRenderer, d: Dessin, camera: PerspectiveCamera, w: number, h: number): { appels: number; triangles: number; postOctets: number } {
  d.preparer?.(r);
  r.info.autoReset = false;
  r.info.reset();
  let postOctets = 0;
  if (d.rendre) postOctets = d.rendre(r, camera, w, h);
  else {
    r.toneMappingExposure = d.exposition;
    r.render(d.scene, camera);
  }
  const info = r.info.render;
  const out = { appels: info.calls, triangles: info.triangles, postOctets };
  r.info.autoReset = true;
  return out;
}

/** Dessine `d` vu par `o` dans `cible` (canvas 2D) à `largeur` × `hauteur` pixels CSS ; rend les chiffres de l'image. */
export function dessiner(d: Dessin, o: Orbite, cible: HTMLCanvasElement, largeur: number, hauteur: number, densite: number, camera: PerspectiveCamera): Chiffres | null {
  const r = moteurPartage();
  if (!r) return null;
  const w = Math.max(1, Math.round(largeur * densite));
  const h = Math.max(1, Math.round(hauteur * densite));
  if (r.domElement.width !== w || r.domElement.height !== h) r.setSize(w, h, false);
  camera.aspect = w / h;
  placerCamera(camera, o);
  camera.updateProjectionMatrix();
  d.avant?.(h, o.fov, camera);
  const t0 = performance.now();
  const im = image(r, d, camera, w, h);
  const envoiMs = performance.now() - t0;
  const chiffres = { ...im, envoiMs };
  if (cible.width !== w || cible.height !== h) {
    cible.width = w;
    cible.height = h;
  }
  cible.getContext("2d")!.drawImage(r.domElement, 0, 0);
  return chiffres;
}

/**
 * Temps d'image d'une vue : `images` images de suite à la taille donnée, chacune attendue jusqu'au bout (lecture d'un pixel : le processeur graphique
 * a fini). Rend la moyenne et le pire, en ms, et le temps d'envoi seul (fil principal).
 */
export function mesurerImage(d: Dessin, o: Orbite, largeur: number, hauteur: number, densite: number, images: number): { moyenneMs: number; pireMs: number; envoiMs: number } | null {
  const r = moteurPartage();
  if (!r) return null;
  const camera = new PerspectiveCamera(o.fov, 1, 0.1, 700);
  const w = Math.round(largeur * densite);
  const h = Math.round(hauteur * densite);
  r.setSize(w, h, false);
  camera.aspect = w / h;
  placerCamera(camera, o);
  camera.updateProjectionMatrix();
  d.avant?.(h, o.fov, camera);
  const gl = r.getContext();
  const px = new Uint8Array(4);
  // Une image pour rien (programmes compilés, cartes d'ombres et d'environnement créées, cibles du post-traitement).
  image(r, d, camera, w, h);
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let total = 0;
  let pire = 0;
  let envoi = 0;
  for (let i = 0; i < images; i++) {
    // Un petit mouvement de caméra à chaque image, comme en course (la fenêtre des ombres suit).
    o.azimut += 0.002;
    placerCamera(camera, o);
    d.avant?.(h, o.fov, camera);
    const t0 = performance.now();
    image(r, d, camera, w, h);
    const t1 = performance.now();
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const t2 = performance.now();
    envoi += t1 - t0;
    total += t2 - t0;
    pire = Math.max(pire, t2 - t0);
  }
  o.azimut -= 0.002 * images;
  return { moyenneMs: total / images, pireMs: pire, envoiMs: envoi / images };
}

/**
 * Orbite au pointeur sur un élément : glisser tourne autour (horizontalement ; aussi en hauteur à la souris et dans une vue agrandie),
 * pincer rapproche, la molette aussi si `molette`. `change` est appelé (au plus une fois par image) quand l'orbite bouge.
 */
export function suivreOrbite(el: HTMLElement, o: () => Orbite, change: () => void, opts: { molette: boolean; hauteur: boolean }): () => void {
  const points = new Map<number, { x: number; y: number }>();
  let ecart = 0;
  let prevu = false;
  const redessiner = () => {
    if (prevu) return;
    prevu = true;
    requestAnimationFrame(() => {
      prevu = false;
      change();
    });
  };
  const bas = (e: PointerEvent) => {
    points.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (points.size === 2) {
      const [a, b] = [...points.values()];
      ecart = Math.hypot(a!.x - b!.x, a!.y - b!.y);
    }
  };
  const bouge = (e: PointerEvent) => {
    const p = points.get(e.pointerId);
    if (!p) return;
    const orb = o();
    if (points.size === 1) {
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      orb.azimut -= dx * 0.008;
      if (opts.hauteur || e.pointerType === "mouse") orb.elevation = Math.max(0.02, Math.min(1.45, orb.elevation + dy * 0.006));
      if (e.pointerType === "mouse" || Math.abs(dx) > 2) el.setPointerCapture?.(e.pointerId);
      redessiner();
    }
    p.x = e.clientX;
    p.y = e.clientY;
    if (points.size === 2) {
      const [a, b] = [...points.values()];
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      if (ecart > 0) orb.distance = Math.max(3, Math.min(400, (orb.distance * ecart) / d));
      ecart = d;
      redessiner();
    }
  };
  const haut = (e: PointerEvent) => {
    points.delete(e.pointerId);
    ecart = 0;
  };
  const molette = (e: WheelEvent) => {
    if (!opts.molette) return;
    e.preventDefault();
    const orb = o();
    orb.distance = Math.max(3, Math.min(400, orb.distance * Math.exp(e.deltaY * 0.001)));
    redessiner();
  };
  el.addEventListener("pointerdown", bas);
  el.addEventListener("pointermove", bouge);
  el.addEventListener("pointerup", haut);
  el.addEventListener("pointercancel", haut);
  el.addEventListener("wheel", molette, { passive: false });
  return () => {
    el.removeEventListener("pointerdown", bas);
    el.removeEventListener("pointermove", bouge);
    el.removeEventListener("pointerup", haut);
    el.removeEventListener("pointercancel", haut);
    el.removeEventListener("wheel", molette);
  };
}
