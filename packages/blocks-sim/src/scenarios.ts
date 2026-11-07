import { dailyBlocks, type Contenu } from "./generateur";
import { grilleDepuis } from "./grille";
import { type NomScenario } from "./nomsScenarios";
import { pieceParNom } from "./pieces";

// Les SCÉNARIOS D'ESSAI (seed § 9) : une grille de départ et le début de la suite (par séries de trois pièces) fixés à la main, puis la suite du jour 0 pour continuer à jouer. **Locaux, jamais classés** : leur rediffusion nomme le
// scénario (`{ scenario }` dans l'enveloppe) et non un jour ; le serveur la refuse (`contenu_different`), et le jeu ne l'envoie pas (la page se met en archive, `apps/blocks/src/essai.ts`).

interface Definition {
  depart: readonly string[];
  debut: readonly string[];
}
const DEFINITIONS: Record<NomScenario, Definition> = {
  // Une pose du rectangle 3 × 2 en (5, 6) remplit les lignes 6 et 7 ET la colonne 7 : 2 lignes + 1 colonne d'un coup (n = 3), sans vider la grille (les deux cases de la colonne 0 restent).
  "presque-plein": {
    depart: ["X......X", "X......X", ".......X", ".......X", ".......X", ".......X", "XXXXX...", "XXXXX..."],
    debut: ["rect-0", "domino-0", "coin-0", "domino-1", "barre3-0", "domino-0"],
  },
  // Chaque case vide est seule (un damier) : aucune des trois pièces ne tient nulle part, la partie finit tout de suite (les trois pièces sont grisées).
  blocage: {
    depart: ["X.X.X.X.", ".X.X.X.X", "X.X.X.X.", ".X.X.X.X", "X.X.X.X.", ".X.X.X.X", "X.X.X.X.", ".X.X.X.X"],
    debut: ["domino-0", "domino-1", "barre3-0"],
  },
  // Le domino vertical posé en (7, 6) complète les lignes 6 et 7 : la grille est vide, +300.
  "plateau-vide": {
    depart: ["........", "........", "........", "........", "........", "........", "XXXXXXX.", "XXXXXXX."],
    debut: ["domino-1", "domino-0", "barre3-0"],
  },
  // Quatre poses de suite effacent chacune une ligne : le domino horizontal posé en (6, 4), (6, 5), (6, 6) puis (6, 7) achève les lignes 4 à 7 (trois dominos dans la première série, un dans la suivante). Le combo monte de 1 à 4
  // (effacements de 10, 20, 30 puis 40) ; une case de la ligne 0 reste, la grille n'est jamais vide (pas de +300 qui masquerait la montée des demi-tons).
  combo: {
    depart: ["X.......", "........", "........", "........", "XXXXXX..", "XXXXXX..", "XXXXXX..", "XXXXXX.."],
    debut: ["domino-0", "domino-0", "domino-0", "domino-0", "barre3-0", "barre3-0"],
  },
  // Lot B8 — L'ORDRE DÉCIDE DE TOUT. Un plateau de milieu de partie (des trous isolés où rien ne tient, et une poche de 2 × 2 en bas à gauche) et une série de trois pièces : le coin, le domino debout, le carré 2 × 2. Un seul des six ordres
  // laisse une place à chacune (`scenarios.test.ts` le prouve en essayant toutes les poses) : le carré d'abord (il remplit la poche et efface la ligne 7), puis le domino, puis le coin ; dans toute autre combinaison, la troisième pièce
  // est grisée et la partie finit. Dans le bon ordre, deux lignes s'effacent.
  ordre: {
    depart: ["XX.X.XX.", "X.XXXXXX", ".XXXXXXX", "XXX.XX.X", "X.XXXXXX", "XXXXX.XX", "..XXXXX.", "..XXXXXX"],
    debut: ["coin-1", "domino-1", "carre2-0"],
  },
};

/** Le contenu d'un scénario : la grille de départ, le début de la suite, puis la suite du jour 0. */
export function contenuDeScenario(nom: NomScenario): Contenu {
  const d = DEFINITIONS[nom];
  const jour0 = dailyBlocks(0);
  const debut = d.debut.map((n) => pieceParNom(n).id);
  return { jour: 0, g: jour0.g, suite: [...debut, ...jour0.suite].slice(0, jour0.suite.length), depart: grilleDepuis(d.depart), scenario: nom };
}
