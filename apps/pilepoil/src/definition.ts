import { PILEPOIL_GENERATOR_VERSION, PILEPOIL_SIM_VERSION, TICKS_PAR_SECONDE, dailyPilepoil, numeroPilepoil, type Contenu } from "@cdj/pilepoil-sim";
import type { DefinitionJeuParty } from "@cdj/kit/jeu/types";

// La définition de « Pile poil » pour `brancherJeu` (lot PA2) : sa simulation, son rendu, son aide — ni thème, ni médailles, ni fantôme : le kit complète (`DefinitionJeuParty`). Tout le reste est le kit.
// **Premier chargement** : ce fichier et le tirage du jour seulement ; la scène (rendu, sons, entrées) est chargée au toucher de JOUER (`chargerPartie`, morceau `scene-`), le panneau `?debug&tune` à la demande (`tune-`).

/** Le contenu d'un jour : **sa graine et les dix jauges qu'on en tire** (`dailyPilepoil`) — un jeu Party n'a ni générateur de niveaux ni fichier de jour figé. */
const contenuDuJour = async (jour: number): Promise<Contenu> => dailyPilepoil(jour, PILEPOIL_GENERATOR_VERSION);

/** `?debug&tune` (jamais en production, règle R9) : les réglages de la maquette en curseurs ; la partie n'est alors jamais classée (`classable`). */
const reglageEnCours = (adresse: string): boolean => {
  if (import.meta.env.VITE_PRODUCTION === "1") return false;
  const q = new URLSearchParams(adresse);
  return q.has("debug") && q.has("tune");
};

let scene: typeof import("./scene") | null = null;

export const DEFINITION: DefinitionJeuParty<Contenu> = {
  ticksParSeconde: TICKS_PAR_SECONDE,
  versions: { simVersion: PILEPOIL_SIM_VERSION, generatorVersion: PILEPOIL_GENERATOR_VERSION },
  // **Une seule commande** : toucher l'écran (la scène), Espace ou Entrée, le bouton A de la manette. (Entrée est aussi « Recommencer » pour le kit : l'action du jeu passe devant en partie — README du lot PA2.)
  actions: [{ id: "arreter", clavier: ["Space", "Enter"], manette: "b0" }],
  numero: numeroPilepoil,
  contenuDuJour,
  chargerPartie: () =>
    import("./scene").then((m) => {
      scene = m;
    }),
  nouvellePartie: (contenu, hote, o) => scene!.nouvellePartiePilepoil(contenu, hote, o, reglageEnCours(typeof location === "undefined" ? "" : location.search)),
  hud: "surimpression",
  vibration: true,
  effets: true,
  classable: (adresse) => !reglageEnCours(adresse),
  // Le score : les points (le nombre au format de la langue, par le catalogue) ; la ligne à partager ajoute les « pile » de la partie.
  formatScore: (score, _langue, t) => t("score.valeur", { n: score[0] ?? 0 }),
  scorePartage: (score, _langue, t) => t("partage.score", { n: score[0] ?? 0 }),
  extrasPartage: (score, _langue, t) => ((score[1] ?? 0) > 0 ? [t("partage.piles", { n: score[1] ?? 0 })] : []),
  aide: ["aide.point1", "aide.point2", "aide.point3"],
};
