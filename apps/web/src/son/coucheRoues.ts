// Lot 55 (partie B) — la couche des **pneus, du sol et du vent** et les bruitages ponctuels de la planche : la même pour les trois approches, pour que la comparaison
// ne porte que sur le moteur. C'est le son du lot 9 (`audioLogic.ts` : crissement, roulement par revêtement, vent), repris à l'identique ; la planche ne juge pas ces sons-là
// (ils sont dans l'inventaire du README, à refaire ou non selon l'approche choisie).
import { rollVoice, skidLevel, windGain, landingSound } from "../audioLogic";
import type { TrameVirtuelle } from "./voitureVirtuelle";
import { Compteur } from "./moteur";

export type Ponctuel = "turbo" | "land" | "cut";

export interface CoucheRoues {
  readonly noeuds: number;
  maj(f: TrameVirtuelle, t?: number): void;
  ponctuel(nom: Ponctuel, t?: number): void;
  arreter(): void;
}

export function creerCoucheRoues(ctx: BaseAudioContext, sortie: AudioNode, bruit: AudioBuffer): CoucheRoues {
  const c = new Compteur();
  const bus = c.nd(ctx.createGain());
  bus.connect(sortie);
  const boucle = (f: BiquadFilterType, freq: number, q: number) => {
    const s = c.nd(ctx.createBufferSource());
    s.buffer = bruit;
    s.loop = true;
    const filtre = c.nd(ctx.createBiquadFilter());
    filtre.type = f;
    filtre.frequency.value = freq;
    filtre.Q.value = q;
    const g = c.nd(ctx.createGain());
    g.gain.value = 0;
    s.connect(filtre).connect(g).connect(bus);
    s.start();
    return { filtre, g };
  };
  const skid = boucle("bandpass", 1500, 3);
  const roll = boucle("bandpass", 900, 0.8);
  const vent = boucle("highpass", 700, 0.7);

  const rafale = (duree: number, freq: number, gain: number, balayage: number | undefined, t0: number) => {
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    const s = c.bref(ctx.createBufferSource(), f, g);
    s.buffer = bruit;
    f.type = "bandpass";
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(freq, t0);
    if (balayage) f.frequency.exponentialRampToValueAtTime(balayage, t0 + duree);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duree);
    s.connect(f).connect(g).connect(bus);
    s.start(t0);
    s.stop(t0 + duree + 0.05);
  };
  const ton = (freq: number, duree: number, type: OscillatorType, gain: number, t0: number, vers?: number) => {
    const g = ctx.createGain();
    const o = c.bref(ctx.createOscillator(), g);
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (vers) o.frequency.exponentialRampToValueAtTime(vers, t0 + duree);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duree);
    o.connect(g).connect(bus);
    o.start(t0);
    o.stop(t0 + duree + 0.05);
  };

  return {
    get noeuds() {
      return c.n;
    },
    maj(f, t) {
      const now = t ?? ctx.currentTime;
      const k = 0.05;
      const voix = rollVoice(f.surface, f.kerb);
      const derape = skidLevel(f.slide, f.speed, f.brake, f.grounded);
      skid.filtre.frequency.setTargetAtTime(voix.skidFreq, now, k);
      skid.g.gain.setTargetAtTime(derape * 0.2, now, k);
      const r = Math.min(1.5, f.speed / 30);
      roll.filtre.frequency.setTargetAtTime(voix.rollFreq * (0.6 + 0.6 * r), now, k);
      roll.g.gain.setTargetAtTime(f.grounded ? voix.rollGain * r : 0, now, k);
      vent.g.gain.setTargetAtTime(windGain(f.speed), now, k);
    },
    ponctuel(nom, t) {
      const t0 = t ?? ctx.currentTime;
      if (nom === "turbo") {
        rafale(0.7, 500, 0.4, 3000, t0);
        ton(140, 0.7, "sawtooth", 0.12, t0, 520);
      } else if (nom === "land") {
        const l = landingSound(0.8, 0.6);
        rafale(l.noiseDur, l.noiseFreq, l.noiseGain, 120, t0);
        ton(l.thumpFreq, l.thumpDur, "sine", l.thumpGain, t0, 35);
      } else {
        ton(300, 0.5, "sawtooth", 0.14, t0, 60);
      }
    },
    arreter() {
      c.tout();
    },
  };
}
