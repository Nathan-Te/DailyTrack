import { CodecError, pushVarint, readVarint } from "@cdj/core";
import { decoderEnveloppe, encoderEnveloppe, ErreurEnveloppe, type ContenuEnveloppe } from "@cdj/core/enveloppe";
import { DUREE_MAX_TICKS, MAX_CARACTERES, REGARD_MAX, TOUCHES_TOUTES, VERTIGE_GENERATOR_VERSION, VERTIGE_SIM_VERSION } from "./constantes";
import type { Contenu } from "./generateur";
import { estNomNiveau } from "./noms";
import { niveauDuContenu } from "./niveaux";
import { jouer, type Commande, type Resultat } from "./course";

// La rediffusion d'une partie de Vertige : l'enveloppe commune des jeux neufs (`@cdj/core/enveloppe`) et, pour charge, les COMMANDES de chaque pas (touches, lacet et tangage), à 120 pas par seconde.
//   charge = [nombre de pas] [nombre de changements de touches] ([pas depuis le changement précédent] [touches])…  [nombre de mouvements du regard] ([pas depuis le précédent] [lacet] [tangage])…
// Les entiers sont de longueur variable ; lacet et tangage sont des DIFFÉRENCES par pas (1/65 536 de tour), en zigzag. Un pas sans mouvement du regard ne coûte rien, une touche tenue non plus :
// c'est le regard (la souris) qui fait la taille d'une rediffusion (la mesure est dans le README du lot V0).

export const LIMITES = { maxCaracteres: MAX_CARACTERES, sims: [VERTIGE_SIM_VERSION], generateurs: [VERTIGE_GENERATOR_VERSION] } as const;

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
  commandes: Commande[];
}

const zig = (v: number): number => (v >= 0 ? 2 * v : -2 * v - 1);
const dezig = (z: number): number => (z % 2 === 0 ? z / 2 : -(z + 1) / 2);

/** Les octets de la charge pour une suite de commandes. */
export function chargeDe(commandes: readonly Commande[]): number[] {
  const o: number[] = [];
  pushVarint(o, commandes.length);
  const changements: [number, number][] = [];
  let avant = 0;
  let dernier = 0;
  commandes.forEach((c, i) => {
    const k = c.k & TOUCHES_TOUTES;
    if (k !== avant) {
      changements.push([i - dernier, k]);
      dernier = i;
      avant = k;
    }
  });
  pushVarint(o, changements.length);
  for (const [d, k] of changements) {
    pushVarint(o, d);
    o.push(k);
  }
  const regards: [number, number, number][] = [];
  dernier = 0;
  commandes.forEach((c, i) => {
    if (c.dl !== 0 || c.dt !== 0) {
      regards.push([i - dernier, c.dl, c.dt]);
      dernier = i;
    }
  });
  pushVarint(o, regards.length);
  for (const [d, dl, dt] of regards) {
    pushVarint(o, d);
    pushVarint(o, zig(dl));
    pushVarint(o, zig(dt));
  }
  return o;
}

export function lireCharge(charge: readonly number[]): Commande[] {
  let i = 0;
  const suivant = (): number => {
    if (i >= charge.length) throw new CodecError("charge tronquée");
    return charge[i++]!;
  };
  const refus = (m: string): never => {
    throw new ErreurRediffusion("format_illisible", m);
  };
  try {
    const pas = readVarint(suivant, 14);
    if (pas > DUREE_MAX_TICKS) throw new ErreurRediffusion("trop_longue", "trop de pas");
    const commandes: Commande[] = Array.from({ length: pas }, () => ({ k: 0, dl: 0, dt: 0 }));
    const nbChangements = readVarint(suivant, 14);
    if (nbChangements > pas) refus("trop de changements de touches");
    let rang = 0;
    let k = 0;
    const changements: [number, number][] = [];
    for (let n = 0; n < nbChangements; n++) {
      rang += readVarint(suivant, 14);
      const touches = suivant();
      if (touches > TOUCHES_TOUTES) refus("touche inconnue");
      if (rang >= pas) refus("changement de touches après la fin");
      changements.push([rang, touches]);
    }
    let c = 0;
    for (let p = 0; p < pas; p++) {
      while (c < changements.length && changements[c]![0] === p) k = changements[c++]![1];
      commandes[p]!.k = k;
    }
    const nbRegards = readVarint(suivant, 14);
    if (nbRegards > pas) refus("trop de mouvements du regard");
    rang = 0;
    for (let n = 0; n < nbRegards; n++) {
      rang += readVarint(suivant, 14);
      const dl = dezig(readVarint(suivant, 14));
      const dt = dezig(readVarint(suivant, 14));
      if (rang >= pas) refus("mouvement du regard après la fin");
      if (Math.abs(dl) > REGARD_MAX || Math.abs(dt) > REGARD_MAX) refus("mouvement du regard trop grand");
      commandes[rang]!.dl = dl;
      commandes[rang]!.dt = dt;
    }
    if (i !== charge.length) refus("octets en trop");
    return commandes;
  } catch (e) {
    if (e instanceof CodecError) throw new ErreurRediffusion("format_illisible", e.message);
    throw e;
  }
}

