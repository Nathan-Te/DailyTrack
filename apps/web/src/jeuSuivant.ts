import type { Suite } from "@cdj/profile";
import { t } from "./i18n";

// Lot I3 de la plateforme — « Jeu suivant du jour » à l'écran d'arrivée. Lot I4 : la décision (`suiteDuJour`) et la lecture (`lireSuite`, une requête vers `GET /api/portail/jour`) sont dans `@cdj/profile`
// (partagées avec DailyJump, tests compris). **Lot K3 : le DOM est celui de `@cdj/kit/suite`, chargé à la demande** (quand le serveur a donné la suite : jamais dans le premier chargement) ; il ne reste ici
// que ce qui est propre à l'arrivée de Track (les identifiants que les tests visent et l'habillage) : le bouton de marque « Jeu suivant du jour : Jump › » (un lien de 44 px), ou « Journée parfaite ! » et
// « ‹ DU JOUR ». Rien n'est connu d'un jeu dans l'autre : le dossier et le nom viennent du serveur.

/** Ce que l'arrivée montre de la suite : un lien vers le jeu suivant (`#finish-next-game`), ou la journée parfaite (`#finish-perfect`) et le retour au portail (`#finish-portail`). */
export const elementsDeSuite = (suite: Suite): Promise<HTMLElement[]> =>
  import("@cdj/kit/suite").then((m) => m.elementsDeSuite(suite, t, ["finish-next-game", "finish-perfect", "finish-portail"], ["arrivee__legende", "arrivee__parfaite", "next-game"]));
