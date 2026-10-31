// Lot M1 (plateforme) : la manette dans les menus — la LOGIQUE PURE (aucun DOM, aucune horloge : le temps est un paramètre), testée sur des manettes et des
// rectangles fictifs (`packages/ui/test/manette.test.ts`). Le module qui la branche à la page est `manette.ts` (à la demande, une manette branchée).
// Disposition « standard » de l'API Gamepad : A 0, B 1, X 2, Y 3, LB 4, RB 5, LT 6, RT 7, Select 8, Start 9, L3 10, R3 11, croix 12 (haut) à 15 (droite).

export const BOUTON = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, SELECT: 8, START: 9, HAUT: 12, BAS: 13, GAUCHE: 14, DROITE: 15 } as const;

export type Direction = "haut" | "bas" | "gauche" | "droite";

/** Le stick gauche compte à partir de la moitié de sa course : en dessous, c'est la zone morte (un stick au repos n'est jamais à zéro). */
export const ZONE_MORTE = 0.5;
/** Répétition d'une direction tenue : le premier délai est long (un appui bref ne compte qu'une fois), les suivants plus courts. */
export const DELAI_PREMIER_MS = 300;
export const DELAI_SUITE_MS = 120;

/** Ce que la logique lit d'une manette : des boutons enfoncés (vrai / faux) et les axes. */
export interface EtatPad {
  boutons: readonly boolean[];
  axes: readonly number[];
}

/** Lit une manette de l'API Gamepad (ou d'un test) : seuls `pressed` et `axes` comptent. */
export function etatDe(pad: { buttons: ArrayLike<{ pressed: boolean }>; axes: ArrayLike<number> }): EtatPad {
  return { boutons: Array.from(pad.buttons, (b) => !!b.pressed), axes: Array.from(pad.axes) };
}

/** La direction demandée : la croix d'abord, sinon le stick gauche (l'axe le plus penché, au-delà de la zone morte). `null` : aucune. */
export function directionDe(e: EtatPad, zoneMorte = ZONE_MORTE): Direction | null {
  const b = e.boutons;
  if (b[BOUTON.HAUT] && !b[BOUTON.BAS]) return "haut";
  if (b[BOUTON.BAS] && !b[BOUTON.HAUT]) return "bas";
  if (b[BOUTON.GAUCHE] && !b[BOUTON.DROITE]) return "gauche";
  if (b[BOUTON.DROITE] && !b[BOUTON.GAUCHE]) return "droite";
  const x = e.axes[0] ?? 0;
  const y = e.axes[1] ?? 0;
  if (Math.max(Math.abs(x), Math.abs(y)) < zoneMorte) return null;
  return Math.abs(x) >= Math.abs(y) ? (x < 0 ? "gauche" : "droite") : y < 0 ? "haut" : "bas";
}

/** Répétition : une direction tenue part tout de suite, repart après 300 ms, puis toutes les 120 ms. Le temps (ms) est donné à chaque pas. */
export class Repetiteur {
  private courante: Direction | null = null;
  private prochain = 0;

  constructor(
    private readonly premier = DELAI_PREMIER_MS,
    private readonly suite = DELAI_SUITE_MS,
  ) {}

  /** La direction à jouer à cet instant, ou `null` (rien tenu, ou pas encore l'heure). */
  pas(direction: Direction | null, maintenant: number): Direction | null {
    if (direction === null) {
      this.courante = null;
      return null;
    }
    if (direction !== this.courante) {
      this.courante = direction;
      this.prochain = maintenant + this.premier;
      return direction;
    }
    if (maintenant >= this.prochain) {
      this.prochain = maintenant + this.suite;
      return direction;
    }
    return null;
  }

  /** Une direction déjà tenue (quand le menu s'ouvre) ne compte qu'une fois relâchée : elle n'est pas un appui du menu. */
  ignorer(direction: Direction | null): void {
    this.courante = direction;
    this.prochain = Infinity;
  }
}

/**
 * Les appuis, **jamais servis deux fois**. Un bouton compte à son front montant ; le menu qui s'en sert (ou qui le trouve tenu à son ouverture) le
 * « consomme » : tant qu'il n'est pas relâché, le jeu le lit comme levé. Ainsi le A qui ferme la pause ne fait pas sauter, et le prochain appui ne compte
 * qu'après un relâchement.
 */
export class SuiviBoutons {
  private readonly tenus = new Set<number>();
  private readonly consommes = new Set<number>();