export function encoderRediffusion(r: Rediffusion): string {
  return encoderEnveloppe({ sim: r.sim, g: r.g, contenu: r.contenu, charge: chargeDe(r.commandes) });
}

/** Le texte → la rediffusion, ou une `ErreurRediffusion` (jamais une exception brute). */
export function decoderRediffusion(texte: unknown): Rediffusion {
  try {
    const e = decoderEnveloppe(texte, LIMITES);
    return { sim: e.sim, g: e.g, contenu: e.contenu, commandes: lireCharge(e.charge) };
  } catch (e) {
    if (e instanceof ErreurEnveloppe) throw new ErreurRediffusion(e.code, e.message);
    throw e;
  }
}

/** Rejoue des commandes sur le niveau du contenu : le même code que le jeu. Une rediffusion qui continue après l'arrivée est refusée (une seule écriture canonique par partie). */
export function rejouerCommandes(contenu: Contenu, commandes: readonly Commande[]): Resultat {
  const p = jouer(niveauDuContenu(contenu), commandes);
  if (p.tick < commandes.length) throw new ErreurRediffusion("format_illisible", "des pas après la fin de la partie");
  return p.resultat();
}

/** Rejoue une rediffusion sur le contenu donné. Un autre jour ou une autre version du générateur est refusé (`contenu_different`). */
export function rejouer(contenu: Contenu, rediffusion: string | Rediffusion): Resultat {
  const r = typeof rediffusion === "string" ? decoderRediffusion(rediffusion) : rediffusion;
  if (!("jour" in r.contenu) || r.contenu.jour !== contenu.jour || r.g !== contenu.g) throw new ErreurRediffusion("contenu_different", "cette rediffusion n'est pas celle de ce jour");
  return rejouerCommandes(contenu, r.commandes);
}

/** Rejoue la rediffusion d'un SCÉNARIO d'essai (jamais classée) : les tests et les mesures s'en servent. */
export function rejouerScenario(texte: string): { nom: string; resultat: Resultat } {
  const r = decoderRediffusion(texte);
  if (!("scenario" in r.contenu) || !estNomNiveau(r.contenu.scenario)) throw new ErreurRediffusion("contenu_different", "ce n'est pas la rediffusion d'un scénario");
  return { nom: r.contenu.scenario, resultat: rejouerCommandes({ jour: 0, g: r.g, niveau: r.contenu.scenario }, r.commandes) };
}

/** La rediffusion d'une partie du jour (le texte à envoyer). */
export function enregistrer(contenu: Contenu, commandes: readonly Commande[]): string {
  return encoderRediffusion({ sim: VERTIGE_SIM_VERSION, g: contenu.g, contenu: { jour: contenu.jour }, commandes: [...commandes] });
}
/** La rediffusion d'une partie d'un scénario d'essai. */
export function enregistrerScenario(nom: string, commandes: readonly Commande[]): string {
  return encoderRediffusion({ sim: VERTIGE_SIM_VERSION, g: VERTIGE_GENERATOR_VERSION, contenu: { scenario: nom }, commandes: [...commandes] });
}

