import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Vector3, type Mesh } from "three";
import { HAUTEUR, LARGEUR, PLANS_ESSAI, THEMES_PINBALL, Partie, dailyPinball, formesDeLaTable, type Forme } from "@cdj/pinball-sim";
import { VUE_DEFAUT } from "../src/bornes";
import { creerRails3d } from "../src/rails3d";

// Lot PBT0 — VISIBILITÉ : « dans la vue de la caméra, en portrait 390 × 844, aucun objectif ni aucun bumper n'est caché, même en partie, par un rail. » Retour de Nathan : trois rails en voies de wagonnet formaient une cage
// sur la moitié haute et on ne voyait plus ce qu'on visait. Le test **projette** : la caméra de `corps.ts` (la vue par défaut, `cadrer` recopié : elle cadre toute la table), les vrais maillages des rails (`creerRails3d`, avec leurs
// arches), et pour chaque obstacle de la table (`formesDeLaTable` : bumpers, cibles, portes, éléments des thèmes, trou…) la silhouette qu'il a à l'écran — son empreinte au sol **et** son sommet, à la hauteur de son modèle.
// Aucun pixel de cette silhouette ne doit être touché par un triangle d'un rail (opaque, translucide ou lumineux).
// Le cadre est celui de l'écran entier (390 × 844) : la zone libre entre les bandes du HUD est un peu plus petite, la table s'y cadre à l'identique à l'échelle près.
const L = 390;
const H = 844;
const X = (x: number): number => x - LARGEUR / 2;
const Z = (y: number): number => y - HAUTEUR / 2;
const rad = (d: number): number => (d * Math.PI) / 180;

/** La caméra par défaut du jeu pour un écran `L` × `H` : la boucle de `cadrer` de `corps.ts`. */
function camera(): PerspectiveCamera {
  const cam = new PerspectiveCamera(30, L / H, 10, 6000);
  const vue = VUE_DEFAUT;
  const el = rad(vue.angle);
  cam.fov = vue.champ;
  cam.updateProjectionMatrix();
  const CADRE: readonly (readonly [number, number, number])[] = [
    [-LARGEUR / 2 - 4, 0, Z(760) + 4], [LARGEUR / 2 + 4, 0, Z(760) + 4], [-LARGEUR / 2 - 4, 24, Z(760) + 4], [LARGEUR / 2 + 4, 24, Z(760) + 4],
    [-LARGEUR / 2 + 4, 24, Z(205)], [LARGEUR / 2 - 4, 24, Z(205)], [0, 24, Z(24)], [0, 0, Z(24)],
  ];
  const v = new Vector3();
  const extremes = (): { x: number; y0: number; y1: number } => {
    cam.updateMatrixWorld(true);
    let x = 0;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const [a, b, c] of CADRE) {
      v.set(a, b, c).project(cam);
      x = Math.max(x, Math.abs(v.x));
      y0 = Math.min(y0, v.y);
      y1 = Math.max(y1, v.y);
    }
    return { x, y0, y1 };
  };
  let d = 900;
  let tz = 0;
  for (let it = 0; it < 40; it++) {
    cam.position.set(0, d * Math.sin(el), tz + d * Math.cos(el));
    cam.lookAt(0, 0, tz);
    const e = extremes();
    const demi = (e.y1 - e.y0) / 2;
    const s = Math.max(e.x / 0.97, demi / 0.97);
    d *= 1 + (s - 1) * 0.8;
    tz -= (((e.y0 + e.y1) / 2) * d * Math.tan(rad(vue.champ / 2))) / Math.sin(el);
  }
  cam.position.set(0, d * Math.sin(el), tz + d * Math.cos(el));
  cam.lookAt(0, 0, tz);
  cam.updateMatrixWorld(true);
  return cam;
}

const ecran = (cam: PerspectiveCamera, x: number, y: number, z: number, v = new Vector3()): [number, number] => {
  v.set(x, y, z).project(cam);
  return [((v.x + 1) / 2) * L, ((1 - v.y) / 2) * H];
};

/** La hauteur d'un modèle (px) : ce qu'un rail posé devant lui lui cacherait. Les bumpers et les éléments hauts (manège, tourbillon) sont plus hauts que les cibles et le trou. */
const HAUTEUR_MODELE = (nom: string): number => (nom.endsWith(":bumpers") || nom.endsWith(":mini") || nom.endsWith(":asteroide") ? 26 : nom.endsWith(":manege") || nom.endsWith(":portailA") || nom.endsWith(":portailB") ? 22 : 14);

/** Les pixels touchés par les triangles des rails : un échantillonnage serré (un point tous les demi-pixels le long de chaque triangle) — une arête très fine (un fil) touche ses pixels. */
function masqueDesRails(cam: PerspectiveCamera, meshes: readonly Mesh[]): Uint8Array {
  const masque = new Uint8Array(L * H);
  const v = new Vector3();
  for (const m of meshes) {
    const pos = m.geometry.getAttribute("position").array;
    const idx = m.geometry.getIndex()!.array;
    const pts = new Float32Array((pos.length / 3) * 2);
    for (let i = 0; i < pos.length / 3; i++) {
      const [a, b] = ecran(cam, pos[i * 3]!, pos[i * 3 + 1]!, pos[i * 3 + 2]!, v);
      pts[i * 2] = a;
      pts[i * 2 + 1] = b;
    }
    for (let t = 0; t < idx.length; t += 3) {
      const A = idx[t]!;
      const B = idx[t + 1]!;
      const C = idx[t + 2]!;
      const ax = pts[A * 2]!;
      const ay = pts[A * 2 + 1]!;
      const bx = pts[B * 2]!;
      const by = pts[B * 2 + 1]!;
      const cx = pts[C * 2]!;
      const cy = pts[C * 2 + 1]!;
      const n = Math.max(1, Math.ceil(Math.max(Math.hypot(bx - ax, by - ay), Math.hypot(cx - ax, cy - ay), Math.hypot(cx - bx, cy - by)) * 2));
      for (let i = 0; i <= n; i++) {
        for (let j = 0; j <= n - i; j++) {
          const u = i / n;
          const w = j / n;
          const x = Math.floor(ax + (bx - ax) * u + (cx - ax) * w);
          const y = Math.floor(ay + (by - ay) * u + (cy - ay) * w);
          if (x >= 0 && y >= 0 && x < L && y < H) masque[y * L + x] = 1;
        }
      }
    }
  }
  return masque;
}

