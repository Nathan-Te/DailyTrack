import { lireSuite, type Suite } from "@cdj/profile";
import { bouton, el } from "@cdj/ui";
import { t } from "./i18n";

// Lot TP — « Jeu suivant du jour » dans Tower, comme à l'arrivée de Jump (`apps/jump/src/jeuSuivant.ts`). La décision (`suiteDuJour`) et la lecture (`lireSuite`, une requête vers
// `GET /api/portail/jour` avec l'identifiant en `X-Player-Id`) sont dans `@cdj/profile` ; il ne reste ici que le DOM, composé avec le socle `@cdj/ui`. Rien n'est connu d'un autre jeu :
// le dossier et le nom viennent du serveur. Tower est lui-même un jeu de la liste (`jeu` = « tower ») : la suite est le premier AUTRE jeu du jour pas encore fini. **Module du jeu, chargé à la
// demande** (arrivée) ou après l'accueil dessiné (jamais dans le premier chargement).

/** Le code de Tower au registre du serveur. */
export const JEU_TOWER = "tower";

/** Ce que la suite montre : un lien vers le jeu suivant (`#suite-jeu-suivant`), ou la journée parfaite (`#suite-parfaite`) et le retour au portail (`#suite-portail`). */
export function elementsDeSuite(suite: Suite): HTMLElement[] {
  if (suite.kind === "suivant") {
    const lien = bouton({ texte: t("arrivee.jeuSuivant", { jeu: suite.nom }), ariaLabel: t("arrivee.jeuSuivant.aria", { jeu: suite.nom }), href: suite.href, variante: "marque", pleineLargeur: true });
    lien.id = "suite-jeu-suivant";
    return [el("span", { classe: "legende", texte: t("suite.legende") }), lien];
  }
  const retour = bouton({ texte: t("barre.retour"), ariaLabel: t("barre.retour.aria"), href: suite.href, variante: "marque", pleineLargeur: true });
  retour.id = "suite-portail";
  return [el("div", { classe: "suite-du-jour__parfaite", attrs: { id: "suite-parfaite" }, texte: t("arrivee.parfaite") }), retour];
}

/** Pose la suite dans son emplacement (vide et caché : aucune place), ou le vide. */
export function poserSuite(hote: HTMLElement, suite: Suite | null): void {
  hote.hidden = suite === null;
  hote.replaceChildren(...(suite ? elementsDeSuite(suite) : []));
}

/** Lit la suite. Serveur injoignable, pas d'identité, ou Tower pas encore fini côté serveur : `null` (rien à proposer). Ne lève jamais. */
export async function chargerSuite(base: string | null, playerId: string | null): Promise<Suite | null> {
  if (!base || !playerId) return null;
  try {
    return await lireSuite(base, playerId, JEU_TOWER);
  } catch {
    return null;
  }
}

/** L'emplacement de la suite : un bloc vide et caché. */
export const hoteSuite = (): HTMLElement => el("div", { classe: "suite-du-jour", attrs: { hidden: true, id: "suite-du-jour" } });
