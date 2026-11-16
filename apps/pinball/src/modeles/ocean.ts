import { ENCRE, poly, rond, type ModelesDuTheme, type Outils, type Point3 } from "./types";

// Lot PBV4 — l'Océan : des bulles sur un socle de corail (bumpers), des coquillages (cibles), une hélice de bateau (spinner), une pieuvre autour du trou (trou). Repères : ceux de `foire.ts`.

const CORAIL = "#F08A6C";
const CORAIL_VIF = "#FFE08A";
const BULLE = "#E4FBFF";
const BRONZE = "#C98A3A";
const PIEUVRE = "#C4527A";
const VENTOUSE = "#F7C8D8";
const PENCHE = -0.5;

/** Le contour d'un coquillage (un éventail aux bords festonnés), dans le plan x-y, la charnière en bas. */
function coquille(): [number, number][] {
  const pts: [number, number][] = [[-3.6, 0], [-3.6, 1.6]];
  for (let k = 0; k <= 28; k++) {
    const a = Math.PI * (0.92 - (k / 28) * 0.84);
    const r = 9.2 + 0.9 * Math.abs(Math.cos(k * (Math.PI / 4)));
    pts.push([Math.cos(a) * r * 1.06, 1.6 + Math.sin(a) * r]);
  }
  pts.push([3.6, 1.6], [3.6, 0]);
  return pts;
}
/** Un tentacule de la pieuvre, de l'angle `a` : il part du bord du trou, s'écarte en tournant et s'enroule au bout. */
function tentacule(a: number): Point3[] {
  return Array.from({ length: 8 }, (_, j) => {
    const t = j / 7;
    const r = 14 + t * 6.6 - (t > 0.8 ? (t - 0.8) * 6 : 0);
    const b = a + t * 0.75 + (t > 0.8 ? (t - 0.8) * 4 : 0);
    return [Math.cos(b) * r, 1.8 - t * 0.9, Math.sin(b) * r] as const;
  });
}

