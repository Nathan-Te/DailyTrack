// Retouche 38b — les textes de la vitrine pour les paliers et leurs pas (outil interne, en français, exempté des catalogues). Le jeu, lui, dira
// « Qualité graphique » par ses catalogues (fr + en) au lot de mise en œuvre.
import type { Famille, PasId } from "../scene/paliers";

export interface TextePas {
  titre: string;
  detail: string;
  /** Touche une règle de la charte « Cartouches » (flou, transparence, dégradé) : Nathan décide pour la scène 3D. */
  charte?: string;
}

export const TEXTES_PAS: Record<PasId, TextePas> = {
  geometrie: { titre: "Géométrie", detail: "Chanfreins fins sur les portiques, virages et arche plus ronds, pièces qui donnent l'échelle : boulons, haubans, câbles, banderoles, pneus empilés, drapeaux." },
  variete: { titre: "Variété", detail: "Chaque instance d'un même élément varie un peu : teinte, usure, orientation, taille ; bandes de rebord inégales." },
  matiere: { titre: "Matière", detail: "Textures dessinées plus fines avec relief simulé (cartes de normales calculées au chargement), rugosité variable, traces de pneus et marquages au sol." },
  reflets: { titre: "Reflets", detail: "Carte d'environnement calculée à partir du ciel du thème : les matériaux brillants et la voiture reflètent la scène." },
  ombres: { titre: "Ombres nettes et loin", detail: "Carte d'ombres 2048 posée devant la voiture (120 m au lieu de 84 m, plus fine), le décor projette aussi." },
  occlusion: { titre: "Occlusion ambiante", detail: "Occlusion calculée à l'écran (GTAO) : les creux, les pieds de mur et les recoins s'assombrissent." },
  brume: { titre: "Brume de profondeur", detail: "Brouillard par thème qui s'épaissit en contrebas et se teinte du soleil quand on le regarde.", charte: "un dégradé (de la lumière, pas de l'interface)" },
  nuages: { titre: "Ciel et nuages", detail: "Un dôme de ciel dessiné au chargement : dégradé, lueur du soleil, nuages par thème qui dérivent." },
  drapeaux: { titre: "Drapeaux qui flottent", detail: "Les drapeaux ondulent (déformés sur la carte graphique, un seul appel de rendu)." },
  foule: { titre: "Foule", detail: "Des spectateurs simplifiés dans la tribune du départ, qui sautillent (instances : un appel de rendu)." },
  ecrans: { titre: "Panneaux lumineux", detail: "Écrans à diodes qui font défiler les sponsors, chronomètre qui tourne : lisibles de jour comme de nuit." },
  particules: { titre: "Particules d'ambiance", detail: "Poussière (Rallye, Canyon), neige (Banquise, Col), lucioles (Nuit), pollen (Campagne), confettis (Stade), poussière de ville.", charte: "petits points translucides" },
  etalonnage: { titre: "Étalonnage", detail: "Couleurs travaillées par thème (contraste, saturation, teinte des ombres et des lumières)." },
  anticrenelage: { titre: "Anticrénelage", detail: "SMAA en plus du MSAA du jeu : les câbles fins, les textures et les bords lointains scintillent moins." },
  halo: { titre: "Halo des lumières", detail: "Les lumières fortes débordent (surtout la Nuit : lampes, néons, écrans).", charte: "un flou lumineux" },
};

export const TITRES_FAMILLES: Record<Famille, string> = {
  finition: "Palier 2 — finition (même chemin de rendu)",
  lumiere: "Palier 3 — lumière",
  vie: "Palier 3 — vie",
  post: "Palier 3 — post-traitement (une passe plein écran chacun)",
};
