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

export const KEYBOARD_CONTROLS: Control[] = [
  { keys: ["Z", "Q", "S", "D"], does: "aide.clavier.deplacer" },
  { keys: ["aide.touche.espace"], does: "aide.clavier.frein" },
  { keys: ["R"], does: "aide.clavier.pointDeControle" },
  { keys: ["aide.touche.entree"], does: "aide.clavier.depart" },
  { keys: ["C"], does: "aide.clavier.camera" },
  { keys: ["P", "aide.touche.echap"], does: "aide.clavier.pause" },
  { keys: ["L"], does: "aide.clavier.classement" },
  { keys: ["G"], does: "aide.clavier.fantome" },
  { keys: ["M"], does: "aide.clavier.son" },
];

export const GAMEPAD_CONTROLS: Control[] = [
  { keys: ["aide.touche.stickGauche", "aide.touche.croix"], does: "aide.manette.tourner" },
  { keys: ["RT", "A"], does: "aide.manette.accelerer" },
  { keys: ["LT", "B"], does: "aide.manette.freiner" },
  { keys: ["Y"], does: "aide.manette.pointDeControle" },
  { keys: ["X"], does: "aide.manette.depart" },
  { keys: ["Start"], does: "aide.manette.pause" },
  { keys: ["aide.touche.vue"], does: "aide.manette.camera" },
];

/** Les trois points de l'aide de départ (clés du catalogue), selon l'appareil : tourner, gaz et frein, le but. Courts : l'aide tient dans un dialogue de téléphone en paysage. */
export const HOWTO_POINTS: Record<Device, readonly string[]> = {
  touch: ["aide.point.tourner.doigts", "aide.point.pedales.doigts", "aide.point.but"],
  keyboard: ["aide.point.tourner.clavier", "aide.point.pedales.clavier", "aide.point.but"],
};

/** Au clavier, sous les trois points : les touches des actions de course (pointer, recommencer, pause) ; le déplacement est dans les points. */
export const KEYBOARD_BASICS: Control[] = [
  { keys: ["R"], does: "aide.clavier.pointDeControle" },
  { keys: ["aide.touche.entree"], does: "aide.clavier.depart" },
  { keys: ["P", "aide.touche.echap"], does: "aide.clavier.pause" },
];
