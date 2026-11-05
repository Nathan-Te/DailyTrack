import { dailyBlocks, type Contenu } from "./generateur";
import { grilleDepuis } from "./grille";
import { type NomScenario } from "./nomsScenarios";
import { pieceParNom } from "./pieces";

// Les SCÉNARIOS D'ESSAI (seed § 9) : une grille de départ et le début de la suite fixés à la main, puis la suite du jour 0 pour continuer à jouer. **Locaux, jamais classés** : leur rediffusion nomme le
// scénario (`{ scenario }` dans l'enveloppe) et non un jour ; le serveur la refuse (`contenu_different`), et le jeu ne l'envoie pas (la page se met en archive, `apps/blocks/src/essai.ts`).

interface Definition {
  depart: readonly string[];
  debut: readonly string[];
}
const DEFINITIONS: Record<NomScenario, Definition> = {
  // Une pose du rectangle 3 × 2 en (5, 6) remplit les lignes 6 et 7 ET la colonne 7 : 2 lignes + 1 colonne d'un coup (n = 3), sans vider la grille (les deux cases de la colonne 0 restent).
  "presque-plein": {
    depart: ["X......X", "X......X", ".......X", ".......X", ".......X", ".......X", "XXXXX...", "XXXXX..."],
    debut: ["rect-0", "domino-0", "coin-0", "domino-1", "barre3-0"],
  },
  // Chaque case vide est seule (un damier) : le domino ne tient nulle part, la partie finit tout de suite.
  blocage: {
    depart: ["X.X.X.X.", ".X.X.X.X", "X.X.X.X.", ".X.X.X.X", "X.X.X.X.", ".X.X.X.X", "X.X.X.X.", ".X.X.X.X"],
    debut: ["domino-0", "domino-0"],
  },
  // Le domino vertical posé en (7, 6) complète les lignes 6 et 7 : la grille est vide, +300.
  "plateau-vide": {
    depart: ["........", "........", "........", "........", "........", "........", "XXXXXXX.", "XXXXXXX."],
    debut: ["domino-1", "domino-0", "barre3-0"],
  },
  // Quatre poses de suite effacent chacune une ligne : le domino horizontal posé en (6, 4), (6, 5), (6, 6) puis (6, 7) achève les lignes 4 à 7. Le combo monte de 1 à 4 (effacements de 10, 20, 30 puis 40) ; une case de la
  // ligne 0 reste, la grille n'est jamais vide (pas de +300 qui masquerait la montée des demi-tons).
  combo: {
    depart: ["X.......", "........", "........", "........", "XXXXXX..", "XXXXXX..", "XXXXXX..", "XXXXXX.."],
    debut: ["domino-0", "domino-0", "domino-0", "domino-0", "barre3-0"],
  },
  // Lot B7 — la pièce suivante à sa vraie taille : une grille vide et une suite qui alterne petites et grosses pièces (domino, carré 3 × 3, coin, barre de 5, carré 2 × 2, grand L, puis la barre de 5 debout, le grand T…),
  // pour voir à chaque pose que la suivante garde la même échelle (60 % des cases) quelle que soit sa taille. On pose sans contrainte : la grille a toute la place.
  suivantes: {
    depart: ["........", "........", "........", "........", "........", "........", "........", "........"],
    debut: ["domino-0", "carre3-0", "coin-0", "barre5-0", "carre2-0", "grandl-0", "domino-1", "barre5-1", "coin-2", "grandt-0", "barre4-0", "carre3-0"],
  },
};

/** Le contenu d'un scénario : la grille de départ, le début de la suite, puis la suite du jour 0. */
export function contenuDeScenario(nom: NomScenario): Contenu {
  const d = DEFINITIONS[nom];
  const jour0 = dailyBlocks(0);
  const debut = d.debut.map((n) => pieceParNom(n).id);
  return { jour: 0, g: jour0.g, suite: [...debut, ...jour0.suite].slice(0, jour0.suite.length), depart: grilleDepuis(d.depart), scenario: nom };
}
