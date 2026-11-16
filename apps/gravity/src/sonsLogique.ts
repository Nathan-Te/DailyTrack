// Les SONS de « Gravity » (lot GR4), la **décision** : de chaque événement de la simulation, la liste des notes à jouer (hauteur, durée, forme, niveau). **Pur** : aucun `AudioContext` ici, `sons.ts` ne fait que les lire. Web Audio
// procédural, sans fichier (rien à télécharger : le poids du premier chargement ne bouge pas), sur le modèle de Blocks. **Présentation seulement : rien ici ne touche la simulation ni la rediffusion.**
// Le caractère : net mais jamais punitif — des sinus et des triangles, jamais d'onde carrée, des niveaux bas (le plus fort est la mort, à 0,3) ; la chute du multiplicateur et la mort descendent doucement.
import { EV_ATTERRISSAGE, EV_BONUS, EV_BOUCLIER, EV_GEMME, EV_INVERSEUR, EV_INVERSION, EV_MANQUEE, EV_MORT, EV_PIECE } from "@cdj/gravity-sim";

export type FormeOnde = "sine" | "triangle";
export interface Note {
  /** Le départ, en secondes après le déclenchement. */
  t: number;
  /** La hauteur de départ et d'arrivée (Hz) : un glissement si elles diffèrent. */
  f: number;
  f2: number;
  /** La durée (s) et le niveau de crête (0 à 1, avant le volume des effets). */
  d: number;
  g: number;
  onde: FormeOnde;
}

/** Les événements sonores : un par chose que le joueur doit entendre. */
export type Evenement =
  | { son: "inversion"; vers: "haut" | "bas" }
  | { son: "atterrissage" }
  | { son: "inverseur"; vers: "haut" | "bas" }
  | { son: "piece"; chaine: number }
  | { son: "palier"; mult: number }
  | { son: "chute" }
  | { son: "gemme" }
  | { son: "bonus"; quoi: "bouclier" | "aimant" }
  | { son: "bouclierConsomme" }
  | { son: "mort" }
  | { son: "theme" };

/** Ce que la scène lit de la simulation avant et après un pas : de quoi savoir ce qui vient de changer. */
export interface Photo {
  g: 1 | -1;
  mult: number;
  chaine: number;
  bouclier: boolean;
  aimant: number;
}

/** La hauteur d'une pièce : sol à 784 Hz (Sol₅), **un demi-ton de plus toutes les deux pièces d'affilée**, jusqu'à l'octave (24 pièces) — la série se monte à l'oreille, doucement, et retombe avec elle. */
export const hauteurPiece = (chaine: number): number => 784 * 2 ** (Math.min(24, Math.max(0, chaine)) / 24);
/** La note de base d'un palier du multiplicateur : Do₅ pour ×2, puis deux demi-tons de plus à chaque palier. */
export const hauteurPalier = (mult: number): number => 523.25 * 2 ** ((2 * Math.max(0, Math.min(5, mult) - 2)) / 12);

const note = (t: number, f: number, d: number, g: number, onde: FormeOnde = "sine", f2 = f): Note => ({ t, f, f2, d, g, onde });

/** Les événements d'un pas de la simulation (`ev` : les bits `EV_*`) dans l'ordre où on les entend ; `avant` et `apres` : l'état autour du pas. Pure. */
export function sonsDuPas(ev: number, avant: Photo, apres: Photo): Evenement[] {
  const vers = apres.g > 0 ? "bas" : "haut";
  const sons: Evenement[] = [];
  if (ev & EV_INVERSION) sons.push({ son: "inversion", vers });
  if (ev & EV_INVERSEUR) sons.push({ son: "inverseur", vers });
  if (ev & EV_ATTERRISSAGE) sons.push({ son: "atterrissage" });
  if (ev & EV_PIECE) sons.push({ son: "piece", chaine: apres.chaine });
  if (apres.mult > avant.mult) sons.push({ son: "palier", mult: apres.mult });
  // Une pièce ratée ne s'entend que si elle coûte quelque chose : un multiplicateur qui retombe de ×2 ou plus.
  if ((ev & EV_MANQUEE) !== 0 && avant.mult > 1 && apres.mult === 1) sons.push({ son: "chute" });
  if (ev & EV_GEMME) sons.push({ son: "gemme" });
  if (ev & EV_BONUS) sons.push({ son: "bonus", quoi: apres.bouclier && !avant.bouclier ? "bouclier" : "aimant" });
  if (ev & EV_BOUCLIER) sons.push({ son: "bouclierConsomme" });
  if (ev & EV_MORT) sons.push({ son: "mort" });
  return sons;
}

