import { CodecError, pushVarint, readVarint } from "@cdj/core";
import { decoderEnveloppe, encoderEnveloppe, ErreurEnveloppe, type ContenuEnveloppe } from "@cdj/core/enveloppe";
import { DUREE_MAX_TICKS, MAX_EVENEMENTS, PINBALL_GENERATOR_VERSION, PINBALL_SIM_VERSION, type Controle } from "./constantes";
import { dailyPinball, type Contenu } from "./generateur";
import { Partie, type Resultat } from "./partie";
import { REGLAGES, type Reglages } from "./reglages";

// La rediffusion d'une partie de Pinball : l'enveloppe commune des jeux neufs (`@cdj/core/enveloppe` : format, versions, jour) et, pour charge, **la liste des instants où une commande change** — le batteur gauche,
// le batteur droit, le lanceur, pressés ou relâchés. Chaque événement est écrit en delta : le nombre de pas depuis l'événement d'avant, multiplié par 6, plus le code (commande × 2 + 0 pour un appui, 1 pour un
// relâchement), le tout en un entier de longueur variable (7 bits par octet). Un appui toutes les 0,3 s tient dans 2 octets. **Rien d'autre** : la partie se rejoue à partir de là (la simulation est entière, la table
// vient du jour). Deux commandes différentes peuvent changer au même pas (deux doigts dans la même image) ; **la même commande ne change jamais deux fois au même pas, et elle alterne appui, relâchement, appui…**

/** 12 000 événements de 4 octets au plus, en base64url, plus l'en-tête : au-delà, le texte n'est pas lu. */
export const MAX_CARACTERES = 64100;
export const LIMITES = { maxCaracteres: MAX_CARACTERES, sims: [PINBALL_SIM_VERSION], generateurs: [PINBALL_GENERATOR_VERSION] } as const;

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

/** Un changement d'état d'une commande, daté au pas où il s'applique (avant que ce pas ne se joue). */
export interface Evenement {
  tick: number;
  c: Controle;
  /** Vrai : la commande est pressée ; faux : relâchée. */
  enfonce: boolean;
}

export interface Rediffusion {
  sim: number;
  g: number;
  contenu: ContenuEnveloppe;
  evenements: Evenement[];
}

/** Les octets de la charge pour une liste d'événements (pas croissants). */
export function chargeDe(evenements: readonly Evenement[]): number[] {
  const o: number[] = [];
  let avant = 0;
  for (const e of evenements) {
    pushVarint(o, (e.tick - avant) * 6 + e.c * 2 + (e.enfonce ? 0 : 1));
    avant = e.tick;
  }
  return o;
}

/** Les événements d'une charge, ou une `ErreurRediffusion` : mal formée, trop longue, double appui, appui après la fin. */
export function lireCharge(charge: readonly number[]): Evenement[] {
  const evenements: Evenement[] = [];
  let i = 0;
  const suivant = (): number => {
    if (i >= charge.length) throw new CodecError("charge tronquée");
    return charge[i++]!;
  };
  let tick = 0;
  const enfonce = [false, false, false];
  const dernier = [-1, -1, -1];
  try {
    while (i < charge.length) {
      const v = readVarint(suivant, 28);
      const code = v % 6;
      tick += Math.trunc(v / 6);
      const c = (code >> 1) as Controle;
      const presse = (code & 1) === 0;
      if (tick >= DUREE_MAX_TICKS) throw new ErreurRediffusion("format_illisible", "événement après la fin de la partie");
      if (evenements.length >= MAX_EVENEMENTS) throw new ErreurRediffusion("trop_longue", "trop d'événements");
      if (dernier[c] === tick) throw new ErreurRediffusion("format_illisible", "deux événements de la même commande au même pas");
      if (enfonce[c] === presse) throw new ErreurRediffusion("format_illisible", presse ? "double appui" : "relâchement sans appui");
      enfonce[c] = presse;
      dernier[c] = tick;
      evenements.push({ tick, c, enfonce: presse });
    }
  } catch (e) {
    if (e instanceof CodecError) throw new ErreurRediffusion("format_illisible", e.message);
    throw e;
  }
  return evenements;
}

export function encoderRediffusion(r: Rediffusion): string {
  return encoderEnveloppe({ sim: r.sim, g: r.g, contenu: r.contenu, charge: chargeDe(r.evenements) });
}

/** Le texte → la rediffusion, ou une `ErreurRediffusion` (jamais une exception brute). */
export function decoderRediffusion(texte: unknown): Rediffusion {
  try {
    const e = decoderEnveloppe(texte, LIMITES);
    return { sim: e.sim, g: e.g, contenu: e.contenu, evenements: lireCharge(e.charge) };
  } catch (e) {
    if (e instanceof ErreurEnveloppe) throw new ErreurRediffusion(e.code, e.message);
    throw e;
  }
}

/** Joue une partie entière : les événements à leur pas, jusqu'à la fin de la partie. Le même code pour le jeu, les essais et le serveur. */
export function jouer(contenu: Contenu, evenements: readonly Evenement[], reglages: Reglages = REGLAGES): Resultat {
  const p = new Partie(contenu, reglages);
  let k = 0;
  while (!p.finie) {
    while (k < evenements.length && evenements[k]!.tick === p.tick) {
      const e = evenements[k++]!;
      p.regler(e.c, e.enfonce);
    }
    p.avancer();
  }
  return p.resultat();
}

/** Rejoue une rediffusion sur le contenu donné : le même code que le jeu. Un autre jour ou une autre version du générateur est refusé (`contenu_different`). */
export function rejouer(contenu: Contenu, rediffusion: string | Rediffusion): Resultat {
  const r = typeof rediffusion === "string" ? decoderRediffusion(rediffusion) : rediffusion;
  if (!("jour" in r.contenu) || r.contenu.jour !== contenu.jour || r.g !== contenu.g) throw new ErreurRediffusion("contenu_different", "cette rediffusion n'est pas celle de ce jour");
  return jouer(contenu, r.evenements);
}

/** La rediffusion d'une partie du jour (le texte à envoyer). */
export function enregistrer(contenu: Contenu, evenements: readonly Evenement[]): string {
  return encoderRediffusion({ sim: PINBALL_SIM_VERSION, g: contenu.g, contenu: { jour: contenu.jour }, evenements: [...evenements] });
}

export { dailyPinball };
