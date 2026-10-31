import { boites, type PieceKind } from "@cdj/tower-sim";
import { svg } from "@cdj/ui";
import { paletteCourante } from "./palette";

// L'aperçu de la pièce suivante du HUD (lot T1), sorti de `composants.ts` au lot T4 : il lit les formes des pièces de la simulation (`boites`), que l'accueil — le premier chargement — n'embarque pas.

/** La forme d'une pièce, de profil et en couleur (« Suivante »), bordée d'encre : l'encre dessous, la couleur dessus. */
export function apercuPiece(kind: PieceKind, largeur = 42, hauteur = 28): SVGSVGElement {
  const bs = boites(kind, 0);
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const b of bs) {
    x0 = Math.min(x0, (b.cx - b.hw) / 8);
    x1 = Math.max(x1, (b.cx + b.hw) / 8);
    y0 = Math.min(y0, (b.cy - b.hh) / 8);
    y1 = Math.max(y1, (b.cy + b.hh) / 8);
  }
  const m = 0.12;
  const encre = bs.map((b) => svg("rect", { classe: "piece-encre", attrs: { x: (b.cx - b.hw) / 8 - m, y: -((b.cy + b.hh) / 8) - m, width: (2 * b.hw) / 8 + 2 * m, height: (2 * b.hh) / 8 + 2 * m } }));
  const couleur = bs.map((b) => svg("rect", { attrs: { x: (b.cx - b.hw) / 8, y: -((b.cy + b.hh) / 8), width: (2 * b.hw) / 8 + 0.02, height: (2 * b.hh) / 8 + 0.02, fill: paletteCourante().pieces[kind] } }));
  return svg(
    "svg",
    { classe: "apercu-piece", attrs: { viewBox: `${x0 - m * 2} ${-y1 - m * 2} ${x1 - x0 + m * 4} ${y1 - y0 + m * 4}`, width: largeur, height: hauteur, "aria-hidden": "true", preserveAspectRatio: "xMidYMid meet" } },
    ...encre,
    ...couleur,
  );
}
