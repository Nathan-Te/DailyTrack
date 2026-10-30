import { COMMANDE } from "@cdj/tower-sim";

// Les commandes du joueur (lot T1) : le clavier et les boutons tactiles donnent le même masque de bits par tick (`COMMANDE` de `@cdj/tower-sim`). La simulation ne lit aucune touche :
// ce module décide, à chaque tick, quels bits lever. `gauche` et `droite` sont des ordres de ce tick — un appui en lève un au tick suivant, puis, **si la touche est maintenue**,
// un autre après `delaiTicks`, et ainsi toutes les `cadenceTicks` (la répétition) ; `tourner` est un ordre par appui, sans répétition ; `descendre` est un niveau, levé tant que la
// touche est maintenue. Les délais sont en ticks (60 par seconde) : ce sont les curseurs de `?debug&tune`.

export type Touche = "gauche" | "droite" | "tourner" | "descendre";
export interface ReglagesEntrees {
  /** Ticks entre l'appui et la première répétition (10 = 167 ms). */
  delaiTicks: number;
  /** Ticks entre deux répétitions (3 = 50 ms). */
  cadenceTicks: number;
}
export const ENTREES_DEFAUT: Readonly<ReglagesEntrees> = { delaiTicks: 10, cadenceTicks: 3 };

const BIT: Record<Touche, number> = { gauche: COMMANDE.GAUCHE, droite: COMMANDE.DROITE, tourner: COMMANDE.TOURNER, descendre: COMMANDE.DESCENDRE };
const TOUCHES: readonly Touche[] = ["gauche", "droite", "tourner", "descendre"];
/** Plus d'ordres en attente que cela et le suivant est perdu (un clavier qui rafale ne prépare pas dix déplacements). */
const FILE_MAX = 2;

export class Entrees {
  private readonly maintenue: Record<Touche, boolean> = { gauche: false, droite: false, tourner: false, descendre: false };
  private readonly attente: Record<Touche, number> = { gauche: 0, droite: 0, tourner: 0, descendre: 0 };
  private readonly depuis: Record<Touche, number> = { gauche: 0, droite: 0, tourner: 0, descendre: 0 };

  constructor(private readonly reglages: () => ReglagesEntrees = () => ENTREES_DEFAUT) {}

  appuyer(t: Touche): void {
    if (this.maintenue[t]) return;
    this.maintenue[t] = true;
    this.depuis[t] = 0;
    if (t !== "descendre" && this.attente[t] < FILE_MAX) this.attente[t]++;
  }

  relacher(t: Touche): void {
    this.maintenue[t] = false;
  }

  /** Tout lâcher (la fenêtre perd le focus, la pause s'ouvre) : aucune touche ne reste « enfoncée » pour la simulation. */
  toutRelacher(): void {
    for (const t of TOUCHES) {
      this.maintenue[t] = false;
      this.attente[t] = 0;
    }
  }

  enfoncee(t: Touche): boolean {
    return this.maintenue[t];
  }

  /** Le masque du tick qui vient : à appeler une fois par tick. */
  lire(): number {
    const { delaiTicks, cadenceTicks } = this.reglages();
    let masque = 0;
    for (const t of ["gauche", "droite"] as const) {
      if (this.attente[t] > 0) {
        this.attente[t]--;
        masque |= BIT[t];
      } else if (this.maintenue[t]) {
        const n = ++this.depuis[t];
        if (n >= delaiTicks && (n - delaiTicks) % Math.max(1, cadenceTicks) === 0) masque |= BIT[t];
      }
    }
    if (this.attente.tourner > 0) {
      this.attente.tourner--;
      masque |= BIT.tourner;
    }
    if (this.maintenue.descendre) masque |= BIT.descendre;
    return masque;
  }

  /** Branche le clavier : ← → déplacent, ↑ ou X tournent, ↓ ou Espace descendent. Rend la fonction qui le débranche. */
  brancherClavier(cible: Window, actif: () => boolean): () => void {
    const touche = (code: string): Touche | null => {
      switch (code) {
        case "ArrowLeft":
          return "gauche";
        case "ArrowRight":
          return "droite";
        case "ArrowUp":
        case "KeyX":
          return "tourner";
        case "ArrowDown":
        case "Space":
          return "descendre";
        default:
          return null;
      }
    };
    const bas = (e: KeyboardEvent) => {
      const t = touche(e.code);
      if (!t || e.ctrlKey || e.metaKey || e.altKey) return;
      // Espace sur un bouton le presserait : tant qu'un écran (pause, fin) est ouvert, le clavier est à l'écran.
      if (!actif()) return;
      e.preventDefault();
      if (!e.repeat) this.appuyer(t);
    };
    const haut = (e: KeyboardEvent) => {
      const t = touche(e.code);
      if (t) this.relacher(t);
    };
    const perte = () => this.toutRelacher();
    cible.addEventListener("keydown", bas);
    cible.addEventListener("keyup", haut);
    cible.addEventListener("blur", perte);
    return () => {
      cible.removeEventListener("keydown", bas);
      cible.removeEventListener("keyup", haut);
      cible.removeEventListener("blur", perte);
    };
  }

  /** Un bouton tactile (ou à la souris) : appuyé tant que le doigt est dessus, relâché à la levée ou à la perte du pointeur. */
  brancherBouton(b: HTMLElement, t: Touche): void {
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      try {
        b.setPointerCapture(e.pointerId);
      } catch {
        // pointeur déjà perdu : le bouton se relâchera à pointerup
      }
      this.appuyer(t);
      b.classList.add("est-appuye");
    });
    const fin = () => {
      this.relacher(t);
      b.classList.remove("est-appuye");
    };
    b.addEventListener("pointerup", fin);
    b.addEventListener("pointercancel", fin);
    b.addEventListener("lostpointercapture", fin);
    b.addEventListener("contextmenu", (e) => e.preventDefault());
  }
}
