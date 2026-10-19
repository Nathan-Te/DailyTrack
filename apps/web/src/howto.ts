import { gameStorage } from "./storage";

// « Comment jouer » (lot 29) : le texte de l'aide, par appareil, et le souvenir de l'avoir vue. Logique pure ; le DOM est dans howtoUi.ts.

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

/** Une commande : les touches (ou gestes) et ce qu'elles font. */
export interface Control {
  keys: string[];
  does: string;
}

export const KEYBOARD_CONTROLS: Control[] = [
  { keys: ["Z", "Q", "S", "D"], does: "Accélérer, tourner à gauche, freiner / reculer, tourner à droite (aussi W A S D et les flèches)" },
  { keys: ["Espace"], does: "Freiner — en tournant, la voiture dérape" },
  { keys: ["R"], does: "Retour au dernier point de contrôle (le chrono continue)" },
  { keys: ["Entrée"], does: "Recommencer depuis le départ" },
  { keys: ["C"], does: "Changer de caméra (proche, loin, capot)" },
  { keys: ["P", "Échap"], does: "Pause et menu" },
  { keys: ["L"], does: "Montrer ou replier le classement" },
  { keys: ["G"], does: "Changer de fantôme" },
  { keys: ["M"], does: "Couper ou remettre le son" },
];

export const GAMEPAD_CONTROLS: Control[] = [
  { keys: ["Stick gauche", "Croix"], does: "Tourner" },
  { keys: ["RT", "A"], does: "Accélérer" },
  { keys: ["LT", "B"], does: "Freiner / reculer" },
  { keys: ["Y"], does: "Retour au dernier point de contrôle" },
  { keys: ["X"], does: "Recommencer depuis le départ" },
  { keys: ["Start"], does: "Pause et menu" },
  { keys: ["Vue"], does: "Changer de caméra" },
];

export const TOUCH_CONTROLS: Control[] = [
  { keys: ["Moitié gauche"], does: "Glisse le pouce pour tourner (ou touche ◀ ▶ selon tes réglages)" },
  { keys: ["Moitié droite"], does: "Gaz et frein : deux pédales (ou accélérateur automatique, dans les réglages)" },
  { keys: ["↺"], does: "Retour au dernier point de contrôle" },
  { keys: ["⟲"], does: "Recommencer depuis le départ" },
  { keys: ["🎥"], does: "Changer de caméra" },
  { keys: ["⏸"], does: "Pause et menu" },
];

export interface Tip {
  icon: string;
  title: string;
  text: string;
}

/** Les idées à retenir, quel que soit l'appareil. */
export const TIPS: Tip[] = [
  { icon: "🏁", title: "Le but", text: "Chaque jour un circuit, le même pour tout le monde. Passe tous les points de contrôle et franchis la ligne le plus vite possible : ton meilleur temps compte, tu recommences autant que tu veux." },
  { icon: "↺", title: "Points de contrôle", text: "Tu es tombé ou raté un virage ? Reprends au dernier point de contrôle : le chrono, lui, continue de tourner. Le temps de chaque point est comparé à ton record." },
  { icon: "🛬", title: "En l'air", text: "Le frein, en l'air, fige la voiture : elle garde son angle et se pose sans rebondir. Arrive à plat, tu gardes ta vitesse ; de travers, tu en perds." },
  { icon: "🏅", title: "Médailles", text: "Bronze, Argent et Or sont des temps à battre, calculés chaque jour. La médaille Auteur est le temps du pilote automatique qui a validé le circuit : le battre, c'est être meilleur que lui." },
  { icon: "👻", title: "Fantômes", text: "Une voiture transparente rejoue ton record, ou celui du premier, ou du joueur juste devant toi (touche G, ou le bouton Fantôme). Rien de tout ça ne change ton temps." },
  { icon: "🌐", title: "Salon live", text: "Un circuit tout neuf toutes les 10 minutes, identique pour les joueurs présents, avec leurs fantômes et un classement de session. Le Salon ne touche jamais à tes records du jour." },
];
