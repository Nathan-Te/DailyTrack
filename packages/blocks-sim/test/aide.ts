import { dailyBlocks, grilleDepuis, pieceParNom, PIECES, type Contenu, type Grille, type Piece } from "../src/index";

/** Un contenu d'essai : le début de suite donné (par noms de pièces), puis des dominos horizontaux, sur la grille de départ donnée (texte). */
export function contenuDEssai(debut: readonly string[], depart?: readonly string[]): Contenu {
  const base = dailyBlocks(1);
  const domino = pieceParNom("domino-0").id;
  const suite = [...debut.map((n) => pieceParNom(n).id), ...Array.from({ length: base.suite.length }, () => domino)].slice(0, base.suite.length);
  const g: Grille | undefined = depart ? grilleDepuis(depart) : undefined;
  return { ...base, suite, ...(g ? { depart: g } : {}) };
}

/** La pièce du catalogue qui a cette forme (art ASCII, `X` = case) : les tests ne dépendent pas du nom d'une orientation. */
export function pieceDeForme(art: readonly string[]): Piece {
  const rangees = art.map((r) => [...r].reduce((o, ch, c) => (ch === "X" ? o | (1 << c) : o), 0));
  const p = PIECES.find((x) => x.largeur === art[0]!.length && x.hauteur === art.length && x.rangees.join() === rangees.join());
  if (!p) throw new Error(`aucune pièce de forme ${art.join("/")}`);
  return p;
}
