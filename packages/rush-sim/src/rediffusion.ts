import { CodecError, pushVarint, readVarint } from "@cdj/core";
import { decoderEnveloppe, encoderEnveloppe, ErreurEnveloppe, type ContenuEnveloppe } from "@cdj/core/enveloppe";
import { DUREE_TICKS, MASQUE_VISEE, MAX_CARACTERES, MAX_CHANGEMENTS, MAX_CHOIX, NB_CARTES, RUSH_GENERATOR_VERSION, RUSH_SIM_VERSION } from "./constantes";
import type { Changement } from "./entrees";
import { dailyRush, type Contenu } from "./generateur";
import { Partie, type Resultat } from "./partie";
import { REGLAGES_DEFAUT, type Reglages } from "./reglagesSim";

// La rediffusion d'une partie de Rush : l'enveloppe commune des jeux neufs (`@cdj/core/enveloppe`) et, pour charge, **la suite des changements de l'entrée** : pour chacun, le nombre de ticks depuis le changement
// précédent (entier de longueur variable) puis l'entrée sur deux octets (lot BR0b : l'octet bas = direction, coup, esquive ; l'octet haut = la visée ; `entrees.ts`). Une partie est la suite de ses entrées : tout le reste
// se rejoue. Une entrée qui ne change pas ne s'écrit pas.
// **Lot BR2 : le CHOIX d'une amélioration est un événement d'entrée** (`Choix` : le niveau gagné et l'index de la carte choisie, 0 à 2). Dans la charge, c'est une entrée comme les autres (l'écart en ticks, puis deux octets) mais dont l'octet haut vaut
// `64 + index` (une visée ne dépasse jamais 63) et l'octet bas le niveau. Le monde est figé pendant le choix : le tick d'un choix est celui du niveau gagné. **Le serveur le valide en rejouant** (`jouer`) : un choix n'est accepté qu'à un niveau
// gagné, au niveau qui vient d'être gagné, avec une carte qui existe ; il manque un choix, ou il en reste un de trop : la rediffusion est refusée.

export const LIMITES = { maxCaracteres: MAX_CARACTERES, sims: [RUSH_SIM_VERSION], generateurs: [RUSH_GENERATOR_VERSION] } as const;

export type CodeRefus = "format_illisible" | "version_inconnue" | "trop_longue" | "contenu_different" | "choix_invalide";
export class ErreurRediffusion extends Error {
  constructor(
    readonly code: CodeRefus,
    message: string,
  ) {
    super(message);
    this.name = "ErreurRediffusion";
  }
}

/** Lot BR2 : le choix d'une amélioration : le niveau gagné (`nv`) et l'index de la carte choisie parmi les trois (`carte`, 0 à 2), au tick `tick` (celui du niveau gagné). */
export interface Choix {
  tick: number;
  nv: number;
  carte: number;
}
/** Le premier octet haut d'un choix (une visée est de 0 à 63). */
const CHOIX_HAUT = 64;

export interface Rediffusion {
  sim: number;
  g: number;
  contenu: ContenuEnveloppe;
  changements: Changement[];
  choix: Choix[];
}

/** Les octets de la charge pour une suite de changements (ticks croissants) et les choix d'amélioration, fondus dans l'ordre des ticks (à tick égal, le choix d'abord : il a lieu entre deux ticks). */
export function chargeDe(changements: readonly Changement[], choix: readonly Choix[] = []): number[] {
  const o: number[] = [];
  let avant = 0;
  let i = 0;
  let j = 0;
  while (i < changements.length || j < choix.length) {
    if (j < choix.length && (i >= changements.length || choix[j]!.tick <= changements[i]!.tick)) {
      const c = choix[j++]!;
      pushVarint(o, c.tick - avant);
      o.push(c.nv & 255, CHOIX_HAUT + c.carte);
      avant = c.tick;
    } else {
      const t = changements[i++]!;
      pushVarint(o, t.tick - avant);
      o.push(t.e & 255, (t.e >> 8) & 255);
      avant = t.tick;
    }
  }
  return o;
}

export function lireCharge(charge: readonly number[]): { changements: Changement[]; choix: Choix[] } {
  const changements: Changement[] = [];
  const choix: Choix[] = [];
  let i = 0;
  const suivant = (): number => {
    if (i >= charge.length) throw new CodecError("charge tronquée");
    return charge[i++]!;
  };
  let tick = 0;
  try {
    while (i < charge.length) {
      tick += readVarint(suivant, 14);
      const bas = suivant();
      const haut = suivant();
      if (tick >= DUREE_TICKS) throw new ErreurRediffusion("format_illisible", "changement après la fin de la partie");
      if (haut >= CHOIX_HAUT) {
        // Lot BR2 : un choix d'amélioration (le niveau gagné, la carte 0 à 2).
        if (haut >= CHOIX_HAUT + NB_CARTES || bas === 0) throw new ErreurRediffusion("format_illisible", "choix illisible");
        if (choix.length >= MAX_CHOIX) throw new ErreurRediffusion("trop_longue", "trop de choix");
        choix.push({ tick, nv: bas, carte: haut - CHOIX_HAUT });
        continue;
      }
      if (haut > MASQUE_VISEE) throw new ErreurRediffusion("format_illisible", "visée illisible");
      if (changements.length >= MAX_CHANGEMENTS) throw new ErreurRediffusion("trop_longue", "trop de changements");
      changements.push({ tick, e: bas | (haut << 8) });
    }
  } catch (e) {
    if (e instanceof CodecError) throw new ErreurRediffusion("format_illisible", e.message);
    throw e;
  }
  return { changements, choix };
}

export function encoderRediffusion(r: Omit<Rediffusion, "choix"> & { choix?: readonly Choix[] }): string {
  return encoderEnveloppe({ sim: r.sim, g: r.g, contenu: r.contenu, charge: chargeDe(r.changements, r.choix ?? []) });
}

