// Lot 44 — le décor du Rallye (palette « desert », palier 1, chargé à la demande) : assistance (camionnette, piles de pneus, auvent), cactus, rochers,
// spectateurs sur un rocher sous un parasol ; rochers et buissons secs sur la pente.
import { mix } from "../../meshKit";
import { boite, pt, repereSol, tube } from "../outils";
import { METAL } from "../piste";
import { ROUGE_PISTE } from "../palier1";
import { cactus, camionnette, foule, moduleDecor, pneus, rocher, versRoute } from "./commun";

export const DECOR = moduleDecor({
  densite: [1.2, 1.4, 1, 0.3],
  recette(c, _x, p, rnd) {
    const y = p.y;
    const r = repereSol(p.x, y, p.z, versRoute(p));
    const k = rnd();
    if (p.anneau === 2 && k < 0.3) {
      camionnette(c.decor, r, [0x2e7dff, 0xf4f4f4, 0x21a35a][Math.floor(rnd() * 3)]!);
      for (let i = 0; i < 3; i++) pneus(c.decor, ...pt(r, 2.2 + i * 0.95, 0, -1), 2 + (i % 2));
      boite(c.decor, r, -4.5, -2, 2.6, 2.7, -2, 2, 0xf2e2c4);
      for (const a of [-1.9, 1.9]) boite(c.decor, r, -4.45, -4.35, 0, 2.6, a - 0.05, a + 0.05, METAL);
    } else if (k < 0.55) {
      cactus(c.decor, p.x, y, p.z, 3.5 + rnd() * 3, rnd);
      if (rnd() < 0.5) cactus(c.decor, p.x + 2.5, y, p.z + 1.4, 2 + rnd() * 2, rnd);
    } else if (k < 0.8) {
      rocher(c.decor, p.x, y, p.z, 1.2 + rnd() * 1.6, mix(0xa86a44, 0xd09a6a, rnd()), rnd);
    } else {
      // Spectateurs sur un rocher, un parasol.
      rocher(c.decor, p.x, y, p.z, 2.2, 0xb8754a, rnd);
      foule(c.decor, repereSol(p.x, y + 1.4, p.z, versRoute(p)), 4, 2.4, rnd, false);
      tube(c.decor, [p.x + 1.2, y + 1.4, p.z], [p.x + 1.2, y + 3.6, p.z], 0.04, 4, METAL);
      c.decor.prism(p.x + 1.2, y + 3.3, p.z, 1.3, 0.05, 0.5, 8, ROUGE_PISTE, 0xf4f4f4);
    }
  },
  remplissage(g, _x, p, rnd) {
    if (rnd() < 0.55) rocher(g, p.x, p.y, p.z, 1.4 + rnd() * 2.2, mix(0xa86a44, 0xd09a6a, rnd()), rnd);
    else g.prism(p.x, p.y, p.z, 0.8 + rnd() * 0.5, 0.1, 0.7, 6, mix(0x9a8a45, 0xb8a050, rnd()));
  },
});
