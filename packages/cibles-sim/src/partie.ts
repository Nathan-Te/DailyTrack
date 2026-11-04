import { type Contenu } from "./generateur";
import { COLONNES, DUREE_TICKS, NB_CASES } from "./constantes";
import { VARIANTE, type Etat, type Variante } from "./variante";

// La partie : 900 ticks à 30 Hz au plus. À chaque tick, les touches du tick sont appliquées (`toucher`), puis le temps avance (`avancer`). Tout est entier. Une touche compte si elle vise la case de la cible visible
// à ce tick et que celle-ci n'est pas déjà touchée ; toute autre touche est ignorée (aucune pénalité). **Quelle cible est visible et quand la partie finit : la variante** (`variante.ts`, le seul endroit qui le sait).

export interface Resultat {
  /** Les cibles touchées. */
  touches: number;
  /** Le tick de la dernière touche réussie ; `DUREE_TICKS` quand aucune cible n'a été touchée. */
  dernier: number;
  /** Les touches qui n'ont rien touché (information, jamais classée). */
  ratees: number;
  /** Les ticks joués (la partie finit au plus à `DUREE_TICKS`, plus tôt si la variante le veut). */
  ticks: number;
}

export class Partie {
  tick = 0;
  touches = 0;
  ratees = 0;
  private dernierTick = -1;
  private readonly prises: boolean[];

  constructor(
    readonly contenu: Contenu,
    readonly variante: Variante = VARIANTE,
  ) {
    this.prises = contenu.cibles.map(() => false);
  }

  /** Ce que la règle de la variante lit. */
  get etat(): Etat {
    return { contenu: this.contenu, tick: this.tick, prises: this.prises, dernierTick: this.dernierTick };
  }

  get finie(): boolean {
    return this.variante.finie(this.etat);
  }

  /** La cible visible à ce tick (son rang dans le contenu), ou −1. */
  cibleVisible(): number {
    return this.variante.visible(this.etat);
  }

  /** Le nombre de cibles pas encore touchées. */
  ciblesRestantes(): number {
    return this.prises.filter((p) => !p).length;
  }

  /** Une touche de la case `c` à ce tick. Rend vrai si elle a touché une cible. */
  toucher(c: number): boolean {
    if (this.finie || !Number.isInteger(c) || c < 0 || c >= NB_CASES) return false;
    const i = this.cibleVisible();
    if (i >= 0 && this.contenu.cibles[i]!.c === c) {
      this.prises[i] = true;
      this.touches++;
      this.dernierTick = this.tick;
      return true;
    }
    this.ratees++;
    return false;
  }

  avancer(): void {
    if (!this.finie) this.tick++;
  }

  resultat(): Resultat {
    return { touches: this.touches, dernier: this.dernierTick < 0 ? DUREE_TICKS : this.dernierTick, ratees: this.ratees, ticks: this.tick };
  }
}

/** La case sous un point d'un plateau de `largeur` × `hauteur` (coordonnées ≥ 0), ou −1 hors du plateau. Entier. */
export function caseAuPoint(x: number, y: number, largeur: number, hauteur: number, lignes: number): number {
  if (x < 0 || y < 0 || x >= largeur || y >= hauteur) return -1;
  const col = Math.floor((x * COLONNES) / largeur);
  const lig = Math.floor((y * lignes) / hauteur);
  return lig * COLONNES + col;
}

export interface Touche {
  tick: number;
  c: number;
}

/** Joue une partie entière : les touches dans l'ordre des ticks. */
export function jouer(contenu: Contenu, touches: readonly Touche[], variante: Variante = VARIANTE): Resultat {
  const p = new Partie(contenu, variante);
  let k = 0;
  while (!p.finie) {
    while (k < touches.length && touches[k]!.tick === p.tick) p.toucher(touches[k++]!.c);
    p.avancer();
  }
  return p.resultat();
}
