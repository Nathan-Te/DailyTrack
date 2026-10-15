import { generatePayload, type DailyPayload } from "./dailyWork";

// Worker de module (lot 7b) : génère le niveau d'une date hors du fil principal. Un seul message dans chaque sens ; le calcul est celui de
// `dailyLevel` (le résultat est identique à l'appel direct, testé), seule sa charge JSON revient.

export interface WorkerRequest {
  day: number;
}
export type WorkerReply = { ok: true; payload: DailyPayload } | { ok: false; error: string };

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  let reply: WorkerReply;
  try {
    reply = { ok: true, payload: generatePayload(e.data.day) };
  } catch (err) {
    reply = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  (self as unknown as { postMessage(m: WorkerReply): void }).postMessage(reply);
};
