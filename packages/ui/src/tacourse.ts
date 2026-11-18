import type { CATALOGUE_TACOURSE } from "./catalogue.tacourse";
import { el } from "./dom";
import type { Traducteur } from "./i18n";

// Lot U6 — « Ta course », la barre des classements : ta place, l'écart au joueur de devant, une seconde ligne qui dépend de la vue, et le bouton « Rejouer <jeu> ». **Un module à part du podium et de la liste** (`classement.ts`) : le portail
// ne le charge qu'**à la demande**, une fois le classement affiché et seulement si tu y es classé (sa feuille `tacourse.css` et son catalogue `catalogue.tacourse.ts` avec lui) — le premier chargement de `/classement/` ne les paie pas.
// Pur : il reçoit des nombres déjà écrits et ne nomme aucun jeu. Aucun `innerHTML` : tout est en `textContent`.

export type TraducteurTaCourse = Traducteur<keyof typeof CATALOGUE_TACOURSE.fr & string>;

/** Ce que la barre « Ta course » dit : ta place, l'écart au joueur de devant, une seconde ligne qui dépend de la vue, et le bouton. Les nombres arrivent déjà écrits (`ecart` : « 0,185 s »). */
export interface DonneesCourse {
  /** Ta place, écrite (« 2e »). */
  rangLu: string;
  phrase: { type: "avance"; ecart: string; nom: string } | { type: "premier"; ecart: string } | { type: "doubler"; ecart: string; nom: string };
  /** Au cumul : le jeu où le joueur de devant te prend le plus de temps ; dans un jeu : l'écart à la médaille suivante ; pour un groupe : si ton temps compte. */
  sous: { type: "perte"; nom: string; ecart: string; jeu: string } | { type: "medaille"; medaille: string; ecart: string } | { type: "groupeCompte"; rangLu: string } | { type: "groupeNonCompte" } | null;
  /** « Rejouer <jeu> » mène à ce jeu ; sans nom de jeu, « Jouer ». `null` : pas de bouton. */
  bouton: { href: string; jeu: string | null } | null;
}

/** Le texte de la phrase : `ecart` (écrit en gras dans la barre) et ce qui suit. */
export function phraseDeCourse(t: TraducteurTaCourse, p: DonneesCourse["phrase"]): { ecart: string; reste: string } {
  const marque = "\u0001"; // l'écart est en gras : on coupe le texte traduit à sa place
  const texte = p.type === "avance" ? t.t("tacourse.avanceSur", { ecart: marque, nom: p.nom }) : p.type === "premier" ? t.t("tacourse.passerPremier", { ecart: marque }) : t.t("tacourse.doubler", { ecart: marque, nom: p.nom });
  const i = texte.indexOf(marque);
  return i < 0 ? { ecart: p.ecart, reste: ` ${texte}` } : { ecart: p.ecart, reste: `${texte.slice(0, i)}${texte.slice(i + marque.length)}` };
}

/** La seconde ligne de la barre. */
export function sousDeCourse(t: TraducteurTaCourse, s: NonNullable<DonneesCourse["sous"]>): string {
  switch (s.type) {
    case "perte":
      return t.t("tacourse.perte", { nom: s.nom, ecart: s.ecart, jeu: s.jeu });
    case "medaille":
      return t.t("tacourse.medaille", { medaille: s.medaille, ecart: s.ecart });
    case "groupeCompte":
      return t.t("tacourse.groupeCompte", { rang: s.rangLu });
    case "groupeNonCompte":
      return t.t("tacourse.groupeNonCompte");
  }
}

/**
 * La barre « Ta course » : ta place en grand, l'écart au joueur de devant (« 0,185 s pour passer 1er », « … pour doubler <pseudo> », ou, premier, « … d'avance sur <pseudo> »), une seconde ligne, et le bouton
 * « Rejouer <jeu> ». Une région nommée (`aside`) : ce n'est pas du classement, c'est un conseil. Sur téléphone la feuille la fixe au-dessus des onglets ; sur ordinateur elle est un panneau (c'est la page qui
 * décide : ce composant ne se positionne pas).
 */
export function course(t: TraducteurTaCourse, d: DonneesCourse): HTMLElement {
  const { ecart, reste } = phraseDeCourse(t, d.phrase);
  const m = /^(\d+)(.*)$/.exec(d.rangLu);
  const bouton = d.bouton ? el("a", { classe: "dj-bouton dj-bouton--marque classement-course__bouton", attrs: { href: d.bouton.href }, texte: d.bouton.jeu ? t.t("tacourse.rejouer", { jeu: d.bouton.jeu }) : t.t("tacourse.jouer") }) : null;
  return el(
    "aside",
    { classe: "classement-course", attrs: { "aria-labelledby": "classement-course-titre" } },
    el("div", { classe: "classement-course__ou", attrs: { "aria-hidden": "true" } }, m ? m[1]! : d.rangLu, m && m[2] ? el("sup", { texte: m[2] }) : null, el("small", { texte: t.t("tacourse.titre") })),
    el("span", { classe: "dj-cache", attrs: { id: "classement-course-titre" }, texte: `${t.t("tacourse.titre")} : ${d.rangLu}` }),
    el("p", { classe: "classement-course__texte" }, el("b", { texte: ecart }), reste, d.sous ? el("span", { classe: "classement-course__sous", texte: sousDeCourse(t, d.sous) }) : null),
    bouton,
  );
}
