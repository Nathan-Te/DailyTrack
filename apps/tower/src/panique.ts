import { boitesE, type Echelles, sinCos, type VuePartie, type VuePiece } from "@cdj/tower-sim";

// La panique des pièces (lot T5) — **de l'affichage seulement, dérivé de la vue de la partie** : ce module lit une `VuePartie` et rend, pour chaque pièce, un niveau de 0 (calme) à 3 (affolé).
// La simulation ne lit rien de ce qui est calculé ici et rien d'ici n'entre dans une rediffusion. Aucun hasard, aucune horloge : seulement la vue et son numéro de tick.
//
// Pour une pièce POSÉE (libre), quatre facteurs de 0 à 1 :
//   - la vitesse (m/s, tirée du déplacement entre deux ticks), 4 m/s = 1 ;
//   - l'inclinaison : l'écart à un quart de tour (une pièce couchée sur sa tranche n'est pas penchée), π/6 = 1 ;
//   - le porte-à-faux : la part de sa largeur qui n'est pas au-dessus d'un appui (une pièce, ou la plateforme) ;
//   - l'oscillation de la tour : combien de pièces lentes bougent encore (la tour tangue).
// La PIÈCE ACTIVE panique en approchant du vide : la part de sa largeur qui n'a rien dessous, d'autant plus qu'elle est près d'une surface (`vide` × proximité) ; posée bien à plat, elle se détend.
// La valeur brute est lissée (monte vite, redescend lentement) puis rangée en quatre états, avec une petite hystérésis : les yeux ne scintillent pas.

export type Niveau = 0 | 1 | 2 | 3;
export const NOMS_NIVEAUX = ["calme", "inquiet", "panique", "affole"] as const;
/** Les valeurs qui font passer au niveau 1, 2 et 3. */
export const SEUILS_PANIQUE = [0.18, 0.4, 0.65] as const;
/** Pour redescendre d'un niveau il faut passer sous son seuil de cette marge. */
export const HYSTERESIS = 0.04;

export interface Facteurs {
  vitesse: number;
  inclinaison: number;
  porteAFaux: number;
  oscillation: number;
}
export const POIDS_PANIQUE: Readonly<Facteurs> = { vitesse: 0.35, inclinaison: 0.3, porteAFaux: 0.3, oscillation: 0.35 };
/** Vitesse (m/s) qui vaut 1, inclinaison (rad) qui vaut 1, et vitesse d'une pièce « lente » qui compte dans l'oscillation. */
export const VITESSE_REF = 4;
export const INCLINAISON_REF = Math.PI / 6;
const VITESSE_LENTE = 1.5;
/** Pièces qui tanguent en même temps pour une oscillation de 1. */
const PIECES_OSCILLATION = 4;
/** Lissage par tick : montée rapide, descente lente. */
const MONTEE = 0.3;
const DESCENTE = 0.03;
const PAS_DE_TEMPS = 1 / 60;

const borne = (v: number, min = 0, max = 1): number => Math.min(max, Math.max(min, v));

/** La valeur brute (0 à 1) d'une pièce posée d'après ses quatre facteurs, multipliée par le gain du réglage de rendu. Pure, bornée. */
export function paniqueDeFacteurs(f: Facteurs, gain = 1): number {
  const s = POIDS_PANIQUE.vitesse * borne(f.vitesse) + POIDS_PANIQUE.inclinaison * borne(f.inclinaison) + POIDS_PANIQUE.porteAFaux * borne(f.porteAFaux) + POIDS_PANIQUE.oscillation * borne(f.oscillation);
  return borne(s * gain);
}

/** La valeur brute de la pièce active : `vide` (0 à 1, la part de sa largeur sans rien dessous) et `distance` (m) jusqu'à la surface qu'elle va toucher. */
export function paniqueDeLActive(vide: number, distance: number, gain = 1): number {
  const proximite = borne(1 - distance / 6);
  return borne(borne(vide) * (0.1 + 0.9 * proximite * proximite) * gain);
}

/** Le niveau d'une valeur lissée, d'après le niveau précédent (hystérésis). */
export function niveauDe(valeur: number, precedent: Niveau): Niveau {
  let n = precedent;
  while (n < 3 && valeur >= SEUILS_PANIQUE[n as 0 | 1 | 2]) n = (n + 1) as Niveau;
  while (n > 0 && valeur < SEUILS_PANIQUE[(n - 1) as 0 | 1 | 2] - HYSTERESIS) n = (n - 1) as Niveau;
  return n;
}