export function notesDe(e: Evenement): Note[] {
  switch (e.son) {
    case "inversion":
      // Un coup d'air : le glissement monte quand on part vers le haut, descend vers le bas.
      return [e.vers === "haut" ? note(0, 280, 0.1, 0.2, "triangle", 560) : note(0, 560, 0.1, 0.2, "triangle", 280)];
    case "inverseur":
      // Plus brillant qu'une inversion : le bloc t'a retourné sans que tu le demandes.
      return [note(0, e.vers === "haut" ? 330 : 660, 0.14, 0.2, "triangle", e.vers === "haut" ? 990 : 330), note(0.07, e.vers === "haut" ? 990 : 330, 0.1, 0.1, "sine")];
    case "atterrissage":
      // Un « toc » sourd.
      return [note(0, 150, 0.09, 0.28, "triangle", 80)];
    case "piece": {
      const f = hauteurPiece(e.chaine);
      return [note(0, f, 0.09, 0.15, "sine"), note(0, f * 2, 0.06, 0.05, "sine")];
    }
    case "palier": {
      // Trois notes qui montent (tonique, tierce, quinte), plus haut à chaque palier : tu l'entends, sans regarder.
      const f = hauteurPalier(e.mult);
      return [note(0.04, f, 0.12, 0.22, "triangle"), note(0.1, f * 1.25, 0.12, 0.22, "triangle"), note(0.16, f * 1.5, 0.22, 0.22, "triangle")];
    }
    case "chute":
      // Net mais pas punitif : deux notes douces qui descendent, un sinus bas.
      return [note(0, 349, 0.1, 0.17, "sine", 311), note(0.09, 262, 0.18, 0.17, "sine", 220)];
    case "gemme":
      // Une étincelle : deux notes hautes qui tintent, la seconde qui résonne.
      return [note(0, 1319, 0.12, 0.17, "triangle"), note(0.07, 1760, 0.3, 0.17, "triangle"), note(0.07, 2637, 0.2, 0.05, "sine")];
    case "bonus":
      return e.quoi === "bouclier"
        ? [note(0, 523, 0.1, 0.2, "triangle"), note(0.07, 659, 0.1, 0.2, "triangle"), note(0.14, 784, 0.1, 0.2, "triangle"), note(0.21, 1047, 0.28, 0.2, "triangle")]
        : [note(0, 400, 0.22, 0.2, "sine", 900), note(0.2, 900, 0.12, 0.14, "triangle", 1200)];
    case "bouclierConsomme":
      // Le bouclier éclate : un choc qui retombe et un éclat de verre qui s'envole.
      return [note(0, 620, 0.2, 0.27, "triangle", 190), note(0.02, 1250, 0.28, 0.1, "sine", 420)];
    case "mort":
      // Trois notes qui descendent, puis un glissement grave : la partie est finie, sans cris.
      return [note(0, 330, 0.18, 0.28, "triangle"), note(0.16, 262, 0.18, 0.28, "triangle"), note(0.32, 196, 0.2, 0.28, "triangle"), note(0.48, 196, 0.5, 0.26, "triangle", 98)];
    case "theme":
      // Un changement de décor : un glissement qui s'ouvre, puis un accord qui se pose.
      return [note(0, 392, 0.4, 0.15, "sine", 784), note(0.18, 523, 0.3, 0.12, "triangle"), note(0.18, 659, 0.3, 0.12, "triangle")];
  }
}

/** Le niveau général des effets : le « Volume des effets » du joueur (0 à 1) ; 0 ou illisible : rien ne se joue. */
export const niveauEffets = (volume: number): number => (volume > 0 ? Math.min(1, volume) : 0);
