import { lireSuite, type Suite } from "@cdj/profile";
import { bouton, el } from "@cdj/ui";

// « Jeu suivant du jour » côté jeu (lot K3 ; avant : `jeuSuivant.ts` de Track, de Jump et de Tower). La décision (`suiteDuJour`) et la lecture (`lireSuite`, un seul `GET /api/portail/jour`) sont dans
// `@cdj/profile` ; ce module compose le DOM avec le socle `@cdj/ui`. Rien n'est connu d'un autre jeu : le dossier et le nom viennent du serveur. Ce qui change d'un jeu à l'autre — les identifiants que les
// tests visent, quelques classes de l'habillage, la clé de la légende — est dit par `ConfigSuite`.

/**
 * Ce qui change d'un jeu à l'autre, **en arguments positionnels** (des noms de propriété ne se compressent pas : le premier chargement des jeux est mesuré à l'octet) :
 *   - `ids` : les identifiants de l'élément « jeu suivant », de la « journée parfaite » et du retour au portail (ceux que les tests visent) ;
 *   - `classes` : la classe de la légende et celle du bloc « journée parfaite », puis (facultative) une classe ajoutée aux deux boutons (`next-game` pour Track et Jump) ;
 *   - `cleLegende` : la clé de la légende « Il te reste aujourd'hui » (`arrivee.legendeSuite` pour Track et Jump).
 * `t` : le traducteur du jeu (méthode : un `t` à clés typées convient).
 */
export type TraducteurSuite = { t(cle: string, params?: Record<string, string | number>): string }["t"];
export type IdsSuite = readonly [suivant: string, parfaite: string, portail: string];
export type ClassesSuite = readonly [legende: string, parfaite: string, bouton?: string];

/** Ce que la suite montre : un lien vers le jeu suivant, ou la journée parfaite et le retour au portail. */
export function elementsDeSuite(suite: Suite, t: TraducteurSuite, ids: IdsSuite, classes: ClassesSuite, cleLegende = "arrivee.legendeSuite"): HTMLElement[] {
  const lien = (texte: string, ariaLabel: string, id: string): HTMLElement => {
    const b = bouton({ texte, ariaLabel, href: suite.href, variante: "marque", pleineLargeur: true });
    b.setAttribute("id", id);
    if (classes[2]) b.classList.add(classes[2]);
    return b;
  };
  if (suite.kind === "suivant") {
    return [el("span", { classe: classes[0], texte: t(cleLegende) }), lien(t("arrivee.jeuSuivant", { jeu: suite.nom }), t("arrivee.jeuSuivant.aria", { jeu: suite.nom }), ids[0])];
  }
  return [el("div", { classe: classes[1], attrs: { id: ids[1] }, texte: t("arrivee.parfaite") }), lien(t("barre.retour"), t("barre.retour.aria"), ids[2])];
}

/** Pose la suite dans son emplacement (vide et caché : aucune place), ou le vide. */
export function poserSuite(hote: HTMLElement, suite: Suite | null, ...config: [TraducteurSuite, IdsSuite, ClassesSuite, string?]): void {
  hote.hidden = suite === null;
  hote.replaceChildren(...(suite ? elementsDeSuite(suite, ...config) : []));
}

/** Lit la suite. Serveur injoignable, pas d'identité, ou jeu pas encore fini côté serveur : `null` (rien à proposer). Ne lève jamais. */
export async function chargerSuite(base: string | null, playerId: string | null, jeu: string): Promise<Suite | null> {
  if (!base || !playerId) return null;
  try {
    return await lireSuite(base, playerId, jeu);
  } catch {
    return null;
  }
}
