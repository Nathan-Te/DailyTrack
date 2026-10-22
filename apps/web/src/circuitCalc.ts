import { dailyCircuit, type Medals, type PaletteName, type ThemeName } from "@cdj/sim";

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
}

export function computeDaily(day: number, theme: ThemeName | null, variant: number): CircuitData {
  const { track, figures, ...c } = dailyCircuit(day, variant, theme);
  return { ...c, id: track.id, figures: figures.map((f) => f.name) };
}