  /** Met à jour les boutons tenus ; rend ceux qui viennent d'être enfoncés (dans l'ordre). Un bouton relâché cesse d'être consommé. */
  mettreAJour(enfonces: readonly boolean[]): number[] {
    const presses: number[] = [];
    const n = Math.max(enfonces.length, ...this.tenus, 0);
    for (let i = 0; i <= n; i++) {
      if (enfonces[i]) {
        if (!this.tenus.has(i)) {
          this.tenus.add(i);
          presses.push(i);
        }
      } else {
        this.tenus.delete(i);
        this.consommes.delete(i);
      }
    }
    return presses;
  }

  /** Le menu s'est servi de ce bouton (ou le trouve tenu) : le jeu ne le voit pas avant son relâchement. Sans effet s'il n'est pas tenu. */
  consommer(bouton: number): void {
    if (this.tenus.has(bouton)) this.consommes.add(bouton);
  }

  estConsomme(bouton: number): boolean {
    return this.consommes.has(bouton);
  }

  estTenu(bouton: number): boolean {
    return this.tenus.has(bouton);
  }
}

/** Ce que le jeu lit d'une manette quand un menu existe : tout est levé (boutons consommés, ou tous si un menu est ouvert), sauf Start (la pause). */
export function boutonVisiblePourLeJeu(bouton: number, menuOuvert: boolean, suivi: SuiviBoutons): boolean {
  if (bouton === BOUTON.START) return true;
  return !menuOuvert && !suivi.estConsomme(bouton);
}

// --- Navigation spatiale ------------------------------------------------------------------------------------------------------------------------

export interface Rect {
  gauche: number;
  haut: number;
  droite: number;
  bas: number;
}

/**
 * L'élément le plus proche de `depuis` dans la direction demandée : son indice dans `candidats`, ou −1. Un candidat doit être **de l'autre côté** (son centre
 * dépasse celui de l'origine) et soit séparé de l'origine le long du mouvement, soit en face d'elle (recouvrement sur l'autre axe) ; le score est l'écart le
 * long du mouvement, trois fois l'écart latéral entre les bords et un quart du décalage des centres : celui qui est droit devant gagne sur un voisin diagonal
 * un peu plus près. À score égal, le premier de la liste.
 */
export function voisin(depuis: Rect, candidats: readonly Rect[], direction: Direction): number {
  const dcx = (depuis.gauche + depuis.droite) / 2;
  const dcy = (depuis.haut + depuis.bas) / 2;
  let meilleur = -1;
  let score = Infinity;
  candidats.forEach((c, i) => {
    const ccx = (c.gauche + c.droite) / 2;
    const ccy = (c.haut + c.bas) / 2;
    const vertical = direction === "haut" || direction === "bas";
    const de = vertical ? ccy - dcy : ccx - dcx;
    const sens = direction === "bas" || direction === "droite" ? de : -de;
    if (sens <= 0) return;
    let axe: number;
    switch (direction) {
      case "bas":
        axe = c.haut - depuis.bas;
        break;
      case "haut":
        axe = depuis.haut - c.bas;
        break;
      case "droite":
        axe = c.gauche - depuis.droite;
        break;
      default:
        axe = depuis.gauche - c.droite;
    }
    const ecartLateral = vertical ? Math.max(0, c.gauche - depuis.droite, depuis.gauche - c.droite) : Math.max(0, c.haut - depuis.bas, depuis.haut - c.bas);
    if (axe < 0) {
      // Les deux se chevauchent le long du mouvement : seulement s'ils sont aussi en face l'un de l'autre (un élément posé dans un autre), jamais côte à côte.
      if (ecartLateral > 0) return;
      axe = 0;
    }
    const decalage = Math.abs(vertical ? ccx - dcx : ccy - dcy);
    const s = axe + 3 * ecartLateral + 0.25 * decalage;
    if (s < score) {
      score = s;
      meilleur = i;
    }
  });
  return meilleur;
}

// --- Lettres des boutons ------------------------------------------------------------------------------------------------------------------------

export type Genre = "xbox" | "playstation";

/** Le dessin des lettres : type Xbox par défaut, croix et rond si l'identifiant de la manette est celui d'une PlayStation (Sony : 054c). */
export function genreDeManette(id: string): Genre {
  return /054c|playstation|dualshock|dualsense|\bps[2345]\b/i.test(id) ? "playstation" : "xbox";
}
