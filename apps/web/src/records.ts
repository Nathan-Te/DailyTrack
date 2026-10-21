import { SIM_VERSION, generatorVersionOf, parseDay, type Medal } from "@cdj/sim";
import { gameStorage } from "./storage";

export interface BestRun {
  ms: number;
  splits: number[];
  /** Rediffusion du meilleur temps (base64url) : sert de fantôme. Absente avant le lot 3. */
  replay?: string;
  /** Version de la simulation avec laquelle `replay` a été enregistrée. */
  simVersion?: number;
  /** Médaille obtenue avec ce temps (circuits du jour). */
  medal?: Medal | null;
}

/** Meilleur temps local d'un jour, pour la liste des archives. */
export interface DayBest {
  date: string;
  ms: number;
  medal: Medal | null;
}

/** Un record d'une autre version de la simulation ne vaut plus rien : la même course ne donnerait plus ce temps. */
function current(r: BestRun | null): r is BestRun {
  return !!r && typeof r.ms === "number" && Array.isArray(r.splits) && r.simVersion === SIM_VERSION;
}

/**
 * Meilleurs temps locaux de tous les circuits du jour joués dans ce navigateur, par date. Seuls comptent ceux du
 * générateur de leur jour et de la simulation actuelle : avec une autre version, le circuit ou la conduite ne sont plus les mêmes.
 */
export function listDayBests(storage: Pick<Storage, "length" | "key" | "getItem"> = gameStorage()): Map<string, DayBest> {
  const out = new Map<string, DayBest>();
  let count = 0;
  try {
    count = storage.length;
  } catch {
    return out; // stockage indisponible : pas d'historique, rien de grave
  }
  for (let i = 0; i < count; i++) {
    try {
      const m = /^cdj:best:jour-(\d{4}-\d{2}-\d{2})-g(\d+)$/.exec(storage.key(i) ?? "");
      // Lot 34 : chaque jour a sa version du générateur (15 avant la bascule du 28/10/2026), celle de son identifiant.
      if (!m || Number(m[2]) !== generatorVersionOf(parseDay(m[1]!) ?? 0)) continue;
      const r = JSON.parse(storage.getItem(m[0]) ?? "null") as BestRun | null;
      if (current(r)) out.set(m[1]!, { date: m[1]!, ms: r.ms, medal: r.medal ?? null });
    } catch {
      /* une entrée illisible ne doit pas masquer les autres */
    }
  }
  return out;
}

const key = (trackId: string) => `cdj:best:${trackId}`;

/**
 * Meilleur temps local, ou `null` (aucun, illisible, ou d'une ancienne version de la simulation : ignoré).
 * Sans stockage disponible, on ignore.
 */
export function loadBest(trackId: string): BestRun | null {
  try {
    const raw = gameStorage().getItem(key(trackId));
    if (!raw) return null;
    const r = JSON.parse(raw) as BestRun;
    return current(r) ? r : null;
  } catch {
    return null;
  }
}

export function saveBest(trackId: string, r: BestRun): void {
  try {
    gameStorage().setItem(key(trackId), JSON.stringify(r));
  } catch {
    /* navigation privée, stockage bloqué : tant pis */
  }
}
