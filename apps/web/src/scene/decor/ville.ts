// Lot 44 — le décor de la Ville (palier 1, chargé à la demande). **La Ville reste dégagée** (lot 37) : rebords bas et garde-corps (la route, `route.ts`), on
// voit la rue à travers ; le front de rue est à 2–12 m du rebord, les immeubles montent du sol lointain (ils traversent le talus) ; les lampadaires de rue sont
// sur le chapeau des rebords, leur potence au-dessus du passage. Près de la piste : immeubles à vitrines et stores, lampadaires et abribus, feux tricolores ;
// immeubles simples sur la pente.
import { CELL, WALL_HEIGHT, blockHalfWidth, blockHeight, curveSize, isCurve, type Block } from "@cdj/sim";
import { mix, seeded, shade, type Box, type Builder, type V3 } from "../../meshKit";
import { CHAPEAU, placed } from "../../decorPose";
import { hasCap, onRim } from "../../trackMesh";
import { boite, face, pt, repereSol, tube, type Repere } from "../outils";
import { MARQUE } from "../pieces";
import { CAOUTCHOUC, METAL_SOMBRE } from "../piste";
import { ROUGE_PISTE } from "../palier1";
import { onBlock } from "../route";
import { rectSponsor, sponsorsDuTheme } from "../sponsors";
import { BOIS_CLAIR, lampadaire, moduleDecor, planLibre, versRoute } from "./commun";
import type { CalquesDecor } from "../types";

/** Teinte d'un immeuble (lot 37) : le béton gris domine, le beige et le bleu-gris le varient. `r` ∈ [0, 1[. */
function mur(r: number): number {
  if (r < 0.2) return mix(0xcdbfa8, 0xe0d3bd, r / 0.2);
  if (r < 0.4) return mix(0x9fb0c2, 0xc2cfdc, (r - 0.2) / 0.2);
  return mix(0xa9adb5, 0xcfd2d8, (r - 0.4) / 0.6);
}

/**
 * Un immeuble du fond : une boîte de béton du sol lointain jusqu'à `h`, un acrotère, des bandes de fenêtres sombres (des surfaces à plat, deux triangles
 * chacune) ; sous `fenetresDe` (le niveau de la route), pas de fenêtres : on ne les voit pas.
 */
function immeuble(g: Builder, x: number, y: number, z: number, w: number, d: number, h: number, teinte: number, fenetresDe: number) {
  g.box(x - w / 2, y, z - d / 2, x + w / 2, y + h, z + d / 2, teinte);
  g.box(x - w / 2 - 0.15, y + h, z - d / 2 - 0.15, x + w / 2 + 0.15, y + h + 0.4, z + d / 2 + 0.15, shade(teinte, 0.78));
  const verre = shade(0x35506b, 0.95 + ((Math.round(x * 3 + z) % 3) - 1) * 0.08);
  const e = 0.04;
  for (let f = Math.max(3, fenetresDe); f < h - 1.5; f += 3.2) {
    const y0 = y + f;
    const y1 = y + f + 1.4;
    g.quad([x - w / 2 + 0.6, y0, z + d / 2 + e], [x + w / 2 - 0.6, y0, z + d / 2 + e], [x + w / 2 - 0.6, y1, z + d / 2 + e], [x - w / 2 + 0.6, y1, z + d / 2 + e], verre);
    g.quad([x + w / 2 - 0.6, y0, z - d / 2 - e], [x - w / 2 + 0.6, y0, z - d / 2 - e], [x - w / 2 + 0.6, y1, z - d / 2 - e], [x + w / 2 - 0.6, y1, z - d / 2 - e], verre);
    g.quad([x + w / 2 + e, y0, z - d / 2 + 0.6], [x + w / 2 + e, y0, z + d / 2 - 0.6], [x + w / 2 + e, y1, z + d / 2 - 0.6], [x + w / 2 + e, y1, z - d / 2 + 0.6], verre);
    g.quad([x - w / 2 - e, y0, z + d / 2 - 0.6], [x - w / 2 - e, y0, z - d / 2 + 0.6], [x - w / 2 - e, y1, z - d / 2 + 0.6], [x - w / 2 - e, y1, z + d / 2 - 0.6], verre);
  }
}

