import type { SurfaceKind } from "@cdj/sim";
import {
  rollVoice,
  engineSound,
  landingSound,
  noteFreq,
  nextVolume,
  parseAudioSettings,
  skidLevel,
  toggleMute,
  windGain,
  type AudioSettings,
} from "./audioLogic";

// Sons procéduraux (Web Audio, lot 9) : aucun fichier, donc rien à créditer ni à télécharger (voir docs/credits.md).
// Le contexte audio ne démarre qu'au premier geste du joueur (règle des navigateurs). Le son ne lit que l'état de la
// voiture : il ne peut rien changer au résultat d'une course.

const KEY = "cdj:audio";

/** Ce que le son lit à chaque image. */
export interface AudioFrame {
  speed: number;
  throttle: number;
  brake: boolean;
  /** Dérive (vitesse latérale ÷ vitesse). */
  slide: number;
  grounded: boolean;
  surface: SurfaceKind;
  /** Roues sur un vibreur (lot 21). */
  kerb?: number;
  boost: boolean;
  turbo: boolean;
  cut: boolean;
  /** Course en cours et non figée (pause, fenêtre ouverte) : sinon, silence. */
  active: boolean;
}

export type OneShot = "countdown" | "go" | "checkpoint" | "finish" | "medal" | "impact" | "land" | "turbo" | "cut" | "fall" | "respawn";

export class GameAudio {
  settings: AudioSettings;
  /** Derniers sons joués (outil de test `?debug`). */
  readonly log: OneShot[] = [];
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engine: { o1: OscillatorNode; o2: OscillatorNode; lp: BiquadFilterNode; gain: GainNode } | null = null;
  private skid: { f: BiquadFilterNode; gain: GainNode } | null = null;
  private roll: { f: BiquadFilterNode; gain: GainNode } | null = null;
  private wind: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private wasBoost = false;
  private wasCut = false;
  private listeners: (() => void)[] = [];

