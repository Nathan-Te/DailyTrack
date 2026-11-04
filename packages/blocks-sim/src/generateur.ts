import { mixSeed, Rng } from "@cdj/core";
import { BLOCKS_GENERATOR_VERSION, NB_CASES, NB_BLOCKS } from "./constantes";

// Le contenu du jour : 20 blocks, une case chacune, et la fenêtre de ticks pendant laquelle on peut la toucher. **Pure** : la graine vient du numéro de jour civil, jamais d'une horloge.
// Les blocks apparaissent une à une : la fenêtre de la i-ᵉ cible finit avant l'apparition de la suivante (une seule cible visible à la fois).

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
  g: number;
  blocks: Cible[];
}

export class ErreurGenerateur extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurGenerateur";
  }
}

/** Sel de la graine de Blocks (propre au jeu). */
const SEL = 0x0da1c3;
const PERIODE = 42;
const DECALAGE = 20;

/** Le contenu d'un jour. Les anciennes versions du générateur restent appelables tant qu'un jour figé les nomme (ici : une seule). */
export function dailyBlocks(jour: number, version: number = BLOCKS_GENERATOR_VERSION): Contenu {
  if (version !== 1) throw new ErreurGenerateur(`version de générateur inconnue : ${version}`);
  const rng = new Rng(mixSeed(jour, SEL));
  const blocks: Cible[] = [];
  let avant = -1;
  for (let i = 0; i < NB_BLOCKS; i++) {
    let c = rng.int(NB_CASES);
    if (c === avant) c = (c + 1 + rng.int(NB_CASES - 1)) % NB_CASES; // jamais deux fois la même case de suite
    avant = c;
    const d = DECALAGE + PERIODE * i + rng.int(6);
    // De plus en plus brèves : 36 ticks (1,2 s) pour la première, 27 (0,9 s) pour la dernière ; la suivante apparaît au plus tôt 37 ticks après.
    blocks.push({ c, d, f: d + 36 - Math.floor(i / 2) });
  }
  return { jour, g: version, blocks };
}

/** L'empreinte du contenu (FNV-1a 32 bits sur ses entiers) : un texte de huit hexadécimaux. */
export function empreinteContenu(contenu: Contenu): string {
  let h = 0x811c9dc5;
  const octet = (n: number): void => {
    h = Math.imul(h ^ (n & 0xff), 0x01000193) >>> 0;
  };
  for (const n of [contenu.jour, contenu.g, ...contenu.blocks.flatMap((x) => [x.c, x.d, x.f])]) {
    octet(n);
    octet(n >>> 8);
    octet(n >>> 16);
  }
  return h.toString(16).padStart(8, "0");
}
