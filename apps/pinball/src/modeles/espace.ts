import { PAPIER, ENCRE, poly, rond, alea, type ModelesDuTheme, type Outils } from "./types";

// Lot PBV4 — l'Espace : des planètes à cratères ou à anneau (bumpers, une sur deux), des satellites (cibles), un radar (spinner), une sonde et son anneau d'amarrage (trou). L'astéroïde (l'élément du thème, un
// bumper qui se déplace, et son petit voisin) devient une roche grise sur le même socle. Repères : ceux de `foire.ts`.

const SOCLE = "#3a3d66";
const NEON = "#2E8FA6";
const NEON_VIF = "#9FEFFF";
const ACIER = "#D3D7DC";
const PLANETES = ["#E46FA0", "#5FD3E8", "#E8B23A", "#9B7BEA"] as const;
const OR = "#E8B23A"; // la moutarde du jeu
const PANNEAU = "#27408F";

/** Le socle commun des planètes et de l'astéroïde : un disque de métal sombre et son anneau de néon, qui s'allume. */
function socle(o: Outils): { geo: ReturnType<Outils["fusion"]>; neon: ReturnType<Outils["fusion"]> } {
  return { geo: o.cylindre(19.5, 21, 3.5, { y: 1.75 }, 28), neon: o.tore(19.6, 1.3, { y: 3.6, rx: Math.PI / 2 }, 28) };
}
/** Des cratères : de petites calottes sombres et translucides posées sur une sphère de rayon `r` centrée à la hauteur `h` (elles assombrissent n'importe quelle teinte). */
function crateres(o: Outils, r: number, h: number, n: number, graine: number): ReturnType<Outils["fusion"]> {
  const t = alea(graine);
  return o.fusion(
    ...Array.from({ length: n }, () => {
      const a = t() * Math.PI * 2;
      const b = 0.15 + t() * 1.1; // du haut vers l'équateur, côté caméra surtout
      const d = new Array(3);
      d[0] = Math.sin(b) * Math.cos(a);
      d[1] = Math.cos(b);
      d[2] = Math.abs(Math.sin(b) * Math.sin(a)) * 0.6 + 0.2;
      const k = Math.hypot(d[0], d[1], d[2]);
      const rr = 2 + t() * 2.2;
      return o.sphere(rr, { x: (d[0] / k) * (r - rr * 0.55), y: h + (d[1] / k) * (r - rr * 0.55), z: (d[2] / k) * (r - rr * 0.55) }, 7);
    }),
  );
}

