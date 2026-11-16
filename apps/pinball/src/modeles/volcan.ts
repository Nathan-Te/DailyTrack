import { ENCRE, poly, rond, alea, type ModelesDuTheme, type Outils } from "./types";

// Lot PBV4 — le Volcan : des braises, roches sombres aux fissures de lave luisantes (bumpers), des rochers (cibles), un moulin (spinner), un cratère au bord de roche et à la lueur au fond (trou). La lave est la
// couleur la plus vive de la table : un bumper reste lisible sur la roche sombre du sol par ses fissures et par son socle doré. Repères : ceux de `foire.ts`.

const SOCLE = "#C58A4E";
const SOCLE_VIF = "#FFB347";
const LAVE = "#FF6A1A";
const BRAISE = "#3b2620";
const ROCHERS = ["#B8B4C0", "#A59FB2", "#C9C2B6"] as const;
const PIERRE = "#8a6a52";
const PENCHE = -0.5;

/** Les bords de roche d'un cratère : des blocs serrés en anneau. */
function bord(o: Outils): ReturnType<Outils["fusion"]> {
  const t = alea(5);
  return o.fusion(...Array.from({ length: 10 }, (_, k) => o.roche(3.6 + t() * 0.9, 20 + k, { x: Math.cos((k / 10) * Math.PI * 2) * 16.2, y: 2, z: Math.sin((k / 10) * Math.PI * 2) * 16.2, sy: 0.7 }, 0.2, 7)));
}

