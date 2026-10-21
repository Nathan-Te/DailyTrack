import type { Suite } from "@cdj/profile";
import { bouton, el } from "@cdj/ui";
import { t } from "./i18n";

// Lot I3 de la plateforme — « Jeu suivant du jour » à l'écran d'arrivée. La décision (`suiteDuJour`) et la lecture (`lireSuite`, une requête vers
// `GET /api/portail/jour`) sont dans `@cdj/profile` (partagées avec Track, tests compris) ; il ne reste ici que le DOM de l'arrivée de Jump, **lot I5 :
// composé avec le socle `@cdj/ui`** comme Track (apps/web/src/jeuSuivant.ts) : sous l'étiquette, « Il te reste aujourd'hui » et le bouton de marque
// « Jeu suivant du jour : Track › » (un lien de 44 px), ou « Journée parfaite ! » et « ‹ DU JOUR ». Rien n'est connu d'un jeu dans l'autre : le dossier et
// le nom viennent du serveur.

/** Ce que l'arrivée montre de la suite : un lien vers le jeu suivant (`#arrival-next-game`), ou la journée parfaite (`#arrival-perfect`) et le retour au portail (`#arrival-portail`). */
export function elementsDeSuite(suite: Suite): HTMLElement[] {
  if (suite.kind === "suivant") {
    const lien = bouton({ texte: t("arrivee.jeuSuivant", { jeu: suite.nom }), ariaLabel: t("arrivee.jeuSuivant.aria", { jeu: suite.nom }), href: suite.href, variante: "marque", pleineLargeur: true });
    lien.id = "arrival-next-game";
    lien.classList.add("next-game");
    return [el("span", { classe: "arrivee__legende-suite", texte: t("arrivee.legendeSuite") }), lien];
  }
  const retour = bouton({ texte: t("barre.retour"), ariaLabel: t("barre.retour.aria"), href: suite.href, variante: "marque", pleineLargeur: true });
  retour.id = "arrival-portail";
  retour.classList.add("next-game");
  return [el("div", { classe: "arrivee__parfaite", attrs: { id: "arrival-perfect" }, texte: t("arrivee.parfaite") }), retour];
}
