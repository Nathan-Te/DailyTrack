import { diamantDe, encoderRediffusion, type Scenario } from "@cdj/tower-sim";
import { jouerBotRobuste } from "@cdj/tower-sim/bot";
import { chargerRapier } from "@cdj/tower-sim/rapier";

// Le Web Worker du bot de l'auteur (lot T3) — **hors production seulement** (aperçus, local) : le bot coûte une minute par jour, il ne tourne jamais sur le fil de la page. Il reçoit le contenu
// du jour et rend, UNE FOIS le calcul fini, le Diamant et la preuve (la partie qui le donne). Lot T3b : plus de pièce rendue en route — `?bot` montre la partie RETENUE (la variante qui donne
// le Diamant, pas le réglage ordinaire), qu'on ne connaît qu'à la fin : la ligne « Le bot réfléchit… » reste affichée jusque-là. Chargé à la demande par `botDemande.ts`.
export type MessageBot = { genre: "fin"; hauteurMm: number; preuve: string } | { genre: "echec" };

self.onmessage = async (e: MessageEvent<{ contenu: Scenario }>) => {
  const envoyer = (m: MessageBot): void => (self as unknown as { postMessage(m: MessageBot): void }).postMessage(m);
  try {
    const R = await chargerRapier();
    const r = jouerBotRobuste(R, e.data.contenu);
    // Le Diamant est plafonné (génération 3) ; la preuve reste la vraie partie du bot.
    envoyer({ genre: "fin", hauteurMm: diamantDe(r.resultat.hauteurMm, e.data.contenu.g), preuve: encoderRediffusion(r.rediffusion) });
  } catch {
    envoyer({ genre: "echec" });
  }
};