/** L'enveloppe convexe (chaîne monotone) de points de l'écran. */
function enveloppe(p: [number, number][]): [number, number][] {
  const s = [...p].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const croix = (o: [number, number], a: [number, number], b: [number, number]): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const bas: [number, number][] = [];
  for (const q of s) {
    while (bas.length >= 2 && croix(bas[bas.length - 2]!, bas[bas.length - 1]!, q) <= 0) bas.pop();
    bas.push(q);
  }
  const haut: [number, number][] = [];
  for (const q of [...s].reverse()) {
    while (haut.length >= 2 && croix(haut[haut.length - 2]!, haut[haut.length - 1]!, q) <= 0) haut.pop();
    haut.push(q);
  }
  return [...bas.slice(0, -1), ...haut.slice(0, -1)];
}
const dansLEnveloppe = (h: [number, number][], x: number, y: number): boolean => {
  for (let i = 0; i < h.length; i++) {
    const a = h[i]!;
    const b = h[(i + 1) % h.length]!;
    if ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]) < 0) return false;
  }
  return true;
};

/** Les points d'une forme à l'écran : son contour au sol et à la hauteur de son modèle. */
function silhouette(cam: PerspectiveCamera, f: Forme): [number, number][] {
  const h = HAUTEUR_MODELE(f.nom);
  const centres: [number, number][] = f.genre === "disque" ? [[f.x, f.y]] : [[f.ax, f.ay], [f.bx, f.by]];
  const pts: [number, number][] = [];
  for (const [cx, cy] of centres) {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      for (const y of [0, h]) pts.push(ecran(cam, X(cx + Math.cos(a) * f.r), y, Z(cy + Math.sin(a) * f.r)));
    }
  }
  return enveloppe(pts);
}

/** Les pixels d'une silhouette que les rails touchent. */
function pixelsCaches(masque: Uint8Array, h: [number, number][]): number {
  const xs = h.map((p) => p[0]);
  const ys = h.map((p) => p[1]);
  let n = 0;
  for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(H - 1, Math.ceil(Math.max(...ys))); y++) {
    for (let x = Math.max(0, Math.floor(Math.min(...xs))); x <= Math.min(L - 1, Math.ceil(Math.max(...xs))); x++) if (masque[y * L + x] && dansLEnveloppe(h, x + 0.5, y + 0.5)) n++;
  }
  return n;
}

/** Les plans d'essai et leurs miroirs. */
export const PLANS_A_VOIR: string[] = PLANS_ESSAI.flatMap((p) => [p.id, `${p.id}m`]);

describe("la visibilité : aucun rail ne cache un objectif ni un bumper (portrait 390 × 844, caméra par défaut)", () => {
  const cam = camera();
  for (const id of PLANS_A_VOIR) {
    for (const theme of THEMES_PINBALL) {
      it(`${id}, ${theme} : aucun pixel d'un obstacle n'est touché par un rail`, () => {
        const table = new Partie(dailyPinball(0, undefined, theme, id)).table;
        const rails = creerRails3d(theme, table);
        const masque = masqueDesRails(cam, [rails.opaque, rails.translucide, rails.rayonne].filter((m): m is Mesh => m !== null));
        const caches: string[] = [];
        for (const f of formesDeLaTable(table)) {
          // les bouches sont celles des rails : leur arche s'y pose
          if (f.nom.startsWith("bouche:")) continue;
          const n = pixelsCaches(masque, silhouette(cam, f));
          if (n > 0) caches.push(`${f.nom} (${n} px)`);
        }
        for (const x of rails.liberables) x.dispose();
        expect(caches, "obstacles cachés, même en partie, par un rail").toEqual([]);
      });
    }
  }

  it("le test voit un rail qui cache : un module posé sous le tracé d'un rail est détecté", () => {
    // sentinelle : un bumper posé au milieu de la rampe de t1 est caché par elle
    const table = new Partie(dailyPinball(0, undefined, "foire", "t1")).table;
    const rails = creerRails3d("foire", table);
    const masque = masqueDesRails(cam, [rails.opaque!, rails.translucide].filter((m): m is Mesh => m !== null));
    const rail = table.rails[0]!;
    const i = Math.floor(rail.x.length / 2);
    const faux: Forme = { nom: "S9:bumpers", genre: "disque", x: rail.x[i]! / 4096, y: rail.y[i]! / 4096, r: 17 };
    expect(pixelsCaches(masque, silhouette(cam, faux))).toBeGreaterThan(0);
    for (const x of rails.liberables) x.dispose();
  });
});
