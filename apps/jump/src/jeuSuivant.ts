import { call } from "@cdj/profile";

// Lot I3 de la plateforme — « Jeu suivant du jour » à l'écran d'arrivée : s'il reste un jeu du jour non fini, un bouton « Jeu suivant du jour : Jump › » qui
// l'ouvre ; si tous sont finis, « Journée parfaite ! » et le lien « ‹ Du Jour ». L'information vient de **`GET /api/portail/jour`** (une lecture à l'arrivée, après
// l'envoi accepté : les jeux du jour avec leur dossier et leur nom, et l'état du joueur dans chacun), jamais d'une connaissance codée d'un jeu dans l'autre : un jeu
// n° 3 apparaîtra tout seul. Pur côté décision (`suiteDuJour`, testé) ; le serveur injoignable ne donne rien (pas de bouton, rien de bloquant).
// Ajout minimal à l'arrivée : texte en français tant que le jeu l'est, clés prêtes à traduire (`arrivee.jeuSuivant`, `arrivee.parfaite`, `barre.retour` du catalogue
// commun de @cdj/ui) ; à garder quand l'interface passera au socle (lots I4 et I5).

/** Ce que l'écran d'arrivée affiche après le résultat. */
export type Suite = { kind: "suivant"; jeu: string; nom: string; href: string } | { kind: "parfaite"; href: string };

/**
 * La suite de la journée pour le jeu `courant` (son code au registre du serveur : `cdj` pour DailyTrack, `jump` pour DailyJump), d'après la réponse de
 * `GET /api/portail/jour` avec le joueur. `null` : rien à proposer — réponse illisible, ou le jeu courant n'est pas (encore) fini côté serveur (l'arrivée
 * d'une archive, un envoi pas encore accepté), ou un jeu non fini qu'on ne sait pas ouvrir.
 */
export function suiteDuJour(corps: unknown, courant: string): Suite | null {
  const jeux = (corps as { jeux?: unknown } | null)?.jeux;
  if (!Array.isArray(jeux)) return null;
  const lus = jeux.filter((j): j is { jeu: string; site?: unknown; nom?: unknown; etat?: { statut?: unknown } } => !!j && typeof (j as { jeu?: unknown }).jeu === "string");
  const fini = (j: { etat?: { statut?: unknown } }) => j.etat?.statut === "fini";
  const moi = lus.find((j) => j.jeu === courant);
  if (!moi || !fini(moi)) return null;
  const autres = lus.filter((j) => j !== moi);
  // Le premier jeu du jour qui reste à jouer (dans l'ordre du serveur).
  const suivant = autres.find((j) => !fini(j) && typeof j.site === "string" && j.site !== "" && typeof j.nom === "string" && j.nom !== "");
  if (suivant) return { kind: "suivant", jeu: suivant.jeu, nom: suivant.nom as string, href: `../${encodeURIComponent(suivant.site as string)}/` };
  return autres.every(fini) ? { kind: "parfaite", href: "../" } : null;
}

/** Lit la suite de la journée (une requête) ; `null` sans réponse du serveur. Ne lève jamais. L'identifiant part en `X-Player-Id`, jamais dans l'adresse. */
export async function lireSuite(base: string, playerId: string, courant: string, fetchImpl?: typeof fetch): Promise<Suite | null> {
  const r = await call<unknown>(base, "GET", "/api/portail/jour", undefined, 8000, { "X-Player-Id": playerId }, fetchImpl);
  return r.ok ? suiteDuJour(r.data, courant) : null;
}

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
