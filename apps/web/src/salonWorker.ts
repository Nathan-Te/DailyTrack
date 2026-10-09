import { computeCircuit, computePilotRun, type CircuitData, type PilotRunData } from "./salonJobs";

// Fil de travail du Salon (lot 26) : génère le circuit d'une session et fait rouler les pilotes fictifs de la démonstration, loin
// du fil principal (un circuit coûte ≈ 0,5 s : jamais de gel à la bascule d'une session).

export type SalonRequest = { seq: number; type: "circuit"; session: number } | { seq: number; type: "pilot"; session: number; sessionMs: number; pilot: number; attempt: number };
export type SalonReply = { seq: number; circuit?: CircuitData; run?: PilotRunData | null; error?: string };

const ctx = self as unknown as { onmessage: ((e: MessageEvent<SalonRequest>) => void) | null; postMessage(m: SalonReply): void };
ctx.onmessage = (e) => {
  const r = e.data;
  try {
    if (r.type === "circuit") ctx.postMessage({ seq: r.seq, circuit: computeCircuit(r.session) });
    else ctx.postMessage({ seq: r.seq, run: computePilotRun(r.session, r.sessionMs, r.pilot, r.attempt) });
  } catch (err) {
    ctx.postMessage({ seq: r.seq, error: String(err) });
  }
};