/** Le texte → la rediffusion, ou une `ErreurRediffusion` (jamais une exception brute). */
export function decoderRediffusion(texte: unknown): Rediffusion {
  try {
    const e = decoderEnveloppe(texte, LIMITES);
    return { sim: e.sim, g: e.g, contenu: e.contenu, ...lireCharge(e.charge) };
  } catch (e) {
    if (e instanceof ErreurEnveloppe) throw new ErreurRediffusion(e.code, e.message);
    throw e;
  }
}

/**
 * Le prochain choix d'un joueur (ou du rejeu) quand la partie en attend un : applique `choix[k]` s'il est valable. Rend `false` quand la partie n'attend pas de choix, que la liste est épuisée ou que le choix est refusé.
 * Lot BR2 : c'est ici que le serveur valide les choix (`Partie.choisir` refuse un niveau qui n'est pas celui du choix en attente et une carte qui n'existe pas).
 */
function appliquerChoix(p: Partie, choix: readonly Choix[], k: number): boolean {
  const c = choix[k];
  return c !== undefined && p.choisir(c.nv, c.carte);
}

/** Les choix sont tous consommés et le dernier niveau gagné a son choix : sinon la rediffusion est refusée. */
function verifierChoix(p: Partie, choix: readonly Choix[], consommes: number): void {
  if (p.choix) throw new ErreurRediffusion("choix_invalide", "un niveau gagné n'a pas de choix");
  if (consommes < choix.length) throw new ErreurRediffusion("choix_invalide", "un choix n'a pas de niveau gagné");
}

/** Joue une partie entière : l'octet en vigueur à chaque tick est celui du dernier changement. La partie finit à la chute du golem, à la mort du chevalier ou à `DUREE_TICKS`. Lot BR2 : à chaque niveau gagné, le choix suivant de `choix` est appliqué ; un choix manquant, refusé ou en trop lève `choix_invalide`. */
export function jouer(contenu: Contenu, changements: readonly Changement[], reglages: Reglages = REGLAGES_DEFAUT, choix: readonly Choix[] = []): Resultat {
  const p = new Partie(contenu, reglages);
  let k = 0;
  let e = 0;
  let kc = 0;
  while (!p.finie) {
    if (p.choix) {
      if (!appliquerChoix(p, choix, kc++)) throw new ErreurRediffusion("choix_invalide", "choix absent ou refusé");
      continue;
    }
    // Le changement de l'indice `t` vaut à partir du tick `t` (le tick qui s'apprête à être joué est `p.tick + 1`).
    while (k < changements.length && changements[k]!.tick <= p.tick) e = changements[k++]!.e;
    p.avancer(e);
  }
  verifierChoix(p, choix, kc);
  return p.resultat();
}

/** Joue `n` ticks au plus (une partie de scénario sans fin, un essai de mesure) et rend l'empreinte de l'état final avec le résultat. Un choix manquant arrête la partie à ce niveau gagné (aucune erreur : c'est un essai). */
export function jouerJusqua(contenu: Contenu, changements: readonly Changement[], n: number, reglages: Reglages = REGLAGES_DEFAUT, choix: readonly Choix[] = []): { resultat: Resultat; empreinte: string; ticks: number } {
  const p = new Partie(contenu, reglages);
  let k = 0;
  let e = 0;
  let kc = 0;
  while (!p.finie && p.tick < n) {
    if (p.choix) {
      if (!appliquerChoix(p, choix, kc++)) break;
      continue;
    }
    while (k < changements.length && changements[k]!.tick <= p.tick) e = changements[k++]!.e;
    p.avancer(e);
  }
  return { resultat: p.resultat(), empreinte: p.empreinte(), ticks: p.tick };
}

/** Rejoue une rediffusion sur le contenu donné : le même code que le jeu. Un autre jour ou une autre version du générateur est refusé (`contenu_different`). */
export function rejouer(contenu: Contenu, rediffusion: string | Rediffusion): Resultat {
  const r = typeof rediffusion === "string" ? decoderRediffusion(rediffusion) : rediffusion;
  if (!("jour" in r.contenu) || contenu.scenario !== "jour" || r.contenu.jour !== contenu.jour || r.g !== contenu.g) throw new ErreurRediffusion("contenu_different", "cette rediffusion n'est pas celle de ce jour");
  return jouer(contenu, r.changements, REGLAGES_DEFAUT, r.choix);
}

/** Les choix d'un joueur qui prend toujours la même carte (`carte`, 0 à 2) à chaque niveau gagné, pour des entrées données (les essais du serveur, les références) : la partie est jouée jusqu'au bout pour les trouver. */
export function choixParDefaut(contenu: Contenu, changements: readonly Changement[], carte = 0, reglages: Reglages = REGLAGES_DEFAUT): Choix[] {
  const p = new Partie(contenu, reglages);
  const choix: Choix[] = [];
  let k = 0;
  let e = 0;
  while (!p.finie) {
    if (p.choix) {
      choix.push({ tick: p.tick, nv: p.choix.nv, carte });
      p.choisir(p.choix.nv, carte);
      continue;
    }
    while (k < changements.length && changements[k]!.tick <= p.tick) e = changements[k++]!.e;
    p.avancer(e);
  }
  return choix;
}

/** La rediffusion d'une partie du jour (le texte à envoyer). */
export function enregistrer(contenu: Contenu, changements: readonly Changement[], choix: readonly Choix[] = []): string {
  return encoderRediffusion({ sim: RUSH_SIM_VERSION, g: contenu.g, contenu: { jour: contenu.jour }, changements: [...changements], choix: [...choix] });
}

export { dailyRush };
