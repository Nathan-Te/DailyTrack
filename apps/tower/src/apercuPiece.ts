import { boites, type PieceKind } from "@cdj/tower-sim";
import { svg } from "@cdj/ui";
import { melanger } from "./couleurs";
import { paletteCourante } from "./palette";
import { type Plaque } from "./tampon";

// L'aperçu de la pièce suivante du HUD (lot T1), sorti de `composants.ts` au lot T4 : il lit les formes des pièces de la simulation (`boites`), que l'accueil — le premier chargement — n'embarque pas.

/**
 * La forme d'une pièce, de profil et en couleur (« Suivante »), bordée d'encre : l'encre dessous, la couleur dessus. Lot T9 : avec un `habit` (`plaqueDe(effet).piece`), la pièce dessinée prend la couleur ou la taille de l'effet — la petite à la
 * moitié, la géante au trait épais, la glissante givrée (bord de glace), la figée avec sa bande rayée jaune et noire, celle du lierre avec sa liane.
 */
export function apercuPiece(kind: PieceKind, largeur = 42, hauteur = 28, habit: Plaque["piece"] | null = null): SVGSVGElement {
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
  const m = habit?.bordEpais ? 0.3 : 0.12;
  const base = paletteCourante().pieces[kind];
  const couleurDe = habit?.givre ? melanger(base, "#FFFFFF", 0.55) : base;
  const encre = bs.map((b) => svg("rect", { classe: "piece-encre", attrs: { x: (b.cx - b.hw) / 8 - m, y: -((b.cy + b.hh) / 8) - m, width: (2 * b.hw) / 8 + 2 * m, height: (2 * b.hh) / 8 + 2 * m } }));
  const couleur = bs.map((b) => svg("rect", { attrs: { x: (b.cx - b.hw) / 8, y: -((b.cy + b.hh) / 8), width: (2 * b.hw) / 8 + 0.02, height: (2 * b.hh) / 8 + 0.02, fill: couleurDe, ...(habit?.givre ? { stroke: "#BFE6F5", "stroke-width": 0.22 } : {}) } }));
  // Les marques de l'effet, par-dessus la couleur : la bande rayée de la figée, la liane du lierre.
  const marques: SVGElement[] = [];
  if (habit?.bande) {
    marques.push(svg("rect", { attrs: { x: x0 + 0.1, y: -y0 - 0.5, width: x1 - x0 - 0.2, height: 0.34, fill: "#F2B705" } }));
    for (let x = x0 + 0.2; x < x1 - 0.5; x += 0.55) marques.push(svg("path", { classe: "piece-encre", attrs: { d: `M${x} ${-y0 - 0.16}l0.2 0l0.2 -0.34l-0.2 0z` } }));
  } else if (habit?.liane) marques.push(svg("path", { attrs: { d: `M${x0 + 0.1} ${-y1 + 0.3}q0.4 -0.3 0.8 0t0.8 0t0.8 0`, fill: "none", stroke: "#2F7D3A", "stroke-width": 0.2 } }));
  const echelle = habit?.echelle ?? 1;
  return svg(
    "svg",
    { classe: "apercu-piece", attrs: { viewBox: `${x0 - m * 2} ${-y1 - m * 2} ${x1 - x0 + m * 4} ${y1 - y0 + m * 4}`, width: largeur * echelle, height: hauteur * echelle, "aria-hidden": "true", preserveAspectRatio: "xMidYMid meet" } },
    ...encre,
    ...couleur,
    ...marques,
  );
}
