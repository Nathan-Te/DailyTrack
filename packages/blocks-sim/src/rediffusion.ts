import { CodecError, pushVarint, readVarint } from "@cdj/core";
import { decoderEnveloppe, encoderEnveloppe, ErreurEnveloppe, type ContenuEnveloppe } from "@cdj/core/enveloppe";
import { BLOCKS_GENERATOR_VERSION, BLOCKS_SIM_VERSION, DUREE_TICKS, MAX_TOUCHES, NB_CASES } from "./constantes";
import { dailyBlocks, type Contenu } from "./generateur";
import { jouer, type Resultat, type Touche } from "./partie";

// La rediffusion d'une partie de Blocks : l'enveloppe commune des jeux neufs (`@cdj/core/enveloppe`) et, pour charge, **la suite des touches** : pour chacune, le nombre de ticks depuis la touche
// précédente (entier de longueur variable) puis la case (un octet). Une partie est la suite de ses touches : tout le reste se rejoue.

/** Une longueur de texte au-delà de laquelle on ne lit rien : 200 touches de 3 octets au plus, en base64url, plus l'en-tête. */
export const MAX_CARACTERES = 1000;
export const LIMITES = { maxCaracteres: MAX_CARACTERES, sims: [BLOCKS_SIM_VERSION], generateurs: [BLOCKS_GENERATOR_VERSION] } as const;

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
  touches: Touche[];
}

/** Les octets de la charge pour une suite de touches (ticks croissants, 0 à 899). */
export function chargeDe(touches: readonly Touche[]): number[] {
  const o: number[] = [];
  let avant = 0;
  for (const t of touches) {
    pushVarint(o, t.tick - avant);
    o.push(t.c);
    avant = t.tick;
  }
  return o;
}

export function lireCharge(charge: readonly number[]): Touche[] {
  const touches: Touche[] = [];
  let i = 0;
  const suivant = (): number => {
    if (i >= charge.length) throw new CodecError("charge tronquée");
    return charge[i++]!;
  };
  let tick = 0;
  try {
    while (i < charge.length) {
      tick += readVarint(suivant, 14);
      const c = suivant();
      if (c >= NB_CASES) throw new ErreurRediffusion("format_illisible", "case inconnue");
      if (tick >= DUREE_TICKS) throw new ErreurRediffusion("format_illisible", "touche après la fin de la partie");
      if (touches.length >= MAX_TOUCHES) throw new ErreurRediffusion("trop_longue", "trop de touches");
      touches.push({ tick, c });
    }
  } catch (e) {
    if (e instanceof CodecError) throw new ErreurRediffusion("format_illisible", e.message);
    throw e;
  }
  return touches;
}

export function encoderRediffusion(r: Rediffusion): string {
  return encoderEnveloppe({ sim: r.sim, g: r.g, contenu: r.contenu, charge: chargeDe(r.touches) });
}

/** Le texte → la rediffusion, ou une `ErreurRediffusion` (jamais une exception brute). */
export function decoderRediffusion(texte: unknown): Rediffusion {
  try {
    const e = decoderEnveloppe(texte, LIMITES);
    return { sim: e.sim, g: e.g, contenu: e.contenu, touches: lireCharge(e.charge) };
  } catch (e) {
    if (e instanceof ErreurEnveloppe) throw new ErreurRediffusion(e.code, e.message);
    throw e;
  }
}

/** Rejoue une rediffusion sur le contenu donné : le même code que le jeu. Un autre jour ou une autre version du générateur est refusé (`contenu_different`). */
export function rejouer(contenu: Contenu, rediffusion: string | Rediffusion): Resultat {
  const r = typeof rediffusion === "string" ? decoderRediffusion(rediffusion) : rediffusion;
  if (!("jour" in r.contenu) || r.contenu.jour !== contenu.jour || r.g !== contenu.g) throw new ErreurRediffusion("contenu_different", "cette rediffusion n'est pas celle de ce jour");
  return jouer(contenu, r.touches);
}

/** La rediffusion d'une partie du jour (le texte à envoyer). */
export function enregistrer(contenu: Contenu, touches: readonly Touche[]): string {
  return encoderRediffusion({ sim: BLOCKS_SIM_VERSION, g: contenu.g, contenu: { jour: contenu.jour }, touches: [...touches] });
}

export { dailyBlocks };