/** Lisse `precedente` vers `cible` : monte vite, redescend lentement (par tick). */
export const lisser = (precedente: number, cible: number): number => precedente + (cible - precedente) * (cible > precedente ? MONTEE : DESCENTE);

export interface Etendue {
  gauche: number;
  droite: number;
  bas: number;
  haut: number;
}

/** L'enveloppe (mètres) d'une pièce : centre en (x, y), angle `angle`. */
export function etendueDe(p: Pick<VuePiece, "kind" | "rot" | "taille" | "x" | "y" | "angle">, echelles?: Echelles): Etendue {
  const { s, c } = sinCos(p.angle);
  const e: Etendue = { gauche: Infinity, droite: -Infinity, bas: Infinity, haut: -Infinity };
  for (const b of boitesE(p.kind, p.rot, p.taille, echelles)) {
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const xl = (b.cx + sx * b.hw) / 8;
        const yl = (b.cy + sy * b.hh) / 8;
        const x = p.x + xl * c - yl * s;
        const y = p.y + xl * s + yl * c;
        if (x < e.gauche) e.gauche = x;
        if (x > e.droite) e.droite = x;
        if (y < e.bas) e.bas = y;
        if (y > e.haut) e.haut = y;
      }
    }
  }
  return e;
}

/** L'écart d'un angle à un quart de tour (0 à π/4) : une pièce couchée sur sa tranche est droite. */
export function inclinaisonDe(angle: number): number {
  const q = Math.PI / 2;
  const r = ((angle % q) + q) % q;
  return Math.min(r, q - r);
}

/** La longueur de `[g, d]` couverte par l'union des intervalles `couverts` (déjà quelconques). */
export function longueurCouverte(g: number, d: number, couverts: readonly (readonly [number, number])[]): number {
  const iv = couverts.map(([a, b]) => [Math.max(g, a), Math.min(d, b)] as const).filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  let total = 0;
  let fin = -Infinity;
  for (const [a, b] of iv) {
    if (b <= fin) continue;
    total += b - Math.max(a, fin);
    fin = b;
  }
  return total;
}

export interface PaniquePiece {
  id: number;
  /** La valeur lissée (0 à 1) et son niveau (0 à 3). */
  valeur: number;
  niveau: Niveau;
  /** Lectures utiles à l'expression : la vitesse (m/s) et le porte-à-faux. */
  vitesse: number;
  porteAFaux: number;
}

interface Memoire {
  x: number;
  y: number;
  tick: number;
  valeur: number;
  niveau: Niveau;
  vitesse: number;
}

/** L'analyseur d'une partie : à appeler une fois par tick avec la vue ; il garde ce qu'il faut d'un tick à l'autre (positions, valeurs lissées). */
export class AnalyseurPanique {
  private memoire = new Map<number, Memoire>();
  private derniereOscillation = 0;
  private dernierTick = -1;
  private resultat = new Map<number, PaniquePiece>();
  private affoles: number[] = [];
  private oscillationLissee = 0;

  constructor(
    private readonly plateformeDemi8: number,
    private readonly echelles?: Echelles,
    /** Le gain du réglage de rendu (1 : normal, 0 : jamais de panique). */
    private readonly gain: () => number = () => 1,
  ) {}

  /** L'oscillation de la tour (0 à 1), lissée. */
  get oscillation(): number {
    return this.derniereOscillation;
  }

  /** Les pièces qui viennent de passer au niveau le plus affolé, au dernier `analyser`. */
  get nouveauxAffoles(): readonly number[] {
    return this.affoles;
  }