export const VOLCAN: ModelesDuTheme = {
  lumieres: { bumper: [SOCLE, SOCLE_VIF], trou: ["#B8401A", "#FFD27A"] },
  trois: {
    bumper: (o) => ({
      pivot: [0, 4, 0],
      pieces: [
        { geo: o.tore(17.4, 3.8, { y: 2.6, rx: Math.PI / 2, sz: 0.7 }, 28), m: { c: SOCLE, rug: 0.7 }, role: "lumiere", contour: 0.6 },
        // la braise : une roche bosselée autour d'un cœur de lave ; là où la roche se creuse, la lave luit
        { geo: o.sphere(13.7, { y: 16 }, 18), m: { c: LAVE, rug: 0.6, em: "#FF4A0A" }, role: "haut", sansOmbre: true },
        { geo: o.roche(15, 11, { y: 16 }, 0.3, 18), m: { c: BRAISE, rug: 0.95, env: 0.3 }, role: "haut", contour: 0.7 },
      ],
    }),
    cible: (o) => ({
      // un tas de rochers : un gros au milieu, deux petits contre lui, penchés vers le joueur
      pieces: [
        {
          geo: o.placer(o.fusion(o.roche(7.2, 23, { y: 8.4, sy: 1.3, sz: 0.75 }, 0.16, 12), o.roche(4.3, 29, { x: -6.1, y: 3.8, z: 1, sz: 0.8 }, 0.2, 8), o.roche(4, 31, { x: 6.2, y: 3.6, z: 0.6, sz: 0.8 }, 0.2, 8)), { rx: -0.3, z: 1.5 }),
          m: { c: ROCHERS[0], rug: 0.9, teintes: ROCHERS },
          contour: 0.7,
        },
      ],
    }),
    spinner: (o) => {
      // le moulin : une tour de pierre, son toit, quatre ailes de bois et de toile qui tournent face à la caméra
      // une aile : la vergue, une toile, trois lattes en travers
      const aile = (k: number): [ReturnType<Outils["fusion"]>, ReturnType<Outils["fusion"]>] => [
        o.placer(o.fusion(o.boite(1.6, 16.5, 1, { y: 10 }), ...[6, 11, 16].map((y) => o.boite(5.2, 0.8, 1.1, { x: 2.4, y }))), { rz: (k * Math.PI) / 2 }),
        o.placer(o.boite(4.4, 12.5, 0.5, { x: 2.5, y: 11.5, z: -0.3 }), { rz: (k * Math.PI) / 2 }),
      ];
      const ailes = [0, 1, 2, 3].map(aile);
      const pose = { y: 15, z: -0.5, rx: PENCHE };
      return {
        pivot: [0, 15, -0.5],
        axe: [0, -Math.sin(PENCHE), Math.cos(PENCHE)],
        pieces: [
          { geo: o.cylindre(5.5, 7.5, 15, { y: 7.5, z: -6 }, 14), m: { c: PIERRE, rug: 0.9 }, contour: 0.5 },
          { geo: o.cylindre(0, 7.4, 7, { y: 18.5, z: -6 }, 14), m: { c: "#C2401F", rug: 0.6 }, contour: 0.5 },
          { geo: o.placer(o.fusion(...ailes.map((a) => a[0]), o.sphere(2.2, {}, 10)), pose), m: { c: "#7A4A2A", rug: 0.7 }, role: "tourne", contour: 0.4 },
          { geo: o.placer(o.fusion(...ailes.map((a) => a[1])), pose), m: { c: "#EBD49E", rug: 0.8 }, role: "tourne", contour: 0.35 },
        ],
      };
    },
    trou: (o) => ({
      pieces: [
        // la lueur au fond, qui monte quand le cratère garde la bille
        { geo: o.cylindre(13, 13, 0.6, { y: 0.35 }, 28), m: { c: "#B8401A", rug: 0.8, em: "#4a1404" }, role: "lumiere", sansOmbre: true },
        { geo: o.tore(13, 0.9, { y: 0.9, rx: Math.PI / 2 }, 28), m: { c: "#1a0f0a", rug: 1 } },
        { geo: bord(o), m: { c: "#5a463c", rug: 0.95 }, contour: 0.6 },
      ],
    }),
  },
  plat: {
    socle(c, r, lum) {
      rond(c, 0, 0, r * 1.22, lum, 2.5);
      rond(c, 0, 0, r * 0.98, "#2E221E", 0);
    },
    haut(c, r, k) {
      const t = alea(11 + k);
      const pts = Array.from({ length: 10 }, (_, j) => [Math.cos((j / 10) * Math.PI * 2) * r * (0.78 + t() * 0.14), Math.sin((j / 10) * Math.PI * 2) * r * (0.78 + t() * 0.14)] as const);
      poly(c, pts, BRAISE, 2.5);
      // les fissures de lave
      c.strokeStyle = LAVE;
      c.lineWidth = 1.8;
      c.lineCap = "round";
      for (let j = 0; j < 4; j++) {
        const a = (j / 4) * Math.PI * 2 + t();
        c.beginPath();
        c.moveTo(Math.cos(a) * r * 0.1, Math.sin(a) * r * 0.1);
        c.lineTo(Math.cos(a + 0.3) * r * 0.42, Math.sin(a + 0.3) * r * 0.42);
        c.lineTo(Math.cos(a - 0.1) * r * 0.7, Math.sin(a - 0.1) * r * 0.7);
        c.stroke();
      }
    },
    cible(c, l, k) {
      const t = alea(23 + k);
      poly(c, Array.from({ length: 9 }, (_, j) => [Math.cos((j / 9) * Math.PI * 2) * l * (0.46 + t() * 0.06), Math.sin((j / 9) * Math.PI * 2) * l * (0.25 + t() * 0.05)] as const), ROCHERS[k % 3]!, 1.6);
    },
    spinnerFixe(c) {
      rond(c, 0, -2, 6, PIERRE, 1.5);
    },
    spinnerTourne(c, l) {
      for (let k = 0; k < 4; k++) {
        c.save();
        c.rotate((k * Math.PI) / 2);
        poly(c, [[0.5, -3], [l * 0.3, -3], [l * 0.3, -l * 0.72], [0.5, -l * 0.72]], "#F2E2BC", 1.2);
        c.strokeStyle = "#7A4A2A";
        c.lineWidth = 1.6;
        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(0, -l * 0.75);
        c.stroke();
        c.restore();
      }
      rond(c, 0, 0, 2.6, "#7A4A2A", 1.2);
    },
    trou(c, r, lum) {
      const t = alea(5);
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        rond(c, Math.cos(a) * r * 1.25, Math.sin(a) * r * 1.25, r * (0.3 + t() * 0.06), "#5a463c", 1.4);
      }
      rond(c, 0, 0, r, lum, 2, ENCRE);
      rond(c, 0, 0, r * 0.55, "#FFD27A", 0);
    },
  },
};
