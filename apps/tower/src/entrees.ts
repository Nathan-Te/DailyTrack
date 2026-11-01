import { COMMANDE } from "@cdj/tower-sim";
import { SEUIL_AXE, type Commandes } from "@cdj/ui/src/commandes";

// Les commandes du joueur (lot T1) : le clavier et les boutons tactiles donnent le même masque de bits par tick (`COMMANDE` de `@cdj/tower-sim`). La simulation ne lit aucune touche :
// ce module décide, à chaque tick, quels bits lever. `gauche` et `droite` sont des ordres de ce tick — un appui en lève un au tick suivant, puis, **si la touche est maintenue**,
// un autre après `delaiTicks`, et ainsi toutes les `cadenceTicks` (la répétition) ; `tourner` est un ordre par appui, sans répétition ; `descendre` est un niveau, levé tant que la
// touche est maintenue. Les délais sont en ticks (60 par seconde) : ce sont les curseurs de `?debug&tune`.
// Lot T7 : **aucune touche n'est écrite ici** — le clavier passe par `commandes.actionDeTouche` (règle M2 : `commandes.ts`, les touches de l'origine et celles du joueur), la manette par les
// liaisons de `commandes` et les fixes (stick, croix), le tactile par les boutons de l'écran. Trois sources peuvent tenir la même touche (un ordre n'est levé qu'au premier appui) ; ce qui sort
// d'ici est toujours le même masque de bits par tick, donc la rediffusion ne dépend jamais des touches choisies.

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

/** Qui tient une touche : le clavier, un bouton de l'écran, la manette (un bit chacun : la touche est tenue tant qu'une source la tient). */
export type Source = "clavier" | "tactile" | "manette";
const SOURCE: Record<Source, number> = { clavier: 1, tactile: 2, manette: 4 };
/** Les actions de `commandes.ts` qui sont des touches de la partie. */
const TOUCHE_DE_ACTION: Readonly<Record<string, Touche | undefined>> = { gauche: "gauche", droite: "droite", tourner: "tourner", descendre: "descendre" };

/** Ce que la partie lit d'une manette : des boutons et des axes (disposition « standard »). */
export type PadLu = { buttons: ArrayLike<{ pressed: boolean }>; axes: ArrayLike<number> };
const BOUTON_BAS = 13;
const BOUTON_GAUCHE = 14;
const BOUTON_DROITE = 15;

/** Le sens demandé par la croix, sinon le stick gauche (zone morte à la moitié de sa course, comme les menus) : −1, 0 ou 1. */
export function directionDuPad(pad: PadLu): number {
  const b = (i: number): boolean => pad.buttons[i]?.pressed ?? false;
  const croix = (b(BOUTON_DROITE) ? 1 : 0) - (b(BOUTON_GAUCHE) ? 1 : 0);
  if (croix !== 0) return croix;
  const x = pad.axes[0] ?? 0;
  return x > SEUIL_AXE ? 1 : x < -SEUIL_AXE ? -1 : 0;
}

/** Le bas de la croix ou du stick : « descendre » sans réglage (fixe), en plus du bouton choisi. */
export const basDuPad = (pad: PadLu): boolean => (pad.buttons[BOUTON_BAS]?.pressed ?? false) || (pad.axes[1] ?? 0) > SEUIL_AXE;

/** Y a-t-il de l'activité sur cette manette (un bouton enfoncé ou un stick penché) ? Sert à savoir si la dernière entrée vient d'une manette. */
export function padActif(pad: PadLu): boolean {
  for (let i = 0; i < pad.buttons.length; i++) if (pad.buttons[i]?.pressed) return true;
  return Math.max(Math.abs(pad.axes[0] ?? 0), Math.abs(pad.axes[1] ?? 0)) > SEUIL_AXE;
}

export class Entrees {
  private readonly tenue: Record<Touche, number> = { gauche: 0, droite: 0, tourner: 0, descendre: 0 };
  private readonly attente: Record<Touche, number> = { gauche: 0, droite: 0, tourner: 0, descendre: 0 };
  private readonly depuis: Record<Touche, number> = { gauche: 0, droite: 0, tourner: 0, descendre: 0 };

  constructor(private readonly reglages: () => ReglagesEntrees = () => ENTREES_DEFAUT) {}