  constructor(private readonly onChange: (s: AudioSettings) => void = () => undefined) {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(KEY);
    } catch {
      /* stockage indisponible */
    }
    this.settings = parseAudioSettings(raw);
    // Premier geste du joueur : on peut enfin démarrer le son.
    const start = () => {
      this.ensure();
      for (const off of this.listeners) off();
      this.listeners = [];
    };
    for (const type of ["pointerdown", "keydown", "touchstart"]) {
      window.addEventListener(type, start, { once: true });
      this.listeners.push(() => window.removeEventListener(type, start));
    }
    document.addEventListener("visibilitychange", () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else void this.ctx.resume();
    });
  }

  get running(): boolean {
    return this.ctx?.state === "running";
  }

  private save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.settings));
    } catch {
      /* tant pis */
    }
    this.apply();
    this.onChange(this.settings);
  }

  setSettings(s: AudioSettings) {
    this.settings = s;
    this.save();
  }

  mute() {
    this.setSettings(toggleMute(this.settings));
  }

  cycle() {
    this.setSettings(nextVolume(this.settings));
  }

  private apply() {
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.settings.volume, this.ctx.currentTime, 0.04);
  }

  /** Crée le contexte (une fois), ou le réveille. Sans Web Audio, ne fait rien. */
  private ensure(): boolean {
    if (this.ctx) {
      if (this.ctx.state === "suspended" && !document.hidden) void this.ctx.resume();
      return true;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return false;
    try {
      const ctx = new Ctor();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.settings.volume;
      this.master.connect(ctx.destination);
      // Bruit blanc de 2 s, lu en boucle par le crissement, le roulement et le vent.
      this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.buildEngine(ctx);
      void ctx.resume();
      return true;
    } catch {
      this.ctx = null;
      return false;
    }
  }

  private loopNoise(ctx: AudioContext): AudioBufferSourceNode {
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.start();
    return src;
  }

  private buildEngine(ctx: AudioContext) {
    const master = this.master!;
    const o1 = ctx.createOscillator();
    o1.type = "sawtooth";
    const o2 = ctx.createOscillator();
    o2.type = "square";
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    const gain = ctx.createGain();
    gain.gain.value = 0;
    o1.connect(lp);
    o2.connect(lp);
    lp.connect(gain).connect(master);
    o1.start();
    o2.start();
    this.engine = { o1, o2, lp, gain };

    const skidF = ctx.createBiquadFilter();
    skidF.type = "bandpass";
    skidF.Q.value = 3;
    const skidG = ctx.createGain();
    skidG.gain.value = 0;
    this.loopNoise(ctx).connect(skidF).connect(skidG).connect(master);
    this.skid = { f: skidF, gain: skidG };

    const rollF = ctx.createBiquadFilter();
    rollF.type = "bandpass";
    rollF.Q.value = 0.8;
    const rollG = ctx.createGain();
    rollG.gain.value = 0;
    this.loopNoise(ctx).connect(rollF).connect(rollG).connect(master);
    this.roll = { f: rollF, gain: rollG };

    const windF = ctx.createBiquadFilter();
    windF.type = "highpass";
    windF.frequency.value = 700;
    const windG = ctx.createGain();
    windG.gain.value = 0;
    this.loopNoise(ctx).connect(windF).connect(windG).connect(master);
    this.wind = windG;
  }

  /** À appeler à chaque image : règle moteur, crissement, roulement et vent d'après `f`. */
  update(f: AudioFrame) {
    const ctx = this.ctx;
    if (!ctx || !this.engine || !this.skid || !this.roll || !this.wind || ctx.state !== "running") return;
    const t = ctx.currentTime;
    const k = 0.05; // constante de temps de lissage (s)
    const on = f.active;
    const e = engineSound(f.speed, f.cut ? 0 : f.throttle);
    this.engine.o1.frequency.setTargetAtTime(e.freq, t, k);
    this.engine.o2.frequency.setTargetAtTime(e.freq * 0.5, t, k);
    this.engine.lp.frequency.setTargetAtTime(350 + e.rpm * 1700, t, k);
    this.engine.gain.gain.setTargetAtTime(on ? e.gain * (f.grounded ? 1 : 0.7) : 0, t, k);

    const voice = rollVoice(f.surface, f.kerb ?? 0);
    const skid = on ? skidLevel(f.slide, f.speed, f.brake, f.grounded) : 0;
    this.skid.f.frequency.setTargetAtTime(voice.skidFreq, t, k);
    this.skid.gain.gain.setTargetAtTime(skid * 0.2, t, k);
    const speedRatio = Math.min(1.5, f.speed / 30);
    this.roll.f.frequency.setTargetAtTime(voice.rollFreq * (0.6 + 0.6 * speedRatio), t, k);
    this.roll.gain.gain.setTargetAtTime(on && f.grounded ? voice.rollGain * speedRatio : 0, t, k);
    this.wind.gain.setTargetAtTime(on ? windGain(f.speed) : 0, t, k);

    const boosted = f.boost || f.turbo;
    if (boosted && !this.wasBoost) this.play("turbo");
    this.wasBoost = boosted;
    if (f.cut && !this.wasCut) this.play("cut");
    this.wasCut = f.cut;
  }

  // --- Sons ponctuels ---------------------------------------------------------------------------

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0, slideTo?: number) {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.master!);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  private burst(dur: number, freq: number, gain: number, delay = 0, sweepTo?: number) {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(freq, t0);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  /** `n` : pour le décompte, le chiffre affiché (3, 2, 1) ; pour un impact, sa force ∈ [0, 1] ; pour une médaille, 0–3. `quality` : pour une réception, son alignement (lot 19). */
  play(what: OneShot, n = 1, quality = 1) {
    this.log.push(what);
    if (this.log.length > 24) this.log.shift();
    if (!this.ensure() || !this.running) return;
    switch (what) {
      case "countdown":
        this.tone(noteFreq(-9), 0.16, "square", 0.12);
        break;
      case "go":
        this.tone(noteFreq(3), 0.45, "square", 0.14);
        this.tone(noteFreq(10), 0.45, "triangle", 0.1);
        break;
      case "checkpoint":
        this.tone(noteFreq(3), 0.09, "sine", 0.16);
        this.tone(noteFreq(10), 0.16, "sine", 0.16, 0.09);
        break;
      case "impact":
        this.burst(0.18, 900, 0.5 * Math.min(1, 0.4 + n), 0, 200);
        this.tone(90, 0.2, "sine", 0.35 * Math.min(1, 0.4 + n), 0, 40);
        break;
      case "land": {
        // Lot 19 : la qualité de la réception change le son (un « pof » sourd si elle est propre, un choc craquant sinon).
        const l = landingSound(n, quality);
        this.burst(l.noiseDur, l.noiseFreq, l.noiseGain, 0, 120);
        this.tone(l.thumpFreq, l.thumpDur, "sine", l.thumpGain, 0, 35);
        break;
      }
      case "turbo":
        this.burst(0.7, 500, 0.4, 0, 3000);
        this.tone(140, 0.7, "sawtooth", 0.12, 0, 520);
        break;
      case "cut":
        this.tone(300, 0.5, "sawtooth", 0.14, 0, 60);
        break;
      case "fall":
        // Chute (lot 17) : un sifflement qui descend, puis le vent qui s'éloigne.
        this.tone(880, 0.55, "sine", 0.16, 0, 70);
        this.burst(0.6, 1400, 0.22, 0, 220);
        break;
      case "respawn":
        // Retour au point de contrôle : une petite montée, nette.
        this.tone(noteFreq(-2), 0.1, "triangle", 0.12);
        this.tone(noteFreq(5), 0.16, "triangle", 0.12, 0.08);
        break;
      case "finish":
        [0, 4, 7, 12].forEach((s, i) => this.tone(noteFreq(s), 0.32, "triangle", 0.16, i * 0.11));
        this.tone(noteFreq(12), 0.8, "square", 0.08, 0.44);
        break;
      case "medal":
        // Plus la médaille est belle, plus l'arpège est haut et long.
        for (let i = 0; i <= Math.max(1, n); i++) this.tone(noteFreq(12 + i * 4), 0.22, "sine", 0.14, 0.6 + i * 0.09);
        break;
    }
  }
}
