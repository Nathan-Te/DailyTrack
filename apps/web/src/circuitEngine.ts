import { parseTrack, type Medals, type PaletteName, type ThemeName, type Track } from "@cdj/sim";
import type { CircuitData } from "./circuitCalc";
import type { GenReply, GenRequest } from "./circuitWorker";

// Le moteur des circuits du jour (lot 36). Le générateur (figures, règles de freinage, pilote de validation) n'est pas dans le paquet du premier chargement : un
// circuit se calcule dans un fil de travail (`circuitWorker.ts`, le même que celui des miniatures) et revient sous forme de texte et de nombres (`CircuitData`)
// dont le jeu refait le circuit (`parseTrack`). Sans fil de travail (ou s'il tombe), le même calcul se fait sur le fil principal, une tâche à la fois, dans un
// morceau chargé à la demande (`circuitCalc.ts`) : le résultat est identique.

/** Le circuit du jour vu par le jeu : ce que `dailyCircuit` rendait, moins ce que seul le générateur sait (les figures posées, en noms). */
export interface DailyCircuit {
  day: number;
  date: string;
  number: number;
  attempt: number;
  variant: number;
  spec: string;
  figures: string[];
  track: Track;
  authorMs: number;
  medals: Medals;
  palette: PaletteName;
  theme: ThemeName;
  forcedTheme: boolean;
  fallback: boolean;
  /** Lot G1 : le fantôme Diamant (voir `CircuitData.diamant`). */
  diamant?: CircuitData["diamant"];
}

export interface CircuitEngine {
  /** Appelé à chaque calcul fait sur le fil principal (compteur de contrôle des miniatures : doit rester à zéro). */
  onMainThread?: () => void;
  /** Les données d'un circuit du jour. */
  data(day: number, theme: ThemeName | null, variant: number): Promise<CircuitData>;
  /** Le circuit du jour prêt à jouer (le circuit d'essai de secours si le générateur n'a pas abouti). */
  daily(day: number, theme: ThemeName | null, variant: number): Promise<DailyCircuit>;
}

const later = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Le circuit qui sert de secours (jamais en pratique) : celui des scénarios d'essai, chargé à la demande. */
async function fallbackTrack(): Promise<Track> {
  return (await import("./scenarios")).scenarioTrack("essai", new URLSearchParams())!;
}

export async function dailyFromData(d: CircuitData): Promise<DailyCircuit> {
  const track = d.fallback || !d.spec ? await fallbackTrack() : parseTrack(d.id, d.spec);
  return { day: d.day, date: d.date, number: d.number, attempt: d.attempt, variant: d.variant, spec: d.spec, figures: d.figures, track, authorMs: d.authorMs, medals: d.medals, palette: d.palette, theme: d.theme, forcedTheme: d.forcedTheme, fallback: d.fallback, ...(d.diamant ? { diamant: d.diamant } : {}) };
}

/** Crée un moteur : un fil de travail démarré à la première demande, une demande à la fois (les suivantes attendent : l'interface reste fluide). */
export function createCircuitEngine(): CircuitEngine {
  let worker: Worker | null = null;
  let broken = typeof Worker === "undefined";
  let seq = 0;
  const waiting = new Map<number, { resolve: (r: GenReply) => void; reject: (e: unknown) => void }>();

  const fail = (e: unknown) => {
    broken = true;
    worker?.terminate();
    worker = null;
    for (const w of waiting.values()) w.reject(e);
    waiting.clear();
  };
  const start = (): Worker | null => {
    if (broken) return null;
    if (worker) return worker;
    try {
      worker = new Worker(new URL("./circuitWorker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (e: MessageEvent<GenReply>) => {
        const w = waiting.get(e.data.seq);
        waiting.delete(e.data.seq);
        w?.resolve(e.data);
      };
      worker.onerror = (e) => fail(e);
    } catch (e) {
      fail(e);
    }
    return worker;
  };

  const data = async (day: number, theme: ThemeName | null, variant: number): Promise<CircuitData> => {
    const w = start();
    if (w) {
      try {
        const reply = await new Promise<GenReply>((resolve, reject) => {
          const id = ++seq;
          waiting.set(id, { resolve, reject });
          w.postMessage({ seq: id, day, theme, variant } satisfies GenRequest);
        });
        if (reply.data) return reply.data;
      } catch {
        // le fil de travail est tombé : on continue sur le fil principal
      }
    }
    engine.onMainThread?.();
    await later();
    return (await import("./circuitCalc")).computeDaily(day, theme, variant);
  };
  const engine: CircuitEngine = { data, daily: async (day, theme, variant) => dailyFromData(await data(day, theme, variant)) };
  return engine;
}

let shared: CircuitEngine | null = null;
/** Le moteur du jeu, partagé par le circuit du jour et les miniatures : un seul fil de travail. */
export const sharedCircuitEngine = (): CircuitEngine => (shared ??= createCircuitEngine());

