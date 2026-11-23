import { graineDuJour } from "@cdj/core";
import { JAUGES, LONGUEUR, PILEPOIL_GENERATOR_VERSION } from "./constantes";
import { REGLAGES, type Reglages } from "./reglages";

// **Le tirage du jour d'un jeu Party** (lot PA1) : il n'y a pas de générateur de niveaux — le « niveau » d'un jour est **la graine du jour** (`graineDuJour(code, jour)` de `@cdj/core`, la même au serveur) et rien
// d'autre ; le jeu en tire ses dix jauges (`tirerJauges`, celui de la maquette, au tirage près). **Pur** : la graine vient du numéro de jour civil, jamais d'une horloge.

export interface Jauge {
  /** Demi-largeur de la cible. */
  demi: number;
  /** Centre de la cible (au repos). */
  centre: number;
  /** Millièmes de jauge par pas. */
  vitesse: number;
  /** Place du curseur au départ. */
  depart: number;
  /** Sens du curseur au départ. */
  sens: 1 | -1;
  /** La cible bouge (les dernières jauges). */
  bouge: boolean;
  /** Phase du mouvement de la cible, en millièmes de tour. */
  phase: number;
}
export interface Contenu {
  jour: number;
  /** La version de la dérivation de la graine et du tirage (`PILEPOIL_GENERATOR_VERSION`). */
  g: number;
  /** La graine du jour : le seul niveau d'un jeu Party. */
  graine: number;
  jauges: Jauge[];
}

export class ErreurGenerateur extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurGenerateur";
  }
}

/** Le hasard de la maquette (mulberry32) : des entiers de 32 bits sans signe. */
function hasard(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
}

/** Les dix jauges d'une graine : de jauge en jauge le curseur accélère et la cible rétrécit ; la cible bouge à partir de la jauge `bougeDes`. Entiers seulement. */
export function tirerJauges(graine: number, r: Readonly<Reglages> = REGLAGES): Jauge[] {
  const h = hasard(graine);
  const lerp = (a: number, b: number, i: number): number => a + Math.trunc(((b - a) * i) / (JAUGES - 1));
  const liste: Jauge[] = [];
  for (let i = 0; i < JAUGES; i++) {
    const demi = lerp(r.demiCibleDebut, r.demiCibleFin, i);
    const marge = demi + 60000;
    const centre = marge + (h() % Math.max(1, LONGUEUR - 2 * marge));
    const vitesse = lerp(r.vitesseDebut, r.vitesseFin, i) + (h() % 400);
    const depart = h() % LONGUEUR;
    const sens = h() % 2 ? 1 : -1;
    const bouge = i + 1 >= r.bougeDes;
    const phase = h() % 1000;
    liste.push({ demi, centre, vitesse, depart, sens, bouge, phase });
  }
  return liste;
}

/** Le contenu d'un jour : sa graine et ce qu'on en tire. Une version inconnue de la dérivation est refusée (`ErreurGenerateur`). */
export function dailyPilepoil(jour: number, version: number = PILEPOIL_GENERATOR_VERSION): Contenu {
  if (version !== 1) throw new ErreurGenerateur(`version de tirage inconnue : ${version}`);
  const graine = graineDuJour("pilepoil", jour);
  return { jour, g: version, graine, jauges: tirerJauges(graine) };
}

/** L'empreinte du contenu (FNV-1a 32 bits sur ses entiers) : un texte de huit hexadécimaux. */
export function empreinteContenu(contenu: Contenu): string {
  let h = 0x811c9dc5;
  const octet = (n: number): void => {
    h = Math.imul(h ^ (n & 0xff), 0x01000193) >>> 0;
  };
  for (const n of [contenu.jour, contenu.g, contenu.graine, ...contenu.jauges.flatMap((j) => [j.demi, j.centre, j.vitesse, j.depart, j.sens + 1, j.bouge ? 1 : 0, j.phase])]) {
    octet(n);
    octet(n >>> 8);
    octet(n >>> 16);
  }
  return h.toString(16).padStart(8, "0");
}