export const OCEAN: ModelesDuTheme = {
  lumieres: { bumper: [CORAIL, CORAIL_VIF], trou: [VENTOUSE, "#FFC21A"] },
  trois: {
    bumper: (o: Outils) => {
      // le corail : un anneau de blocs bosselés et des branches qui montent en s'écartant, une boule au bout
      const blocs = Array.from({ length: 9 }, (_, k) => o.roche(3.6, 40 + k, { x: Math.cos((k / 9) * Math.PI * 2) * 16.6, y: 2.4, z: Math.sin((k / 9) * Math.PI * 2) * 16.6, sy: 0.8 }, 0.25, 6));
      const branches = [0.3, 1.55, 2.8, 4.05, 5.3].flatMap((a, k) => {
        const h = 9 + (k % 3) * 2.5;
        const p: Point3[] = [[Math.cos(a) * 16, 2, Math.sin(a) * 16], [Math.cos(a + 0.1) * 17.5, h * 0.6, Math.sin(a + 0.1) * 17.5], [Math.cos(a + 0.15) * 19, h, Math.sin(a + 0.15) * 19]];
        return [o.tube(p, 1.8, 1.1, {}, 5), o.sphere(1.7, { x: p[2]![0], y: p[2]![1], z: p[2]![2] }, 6)];
      });
      return {
        pivot: [0, 5, 0],
        pieces: [
          { geo: o.fusion(o.tore(16.2, 2.6, { y: 1.6, rx: Math.PI / 2, sz: 0.7 }, 20), ...blocs, ...branches), m: { c: CORAIL, rug: 0.75 }, role: "lumiere", contour: 0.6 },
          // la bulle : translucide, des reflets de la pièce ; un éclat blanc et une petite bulle sœur
          { geo: o.sphere(15.5, { y: 19 }, 22), m: { c: BULLE, rug: 0.04, env: 2, op: 0.5 }, role: "haut", sansOmbre: true },
          { geo: o.fusion(o.sphere(3.4, { x: -6, y: 26, z: 7, sy: 0.55 }, 10), o.sphere(1.6, { x: 5, y: 27, z: 6 }, 8)), m: { c: "#ffffff", rug: 0.1, em: "#9ad9e6" }, role: "haut", sansOmbre: true },
          { geo: o.tore(15.3, 0.45, { y: 19, rx: -1.15 }, 32), m: { c: "#8fe3f0", rug: 0.2, em: "#2a7f95" }, role: "haut", sansOmbre: true },
        ],
      };
    },
    cible: (o) => {
      const ex = 1.6;
      const cotes = Array.from({ length: 7 }, (_, k) => o.boite(0.8, 8.6, 0.8, { x: Math.sin((k - 3) * 0.33) * 4.9, y: 1.6 + Math.cos((k - 3) * 0.33) * 4.9, z: ex, rz: -(k - 3) * 0.33 }));
      return {
        pieces: [
          { geo: o.extruder(coquille(), 3, { rx: -0.5, sy: 1.15 }), m: { c: "#F7B7A3", rug: 0.35, env: 0.8, teintes: ["#F7B7A3", "#F2C94C", "#FFE6CC"] }, contour: 0.6 },
          { geo: o.placer(o.fusion(...cotes), { rx: -0.5, sy: 1.15 }), m: { c: "#B8664A", rug: 0.5 } },
        ],
      };
    },
    spinner: (o) => {
      // l'hélice à trois pales vrillées, sur un mât ; elle se penche vers la caméra
      const pale = (k: number): ReturnType<Outils["fusion"]> => {
        const forme: [number, number][] = Array.from({ length: 14 }, (_, j) => {
          const a = (j / 14) * Math.PI * 2;
          return [Math.cos(a) * 4.2 * (Math.sin(a) > 0 ? 1 : 0.7), 10 + Math.sin(a) * 8];
        });
        return o.placer(o.extruder(forme, 1.4, { ry: 0.45 }, 0.4), { rz: (k * Math.PI * 2) / 3 });
      };
      return {
        pivot: [0, 15, 0],
        axe: [0, -Math.sin(PENCHE), Math.cos(PENCHE)],
        pieces: [
          { geo: o.fusion(o.cylindre(2.2, 3.2, 15, { y: 7.5, z: -3 }, 12), o.cylindre(6, 7, 2, { y: 1, z: -3 }, 16), o.cylindre(1.5, 1.5, 6, { y: 15, z: -1.5, rx: Math.PI / 2 + PENCHE }, 8)), m: { c: "#2E6E8E", rug: 0.4 }, contour: 0.5 },
          { geo: o.placer(o.fusion(pale(0), pale(1), pale(2), o.sphere(3.4, { sz: 1.3 }, 12)), { y: 15, rx: PENCHE }), m: { c: BRONZE, met: 0.9, rug: 0.3, env: 1.2 }, role: "tourne", contour: 0.5 },
        ],
      };
    },
    trou: (o) => {
      const t = [0, 1, 2, 3, 5, 6, 7].map((k) => tentacule((k * Math.PI) / 4 + Math.PI / 8));
      const tete = o.sphere(7.4, { y: 5.2, z: -14.5, sy: 0.85, sz: 0.9 }, 12);
      return {
        pieces: [
          { geo: o.cylindre(13, 13, 0.6, { y: 0.3 }, 28), m: { c: "#0c0806", rug: 1 } },
          { geo: o.fusion(o.tore(14.4, 2.4, { y: 1.3, rx: Math.PI / 2, sz: 0.8 }, 20), ...t.map((p) => o.tube(p, 3.2, 0.9, {}, 6)), tete), m: { c: PIEUVRE, rug: 0.45, env: 0.7 }, contour: 0.5 },
          { geo: o.fusion(o.sphere(2.2, { x: -3, y: 9.6, z: -10.4, sz: 0.7 }, 10), o.sphere(2.2, { x: 3, y: 9.6, z: -10.4, sz: 0.7 }, 10)), m: { c: "#FFF6E0", rug: 0.3 }, contour: 0.4 },
          { geo: o.fusion(o.sphere(1, { x: -3, y: 9.9, z: -9, sz: 0.6 }, 8), o.sphere(1, { x: 3, y: 9.9, z: -9, sz: 0.6 }, 8)), m: { c: ENCRE, rug: 0.2 } },
          // les ventouses : elles s'allument quand la pieuvre garde la bille
          { geo: o.fusion(...t.flatMap((p) => [1, 3, 5].map((j) => o.sphere(1.6, { x: p[j]![0], y: p[j]![1] + 2.4 - j * 0.25, z: p[j]![2] }, 6)))), m: { c: VENTOUSE, rug: 0.4 }, role: "lumiere", sansOmbre: true },
        ],
      };
    },
  },
  plat: {
    socle(c, r, lum) {
      for (let k = 0; k < 9; k++) rond(c, Math.cos(k * 0.7) * r * 1.05, Math.sin(k * 0.7) * r * 1.05, r * 0.18, lum, 1.4);
      rond(c, 0, 0, r * 1.05, null, 4.5, lum);
    },
    haut(c, r) {
      c.globalAlpha = 0.55;
      rond(c, 0, 0, r * 0.92, BULLE, 0);
      c.globalAlpha = 1;
      rond(c, 0, 0, r * 0.92, null, 2, "#2E6E8E");
      c.beginPath();
      c.arc(0, 0, r * 0.68, Math.PI * 1.05, Math.PI * 1.45);
      c.strokeStyle = "#ffffff";
      c.lineWidth = 2.4;
      c.stroke();
      rond(c, r * 0.35, -r * 0.4, r * 0.1, "#ffffff", 0);
    },
    cible(c, l, k) {
      const t = ["#F7B7A3", "#F2C94C", "#FFE6CC"][k % 3]!;
      const pts = coquille().map(([x, y]) => [(x * l) / 22, ((y - 6) * l) / 26] as const);
      poly(c, pts, t, 1.6);
      c.strokeStyle = "#B8664A";
      c.lineWidth = 0.9;
      for (let j = -3; j <= 3; j++) {
        c.beginPath();
        c.moveTo(0, ((1.6 - 6) * l) / 26);
        c.lineTo(Math.sin(j * 0.33) * l * 0.36, ((1.6 - 6) * l) / 26 + Math.cos(j * 0.33) * l * 0.36);
        c.stroke();
      }
    },
    spinnerFixe(c) {
      rond(c, 0, 0, 5, "#2E6E8E", 1.5);
    },
    spinnerTourne(c, l) {
      for (let k = 0; k < 3; k++) {
        c.save();
        c.rotate((k * Math.PI * 2) / 3);
        c.beginPath();
        c.ellipse(0, -l * 0.42, l * 0.2, l * 0.36, 0.25, 0, Math.PI * 2);
        c.fillStyle = BRONZE;
        c.fill();
        c.lineWidth = 1.6;
        c.strokeStyle = ENCRE;
        c.stroke();
        c.restore();
      }
      rond(c, 0, 0, 3.6, "#E3B36A", 1.5);
    },
    trou(c, r, lum) {
      c.lineCap = "round";
      for (const k of [0, 1, 2, 3, 5, 6, 7]) {
        const p = tentacule((k * Math.PI) / 4 + Math.PI / 8);
        for (const [w, coul] of [[6.4, ENCRE], [4.6, PIEUVRE]] as const) {
          c.beginPath();
          p.forEach(([x, , z], j) => (j ? c.lineTo(x, z) : c.moveTo(x, z)));
          c.lineWidth = w;
          c.strokeStyle = coul;
          c.stroke();
        }
        for (const j of [1, 3, 5]) rond(c, p[j]![0], p[j]![2], 1.3, lum, 0);
      }
      rond(c, 0, 0, r * 1.12, PIEUVRE, 2);
      // la tête, derrière le trou, et ses yeux
      c.beginPath();
      c.ellipse(0, -r * 1.12, 7.4, 6.6, 0, 0, Math.PI * 2);
      c.fillStyle = PIEUVRE;
      c.fill();
      c.lineWidth = 2;
      c.strokeStyle = ENCRE;
      c.stroke();
      for (const s of [-3, 3]) {
        rond(c, s, -r * 0.85, 2.1, "#FFF6E0", 1);
        rond(c, s, -r * 0.8, 1, ENCRE, 0);
      }
      rond(c, 0, 0, r, "#120C08", 2);
    },
  },
};
