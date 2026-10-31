import { commandes } from "./commandes";
import { langueCourante } from "./i18n";
import { gameStorage } from "./storage";

// « Comment jouer » (lot 29, refait à la retouche du lot I4 : un dialogue dans le jeu, charte rév. 7) : le contenu de l'aide, par appareil, et le souvenir de l'avoir vue. Logique pure ; le DOM est dans howtoUi.ts. Lot I4 : aucun texte ici,
// seulement des clés du catalogue (`aide.*`, catalogue.reglages.ts) ; une touche est écrite telle quelle (« Z », « R ») ou donnée par une clé `aide.touche.*`, une
// icône par `icone:<nom>`.

export type Device = "keyboard" | "touch";

/** Numéro de l'aide vue : on le monte si l'aide change assez pour mériter d'être remontrée à ceux qui l'ont déjà vue. */
export const HOWTO_VERSION = 1;
export const HOWTO_KEY = "cdj:howto";

type KV = Pick<Storage, "getItem" | "setItem">;

function safeStorage(): KV | null {
  try {
    return gameStorage();
  } catch {
    return null;
  }
}

/** Le joueur a-t-il déjà vu l'aide (dans cette version) ? Sans stockage : non, mais elle ne se rouvre qu'une fois par page. */
export function howtoSeen(storage: KV | null = safeStorage()): boolean {
  try {
    return Number(storage?.getItem(HOWTO_KEY)) >= HOWTO_VERSION;
  } catch {
    return false;
  }
}

export function markHowtoSeen(storage: KV | null = safeStorage()): void {
  try {
    storage?.setItem(HOWTO_KEY, String(HOWTO_VERSION));
  } catch {
    /* tant pis : l'aide se remontrera */
  }
}

/** Une commande : les touches (ou gestes) et ce qu'elles font. `keys` : un nom de touche littéral, une clé `aide.touche.*`, ou `icone:<nom>` ; `does` : une clé du catalogue. */
export interface Control {
  keys: string[];
  does: string;
}

/** Les noms des touches d'une action (selon la disposition du clavier), ceux que le joueur a CHOISIS (lot M2) : `commandes.ts`. */
const touches = (id: string): string[] => commandes.nomsTouches(id, langueCourante());
const bouton = (id: string): string => commandes.nomLiaison(id, langueCourante());

/** Au clavier : une ligne par action de course (les touches choisies, le texte du catalogue). Relue à chaque dessin. */
export function keyboardControls(): Control[] {
  return [
    { keys: [touches("accelerer")[0], touches("gauche")[0], touches("freiner")[0], touches("droite")[0]].filter((k): k is string => !!k), does: "aide.clavier.deplacer" },
    { keys: touches("freiner"), does: "aide.clavier.frein" },
    { keys: touches("point"), does: "aide.clavier.pointDeControle" },
    { keys: touches("recommencer"), does: "aide.clavier.depart" },
    { keys: touches("camera"), does: "aide.clavier.camera" },
    { keys: [...touches("pause"), "aide.touche.echap"], does: "aide.clavier.pause" },
    { keys: touches("classement"), does: "aide.clavier.classement" },
    { keys: touches("fantome"), does: "aide.clavier.fantome" },
    { keys: touches("son"), does: "aide.clavier.son" },
  ];
}

/** À la manette : le stick et la croix tournent (fixes) ; les autres boutons sont ceux choisis. Start (pause) est fixe. */
export function gamepadControls(): Control[] {
  return [
    { keys: ["aide.touche.stickGauche", "aide.touche.croix"], does: "aide.manette.tourner" },
    { keys: [bouton("accelerer")], does: "aide.manette.accelerer" },
    { keys: [bouton("freiner")], does: "aide.manette.freiner" },
    { keys: [bouton("point")], does: "aide.manette.pointDeControle" },
    { keys: [bouton("recommencer")], does: "aide.manette.depart" },
    { keys: ["Start"], does: "aide.manette.pause" },
    { keys: [bouton("camera")], does: "aide.manette.camera" },
  ];
}

/** Les trois points de l'aide de départ (clés du catalogue), selon l'appareil : tourner, gaz et frein, le but. Courts : l'aide tient dans un dialogue de téléphone en paysage. */
export const HOWTO_POINTS: Record<Device, readonly string[]> = {
  touch: ["aide.point.tourner.doigts", "aide.point.pedales.doigts", "aide.point.but"],
  keyboard: ["aide.point.tourner.clavier", "aide.point.pedales.clavier", "aide.point.but"],
};

/** Au clavier, sous les trois points : les touches des actions de course (pointer, recommencer, pause) ; le déplacement est dans les points. */
export function keyboardBasics(): Control[] {
  return [
    { keys: touches("point"), does: "aide.clavier.pointDeControle" },
    { keys: touches("recommencer"), does: "aide.clavier.depart" },
    { keys: [...touches("pause"), "aide.touche.echap"], does: "aide.clavier.pause" },
  ];
}
