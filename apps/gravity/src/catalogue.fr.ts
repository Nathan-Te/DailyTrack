import { CATALOGUE_KIT_FR } from "@cdj/kit/jeu/catalogue";

// Le catalogue français de « Gravity » : le vocabulaire des écrans (le kit) et ce qui est propre au jeu. Les textes COMPLETS (accueil, aide détaillée, causes de mort illustrées) viennent au lot GR4 : ceux d'ici sont courts.
// **« À remplacer » reste dans `aide.point3` à dessein** : tant qu'il y est, le test des mentions légales (`apps/portail/test/mentions.test.ts`) traite le jeu comme un squelette. La mise à jour des mentions (les clés du
// navigateur du jeu) est un lot de la plateforme, à faire avant la publication (README du lot GR1) ; ce marqueur part avec elle.
export const CATALOGUE_FR = {
  ...CATALOGUE_KIT_FR,
  "page.titre": "Gravity — Du Jour",
  "scene.aria": "Le coureur et le niveau du jour : touche l'écran pour inverser la gravité",
  "theme.foret": "Forêt",
  "theme.usine": "Usine",
  "theme.glace": "Glace",
  "theme.nuit": "Nuit",
  "theme.neon": "Néon",
  "theme.foret.meca": "Courants d'air",
  "theme.usine.meca": "Tapis roulants",
  "theme.glace.meca": "Sols de glace",
  "theme.nuit.meca": "Blocs clignotants",
  "theme.neon.meca": "Blocs alternés",
  "accueil.phrase.foret": "Le sol, le plafond : même combat. Tant que tu touches quelque chose.",
  "accueil.phrase.usine": "Les tapis poussent plus vite : inverse avant qu'ils s'arrêtent.",
  "accueil.phrase.glace": "Impossible de s'appuyer sur la glace : inverse avant, ou après.",
  "accueil.phrase.nuit": "Les blocs s'allument et s'éteignent : traverse en rythme.",
  "accueil.phrase.neon": "Deux couleurs, une seule solide à la fois : suis le battement.",
  "aide.point1": "Un coureur sans fin : il court tout seul vers la droite. Le but : aller le plus loin possible, en ramassant pièces et gemmes.",
  "aide.point2": "Touche l'écran (ou Espace, A à la manette) : la gravité s'inverse, mais seulement quand tu touches une surface : sol, plafond ou plateforme. Pas d'inversion en l'air ni sur la glace.",
  "aide.point3": "À remplacer : les pièces, le multiplicateur et les bonus (texte complet au lot GR4).",
  "commandes.action.toucher": "Inverser la gravité",
  "hud.detail": "{m} m · ×{mult}",
  "mort.vide": "Tombé dans le vide",
  "mort.pique": "Touché par un pique",
  "mort.bord": "Rattrapé par le bord de l'écran",
  "mort.temps": "Temps écoulé : dix minutes !",
} as const;
