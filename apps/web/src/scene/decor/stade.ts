// Lot 44 — le décor du Stade (palier 1, chargé à la demande) : tentes d'accueil rayées, panneaux de sponsors et piles de pneus, tours de caméra, postes de
// commissaire ; haies taillées et mâts à drapeaux sur la pente. La foule est dans la tribune du départ seulement (décision de Nathan, 23/10/2026).
import { mix } from "../../meshKit";
import { boite, boiteChanfreinee, pt, repereSol, tube } from "../outils";
import { MARQUE } from "../pieces";
import { METAL, METAL_SOMBRE } from "../piste";
import { ROUGE_PISTE } from "../palier1";
import { drapeau, moduleDecor, panneauPub, pneus, versRoute } from "./commun";

export const DECOR = moduleDecor({
  recette(c, x, p, rnd) {
    const r = repereSol(p.x, p.y, p.z, versRoute(p));
    const k = rnd();
    if (p.anneau === 2 && k < 0.35) {
      // Tente d'accueil rayée et son fanion.
      boite(c.decor, r, -3, 3, 0, 2.4, -2.5, 2.5, 0xf4f4f4);
      c.decor.prism(r.o[0], p.y + 2.4, r.o[2], 4.4, 0.05, 2.2, 4, ROUGE_PISTE, 0xf4f4f4, Math.PI / 4);
      drapeau(c.decor, ...pt(r, 3.5, 0, -2.5), 5, 0x2e7dff, versRoute(p));
    } else if (k < 0.6) {
      panneauPub(c, x, r, 3, 1.4, rnd);
      pneus(c.decor, ...pt(r, -4, 0, 0.8), 3, 0xf4f4f4);
    } else if (k < 0.85) {
      // Tour de caméra : un échafaudage, une plateforme, la caméra tournée vers la piste.
      for (const [g, a] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) tube(c.decor, pt(r, g, 0, a), pt(r, g * 0.8, 5, a * 0.8), 0.08, 4, METAL);
      boite(c.decor, r, -1.3, 1.3, 5, 5.25, -1.3, 1.3, METAL_SOMBRE);
      boite(c.decor, r, -0.35, 0.35, 5.25, 5.95, 0.2, 1.1, 0x22262e);
    } else {
      // Poste de commissaire : une cabine, un drapeau jaune.
      boiteChanfreinee(c.decor, r, -1, 1, 0, 2.4, -1, 1, 0.15, 0xf4f4f4, MARQUE.encre);
      drapeau(c.decor, ...pt(r, 1.2, 0, -1), 3.2, 0xffd23f, versRoute(p));
    }
  },
  remplissage(g, _x, p, rnd) {
    if (rnd() < 0.6) {
      const len = 3 + rnd() * 4;
      const v = mix(0x2f8a3a, 0x3fa646, rnd());
      g.box(p.x - len / 2, p.y, p.z - 0.6, p.x + len / 2, p.y + 1.3, p.z + 0.6, v);
    } else drapeau(g, p.x, p.y, p.z, 6 + rnd() * 3, [ROUGE_PISTE, 0x2e7dff, 0xffd22e, 0x21b35a][Math.floor(rnd() * 4)]!, rnd() * 6);
  },
});
