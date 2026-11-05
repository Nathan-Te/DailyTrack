import { colonneDe, decoderRediffusion, ligneDe, Partie, rejouer, type Contenu, type Grille } from "@cdj/blocks-sim";

// LE FANTÔME de « Blocks » (lot B4, seed § 5) : une partie déjà jouée (la meilleure du joueur, ou celle du Diamant, le bot) rejouée en silence, qui montre **sa grille au même rang de pièce** que le joueur — le rang est
// le nombre de poses faites — avec son score à ce rang. Pur : de l'affichage seulement, il ne change pas un octet de la partie du joueur. Un fantôme illisible (autre jour, autre version du tirage, pose illégale) n'existe pas :
// `creerFantome` rend `null` et la partie se joue sans lui.

/** Ce que le fantôme montre à un rang. */
export interface EtatFantome {
  grille: Grille;
  score: number;
  combo: number;
  /** Sa partie s'est arrêtée : il n'a plus de pose à ce rang ni après. On montre sa dernière grille, estompée (« Fin du fantôme »). */
  fini: boolean;
}

export interface Fantome {
  /** Le nombre de poses de sa partie. */
  readonly poses: number;
  readonly scoreFinal: number;
  /** Son état après `rang` poses (celles du joueur) : au-delà de sa dernière pose, sa dernière grille, `fini` vrai. */
  etat(rang: number): EtatFantome;
}

/** Le fantôme d'une rediffusion sur la suite du jour, ou `null` (aucune, ou une rediffusion qui n'est pas valide pour ce contenu). */
export function creerFantome(contenu: Contenu, rediffusion: string | null): Fantome | null {
  if (!rediffusion) return null;
  let actions: number[];
  try {
    const r = decoderRediffusion(rediffusion);
    rejouer(contenu, r); // même jour, même tirage, poses légales, partie terminée : sinon pas de fantôme
    actions = r.actions;
  } catch {
    return null;
  }
  const partie = new Partie(contenu);
  const etats: Omit<EtatFantome, "fini">[] = [{ grille: partie.grille, score: 0, combo: 0 }];
  for (const a of actions) {
    partie.poser(colonneDe(a), ligneDe(a));
    etats.push({ grille: partie.grille, score: partie.score, combo: partie.combo });
  }
  return {
    poses: actions.length,
    scoreFinal: partie.score,
    etat(rang) {
      const i = Math.max(0, Math.min(actions.length, Math.floor(rang)));
      return { ...etats[i]!, fini: rang >= actions.length };
    },
  };
}

/** La différence de score avec le fantôme, vue du joueur : « +240 » s'il le devance, « −120 » s'il est derrière, « = » à égalité. Un signe moins typographique, le nombre au format de la langue. */
export function ecartFantome(score: number, scoreFantome: number, langue: string): string {
  const d = score - scoreFantome;
  if (d === 0) return "=";
  const n = new Intl.NumberFormat(langue === "en" ? "en-US" : "fr-FR").format(Math.abs(d)).replace(/[\u202f\u2009]/g, "\u00a0");
  return `${d > 0 ? "+" : "−"}${n}`;
}
