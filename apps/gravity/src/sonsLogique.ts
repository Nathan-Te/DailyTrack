// Les SONS de « Gravity » (lot GR4), la **décision** : de chaque événement de la simulation, la liste des notes à jouer (hauteur, durée, forme, niveau). **Pur** : aucun `AudioContext` ici, `sons.ts` ne fait que les lire. Web Audio
// procédural, sans fichier (rien à télécharger : le poids du premier chargement ne bouge pas), sur le modèle de Blocks. **Présentation seulement : rien ici ne touche la simulation ni la rediffusion.**
// Le caractère : net mais jamais punitif — des sinus et des triangles, jamais d'onde carrée, des niveaux bas (le plus fort est la mort, à 0,3) ; la chute du multiplicateur et la mort descendent doucement.
import { CASE, EV_ATTERRISSAGE, EV_BOND, EV_BONUS, EV_BOUCLIER, EV_CRAQUE, EV_EFFONDREMENT, EV_GEMME, EV_INVERSEUR, EV_INVERSION, EV_MANQUEE, EV_MORT, EV_PIECE, EV_PORTAIL, EV_VIRAGE, LARGEUR_MORCEAU, TAILLE, etatLaser, positionScie, type Partie, type Terrain, type TypePortail } from "@cdj/gravity-sim";

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
  | { son: "theme" }
  // Lot GR6 : un portail franchi (un son par type), le changement de sens de l'onde, le bond du ressort.
  | { son: "portail"; type: TypePortail }
  | { son: "virage"; vers: "haut" | "bas" }
  | { son: "bond" }
  // Lot GR7 : une scie qui passe près, un sol fragile qui craque puis qui tombe, un laser qui se charge puis qui brûle.
  | { son: "scie" }
  | { son: "craquement" }
  | { son: "effondrement" }
  | { son: "laserCharge" }
  | { son: "laserBrule" };

/** Ce que la scène lit de la simulation avant et après un pas : de quoi savoir ce qui vient de changer. */
export interface Photo {
  g: 1 | -1;
  mult: number;
  chaine: number;
  bouclier: boolean;
  aimant: number;
  /** Lot GR6 : le portail franchi à ce pas (valable quand `EV_PORTAIL` est levé) et le sens vertical du héros (vrai : il monte). */
  portail: TypePortail | null;
  monte: boolean;
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
  if ((ev & EV_PORTAIL) !== 0 && apres.portail !== null) sons.push({ son: "portail", type: apres.portail });
  if (ev & EV_VIRAGE) sons.push({ son: "virage", vers: apres.monte ? "haut" : "bas" });
  if (ev & EV_BOND) sons.push({ son: "bond" });
  if (ev & EV_CRAQUE) sons.push({ son: "craquement" });
  if (ev & EV_EFFONDREMENT) sons.push({ son: "effondrement" });
  if (ev & EV_MORT) sons.push({ son: "mort" });
  return sons;
}

/** Combien de cases autour du joueur un danger se fait entendre : la scie qui passe à moins de 2,6 cases (on l'entend arriver), le laser à moins de 9 colonnes. */
export const PORTEE_SCIE = 2.6;
export const PORTEE_LASER = 9;
/**
 * **La veille des dangers** (lot GR7) : de pas en pas, les sons des dangers qui ne sont pas des événements de la simulation — la scie qui passe près (une fois par passage : elle doit s'éloigner de plus de 4 cases avant de pouvoir
 * se faire entendre de nouveau) et le laser qui change d'état près du joueur (il se charge quand le trait pâle s'allume, il brûle quand le rayon s'allume). Pure : lit le terrain et la partie, garde sa mémoire ; jamais de son hors de la
 * portée du joueur.
 */
