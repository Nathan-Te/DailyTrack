// Lot K4c — **l'enveloppe de rediffusion commune**, pour les jeux neufs (`npm run nouveau-jeu`). Les simulations existantes (Track, Jump, Tower) gardent leur format : elles ne sont pas touchées.
// Une rediffusion d'un jeu neuf est : `[format = 1] [sim] [générateur] [genre : 0 = jour, 1 = scénario]`, puis le jour (entier de longueur variable : numéro de jour civil) ou le nom du scénario
// (`[longueur 1 à 32][ASCII a-z 0-9 : _ -]`), puis **la charge** : les octets que le jeu comprend seul (ses commandes). Texte `base64url` sans remplissage (`./codec`).
// Ce que l'enveloppe garantit à tout jeu : texte borné avant d'être lu, versions connues, jour ou scénario lisible, refus codés — jamais d'exception brute. Ce qu'elle ne sait pas : le contenu de la charge.

import { CodecError, fromBase64Url, pushVarint, readVarint, toBase64Url } from "./codec";

export const FORMAT_ENVELOPPE = 1;
const NOM_SCENARIO = /^[a-z0-9:_-]{1,32}$/;
/** Une version ou un jour tient dans cinq octets de longueur variable (35 bits) : au-delà, le texte n'est pas une enveloppe. */
const MAX_DECALAGE = 28;

export type CodeRefusEnveloppe = "format_illisible" | "version_inconnue" | "trop_longue";

/** Un refus de l'enveloppe : un code propre (le contrat du jeu le traduit en code de l'API), jamais une exception brute. */
export class ErreurEnveloppe extends Error {
  constructor(
    readonly code: CodeRefusEnveloppe,
    message: string,
  ) {
    super(message);
    this.name = "ErreurEnveloppe";
  }
}

export type ContenuEnveloppe = { jour: number } | { scenario: string };

export interface Enveloppe {
  /** La version de la simulation qui a joué la partie. */
  sim: number;
  /** La version du générateur du contenu joué. */
  g: number;
  /** Le jour du contenu (numéro de jour civil) ou le scénario d'essai (jamais classé). */
  contenu: ContenuEnveloppe;
  /** Les octets du jeu (ses commandes), 0 à 255 chacun. */
  charge: readonly number[];
}

export interface LimitesEnveloppe {
  /** La longueur maximale du texte, vérifiée **avant** toute lecture. */
  maxCaracteres: number;
  /** Les versions de simulation que le code joue. */
  sims: readonly number[];
  /** Les versions de générateur que le code connaît. */
  generateurs: readonly number[];
}

export function encoderEnveloppe(e: Enveloppe): string {
  const o: number[] = [FORMAT_ENVELOPPE];
  pushVarint(o, e.sim);
  pushVarint(o, e.g);
  if ("jour" in e.contenu) {
    o.push(0);
    pushVarint(o, e.contenu.jour);
  } else {
    if (!NOM_SCENARIO.test(e.contenu.scenario)) throw new RangeError(`nom de scénario refusé : ${e.contenu.scenario}`);
    o.push(1, e.contenu.scenario.length);
    for (let i = 0; i < e.contenu.scenario.length; i++) o.push(e.contenu.scenario.charCodeAt(i));
  }
  for (const b of e.charge) o.push(b);
  return toBase64Url(o);
}

export function decoderEnveloppe(texte: unknown, limites: LimitesEnveloppe): Enveloppe {
  if (typeof texte !== "string" || texte.length === 0) throw new ErreurEnveloppe("format_illisible", "rediffusion manquante");
  if (texte.length > limites.maxCaracteres) throw new ErreurEnveloppe("trop_longue", "rediffusion trop longue");
  let octets: number[];
  try {
    octets = fromBase64Url(texte);
  } catch (e) {
    if (e instanceof CodecError) throw new ErreurEnveloppe("format_illisible", e.message);
    throw e;
  }
  let i = 0;
  const suivant = (): number => {
    if (i >= octets.length) throw new CodecError("texte tronqué");
    return octets[i++]!;
  };
  try {
    if (suivant() !== FORMAT_ENVELOPPE) throw new ErreurEnveloppe("format_illisible", "format inconnu");
    const sim = readVarint(suivant, MAX_DECALAGE);
    const g = readVarint(suivant, MAX_DECALAGE);
    if (!limites.sims.includes(sim) || !limites.generateurs.includes(g)) throw new ErreurEnveloppe("version_inconnue", "version de simulation ou de générateur inconnue");
    const genre = suivant();
    let contenu: ContenuEnveloppe;
    if (genre === 0) contenu = { jour: readVarint(suivant, MAX_DECALAGE) };
    else if (genre === 1) {
      const n = suivant();
      if (n < 1 || n > 32) throw new ErreurEnveloppe("format_illisible", "nom de scénario illisible");
      let nom = "";
      for (let k = 0; k < n; k++) nom += String.fromCharCode(suivant());
      if (!NOM_SCENARIO.test(nom)) throw new ErreurEnveloppe("format_illisible", "nom de scénario illisible");
      contenu = { scenario: nom };
    } else throw new ErreurEnveloppe("format_illisible", "genre inconnu");
    return { sim, g, contenu, charge: octets.slice(i) };
  } catch (e) {
    if (e instanceof CodecError) throw new ErreurEnveloppe("format_illisible", e.message);
    throw e;
  }
}
