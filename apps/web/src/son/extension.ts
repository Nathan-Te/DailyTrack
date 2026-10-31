// Lot 55 (partie B) — **le nouveau son du jeu**, chargé à la demande au premier geste (jamais dans le premier chargement : `audio.ts` ne garde qu'un crochet). Il remplace, quand il est
// prêt, le moteur de dent de scie du lot 9 et ses pneus : **le moteur de la voiture qu'on voit** (huit boucles rendues hors ligne, fondues selon le régime que donne la boîte
// virtuelle), les pneus et le sol par revêtement, les bruitages (décompte calé sur les feux, points de contrôle, arrivée, médailles, turbo…), un petit compresseur doux
// et un tic d'interface. L'ambiance du thème, le volume, le muet et les trois bus restent à `audio.ts`. **Le son ne lit que l'état de la voiture** (`AudioFrame`) : il ne peut rien
// changer à une course (aucun import de la simulation, ni horloge murale, ni hasard).
// Règle d'empaquetage : ce module n'importe **aucune valeur** du premier chargement (`audioLogic`, `audio`, `i18n`…) — l'hôte lui prête ce qu'il lui faut (`HoteSon.outils`),
// sinon l'empaqueteur sort des morceaux partagés et le premier chargement grossit (mesuré au lot 55).
import type { SurfaceKind } from "@cdj/sim";
import type { AudioFrame, OneShot } from "../audio";
import type { landingSound, rollVoice, skidLevel, windGain } from "../audioLogic";
import { boiteInitiale, pasBoite, type EtatBoite } from "./boite";
import manifeste from "./boucles/manifeste.json";
import { Compteur, type Moteur } from "./moteur";
import { chargerBoucles, creerEchantillons, type Boucle, type EntreeBoucle } from "./moteurEchantillons";
import { profilDe } from "./profils";

const FICHIERS = import.meta.glob("./boucles/*.m4a", { query: "?url", import: "default", eager: true }) as Record<string, string>;

/** Ce que l'hôte (`audio.ts`) prête à l'extension. */
export interface HoteSon {
  ctx: AudioContext;
  /** Le gain général : l'extension y insère un compresseur doux avant la sortie. */
  master: GainNode;
  destination: AudioNode;
  bus: { engine: GainNode; effects: GainNode; ambience: GainNode };
  bruit: AudioBuffer;
  outils: { rollVoice: typeof rollVoice; skidLevel: typeof skidLevel; windGain: typeof windGain; landingSound: typeof landingSound; noteFreq: (n: number) => number };
  /** `true` / `false` : la version imposée (`?son=leger|complet`) ; `null` : on décide selon l'appareil. */
  leger: boolean | null;
}

export interface EtatExtension {
  voiture: string;
  /** Le moteur de la voiture est chargé et joue (sinon le moteur du lot 9 continue). */
  pret: boolean;
  leger: boolean;
  compresseur: boolean;
  rapport: number;
  rpm: number;
  /** Nœuds permanents, nœuds brefs encore vivants, boucles de moteur qui jouent. */
  noeuds: number;
  brefs: number;
  sources: number;
  chargements: number;
  /** Instants des derniers ponctuels joués (outil de test). */
  ponctuels: string[];
}

export interface ExtensionSon {
  /** La voiture qu'on voit change (hors course) : son moteur se charge, puis remplace le précédent. */
  voiture(id: string): void;
  /** À chaque image. Rend `true` quand l'extension fait le moteur et les pneus (le moteur du lot 9 se tait). */
  maj(f: AudioFrame): boolean;
  /** Un bruitage ; `true` : l'extension l'a joué. */
  ponctuel(nom: OneShot, n: number, quality: number): boolean;
  etat(): EtatExtension;
  arreter(): void;
}

/** Un appareil modeste : écran tactile et peu de cœurs ou de mémoire. Le son y est la version légère (une seule boucle à la fois, pas de compresseur, pneus simplifiés). */
export function appareilModeste(nav: { hardwareConcurrency?: number; deviceMemory?: number }, tactile: boolean): boolean {
  const coeurs = nav.hardwareConcurrency ?? 8;
  const memoire = nav.deviceMemory ?? 8;
  return tactile && (coeurs <= 4 || memoire <= 2);
}

