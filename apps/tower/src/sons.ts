import type { EvenementJeu } from "./evenements";
import { hasardAffichage } from "./hasardAffichage";
import { FiltreCris, type Couche, type VolumesFamilles, VOLUMES_DEFAUT, accepter, gainDe, sonDe } from "./sonsLogique";
import { type ReglagesSons, SONS_DEFAUT } from "./reglagesSons";

// Les sons de Tower (lot T5) — Web Audio **procédural, sans fichier** (oscillateurs et bruit filtré), sur le modèle de `audio.ts` de Jump. La décision (quel son, quel volume) est dans
// `sonsLogique.ts`, pure ; ici seulement la lecture.
//
// - **Aucun son avant le premier geste** (règle des navigateurs, et d'iOS : la reprise doit se faire pendant le geste) : le contexte audio n'est créé qu'au premier `pointerdown`, `keydown`,
//   `touchend`… que le jeu a vu ; un événement qui arrive avant est perdu, jamais mis en file.
// - **Avec la musique** : un contexte à part, un bus d'effets sous un volume général ; la musique (flux d'un élément `Audio`, `@cdj/musique`) n'est jamais coupée ni retenue par un effet : les
//   deux se mélangent à la sortie. Le niveau de la musique baisse en partie (`musique.baisser`), ce que ce module ignore.
// - Le contexte est suspendu quand l'onglet est caché (le jeu ouvre alors la pause) et repris au retour.
// - Le souffle du vent est une boucle de bruit filtré dont le gain monte et descend (`souffle`).
// - Les cris : une seule voix à la fois, rares (`FiltreCris`), réglables à zéro (la famille « cris »).

/** Les gestes qui déverrouillent le son (iOS ne compte que certains d'entre eux). */
export const GESTES_DEVERROUILLAGE = ["pointerdown", "pointerup", "touchend", "mousedown", "keydown", "click"] as const;

/** Ce que `Sons` demande à un contexte audio : le sous-ensemble de `AudioContext` qu'il utilise (les tests en fournissent un faux). */
export type ContexteAudio = Pick<AudioContext, "createGain" | "createOscillator" | "createBufferSource" | "createBiquadFilter" | "createBuffer" | "destination" | "currentTime" | "state" | "sampleRate" | "resume" | "suspend">;

export interface OptionsSons {
  reglages: () => ReglagesSons;
  volumes: () => VolumesFamilles;
  /** Le hasard d'AFFICHAGE (jamais celui de la simulation). */
  hasard: () => number;
  /** Crée le contexte (au premier geste seulement). Défaut : le `AudioContext` du navigateur ; `null` : pas d'audio. */
  creerContexte?: () => ContexteAudio | null;
  /** Où écouter les gestes (défaut : la fenêtre). */
  cible?: Pick<EventTarget, "addEventListener" | "removeEventListener">;
}

function contexteDuNavigateur(): ContexteAudio | null {
  const Ctor = typeof window === "undefined" ? undefined : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  if (!Ctor) return null;
  try {
    return new Ctor();
  } catch {
    return null;
  }
}

export class Sons {
  private ctx: ContexteAudio | null = null;
  private maitre: GainNode | null = null;
  private souffleur: { gain: GainNode } | null = null;
  private tamponBruit: AudioBuffer | null = null;
  private fins: number[] = [];
  private readonly cris = new FiltreCris();
  private ventVoulu = false;
  private branche = false;
  private readonly surGeste = (): void => this.deverrouiller();
  /** Pour les tests et `?debug` : combien de sons ont été joués, et lesquels. */
  readonly joues: string[] = [];

  constructor(private readonly o: OptionsSons) {}

  /** Écoute les gestes du joueur : le premier crée (ou réveille) le contexte audio. */
  brancher(): void {
    if (this.branche) return;
    this.branche = true;
    const cible = this.o.cible ?? (typeof window === "undefined" ? undefined : window);
    for (const g of GESTES_DEVERROUILLAGE) cible?.addEventListener(g, this.surGeste, { passive: true } as AddEventListenerOptions);
  }

  /** Le joueur a fait un geste : créer le contexte audio (une fois) ou le réveiller. */
  deverrouiller(): void {
    if (!this.ctx) {
      const ctx = (this.o.creerContexte ?? contexteDuNavigateur)();
      if (!ctx) return;
      this.ctx = ctx;
      this.maitre = ctx.createGain();
      this.maitre.connect(ctx.destination);
      this.maitre.gain.value = 1;
      this.souffleur = null;
      if (this.ventVoulu) this.souffle(true);
    }
    if (this.ctx.state !== "running") void Promise.resolve(this.ctx.resume()).catch(() => undefined);
  }

  /** Vrai une fois le premier geste passé (le contexte existe). */
  get pret(): boolean {
    return this.ctx !== null;
  }

