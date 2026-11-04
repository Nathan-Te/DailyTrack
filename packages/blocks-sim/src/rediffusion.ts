import { CodecError } from "@cdj/core";
import { decoderEnveloppe, encoderEnveloppe, ErreurEnveloppe, type ContenuEnveloppe } from "@cdj/core/enveloppe";
import { BLOCKS_GENERATOR_VERSION, BLOCKS_SIM_VERSION, PLAFOND_PIECES } from "./constantes";
import { dailyBlocks, type Contenu } from "./generateur";
import { ErreurRejeu, jouer, type Resultat } from "./partie";

// La rediffusion d'une partie de Blocks : l'enveloppe commune des jeux neufs (`@cdj/core/enveloppe`) et, pour charge, **la suite des poses : un octet chacune** (`ligne × 8 + colonne` du coin haut-gauche de la boîte
// de la pièce du moment). Une partie est la suite de ses poses : tout le reste se rejoue. 2 000 poses au plus (le plafond).

/** Une longueur de texte au-delà de laquelle on ne lit rien : 2 000 octets de charge + l'en-tête, en base64url. */
export const MAX_CARACTERES = 2800;
export const LIMITES = { maxCaracteres: MAX_CARACTERES, sims: [BLOCKS_SIM_VERSION], generateurs: [BLOCKS_GENERATOR_VERSION] } as const;

export type CodeRefus = "format_illisible" | "version_inconnue" | "trop_longue" | "contenu_different" | "action_illegale" | "apres_la_fin" | "non_terminee";
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
  actions: number[];
}

export function lireCharge(charge: readonly number[]): number[] {
  if (charge.length > PLAFOND_PIECES) throw new ErreurRediffusion("trop_longue", "trop de poses");
  for (const a of charge) if (a >= 64) throw new ErreurRediffusion("format_illisible", "case inconnue");
  return [...charge];
}

export function encoderRediffusion(r: Rediffusion): string {
  return encoderEnveloppe({ sim: r.sim, g: r.g, contenu: r.contenu, charge: r.actions });
}

/** Le texte → la rediffusion, ou une `ErreurRediffusion` (jamais une exception brute). */
export function decoderRediffusion(texte: unknown): Rediffusion {
  try {
    const e = decoderEnveloppe(texte, LIMITES);
    return { sim: e.sim, g: e.g, contenu: e.contenu, actions: lireCharge(e.charge) };
  } catch (e) {
    if (e instanceof ErreurEnveloppe) throw new ErreurRediffusion(e.code, e.message);
    if (e instanceof CodecError) throw new ErreurRediffusion("format_illisible", e.message);
    throw e;
  }
}

/** Rejoue une rediffusion sur le contenu donné : le même code que le jeu. Un autre jour ou une autre version du tirage est refusé (`contenu_different`) ; une pose illégale, une pose après la fin, une partie inachevée aussi. */
export function rejouer(contenu: Contenu, rediffusion: string | Rediffusion): Resultat {
  const r = typeof rediffusion === "string" ? decoderRediffusion(rediffusion) : rediffusion;
  const nomme = "scenario" in r.contenu ? { scenario: r.contenu.scenario } : { jour: r.contenu.jour };
  const attendu = contenu.scenario !== undefined ? { scenario: contenu.scenario } : { jour: contenu.jour };
  if (JSON.stringify(nomme) !== JSON.stringify(attendu) || r.g !== contenu.g) throw new ErreurRediffusion("contenu_different", "cette rediffusion n'est pas celle de ce jour");
  try {
    return jouer(contenu, r.actions);
  } catch (e) {
    if (e instanceof ErreurRejeu) throw new ErreurRediffusion(e.code, e.message);
    throw e;
  }
}

/** La rediffusion d'une partie (le texte à envoyer). Un scénario nomme son scénario. */
export function enregistrer(contenu: Contenu, actions: readonly number[]): string {
  return encoderRediffusion({ sim: BLOCKS_SIM_VERSION, g: contenu.g, contenu: contenu.scenario !== undefined ? { scenario: contenu.scenario } : { jour: contenu.jour }, actions: [...actions] });
}

export { dailyBlocks };
