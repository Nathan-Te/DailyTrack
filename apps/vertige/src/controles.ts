import { REGARD_MAX, T_ARRIERE, T_AVANT, T_DASH, T_DROITE, T_GAUCHE, T_SAUT, TOUR, type Commande } from "@cdj/vertige-sim";
import { liaisonTenue, type Commandes } from "@cdj/ui/src/commandes";
import { padPourLeJeu } from "@cdj/ui/src/manetteLien";
import { ACTIONS_TENUES } from "./actions";

// Les commandes de Vertige : clavier (par `event.code`, donc ZQSD d'un AZERTY et WASD d'un QWERTY sont les mêmes touches), souris à pointeur verrouillé, manette. **Le jeu ne lit jamais une touche en dur** (règle
// M2) : il déclare ses actions (`actions.ts`) et le kit les rend réglables ; ici seulement la lecture de ce qui est tenu. Le résultat de chaque PAS de la simulation (120 par seconde) est une `Commande` : les touches
// tenues, et le mouvement du regard dans ce pas (lacet et tangage, en 1/65 536 de tour, entiers). Les fractions de point de souris sont gardées pour le pas suivant : aucun mouvement ne se perd.
//   · PC : la souris regarde, ZQSD/WASD ou les flèches courent, Espace saute, Maj dashe ;
//   · manette : le stick gauche court, le stick droit regarde, A saute, RB dashe (les liaisons se règlent : Réglages › Commandes).
const BIT: Record<(typeof ACTIONS_TENUES)[number], number> = { avant: T_AVANT, arriere: T_ARRIERE, gauche: T_GAUCHE, droite: T_DROITE, saut: T_SAUT, dash: T_DASH };
/** Un point de souris, en unités d'angle, à la sensibilité d'origine : 0,0022 rad par point. */
const UNITES_PAR_POINT = (0.0022 / (2 * Math.PI)) * TOUR;
/** Le stick droit, à fond : 0,55 tour par seconde, soit autant d'unités par pas de 1/120 s. */
const STICK_PAR_PAS = (0.55 * TOUR) / 120;
const ZONE_MORTE = 0.15;

export class Controles {
  private readonly tenues = new Set<string>();
  private regardL = 0;
  private regardT = 0;
  /** La sensibilité de la souris et du stick, en pour cent de celle d'origine. */
  sensibilite = 100;
  verrouille = false;
  private readonly ecoutes: [EventTarget, string, EventListener][] = [];

  constructor(
    private readonly commandes: Commandes | null,
    private readonly canevas: HTMLElement,
  ) {
    const surTouche = (e: Event, appui: boolean): void => {
      const k = e as KeyboardEvent;
      const id = this.commandes?.actionDeTouche(k.code);
      if (!id || !(id in BIT)) return;
      // Une touche tapée dans un champ (le panneau de confort) reste à ce champ.
      const cible = k.target as HTMLElement | null;
      if (cible && /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(cible.tagName)) return;
      k.preventDefault(); // Espace ne fait pas défiler la page, les flèches non plus
      if (appui) this.tenues.add(id);
      else this.tenues.delete(id);
    };
    const mouvement = (e: Event): void => {
      if (!this.verrouille) return;
      const m = e as MouseEvent;
      const k = (UNITES_PAR_POINT * this.sensibilite) / 100;
      // Au moment où le pointeur se verrouille, certains navigateurs livrent un saut énorme : un seul événement ne tourne jamais de plus de 300 points.
      const borne = (v: number): number => Math.max(-300, Math.min(300, v));
      this.regardL -= borne(m.movementX) * k;
      this.regardT -= borne(m.movementY) * k;
    };
    const pointeur = (): void => {
      this.verrouille = document.pointerLockElement === this.canevas;
      if (!this.verrouille) this.tenues.clear();
    };
    for (const [cible, nom, f] of [
      [window, "keydown", (e: Event) => surTouche(e, true)],
      [window, "keyup", (e: Event) => surTouche(e, false)],
      [window, "blur", () => this.tenues.clear()],
      [document, "mousemove", mouvement],
      [document, "pointerlockchange", pointeur],
    ] as [EventTarget, string, EventListener][]) {
      cible.addEventListener(nom, f);
      this.ecoutes.push([cible, nom, f]);
    }
    pointeur();
  }

  detruire(): void {
    for (const [c, n, f] of this.ecoutes) c.removeEventListener(n, f);
  }

  /** Le regard accumulé et pas encore joué, en unités d'angle : le rendu l'ajoute à l'angle de la simulation pour que la vue suive la souris sans attendre le pas suivant. */
  regardEnAttente(): [number, number] {
    return [this.regardL, this.regardT];
  }

  effacer(): void {
    this.tenues.clear();
    this.regardL = this.regardT = 0;
  }

  /** La commande du pas qui vient. */
  lire(): Commande {
    const tenu = new Set(this.tenues);
    const pad = padPourLeJeu(typeof navigator !== "undefined" ? navigator.getGamepads?.()[0] ?? undefined : undefined);
    if (pad) {
      for (const id of ACTIONS_TENUES) {
        const l = this.commandes?.liaison(id);
        if (l && liaisonTenue(l, pad)) tenu.add(id);
      }
      // Le stick droit regarde : une courbe douce près du centre, pleine vitesse à fond.
      const courbe = (v: number): number => {
        const a = Math.abs(v);
        return a < ZONE_MORTE ? 0 : Math.sign(v) * ((a - ZONE_MORTE) / (1 - ZONE_MORTE)) ** 2;
      };
      const k = (STICK_PAR_PAS * this.sensibilite) / 100;
      this.regardL -= courbe(pad.axes[2] ?? 0) * k;
      this.regardT -= courbe(pad.axes[3] ?? 0) * k * 0.7;
    }
    let k = 0;
    for (const id of tenu) k |= BIT[id as keyof typeof BIT] ?? 0;
    const borne = (v: number): number => Math.max(-REGARD_MAX, Math.min(REGARD_MAX, v));
    const dl = borne(Math.trunc(this.regardL));
    const dt = borne(Math.trunc(this.regardT));
    this.regardL -= dl;
    this.regardT -= dt;
    return { k, dl, dt };
  }
}
