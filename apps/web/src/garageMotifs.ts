// Lot 40c — les vignettes des motifs du Garage : une petite voiture vue de dessus (l'avant à droite), dans l'orange de Track, avec le motif dessiné dessus. Dessinées par le code
// (SVG, aucun fichier) avec les couleurs de la charte ; elles servent de choix (chaque tuile est un bouton à son nom). Chargé avec le Garage (à la demande).
import type { MotifLivree } from "./voiture/livree";

const NS = "http://www.w3.org/2000/svg";
const CREME = "var(--track-texte)";
const ORANGE = "var(--track-livree)";
const ASPHALTE = "var(--track-asphalte)";

/** Un élément SVG avec ses attributs. */
function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, ...enfants: SVGElement[]): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  e.append(...enfants);
  return e;
}

/** Le motif dessiné sur la caisse (sous les vitres : une bande ne se peint pas sur une vitre). */
function motifDessus(m: MotifLivree): SVGElement[] {
  const f = { fill: CREME };
  switch (m) {
    case "course":
      return [s("rect", { x: 5, y: 12.4, width: 62, height: 2.6, ...f }), s("rect", { x: 5, y: 19, width: 62, height: 2.6, ...f }), s("rect", { x: 5, y: 15.9, width: 62, height: 1, fill: ASPHALTE })];
    case "flancs":
      return [0, 1, 2, 3, 4].flatMap((i) => [s("path", { d: `M${12 + i * 5} 5 l-3.4 5.4 h2.6 l3.4 -5.4z`, ...f }), s("path", { d: `M${12 + i * 5} 29 l-3.4 -5.4 h2.6 l3.4 5.4z`, ...f })]);
    case "filet":
      return [s("rect", { x: 5, y: 7.2, width: 62, height: 1.8, ...f }), s("rect", { x: 5, y: 25, width: 62, height: 1.8, ...f })];
    case "bicolore":
      return [s("rect", { x: 17, y: 6.6, width: 29, height: 20.8, rx: 5, ...f })];
    case "chevrons":
      return [s("path", { d: "M51 11.5 L57 17 L51 22.5", fill: "none", stroke: CREME, "stroke-width": 2.4, "stroke-linejoin": "round" }), s("path", { d: "M57.5 11.5 L63.5 17 L57.5 22.5", fill: "none", stroke: CREME, "stroke-width": 2.4, "stroke-linejoin": "round" })];
    case "damier": {
      const out: SVGElement[] = [];
      for (let i = 0; i < 6; i++)
        for (let j = 0; j < 2; j++) {
          out.push(s("rect", { x: 8 + i * 3.4, y: 5 + j * 3.4, width: 3.4, height: 3.4, fill: (i + j) % 2 ? CREME : ASPHALTE }));
          out.push(s("rect", { x: 8 + i * 3.4, y: 23.6 + j * 3.4, width: 3.4, height: 3.4, fill: (i + j) % 2 ? ASPHALTE : CREME }));
        }
      return out;
    }
    case "rond":
      return [s("circle", { cx: 58, cy: 17, r: 6.4, ...f }), s("circle", { cx: 58, cy: 17, r: 4.2, fill: ORANGE }), s("circle", { cx: 33, cy: 6.4, r: 4.4, ...f }), s("circle", { cx: 33, cy: 27.6, r: 4.4, ...f })];
    case "unie":
      return [];
  }
}

/** La vignette d'un motif (72 × 34 px de dessin) : décorative, le bouton qui la porte a son nom. */
export function vignetteMotif(m: MotifLivree): SVGSVGElement {
  const svg = s("svg", { viewBox: "0 0 72 34", width: 72, height: 34, "aria-hidden": "true", focusable: "false", class: "garage-motif-dessin" });
  svg.append(
    s("rect", { x: 3, y: 4.5, width: 66, height: 25, rx: 11, fill: ORANGE }),
    ...motifDessus(m),
    // Les vitres : le pare-brise (à droite), la lunette (à gauche) ; les roues dépassent aux quatre coins.
    s("path", { d: "M45.5 8.6 L53 11 V23 L45.5 25.4z", fill: ASPHALTE }),
    s("path", { d: "M15.5 9.6 L11 11.4 V22.6 L15.5 24.4z", fill: ASPHALTE }),
    ...[
      [14, 2.6],
      [14, 31.4],
      [55, 2.6],
      [55, 31.4],
    ].map(([x, y]) => s("rect", { x: x! - 5, y: y! - 1.7, width: 10, height: 3.4, rx: 1.2, fill: ASPHALTE })),
  );
  return svg;
}
