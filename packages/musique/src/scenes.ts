import { SCENES_FICHES } from "./fiches.generated";
import type { JeuMusique } from "./types";

// Les scènes de chaque jeu (lot « musique ») : **où un morceau peut passer** — `menu` (l'accueil) et un thème de niveaux par `theme:<code>`. C'est la liste que la vérification de
// `musique/musiques.json` connaît : un morceau qui nomme une scène inconnue (une faute de frappe) est refusé au lieu de ne jamais jouer.
//
// **Ajouter un thème ou un jeu** : une ligne ici (le code du thème tel que le jeu l'annonce au lecteur : `musique.scene("theme:<code>")`). Le test de chaque jeu compare cette liste à ses
// thèmes (`apps/web|tower/test/musiqueScenes.test.ts` et `packages/musique/test/premierChargement.test.ts` (Jump)) : un thème ajouté dans un jeu sans ligne ici fait échouer ce test — rien ne reste silencieux. Aucun import d'un jeu ici : les jeux ne
// s'importent jamais, et ce fichier n'est lu que par Node (la commande, les tests), jamais par un jeu.

/** Le format d'une scène : un mot, ou un mot, deux-points et un code (`menu`, `theme:nuit`). */
export const FORMAT_SCENE = /^[a-z0-9]+(:[a-z0-9-]+)?$/;

export const SCENES: Readonly<Record<JeuMusique, readonly string[]>> = {
  track: ["menu", "theme:stade", "theme:rallye", "theme:banquise", "theme:nuit", "theme:campagne", "theme:canyon", "theme:col", "theme:ville"],
  jump: ["menu", "theme:foret", "theme:usine", "theme:glace", "theme:nuit", "theme:neon"],
  // Lot K1 : les scènes de Tower sont celles de sa fiche (`musique.scenes` de `config/jeux/tower.json` : « menu » puis un thème par thème du jeu ; le test de Tower les compare à `THEMES_TOWER`).
  ...SCENES_FICHES,
  portail: ["menu"],
};

/** La scène est connue d'au moins un des jeux donnés. */
export function sceneConnue(scene: string, jeux: readonly JeuMusique[]): boolean {
  return jeux.some((j) => SCENES[j].includes(scene));
}
