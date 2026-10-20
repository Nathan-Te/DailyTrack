import { svg } from "./dom";

// Les icônes de la charte (§ 6, lot I1) : SVG au trait de 2 à 2,5 px, extrémités carrées, `currentColor` ; formes simples. Décorative :
// `aria-hidden` ; seule (sans texte à côté) : `role="img"` et `aria-label` (texte du catalogue, fourni par l'appelant). Aucun émoji.

export const ICONES = ["chevron", "flamme", "crane", "drapeau", "horloge", "profil"] as const;
export type NomIcone = (typeof ICONES)[number];

/** Les tracés de chaque icône (grille de 24). */
const TRACES: Record<NomIcone, readonly string[]> = {
  chevron: ["M15 4 7 12l8 8"],
  flamme: ["M12 2c1 5 7 7 7 13a7 7 0 0 1-14 0c0-4 3-5 3-8 2 1 3 3 3 5 2-2 2-6 1-10z"],
  crane: ["M12 3c-5 0-8 3.4-8 7.5 0 2.7 1.3 4.2 2.7 4.9V19h10.6v-3.6c1.4-.7 2.7-2.2 2.7-4.9C20 6.4 17 3 12 3z", "M9 10.5h1.5v2H9zM13.5 10.5H15v2h-1.5z", "M10 19v2M14 19v2"],
  drapeau: ["M5 21V3", "M5 4h13l-3 4.5 3 4.5H5"],
  horloge: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M12 7v5l3.5 2"],
  profil: ["M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8z", "M4 21c0-4 3.6-7 8-7s8 3 8 7"],
};

/** Une icône ; `label` : son nom lisible (icône seule), sinon décorative. */
export function icone(nom: NomIcone, { label, taille = 20 }: { label?: string; taille?: number } = {}): SVGSVGElement {
  return svg(
    "svg",
    {
      classe: ["dj-icone", `dj-icone--${nom}`],
      attrs: {
        viewBox: "0 0 24 24",
        width: taille,
        height: taille,
        fill: "none",
        stroke: "currentColor",
        "stroke-linecap": "square",
        "stroke-linejoin": "miter",
        focusable: "false",
        ...(label ? { role: "img", "aria-label": label } : { "aria-hidden": "true" }),
      },
    },
    ...TRACES[nom].map((d) => svg("path", { attrs: { d } })),
  );
}
