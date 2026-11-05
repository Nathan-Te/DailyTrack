import { CodecError, pushVarint, readVarint } from "@cdj/core";
import { decoderEnveloppe, encoderEnveloppe, ErreurEnveloppe, type ContenuEnveloppe } from "@cdj/core/enveloppe";
import { DUREE_TICKS, MAX_CARACTERES, MAX_CHANGEMENTS, RUSH_GENERATOR_VERSION, RUSH_SIM_VERSION } from "./constantes";
import type { Changement } from "./entrees";
import { dailyRush, type Contenu } from "./generateur";
import { Partie, type Resultat } from "./partie";
import { REGLAGES_DEFAUT, type Reglages } from "./reglagesSim";

// La rediffusion d'une partie de Rush : l'enveloppe commune des jeux neufs (`@cdj/core/enveloppe`) et, pour charge, **la suite des changements de l'octet d'entrée** : pour chacun, le nombre de ticks depuis le changement
// précédent (entier de longueur variable) puis l'octet (direction, coup, esquive : `entrees.ts`). Une partie est la suite de ses entrées : tout le reste se rejoue. Un octet qui ne change pas ne s'écrit pas.

export const LIMITES = { maxCaracteres: MAX_CARACTERES, sims: [RUSH_SIM_VERSION], generateurs: [RUSH_GENERATOR_VERSION] } as const;

export type CodeRefus = "format_illisible" | "version_inconnue" | "trop_longue" | "contenu_different";
export class ErreurRediffusion extends Error {
  constructor(
    readonly code: CodeRefus,
    message: string,
  ) {
    super(message);
    this.name = "ErreurRediffusion";
  }
}

export interface Rediffusion {
  sim: number;
  g: number;
  contenu: ContenuEnveloppe;
  changements: Changement[];
}

/** Les octets de la charge pour une suite de changements (ticks croissants). */
export function chargeDe(changements: readonly Changement[]): number[] {
  const o: number[] = [];
  let avant = 0;
  for (const t of changements) {
    pushVarint(o, t.tick - avant);
    o.push(t.e);
    avant = t.tick;
  }
  return o;
}

export function lireCharge(charge: readonly number[]): Changement[] {
  const changements: Changement[] = [];
  let i = 0;
  const suivant = (): number => {
    if (i >= charge.length) throw new CodecError("charge tronquée");
    return charge[i++]!;
  };
  let tick = 0;
  try {
    while (i < charge.length) {
      tick += readVarint(suivant, 14);
      const e = suivant();
      if (tick >= DUREE_TICKS) throw new ErreurRediffusion("format_illisible", "changement après la fin de la partie");
      if (changements.length >= MAX_CHANGEMENTS) throw new ErreurRediffusion("trop_longue", "trop de changements");
      changements.push({ tick, e });
    }
  } catch (e) {
    if (e instanceof CodecError) throw new ErreurRediffusion("format_illisible", e.message);
    throw e;
  }
  return changements;
}

export function encoderRediffusion(r: Rediffusion): string {
  return encoderEnveloppe({ sim: r.sim, g: r.g, contenu: r.contenu, charge: chargeDe(r.changements) });
}

/** Le texte → la rediffusion, ou une `ErreurRediffusion` (jamais une exception brute). */
export function decoderRediffusion(texte: unknown): Rediffusion {
  try {
    const e = decoderEnveloppe(texte, LIMITES);
    return { sim: e.sim, g: e.g, contenu: e.contenu, changements: lireCharge(e.charge) };
  } catch (e) {
    if (e instanceof ErreurEnveloppe) throw new ErreurRediffusion(e.code, e.message);
    throw e;
  }
}

/** Joue une partie entière : l'octet en vigueur à chaque tick est celui du dernier changement. La partie finit à la chute du golem, à la mort du chevalier ou à `DUREE_TICKS`. */
export function jouer(contenu: Contenu, changements: readonly Changement[], reglages: Reglages = REGLAGES_DEFAUT): Resultat {
  const p = new Partie(contenu, reglages);
  let k = 0;
  let e = 0;
  while (!p.finie) {
    // Le changement de l'indice `t` vaut à partir du tick `t` (le tick qui s'apprête à être joué est `p.tick + 1`).
    while (k < changements.length && changements[k]!.tick <= p.tick) e = changements[k++]!.e;
    p.avancer(e);
  }
  return p.resultat();
}

/** Joue `n` ticks au plus (une partie de scénario sans fin, un essai de mesure) et rend l'empreinte de l'état final avec le résultat. */
export function jouerJusqua(contenu: Contenu, changements: readonly Changement[], n: number, reglages: Reglages = REGLAGES_DEFAUT): { resultat: Resultat; empreinte: string; ticks: number } {
  const p = new Partie(contenu, reglages);
  let k = 0;
  let e = 0;
  while (!p.finie && p.tick < n) {
    while (k < changements.length && changements[k]!.tick <= p.tick) e = changements[k++]!.e;
    p.avancer(e);
  }
  return { resultat: p.resultat(), empreinte: p.empreinte(), ticks: p.tick };
}

/** Rejoue une rediffusion sur le contenu donné : le même code que le jeu. Un autre jour ou une autre version du générateur est refusé (`contenu_different`). */
export function rejouer(contenu: Contenu, rediffusion: string | Rediffusion): Resultat {
  const r = typeof rediffusion === "string" ? decoderRediffusion(rediffusion) : rediffusion;
  if (!("jour" in r.contenu) || contenu.scenario !== "jour" || r.contenu.jour !== contenu.jour || r.g !== contenu.g) throw new ErreurRediffusion("contenu_different", "cette rediffusion n'est pas celle de ce jour");
  return jouer(contenu, r.changements);
}

/** La rediffusion d'une partie du jour (le texte à envoyer). */
export function enregistrer(contenu: Contenu, changements: readonly Changement[]): string {
  return encoderRediffusion({ sim: RUSH_SIM_VERSION, g: contenu.g, contenu: { jour: contenu.jour }, changements: [...changements] });
}

export { dailyRush };
