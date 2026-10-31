import { NIVEAU_MER } from "./profondeurs";

// La gerbe d'eau aplatie (lot T5) : quand une pièce tombée touche la mer, quelques gouttes en aplat jaillissent bas et large, plus deux ondes plates qui s'étalent sur la surface. **Affichage
// seulement**, plafonné (`GOUTTES_MAX`) et à vie courte ; le hasard est celui de l'affichage (`hasardAffichage.ts`). Coupée par `prefers-reduced-motion` (la scène ne la déclenche pas).

export const GOUTTES_MAX = 36;
export const VIE_GOUTTE = 0.55;
export const VIE_ONDE = 0.7;
const GRAVITE = 11;

export interface Goutte {
  genre: "goutte" | "onde";
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Taille (m) : le côté d'une goutte, la demi-largeur d'une onde au bout de sa vie. */
  taille: number;
  age: number;
  vie: number;
}

export class Gerbe {
  private readonly liste: Goutte[] = [];

  /** `force` (0 à 1) : la taille de la pièce, donc la hauteur du jet ; `hasard` : celui de l'affichage. */
  declencher(x: number, force: number, hasard: () => number): void {
    const f = Math.min(1, Math.max(0, force));
    const n = 5 + Math.round(f * 6);
    for (let i = 0; i < n; i++) {
      const cote = hasard() < 0.5 ? -1 : 1;
      this.ajouter({ genre: "goutte", x: x + (hasard() - 0.5) * 0.5, y: NIVEAU_MER, vx: cote * (0.8 + hasard() * 2.8) * (0.7 + f * 0.5), vy: 1.4 + hasard() * 2.2 + f * 1.4, taille: 0.1 + hasard() * 0.1 + f * 0.08, age: 0, vie: VIE_GOUTTE });
    }
    for (const cote of [-1, 1]) this.ajouter({ genre: "onde", x, y: NIVEAU_MER, vx: cote * (1.2 + f * 1.4), vy: 0, taille: 0.7 + f * 0.9, age: 0, vie: VIE_ONDE });
  }

  private ajouter(g: Goutte): void {
    if (this.liste.length >= GOUTTES_MAX) this.liste.shift();
    this.liste.push(g);
  }

  avancer(dt: number): void {
    for (const g of this.liste) {
      g.age += dt;
      g.x += g.vx * dt;
      if (g.genre === "goutte") {
        g.vy -= GRAVITE * dt;
        g.y += g.vy * dt;
        if (g.y < NIVEAU_MER) g.age = g.vie; // retombée dans l'eau
      }
    }
    for (let i = this.liste.length - 1; i >= 0; i--) if (this.liste[i]!.age >= this.liste[i]!.vie) this.liste.splice(i, 1);
  }

  get gouttes(): readonly Goutte[] {
    return this.liste;
  }

  vider(): void {
    this.liste.length = 0;
  }
}
