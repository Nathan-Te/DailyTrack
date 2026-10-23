// Lot 44 — le décor de la Nuit (palier 1, chargé à la demande ; la palette « neon » le reprend) : lampadaires de bord de route, un motel aux fenêtres allumées
// et son enseigne, cônes et camionnette, sapins sombres ; sapins et rochers sombres sur la pente.
import { boite, face, pt, repereSol } from "../outils";
import { rectSponsor, sponsorsDuTheme } from "../sponsors";
import { camionnette, lampadaire, moduleDecor, rocher, sapin, versRoute } from "./commun";

export const DECOR = moduleDecor({
  recette(c, x, p, rnd) {
    const y = p.y;
    const r = repereSol(p.x, y, p.z, versRoute(p));
    const k = rnd();
    if (p.anneau === 1 && k < 0.5) lampadaire(c, r, 6.5, 0xffb347);
    else if (k < 0.7 && p.anneau === 2) {
      // Un motel au bord de la route : un volume bas, des fenêtres allumées, son enseigne.
      boite(c.decor, r, -6, 6, 0, 3.2, -2.5, 2.5, 0x2a2f45);
      for (let g = -5; g < 5; g += 2) face(c.decorLumineux, r, g, g + 1.2, 1.0, 2.2, -2.52, rnd() < 0.6 ? 0xffd98a : 0x1d2030);
      boite(c.decor, r, -0.1, 0.1, 3.2, 5.6, -1.05, -0.95, 0x1d2030);
      const logos = sponsorsDuTheme(x.palette);
      c.affiches.face(r, -2, 2, 3.6, 5.4, -1.1, rectSponsor(logos[Math.floor(rnd() * logos.length)]!));
      c.decorLumineux.halo(...pt(r, 0, 4.4, -1.4), 0xff2bd6, 9);
    } else if (k < 0.85) {
      for (let i = 0; i < 4; i++) {
        const [cx, cy, cz] = pt(r, (i - 1.5) * 1.6, 0, 0);
        c.decor.box(cx - 0.3, cy, cz - 0.3, cx + 0.3, cy + 0.05, cz + 0.3, 0x1d1d20);
        c.decor.prism(cx, cy + 0.05, cz, 0.22, 0.04, 0.7, 5, 0xf2b544, 0xffffff);
      }
      camionnette(c.decor, repereSol(p.x + 3, y, p.z, versRoute(p) + 1.4), 0x2a2f45);
    } else sapin(c.decor, p.x, y, p.z, 6 + rnd() * 3, 0x16303a, null);
  },
  remplissage(g, _x, p, rnd) {
    if (rnd() < 0.65) sapin(g, p.x, p.y, p.z, 5 + rnd() * 4, 0x16303a, null, 2);
    else rocher(g, p.x, p.y, p.z, 1.4 + rnd() * 1.6, 0x242a3c, rnd);
  },
});
