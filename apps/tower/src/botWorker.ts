import { encoderRediffusion, type Scenario } from "@cdj/tower-sim";
import { bot, jouerBotRobuste, OPTIONS_BOT } from "@cdj/tower-sim/bot";
import { chargerRapier } from "@cdj/tower-sim/rapier";

// Le Web Worker du bot de l'auteur (lot T3) — **hors production seulement** (aperçus, local) : le bot coûte une minute par jour, il ne tourne jamais sur le fil de la page. Il reçoit le contenu
// du jour, rend la main à chaque pièce décidée (les commandes de la pièce, pour `&bot`) puis rend la preuve et le Diamant. Chargé à la demande par `botDemande.ts`.
export type MessageBot = { genre: "piece"; masques: number[] } | { genre: "fin"; hauteurMm: number; preuve: string } | { genre: "echec" };

self.onmessage = async (e: MessageEvent<{ contenu: Scenario }>) => {
  const envoyer = (m: MessageBot): void => (self as unknown as { postMessage(m: MessageBot): void }).postMessage(m);
  try {
    const R = await chargerRapier();
    const g = bot(R, e.data.contenu, OPTIONS_BOT);
    for (;;) {
      const n = g.next();
      if (n.done) {
        // Le réglage ordinaire est montré pièce par pièce ; si son résultat est médiocre, le bot reprend avec ses variantes (sans les montrer) : le Diamant est la meilleure preuve.
        if (n.value === null) throw new Error("calcul coupé");
        const r = jouerBotRobuste(R, e.data.contenu, n.value);
        envoyer({ genre: "fin", hauteurMm: r.resultat.hauteurMm, preuve: encoderRediffusion(r.rediffusion) });
        return;
      }
      envoyer({ genre: "piece", masques: n.value });
    }
  } catch {
    envoyer({ genre: "echec" });
  }
};
