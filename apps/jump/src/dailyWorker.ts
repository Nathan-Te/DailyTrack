import type { JumpThemeName } from "@cdj/jump-sim";
import { generatePayload } from "./dailyGen";
import type { DailyPayload } from "./dailyWork";

// Worker de module (lot 7b) : génère le niveau d'une date hors du fil principal. Un seul message dans chaque sens ; le calcul est celui de
// `dailyLevel` (le résultat est identique à l'appel direct, testé), seule sa charge JSON revient.

export interface WorkerRequest {
  day: number;
  /** Lot 11 : un thème forcé (essai), absent : celui de la date. */
  theme?: JumpThemeName | null;
}
export type WorkerReply = { ok: true; payload: DailyPayload } | { ok: false; error: string };

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  let reply: WorkerReply;
  try {
    reply = { ok: true, payload: generatePayload(e.data.day, e.data.theme ?? null) };
  } catch (err) {
    reply = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  (self as unknown as { postMessage(m: WorkerReply): void }).postMessage(reply);
};