/** Part de chaque texture de pneu selon le revêtement : roulement (souffle), crépitement (gravier), bandes rugueuses, crissement (sifflement). */
export const MIX_SOL: Record<SurfaceKind, { roule: number; crepite: number; bande: number; crisse: number }> = {
  road: { roule: 1, crepite: 0, bande: 0, crisse: 1 },
  turf: { roule: 0.8, crepite: 0.25, bande: 0, crisse: 0.5 },
  dirt: { roule: 0.7, crepite: 0.8, bande: 0, crisse: 0.4 },
  grass: { roule: 0.8, crepite: 0.3, bande: 0, crisse: 0.3 },
  gravel: { roule: 0.6, crepite: 1, bande: 0, crisse: 0.35 },
  sand: { roule: 0.9, crepite: 0.2, bande: 0, crisse: 0.25 },
  snow: { roule: 0.8, crepite: 0.15, bande: 0, crisse: 0.25 },
  ice: { roule: 0.3, crepite: 0, bande: 0, crisse: 1.4 },
  kerb: { roule: 0.5, crepite: 0, bande: 1, crisse: 0.8 },
};

/** Un tampon de crépitements : des petits claquements secs et épars (gravier, terre), lu plus vite quand on va plus vite. */
function crepitements(ctx: BaseAudioContext): AudioBuffer {
  const b = ctx.createBuffer(1, Math.round(ctx.sampleRate * 1.5), ctx.sampleRate);
  const d = b.getChannelData(0);
  let s = 90210;
  for (let i = 0; i < d.length; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    if (s / 0xffffffff < 0.0012) {
      const a = 0.4 + 0.6 * ((s >>> 8) / 0xffffff);
      for (let j = 0; j < 14 && i + j < d.length; j++) d[i + j] = (d[i + j] ?? 0) + a * (j % 2 ? -1 : 1) * Math.exp(-j / 3.5);
    }
  }
  return b;
}

/** Un tampon de bandes rugueuses : un grondement grave qui se répète (une bosse toutes les 25 ms), lu plus vite quand on va plus vite. */
function bandes(ctx: BaseAudioContext): AudioBuffer {
  const b = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.5), ctx.sampleRate);
  const d = b.getChannelData(0);
  const pas = Math.round(ctx.sampleRate * 0.025);
  for (let k = 0; k * pas < d.length; k++) for (let j = 0; j < pas && k * pas + j < d.length; j++) d[k * pas + j] = Math.sin((2 * Math.PI * 95 * j) / ctx.sampleRate) * Math.exp(-j / (ctx.sampleRate * 0.006));
  return b;
}

