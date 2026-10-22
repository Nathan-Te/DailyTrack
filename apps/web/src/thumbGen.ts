import { dailyTrackId, parseTrack, type PaletteName, type ThemeName } from "@cdj/sim";
import { sharedCircuitEngine } from "./circuitEngine";
import type { ThumbnailCircuit } from "./thumbnail";

/** Génère le circuit d'un jour pour une miniature ; `null` si le générateur n'a pas abouti (circuit de secours : pas de miniature). */
export type CircuitMaker = (day: number, theme?: ThemeName | null, variant?: number) => Promise<ThumbnailCircuit | null>;

/**
 * Générateur de circuits pour les miniatures : le moteur des circuits du jour (`circuitEngine.ts`, partagé avec le jeu : un seul fil de travail), dans un fil de travail (une demande à la fois, l'interface reste
 * fluide), ou, si les fils ne sont pas disponibles, sur le fil principal, une tâche à la fois (on cède la main avant chaque circuit).
 */
export function createCircuitMaker(onMainThread?: () => void): CircuitMaker {
  const engine = sharedCircuitEngine();
  engine.onMainThread = onMainThread;
  return async (day, theme = null, variant = 0) => {
    const r = await engine.data(day, theme, variant);
    if (r.fallback || !r.spec) return null;
    return { track: parseTrack(dailyTrackId(day, theme, variant), r.spec), palette: r.palette as PaletteName, theme: r.theme, authorMs: r.authorMs, figures: r.figures };
  };
}
