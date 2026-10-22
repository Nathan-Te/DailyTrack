import type { ThemeName } from "@cdj/sim";
import { computeDaily, type CircuitData } from "./circuitCalc";

// Fil de travail des circuits du jour (lots 13 et 36) : générer un circuit coûte ≈ 200 ms (le pilote automatique le rejoue pour le valider), 800 ms sur un
// téléphone lent. Le jeu le demande pour le circuit du jour (le générateur n'est plus dans son paquet) et les archives en demandent des dizaines : on les
// fait ici pour ne jamais geler l'écran.

export interface GenRequest {
  seq: number;
  day: number;
  theme: ThemeName | null;
  /** Variante du planning (lot 14) ; 0 = le circuit d'origine. */
  variant?: number;
}
export interface GenReply {
  seq: number;
  data: CircuitData | null;
  error?: string;
}

const ctx = self as unknown as { onmessage: ((e: MessageEvent<GenRequest>) => void) | null; postMessage(m: GenReply): void };
ctx.onmessage = (e) => {
  const { seq, day, theme, variant } = e.data;
  try {
    ctx.postMessage({ seq, data: computeDaily(day, theme, variant ?? 0) });
  } catch (err) {
    ctx.postMessage({ seq, data: null, error: String(err) });
  }
};
