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
    debut: ["rect-0", "mono-0", "coin-0", "domino-1", "barre3-0"],
  },
  // Chaque case vide est seule (un damier) : le domino ne tient nulle part, la partie finit tout de suite.
  blocage: {
    depart: ["X.X.X.X.", ".X.X.X.X", "X.X.X.X.", ".X.X.X.X", "X.X.X.X.", ".X.X.X.X", "X.X.X.X.", ".X.X.X.X"],
    debut: ["domino-0", "mono-0"],
  },
  // Le domino vertical posé en (7, 6) complète les lignes 6 et 7 : la grille est vide, +300.
  "plateau-vide": {
    depart: ["........", "........", "........", "........", "........", "........", "XXXXXXX.", "XXXXXXX."],
    debut: ["domino-1", "mono-0", "barre3-0"],
  },
};

/** Le contenu d'un scénario : la grille de départ, le début de la suite, puis la suite du jour 0. */
export function contenuDeScenario(nom: NomScenario): Contenu {
  const d = DEFINITIONS[nom];
  const jour0 = dailyBlocks(0);
  const debut = d.debut.map((n) => pieceParNom(n).id);
  return { jour: 0, g: jour0.g, suite: [...debut, ...jour0.suite].slice(0, jour0.suite.length), depart: grilleDepuis(d.depart), scenario: nom };
}
