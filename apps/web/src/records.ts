export interface BestRun {
  ms: number;
  splits: number[];
  /** Rediffusion du meilleur temps (base64url) : sert de fantôme. Absente avant le lot 3. */
  replay?: string;
  /** Version de la simulation avec laquelle `replay` a été enregistrée. */
  simVersion?: number;
}

const key = (trackId: string) => `cdj:best:${trackId}`;

/** Meilleur temps local (le classement du jour arrive au lot 5). Sans stockage disponible, on ignore. */
export function loadBest(trackId: string): BestRun | null {
  try {
    const raw = localStorage.getItem(key(trackId));
    if (!raw) return null;
    const r = JSON.parse(raw) as BestRun;
    return typeof r.ms === "number" && Array.isArray(r.splits) ? r : null;
  } catch {
    return null;
  }
}

export function saveBest(trackId: string, r: BestRun): void {
  try {
    localStorage.setItem(key(trackId), JSON.stringify(r));
  } catch {
    /* navigation privée, stockage bloqué : tant pis */
  }
}
