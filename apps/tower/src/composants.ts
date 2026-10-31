import { boites, type PieceKind } from "@cdj/tower-sim";
import { el, svg } from "@cdj/ui";
import { paletteCourante } from "./palette";

// Les petits morceaux d'interface propres à Tower (lot T1), tous construits par `el` / `svg` (jamais `innerHTML`) : les cœurs des vies, l'aperçu de la pièce suivante, la petite pile de
// pièces à yeux de l'étiquette, le bouton principal de Tower (fond encre, texte menthe, Rubik Mono One, épaisseur coque : charte rév. 13, § 5).

const COEUR_PLEIN = "M8 13 1.6 6.6a3.6 3.6 0 0 1 5.1-5.1L8 2.8l1.3-1.3a3.6 3.6 0 0 1 5.1 5.1z";
const COEUR_VIDE = "M8 12.5 1.9 6.4a3.3 3.3 0 0 1 4.7-4.7L8 3.1l1.4-1.4a3.3 3.3 0 0 1 4.7 4.7z";

/** Les vies en cœurs : un plein par vie restante, un contour par vie perdue. Le groupe porte le nom lu (`ariaLabel`), les cœurs sont décoratifs. */
export function coeurs(total: number, restantes: number, ariaLabel: string): HTMLElement {
  const g = el("span", { classe: "coeurs", attrs: { role: "img", "aria-label": ariaLabel } });
  majCoeurs(g, total, restantes);
  return g;
}

export function majCoeurs(g: HTMLElement, total: number, restantes: number): void {
  const faits = g.children.length;
  if (faits === total) {
    [...g.children].forEach((c, i) => c.classList.toggle("coeur--vide", i >= restantes));
    return;
  }
  g.replaceChildren(
    ...Array.from({ length: total }, (_, i) =>
      svg("svg", { classe: ["coeur", i >= restantes && "coeur--vide"], attrs: { "aria-hidden": "true", viewBox: "0 0 16 14", width: 15, height: 14 } }, svg("path", { attrs: { d: i >= restantes ? COEUR_VIDE : COEUR_PLEIN } })),
    ),
  );
}

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

/** La petite pile de pièces à yeux de l'étiquette (charte rév. 13 § 5), décorative : la tour de la maquette `tower-arrivee.html` en dessin fixe. */
export function petiteTour(taille = 92): SVGSVGElement {
  const piece = (kind: PieceKind, d: string) => svg("path", { attrs: { d, fill: paletteCourante().pieces[kind] }, classe: "tour-piece" });
  const oeil = (cx: number, cy: number) => [svg("circle", { classe: "oeil", attrs: { cx, cy, r: 6 } }), svg("path", { classe: "oeil-pupille", attrs: { d: `M${cx - 5} ${cy - 1}h10` } })];
  return svg(
    "svg",
    { classe: "petite-tour", attrs: { viewBox: "0 0 118 104", width: taille, height: taille, "aria-hidden": "true" } },
    svg("rect", { classe: "tour-sol", attrs: { x: 4, y: 96, width: 110, height: 8 } }),
    piece("J", "M14 74h88v22H14z"),
    piece("O", "M20 52h40v22H20z"),
    piece("L", "M60 74V52h20V30h20v44z"),
    piece("T", "M28 52V30h20V8h20v22H48v22z"),
    ...oeil(31, 63),
    ...oeil(47, 63),
  );
}

/** Le bouton principal de Tower (« Reprendre », « Rejouer ») : fond encre, texte menthe, Rubik Mono One, épaisseur vert sapin. */
export function boutonJouer(texte: string, onClick: () => void, id?: string): HTMLButtonElement {
  const b = el("button", { classe: "bouton-jouer", attrs: { type: "button", id }, texte });
  b.addEventListener("click", onClick);
  return b;
}
