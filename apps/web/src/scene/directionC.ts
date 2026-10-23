// Lot 38 — direction C, « Lumière et matière » : on touche peu aux formes. Tout se joue sur le ciel, la brume, la lumière et l'ombrage par thème
// (une heure du jour reconnaissable : midi du Stade, nuit noire et flaques de lumière de la Nuit, jour blanc de la Banquise…), l'occlusion par
// sommets (le pied des murs et des objets s'assombrit), des ombres de contact (la piste et ses rebords projettent aussi) et des textures dessinées
// au chargement (grain de matière, sol par thème). **Un traitement d'une scène déjà construite** (`appliquerC`) : il s'applique à la scène du jeu
// telle quelle (lot 37 compris) comme à celle d'une autre direction (le mélange).
import { AdditiveBlending, AmbientLight, BufferAttribute, BufferGeometry as Geometrie, CanvasTexture, DirectionalLight, DoubleSide, Float32BufferAttribute, Fog, HemisphereLight, Mesh, MeshBasicMaterial, MeshStandardMaterial, MeshToonMaterial, Points, PointLight, SpotLight, type BufferGeometry, type Object3D, type Texture } from "three";
import { CELL, blockHalfWidth, isCurve, type PaletteName, type Track } from "@cdj/sim";
import { buildHalos } from "../halo";
import { Builder } from "../meshKit";
import type { TrackScene } from "../trackMesh";
import { onBlock } from "./route";
import { SOLS_C, grain, texturedCielC, texturedSol } from "./textures";

/** La lumière d'un thème (C). */
export interface ThemeC {
  ciel: [zenith: number, haut: number, horizon: number];
  brume: [couleur: number, near: number, far: number];
  soleil: [couleur: number, intensite: number];
  hemi: [ciel: number, sol: number, intensite: number];
  ambiante: number;
  exposition: number;
  /** Ombres portées : intensité (0–1) et flou du bord (rayon PCF, 1 = net). */
  ombre: [intensite: number, rayon: number];
  /** Force de l'occlusion par sommets (0–1). */
  ao: number;
  /** Couleurs du sol lointain (texture du thème). */
  sol: [string, string];
  /** Teinte des silhouettes lointaines vers l'horizon (0 = inchangées). */
  silhouettes: number;
  /** Nuit : des lampes qui éclairent vraiment (lumières ponctuelles posées sur les lampadaires les plus proches de la voiture). */
  lampes?: { couleur: number; nombre: number; intensite: number; portee: number };
}