export const ESPACE: ModelesDuTheme = {
  lumieres: { bumper: [NEON, NEON_VIF], trou: ["#3a4a6a", "#4FF0FF"] },
  trois: {
    bumper: (o) => {
      const s = socle(o);
      return {
        pivot: [0, 4, 0],
        pieces: [
          { geo: s.geo, m: { c: SOCLE, met: 0.6, rug: 0.35, env: 0.9 }, contour: 0.6 },
          { geo: s.neon, m: { c: NEON, rug: 0.3 }, role: "lumiere" },
          { geo: o.sphere(14.5, { y: 18.5 }, 20), m: { c: PLANETES[0], rug: 0.55, env: 0.6, teintes: PLANETES }, role: "haut", contour: 0.7 },
          { geo: crateres(o, 14.5, 18.5, 6, 3), m: { c: "#000000", op: 0.3, rug: 0.8 }, role: "haut", sansOmbre: true, variante: 0 },
          { geo: o.tore(17.6, 1.5, { y: 18.5, rx: Math.PI / 2 - 0.42, sz: 0.3 }, 30), m: { c: PAPIER, rug: 0.35, env: 0.8 }, role: "haut", contour: 0.4, variante: 1 },
        ],
      };
    },
    asteroide: (o) => {
      const s = socle(o);
      return {
        pivot: [0, 4, 0],
        pieces: [
          { geo: s.geo, m: { c: SOCLE, met: 0.6, rug: 0.35, env: 0.9 }, contour: 0.6 },
          { geo: s.neon, m: { c: NEON, rug: 0.3 }, role: "lumiere" },
          { geo: o.roche(14.8, 7, { y: 17.5, sy: 0.85 }, 0.2, 12), m: { c: "#9AA3B5", rug: 0.9 }, role: "haut", contour: 0.7 },
          { geo: crateres(o, 14.2, 17.5, 5, 11), m: { c: "#000000", op: 0.3, rug: 0.8 }, role: "haut", sansOmbre: true },
        ],
      };
    },
    cible: (o) => {
      // un satellite : son corps doré, deux panneaux solaires quadrillés, un bras, une petite antenne, sur un pied ; penché vers le joueur
      const p = { rx: -0.55, z: 2.5 };
      const panneau = (x: number): ReturnType<Outils["fusion"]> => o.boite(6.6, 8, 0.8, { x, y: 8 });
      const grille = (x: number): ReturnType<Outils["fusion"]>[] => [o.boite(0.5, 8.2, 1, { x, y: 8 }), o.boite(6.8, 0.5, 1, { x, y: 8 })];
      return {
        pieces: [
          { geo: o.placer(o.boite(6.4, 8, 6, { y: 8 }), p), m: { c: OR, met: 0.8, rug: 0.35, env: 1.2 }, contour: 0.5 },
          { geo: o.placer(o.fusion(panneau(-6.8), panneau(6.8)), p), m: { c: PANNEAU, rug: 0.25, met: 0.3, env: 1.4, em: "#0d1a44" }, contour: 0.45 },
          { geo: o.placer(o.fusion(...grille(-6.8), ...grille(6.8), o.cylindre(0.45, 0.45, 20, { y: 8, rz: Math.PI / 2 }, 6), o.cylindre(1.1, 1.1, 4, { y: 2 }, 8), o.cylindre(0.3, 0.3, 3, { y: 13.5 }, 5)), p), m: { c: ACIER, met: 1, rug: 0.3, env: 1.2 } },
          { geo: o.placer(o.cylindre(2.8, 0.3, 1.6, { y: 15.2 }, 12), p), m: { c: PAPIER, rug: 0.4 } },
        ],
      };
    },
    spinner: (o) => {
      // le radar : une parabole qui tourne sur son mât (autour de la verticale), tournée de biais (on voit son creux et son dos), ses rainures, la source au bout de son bras
      const penche = (g: ReturnType<Outils["fusion"]>): ReturnType<Outils["fusion"]> => o.placer(o.placer(g, { rx: 1.05 }), { ry: 0.85, y: 12.5 });
      const parabole = penche(o.calotte(26, 0.66, {}, 24));
      const bras = [o.cylindre(0.55, 0.55, 11, { y: 5.5 }, 6)];
      return {
        pivot: [0, 0, 0],
        axe: [0, 1, 0],
        pieces: [
          { geo: o.fusion(o.cylindre(6, 7.5, 2.5, { y: 1.25 }, 16), o.cylindre(1.6, 2, 12, { y: 7.5 }, 10)), m: { c: SOCLE, met: 0.6, rug: 0.35, env: 0.9 }, contour: 0.5 },
          { geo: parabole, m: { c: "#EEF1F4", rug: 0.55, env: 0.5, deux: true }, role: "tourne" },
          { geo: penche(o.fusion(o.tore(5.6, 0.45, { y: 0.75, rx: Math.PI / 2 }, 20), o.tore(11, 0.5, { y: 2.6, rx: Math.PI / 2 }, 28))), m: { c: "#9AA3B0", rug: 0.5 }, role: "tourne" },
          { geo: penche(o.fusion(...bras, o.sphere(2.1, { y: 11.4 }, 10), o.tore(16, 0.8, { y: 5.5, rx: Math.PI / 2 }, 32))), m: { c: "#E46FA0", rug: 0.35 }, role: "tourne", contour: 0.35 },
        ],
      };
    },
    trou: (o) => ({
      // l'anneau d'amarrage d'une sonde : un tore de métal, quatre pinces, huit feux qui s'allument quand il garde la bille
      pieces: [
        { geo: o.cylindre(13, 13, 0.6, { y: 0.3 }, 28), m: { c: "#05060f", rug: 1 } },
        { geo: o.tore(15.6, 2.6, { y: 2.2, rx: Math.PI / 2 }, 32), m: { c: ACIER, met: 1, rug: 0.25, env: 1.2 }, contour: 0.5 },
        { geo: o.fusion(...[0, 1, 2, 3].map((k) => o.boite(4, 3.6, 5, { x: Math.cos(Math.PI / 4 + (k * Math.PI) / 2) * 17.5, y: 1.8, z: Math.sin(Math.PI / 4 + (k * Math.PI) / 2) * 17.5, ry: -(Math.PI / 4 + (k * Math.PI) / 2) }))), m: { c: SOCLE, met: 0.5, rug: 0.4 }, contour: 0.5 },
        { geo: o.fusion(...Array.from({ length: 8 }, (_, k) => o.sphere(1.7, { x: Math.cos((k * Math.PI) / 4) * 15.6, y: 4.6, z: Math.sin((k * Math.PI) / 4) * 15.6 }, 8))), m: { c: "#2a3a55", rug: 0.3 }, role: "lumiere", sansOmbre: true },
      ],
    }),
  },
  plat: {
    socle(c, r, lum) {
      rond(c, 0, 0, r * 1.2, SOCLE, 2.5);
      rond(c, 0, 0, r * 1.1, null, 2.2, lum);
    },
    haut(c, r, k) {
      rond(c, 0, 0, r * 0.86, PLANETES[k % PLANETES.length]!, 2.5);
      if (k % 2 === 0) {
        c.globalAlpha = 0.3;
        for (const [x, y, rr] of [[-0.3, -0.25, 0.22], [0.32, 0.1, 0.16], [-0.05, 0.4, 0.13]] as const) rond(c, x * r, y * r, rr * r, "#000000", 0);
        c.globalAlpha = 1;
      } else {
        c.beginPath();
        c.ellipse(0, 0, r * 1.15, r * 0.36, -0.35, 0, Math.PI * 2);
        c.lineWidth = 2.6;
        c.strokeStyle = PAPIER;
        c.stroke();
      }
    },
    asteroide: {
      socle(c, r, lum) {
        rond(c, 0, 0, r * 1.2, SOCLE, 2.5);
        rond(c, 0, 0, r * 1.1, null, 2.2, lum);
      },
      haut(c, r) {
        const t = alea(7);
        poly(c, Array.from({ length: 11 }, (_, k) => [Math.cos((k / 11) * Math.PI * 2) * r * (0.8 + t() * 0.16), Math.sin((k / 11) * Math.PI * 2) * r * (0.8 + t() * 0.16)] as const), "#9AA3B5", 2.5);
        c.globalAlpha = 0.3;
        rond(c, -r * 0.25, -r * 0.2, r * 0.2, "#000000", 0);
        rond(c, r * 0.3, r * 0.25, r * 0.14, "#000000", 0);
        c.globalAlpha = 1;
      },
    },
    cible(c, l) {
      poly(c, [[-l * 0.5, -l * 0.15], [-l * 0.2, -l * 0.15], [-l * 0.2, l * 0.15], [-l * 0.5, l * 0.15]], PANNEAU, 1.2);
      poly(c, [[l * 0.2, -l * 0.15], [l * 0.5, -l * 0.15], [l * 0.5, l * 0.15], [l * 0.2, l * 0.15]], PANNEAU, 1.2);
      poly(c, [[-l * 0.16, -l * 0.16], [l * 0.16, -l * 0.16], [l * 0.16, l * 0.16], [-l * 0.16, l * 0.16]], OR, 1.4);
      rond(c, 0, 0, l * 0.07, PAPIER, 0.8);
    },
    spinnerFixe(c) {
      rond(c, 0, 0, 6, SOCLE, 1.5);
    },
    spinnerTourne(c, l) {
      c.beginPath();
      c.ellipse(0, -l * 0.15, l * 0.75, l * 0.42, 0, 0, Math.PI * 2);
      c.fillStyle = "#EEF1F4";
      c.fill();
      c.lineWidth = 2;
      c.strokeStyle = ENCRE;
      c.stroke();
      c.beginPath();
      c.ellipse(0, -l * 0.15, l * 0.5, l * 0.26, 0, 0, Math.PI * 2);
      c.strokeStyle = "#B8C0CA";
      c.lineWidth = 1;
      c.stroke();
      rond(c, 0, -l * 0.15, 2.2, "#E46FA0", 1.2);
    },
    trou(c, r, lum) {
      rond(c, 0, 0, r * 1.33, ACIER, 2);
      rond(c, 0, 0, r * 1.08, null, 1, "#8A93A0");
      for (let k = 0; k < 4; k++) {
        const a = Math.PI / 4 + (k * Math.PI) / 2;
        rond(c, Math.cos(a) * r * 1.38, Math.sin(a) * r * 1.38, 2.6, SOCLE, 1.2);
      }
      for (let k = 0; k < 8; k++) rond(c, Math.cos((k * Math.PI) / 4) * r * 1.2, Math.sin((k * Math.PI) / 4) * r * 1.2, 1.4, lum, 0);
      rond(c, 0, 0, r, "#05060f", 2);
    },
  },
};
