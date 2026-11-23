import { CodecError, pushVarint, readVarint } from "@cdj/core";
import { decoderEnveloppe, encoderEnveloppe, ErreurEnveloppe, type ContenuEnveloppe } from "@cdj/core/enveloppe";
import { MAX_APPUIS, PILEPOIL_GENERATOR_VERSION, PILEPOIL_SIM_VERSION } from "./constantes";
import { dailyPilepoil, type Contenu } from "./tirage";
import { AppuiImpossible, jouer, maxPas, type Resultat } from "./partie";

// La rediffusion d'une partie de « Pile poil » : l'enveloppe commune des jeux neufs (`@cdj/core/enveloppe`) et, pour charge, **les pas des appuis** (dix au plus), chacun en entier de longueur variable
// (2 à 3 octets). Une partie est la suite de ses appuis : tout le reste se rejoue. Une suite impossible est refusée : un pas qui recule ou se répète, plus de dix appuis, un pas au-delà de la plus longue partie,
// et (au rejeu) un appui pendant une pause ou après la fin.

/** Une longueur de texte au-delà de laquelle on ne lit rien : dix appuis de 3 octets au plus, en base64url, plus l'en-tête. */
export const MAX_CARACTERES = 200;
export const LIMITES = { maxCaracteres: MAX_CARACTERES, sims: [PILEPOIL_SIM_VERSION], generateurs: [PILEPOIL_GENERATOR_VERSION] } as const;

export type CodeRefus = "format_illisible" | "version_inconnue" | "trop_longue" | "contenu_different" | "appui_impossible";
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
  /** Les pas des appuis, strictement croissants. */
  appuis: number[];
}

/** Les octets de la charge pour une suite de pas. */
export function chargeDe(appuis: readonly number[]): number[] {
  const o: number[] = [];
  for (const p of appuis) pushVarint(o, p);
  return o;
}

export function lireCharge(charge: readonly number[]): number[] {
  const appuis: number[] = [];
  let i = 0;
  const suivant = (): number => {
    if (i >= charge.length) throw new CodecError("charge tronquée");
    return charge[i++]!;
  };
  const borne = maxPas();
  try {
    while (i < charge.length) {
      const p = readVarint(suivant, 21);
      if (appuis.length >= MAX_APPUIS) throw new ErreurRediffusion("trop_longue", "plus de dix appuis");
      if (appuis.length > 0 && p <= appuis[appuis.length - 1]!) throw new ErreurRediffusion("appui_impossible", "un pas qui recule");
      if (p >= borne) throw new ErreurRediffusion("appui_impossible", "un appui après la fin de la partie");
      appuis.push(p);
    }
  } catch (e) {
    if (e instanceof CodecError) throw new ErreurRediffusion("format_illisible", e.message);
    throw e;
  }
  return appuis;
}

export function encoderRediffusion(r: Rediffusion): string {
  return encoderEnveloppe({ sim: r.sim, g: r.g, contenu: r.contenu, charge: chargeDe(r.appuis) });
}

/** Le texte → la rediffusion, ou une `ErreurRediffusion` (jamais une exception brute). */
export function decoderRediffusion(texte: unknown): Rediffusion {
  try {
    const e = decoderEnveloppe(texte, LIMITES);
    return { sim: e.sim, g: e.g, contenu: e.contenu, appuis: lireCharge(e.charge) };
  } catch (e) {
    if (e instanceof ErreurEnveloppe) throw new ErreurRediffusion(e.code, e.message);
    throw e;
  }
}

/** Rejoue une rediffusion sur le contenu donné : le même code que le jeu, avec les réglages du jeu. Un autre jour ou une autre version du tirage est refusé (`contenu_different`), un appui impossible aussi. */
export function rejouer(contenu: Contenu, rediffusion: string | Rediffusion): Resultat {
  const r = typeof rediffusion === "string" ? decoderRediffusion(rediffusion) : rediffusion;
  if (!("jour" in r.contenu) || r.contenu.jour !== contenu.jour || r.g !== contenu.g) throw new ErreurRediffusion("contenu_different", "cette rediffusion n'est pas celle de ce jour");
  try {
    return jouer(contenu.jauges, r.appuis);
  } catch (e) {
    if (e instanceof AppuiImpossible) throw new ErreurRediffusion("appui_impossible", e.message);
    throw e;
  }
}

/** La rediffusion d'une partie du jour (le texte à envoyer). */
export function enregistrer(contenu: Pick<Contenu, "jour" | "g">, appuis: readonly number[]): string {
  return encoderRediffusion({ sim: PILEPOIL_SIM_VERSION, g: contenu.g, contenu: { jour: contenu.jour }, appuis: [...appuis] });
}

export { dailyPilepoil };
