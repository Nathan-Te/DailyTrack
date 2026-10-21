import { svg } from "@cdj/ui";

// Les icônes propres à DailyTrack (lot I4, charte § 6) : SVG au trait, extrémités carrées, `currentColor`, mêmes règles que celles du socle
// (`dj-icone` : épaisseur de trait des jetons). Aucun émoji dans l'interface. Une icône seule porte un `aria-label` (posé par l'appelant sur
// son bouton) ; l'icône elle-même est décorative.

export const ICONES_TRACK = ["reglages", "recommencer", "son", "muet", "fantome", "aide", "calendrier", "classement", "lecture", "pause", "fermer", "accueil"] as const;
export type IconeTrack = (typeof ICONES_TRACK)[number];

const TRACES: Record<IconeTrack, readonly string[]> = {
  reglages: ["M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z", "M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2.2 2.2M16.8 16.8 19 19M19 5l-2.2 2.2M7.2 16.8 5 19"],
  recommencer: ["M20 12a8 8 0 1 1-2.6-5.9", "M20 3v5h-5"],
  son: ["M4 9v6h4l5 4V5L8 9z", "M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11"],
  muet: ["M4 9v6h4l5 4V5L8 9z", "M17 9l5 6M22 9l-5 6"],
  fantome: ["M3 21V10a9 9 0 0 1 18 0v11l-3-3-3 3-3-3-3 3-3-3z", "M9 10h1.5v2H9zM13.5 10H15v2h-1.5z"],
  aide: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7", "M12 17v.5"],
  calendrier: ["M4 6h16v14H4z", "M4 10h16M8 3v4M16 3v4"],
  classement: ["M4 20V12h5v8M9.5 20V5h5v15M15 20v-6h5v6M3 20h18"],
  lecture: ["M7 4v16l13-8z"],
  pause: ["M8 5v14M16 5v14"],
  fermer: ["M5 5l14 14M19 5 5 19"],
  accueil: ["M3 11 12 3l9 8", "M5 10v10h14V10", "M10 20v-6h4v6"],
};

/** Une icône décorative de Track (grille de 24). */
export function iconeTrack(nom: IconeTrack, taille = 20): SVGSVGElement {
  return svg(
    "svg",
    { classe: ["dj-icone", `dj-icone--${nom}`], attrs: { viewBox: "0 0 24 24", width: taille, height: taille, fill: "none", stroke: "currentColor", "stroke-linecap": "square", "stroke-linejoin": "miter", focusable: "false", "aria-hidden": "true" } },
    ...TRACES[nom].map((d) => svg("path", { attrs: { d } })),
  );
}