export const THEMES_C: Record<PaletteName, ThemeC> = {
  stade: { ciel: [0x1a63d6, 0x5aa2ec, 0xc4e6ff], brume: [0xc4e6ff, 190, 540], soleil: [0xfff6e6, 3.1], hemi: [0xd8ecff, 0x4f9a3a, 0.62], ambiante: 0.1, exposition: 1.0, ombre: [1, 1], ao: 0.55, sol: ["#4aa83a", "#56b544"], silhouettes: 0.25 },
  desert: { ciel: [0x2f8fd0, 0x9cc6dc, 0xf2c08a], brume: [0xf0c590, 90, 320], soleil: [0xffe2b0, 2.8], hemi: [0xffe8c8, 0xc8904c, 0.55], ambiante: 0.12, exposition: 1.02, ombre: [0.9, 1], ao: 0.5, sol: ["#d9a35f", "#c78f4c"], silhouettes: 0.35 },
  neige: { ciel: [0xb9cde0, 0xdbe6f0, 0xf2f6fa], brume: [0xeef3f7, 50, 230], soleil: [0xffffff, 1.2], hemi: [0xf4f9ff, 0xe6eef6, 1.3], ambiante: 0.2, exposition: 1.05, ombre: [0.35, 4], ao: 0.35, sol: ["#f4f8fb", "#e3ecf4"], silhouettes: 0.45 },
  nuit: { ciel: [0x010208, 0x050a22, 0x10193e], brume: [0x060a1c, 35, 180], soleil: [0x8ea6ff, 0.32], hemi: [0x1c2550, 0x05060f, 0.14], ambiante: 0.03, exposition: 1.0, ombre: [0.6, 1], ao: 0.6, sol: ["#0a0d1c", "#0a0d1c"], silhouettes: 0.2, lampes: { couleur: 0xffa94d, nombre: 4, intensite: 260, portee: 26 } },
  campagne: { ciel: [0x3f6fc4, 0xc9a7a0, 0xffc77a], brume: [0xf6c88a, 110, 360], soleil: [0xffb35c, 2.7], hemi: [0xffdcae, 0x5f8a34, 0.48], ambiante: 0.1, exposition: 1.0, ombre: [0.95, 1], ao: 0.5, sol: ["#6fb44c", "#5c9e3c"], silhouettes: 0.3 },
  canyon: { ciel: [0x4a3b8c, 0xb06a8a, 0xffa25a], brume: [0xf4a065, 90, 320], soleil: [0xff8a3c, 3.0], hemi: [0xffc49a, 0xa8552e, 0.5], ambiante: 0.1, exposition: 1.02, ombre: [1, 1], ao: 0.55, sol: ["#d49a55", "#b8743a"], silhouettes: 0.3 },
  alpin: { ciel: [0x0f4fb8, 0x4f95dc, 0xd6ecfa], brume: [0xd6ecfa, 170, 540], soleil: [0xfffaf0, 2.9], hemi: [0xdcecff, 0x6f9a5a, 0.58], ambiante: 0.1, exposition: 1.0, ombre: [0.95, 1], ao: 0.45, sol: ["#86b56f", "#74a25e"], silhouettes: 0.2 },
  ville: { ciel: [0x5f86b4, 0x9fb7cf, 0xd4dbe2], brume: [0xc9d1d9, 80, 300], soleil: [0xfff1d8, 2.0], hemi: [0xe6ecf5, 0x7c8088, 0.7], ambiante: 0.14, exposition: 0.98, ombre: [0.75, 2], ao: 0.65, sol: ["#9a9da4", "#8f9298"], silhouettes: 0.4 },
  neon: { ciel: [0x06000f, 0x1a0636, 0x3a0b66], brume: [0x14062a, 40, 200], soleil: [0xff9af0, 0.4], hemi: [0x4a2a80, 0x0a0518, 0.16], ambiante: 0.04, exposition: 1.0, ombre: [0.5, 1], ao: 0.6, sol: ["#1a0830", "#1a0830"], silhouettes: 0.2, lampes: { couleur: 0xff4fd8, nombre: 4, intensite: 220, portee: 24 } },
};

/**
 * Occlusion par sommets : sur chaque face pentue (mur, flanc, tronc, façade), les sommets du bas s'assombrissent jusqu'à `force` × 50 % sur 1,6 m
 * au-dessus du point le plus bas de la face. Une seule fois, à la construction ; rien par image. Les faces horizontales ne changent pas.
 */
export function occlusionSommets(g: BufferGeometry, force: number): void {
  const pos = g.getAttribute("position");
  const col = g.getAttribute("color");
  if (!pos || !col || g.index) return;
  const p = pos.array as ArrayLike<number>;
  const c = col.array as Float32Array;
  for (let i = 0; i + 2 < pos.count; i += 3) {
    const ax = p[i * 3]!, ay = p[i * 3 + 1]!, az = p[i * 3 + 2]!;
    const bx = p[i * 3 + 3]! - ax, by = p[i * 3 + 4]! - ay, bz = p[i * 3 + 5]! - az;
    const cx = p[i * 3 + 6]! - ax, cy = p[i * 3 + 7]! - ay, cz = p[i * 3 + 8]! - az;
    const nx = by * cz - bz * cy;
    const ny = bz * cx - bx * cz;
    const nz = bx * cy - by * cx;
    const n = Math.hypot(nx, ny, nz) || 1;
    if (Math.abs(ny / n) > 0.6) continue;
    const y0 = Math.min(ay, ay + by, ay + cy);
    for (let k = 0; k < 3; k++) {
      const y = p[(i + k) * 3 + 1]!;
      const f = 1 - force * 0.5 * (1 - Math.min(1, (y - y0) / 1.6));
      for (let j = 0; j < 3; j++) c[(i + k) * 3 + j] = c[(i + k) * 3 + j]! * f;
    }
  }
  col.needsUpdate = true;
}