  analyser(vue: VuePartie): ReadonlyMap<number, PaniquePiece> {
    if (vue.tick === this.dernierTick) return this.resultat;
    const dtTicks = this.dernierTick < 0 ? 1 : Math.max(1, vue.tick - this.dernierTick);
    this.dernierTick = vue.tick;
    const g = this.gain();
    const posees = vue.pieces.filter((p) => p.etat === "libre");
    const ext = new Map<number, Etendue>();
    for (const p of vue.pieces) if (p.etat === "libre" || p.etat === "active") ext.set(p.id, etendueDe(p, this.echelles));
    const demi = this.plateformeDemi8 / 8;
    const vitesses = new Map<number, number>();
    for (const p of vue.pieces) {
      const m = this.memoire.get(p.id);
      const dt = m ? Math.max(1, vue.tick - m.tick) * PAS_DE_TEMPS : 0;
      vitesses.set(p.id, m && dt > 0 && !p.endormie ? Math.hypot(p.x - m.x, p.y - m.y) / dt : 0);
    }
    // L'oscillation : combien de pièces posées, éveillées et lentes bougent encore.
    let agite = 0;
    for (const p of posees) {
      const v = vitesses.get(p.id) ?? 0;
      if (!p.fixe && !p.endormie && v < VITESSE_LENTE) agite += Math.min(v, VITESSE_LENTE) / VITESSE_LENTE;
    }
    this.oscillationLissee = lisser(this.oscillationLissee, borne(agite / PIECES_OSCILLATION));
    this.derniereOscillation = this.oscillationLissee;
    const suivant = new Map<number, Memoire>();
    const sortie = new Map<number, PaniquePiece>();
    this.affoles = [];
    for (const p of vue.pieces) {
      const m = this.memoire.get(p.id);
      const vitesse = vitesses.get(p.id) ?? 0;
      let brute = 0;
      let porteAFaux = 0;
      if (p.etat === "libre") {
        const e = ext.get(p.id)!;
        const largeur = Math.max(1e-6, e.droite - e.gauche);
        const couverts: (readonly [number, number])[] = [];
        if (e.bas <= 0.12) couverts.push([-demi, demi]);
        for (const q of posees) {
          if (q.id === p.id) continue;
          const eq = ext.get(q.id)!;
          if (eq.haut >= e.bas - 0.12 && eq.haut <= e.bas + 0.5) couverts.push([eq.gauche, eq.droite]);
        }
        const couvert = longueurCouverte(e.gauche, e.droite, couverts);
        // Sans aucun appui (une pièce emportée par un effondrement, en plein vide) : tout en porte-à-faux.
        porteAFaux = 1 - couvert / largeur;
        brute = paniqueDeFacteurs({ vitesse: vitesse / VITESSE_REF, inclinaison: inclinaisonDe(p.angle) / INCLINAISON_REF, porteAFaux, oscillation: this.oscillationLissee * (p.endormie ? 0.5 : 1) }, g);
      } else if (p.etat === "active") {
        const e = ext.get(p.id)!;
        const couverts: (readonly [number, number])[] = [];
        let surface = -Infinity;
        const sous = (a: number, b: number, haut: number): void => {
          if (haut > e.bas + 0.1) return; // pas sous la pièce
          if (Math.min(e.droite, b) - Math.max(e.gauche, a) <= 0) return;
          couverts.push([a, b]);
          if (haut > surface) surface = haut;
        };
        sous(-demi, demi, 0);
        for (const q of posees) sous(ext.get(q.id)!.gauche, ext.get(q.id)!.droite, ext.get(q.id)!.haut);
        const vide = 1 - longueurCouverte(e.gauche, e.droite, couverts) / Math.max(1e-6, e.droite - e.gauche);
        porteAFaux = vide;
        brute = paniqueDeLActive(vide, e.bas - (Number.isFinite(surface) ? surface : 0), g);
      }
      const valeur = lisser(m?.valeur ?? 0, brute);
      const niveau = niveauDe(valeur, m?.niveau ?? 0);
      if (niveau === 3 && (m?.niveau ?? 0) < 3) this.affoles.push(p.id);
      suivant.set(p.id, { x: p.x, y: p.y, tick: vue.tick, valeur, niveau, vitesse });
      sortie.set(p.id, { id: p.id, valeur, niveau, vitesse, porteAFaux });
    }
    void dtTicks;
    this.memoire = suivant;
    this.resultat = sortie;
    return sortie;
  }

  /** Une nouvelle partie : plus rien ne se souvient. */
  reinitialiser(): void {
    this.memoire.clear();
    this.resultat = new Map();
    this.affoles = [];
    this.dernierTick = -1;
    this.oscillationLissee = 0;
    this.derniereOscillation = 0;
  }
}
