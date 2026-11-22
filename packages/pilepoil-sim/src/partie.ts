import { JAUGES, LONGUEUR } from "./constantes";
import { REGLAGES, type Reglages } from "./reglages";
import { sinus } from "./sinus";
import type { Jauge } from "./tirage";

// La partie, reprise de la maquette : un état, un pas (`avancer`, 1/120 s), un appui (`appuyer`). Tout est entier. Un appui arrête le curseur de la jauge en cours : les points dépendent de l'écart au centre de la
// cible (100 au centre, 0 hors de la cible) ; à `parfait` près c'est un « pile » : 100 points et un bonus qui grimpe quand on enchaîne. Puis une pause (`pauseResultat` pas) et la jauge suivante.
// **La partie ne dépend que des jauges, des réglages et des pas où l'on a appuyé** : c'est ce que le serveur rejoue (`rejouer`, `rediffusion.ts`).

export type Sorte = "pile" | "bien" | "touche" | "rate";

export interface ResultatJauge {
  points: number;
  bonus: number;
  sorte: Sorte;
  /** La place du curseur et du centre de la cible à l'arrêt, la demi-cible. */
  x: number;
  c: number;
  demi: number;
  /** Faux : la jauge a été ratée faute d'appui (`attenteMax`). */
  appui: boolean;
}

export interface Resultat {
  /** Le score : les points et les bonus des dix jauges. */
  score: number;
  /** Les « pile » de la partie (le départage du classement). */
  piles: number;
  /** Le plus long enchaînement de « pile ». */
  enchaineMax: number;
  /** Les jauges ratées (hors de la cible, ou sans appui). */
  ratees: number;
  /** Les pas joués. */
  ticks: number;
}

export class Partie {
  /** La jauge en cours (0 à 9 ; 10 : la partie est finie). */
  i = 0;
  /** Les pas depuis le début de la partie. */
  pas = 0;
  /** Les pas depuis le début de la jauge en cours. */
  pasJauge = 0;
  /** La place du curseur et son sens. */
  x = 0;
  sens: 1 | -1 = 1;
  /** Les pas d'arrêt qui restent (le résultat de l'appui se montre) ; 0 : le curseur court. */
  pause = 0;
  score = 0;
  /** Les « pile » d'affilée. */
  enchaine = 0;
  enchaineMax = 0;
  fini = false;
  /** Le curseur a rebondi au dernier pas (le « tic » du rendu). */
  rebond = false;
  readonly resultats: ResultatJauge[] = [];
  /** Les pas des appuis : la rediffusion. */
  readonly appuis: number[] = [];

  constructor(
    readonly jauges: readonly Jauge[],
    readonly r: Readonly<Reglages> = REGLAGES,
  ) {
    this.entrer();
  }

  /** La jauge en cours (la dernière quand la partie est finie). */
  get jauge(): Jauge {
    return this.jauges[Math.min(this.i, JAUGES - 1)]!;
  }

  /** Le dernier résultat (montré pendant la pause), ou `null`. */
  get dernier(): ResultatJauge | null {
    return this.resultats[this.resultats.length - 1] ?? null;
  }

  private entrer(): void {
    const j = this.jauge;
    this.x = j.depart;
    this.sens = j.sens;
    this.pasJauge = 0;
  }

  /** Le centre de la cible de la jauge en cours, à ce pas : fixe, ou qui bouge (sinus en table) sans sortir de la jauge. */
  centreCible(): number {
    const j = this.jauge;
    if (!j.bouge) return j.centre;
    const angle = (j.phase + this.pasJauge * this.r.vitesseBouge) % 1000;
    const c = j.centre + Math.trunc((sinus(angle) * this.r.ampliBouge) / 1000);
    return Math.max(j.demi, Math.min(LONGUEUR - j.demi, c));
  }

  /** On peut appuyer : le curseur court (ni pause, ni fin). */
  get enJeu(): boolean {
    return !this.fini && this.pause === 0;
  }