/** Un immeuble de bord de rue (B) : rez-de-chaussée vitré et store rayé, fenêtres encadrées, un balcon sur deux ; il monte du sol lointain (`sous` m sous sa place). */
function immeubleRue(c: CalquesDecor, r: Repere, w: number, d: number, h: number, teinte: number, sous: number, rnd: () => number) {
  const g = c.decor;
  boite(g, r, -w, w, -sous, h, -d, d, teinte, shade(teinte, 0.92));
  boite(g, r, -w - 0.25, w + 0.25, h, h + 0.7, -d - 0.25, d + 0.25, shade(teinte, 0.8));
  face(g, r, -w + 0.4, w - 0.4, 0.3, 3.0, -d - 0.02, 0x22303f);
  const store = [ROUGE_PISTE, 0x21a35a, 0x1f5fbf, MARQUE.moutarde][Math.floor(rnd() * 4)]!;
  for (let k = 0, gg = -w + 0.2; gg < w - 0.2; k++, gg += 1.6) g.quad(pt(r, gg, 3.4, -d), pt(r, Math.min(w - 0.2, gg + 1.6), 3.4, -d), pt(r, Math.min(w - 0.2, gg + 1.6), 2.8, -d - 1.2), pt(r, gg, 2.8, -d - 1.2), k % 2 === 0 ? store : 0xffffff);
  for (let y = 4.2, i = 0; y < h - 1.5; y += 3.2, i++) {
    for (let gg = -w + 1; gg < w - 0.8; gg += 2.2) face(g, r, gg, gg + 1.3, y, y + 1.7, -d - 0.02, 0x2f4a66);
    if (i % 2 === 1) boite(g, r, -w + 0.6, w - 0.6, y - 0.3, y - 0.15, -d - 0.9, -d, shade(teinte, 0.85));
  }
}

/** Une poutre horizontale de `a` à `b` (même hauteur), épaisse de `y1 − y0`, profonde de `2 × p` le long de `n`. */
function poutre(g: Builder, a: V3, b: V3, n: [number, number], p: number, y0: number, y1: number, couleur: number) {
  const q = (e: V3, f: number, y: number): V3 => [e[0] + n[0] * f * p, y, e[2] + n[1] * f * p];
  g.quad(q(a, 1, y0), q(b, 1, y0), q(b, 1, y1), q(a, 1, y1), couleur);
  g.quad(q(b, -1, y0), q(a, -1, y0), q(a, -1, y1), q(b, -1, y1), couleur);
  g.quad(q(a, 1, y1), q(b, 1, y1), q(b, -1, y1), q(a, -1, y1), shade(couleur, 1.15));
  g.quad(q(a, -1, y0), q(b, -1, y0), q(b, 1, y0), q(a, 1, y0), shade(couleur, 0.7));
}

/** Lampadaire de rue (lot 37) sur le chapeau du rebord, un bloc sur deux, un côté puis l'autre ; la potence passe au-dessus de la route à 5,9 m. */
function lampadairesDeRue(c: CalquesDecor, b: Block, cap: number, log: Parameters<typeof placed>[0]) {
  if (!hasCap(b) || b.index % 2 === 0) return;
  const side = b.index % 4 === 1 ? 1 : -1;
  const p = onRim(b, 0.5, side, CHAPEAU / 2, cap);
  const m = onBlock(b, 0, 0.5, 0);
  const len = Math.hypot(m[0] - p[0], m[2] - p[2]) || 1;
  const vers: [number, number] = [(m[0] - p[0]) / len, (m[2] - p[2]) / len];
  const meta = { kind: "lampadaire", block: b.index, style: "", group: log?.group() ?? 0 } as const;
  const top = p[1] + 5.2;
  const bout: V3 = [p[0] + vers[0] * 1.8, top, p[2] + vers[1] * 1.8];
  placed(log, { ...meta, part: "pied", appui: "rebord" }, [c.decor], () => c.decor.box(p[0] - 0.1, p[1], p[2] - 0.1, p[0] + 0.1, top, p[2] + 0.1, 0x3a3f4d));
  placed(log, { ...meta, part: "surplomb", appui: "rebord" }, [c.decor, c.decorLumineux], () => {
    poutre(c.decor, [p[0], 0, p[2]], [bout[0], 0, bout[2]], [-vers[1], vers[0]], 0.05, top - 0.1, top + 0.04, 0x3a3f4d);
    c.decorLumineux.box(bout[0] - 0.25, top - 0.2, bout[2] - 0.25, bout[0] + 0.25, top - 0.1, bout[2] + 0.25, 0xf6efd0);
    c.decorLumineux.halo(bout[0], top - 0.15, bout[2], 0xfff0c8, 4.5);
  });
}

