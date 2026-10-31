import { decoderRediffusion, type Scenario } from "@cdj/tower-sim";
import type { MessageBot } from "./botWorker";

// Le client du Web Worker du bot (lot T3) — **chargé à la demande, hors production seulement** (`jeu.ts` : `if (!PRODUCTION)`). Une demande = un calcul du jour ; les messages du worker sont rendus
// tels quels (la fin avec la partie retenue, ou l'échec).
export interface DemandeBot {
  arreter(): void;
}

export function demanderBot(contenu: Scenario, surMessage: (m: MessageBot) => void): DemandeBot {
  const w = new Worker(new URL("./botWorker.ts", import.meta.url), { type: "module" });
  w.onmessage = (e: MessageEvent<MessageBot>) => {
    surMessage(e.data);
    w.terminate();
  };
  w.onerror = () => {
    surMessage({ genre: "echec" });
    w.terminate();
  };
  w.postMessage({ contenu });
  return { arreter: () => w.terminate() };
}

/** Les commandes d'une preuve (une rediffusion `base64url`), un masque par tick : de quoi regarder le bot la jouer. */
export function masquesDePreuve(preuve: string): number[] {
  const masques: number[] = [];
  for (const p of decoderRediffusion(preuve).plages) for (let i = 0; i < p.ticks; i++) masques.push(p.masque);
  return masques;
}
