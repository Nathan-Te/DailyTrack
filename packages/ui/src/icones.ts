import { svg } from "./dom";

// Les icônes de la charte (§ 6, lot I1) : SVG au trait de 2 à 2,5 px, extrémités carrées, `currentColor` ; formes simples. Décorative :
// `aria-hidden` ; seule (sans texte à côté) : `role="img"` et `aria-label` (texte du catalogue, fourni par l'appelant). Aucun émoji.

export const ICONES = ["chevron", "flamme", "crane", "drapeau", "horloge", "profil", "pleinEcran", "pleinEcranQuitter", "camera"] as const;
export type NomIcone = (typeof ICONES)[number];

/** Les tracés de chaque icône (grille de 24). */
const TRACES: Record<NomIcone, readonly string[]> = {
  chevron: ["M15 4 7 12l8 8"],
  flamme: ["M12 2c1 5 7 7 7 13a7 7 0 0 1-14 0c0-4 3-5 3-8 2 1 3 3 3 5 2-2 2-6 1-10z"],
  crane: ["M12 3c-5 0-8 3.4-8 7.5 0 2.7 1.3 4.2 2.7 4.9V19h10.6v-3.6c1.4-.7 2.7-2.2 2.7-4.9C20 6.4 17 3 12 3z", "M9 10.5h1.5v2H9zM13.5 10.5H15v2h-1.5z", "M10 19v2M14 19v2"],
  drapeau: ["M5 21V3", "M5 4h13l-3 4.5 3 4.5H5"],
  horloge: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M12 7v5l3.5 2"],
  pleinEcran: ["M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"],
  pleinEcranQuitter: ["M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5"],
  camera: ["M3 7h4l1.5-2h7L17 7h4v12H3z", "M12 10a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"],
  profil: ["M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8z", "M4 21c0-4 3.6-7 8-7s8 3 8 7"],
};

/** Lot G1 : le fantôme (silhouette à bas ondulé, deux yeux) — « passer au fantôme suivant ». À part de `TRACES` : le portail n'a pas de bouton fantôme et ne le paie pas (budget du premier chargement ; une entrée de `TRACES` serait toujours embarquée). */
const TRACES_FANTOME = ["M5 21V11a7 7 0 0 1 14 0v10l-3-2-3 2-3-2-3 2z", "M9 11h1M14 11h1"];

type OptionsIcone = { label?: string; taille?: number };

function dessiner(nom: string, traces: readonly string[], { label, taille = 20 }: OptionsIcone): SVGSVGElement {
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
    ...traces.map((d) => svg("path", { attrs: { d } })),
  );
}

/** Une icône ; `label` : son nom lisible (icône seule), sinon décorative. */
export const icone = (nom: NomIcone, o: OptionsIcone = {}): SVGSVGElement => dessiner(nom, TRACES[nom], o);

/** Lot G1 : l'icône du fantôme (voir `TRACES_FANTOME`). */
export const iconeFantome = (o: OptionsIcone = {}): SVGSVGElement => dessiner("fantome", TRACES_FANTOME, o);
