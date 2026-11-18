import { svg, el } from "./dom";
import type { TraducteurClassement } from "./classement";

// Lot U6 — les places gagnées (▲) ou perdues (▼) à côté du rang. **Un module à part de `classement.ts`, chargé à la demande avec le suivi des rangs** (`classementRangs.ts`) : le premier chargement d'une page ne le paie pas.
// Sa feuille est `mouvement.css`. Un triangle dessiné, le nombre, et le texte entier pour les lecteurs d'écran ; aucun glyphe, aucun émoji.

/** Les places gagnées (▲) ou perdues (▼) : un triangle dessiné, le nombre, et le texte entier pour les lecteurs d'écran. */
export function mouvement(t: TraducteurClassement, n: number): HTMLElement | null {
  if (!Number.isInteger(n) || n === 0) return null;
  const monte = n > 0;
  const abs = Math.abs(n);
  return el(
    "small",
    { classe: ["classement-mouvement", monte ? "classement-mouvement--monte" : "classement-mouvement--descend"] },
    svg("svg", { attrs: { viewBox: "0 0 10 8", width: 9, height: 7, "aria-hidden": "true", focusable: "false" } }, svg("path", { attrs: { d: monte ? "M5 0 10 8H0Z" : "M0 0H10L5 8Z" } })),
    el("span", { attrs: { "aria-hidden": "true" }, texte: String(abs) }),
    el("span", { classe: "dj-cache", texte: t.t(monte ? "classement.monte" : "classement.descend", { n: abs }) }),
  );
}
