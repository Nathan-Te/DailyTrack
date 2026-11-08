import { TAILLE_SERIE, type ReglageSaisi } from "./constantes";
import { dailyBlocks, type Contenu } from "./generateur";
import { grilleDepuis } from "./grille";
import { type NomScenario } from "./nomsScenarios";
import { pieceParNom } from "./pieces";

// Les SCÉNARIOS D'ESSAI (seed § 9) : une grille de départ et les premières séries (de trois pièces) imposées à la main, puis le tirage adapté à la grille du jour 0 (lot B8c) pour continuer à jouer — sauf `ordre` et `blocage`, qui n'ont que leur série. **Locaux, jamais classés** : leur rediffusion nomme le
// scénario (`{ scenario }` dans l'enveloppe) et non un jour ; le serveur la refuse (`contenu_different`), et le jeu ne l'envoie pas (la page se met en archive, `apps/blocks/src/essai.ts`).

interface Definition {
  depart: readonly string[];
  /** Les pièces imposées, trois par série. */
  debut: readonly string[];
  /** Un réglage du tirage propre au scénario (les séries tirées ensuite). */
  reglage?: ReglageSaisi;
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
  // Lot B8c — LE COUP DE POUCE. Deux lignes (2 et 5) attendent chacune une barre de 3 ; aucune série n'est imposée : la première série est TIRÉE pour cette grille, avec le coup de pouce exigé à 100 % (un jour ordinaire ne l'exige qu'environ
  // une fois sur deux). Elle contient donc toujours une pièce qui complète une ligne (`scenarios.test.ts`).
  "coup-de-pouce": {
    depart: ["........", "........", "XXXXX...", "X.X.....", "X.XX....", "XXXXX...", "X.X.....", "........"],
    debut: [],
    reglage: { pouce: { pct: 100, pctFin: 100 } },
  },
};

/** Le contenu d'un scénario : la grille de départ, les séries imposées, puis le tirage du jour 0, adapté à la grille. */
export function contenuDeScenario(nom: NomScenario): Contenu {
  const d = DEFINITIONS[nom];
  const jour0 = dailyBlocks(0);
  const ids = d.debut.map((n) => pieceParNom(n).id);
  const imposees = Array.from({ length: Math.floor(ids.length / TAILLE_SERIE) }, (_, s) => ids.slice(s * TAILLE_SERIE, (s + 1) * TAILLE_SERIE));
  return { jour: 0, g: jour0.g, graine: jour0.graine, ...(imposees.length > 0 ? { imposees } : {}), depart: grilleDepuis(d.depart), scenario: nom, ...(d.reglage ? { reglage: d.reglage } : {}) };
}
