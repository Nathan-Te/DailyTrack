// Lot 38 — l'existant décrit comme une direction : les portiques, portes et panneaux de `trackProps.ts`, les plaques et le rythme de
// `trackMesh.ts`, le style de route d'origine. Sert de base aux directions (chacune ne remplace que ce qu'elle change) et de contrôle du
// compositeur. **Pas de décor** : celui du jeu reste dans `trackMesh.ts` (le lot 37 le nettoie) ; la vitrine montre l'existant par la vraie scène.
import { BOOST_HALF_LENGTH, CELL, CUT_HALF_LENGTH, WALL_HEIGHT, blockHalfWidth, blockPadHalfWidth, blockWidth, isCurve, type Block } from "@cdj/sim";
import { shade, world, type Builder } from "../meshKit";
import { postFractions } from "../speedFeel";
import { addCheckpointGate, addFinishArch, addSign, addStartArch, type Props } from "../trackProps";
import { onBlock, STYLE_ORIGINE } from "./route";
import { ambianceDOrigine } from "./composer";
import type { Calques, Direction } from "./types";

const TURBO = { base: 0xff3b30, mark: 0xffe14d };
const CUT = { base: 0x2b1b45, mark: 0xffd22e };

/** Les calques d'une direction vus comme les `Props` de trackProps.ts (mêmes constructeurs). */
export function commeProps(c: Calques, floorY: number): Props {
  return { solid: c.solide, glow: c.lumineux, curtain: c.rideau, banners: c.bandeaux, aerial: c.aerien, floorY };
}

/** Une plaque au sol, de demi-largeur `ph` et demi-longueur `hl`, et des chevrons ; `n` chevrons aux avances `dqs`. */
export function plaqueOrigine(g: Builder, b: Block, fond: number, marque: number, dqs: readonly number[], bord: number) {
  const y = b.y0 + 0.04;
  const ph = blockPadHalfWidth(b);
  const p0 = CELL / 2 - ph;
  const p1 = CELL / 2 + ph;
  const q0 = CELL / 2 - BOOST_HALF_LENGTH;
  const q1 = CELL / 2 + BOOST_HALF_LENGTH;
  g.quad(world(b, p0, q0, y), world(b, p1, q0, y), world(b, p1, q1, y), world(b, p0, q1, y), fond);
  for (const dq of dqs) {
    const qc = CELL / 2 + dq;
    const h = y + 0.02;
    g.tri(world(b, CELL / 2, qc + 1.3, h), world(b, p1 - bord, qc - 0.9, h), world(b, CELL / 2, qc - 0.2, h), marque);
    g.tri(world(b, CELL / 2, qc + 1.3, h), world(b, CELL / 2, qc - 0.2, h), world(b, p0 + bord, qc - 0.9, h), marque);
  }
}

/** Halo sur une plaque (lot 23). */
export function haloPlaque(g: Builder, b: Block, couleur: number, taille: number) {
  const c = world(b, CELL / 2, CELL / 2, b.y0 + 0.6);
  g.halo(c[0], c[1], c[2], couleur, taille);
}

// IIFE annotée pure : l'empaqueteur peut écarter la direction entière si personne ne la lit (poids par partie, lots de mise en œuvre).
export const ORIGINE: Direction = /* @__PURE__ */ (() => ({
  id: "O",
  nom: "Existant",
  materiau: "standard",
  palette: (_n, base) => base,
  ambiance: (_n, pal, look) => ambianceDOrigine(pal, look),
  route: () => STYLE_ORIGINE,
  portiqueDepart(c, x, b, q) {
    addStartArch(commeProps(c, x.floorY), x.pal, b, q);
  },
  arrivee(c, x, b, q) {
    addFinishArch(commeProps(c, x.floorY), x.pal, b, q);
  },
  porte(c, x, b) {
    addCheckpointGate(commeProps(c, x.floorY), x.pal, b);
  },
  plaque(c, x, b) {
    plaqueOrigine(c.route, b, x.pal.boost, x.pal.boostMark, [-1.6, 1.4], 0.6);
    haloPlaque(c.lumineux, b, x.pal.boost, 7);
  },
  turbo(c, _x, b) {
    plaqueOrigine(c.route, b, TURBO.base, TURBO.mark, [-2.6, -0.1, 2.4], 0.5);
    haloPlaque(c.lumineux, b, TURBO.base, 9);
  },
  coupure(c, _x, b) {
    const y = b.y0 + 0.04;
    const q0 = CELL / 2 - CUT_HALF_LENGTH;
    const cols = Math.round(blockWidth(b, CELL / 2));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < 2; j++) {
        const pa = CELL / 2 - cols / 2 + i;
        const qa = q0 + 2 * j;
        c.route.quad(world(b, pa, qa, y), world(b, pa + 1, qa, y), world(b, pa + 1, qa + 2, y), world(b, pa, qa + 2, y), (i + j) % 2 === 0 ? CUT.base : CUT.mark);
      }
    }
    haloPlaque(c.lumineux, b, CUT.mark, 7);
  },
  panneau(c, x, hote, s) {
    addSign(commeProps(c, x.floorY), hote, s);
  },
  rythme(c, x, b, fast) {
    if (b.kind === "jump" || b.kind === "gap") return;
    const top = fast ? 3.4 : 2.4;
    const rail = b.open ? 0 : WALL_HEIGHT;
    const halfWidthAt = (t: number) => (isCurve(b.kind) ? b.w0 / 2 : blockHalfWidth(b, t * CELL));
    for (const t of postFractions(fast)) {
      const hw = halfWidthAt(t) + 0.3;
      for (const side of [-1, 1]) {
        const p = onBlock(b, side * hw, t, rail);
        c.solide.prism(p[0], p[1], p[2], 0.16, 0.12, top, 4, shade(x.pal.wallB, 0.95), fast ? x.pal.boostMark : x.pal.wallA, 0.78);
      }
    }
  },
  decor() {
    // Pas de décor : voir l'en-tête.
  },
}))();
