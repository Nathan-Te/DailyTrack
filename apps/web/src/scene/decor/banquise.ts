// Lot 44 — le décor de la Banquise (palette « neige », palier 1, chargé à la demande) : bosquets de sapins enneigés, cabanes de pêche sur la glace, blocs de
// glace, un panneau de sponsor ; sapins et congères sur la pente.
import { boiteChanfreinee, repereSol, sol, boite } from "../outils";
import { BOIS, moduleDecor, panneauPub, sapin, versRoute } from "./commun";

export const DECOR = moduleDecor({
  recette(c, x, p, rnd) {
    const y = p.y;
    const r = repereSol(p.x, y, p.z, versRoute(p));
    const k = rnd();
    if (k < 0.55) {
      for (let i = 0; i < 1 + Math.floor(rnd() * 3); i++) sapin(c.decor, p.x + (rnd() - 0.5) * 6, y, p.z + (rnd() - 0.5) * 6, 6 + rnd() * 5, 0x1f5a3c, 0xffffff);
    } else if (k < 0.75 && p.anneau === 2) {
      // Cabane de pêche sur la glace, un trou, une luge.
      boiteChanfreinee(c.decor, r, -1.2, 1.2, 0, 2.2, -1.5, 1.5, 0.12, 0xc2401f);
      c.decor.prism(r.o[0], y + 2.2, r.o[2], 2.1, 0.05, 1.0, 4, 0xf4f4f4, 0xf4f4f4, Math.PI / 4);
      sol(c.decor, r, 2, 3, -0.5, 0.5, 0.02, 0x1d3550);
      boite(c.decor, r, -2.5, -1.9, 0, 0.25, -1, 1, BOIS);
    } else if (k < 0.9) {
      c.decor.prism(p.x, y, p.z, 1.8 + rnd() * 2, 0.7, 1.4 + rnd() * 1.8, 6, 0xcfe4f4, 0xffffff, rnd() * 3);
    } else panneauPub(c, x, r, 2.4, 1.2, rnd);
  },
  remplissage(g, _x, p, rnd) {
    if (rnd() < 0.7) sapin(g, p.x, p.y, p.z, 6 + rnd() * 4, 0x1f5a3c, 0xffffff, 2);
    else g.prism(p.x, p.y, p.z, 2 + rnd() * 2, 0.8, 1 + rnd() * 1.4, 6, 0xe2eef8, 0xffffff, rnd() * 3);
  },
});
