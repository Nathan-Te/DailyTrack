import { CodecError, pushVarint, readVarint } from "@cdj/core";
import { decoderEnveloppe, encoderEnveloppe, ErreurEnveloppe, type ContenuEnveloppe } from "@cdj/core/enveloppe";
import { DUREE_MAX_TICKS, GRAVITY_SIM_VERSION, MAX_CHANGEMENTS } from "./constantes";
import { dailyGravity, terrainDuJour, versionsGenerateur, type Contenu } from "./generateur";
import { versionsSimJouables } from "./regles";
import { jouer, type Resultat } from "./partie";

// La rediffusion d'une partie de Gravity : l'enveloppe commune des jeux neufs (`@cdj/core/enveloppe` : format, versions, jour) et, pour charge, **la liste des pas où l'appui commence ou finit** (lot GR6 : le bouton a deux
// états, dans les modes de vol un relâché compte autant qu'un appui), en deltas : le premier changement en pas absolu — **toujours un appui** —, les suivants à l'écart du précédent (≥ 1 : deux changements au même pas sont
// refusés), chacun en entier de longueur variable (7 bits par octet) ; ils alternent (appui, relâché, appui…). Un changement toutes les demi-secondes coûte 2 octets ; une partie de 3 minutes tient dans quelques centaines
// de caractères. **Rien d'autre** : la partie se rejoue à partir des changements (la simulation est entière, le niveau vient du jour).

/** Au plus 8 000 changements de 3 octets, en base64url, plus l'en-tête : au-delà, le texte n'est pas lu. */
export const MAX_CARACTERES = 32100;
/** Les versions lues sont celles que ce code sait jouer (lot GR5 : une rediffusion d'un jour figé sous une version passée se décode tant qu'on la garde, `regles.ts` et `generateur.ts`). */
export const LIMITES = {
  maxCaracteres: MAX_CARACTERES,
  get sims(): readonly number[] {
    return versionsSimJouables();
  },
  get generateurs(): readonly number[] {
    return versionsGenerateur();
  },
};

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
  /** Les pas où le bouton change d'état (appui, relâché, appui…), strictement croissants, de 0 à `DUREE_MAX_TICKS − 1`. */
  changements: number[];
}

/** Les octets de la charge pour une liste de changements (pas croissants). */
export function chargeDe(changements: readonly number[]): number[] {
  const o: number[] = [];
  let avant = 0;
  changements.forEach((tick, i) => {
    pushVarint(o, i === 0 ? tick : tick - avant);
    avant = tick;
  });
  return o;
}

export function lireCharge(charge: readonly number[]): number[] {
  const changements: number[] = [];
  let i = 0;
  const suivant = (): number => {
    if (i >= charge.length) throw new CodecError("charge tronquée");
    return charge[i++]!;
  };
  let tick = 0;
  try {
    while (i < charge.length) {
      const delta = readVarint(suivant, 14);
      if (changements.length > 0 && delta < 1) throw new ErreurRediffusion("format_illisible", "deux changements au même pas");
      tick += delta;
      if (tick >= DUREE_MAX_TICKS) throw new ErreurRediffusion("format_illisible", "changement après la fin de la partie");
      if (changements.length >= MAX_CHANGEMENTS) throw new ErreurRediffusion("trop_longue", "trop de changements");
      changements.push(tick);
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

/** Rejoue une rediffusion sur le contenu donné : le même code que le jeu. Un autre jour, une autre version du générateur ou de la simulation est refusé (`contenu_different`) : le contenu dit sous quelles versions il se joue (lot GR5). */
export function rejouer(contenu: Contenu, rediffusion: string | Rediffusion): Resultat {
  const r = typeof rediffusion === "string" ? decoderRediffusion(rediffusion) : rediffusion;
  if (!("jour" in r.contenu) || r.contenu.jour !== contenu.jour || r.g !== contenu.g || r.sim !== (contenu.sim ?? GRAVITY_SIM_VERSION)) throw new ErreurRediffusion("contenu_different", "cette rediffusion n'est pas celle de ce jour");
  return jouer(terrainDuJour(contenu), r.changements);
}

/** La rediffusion d'une partie du jour (le texte à envoyer). */
export function enregistrer(contenu: Contenu, changements: readonly number[]): string {
  return encoderRediffusion({ sim: contenu.sim ?? GRAVITY_SIM_VERSION, g: contenu.g, contenu: { jour: contenu.jour }, changements: [...changements] });
}

export { dailyGravity };
