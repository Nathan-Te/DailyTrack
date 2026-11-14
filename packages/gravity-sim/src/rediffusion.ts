import { CodecError, pushVarint, readVarint } from "@cdj/core";
import { decoderEnveloppe, encoderEnveloppe, ErreurEnveloppe, type ContenuEnveloppe } from "@cdj/core/enveloppe";
import { DUREE_MAX_TICKS, GRAVITY_GENERATOR_VERSION, GRAVITY_SIM_VERSION, MAX_APPUIS } from "./constantes";
import { dailyGravity, terrainDuJour, type Contenu } from "./generateur";
import { jouer, type Resultat } from "./partie";

// La rediffusion d'une partie de Gravity : l'enveloppe commune des jeux neufs (`@cdj/core/enveloppe` : format, versions, jour) et, pour charge, **la liste des pas où le joueur a touché l'écran**, en deltas : le premier appui
// en pas absolu, les suivants à l'écart du précédent (≥ 1), chacun en entier de longueur variable (7 bits par octet). Un appui toutes les secondes coûte 2 octets ; une partie de 3 minutes tient dans quelques centaines
// de caractères. **Rien d'autre** : la partie se rejoue à partir des appuis (la simulation est entière, le niveau vient du jour).

/** Au plus 4 000 appuis de 3 octets, en base64url, plus l'en-tête : au-delà, le texte n'est pas lu. */
export const MAX_CARACTERES = 16100;
export const LIMITES = { maxCaracteres: MAX_CARACTERES, sims: [GRAVITY_SIM_VERSION], generateurs: [GRAVITY_GENERATOR_VERSION] } as const;

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
  /** Les pas des appuis, strictement croissants, de 0 à `DUREE_MAX_TICKS − 1`. */
  appuis: number[];
}

/** Les octets de la charge pour une liste d'appuis (pas croissants). */
export function chargeDe(appuis: readonly number[]): number[] {
  const o: number[] = [];
  let avant = 0;
  appuis.forEach((tick, i) => {
    pushVarint(o, i === 0 ? tick : tick - avant);
    avant = tick;
  });
  return o;
}

export function lireCharge(charge: readonly number[]): number[] {
  const appuis: number[] = [];
  let i = 0;
  const suivant = (): number => {
    if (i >= charge.length) throw new CodecError("charge tronquée");
    return charge[i++]!;
  };
  let tick = 0;
  try {
    while (i < charge.length) {
      const delta = readVarint(suivant, 14);
      if (appuis.length > 0 && delta < 1) throw new ErreurRediffusion("format_illisible", "deux appuis au même pas");
      tick += delta;
      if (tick >= DUREE_MAX_TICKS) throw new ErreurRediffusion("format_illisible", "appui après la fin de la partie");
      if (appuis.length >= MAX_APPUIS) throw new ErreurRediffusion("trop_longue", "trop d'appuis");
      appuis.push(tick);
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

/** Rejoue une rediffusion sur le contenu donné : le même code que le jeu. Un autre jour ou une autre version du générateur est refusé (`contenu_different`). */
export function rejouer(contenu: Contenu, rediffusion: string | Rediffusion): Resultat {
  const r = typeof rediffusion === "string" ? decoderRediffusion(rediffusion) : rediffusion;
  if (!("jour" in r.contenu) || r.contenu.jour !== contenu.jour || r.g !== contenu.g) throw new ErreurRediffusion("contenu_different", "cette rediffusion n'est pas celle de ce jour");
  return jouer(terrainDuJour(contenu), r.appuis);
}

/** La rediffusion d'une partie du jour (le texte à envoyer). */
export function enregistrer(contenu: Contenu, appuis: readonly number[]): string {
  return encoderRediffusion({ sim: GRAVITY_SIM_VERSION, g: contenu.g, contenu: { jour: contenu.jour }, appuis: [...appuis] });
}

export { dailyGravity };
