import { dailyBlocks, grilleDepuis, pieceParNom, type Contenu, type Grille } from "../src/index";

/** Un contenu d'essai : le début de suite donné (par noms de pièces), puis des monominos, sur la grille de départ donnée (texte). */
export function contenuDEssai(debut: readonly string[], depart?: readonly string[]): Contenu {
  const base = dailyBlocks(1);
  const mono = pieceParNom("mono-0").id;
  const suite = [...debut.map((n) => pieceParNom(n).id), ...Array.from({ length: base.suite.length }, () => mono)].slice(0, base.suite.length);
  const g: Grille | undefined = depart ? grilleDepuis(depart) : undefined;
  return { ...base, suite, ...(g ? { depart: g } : {}) };
}
