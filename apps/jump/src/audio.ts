import {
  SLIDE_LOOP,
  SAW_VOICES,
  SoundRate,
  VoiceLimiter,
  sliderGain,
  soundFor,
  soundGainFor,
  type Layer,
  type SawVoice,
  type SoundSpec,
} from "./audioLogic";
import type { GameEvent } from "./events";
import type { PlayerSettings } from "./settings";

// Son de DailyJump (lot 8) : Web Audio **procédural**, zéro fichier (oscillateurs et bruit filtré). Tout ce qui se décide (quel son, quel
// volume, quelles scies, combien à la fois) est dans `audioLogic.ts`, pur et testé ; ici on ne fait que jouer.
//
// Trois bus sous le volume général : effets, ambiance (vide jusqu'au lot 9). Le contexte audio n'est créé ou réveillé qu'au **premier geste**
// du joueur (règle des navigateurs, et d'iOS en particulier : la reprise doit se faire pendant le geste) ; il est suspendu quand l'onglet est
// caché. Le son ne lit que les événements de jeu : il ne peut rien changer au résultat d'un essai.

/** Gestes qui déverrouillent le son (iOS ne compte que certains d'entre eux : `touchend`, `click`, `keydown`…). */
const UNLOCK_EVENTS = ["pointerdown", "pointerup", "touchend", "mousedown", "keydown", "click"] as const;

interface SawNode {
  gain: GainNode;
  pan: StereoPannerNode | null;
  index: number;
}

export interface AudioDebug {
  available: boolean;
  unlocked: boolean;
  state: string;
  /** Sons demandés (décidés par la logique, même avant le premier geste) et joués (vraiment programmés), par nom. */
  requested: Record<string, number>;
  played: Record<string, number>;
  /** Sons refusés : polyphonie pleine, débit du carnage. */
  refused: number;
  carnageDropped: number;
  slide: boolean;
  saws: { index: number; gain: number; pan: number }[];
  errors: number;
}

