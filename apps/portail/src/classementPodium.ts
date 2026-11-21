import type { Classement, LigneClassement } from "./classementDonnees";
import { VUE_CUMUL } from "./classementVues";

// Lot U2 (charte rév. 19, § 9) — la logique pure du podium de `/classement/` : qui monte dessus, ce qui reste pour la liste, la taille des photos. Sans DOM ni réseau, testée dans `test/classementPodium.test.ts`.

/** Les photos de la page (px), la charte § 9 : le podium (1er, 2e et 3e), les lignes, le panneau de droite. Sur téléphone, le podium passe à 84 / 68 px et les lignes à 44 px (la feuille de style). */
export const PHOTOS = { premier: 112, suivants: 92, ligne: 48, feuille: 88 } as const;
export const EMBLEME_LIGNE = 22;
export const EMBLEME_GROUPE = 48;

/** Combien de marches : trois, toujours (lot U6 : le podium est là même avec un ou deux classés, les marches vides sont libres). */
export const MARCHES = 3;

/** Une ligne a un résultat pour la vue : un temps (ou un score à la hauteur) ; un joueur du cumul qui n'a pas tout fini n'en a pas. */
const aUnResultat = (l: LigneClassement): boolean => l.score != null || l.tempsMs !== null;

/**
 * Les lignes du podium, dans l'ordre du classement (1er, 2e, 3e) : **de zéro à trois**. Lot U6 : le podium est toujours affiché, les marches sans personne sont libres (« Place à prendre »). Une ligne monte sur le
 * podium si elle a un résultat dans la vue et, au cumul, si elle a tout fini (sinon elle est sous « Un jeu sur deux » : ni temps, ni place sur un podium). Le podium ne change aucun rang : il montre le haut de `top`,
 * tel que le serveur le rend.
 */
export function lignesDuPodium(c: Pick<Classement, "top" | "vue">): LigneClassement[] {
  const haut: LigneClassement[] = [];
  for (const l of c.top) {
    if (haut.length === MARCHES || !aUnResultat(l) || (c.vue === VUE_CUMUL && !l.complet)) break;
    haut.push(l);
  }
  return haut;
}

/** Ce que la liste montre sous le podium : le reste du haut. Le classement rendu garde `moi`, `classes` et le reste. */
export function resteDuHaut<T extends Pick<Classement, "top" | "vue">>(c: T): T {
  const n = lignesDuPodium(c).length;
  return n === 0 ? c : { ...c, top: c.top.slice(n) };
}

/** La photo d'une place du podium (`place` : 1, 2 ou 3 — sa position, pas son rang) : 112 px pour la première, 92 px pour les deux suivantes. */
export const photoDePlace = (place: number): 112 | 92 => (place === 1 ? PHOTOS.premier : PHOTOS.suivants);

/** Le groupe d'une ligne, quand le serveur le dit (`groupe` : nom et image de son emblème) ; sinon `null` — aucun emblème n'est inventé. */
export function groupeDeLigne(l: Pick<LigneClassement, "groupe">): { id: string; nom: string; avatar?: string } | null {
  const g = l.groupe;
  return g && typeof g.id === "string" && typeof g.nom === "string" ? g : null;
}

/** Les colonnes de jeu d'une ligne (ordinateur) : une par jeu du cumul, sinon celle du jeu ouvert ; 0 à 6 (`data-jeux` de la feuille). */
export const nombreDeColonnes = (n: number): number => Math.min(6, Math.max(0, n));

/** Les jeux d'un cumul : ceux qui comptent dans le temps cumulé — jamais un jeu à la hauteur ou aux points (lot TP), jamais un jeu d'arcade (lot A3 : il garde sa vue, hors du cumul). */
export const jeuxDuCumul = <J extends { unite?: string; categorie?: string }>(jeux: readonly J[]): J[] => jeux.filter((j) => !j.unite && j.categorie !== "arcade" && j.categorie !== "party");
