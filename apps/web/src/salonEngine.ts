import { parseTrack, type PaletteName, type ThemeName, type Track } from "@cdj/sim";
import { computeCircuit, computePilotRun, type CircuitData, type PilotRunData } from "./salonJobs";
import type { SalonReply, SalonRequest } from "./salonWorker";

/** Un circuit de session prêt à jouer. */
export interface LoadedSalonCircuit {
  session: number;
  id: string;
  track: Track;
  palette: PaletteName;
  theme: ThemeName;
  authorMs: number;
  figures: string[];
}

/** Ce que le Salon demande aux tâches lourdes : le circuit d'une session, la course d'un pilote fictif. */
export interface SalonEngine {
  /** `null` si le générateur n'a pas abouti (circuit de secours : on ne joue pas dessus). */
  circuit(session: number): Promise<LoadedSalonCircuit | null>;
  pilotRun(session: number, sessionMs: number, pilot: number, attempt: number): Promise<PilotRunData | null>;
}

const later = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export function loadCircuit(d: CircuitData): LoadedSalonCircuit | null {
  if (d.fallback || !d.spec) return null;
  return { session: d.session, id: d.id, track: parseTrack(d.id, d.spec), palette: d.palette, theme: d.theme, authorMs: d.authorMs, figures: d.figures };
}

/**
 * Moteur du Salon : un fil de travail (une demande à la fois, l'interface reste fluide) ; sans `Worker`, ou s'il tombe, le même calcul
 * sur le fil principal, une tâche à la fois (on cède la main avant chacune). `onMainThread` est appelé à chaque calcul fait sur le fil
 * principal (compteur de contrôle).
 */
export function createSalonEngine(onMainThread?: () => void): SalonEngine {
  let worker: Worker | null = null;
  let broken = typeof Worker === "undefined";
  let seq = 0;
  const waiting = new Map<number, { resolve: (r: SalonReply) => void; reject: (e: unknown) => void }>();

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
      worker = new Worker(new URL("./salonWorker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (e: MessageEvent<SalonReply>) => {
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
  const ask = (build: (id: number) => SalonRequest): Promise<SalonReply> | null => {
    const w = start();
    if (!w) return null;
    return new Promise<SalonReply>((resolve, reject) => {
      const id = ++seq;
      waiting.set(id, { resolve, reject });
      w.postMessage(build(id));
    });
  };

  return {
    async circuit(session) {
      try {
        const reply = await ask((id) => ({ seq: id, type: "circuit", session }));
        if (reply && !reply.error && reply.circuit) return loadCircuit(reply.circuit);
      } catch {
        // le fil de travail est tombé : on continue sur le fil principal
      }
      onMainThread?.();
      await later();
      return loadCircuit(computeCircuit(session));
    },
    async pilotRun(session, sessionMs, pilot, attempt) {
      try {
        const reply = await ask((id) => ({ seq: id, type: "pilot", session, sessionMs, pilot, attempt }));
        if (reply && !reply.error) return reply.run ?? null;
      } catch {
        // idem
      }
      onMainThread?.();
      await later();
      return computePilotRun(session, sessionMs, pilot, attempt);
    },
  };
}
