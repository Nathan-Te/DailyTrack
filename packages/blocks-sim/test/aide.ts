import { dailyBlocks, grilleDepuis, Partie, pieceParNom, PIECES, TAILLE_SERIE, type Contenu, type ContenuJouable, type Grille, type Piece } from "../src/index";

/**
 * Un contenu d'essai : les premières pièces données (par noms, trois par série, complétées par des dominos), puis des séries de dominos horizontaux, sur la grille de départ donnée (texte). Les séries sont IMPOSÉES (lot B8c : le tirage
 * adapté à la grille n'intervient pas), pour que les règles s'essaient sur des séries connues.
 */
export function contenuDEssai(debut: readonly string[], depart?: readonly string[]): Contenu {
  const base = dailyBlocks(1);
  const domino = pieceParNom("domino-0").id;
  const total = 667 * TAILLE_SERIE;
  const ids = [...debut.map((n) => pieceParNom(n).id), ...Array.from({ length: total }, () => domino)].slice(0, total);
  const imposees = Array.from({ length: 667 }, (_, s) => ids.slice(s * TAILLE_SERIE, (s + 1) * TAILLE_SERIE));
  const g: Grille | undefined = depart ? grilleDepuis(depart) : undefined;
  return { ...base, imposees, ...(g ? { depart: g } : {}) };
}

/** La pièce du catalogue qui a cette forme (art ASCII, `X` = case) : les tests ne dépendent pas du nom d'une orientation. */
export function pieceDeForme(art: readonly string[]): Piece {
  const rangees = art.map((r) => [...r].reduce((o, ch, c) => (ch === "X" ? o | (1 << c) : o), 0));
  const p = PIECES.find((x) => x.largeur === art[0]!.length && x.hauteur === art.length && x.rangees.join() === rangees.join());
  if (!p) throw new Error(`aucune pièce de forme ${art.join("/")}`);
  return p;
}

/** Une série à son arrivée : son rang, la grille qu'elle a vue, ses pièces. */
export interface SerieVue {
  rang: number;
  grille: Grille;
  pieces: readonly Piece[];
}

/** Rejoue des actions et rend chaque série à son arrivée (la première comprise) : ce que le tirage a donné, pour la grille du moment. */
export function seriesVues(contenu: ContenuJouable, actions: readonly number[]): SerieVue[] {
  const p = new Partie(contenu);
  const out: SerieVue[] = [];
  const noter = (): void => {
    out.push({ rang: p.serie, grille: p.grille, pieces: p.dernieresPieces.filter((x): x is Piece => x !== null) });
  };
  noter();
  for (const a of actions) {
    const avant = p.serie;
    if (p.jouerAction(a) === null) throw new Error("rejeu illégal");
    if (p.serie !== avant && !p.finie) noter();
  }
  return out;
}

/**
 * Les seuils que la CALIBRATION du lot B8c a mesurés (médiane sur 1 000 jours du score de chaque bot de référence, arrondie : `npm run calibrer:medailles`). Ce ne sont PAS les seuils du jeu — ceux-là sont la donnée `medailles.seuils` de la
 * fiche, que Nathan retouche sans toucher au code. Ils servent à repérer qu'un bot, le tirage ou la rampe a dérivé : le test des bots de référence les compare à une mesure fraîche. Refaire la calibration (et mettre à jour ceci) quand ils changent.
 */
export const CALIBRATION = { bronze: 850, silver: 1900, gold: 4600, author: 11_000 } as const;
