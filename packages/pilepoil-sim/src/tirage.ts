import { graineDuJour, mixSeed, Rng } from "@cdj/core";
import { PILEPOIL_GENERATOR_VERSION, NB_CASES, NB_PILEPOIL } from "./constantes";

// **Le tirage du jour d'un jeu Party** (lot PA1) : il n'y a pas de générateur de niveaux — le « niveau » d'un jour est **la graine du jour** (`graineDuJour(code, jour)` de `@cdj/core`, la même au serveur) et rien
// d'autre ; le jeu en tire ses pilepoil. **Pure** : la graine vient du numéro de jour civil, jamais d'une horloge. Les pilepoil apparaissent une à une : la fenêtre de la i-ᵉ finit avant l'apparition de la suivante.

export interface Cible {
  /** La case (0 à 47, ligne par ligne). */
  c: number;
  /** Le tick d'apparition. */
  d: number;
  /** Le tick de disparition (exclu) : on peut la toucher aux ticks `d` à `f − 1`. */
  f: number;
}
export interface Contenu {
  jour: number;
  /** La version de la dérivation de la graine et du tirage (`PILEPOIL_GENERATOR_VERSION`). */
  g: number;
  /** La graine du jour : le seul niveau d'un jeu Party. */
  graine: number;
  pilepoil: Cible[];
}

export class ErreurGenerateur extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurGenerateur";
  }
}

/** Sel du tirage de Pilepoil (propre au jeu). */
const SEL = 0x2cdf7d;
const PERIODE = 42;
const DECALAGE = 20;

/** Les 20 pilepoil tirées d'une graine : une case chacune, et la fenêtre de ticks pendant laquelle on peut la toucher. */
export function tirerPilepoil(graine: number): Cible[] {
  const rng = new Rng(mixSeed(graine, SEL));
  const pilepoil: Cible[] = [];
  let avant = -1;
  for (let i = 0; i < NB_PILEPOIL; i++) {
    let c = rng.int(NB_CASES);
    if (c === avant) c = (c + 1 + rng.int(NB_CASES - 1)) % NB_CASES; // jamais deux fois la même case de suite
    avant = c;
    const d = DECALAGE + PERIODE * i + rng.int(6);
    // De plus en plus brèves : 36 ticks (1,2 s) pour la première, 27 (0,9 s) pour la dernière ; la suivante apparaît au plus tôt 37 ticks après.
    pilepoil.push({ c, d, f: d + 36 - Math.floor(i / 2) });
  }
  return pilepoil;
}

/** Le contenu d'un jour : sa graine et ce qu'on en tire. Une version inconnue de la dérivation est refusée (`ErreurGenerateur`). */
export function dailyPilepoil(jour: number, version: number = PILEPOIL_GENERATOR_VERSION): Contenu {
  if (version !== 1) throw new ErreurGenerateur(`version de tirage inconnue : ${version}`);
  const graine = graineDuJour("pilepoil", jour);
  return { jour, g: version, graine, pilepoil: tirerPilepoil(graine) };
}

/** L'empreinte du contenu (FNV-1a 32 bits sur ses entiers) : un texte de huit hexadécimaux. */
export function empreinteContenu(contenu: Contenu): string {
  let h = 0x811c9dc5;
  const octet = (n: number): void => {
    h = Math.imul(h ^ (n & 0xff), 0x01000193) >>> 0;
  };
  for (const n of [contenu.jour, contenu.g, contenu.graine, ...contenu.pilepoil.flatMap((x) => [x.c, x.d, x.f])]) {
    octet(n);
    octet(n >>> 8);
    octet(n >>> 16);
  }
  return h.toString(16).padStart(8, "0");
}