export const DECOR = moduleDecor({
  proche: 0.85,
  recette(c, x, p, rnd) {
    const y = p.y;
    const r = repereSol(p.x, y, p.z, versRoute(p));
    if (p.anneau === 2 || rnd() < 0.35) immeubleRue(c, r, 4 + rnd() * 3, 4 + rnd() * 2.5, 12 + rnd() * 22, mix(0xb9bdc4, 0xe0d6c8, rnd()), y - x.floorY, rnd);
    else if (rnd() < 0.5) {
      lampadaire(c, r, 6, 0xfff0c8);
      // Abribus : un toit, deux montants, une affiche.
      const ab = repereSol(p.x + 3, y, p.z, versRoute(p));
      boite(c.decor, ab, -2, 2, 2.4, 2.55, -0.8, 0.8, METAL_SOMBRE);
      for (const g of [-1.9, 1.9]) boite(c.decor, ab, g - 0.05, g + 0.05, 0, 2.4, 0.6, 0.7, METAL_SOMBRE);
      const logos = sponsorsDuTheme(x.palette);
      c.affiches.face(ab, -1.8, -0.2, 0.4, 2.2, 0.69, rectSponsor(logos[Math.floor(rnd() * logos.length)]!));
    } else {
      // Feu tricolore et caisses.
      tube(c.decor, [p.x, y, p.z], [p.x, y + 3.2, p.z], 0.08, 5, METAL_SOMBRE);
      c.decor.box(p.x - 0.22, y + 3.2, p.z - 0.18, p.x + 0.22, y + 4.4, p.z + 0.18, CAOUTCHOUC);
      for (const [dy, col] of [[0.25, 0x2fd37b], [0.6, 0x3a2a10], [0.95, 0x3a1010]] as const) c.decorLumineux.box(p.x - 0.12, y + 3.2 + dy - 0.1, p.z - 0.19, p.x + 0.12, y + 3.2 + dy + 0.1, p.z - 0.18, col);
      for (let i = 0; i < 3; i++) boite(c.decor, repereSol(p.x + 2 + i * 0.3, y + (i === 2 ? 0.9 : 0), p.z + (i === 1 ? 1 : 0), 0.3), -0.45, 0.45, 0, 0.9, -0.45, 0.45, BOIS_CLAIR);
    }
  },
  remplissage(g, x, p, rnd) {
    const w = 6 + rnd() * 6;
    const d = 6 + rnd() * 6;
    immeuble(g, p.x, x.floorY, p.z, w, d, p.y - x.floorY + 6 + rnd() * 24, mur(rnd()), 1e9);
  },
  plus(s, c, x, near) {
    const cap = x.pal.wallHeight ?? WALL_HEIGHT;
    if (!c.decor.mute && !near) for (const b of x.track.blocks) lampadairesDeRue(c, b, cap, s.log);
    // Le front de rue (lot 37) : de chaque côté de la piste, des immeubles à 2–12 m du rebord, de 8 à 38 m au-dessus de la route, une suite à part ;
    // jamais à moins de 1,5 m de la route, jamais l'un dans l'autre. Tirés pour toute la piste ; `near` ne choisit que ceux qu'on construit (miniatures).
    const rnd = seeded(`${x.track.id}:${x.pal.scenery}:rue`);
    const pris: Box[] = [];
    for (const b of x.track.blocks) {
      if (b.kind === "gap" || b.cuve) continue;
      const courbe = isCurve(b.kind);
      const places = courbe ? 2 * curveSize(b.kind) : 2;
      for (const side of [-1, 1] as const) {
        for (let k = 0; k < places; k++) {
          const t = (k + 0.2 + rnd() * 0.6) / places;
          const ecart = 2 + rnd() * 10;
          const prof = 7 + rnd() * 5;
          const long = 8 + rnd() * 8;
          const haut = 8 + rnd() * 30;
          const teinte = rnd();
          const hw = courbe ? b.w0 / 2 : blockHalfWidth(b, t * CELL);
          const m = onBlock(b, side * (hw + ecart + prof / 2), t, 0);
          const selonX = !courbe && (b.dir === 1 || b.dir === 3);
          const w = courbe ? (long + prof) / 2 : selonX ? long : prof;
          const d = courbe ? (long + prof) / 2 : selonX ? prof : long;
          const box: Box = { x0: m[0] - w / 2, x1: m[0] + w / 2, z0: m[2] - d / 2, z1: m[2] + d / 2, y0: x.floorY, y1: 0 };
          if (!planLibre(s.world, box, 1.5) || pris.some((o) => box.x0 < o.x1 + 0.5 && box.x1 > o.x0 - 0.5 && box.z0 < o.z1 + 0.5 && box.z1 > o.z0 - 0.5)) continue;
          pris.push(box);
          const routeY = courbe ? b.y0 + b.rise / 2 : blockHeight(b, t * CELL);
          c.decor.mute = !!near && !near(Math.floor(m[0] / CELL), Math.floor(m[2] / CELL));
          placed(s.log, { kind: "decor", part: "pied", appui: "sol", group: s.log?.group() ?? 0, block: -1, style: "city-front" }, [c.decor], () => immeuble(c.decor, m[0], x.floorY, m[2], w, d, routeY - x.floorY + haut, mur(teinte), routeY - x.floorY - 2));
          c.decor.mute = false;
        }
      }
    }
  },
});
