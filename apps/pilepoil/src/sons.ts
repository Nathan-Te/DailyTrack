import { ouvrirContexteAudio } from "@cdj/core/audio";
import type { Sorte } from "@cdj/pilepoil-sim";

// Les sons de « Pile poil » (lot PA2) : de la synthèse (Web Audio), aucun fichier. Le contexte s'ouvre par `ouvrirContexteAudio` (session `ambient`, règle S2 : le son du jeu se mêle à celui du téléphone), au premier
// geste du joueur ; le volume est celui des effets (`OptionsPartie.volumeEffets`, relu à chaque son). Un tic discret au rebond du curseur ; un son par sorte d'appui ; un « pile » enchaîné monte d'un demi-ton à chaque fois.

export interface Sons {
  /** À un geste du joueur : ouvre (ou réveille) le contexte. */
  reveiller(): void;
  tic(): void;
  appui(sorte: Sorte, enchaine: number): void;
  fermer(): void;
}

type Forme = "sine" | "square" | "triangle" | "sawtooth";

export function creerSons(volume: () => number): Sons {
  let ctx: AudioContext | null = null;
  let essaye = false;
  /** Une note : fréquence (Hz, et celle d'arrivée pour un glissé), durée (s), forme, gain, départ décalé (s). */
  const note = (f: number, duree: number, forme: Forme, gain: number, decale = 0, fin = f): void => {
    const v = volume();
    if (!ctx || ctx.state !== "running" || v <= 0) return;
    const t = ctx.currentTime + decale;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = forme;
    o.frequency.setValueAtTime(f, t);
    if (fin !== f) o.frequency.exponentialRampToValueAtTime(fin, t + duree);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain * v), t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + duree + 0.02);
  };
  return {
    reveiller() {
      if (!essaye) {
        essaye = true;
        ctx = ouvrirContexteAudio<AudioContext>();
      }
      if (ctx?.state === "suspended") void ctx.resume().catch(() => undefined);
    },
    tic: () => note(2400, 0.018, "square", 0.025),
    appui(sorte, enchaine) {
      if (sorte === "pile") {
        // Deux notes claires ; chaque « pile » d'affilée monte d'un demi-ton.
        const base = 784 * 2 ** (Math.max(0, enchaine - 1) / 12);
        note(base, 0.12, "triangle", 0.22);
        note(base * 1.5, 0.22, "triangle", 0.2, 0.07);
        note(base * 2, 0.26, "sine", 0.1, 0.07);
      } else if (sorte === "bien") note(660, 0.16, "triangle", 0.2);
      else if (sorte === "touche") note(440, 0.14, "triangle", 0.16);
      else note(180, 0.24, "sawtooth", 0.09, 0, 90);
    },
    fermer() {
      void ctx?.close().catch(() => undefined);
      ctx = null;
    },
  };
}
