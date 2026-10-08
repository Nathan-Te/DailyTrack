import { dailyCircuit, dailyTrackId, parseTrack, type PaletteName, type ThemeName } from "@cdj/sim";
import type { GenReply, GenRequest } from "./circuitWorker";
import type { ThumbnailCircuit } from "./thumbnail";

/** Génère le circuit d'un jour pour une miniature ; `null` si le générateur n'a pas abouti (circuit de secours : pas de miniature). */
export type CircuitMaker = (day: number, theme?: ThemeName | null, variant?: number) => Promise<ThumbnailCircuit | null>;

const later = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function build(day: number, theme: ThemeName | null, variant: number, r: { spec: string; palette: string; theme: ThemeName; fallback: boolean; authorMs: number; figures?: readonly ({ name: string } | string)[] }): ThumbnailCircuit | null {
  if (r.fallback || !r.spec) return null;
  return { track: parseTrack(dailyTrackId(day, theme, variant), r.spec), palette: r.palette as PaletteName, theme: r.theme, authorMs: r.authorMs, figures: (r.figures ?? []).map((f) => (typeof f === "string" ? f : f.name)) };
}

/**
 * Générateur de circuits pour les miniatures : dans un fil de travail (une demande à la fois, l'interface reste fluide), ou,
 * si les fils ne sont pas disponibles, sur le fil principal, une tâche à la fois (on cède la main avant chaque circuit).
 */
export function createCircuitMaker(onMainThread?: () => void): CircuitMaker {
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

  return async (day, theme = null, variant = 0) => {
    const w = start();
    if (w) {
      try {
        const reply = await new Promise<GenReply>((resolve, reject) => {
          const id = ++seq;
          waiting.set(id, { resolve, reject });
          w.postMessage({ seq: id, day, theme, variant } satisfies GenRequest);
        });
        if (!reply.error) return build(day, theme, variant, reply);
      } catch {
        // le fil de travail est tombé : on continue sur le fil principal
      }
    }
    onMainThread?.();
    await later();
    const c = dailyCircuit(day, variant, theme);
    return build(day, theme, variant, c);
  };
}