/** Coordonnées de texture « monde » par face (projection sur le plan le plus proche, 1 répétition tous les `pas` m) : le grain suit la géométrie. */
export function uvMonde(g: BufferGeometry, pas: number): void {
  const pos = g.getAttribute("position");
  if (!pos || g.index) return;
  const p = pos.array as ArrayLike<number>;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i + 2 < pos.count; i += 3) {
    const bx = p[i * 3 + 3]! - p[i * 3]!, by = p[i * 3 + 4]! - p[i * 3 + 1]!, bz = p[i * 3 + 5]! - p[i * 3 + 2]!;
    const cx = p[i * 3 + 6]! - p[i * 3]!, cy = p[i * 3 + 7]! - p[i * 3 + 1]!, cz = p[i * 3 + 8]! - p[i * 3 + 2]!;
    const nx = Math.abs(by * cz - bz * cy);
    const ny = Math.abs(bz * cx - bx * cz);
    const nz = Math.abs(bx * cy - by * cx);
    for (let k = 0; k < 3; k++) {
      const x = p[(i + k) * 3]!, y = p[(i + k) * 3 + 1]!, z = p[(i + k) * 3 + 2]!;
      const [u, v] = ny >= nx && ny >= nz ? [x, z] : nx >= nz ? [z, y] : [x, y];
      uv[(i + k) * 2] = u / pas;
      uv[(i + k) * 2 + 1] = v / pas;
    }
  }
  g.setAttribute("uv", new BufferAttribute(uv, 2));
}

/** Les sources de lumière chaude de la scène (lampadaires) : lues dans les halos (un seul `Points`, couleurs par sommet). */
function sourcesChaudes(scene: Object3D): [number, number, number][] {
  const out: [number, number, number][] = [];
  scene.traverse((o) => {
    if (!(o instanceof Points) || !o.geometry.getAttribute("size")) return;
    const pos = o.geometry.getAttribute("position");
    const col = o.geometry.getAttribute("color");
    for (let i = 0; i < pos.count; i++) {
      const r = col.getX(i);
      const g = col.getY(i);
      const b = col.getZ(i);
      if (r > 0.5 && g > r * 0.55 && b < g * 0.85 && b < r * 0.75) out.push([pos.getX(i), pos.getY(i), pos.getZ(i)]);
    }
  });
  return out;
}

