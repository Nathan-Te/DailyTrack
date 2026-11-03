import type { Suite } from "@cdj/profile";
import { el } from "@cdj/ui";
import { t } from "./i18n";

// Lot TP — « Jeu suivant du jour » dans Tower, comme à l'arrivée de Jump (`apps/jump/src/jeuSuivant.ts`). La décision (`suiteDuJour`) et la lecture (`lireSuite`, une requête vers
// `GET /api/portail/jour` avec l'identifiant en `X-Player-Id`) sont dans `@cdj/profile` ; **lot K3 : le DOM et la lecture sont ceux de `@cdj/kit/suite`, chargés à la demande** (quand la suite est lue : ni le
// jeu ni l'accueil ne les embarquent) ; il ne reste ici que ce qui est propre à Tower (les identifiants, l'emplacement). Rien n'est connu d'un autre jeu : le dossier et le nom viennent du serveur. Tower est
// lui-même un jeu de la liste (`jeu` = « tower ») : la suite est le premier AUTRE jeu du jour pas encore fini. **Module du jeu, chargé à la demande** (arrivée) ou après l'accueil dessiné (jamais dans le premier chargement).

/** Le code de Tower au registre du serveur. */
export const JEU_TOWER = "tower";

/** Pose la suite dans son emplacement (vide et caché : aucune place), ou le vide. Le lien est `#suite-jeu-suivant` ; la journée parfaite `#suite-parfaite` et le retour au portail `#suite-portail`. */
export function poserSuite(hote: HTMLElement, suite: Suite | null): void {
  hote.hidden = suite === null;
  hote.replaceChildren();
  if (suite) void import("@cdj/kit/suite").then((m) => hote.replaceChildren(...m.elementsDeSuite(suite, t, ["suite-jeu-suivant", "suite-parfaite", "suite-portail"], ["legende", "suite-du-jour__parfaite"], "suite.legende")));
}

/** Lit la suite. Serveur injoignable, pas d'identité, ou Tower pas encore fini côté serveur : `null` (rien à proposer). Ne lève jamais. */
export const chargerSuite = (base: string | null, playerId: string | null): Promise<Suite | null> => import("@cdj/kit/suite").then((m) => m.chargerSuite(base, playerId, JEU_TOWER));

/** L'emplacement de la suite : un bloc vide et caché. */
export const hoteSuite = (): HTMLElement => el("div", { classe: "suite-du-jour", attrs: { hidden: true, id: "suite-du-jour" } });
