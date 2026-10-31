// Lot 55 (partie B) — le moteur **d'avant** (lot 9), repris tel quel pour servir de référence sur la planche : deux oscillateurs (dent de scie et carré à l'octave), un filtre
// passe-bas qui suit le régime, six rapports qui changent à des vitesses fixes (`engineSound`). Il n'est que dans la vitrine : le jeu a encore ce code dans `audio.ts`.
import { engineSound } from "../audioLogic";
import { Compteur, type EntreeMoteur, type Moteur } from "./moteur";

export function creerActuel(ctx: BaseAudioContext, sortie: AudioNode): Moteur {
  const c = new Compteur();
  const o1 = c.nd(ctx.createOscillator());
  o1.type = "sawtooth";
  const o2 = c.nd(ctx.createOscillator());
  o2.type = "square";
  const lp = c.nd(ctx.createBiquadFilter());
  lp.type = "lowpass";
  const gain = c.nd(ctx.createGain());
  gain.gain.value = 0;
  o1.connect(lp);
  o2.connect(lp);
  lp.connect(gain).connect(sortie);
  o1.start();
  o2.start();
  return {
    nom: "Actuel (lot 9)",
    get noeuds() {
      return c.n;
    },
    maj(e: EntreeMoteur) {
      const now = e.t ?? ctx.currentTime;
      const k = 0.05;
      const s = engineSound(e.vitesse, e.gaz);
      o1.frequency.setTargetAtTime(s.freq, now, k);
      o2.frequency.setTargetAtTime(s.freq * 0.5, now, k);
      lp.frequency.setTargetAtTime(350 + s.rpm * 1700, now, k);
      gain.gain.setTargetAtTime(s.gain * (e.enAir ? 0.7 : 1), now, k);
    },
    petarade() {
      /* le son d'avant n'en a pas */
    },
    arreter() {
      c.tout();
    },
  };
}
