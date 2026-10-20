import type { Suite } from "@cdj/profile";

// Lot I3 de la plateforme — « Jeu suivant du jour » à l'écran d'arrivée. Lot I4 : la décision (`suiteDuJour`) et la lecture (`lireSuite`) sont dans `@cdj/profile`
// (partagées avec DailyTrack, tests compris) ; il ne reste ici que le DOM de l'arrivée de Jump. Texte en français tant que le jeu l'est, clés prêtes à traduire
// (`arrivee.jeuSuivant`, `arrivee.parfaite`, `barre.retour` du catalogue commun de @cdj/ui) ; à garder quand l'interface passera au socle (lot I5).

/**
 * Ce que l'arrivée montre de la suite (DOM) : le bouton « Jeu suivant du jour : Track › » (un lien vers le jeu, 48 px), ou « Journée parfaite ! » et « ‹ Du Jour ».
 * Texte en français tant que le jeu l'est ; `data-t` : les clés du catalogue commun de @cdj/ui (`arrivee.jeuSuivant` prend le nom du jeu : `data-jeu`).
 */
export function elementsDeSuite(suite: Suite): HTMLElement[] {
  if (suite.kind === "suivant") {
    const a = document.createElement("a");
    a.id = "arrival-next-game";
    a.className = "anext-link";
    a.href = suite.href;
    a.textContent = `Jeu suivant du jour : ${suite.nom} ›`;
    a.setAttribute("aria-label", `Jouer au jeu suivant du jour : ${suite.nom}`);
    a.dataset.t = "arrivee.jeuSuivant";
    a.dataset.jeu = suite.nom;
    return [a];
  }
  const parfaite = document.createElement("div");
  parfaite.id = "arrival-perfect";
  parfaite.className = "anext-perfect";
  parfaite.textContent = "Journée parfaite !";
  parfaite.dataset.t = "arrivee.parfaite";
  const retour = document.createElement("a");
  retour.id = "arrival-portail";
  retour.className = "anext-link";
  retour.href = suite.href;
  retour.textContent = "‹ Du Jour";
  retour.setAttribute("aria-label", "Retour au portail Du Jour");
  retour.dataset.t = "barre.retour";
  return [parfaite, retour];
}
