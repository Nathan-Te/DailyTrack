import { MOUTARDE, PAPIER, ENCRE, poly, rond, type ModelesDuTheme, type Outils } from "./types";

// Lot PBV4 — la Fête foraine : des pommes d'amour (bumpers), un chamboule-tout (cibles), une grande roue (spinner), un stand de tir (trou). Repères : l'origine est le centre du module au sol, y monte, +z regarde
// le joueur ; tailles de référence de `REFERENCE` (bumper de 17 px, cible de 20 px de long, spinner de 22 px, trou de 13 px). À plat : vue de dessus, +y vers les batteurs.

const ROUGE = "#D0201A";
const BLEU = "#3E7CC4";
const BOIS = "#E9CFA0";
const ACIER = "#D3D7DC";
const PENCHE = -0.55; // la grande roue se penche en arrière, vers la caméra

/** La grande roue, à plat dans le plan x-y, centrée (on la penche ensuite). */
function roue(o: Outils): { cadre: ReturnType<Outils["fusion"]>; nacellesA: ReturnType<Outils["fusion"]>; nacellesB: ReturnType<Outils["fusion"]> } {
  const rayons = [0, 1, 2, 3].map((k) => o.boite(0.9, 31, 0.9, { rz: (k * Math.PI) / 4 }));
  const cadre = o.fusion(o.tore(15.5, 1.2, {}, 32), o.tore(10, 0.7, {}, 24), o.cylindre(2.6, 2.6, 3.4, { rx: Math.PI / 2 }, 12), ...rayons);
  const nacelle = (k: number): ReturnType<Outils["boite"]> => o.boite(4.4, 3.8, 3.6, { x: Math.cos((k * Math.PI) / 4) * 15.5, y: Math.sin((k * Math.PI) / 4) * 15.5 });
  return { cadre, nacellesA: o.fusion(...[0, 2, 4, 6].map(nacelle)), nacellesB: o.fusion(...[1, 3, 5, 7].map(nacelle)) };
}