  avancer(): void {
    this.rebond = false;
    if (this.fini) return;
    this.pas++;
    if (this.pause > 0) {
      this.pause--;
      if (this.pause === 0) {
        this.i++;
        if (this.i >= JAUGES) {
          this.fini = true;
          return;
        }
        this.entrer();
      }
      return;
    }
    const j = this.jauge;
    this.pasJauge++;
    this.x += this.sens * j.vitesse;
    if (this.x >= LONGUEUR) {
      this.x = 2 * LONGUEUR - this.x;
      this.sens = -1;
      this.rebond = true;
    }
    if (this.x <= 0) {
      this.x = -this.x;
      this.sens = 1;
      this.rebond = true;
    }
    if (this.pasJauge >= this.r.attenteMax) this.conclure(false); // trop tard : la jauge est ratée
  }

  /** Un appui à ce pas. Rend le résultat de la jauge, ou `null` si l'appui ne compte pas (pendant la pause, après la fin). */
  appuyer(): ResultatJauge | null {
    if (!this.enJeu) return null;
    this.appuis.push(this.pas);
    return this.conclure(true);
  }

  private conclure(appui: boolean): ResultatJauge {
    const j = this.jauge;
    const c = this.centreCible();
    const ecart = Math.abs(this.x - c);
    let points = 0;
    let sorte: Sorte = "rate";
    let bonus = 0;
    if (appui && ecart <= j.demi) {
      points = Math.trunc((100 * (j.demi - ecart)) / j.demi);
      sorte = ecart <= this.r.parfait ? "pile" : points >= 70 ? "bien" : "touche";
    }
    if (sorte === "pile") {
      bonus = this.r.bonusParfait + this.enchaine * this.r.bonusEnchaine;
      this.enchaine++;
      this.enchaineMax = Math.max(this.enchaineMax, this.enchaine);
      points = 100;
    } else this.enchaine = 0;
    this.score += points + bonus;
    const res: ResultatJauge = { points, bonus, sorte, x: this.x, c, demi: j.demi, appui };
    this.resultats.push(res);
    this.pause = this.r.pauseResultat;
    return res;
  }

  resultat(): Resultat {
    return { score: this.score, piles: this.resultats.filter((x) => x.sorte === "pile").length, enchaineMax: this.enchaineMax, ratees: this.resultats.filter((x) => x.sorte === "rate").length, ticks: this.pas };
  }
}

/** Le plus de pas qu'une partie peut durer (chaque jauge attendue jusqu'au bout) : la borne du rejeu. */
export const maxPas = (r: Readonly<Reglages> = REGLAGES): number => JAUGES * (r.attenteMax + r.pauseResultat);

/** Un appui qui ne peut pas avoir eu lieu (pendant une pause, après la fin) : la rediffusion est refusée. */
export class AppuiImpossible extends Error {
  constructor(readonly pas: number) {
    super(`appui impossible au pas ${pas}`);
    this.name = "AppuiImpossible";
  }
}

/** Joue une partie entière : les appuis (pas croissants) sont appliqués à leur pas, avant d'avancer, comme dans le jeu. Un appui impossible lève `AppuiImpossible`. */
export function jouer(jauges: readonly Jauge[], appuis: readonly number[], r: Readonly<Reglages> = REGLAGES): Resultat {
  const p = new Partie(jauges, r);
  let k = 0;
  const borne = maxPas(r) + 1;
  for (let garde = 0; garde < borne && !p.fini; garde++) {
    while (k < appuis.length && appuis[k] === p.pas) {
      if (!p.appuyer()) throw new AppuiImpossible(appuis[k]!);
      k++;
    }
    if (k < appuis.length && appuis[k]! < p.pas) throw new AppuiImpossible(appuis[k]!);
    p.avancer();
  }
  if (k < appuis.length) throw new AppuiImpossible(appuis[k]!);
  return p.resultat();
}

/** Les pas d'un joueur scripté qui appuie quand le curseur est à `ecart(rang)` du centre de la cible (en millièmes de jauge), ou jamais pour un rang où `ecart` rend `null` : les tests, le golden et les essais. */
export function joueurScripte(jauges: readonly Jauge[], ecart: (rang: number) => number | null, r: Readonly<Reglages> = REGLAGES): number[] {
  const p = new Partie(jauges, r);
  const borne = maxPas(r) + 1;
  for (let garde = 0; garde < borne && !p.fini; garde++) {
    const voulu = p.enJeu ? ecart(p.i) : null;
    if (voulu !== null && Math.abs(p.x - p.centreCible()) <= voulu) p.appuyer();
    p.avancer();
  }
  return [...p.appuis];
}
