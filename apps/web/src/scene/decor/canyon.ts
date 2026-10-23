// Lot 44 — le décor du Canyon (palier 1, chargé à la demande) : mesas à strates, citernes de bois, cactus et rochers, un panneau de sponsor ; mesas et
// aiguilles de roche sur la pente (ce qui ferme l'horizon proche).
import { mix, shade } from "../../meshKit";
import { boite, boiteChanfreinee, repereSol, tube } from "../outils";
import { METAL_SOMBRE } from "../piste";
import { BOIS, BOIS_CLAIR, cactus, moduleDecor, panneauPub, rocher, versRoute } from "./commun";

export const DECOR = moduleDecor({
  densite: [1.6, 1.8, 1.5, 0.5],
  recette(c, x, p, rnd) {
    const y = p.y;
    const r = repereSol(p.x, y, p.z, versRoute(p));
    const k = rnd();
    if (k < 0.3) {
      // Falaise à strates, le long de la route : ce qu'on voit défiler (lot 23, reprise ici sur le sol relevé).
      const w = 8 + rnd() * 8;
      const d = 3 + rnd() * 2;
      const h = 6 + rnd() * 8;
      const roche = mix(0x9a3f26, 0xc4673a, rnd());
      for (let i = 0; i < 4; i++) {
        const e = i * 0.35;
        boite(c.decor, r, -w / 2 + e, w / 2 - e, (h * i) / 4, (h * (i + 1)) / 4, -d / 2 + e * 0.5, d / 2 - e * 0.5, i % 2 === 0 ? roche : shade(roche, 1.15));
      }
    } else if (p.anneau === 2 && k < 0.55) {
      // Mesa à strates, découpée.
      const w = 5 + rnd() * 5;
      const h = 12 + rnd() * 14;
      for (let i = 0; i < 5; i++) {
        const s = w * (1 - i * 0.12) + (rnd() - 0.5);
        const c1 = i % 2 === 0 ? 0xa8452a : 0xc9683c;
        boiteChanfreinee(c.decor, repereSol(p.x + (rnd() - 0.5), y + (h * i) / 5, p.z + (rnd() - 0.5), versRoute(p)), -s, s, 0, h / 5, -s * 0.8, s * 0.8, 0.4, c1, shade(c1, 1.1));
      }
    } else if (k < 0.65) {
      // Citerne de bois sur pilotis.
      for (const [dx, dz] of [[-1.4, -1.4], [1.4, -1.4], [1.4, 1.4], [-1.4, 1.4]] as const) tube(c.decor, [p.x + dx, y, p.z + dz], [p.x + dx * 0.6, y + 7, p.z + dz * 0.6], 0.12, 4, BOIS);
      c.decor.prism(p.x, y + 7, p.z, 1.9, 1.9, 2.6, 8, BOIS_CLAIR, BOIS_CLAIR);
      c.decor.prism(p.x, y + 9.6, p.z, 2.0, 0.1, 0.9, 8, METAL_SOMBRE);
    } else if (k < 0.88) {
      cactus(c.decor, p.x, y, p.z, 3 + rnd() * 3, rnd);
      rocher(c.decor, p.x + 2, y, p.z + 1, 1 + rnd(), 0xb86a46, rnd);
    } else panneauPub(c, x, r, 2.6, 1.3, rnd, 1.4);
  },
  remplissage(g, _x, p, rnd) {
    if (rnd() < 0.6) {
      const r = 2.2 + rnd() * 2.6;
      const h = 7 + rnd() * 11;
      const roche = mix(0xa8452a, 0xc9683c, rnd());
      g.prism(p.x, p.y, p.z, r, r * 0.8, h * 0.55, 6, roche, shade(roche, 0.86), rnd() * 3);
      g.prism(p.x, p.y + h * 0.55, p.z, r * 0.8, r * 0.62, h * 0.45, 6, shade(roche, 1.12), mix(0xe3a86d, roche, 0.3), rnd() * 3);
    } else rocher(g, p.x, p.y, p.z, 1 + rnd() * 1.6, mix(0xb86a46, 0xdc9a68, rnd()), rnd);
  },
});