export const FOIRE: ModelesDuTheme = {
  lumieres: { bumper: [BLEU, MOUTARDE], trou: [ROUGE, MOUTARDE] },
  trois: {
    bumper: (o) => ({
      pivot: [0, 4, 0],
      pieces: [
        { geo: o.cylindre(20.5, 21, 4, { y: 2 }, 28), m: { c: BLEU, rug: 0.35 }, role: "lumiere", contour: 0.7 },
        { geo: o.tore(20.6, 0.8, { y: 4, rx: Math.PI / 2 }, 28), m: { c: PAPIER, rug: 0.4 } },
        // la pomme glacée : rouge, très brillante, son caramel coulé au pied, son bâton
        { geo: o.sphere(15.5, { y: 17, sy: 0.9 }, 22), m: { c: ROUGE, rug: 0.1, env: 1.2 }, role: "haut", contour: 0.8 },
        { geo: o.tore(12.2, 3, { y: 5.6, rx: Math.PI / 2 }, 22), m: { c: "#8E1410", rug: 0.08, env: 1.2 }, role: "haut" },
        { geo: o.cylindre(1.5, 1.5, 11, { y: 34 }, 8), m: { c: BOIS, rug: 0.7 }, role: "haut", contour: 0.5 },
      ],
    }),
    cible: (o) => {
      // trois boîtes de conserve en pyramide : deux en bas, une dessus ; l'étiquette colorée, une bande blanche, les bords en fer-blanc
      const places = [[-4.9, 4], [4.9, 4], [0, 12.1]] as const;
      const corps = o.fusion(...places.map(([x, y]) => o.cylindre(4.5, 4.5, 7.6, { x, y }, 16)));
      const bande = o.fusion(...places.map(([x, y]) => o.cylindre(4.58, 4.58, 2, { x, y }, 16)));
      const fer = o.fusion(...places.flatMap(([x, y]) => [o.tore(4.25, 0.6, { x, y: y + 3.8, rx: Math.PI / 2 }, 12), o.tore(4.25, 0.6, { x, y: y - 3.8, rx: Math.PI / 2 }, 12), o.cylindre(4, 4, 0.4, { x, y: y + 3.9 }, 12)]));
      const penche = { rx: -0.35, z: 1.2 }; // penchées vers le joueur : on voit les étiquettes
      return {
        pieces: [
          { geo: o.placer(corps, penche), m: { c: ROUGE, rug: 0.35, teintes: [ROUGE, BLEU, MOUTARDE] }, contour: 0.6 },
          { geo: o.placer(bande, penche), m: { c: PAPIER, rug: 0.4 } },
          { geo: o.placer(fer, penche), m: { c: ACIER, met: 1, rug: 0.3, env: 1.2 } },
        ],
      };
    },
    spinner: (o) => {
      const r = roue(o);
      const pose = { y: 19, rx: PENCHE };
      return {
        pivot: [0, 19, 0],
        axe: [0, -Math.sin(PENCHE), Math.cos(PENCHE)],
        pieces: [
          // le pied : un socle de bois et deux jambes en A derrière la roue
          { geo: o.fusion(o.boite(30, 2, 8, { y: 1, z: -3 }), o.tube([[-12, 0, -4], [0, 19, -1.5]], 1.4, 1.2), o.tube([[12, 0, -4], [0, 19, -1.5]], 1.4, 1.2)), m: { c: PAPIER, rug: 0.5 }, contour: 0.5 },
          { geo: o.placer(r.cadre, pose), m: { c: ROUGE, rug: 0.3, env: 0.8 }, role: "tourne", contour: 0.5 },
          { geo: o.placer(r.nacellesA, pose), m: { c: BLEU, rug: 0.35 }, role: "tourne", contour: 0.5 },
          { geo: o.placer(r.nacellesB, pose), m: { c: MOUTARDE, rug: 0.35 }, role: "tourne", contour: 0.5 },
        ],
      };
    },
    trou: (o) => ({
      // une cible rouge et blanche autour du trou ; les anneaux rouges s'allument quand il garde la bille
      pieces: [
        { geo: o.cylindre(13, 13, 0.6, { y: 0.3 }, 28), m: { c: "#0c0806", rug: 1 } },
        { geo: o.fusion(o.anneau(13, 16, { y: 1.1 }), o.anneau(19, 22, { y: 1.1 })), m: { c: ROUGE, rug: 0.4 }, role: "lumiere", sansOmbre: true },
        { geo: o.anneau(16, 19, { y: 1.1 }), m: { c: PAPIER, rug: 0.4 }, sansOmbre: true },
        { geo: o.fusion(o.tore(13.2, 1.1, { y: 1.2, rx: Math.PI / 2 }, 28), o.tore(22, 0.7, { y: 1.1, rx: Math.PI / 2 }, 32)), m: { c: ENCRE, rug: 0.6 } },
      ],
    }),
  },
  plat: {
    socle(c, r, lum) {
      rond(c, 0, 0, r * 1.21, lum, 2.5);
      rond(c, 0, 0, r * 1.12, null, 1.2, PAPIER);
    },
    haut(c, r) {
      rond(c, 0, 1, r * 0.72, "#8E1410", 0); // le caramel coulé
      rond(c, 0, 0, r * 0.9, ROUGE, 2.5);
      c.globalAlpha = 0.75;
      rond(c, -r * 0.32, -r * 0.34, r * 0.2, PAPIER, 0);
      c.globalAlpha = 1;
      // le bâton, vu d'en haut et un peu de face
      poly(c, [[-1.6, -1], [1.6, -1], [1.6, -r * 0.75], [-1.6, -r * 0.75]], BOIS, 1.4);
    },
    cible(c, l, k) {
      const t = [ROUGE, BLEU, MOUTARDE][k % 3]!;
      for (const [x, y] of [[-0.24, 0.1], [0.24, 0.1], [0, -0.2]] as const) {
        rond(c, x * l, y * l, l * 0.23, t, 1.6);
        rond(c, x * l, y * l, l * 0.15, ACIER, 1);
      }
    },
    spinnerFixe(c, l) {
      poly(c, [[-l * 0.7, 6], [l * 0.7, 6], [l * 0.7, 10], [-l * 0.7, 10]], PAPIER, 1.5);
    },
    spinnerTourne(c, l) {
      const R = l * 0.7;
      c.strokeStyle = ROUGE;
      c.lineWidth = 1.6;
      for (let k = 0; k < 4; k++) {
        c.beginPath();
        c.moveTo(Math.cos((k * Math.PI) / 4) * R, Math.sin((k * Math.PI) / 4) * R);
        c.lineTo(-Math.cos((k * Math.PI) / 4) * R, -Math.sin((k * Math.PI) / 4) * R);
        c.stroke();
      }
      rond(c, 0, 0, R, null, 4.5);
      rond(c, 0, 0, R, null, 2.5, ROUGE);
      for (let k = 0; k < 8; k++) rond(c, Math.cos((k * Math.PI) / 4) * R, Math.sin((k * Math.PI) / 4) * R, 2.6, k % 2 ? MOUTARDE : BLEU, 1.2);
      rond(c, 0, 0, 3, ROUGE, 1.5);
    },
    trou(c, r, lum) {
      rond(c, 0, 0, r * 1.68, lum, 2);
      rond(c, 0, 0, r * 1.45, PAPIER, 0);
      rond(c, 0, 0, r * 1.22, lum, 0);
      rond(c, 0, 0, r, "#120C08", 2.5);
    },
  },
};
