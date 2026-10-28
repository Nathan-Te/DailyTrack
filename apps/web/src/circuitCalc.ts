import { dailyCircuit, replayRace, type Medals, type PaletteName, type Replay, type ThemeName, type Track } from "@cdj/sim";

// Le calcul d'un circuit du jour (générateur, figures, pilote de validation) : lot 36. Il ne tourne jamais dans le paquet du premier chargement : le fil de
// travail des circuits (`circuitWorker.ts`) l'appelle, et `circuitEngine.ts` ne le charge (`import()`) que si le navigateur n'a pas de fil de travail. Le même
// `dailyCircuit` que le serveur et la page de vérification : aucun écart possible. Ce qui en sort est du texte et des nombres (`CircuitData`) : le jeu en refait le
// circuit (`parseTrack`) sans le générateur.

/** Un circuit du jour tel qu'il voyage entre le fil de travail et le jeu. */
export interface CircuitData {
  day: number;
  /** « AAAA-MM-JJ ». */
  date: string;
  number: number;
  attempt: number;
  variant: number;
  /** Identifiant du circuit (`jour-AAAA-MM-JJ-g<G>[-v<N>][-<thème>]`) ; « essai » pour le circuit de secours. */
  id: string;
  spec: string;
  palette: PaletteName;
  theme: ThemeName;
  forcedTheme: boolean;
  /** Vrai si aucune tentative n'a abouti : le circuit d'essai a servi de secours (ne doit jamais arriver). */
  fallback: boolean;
  authorMs: number;
  medals: Medals;
  /** Noms des figures du circuit, dans l'ordre (lot 20). */
  figures: string[];
  /** Lot G1 : le fantôme Diamant (la course du pilote automatique, rejouée ici : son temps et ses temps intermédiaires ; la page l'encode quand elle s'en sert). Absent du circuit de secours. */
  diamant?: { ms: number; splits: number[]; replay: Replay };
}

export function computeDaily(day: number, theme: ThemeName | null, variant: number): CircuitData {
  // Lot R9 : le serveur garde l'**empreinte** de la rediffusion du pilote pour refuser les copies exactes. Lot G1 : cette course est le fantôme « Diamant » de la page ;
  // elle n'est pas servie (aucun fichier, aucune réponse de l'API) : **la page la calcule elle-même**, avec le code qu'elle a reçu, comme n'importe quel visiteur le
  // pouvait déjà (le générateur et le pilote tournent dans le navigateur). Rien de plus que ce qu'un visiteur peut calculer ; une copie exacte reste refusée (`409 replay_copy`).
  const { track, figures, authorReplay, ...c } = dailyCircuit(day, variant, theme);
  return { ...c, id: track.id, figures: figures.map((f) => f.name), ...(c.fallback ? {} : diamant(track, authorReplay)) };
}

function diamant(track: Track, replay: Replay): { diamant?: CircuitData["diamant"] } {
  try {
    const r = replayRace(track, replay);
    return r.finished ? { diamant: { ms: r.finishMs, splits: r.splits, replay } } : {};
  } catch {
    return {}; // une rediffusion d'une autre version : pas de fantôme Diamant ce jour-là
  }
}