export class JumpAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  /** Bus de l'ambiance : créé, branché, vide jusqu'au lot 9. */
  private ambience: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private slideNode: { gain: GainNode } | null = null;
  private sawNodes: SawNode[] = [];
  private readonly limiter = new VoiceLimiter();
  private readonly carnageRate = new SoundRate();
  private sliding = false;
  private active = true;
  private variation = 0;
  private lastSaws: SawVoice[] = [];
  private readonly requested: Record<string, number> = {};
  private readonly played: Record<string, number> = {};
  private errors = 0;
  private readonly offs: (() => void)[] = [];
  readonly available: boolean;

  constructor(private settings: PlayerSettings) {
    this.available = typeof window !== "undefined" && !!(window.AudioContext ?? (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);
    if (!this.available) return;
    const unlock = () => this.unlock();
    for (const type of UNLOCK_EVENTS) {
      window.addEventListener(type, unlock, { capture: true, passive: true });
      this.offs.push(() => window.removeEventListener(type, unlock, { capture: true }));
    }
    document.addEventListener("visibilitychange", () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend().catch(() => undefined);
      else void this.ctx.resume().catch(() => undefined);
    });
  }

  get unlocked(): boolean {
    return this.ctx?.state === "running";
  }

  /** Crée le contexte (une fois) ou le réveille. Appelé pendant un geste du joueur. */
  unlock(): void {
    if (!this.available || document.hidden) return;
    try {
      if (!this.ctx) this.build();
      const ctx = this.ctx!;
      if (ctx.state !== "running") {
        void ctx.resume().then(
          () => this.release(),
          () => undefined,
        );
        // iOS : un son vide joué pendant le geste achève le déverrouillage.
        const b = ctx.createBufferSource();
        b.buffer = ctx.createBuffer(1, 1, 22050);
        b.connect(ctx.destination);
        b.start(0);
      } else this.release();
    } catch {
      this.errors++;
    }
  }

  /** Le son marche : plus besoin d'écouter les gestes. */
  private release(): void {
    if (this.ctx?.state !== "running") return;
    for (const off of this.offs) off();
    this.offs.length = 0;
  }

  private build(): void {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.connect(this.master);
    this.ambience = ctx.createGain();
    this.ambience.connect(this.master);
    this.applyGains(0);
    // Bruit blanc d'une seconde (hasard de l'affichage, jamais de la simulation), lu par les bruits filtrés et les boucles.
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.buildSlide(ctx);
    this.buildSaws(ctx);
  }

  private loopNoise(ctx: AudioContext): AudioBufferSourceNode {
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.start();
    return src;
  }

  private buildSlide(ctx: AudioContext): void {
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = SLIDE_LOOP.freq;
    f.Q.value = SLIDE_LOOP.q;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    this.loopNoise(ctx).connect(f).connect(gain).connect(this.sfx!);
    this.slideNode = { gain };
  }

  /** Sifflement d'une scie : dent de scie filtrée, battue par un trémolo rapide (la rotation). Trois voix, réattribuées à chaque image. */
  private buildSaws(ctx: AudioContext): void {
    for (let i = 0; i < SAW_VOICES; i++) {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = 820 + i * 37;
      const o2 = ctx.createOscillator();
      o2.type = "square";
      o2.frequency.value = 1645 + i * 53;
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 2200;
      f.Q.value = 2.5;
      const trem = ctx.createGain();
      trem.gain.value = 0.6;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 23 + i * 3;
      const depth = ctx.createGain();
      depth.gain.value = 0.4;
      lfo.connect(depth).connect(trem.gain);
      const mix = ctx.createGain();
      mix.gain.value = 0.5;
      o2.connect(mix);
      o.connect(f);
      mix.connect(f);
      f.connect(trem);
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const pan = typeof ctx.createStereoPanner === "function" ? ctx.createStereoPanner() : null;
      trem.connect(gain);
      if (pan) gain.connect(pan).connect(this.sfx!);
      else gain.connect(this.sfx!);
      o.start();
      o2.start();
      lfo.start();
      this.sawNodes.push({ gain, pan, index: -1 });
    }
  }

  private applyGains(fade = 0.04): void {
    if (!this.ctx || !this.master || !this.sfx || !this.ambience) return;
    const t = this.ctx.currentTime;
    const set = (p: AudioParam, v: number) => (fade > 0 ? p.setTargetAtTime(v, t, fade) : (p.value = v));
    set(this.master.gain, sliderGain(this.settings.volume));
    set(this.sfx.gain, sliderGain(this.settings.sfx));
    set(this.ambience.gain, sliderGain(this.settings.ambience));
  }

  setSettings(s: PlayerSettings): void {
    this.settings = s;
    this.applyGains();
  }

  /** Partie en cours (faux : pause, panneau ouvert) : sans elle, les boucles se taisent. */
  setActive(on: boolean): void {
    this.active = on;
    if (!on) this.update([]);
    this.syncSlide();
  }

  /** Fin de toutes les boucles (recommencer, réapparition, fin du carnage). */
  stopLoops(): void {
    this.sliding = false;
    this.syncSlide();
  }

  private syncSlide(): void {
    if (!this.ctx || !this.slideNode) return;
    this.slideNode.gain.gain.setTargetAtTime(this.sliding && this.active ? SLIDE_LOOP.gain : 0, this.ctx.currentTime, SLIDE_LOOP.fade);
  }

  /** Les événements d'un pas : sons ponctuels et boucle de glisse. */
  handle(events: readonly GameEvent[]): void {
    for (const e of events) {
      if (e.kind === "glisseDebut") {
        this.sliding = true;
        this.syncSlide();
        continue;
      }
      if (e.kind === "glisseFin" || e.kind === "mort" || e.kind === "reapparition" || e.kind === "arrivee") {
        if (e.source !== "vie" && this.sliding) {
          this.sliding = false;
          this.syncSlide();
        }
      }
      this.variation = (this.variation + 0.618034) % 1;
      const s = soundFor(e, this.variation);
      if (!s) continue;
      if (e.source === "vie" && !this.carnageRate.admit(e.tick)) continue;
      this.requested[s.id] = (this.requested[s.id] ?? 0) + 1;
      this.play(s, soundGainFor(e));
    }
  }

  /** Aperçu du niveau des effets (menu ⏸) : un saut, hors des compteurs. */
  preview(): void {
    const s = soundFor({ kind: "saut", x: 0, y: 0, tick: 0, source: "jeu" });
    if (s) this.play(s, 1, false);
  }

  private play(s: SoundSpec, gain: number, count = true): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running" || !this.sfx) return;
    if (!this.limiter.admit(ctx.currentTime, s.duration, s.priority)) return;
    try {
      for (const l of s.layers) this.layer(ctx, l, gain);
      if (count) this.played[s.id] = (this.played[s.id] ?? 0) + 1;
    } catch {
      this.errors++;
    }
  }

  private layer(ctx: AudioContext, l: Layer, k: number): void {
    const t0 = ctx.currentTime + (l.delay ?? 0);
    const peak = Math.max(0.0002, l.gain * k);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.01, l.dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + l.dur);
    g.connect(this.sfx!);
    let src: AudioScheduledSourceNode;
    if (l.type === "tone") {
      const o = ctx.createOscillator();
      o.type = l.wave ?? "sine";
      o.frequency.setValueAtTime(l.freq, t0);
      if (l.to) o.frequency.exponentialRampToValueAtTime(l.to, t0 + l.dur);
      o.connect(g);
      src = o;
    } else {
      const b = ctx.createBufferSource();
      b.buffer = this.noise;
      const f = ctx.createBiquadFilter();
      f.type = l.filter ?? "bandpass";
      f.Q.value = l.q ?? 1.2;
      f.frequency.setValueAtTime(l.freq, t0);
      if (l.to) f.frequency.exponentialRampToValueAtTime(l.to, t0 + l.dur);
      b.connect(f).connect(g);
      src = b;
    }
    src.start(t0);
    src.stop(t0 + l.dur + 0.03);
    src.onended = () => g.disconnect();
  }

  /** À chaque image : les scies audibles (`sawMix`). Une liste vide les fait taire. */
  update(saws: readonly SawVoice[]): void {
    this.lastSaws = this.active ? saws.slice() : [];
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running") return;
    const t = ctx.currentTime;
    const list = this.lastSaws;
    // Une voix garde sa scie tant qu'elle reste audible : pas de saut de stéréo quand l'ordre des distances change.
    const free = this.sawNodes.filter((n) => !list.some((s) => s.index === n.index));
    for (const s of list) {
      let node = this.sawNodes.find((n) => n.index === s.index);
      if (!node) {
        node = free.shift();
        if (!node) continue;
        node.index = s.index;
        node.pan?.pan.setValueAtTime(s.pan, t);
      }
      node.gain.gain.setTargetAtTime(s.gain, t, 0.05);
      node.pan?.pan.setTargetAtTime(s.pan, t, 0.05);
    }
    for (const n of free) {
      n.gain.gain.setTargetAtTime(0, t, 0.05);
      n.index = -1;
    }
  }

  debug(): AudioDebug {
    return {
      available: this.available,
      unlocked: this.unlocked,
      state: this.ctx?.state ?? "aucun",
      requested: { ...this.requested },
      played: { ...this.played },
      refused: this.limiter.refused,
      carnageDropped: this.carnageRate.dropped,
      slide: this.sliding && this.active,
      saws: this.lastSaws.map((s) => ({ index: s.index, gain: s.gain, pan: s.pan })),
      errors: this.errors,
    };
  }
}