  appuyer(t: Touche, source: Source = "tactile"): void {
    const avant = this.tenue[t];
    this.tenue[t] = avant | SOURCE[source];
    if (avant !== 0) return; // déjà tenue (par une autre source, ou la même) : pas un nouvel ordre
    this.depuis[t] = 0;
    if (t !== "descendre" && this.attente[t] < FILE_MAX) this.attente[t]++;
  }

  relacher(t: Touche, source: Source = "tactile"): void {
    this.tenue[t] &= ~SOURCE[source];
  }

  /** Tout lâcher (la fenêtre perd le focus, la pause s'ouvre) : aucune touche ne reste « enfoncée » pour la simulation. */
  toutRelacher(): void {
    for (const t of TOUCHES) {
      this.tenue[t] = 0;
      this.attente[t] = 0;
    }
  }

  enfoncee(t: Touche): boolean {
    return this.tenue[t] !== 0;
  }

  /** Le masque du tick qui vient : à appeler une fois par tick. */
  lire(): number {
    const { delaiTicks, cadenceTicks } = this.reglages();
    let masque = 0;
    for (const t of ["gauche", "droite"] as const) {
      if (this.attente[t] > 0) {
        this.attente[t]--;
        masque |= BIT[t];
      } else if (this.tenue[t] !== 0) {
        const n = ++this.depuis[t];
        if (n >= delaiTicks && (n - delaiTicks) % Math.max(1, cadenceTicks) === 0) masque |= BIT[t];
      }
    }
    if (this.attente.tourner > 0) {
      this.attente.tourner--;
      masque |= BIT.tourner;
    }
    if (this.tenue.descendre !== 0) masque |= BIT.descendre;
    return masque;
  }

  /**
   * Branche le clavier : la touche physique (`event.code`) devient une action par `commandes` (les touches d'origine ou celles du joueur), l'action une touche de la partie. Rend la fonction qui
   * le débranche. `actif` : faux tant qu'un écran (pause, fin, réglages) a le clavier.
   */
  brancherClavier(cible: Window, actif: () => boolean, commandes: Pick<Commandes, "actionDeTouche">): () => void {
    const touche = (code: string): Touche | null => TOUCHE_DE_ACTION[commandes.actionDeTouche(code) ?? ""] ?? null;
    const bas = (e: KeyboardEvent) => {
      const t = touche(e.code);
      if (!t || e.ctrlKey || e.metaKey || e.altKey) return;
      // Espace sur un bouton le presserait : tant qu'un écran (pause, fin) est ouvert, le clavier est à l'écran.
      if (!actif()) return;
      e.preventDefault();
      if (!e.repeat) this.appuyer(t, "clavier");
    };
    const haut = (e: KeyboardEvent) => {
      const t = touche(e.code);
      if (t) this.relacher(t, "clavier");
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

  /**
   * La manette, lue une fois par image (elle ne prévient pas) : le stick et la croix déplacent, le bas du stick et de la croix descend (fixes), « tourner » et « descendre » ont le bouton que
   * `commandes` leur donne. À lui passer la manette de `padPourLeJeu` (un menu ouvert la lui cache : un appui ne sert jamais deux fois). `undefined` : tout est relâché. La répétition de gauche
   * et de droite est celle du clavier (`lire`).
   */
  lirePad(pad: PadLu | undefined, commandes: Pick<Commandes, "enfonceeManette">): void {
    const sens = pad ? directionDuPad(pad) : 0;
    const tenir = (t: Touche, oui: boolean): void => (oui ? this.appuyer(t, "manette") : this.relacher(t, "manette"));
    tenir("gauche", sens < 0);
    tenir("droite", sens > 0);
    tenir("tourner", !!pad && commandes.enfonceeManette("tourner", pad));
    tenir("descendre", !!pad && (commandes.enfonceeManette("descendre", pad) || basDuPad(pad)));
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
      this.appuyer(t, "tactile");
      b.classList.add("est-appuye");
    });
    const fin = () => {
      this.relacher(t, "tactile");
      b.classList.remove("est-appuye");
    };
    b.addEventListener("pointerup", fin);
    b.addEventListener("pointercancel", fin);
    b.addEventListener("lostpointercapture", fin);
    b.addEventListener("contextmenu", (e) => e.preventDefault());
  }
}
