// Lot T1 — la suite fixe d'essai (`?scenario=essai`) : 40 pièces, les sept tétrominos dans un ordre fixe (cinq sacs de sept mélangés à la main, puis cinq pièces), et
// une plateforme fixe de 7 m. Ce n'est PAS le contenu du jour (`dailyTower`, lot T2) : aucun hasard, aucune date.
import type { PieceKind } from "../lab/interface";
import type { Scenario } from "../src/partie";

const SUITE = "TOILSZJ" + "LJSTOZI" + "ZIOJTSL" + "SLTZIJO" + "JZITLOS" + "OSTLJ";

export const SCENARIO_ESSAI: Scenario = {
  nom: "essai",
  pieces: [...SUITE] as PieceKind[],
  plateformeDemi8: 28,
};