/** Flaque de lumière : un disque doux (la lumière, en 3D, peut avoir un dégradé : voir le document de direction). */
export function textureFlaque(couleur: number): CanvasTexture {
  const n = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = n;
  const ctx = canvas.getContext("2d")!;
  const r = (couleur >> 16) & 255;
  const g = (couleur >> 8) & 255;
  const b = couleur & 255;
  const grad = ctx.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  grad.addColorStop(0, `rgba(${r},${g},${b},0.55)`);
  grad.addColorStop(0.5, `rgba(${r},${g},${b},0.22)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, n, n);
  return new CanvasTexture(canvas);
}

/**
 * L'éclairage de piste des thèmes de nuit : un lampadaire sur le rebord tous les deux blocs (côtés alternés), sa tête lumineuse, son halo et une
 * flaque de lumière sur la route (un seul maillage additif pour toutes les flaques). Rend le groupe à ajouter et la position des têtes (sources).
 */
export function eclairagePiste(track: Track, couleur: number): { objets: Object3D[]; sources: [number, number, number][] } {
  const poteaux = new Builder();
  const tetes = new Builder();
  const pos: number[] = [];
  const uv: number[] = [];
  const sources: [number, number, number][] = [];
  for (const b of track.blocks) {
    if (b.index % 2 !== 0 || b.kind === "gap" || b.kind === "jump" || b.kind === "kick" || b.cuve || b.mark) continue;
    const cote = (b.index >> 1) % 2 === 0 ? 1 : -1;
    const hw = isCurve(b.kind) ? b.w0 / 2 : blockHalfWidth(b, CELL / 2);
    const pied = onBlock(b, cote * (hw + 0.7), 0.5, b.open ? 0 : 1.4);
    const vers = onBlock(b, cote * (hw - 1.4), 0.5, 7.2);
    const h = 7.2 - (b.open ? 0 : 1.4);
    poteaux.box(pied[0] - 0.12, pied[1], pied[2] - 0.12, pied[0] + 0.12, pied[1] + h, pied[2] + 0.12, 0x2a2f45);
    poteaux.box(Math.min(pied[0], vers[0]) - 0.1, vers[1] - 0.1, Math.min(pied[2], vers[2]) - 0.1, Math.max(pied[0], vers[0]) + 0.1, vers[1] + 0.05, Math.max(pied[2], vers[2]) + 0.1, 0x2a2f45);
    tetes.box(vers[0] - 0.35, vers[1] - 0.25, vers[2] - 0.35, vers[0] + 0.35, vers[1] - 0.1, vers[2] + 0.35, couleur);
    tetes.halo(vers[0], vers[1] - 0.3, vers[2], couleur, 6);
    sources.push([vers[0], vers[1], vers[2]]);
    // Flaque : un carré de 16 m posé sur la route sous la tête.
    const sol = onBlock(b, cote * (hw - 1.4) * 0.6, 0.5, 0.08);
    const R = 8;
    for (const [x, z, u, v] of [[-R, -R, 0, 0], [R, -R, 1, 0], [R, R, 1, 1], [-R, -R, 0, 0], [R, R, 1, 1], [-R, R, 0, 1]] as const) {
      pos.push(sol[0] + x, sol[1], sol[2] + z);
      uv.push(u, v);
    }
  }
  const objets: Object3D[] = [];
  if (sources.length === 0) return { objets, sources };
  const mat = new MeshStandardMaterial({ vertexColors: true, flatShading: true });
  const m1 = new Mesh(poteaux.geometry(), mat);
  m1.castShadow = true;
  const m2 = new Mesh(tetes.geometry(), new MeshBasicMaterial({ vertexColors: true }));
  const g = new Geometrie();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  const flaques = new Mesh(g, new MeshBasicMaterial({ map: textureFlaque(couleur), transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
  flaques.renderOrder = 3;
  objets.push(m1, m2, flaques);
  const halos = buildHalos(tetes.halos, 1);
  if (halos) objets.push(halos.points);
  return { objets, sources };
}

/**
 * La lumière de C (ciel, brume, lumières, ombres, exposition) : quelques nombres par thème, rien à construire. **Peut entrer dans le premier
 * chargement** (voir le document de direction). Rend la même scène avec son exposition.
 */
export function appliquerLumiereC(ts: TrackScene, palette: PaletteName): TrackScene {
  const t = THEMES_C[palette];
  const scene = ts.scene;
  (scene.background as Texture | null)?.dispose?.();
  scene.background = texturedCielC(t.ciel);
  if (scene.fog) scene.fog = new Fog(t.brume[0], t.brume[1], t.brume[2]);
  scene.traverse((obj) => {
    if (obj instanceof HemisphereLight) {
      obj.color.set(t.hemi[0]);
      obj.groundColor.set(t.hemi[1]);
      obj.intensity = t.hemi[2];
    } else if (obj instanceof AmbientLight) {
      obj.color.set(t.hemi[0]);
      obj.intensity = t.ambiante;
    } else if (obj instanceof DirectionalLight) {
      obj.color.set(t.soleil[0]);
      obj.intensity = t.soleil[1];
      obj.shadow.intensity = t.ombre[0];
      obj.shadow.radius = t.ombre[1];
    } else if (obj instanceof SpotLight) {
      // Phares : un faisceau un peu plus large et plus long la nuit.
      obj.angle = 0.7;
      obj.distance = 130;
    } else if (obj instanceof Mesh && obj.renderOrder === -1 && t.silhouettes > 0 && !(obj.material instanceof MeshStandardMaterial)) {
      // Silhouettes lointaines : fondues vers la brume du thème.
      const col = (obj.geometry as BufferGeometry).getAttribute("color");
      if (col) {
        const [r, g, b] = [((t.brume[0] >> 16) & 255) / 255, ((t.brume[0] >> 8) & 255) / 255, (t.brume[0] & 255) / 255];
        for (let i = 0; i < col.count; i++) col.setXYZ(i, col.getX(i) * (1 - t.silhouettes) + r * t.silhouettes, col.getY(i) * (1 - t.silhouettes) + g * t.silhouettes, col.getZ(i) * (1 - t.silhouettes) + b * t.silhouettes);
        col.needsUpdate = true;
      }
    }
  });
  return { ...ts, look: { ...ts.look, exposure: t.exposition } };
}

/** Applique la lumière et la matière de C à une scène construite. Rend la même scène (modifiée) avec son exposition et son suivi de voiture. */
export function appliquerC(ts: TrackScene, palette: PaletteName, track: Track): TrackScene {
  return appliquerMatiereC(appliquerLumiereC(ts, palette), palette, track);
}

/**
 * La matière de C : occlusion par sommets, grain (coordonnées « monde »), sol du thème, ombres de contact de la piste, éclairage de piste et
 * lampes de la nuit. Des textures et un passage sur les sommets : **peut arriver juste après le premier écran** (chargé à la demande), la scène
 * s'enrichit sans changer de forme.
 */
export function appliquerMatiereC(ts: TrackScene, palette: PaletteName, track: Track): TrackScene {
  const t = THEMES_C[palette];
  const scene = ts.scene;
  const textures: Texture[] = [];
  const grainTex = grain();
  const vus = new Set<BufferGeometry>();
  scene.traverse((obj) => {
    if (!(obj instanceof Mesh)) return;
    const m = obj.material;
    if (!(m instanceof MeshStandardMaterial || m instanceof MeshToonMaterial)) return;
    const geo = obj.geometry as BufferGeometry;
    if (m.vertexColors && geo.getAttribute("color") && !vus.has(geo)) {
      vus.add(geo);
      occlusionSommets(geo, t.ao);
      uvMonde(geo, 4);
      // Les rebords et le relief projettent leur ombre sur la piste (ombres de contact) ; le décor non (coût : lot 23).
      if (obj.receiveShadow && !obj.userData.heavy && obj.userData.level === undefined) obj.castShadow = true;
      if (!m.map) {
        m.map = grainTex;
        m.needsUpdate = true;
      }
    } else if (!m.vertexColors && m.map && geo.type === "PlaneGeometry") {
      // Le sol lointain : la texture du thème remplace le damier (même répétition : une tuile de 16 m).
      const sol = texturedSol(SOLS_C[palette], t.sol[0], t.sol[1]);
      sol.repeat.copy(m.map.repeat);
      m.map.dispose();
      m.map = sol;
      m.needsUpdate = true;
      textures.push(sol);
    }
  });
  // Nuit : quelques lampes réelles, posées à chaque image sur les lampadaires les plus proches de la voiture (aucun objet créé par image).
  const lampes: PointLight[] = [];
  const sources = t.lampes ? sourcesChaudes(scene) : [];
  if (t.lampes) {
    const piste = eclairagePiste(track, t.lampes.couleur);
    for (const obj of piste.objets) scene.add(obj);
    sources.push(...piste.sources);
  }
  if (t.lampes && sources.length > 0) {
    for (let i = 0; i < t.lampes.nombre; i++) {
      const l = new PointLight(t.lampes.couleur, t.lampes.intensite, t.lampes.portee, 1.6);
      l.userData.level = 1;
      lampes.push(l);
      scene.add(l);
    }
  }
  // Les `n` sources les plus proches, sans rien allouer (sélection dans un tableau fixe).
  const choix = new Int32Array(lampes.length);
  const dist = new Float64Array(lampes.length);
  const proches = (x: number, z: number) => {
    dist.fill(Infinity);
    choix.fill(-1);
    for (let i = 0; i < sources.length; i++) {
      const d = (sources[i]![0] - x) ** 2 + (sources[i]![2] - z) ** 2;
      let k = lampes.length - 1;
      if (d >= dist[k]!) continue;
      while (k > 0 && d < dist[k - 1]!) {
        dist[k] = dist[k - 1]!;
        choix[k] = choix[k - 1]!;
        k--;
      }
      dist[k] = d;
      choix[k] = i;
    }
  };
  return {
    ...ts,
    followCar(x, y, z, yaw, hood) {
      ts.followCar(x, y, z, yaw, hood);
      if (lampes.length === 0) return;
      proches(x, z);
      lampes.forEach((l, i) => {
        const s = sources[choix[i]!];
        if (s) l.position.set(s[0], s[1] - 0.4, s[2]);
      });
    },
    dispose() {
      for (const tx of textures) tx.dispose();
      ts.dispose();
    },
  };
}
