import { PINBALL_GENERATOR_VERSION, PINBALL_SIM_VERSION, TICKS_PAR_SECONDE, VARIANTE, numeroPinball, themeDuJour, type Contenu } from "@cdj/pinball-sim";
import type { ContexteAujourdhui, DefinitionJeu } from "@cdj/kit/jeu/types";
import { BUILD_RESTRICTED } from "@cdj/kit/stockage";
import { ACTIONS } from "./commandes";
import { lireEssai } from "./essai";

// La définition de « Pinball » pour `brancherJeu` : sa simulation, son rendu, son aide. Tout le reste est le kit. **La table (générateur, seuils) et la scène sont chargées à la demande** : le premier chargement est
// l'accueil seul (ligne de budget `pinball.jsCss`). Le kit demande le contenu du jour dès l'accueil dessiné : c'est là que la scène se charge, bien avant le clic sur JOUER.
// **Lot PB2 : le rendu three.js (`corps.ts`, avec three.js) est lui aussi à la demande**, chargé au même moment que la scène — sauf si l'adresse impose la basse qualité (`?qualite=basse`) ou si le rendu de secours
// a déjà pris le relais dans cette session : le rendu à plat ne charge pas three.js. Un chargement qui échoue (réseau) laisse le rendu de secours.
type Scene = typeof import("./scene");
type Corps = typeof import("./corps");
let scene: Scene | null = null;
let corps: Corps | null = null;

/** Le panneau « Aujourd'hui » de l'accueil (lot PB5b) : le kit l'appelle quand le contenu du jour est lu ; **son code est à la demande** (`panneau.ts` : l'aperçu de la table dessiné à plat, la mission, les médailles), importé seulement alors. */
export const aujourdhui = (contenu: Contenu, hote: HTMLElement, ctx: ContexteAujourdhui): void => void import("./panneau").then((m) => m.remplirAujourdhui(contenu, hote, ctx));

export const DEFINITION: DefinitionJeu<Contenu> = {
  ticksParSeconde: TICKS_PAR_SECONDE,
  versions: { simVersion: PINBALL_SIM_VERSION, generatorVersion: PINBALL_GENERATOR_VERSION },
  // Trois commandes TENUES (le kit n'en signale que l'appui : la scène relit les touches pour le relâchement, `scene.ts`).
  actions: ACTIONS,
  themeDuJour,
  numero: numeroPinball,
  contenuDuJour: async (jour, base, theme) => {
    const basse = lireEssai(location.search, BUILD_RESTRICTED).qualite === "basse";
    const [niveau, s, c] = await Promise.all([import("./niveau"), import("./scene"), basse ? null : import("./corps").catch(() => null)]);
    scene = s;
    corps = c;
    return niveau.contenuDuJour(jour, base, theme);
  },
  // Les seuils sont écrits dans le contenu quand il est lu (`niveau.ts`) : ceux du fichier de jour figé, sinon ceux du robot (calculés en arrière-plan, terminés d'un trait à l'écran de fin s'il le faut).
  seuils: (c) => c.seuilsFiges!,
  medaille: (score, s) => VARIANTE.medaille(score, s),
  nouvellePartie: (contenu, hote, options) => scene!.nouvellePartiePinball(contenu, hote, options, scene!.rendFaible() ? null : corps),
  // Une partie d'essai (`?debug&tune`, `&reglages=`) n'est jamais classée ; en production ces options n'existent pas.
  classable: (adresse) => !lireEssai(adresse, BUILD_RESTRICTED).essai,
  // Lot PB2 : une vibration courte quand un batteur frappe la bille (le réglage « Vibration » du kit apparaît dans les Réglages).
  vibration: true,
  // Lot PBS1 : les effets sonores (`sons.ts`, procéduraux) — le réglage « Volume des effets » du kit apparaît dans les Réglages du jeu.
  effets: true,
  // **Pas de fantôme Diamant en partie** (lot PB4) : une bille fantôme sur la table serait illisible. Le robot donne les seuils des médailles et se regarde avec `?robot` (hors production), jamais autre chose.
  sansFantome: true,
  rediffusionDiamant: () => "",
  formatScore: (score, langue) => VARIANTE.formatScore(score, langue),
  scorePartage: (score, langue) => VARIANTE.scorePartage(score, langue),
  aide: ["aide.point1", "aide.point2", "aide.point3", "aide.point4", "aide.point5", "aide.point6", "aide.point7"],
  // Lot PB5b : le HUD est en surimpression (`hud.ts` : les deux bandes, la pause et le plein écran) ; la barre crème du kit n'est plus visible, son texte reste dans la page pour la pause.
  hud: "surimpression",
};