  /** L'onglet est caché : suspendre ; revenu : reprendre. */
  surVisibilite(cache: boolean): void {
    if (!this.ctx) return;
    if (cache) void Promise.resolve(this.ctx.suspend()).catch(() => undefined);
    else void Promise.resolve(this.ctx.resume()).catch(() => undefined);
  }

  /** Joue le son d'un événement. Rend vrai s'il a été joué (faux : avant le premier geste, sons coupés, polyphonie pleine, cri refusé). */
  jouer(e: EvenementJeu): boolean {
    const ctx = this.ctx;
    if (!ctx || !this.maitre) return false;
    const gain = gainDe(e, this.o.reglages(), this.o.volumes());
    if (e.genre === "ventDebut") this.souffle(true);
    if (e.genre === "ventFin") this.souffle(false);
    if (gain <= 0) return false;
    const r = sonDe(e, this.o.hasard());
    const t0 = ctx.currentTime;
    this.fins = this.fins.filter((f) => f > t0);
    if (!accepter(r.priorite, this.fins.length)) return false;
    if (e.genre === "cri" && !this.cris.accepter(t0, r.duree)) return false;
    this.fins.push(t0 + r.duree);
    for (const c of r.couches) this.couche(ctx, c, gain, t0);
    this.joues.push(e.genre);
    return true;
  }

  /** Le souffle du vent : une boucle de bruit filtré dont le gain monte (le vent souffle pendant ses trois pièces) et retombe. Réglé par la famille « vent » et le volume général. */
  souffle(oui: boolean): void {
    this.ventVoulu = oui;
    const ctx = this.ctx;
    if (!ctx || !this.maitre) return;
    const g = this.o.reglages();
    if (!this.souffleur && !(oui && g.actifs)) return; // rien à faire entendre : la boucle n'est même pas créée
    if (!this.souffleur) {
      const src = ctx.createBufferSource();
      src.buffer = this.bruit(ctx);
      src.loop = true;
      const filtre = ctx.createBiquadFilter();
      filtre.type = "bandpass";
      filtre.frequency.value = 650;
      filtre.Q.value = 0.8;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(filtre);
      filtre.connect(gain);
      gain.connect(this.maitre);
      src.start();
      this.souffleur = { gain };
    }
    const cible = oui && g.actifs ? gainDe({ genre: "ventDebut" }, g, this.o.volumes()) * 1.2 : 0;
    const p = this.souffleur.gain.gain;
    p.cancelScheduledValues?.(ctx.currentTime);
    p.setTargetAtTime?.(cible, ctx.currentTime, 0.25);
    if (!p.setTargetAtTime) p.value = cible;
  }

  private bruit(ctx: ContexteAudio): AudioBuffer {
    if (this.tamponBruit) return this.tamponBruit;
    const n = Math.floor(ctx.sampleRate * 2);
    const b = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = b.getChannelData(0);
    // Le tampon de bruit vient d'un hasard d'AFFICHAGE à part (sa graine est fixe : le même bruit à chaque visite) : il ne décale pas la suite des variations des sons.
    const h = hasardAffichage(0x7041);
    for (let i = 0; i < n; i++) d[i] = h() * 2 - 1;
    this.tamponBruit = b;
    return b;
  }

  private couche(ctx: ContexteAudio, c: Couche, k: number, t0: number): void {
    const debut = t0 + (c.retard ?? 0);
    const fin = debut + c.duree;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, debut);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, c.gain * k), debut + Math.min(0.008, c.duree / 4));
    gain.gain.exponentialRampToValueAtTime(0.0001, fin);
    gain.connect(this.maitre!);
    if (c.type === "note") {
      const osc = ctx.createOscillator();
      osc.type = c.onde ?? "sine";
      osc.frequency.setValueAtTime(c.freq, debut);
      if (c.vers) osc.frequency.exponentialRampToValueAtTime(Math.max(20, c.vers), fin);
      osc.connect(gain);
      osc.start(debut);
      osc.stop(fin + 0.02);
    } else {
      const src = ctx.createBufferSource();
      src.buffer = this.bruit(ctx);
      const filtre = ctx.createBiquadFilter();
      filtre.type = c.filtre ?? "bandpass";
      filtre.frequency.setValueAtTime(c.freq, debut);
      if (c.vers) filtre.frequency.exponentialRampToValueAtTime(Math.max(20, c.vers), fin);
      filtre.Q.value = c.q ?? 1;
      src.connect(filtre);
      filtre.connect(gain);
      src.start(debut);
      src.stop(fin + 0.02);
    }
  }

  dispose(): void {
    const cible = this.o.cible ?? (typeof window === "undefined" ? undefined : window);
    for (const g of GESTES_DEVERROUILLAGE) cible?.removeEventListener(g, this.surGeste);
    this.branche = false;
    if (this.ctx) void Promise.resolve((this.ctx as unknown as AudioContext).close?.()).catch(() => undefined);
    this.ctx = null;
    this.maitre = null;
    this.souffleur = null;
  }
}

export { SONS_DEFAUT, VOLUMES_DEFAUT };