export async function creerExtension(h: HoteSon): Promise<ExtensionSon> {
  const { ctx, bus, bruit, outils } = h;
  const c = new Compteur();
  const tactile = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  const leger = h.leger ?? appareilModeste(navigator as { hardwareConcurrency?: number; deviceMemory?: number }, tactile);

  // --- Le compresseur doux : il serre un peu les pointes (impact, turbo, médaille) sans écraser le moteur. Pas sur l'appareil modeste. ---
  let comp: DynamicsCompressorNode | null = null;
  if (!leger) {
    comp = c.nd(ctx.createDynamicsCompressor());
    comp.threshold.value = -14;
    comp.knee.value = 18;
    comp.ratio.value = 3;
    comp.attack.value = 0.012;
    comp.release.value = 0.22;
    h.master.disconnect();
    h.master.connect(comp);
    comp.connect(h.destination);
  }

  // --- Les pneus et le sol ---
  const boucleBruit = (type: BiquadFilterType, freq: number, q: number, src: AudioBuffer = bruit) => {
    const s = c.nd(ctx.createBufferSource());
    s.buffer = src;
    s.loop = true;
    const f = c.nd(ctx.createBiquadFilter());
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.nd(ctx.createGain());
    g.gain.value = 0;
    s.connect(f).connect(g).connect(bus.effects);
    s.start();
    return { s, f, g };
  };
  const roule = boucleBruit("bandpass", 900, 0.8);
  const crisse = boucleBruit("bandpass", 1500, 4);
  const vent = boucleBruit("highpass", 700, 0.7);
  // Texture de plus (appareil costaud) : crépitements, bandes rugueuses, sifflement tonal du crissement avec son vibrato, rafales de vent.
  const crepite = leger ? null : boucleBruit("bandpass", 2200, 0.9, crepitements(ctx));
  const bande = leger ? null : boucleBruit("lowpass", 420, 0.7, bandes(ctx));
  let sifflet: { o: OscillatorNode; g: GainNode } | null = null;
  let rafale: GainNode | null = null;
  if (!leger) {
    const o = c.nd(ctx.createOscillator());
    o.type = "sine";
    o.frequency.value = 1400;
    const vib = c.nd(ctx.createOscillator());
    vib.frequency.value = 6.5;
    const prof = c.nd(ctx.createGain());
    prof.gain.value = 55;
    vib.connect(prof).connect(o.frequency);
    const g = c.nd(ctx.createGain());
    g.gain.value = 0;
    o.connect(g).connect(bus.effects);
    o.start();
    vib.start();
    sifflet = { o, g };
    // Rafales : un très lent balancement du volume du vent.
    const lent = c.nd(ctx.createOscillator());
    lent.frequency.value = 0.27;
    rafale = c.nd(ctx.createGain());
    rafale.gain.value = 0.25;
    lent.connect(rafale).connect(vent.g.gain);
    lent.start();
  }

  // --- Le moteur de la voiture qu'on voit ---
  const entrees = (id: string): EntreeBoucle[] =>
    ((manifeste.profils as Record<string, { fichier: string; rpm: number; debut: number; fin: number }[]>)[id] ?? []).map((b) => {
      const url = FICHIERS[`./boucles/${b.fichier}`];
      if (!url) throw new Error(`boucle absente : ${b.fichier}`);
      return { url, rpm: b.rpm, debut: b.debut, fin: b.fin };
    });
  const cache = new Map<string, Promise<{ boucles: Boucle[] }>>();
  let courant = "civile";
  let moteurId = "";
  let moteur: Moteur | null = null;
  let boite: EtatBoite = boiteInitiale(profilDe(courant));
  let chargements = 0;
  let dernier = performance.now();

  const demarrer = (id: string) => {
    let p = cache.get(id);
    if (!p) {
      chargements++;
      p = chargerBoucles(ctx, entrees(id));
      cache.set(id, p);
      // Un échec (hors ligne, fichier absent) n'est pas gardé : on réessaiera à la prochaine voiture ou au prochain geste.
      p.catch(() => cache.delete(id));
    }
    p.then(({ boucles }) => {
      if (id !== courant || moteurId === id || !ctx) return;
      const profil = profilDe(id);
      moteur?.arreter();
      moteur = creerEchantillons(ctx, bus.engine, profil, boucles, `Échantillons · ${id}`, profil.etalon.echantillons, { leger });
      moteurId = id;
      boite = boiteInitiale(profil);
    }).catch(() => undefined);
  };

  // --- Les bruitages ---
  const bref = <T extends AudioScheduledSourceNode>(src: T, ...liés: AudioNode[]): T => c.bref(src, ...liés);
  const ton = (freq: number, duree: number, type: OscillatorType, gain: number, delai = 0, vers?: number) => {
    const t0 = ctx.currentTime + delai;
    const g = ctx.createGain();
    const o = bref(ctx.createOscillator(), g);
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (vers) o.frequency.exponentialRampToValueAtTime(vers, t0 + duree);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duree);
    o.connect(g).connect(bus.effects);
    o.start(t0);
    o.stop(t0 + duree + 0.05);
  };
  /** Une cloche : trois partiels qui s'éteignent plus ou moins vite (un tintement net plutôt qu'un bip). */
  const cloche = (freq: number, duree: number, gain: number, delai = 0) => {
    ton(freq, duree, "sine", gain, delai);
    ton(freq * 2.76, duree * 0.55, "sine", gain * 0.35, delai);
    ton(freq * 5.4, duree * 0.3, "sine", gain * 0.14, delai);
  };
  const souffle = (duree: number, freq: number, gain: number, delai = 0, vers?: number) => {
    const t0 = ctx.currentTime + delai;
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    const s = bref(ctx.createBufferSource(), f, g);
    s.buffer = bruit;
    f.type = "bandpass";
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(freq, t0);
    if (vers) f.frequency.exponentialRampToValueAtTime(vers, t0 + duree);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duree);
    s.connect(f).connect(g).connect(bus.effects);
    s.start(t0, (t0 % 1) * 0.9); // un départ qui varie sans hasard
    s.stop(t0 + duree + 0.05);
  };
  const journal: string[] = [];
  const noter = (nom: string) => {
    journal.push(nom);
    if (journal.length > 24) journal.shift();
  };
  const note = outils.noteFreq;
  const ponctuel = (nom: OneShot, n: number, q: number): boolean => {
    if (ctx.state !== "running") return false;
    noter(nom);
    switch (nom) {
      case "countdown":
        // Trois bips égaux, un par feu allumé (lot 43) : un souffle bref d'attaque et une note nette.
        ton(660, 0.14, "sine", 0.22);
        ton(1320, 0.08, "sine", 0.05);
        souffle(0.025, 3200, 0.09);
        return true;
      case "go":
        ton(1320, 0.55, "triangle", 0.2);
        ton(1980, 0.5, "sine", 0.08);
        ton(660, 0.4, "sine", 0.1);
        souffle(0.04, 3600, 0.12);
        return true;
      case "checkpoint":
        cloche(988, 0.45, 0.17);
        cloche(1318, 0.7, 0.17, 0.1);
        return true;
      case "finish":
        [0, 4, 7, 12].forEach((s, i) => cloche(note(s - 9), 0.6, 0.15, i * 0.11));
        ton(note(3), 1, "triangle", 0.07, 0.44);
        return true;
      case "medal": {
        // Bronze, argent, or, diamant : de plus en plus de notes, de plus en plus haut ; le diamant scintille.
        const notes = Math.max(1, n) + 2;
        for (let i = 0; i < notes; i++) cloche(note(5 + i * 3 + n * 2), 0.5, 0.14, 0.6 + i * 0.09);
        if (n >= 3) for (let i = 0; i < 7; i++) cloche(note(24 + ((i * 5) % 9)), 0.35, 0.05, 1 + i * 0.07);
        return true;
      }
      case "impact": {
        const k = Math.min(1, 0.4 + n);
        souffle(0.2, 900, 0.5 * k, 0, 200);
        ton(90, 0.22, "sine", 0.35 * k, 0, 40);
        if (n > 0.6) souffle(0.07, 3000, 0.25 * k);
        return true;
      }
      case "land": {
        const l = outils.landingSound(n, q);
        souffle(l.noiseDur, l.noiseFreq, l.noiseGain, 0, 120);
        ton(l.thumpFreq, l.thumpDur, "sine", l.thumpGain, 0, 35);
        return true;
      }
      case "turbo":
        souffle(0.9, 400, 0.34, 0, 3500);
        ton(500, 0.9, "sawtooth", 0.07, 0, 2200);
        ton(1800, 0.8, "sine", 0.05, 0.05, 2600);
        return true;
      case "cut":
        ton(300, 0.5, "sawtooth", 0.14, 0, 60);
        souffle(0.3, 600, 0.1, 0, 150);
        return true;
      case "fall":
        ton(880, 0.55, "sine", 0.16, 0, 70);
        souffle(0.6, 1400, 0.22, 0, 220);
        return true;
      case "respawn":
        ton(note(-2), 0.1, "triangle", 0.12);
        ton(note(5), 0.16, "triangle", 0.12, 0.08);
        return true;
    }
    return false;
  };

  // --- Un tic d'interface (hors appareil modeste) : un petit « clic » sur un bouton, jamais sur les commandes tactiles de la course. ---
  let dernierTic = 0;
  const clic = (e: MouseEvent) => {
    const cible = e.target instanceof Element ? e.target.closest("button, [role='button'], a[href]") : null;
    if (!cible || cible.closest("#touch") || ctx.state !== "running") return;
    const t = performance.now();
    if (t - dernierTic < 70) return;
    dernierTic = t;
    ton(1900, 0.03, "sine", 0.05);
  };
  if (!leger) document.addEventListener("click", clic, true);

  // --- À chaque image ---
  const maj = (f: AudioFrame): boolean => {
    if (ctx.state !== "running") return false;
    const maintenant = performance.now();
    const dt = Math.min(0.05, Math.max(0, (maintenant - dernier) / 1000));
    dernier = maintenant;
    const t = ctx.currentTime;
    const k = 0.05;
    const profil = profilDe(courant);
    const gaz = f.cut ? 0 : f.throttle;
    boite = pasBoite(boite, profil, f.speed, gaz, dt, !f.grounded);
    // Les pneus, le sol et le vent (le silence du jeu : pause, arrivée, fenêtre ouverte).
    const on = f.active;
    const voix = outils.rollVoice(f.surface, f.kerb ?? 0);
    const mix = MIX_SOL[f.surface];
    const derape = on ? outils.skidLevel(f.slide, f.speed, f.brake, f.grounded) : 0;
    const r = Math.min(1.5, f.speed / 30);
    roule.f.frequency.setTargetAtTime(voix.rollFreq * (0.6 + 0.6 * r), t, k);
    roule.g.gain.setTargetAtTime(on && f.grounded ? voix.rollGain * r * mix.roule : 0, t, k);
    crisse.f.frequency.setTargetAtTime(voix.skidFreq, t, k);
    crisse.g.gain.setTargetAtTime(derape * 0.18 * mix.crisse, t, k);
    vent.g.gain.setTargetAtTime(on ? outils.windGain(f.speed) : 0, t, k);
    if (crepite) {
      crepite.s.playbackRate.setTargetAtTime(0.5 + r, t, k);
      crepite.g.gain.setTargetAtTime(on && f.grounded ? 0.55 * r * mix.crepite : 0, t, k);
    }
    if (bande) {
      bande.s.playbackRate.setTargetAtTime(0.4 + 1.3 * r, t, k);
      bande.g.gain.setTargetAtTime(on && f.grounded ? 0.9 * r * mix.bande * Math.min(1, (f.kerb ?? 0) / 2 + 0.3) : 0, t, k);
    }
    if (sifflet) {
      sifflet.o.frequency.setTargetAtTime(voix.skidFreq * 0.9, t, k);
      sifflet.g.gain.setTargetAtTime(derape * 0.035 * mix.crisse, t, k);
    }
    if (rafale) rafale.gain.setTargetAtTime(0.25, t, 0.5);
    if (moteur) {
      moteur.maj({ rpm: boite.rpm, charge: boite.charge, passage: boite.passage, sens: boite.sens, rapport: boite.rapport, vitesse: f.speed, gaz, enAir: !f.grounded, silence: !on });
      return true;
    }
    return false;
  };

  demarrer(courant);
  return {
    voiture(id) {
      if (id === courant) return;
      courant = id;
      demarrer(id);
    },
    maj,
    ponctuel,
    etat: () => ({
      voiture: moteurId || courant,
      pret: moteur !== null,
      leger,
      compresseur: comp !== null,
      rapport: boite.rapport,
      rpm: boite.rpm,
      noeuds: c.n + (moteur?.noeuds ?? 0),
      brefs: c.brefsVivants,
      sources: moteur?.sources ?? 0,
      chargements,
      ponctuels: [...journal],
    }),
    arreter() {
      document.removeEventListener("click", clic, true);
      moteur?.arreter();
      moteur = null;
      moteurId = "";
      c.tout();
      if (comp) {
        h.master.disconnect();
        h.master.connect(h.destination);
        comp = null;
      }
    },
  };
}
