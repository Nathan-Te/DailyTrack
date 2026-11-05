import { entree, PAS_MIN_DIRECTION } from "@cdj/rush-sim";
import { liaisonTenue } from "@cdj/ui/src/commandes";
import { padPourLeJeu } from "@cdj/ui/src/manetteLien";
import type { Commandes } from "@cdj/ui/src/commandes";

// Les commandes de Rush : clavier, manette, doigts. **Le jeu ne lit jamais une touche en dur** (règle M2) : il déclare ses actions (`ACTIONS_RUSH`) et le kit les rend réglables ; ici seulement la lecture de ce qui est tenu.
// Le résultat de chaque tick est l'octet d'entrée de la simulation (`entree` de `@cdj/rush-sim`) : une direction parmi 32, le coup, l'esquive.

/** La direction de la croix (0 à 31, 0 vers la droite, 8 vers le bas) d'un déplacement (dx, dy) en axes d'écran, ou −1. */
export function directionDe8(dx: number, dy: number): number {
  const h = Math.sign(dx);
  const v = Math.sign(dy);
  if (h === 0 && v === 0) return -1;
  return ({ "1,0": 0, "1,1": 4, "0,1": 8, "-1,1": 12, "-1,0": 16, "-1,-1": 20, "0,-1": 24, "1,-1": 28 } as Record<string, number>)[`${h},${v}`]!;
}

/** La direction (0 à 31) d'un vecteur analogique, ou −1 sous la zone morte. */
export function directionAnalogique(x: number, y: number, mort = 0.3): number {
  if (Math.hypot(x, y) < mort) return -1;
  const a = Math.atan2(y, x);
  return (((Math.round((a / (Math.PI * 2)) * 32) % 32) + 32) % 32) as number;
}

export class Controles {
  private readonly tenues = new Set<string>();
  /** Un vecteur de joystick tactile, dans le repère de l'écran (y vers le bas), de norme ≤ 1. */
  stick = { x: 0, y: 0 };
  /** Les boutons tactiles (un appui est aussi gardé quelques ticks : `appuyer`). */
  boutonCoup = false;
  boutonEsquive = false;
  /** Un appui bref (une action du kit, une porte d'essai) : tenu encore quelques ticks. */
  private impulsionCoup = 0;
  private impulsionEsquive = 0;
  /** L'entrée imposée par une porte d'essai : (octet, ticks restants). */
  forcee: { e: number; reste: number } | null = null;
  private derniereDirection = -1;
  private tickDirection = -1000;
  private readonly ecoutes: [string, EventListener][] = [];

  constructor(private readonly commandes: Commandes | null) {
    const bas = (e: Event): void => this.touche(e as KeyboardEvent, true);
    const haut = (e: Event): void => this.touche(e as KeyboardEvent, false);
    const perte = (): void => {
      this.tenues.clear();
    };
    for (const [nom, f] of [["keydown", bas], ["keyup", haut], ["blur", perte]] as const) {
      addEventListener(nom, f);
      this.ecoutes.push([nom, f]);
    }
  }

  detruire(): void {
    for (const [nom, f] of this.ecoutes) removeEventListener(nom, f);
  }

  private touche(e: KeyboardEvent, appui: boolean): void {
    if (!this.commandes) return;
    const id = this.commandes.actionDeTouche(e.code);
    if (!id || !["haut", "bas", "gauche", "droite", "coup", "esquive"].includes(id)) return;
    if (appui) {
      // Un appui très bref (moins d'un arrêt sur image) ne doit pas se perdre : il est gardé quelques ticks.
      if (!this.tenues.has(id)) this.action(id);
      this.tenues.add(id);
    } else this.tenues.delete(id);
  }

  /** Un appui (touche, bouton de manette ou de l'écran, action du kit) : tenu encore quelques ticks, pour qu'un appui plus bref qu'un arrêt sur image ne se perde pas. */
  action(id: string): void {
    if (id === "coup") this.impulsionCoup = 4;
    else if (id === "esquive") this.impulsionEsquive = 4;
  }

  /** L'entrée du tick `tick` : la direction ne change pas plus d'une fois tous les `PAS_MIN_DIRECTION` ticks (la rediffusion reste courte). */
  lire(tick: number): number {
    if (this.forcee && this.forcee.reste > 0) {
      this.forcee.reste--;
      return this.forcee.e;
    }
    let dx = (this.tenues.has("droite") ? 1 : 0) - (this.tenues.has("gauche") ? 1 : 0);
    let dy = (this.tenues.has("bas") ? 1 : 0) - (this.tenues.has("haut") ? 1 : 0);
    let coup = this.tenues.has("coup") || this.boutonCoup || this.impulsionCoup > 0;
    let esquive = this.tenues.has("esquive") || this.boutonEsquive || this.impulsionEsquive > 0;
    if (this.impulsionCoup > 0) this.impulsionCoup--;
    if (this.impulsionEsquive > 0) this.impulsionEsquive--;
    let direction = directionDe8(dx, dy);
    // Le doigt prend la place du clavier ; la manette complète.
    const pad = padPourLeJeu(typeof navigator !== "undefined" ? navigator.getGamepads?.()[0] ?? undefined : undefined);
    if (pad) {
      const sx = pad.axes[0] ?? 0;
      const sy = pad.axes[1] ?? 0;
      dx = (pad.buttons[15]?.pressed ? 1 : 0) - (pad.buttons[14]?.pressed ? 1 : 0);
      dy = (pad.buttons[13]?.pressed ? 1 : 0) - (pad.buttons[12]?.pressed ? 1 : 0);
      const analogique = directionAnalogique(sx, sy);
      const croix = directionDe8(dx, dy);
      if (analogique >= 0) direction = analogique;
      else if (croix >= 0) direction = croix;
      if (this.commandes) {
        const lc = this.commandes.liaison("coup");
        const le = this.commandes.liaison("esquive");
        if (lc && liaisonTenue(lc, pad)) coup = true;
        if (le && liaisonTenue(le, pad)) esquive = true;
      }
    }
    if (Math.hypot(this.stick.x, this.stick.y) > 0.3) direction = directionAnalogique(this.stick.x, this.stick.y);
    // La limite de changement de direction : passer à l'arrêt ou en partir est immédiat, passer d'une direction à une autre attend.
    if (direction !== this.derniereDirection) {
      const libre = direction < 0 || this.derniereDirection < 0 || tick - this.tickDirection >= PAS_MIN_DIRECTION;
      if (libre) {
        this.derniereDirection = direction;
        this.tickDirection = tick;
      }
    }
    return entree(this.derniereDirection, coup, esquive);
  }
}
