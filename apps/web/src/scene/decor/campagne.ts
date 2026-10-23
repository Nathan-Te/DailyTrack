// Lot 44 — le décor de la Campagne (palier 1, chargé à la demande) : fermes (grange rouge, silo), arbres, bottes de foin, tracteurs ; haies, arbres et
// clôtures sur la pente.
import { mix, shade } from "../../meshKit";
import { boite, boiteChanfreinee, face, pt, repereSol, tube } from "../outils";
import { CAOUTCHOUC } from "../piste";
import { moduleDecor, versRoute } from "./commun";

/** Un arbre : un tronc, `n` boules de feuillage. */
function arbre(g: Parameters<typeof tube>[0], x: number, y: number, z: number, h: number, n: number, rnd: () => number) {
  tube(g, [x, y, z], [x, y + h * 0.6, z], 0.28, 5, 0x6a4528, 0.2);
  for (let i = 0; i < n; i++) {
    const v = mix(0x2f8f3a, 0x5cbb4a, rnd());
    g.prism(x + (rnd() - 0.5) * 2, y + h * 0.45 + i * 0.6, z + (rnd() - 0.5) * 2, (1.6 + rnd() * 0.5) * (h / 6), 0.6, 2.2 * (h / 6), 6, v, shade(v, 1.18), rnd());
  }
}

export const DECOR = moduleDecor({
  densite: [1.8, 1.8, 1.5, 0.6],
  recette(c, _x, p, rnd) {
    const y = p.y;
    const r = repereSol(p.x, y, p.z, versRoute(p));
    const k = rnd();
    if (p.anneau === 2 && k < 0.3) {
      // Ferme : la grange rouge, le silo.
      boite(c.decor, r, -4, 4, 0, 4.5, -3, 3, 0xb03a22);
      for (let g = -3.8; g < 4; g += 1.2) face(c.decor, r, g, g + 0.05, 0, 4.5, -3.01, shade(0xb03a22, 0.8));
      c.decor.quad(pt(r, -4.3, 4.5, -3.4), pt(r, 4.3, 4.5, -3.4), pt(r, 4.3, 7.2, 0), pt(r, -4.3, 7.2, 0), 0x4a4440);
      c.decor.quad(pt(r, 4.3, 4.5, 3.4), pt(r, -4.3, 4.5, 3.4), pt(r, -4.3, 7.2, 0), pt(r, 4.3, 7.2, 0), 0x4a4440);
      c.decor.tri(pt(r, -4, 4.5, -3), pt(r, -4, 4.5, 3), pt(r, -4, 7.2, 0), 0xb03a22);
      c.decor.tri(pt(r, 4, 4.5, 3), pt(r, 4, 4.5, -3), pt(r, 4, 7.2, 0), 0xb03a22);
      face(c.decor, r, -1.4, 1.4, 0, 3.2, -3.02, 0xf4f4f4);
      c.decor.prism(...pt(r, 6, 0, 0), 1.6, 1.6, 8, 8, 0xc9ced6, 0xc9ced6);
      c.decor.prism(...pt(r, 6, 8, 0), 1.6, 0.2, 1.2, 8, 0x8a9099);
    } else if (k < 0.55) arbre(c.decor, p.x, y, p.z, 6 + rnd() * 3, 3, rnd);
    else if (k < 0.8) {
      for (let i = 0; i < 3; i++) {
        const R = 0.8 + rnd() * 0.3;
        tube(c.decor, pt(r, (i - 1) * 2.2, R, -0.8), pt(r, (i - 1) * 2.2, R, 0.8), R, 8, 0xe2bd5c);
      }
    } else {
      // Tracteur : le capot, la cabine, les grandes roues.
      boiteChanfreinee(c.decor, r, -0.8, 0.8, 0.8, 1.9, 0, 2.4, 0.15, 0x21a35a);
      boite(c.decor, r, -0.9, 0.9, 0.8, 3.0, -1.2, 0, 0x21a35a);
      face(c.decor, r, -0.8, 0.8, 2.0, 2.8, 0.01, 0x22303f);
      for (const s of [-1, 1]) {
        tube(c.decor, pt(r, s * 0.9, 0.9, -0.6), pt(r, s * 1.4, 0.9, -0.6), 0.9, 8, CAOUTCHOUC);
        tube(c.decor, pt(r, s * 0.8, 0.5, 1.8), pt(r, s * 1.15, 0.5, 1.8), 0.5, 6, CAOUTCHOUC);
      }
    }
  },
  remplissage(g, _x, p, rnd) {
    const k = rnd();
    if (k < 0.45) arbre(g, p.x, p.y, p.z, 5.5 + rnd() * 3, 2, rnd);
    else if (k < 0.75) {
      const len = 7 + rnd() * 8;
      const v = mix(0x2f7a32, 0x3f9a3e, rnd());
      if (rnd() < 0.5) g.box(p.x - len / 2, p.y, p.z - 0.55, p.x + len / 2, p.y + 1.4, p.z + 0.55, v);
      else g.box(p.x - 0.55, p.y, p.z - len / 2, p.x + 0.55, p.y + 1.4, p.z + len / 2, v);
    } else g.prism(p.x, p.y, p.z, 0.9 + rnd() * 0.6, 0.8, 0.9, 8, 0xd8b45a, 0xe9cc7c);
  },
});