export class VeilleDesDangers {
  private readonly proches = new Set<string>();
  private readonly etats = new Map<string, number>();
  pas(terrain: Terrain, partie: Partie): Evenement[] {
    const sons: Evenement[] = [];
    const cx = partie.x + TAILLE / 2;
    const cy = partie.y + TAILLE / 2;
    const k0 = Math.trunc(cx / (LARGEUR_MORCEAU * CASE));
    for (let k = Math.max(0, k0 - 1); k <= k0 + 1; k++) {
      const m = terrain.morceau(k);
      m.scies.forEach((sc, i) => {
        const [sx, sy] = positionScie(sc, partie.tick);
        const d = Math.hypot(sx - cx, sy - cy) / CASE;
        const cle = `${k}:${i}`;
        if (d < PORTEE_SCIE && !this.proches.has(cle)) {
          this.proches.add(cle);
          sons.push({ son: "scie" });
        } else if (d > PORTEE_SCIE + 1.4) this.proches.delete(cle);
      });
      m.lasers.forEach((l, i) => {
        const cle = `${k}:${i}`;
        const etat = etatLaser(partie.tick, l.decalage);
        const avant = this.etats.get(cle) ?? 0;
        this.etats.set(cle, etat);
        if (etat === avant) return;
        const distance = Math.abs((k * LARGEUR_MORCEAU + l.c + 0.5) * CASE - cx) / CASE;
        if (distance > PORTEE_LASER) return;
        if (etat === 1) sons.push({ son: "laserCharge" });
        else if (etat === 2) sons.push({ son: "laserBrule" });
      });
    }
    return sons;
  }
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
    case "portail":
      return notesDePortail(e.type);
    case "virage":
      // Un « tic » bref : plus aigu quand l'onde part vers le haut, plus grave vers le bas.
      return [note(0, e.vers === "haut" ? 740 : 560, 0.05, 0.12, "triangle", e.vers === "haut" ? 840 : 480)];
    case "bond":
      // Un « boing » : un sinus qui monte vite, un triangle plus haut qui le suit.
      return [note(0, 210, 0.16, 0.2, "sine", 520), note(0.03, 420, 0.12, 0.08, "triangle", 880)];
    case "scie":
      // Un « zzzip » : un glissement qui descend vite, deux fois (le disque qui passe), jamais fort.
      return [note(0, 1100, 0.09, 0.1, "triangle", 620), note(0.06, 880, 0.09, 0.06, "triangle", 480)];
    case "craquement":
      // Trois petits claquements secs, de plus en plus graves : le bois qui cède.
      return [note(0, 230, 0.04, 0.2, "triangle", 160), note(0.05, 190, 0.04, 0.18, "triangle", 130), note(0.11, 270, 0.03, 0.14, "triangle", 150)];
    case "effondrement":
      // Un « toum » sourd qui s'éloigne.
      return [note(0, 130, 0.28, 0.24, "triangle", 48), note(0.02, 260, 0.1, 0.07, "sine", 90)];
    case "laserCharge":
      // Il se charge : un sinus qui monte, du grave à l'aigu.
      return [note(0, 280, 0.45, 0.11, "sine", 1100), note(0.1, 560, 0.35, 0.05, "sine", 1400)];
    case "laserBrule":
      // Il brûle : un bourdonnement grave, sans onde carrée.
      return [note(0, 140, 0.4, 0.15, "triangle", 150), note(0, 281, 0.4, 0.07, "sine", 300)];
    case "theme":
      // Un changement de décor : un glissement qui s'ouvre, puis un accord qui se pose.
      return [note(0, 392, 0.4, 0.15, "sine", 784), note(0.18, 523, 0.3, 0.12, "triangle"), note(0.18, 659, 0.3, 0.12, "triangle")];
  }
}

/** Lot GR6 — le son d'un portail : l'avion monte en souffle, l'onde zigzague, le ressort fait « boing », la gravité retombe ; **la hauteur d'un portail de vitesse monte avec ses chevrons**, le portail lent est grave et descend. */
export function notesDePortail(type: TypePortail): Note[] {
  switch (type) {
    case "avion":
      return [note(0, 300, 0.3, 0.2, "sine", 720), note(0.12, 540, 0.2, 0.1, "triangle", 900)];
    case "onde":
      return [note(0, 520, 0.07, 0.16, "triangle"), note(0.07, 780, 0.07, 0.16, "triangle"), note(0.14, 520, 0.07, 0.16, "triangle"), note(0.21, 780, 0.12, 0.16, "triangle")];
    case "ressort":
      return [note(0, 190, 0.14, 0.22, "sine", 480), note(0.14, 480, 0.12, 0.2, "sine", 250), note(0.26, 250, 0.16, 0.16, "sine", 400)];
    case "gravite":
      return [note(0, 660, 0.18, 0.18, "triangle", 330), note(0.12, 330, 0.24, 0.16, "sine", 220)];
    case "lent":
      return [note(0, 196, 0.34, 0.22, "triangle", 131)];
    case "v1":
      return [note(0, 660, 0.12, 0.16, "triangle")];
    case "v2":
      return [note(0, 660, 0.1, 0.16, "triangle"), note(0.08, 880, 0.12, 0.16, "triangle")];
    case "v3":
      return [note(0, 660, 0.09, 0.16, "triangle"), note(0.07, 880, 0.09, 0.16, "triangle"), note(0.14, 1175, 0.16, 0.16, "triangle")];
  }
}

/** Le souffle de l'avion (lot GR6) : un bruit filtré qui dure tant qu'on maintient. Son niveau de crête (jamais au-dessus de 0,3), la fréquence de son filtre (Hz) et la rapidité de ses fondus (secondes). */
export const SOUFFLE = { niveau: 0.12, filtre: 780, fondu: 0.07 } as const;
/** Le niveau voulu du souffle : celui du réglage « Volume des effets » fois son niveau de crête quand l'avion est maintenu (et le jeu tourne), sinon rien. */
export const niveauDuSouffle = (actif: boolean, volume: number): number => (actif ? niveauEffets(volume) * SOUFFLE.niveau : 0);
/** `n` échantillons de bruit blanc de −1 à 1 : un petit générateur entier (jamais `Math.random`), le même partout. */
export function echantillonsDeBruit(n: number): Float32Array {
  const sortie = new Float32Array(n);
  let graine = 0x1f2e3d4c;
  for (let i = 0; i < n; i++) {
    graine = (Math.imul(graine, 1664525) + 1013904223) >>> 0;
    sortie[i] = graine / 2147483648 - 1;
  }
  return sortie;
}

/** Le niveau général des effets : le « Volume des effets » du joueur (0 à 1) ; 0 ou illisible : rien ne se joue. */
export const niveauEffets = (volume: number): number => (volume > 0 ? Math.min(1, volume) : 0);
