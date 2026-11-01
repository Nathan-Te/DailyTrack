import type { Commandes } from "@cdj/ui/src/commandes";
import { el } from "@cdj/ui";
import { t } from "./i18n";

// L'aide des commandes en partie (lot T7), comme dans Track et Jump : **au départ d'une partie, une ligne courte sous la bande qui cite les touches CHOISIES** (« ← Q → D déplacer · ↑ Z tourner ·
// ↓ S descendre · P pause »), dessinée en **boutons de manette** si la dernière entrée vient d'une manette, en touches sinon ; elle disparaît après quelques pièces (charte § 9 : une aide
// s'affiche en une ligne puis disparaît). Au tactile, les boutons de l'écran suffisent : rien ne s'affiche. Le gabarit est celui du catalogue (`aide.ligne`) : les touches ne sont jamais écrites ici.

/** La dernière entrée du joueur : elle décide de ce que la ligne dessine (touches ou boutons de manette) ; au tactile elle ne se montre pas. */
export type Entree = "clavier" | "manette" | "tactile";

const MARQUE = "\u0001";
/** Les actions que la ligne cite, dans le gabarit `aide.ligne`. */
export const ACTIONS_AIDE = ["gauche", "droite", "tourner", "descendre", "pause"] as const;
/** Le nombre de touches montrées par action : l'origine en a deux ou trois, la ligne reste courte. */
const TOUCHES_MONTREES = 2;

type Lecture = Pick<Commandes, "nomsTouches" | "nomLiaison">;

/** Les noms écrits dans les pastilles d'une action : les touches choisies (clavier), ou le bouton (manette ; le stick et la croix déplacent, Start met en pause : fixes). */
export function nomsAide(c: Lecture, id: (typeof ACTIONS_AIDE)[number], entree: "clavier" | "manette", langue: "fr" | "en"): string[] {
  if (entree === "clavier") return c.nomsTouches(id, langue).slice(0, TOUCHES_MONTREES);
  if (id === "gauche") return ["←"];
  if (id === "droite") return ["→"];
  if (id === "pause") return ["Start"];
  return [c.nomLiaison(id, langue)];
}

/** Un morceau de la ligne : du texte, ou les noms des pastilles d'une action. */
export type SegmentAide = string | readonly string[];

/** La ligne en données (pure, testée) : le gabarit du catalogue (`aide.ligne`) dont chaque `{action}` devient la liste des noms à dessiner en pastilles. */
export function segmentsAide(c: Lecture, entree: "clavier" | "manette", langue: "fr" | "en", traduire: (cle: string, params?: Record<string, string>) => string = t): SegmentAide[] {
  const params = Object.fromEntries(ACTIONS_AIDE.map((id) => [id, `${MARQUE}${id}${MARQUE}`]));
  return traduire("aide.ligne", params)
    .split(MARQUE)
    .map((m, i) => (i % 2 === 0 ? m : nomsAide(c, m as (typeof ACTIONS_AIDE)[number], entree, langue)));
}

/** La ligne dessinée : le texte, et une pastille (`kbd`) par touche ou bouton à la place de chaque `{action}`. */
export function noeudsAide(c: Lecture, entree: "clavier" | "manette", langue: "fr" | "en"): Node[] {
  return segmentsAide(c, entree, langue).map((m) =>
    typeof m === "string" ? document.createTextNode(m) : el("span", { classe: "aide-ligne__touches" }, ...m.map((n) => el("kbd", { classe: entree === "manette" ? "touche touche--manette" : "touche", texte: n }))),
  );
}
