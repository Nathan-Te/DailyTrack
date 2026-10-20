import { gameStorage } from "./storage";

// « Comment jouer » (lot 29) : le contenu de l'aide, par appareil, et le souvenir de l'avoir vue. Logique pure ; le DOM est dans howtoUi.ts. Lot I4 : aucun texte ici,
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

export const TOUCH_CONTROLS: Control[] = [
  { keys: ["aide.touche.moitieGauche"], does: "aide.doigts.tourner" },
  { keys: ["aide.touche.moitieDroite"], does: "aide.doigts.pedales" },
  { keys: ["icone:drapeau"], does: "aide.doigts.pointDeControle" },
  { keys: ["icone:recommencer"], does: "aide.doigts.depart" },
  { keys: ["icone:camera"], does: "aide.doigts.camera" },
  { keys: ["aide.touche.pause"], does: "aide.doigts.pause" },
];

export interface Tip {
  /** Une icône du socle (`drapeau`, `flamme`) ou de Track (`recommencer`, `fantome`, `classement`, `calendrier`). */
  icon: string;
  /** Clés du catalogue. */
  heading: string;
  body: string;
}

/** Les idées à retenir, quel que soit l'appareil. */
export const TIPS: Tip[] = [
  { icon: "drapeau", heading: "aide.conseil.but.titre", body: "aide.conseil.but.texte" },
  { icon: "recommencer", heading: "aide.conseil.controle.titre", body: "aide.conseil.controle.texte" },
  { icon: "flamme", heading: "aide.conseil.air.titre", body: "aide.conseil.air.texte" },
  { icon: "classement", heading: "aide.conseil.medailles.titre", body: "aide.conseil.medailles.texte" },
  { icon: "fantome", heading: "aide.conseil.fantomes.titre", body: "aide.conseil.fantomes.texte" },
  { icon: "calendrier", heading: "aide.conseil.salon.titre", body: "aide.conseil.salon.texte" },
];
