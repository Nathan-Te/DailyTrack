import type { Suite } from "@cdj/profile";
import { t } from "./i18n";

// Lot I3 de la plateforme — « Jeu suivant du jour » à l'écran d'arrivée. La décision (`suiteDuJour`) et la lecture (`lireSuite`, une requête vers `GET /api/portail/jour`) sont dans `@cdj/profile` ;
// **lot K3 : le DOM est celui de `@cdj/kit/suite`**, partagé avec Track et Tower et **chargé à la demande** (quand le serveur a donné la suite : jamais dans le premier chargement) ; il ne reste ici que ce
// qui est propre à l'arrivée de Jump (les identifiants que les tests visent et l'habillage). Sous l'étiquette, « Il te reste aujourd'hui » et le bouton de marque « Jeu suivant du jour : Track › »
// (un lien de 44 px), ou « Journée parfaite ! » et « ‹ DU JOUR ». Rien n'est connu d'un jeu dans l'autre : le dossier et le nom viennent du serveur.

/** Ce que l'arrivée montre de la suite : un lien vers le jeu suivant (`#arrival-next-game`), ou la journée parfaite (`#arrival-perfect`) et le retour au portail (`#arrival-portail`). */
export const elementsDeSuite = (suite: Suite): Promise<HTMLElement[]> =>
  import("@cdj/kit/suite").then((m) => m.elementsDeSuite(suite, t, ["arrival-next-game", "arrival-perfect", "arrival-portail"], ["arrivee__legende-suite", "arrivee__parfaite", "next-game"]));
