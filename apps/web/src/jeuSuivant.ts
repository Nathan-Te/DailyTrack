import type { Suite } from "@cdj/profile";
import { bouton, el } from "@cdj/ui";
import { t } from "./i18n";

// Lot I3 de la plateforme — « Jeu suivant du jour » à l'écran d'arrivée. Lot I4 : la décision (`suiteDuJour`) et la lecture (`lireSuite`, une requête vers
// `GET /api/portail/jour`) sont dans `@cdj/profile` (partagées avec DailyJump, tests compris) ; il ne reste ici que le DOM de l'arrivée de Track, composé
// avec le socle `@cdj/ui` : le bouton de marque « Jeu suivant du jour : Jump › » (un lien de 44 px), ou « Journée parfaite ! » et « ‹ DU JOUR ».
// Rien n'est connu d'un jeu dans l'autre : le dossier et le nom viennent du serveur.

/** Ce que l'arrivée montre de la suite : un lien vers le jeu suivant (`#finish-next-game`), ou la journée parfaite (`#finish-perfect`) et le retour au portail (`#finish-portail`). */
export function elementsDeSuite(suite: Suite): HTMLElement[] {
  if (suite.kind === "suivant") {
    const lien = bouton({ texte: t("arrivee.jeuSuivant", { jeu: suite.nom }), ariaLabel: t("arrivee.jeuSuivant.aria", { jeu: suite.nom }), href: suite.href, variante: "marque", pleineLargeur: true });
    lien.id = "finish-next-game";
    lien.classList.add("next-game");
    return [el("span", { classe: "arrivee__legende", texte: t("arrivee.legendeSuite") }), lien];
  }
  const retour = bouton({ texte: t("barre.retour"), ariaLabel: t("barre.retour.aria"), href: suite.href, variante: "marque", pleineLargeur: true });
  retour.id = "finish-portail";
  retour.classList.add("next-game");
  return [el("div", { classe: "arrivee__parfaite", attrs: { id: "finish-perfect" }, texte: t("arrivee.parfaite") }), retour];
}
