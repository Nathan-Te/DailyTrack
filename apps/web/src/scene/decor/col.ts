// Lot 44 — le décor du Col alpin (palette « alpin », palier 1, chargé à la demande) : sapins enneigés, chalets, pylônes de télésiège et leur câble, gros
// blocs gris, un panneau de sponsor ; sapins et blocs sur la pente.
import { shade } from "../../meshKit";
import { boite, face, pt, repereSol, tube, type Repere } from "../outils";
import { CAOUTCHOUC, METAL, METAL_SOMBRE } from "../piste";
import { BOIS, BOIS_CLAIR, moduleDecor, panneauPub, rocher, sapin, versRoute } from "./commun";
import type { Builder } from "../../meshKit";

/** Un chalet : soubassement de pierre, murs de bois, toit à deux pans enneigé, balcon, cheminée. */
function chalet(g: Builder, r: Repere, w: number) {
  boite(g, r, -w, w, 0, 0.8, -w * 0.8, w * 0.8, 0x8a8f99);
  boite(g, r, -w, w, 0.8, 3.4, -w * 0.8, w * 0.8, BOIS);
  const d = w * 0.8 + 0.6;
  g.quad(pt(r, -w - 0.6, 3.4, -d), pt(r, w + 0.6, 3.4, -d), pt(r, w + 0.6, 5.2, 0), pt(r, -w - 0.6, 5.2, 0), 0xf2f6fa);
  g.quad(pt(r, w + 0.6, 3.4, d), pt(r, -w - 0.6, 3.4, d), pt(r, -w - 0.6, 5.2, 0), pt(r, w + 0.6, 5.2, 0), 0xf2f6fa);
  g.tri(pt(r, -w, 3.4, -w * 0.8), pt(r, -w, 3.4, w * 0.8), pt(r, -w, 5.0, 0), BOIS_CLAIR);
  g.tri(pt(r, w, 3.4, w * 0.8), pt(r, w, 3.4, -w * 0.8), pt(r, w, 5.0, 0), BOIS_CLAIR);
  boite(g, r, -w + 0.3, w - 0.3, 2.0, 2.1, -w * 0.8 - 1.0, -w * 0.8, BOIS_CLAIR);
  for (const gg of [-w * 0.5, w * 0.5]) face(g, r, gg - 0.45, gg + 0.45, 2.2, 3.0, -w * 0.8 - 0.02, 0x2a3442);
  boite(g, r, w * 0.4, w * 0.4 + 0.5, 4.2, 5.8, -0.2, 0.3, 0x8a8f99);
  void shade;
}

export const DECOR = moduleDecor({
  densite: [1.8, 2, 1.5, 0.6],
  recette(c, x, p, rnd) {
    const y = p.y;
    const r = repereSol(p.x, y, p.z, versRoute(p));
    const k = rnd();
    if (k < 0.45) {
      for (let i = 0; i < 1 + Math.floor(rnd() * 3); i++) sapin(c.decor, p.x + (rnd() - 0.5) * 7, y, p.z + (rnd() - 0.5) * 7, 7 + rnd() * 5, 0x1f5a3c, 0xffffff);
    } else if (k < 0.7 && p.anneau === 2) chalet(c.decor, r, 3 + rnd());
    else if (k < 0.85 && p.anneau === 2) {
      // Pylône de télésiège et un bout de câble.
      tube(c.decor, [p.x, y, p.z], [p.x, y + 12, p.z], 0.35, 5, METAL);
      boite(c.decor, r, -3, 3, 11.6, 12.1, -0.3, 0.3, METAL_SOMBRE);
      for (const s of [-2.8, 2.8]) tube(c.decor, pt(r, s, 11.6, -6), pt(r, s, 11.6, 6), 0.05, 3, CAOUTCHOUC);
    } else if (k < 0.93) rocher(c.decor, p.x, y, p.z, 1.5 + rnd() * 2, 0x7d8896, rnd);
    else panneauPub(c, x, r, 2.2, 1.1, rnd);
  },
  remplissage(g, _x, p, rnd) {
    if (rnd() < 0.7) sapin(g, p.x, p.y, p.z, 7 + rnd() * 5, 0x1f5a3c, 0xffffff, 2);
    else rocher(g, p.x, p.y, p.z, 1.2 + rnd() * 2, 0x7d8896, rnd);
  },
});
