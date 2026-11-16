import { ouvrirContexteAudio } from "@cdj/core/audio";
import { type Couche, type Evenement, type NomSon, Melange, coupureRoulement, hauteurRessort, niveauEffets, niveauRessort, niveauRoulement, niveauTrouNoir, recetteDe } from "./sonsLogique";

// Les sons de « Pinball » (lot PBS1) : Web Audio **procédural, sans fichier** (oscillateurs et bruit filtré), sur le modèle de Gravity et de Tower. La décision (quel son, quelle recette, qui joue quand le mélange est plein) est
// dans `sonsLogique.ts`, pure et testée ; ici seulement la lecture.
// - **Règle S2 : le son se mêle à celui du téléphone.** Le contexte s'ouvre par `ouvrirContexteAudio` (`@cdj/core/audio` : session `ambient`), jamais par un élément `<audio>`.
// - **Aucun son avant le premier geste** (règle des navigateurs et d'iOS) : le contexte n'est créé qu'au premier geste que la scène voit (`deverrouiller`) ; un contexte endormi est réveillé au geste suivant ; un son demandé avant est perdu, jamais mis en file.
// - **Le niveau vient du kit** : le « Volume des effets » du joueur (`OptionsPartie.volumeEffets()`, lu à chaque son : un réglage changé en pause vaut tout de suite), séparé de la musique. À 0, rien ne se joue et aucun nœud audio n'est créé.
// - La musique (`@cdj/musique`) a son propre contexte : les deux se mêlent à la sortie du téléphone, un effet ne coupe ni ne retient jamais la musique.
// - **Pas de clic** : chaque couche monte de zéro (attaque d'au moins 3 ms), redescend à zéro avant d'être arrêtée ; une voix qui cède la place est coupée en fondu (jamais d'un coup) ; les sons continus ont un « homme mort » (sans mise à jour pendant 0,3 s, ils s'éteignent seuls : la pause, un onglet caché).
// - **Le coût** se compte (`stats` : appels, temps passé sur le fil principal, le pire appel) et se lit dans `?debug` (`__pinball.sons().stats`).

/** Ce que `Sons` demande à un contexte audio : le sous-ensemble de `AudioContext` qu'il utilise (les tests en fournissent un faux). */
export type ContexteAudio = Pick<AudioContext, "createGain" | "createOscillator" | "createBufferSource" | "createBiquadFilter" | "createDynamicsCompressor" | "createBuffer" | "destination" | "currentTime" | "state" | "sampleRate" | "resume" | "close">;

export interface OptionsSons {
  /** Le volume des effets, 0 à 1 (`OptionsPartie.volumeEffets`). */
  niveau: () => number;
  /** Le hasard d'AFFICHAGE (jamais celui de la simulation) : la petite variation de hauteur d'un son. Défaut : une suite fixe. */
  hasard?: () => number;
  /** Crée le contexte (au premier geste seulement). Défaut : `ouvrirContexteAudio` ; `null` : pas d'audio. */
  creerContexte?: () => ContexteAudio | null;
  /** L'horloge du coût (ms). Défaut : `performance.now`. */
  horloge?: () => number;
}

const contexteDuNavigateur = (): ContexteAudio | null => ouvrirContexteAudio<ContexteAudio>();

/** Un son demandé : de quoi vérifier, sans entendre, ce que la scène a décidé (`?debug`, tests). */
export interface SonJoue {
  son: NomSon;
  /** Joué, ou refusé par le mélange (délai, plafond de voix). */
  joue: boolean;
}

/** Les sons continus : leur niveau et leur hauteur sont remis à jour à chaque image. */
export type NomNappe = "roulement" | "ressort" | "trouNoir";
interface Nappe {
  gain: GainNode;
  /** Le réglage qui la suit (le filtre du roulement, la fréquence du ressort). */
  parametre: AudioParam | null;
}

export class Sons {
  private ctx: ContexteAudio | null = null;
  private maitre: GainNode | null = null;
  private bruitTampon: AudioBuffer | null = null;
  private readonly melange = new Melange();
  private readonly bus = new Map<number, GainNode>();
  private readonly nappes = new Map<NomNappe, Nappe>();
  private derniereMajNappes = -1;
  private graine = 0x2f6e2b1d;
  /** Les sons demandés tant que le niveau n'était pas nul (les 64 derniers) : ce que la scène a décidé et ce que le mélange en a fait. */
  readonly joues: SonJoue[] = [];
  /** Le coût sur le fil principal : appels de `jouer` et de `continu`, millisecondes passées, le pire appel. */
  readonly stats = { appels: 0, ms: 0, pire: 0, refuses: 0 };

  constructor(private readonly o: OptionsSons) {}

  /** Le joueur a fait un geste : créer le contexte audio (une fois) ou le réveiller. */
  deverrouiller(): void {
    if (!this.ctx) {
      const ctx = (this.o.creerContexte ?? contexteDuNavigateur)();
      if (!ctx) return;
      this.ctx = ctx;
      // la sortie : un niveau général, puis un compresseur doux qui borne les crêtes quand plusieurs sons se superposent
      const maitre = ctx.createGain();
      maitre.gain.value = 1;
      const compresseur = ctx.createDynamicsCompressor();
      compresseur.threshold.value = -14;
      compresseur.knee.value = 12;
      compresseur.ratio.value = 5;
      compresseur.attack.value = 0.004;
      compresseur.release.value = 0.12;
      maitre.connect(compresseur);
      compresseur.connect(ctx.destination);
      this.maitre = maitre;
    }
    if (this.ctx.state !== "running") void Promise.resolve(this.ctx.resume()).catch(() => undefined);
  }

  /** Vrai une fois le premier geste passé (le contexte existe). */
  get pret(): boolean {
    return this.ctx !== null;
  }

  private hasard(): number {
    if (this.o.hasard) return this.o.hasard();
    this.graine = (Math.imul(this.graine, 1664525) + 1013904223) >>> 0;
    return this.graine / 4294967296;
  }

  private maintenant(): number {
    return (this.o.horloge ?? (() => performance.now()))();
  }

  /** Joue le son d'un événement. Rend vrai s'il a été joué (faux : avant le premier geste, volume à 0, mélange qui le refuse). */
  jouer(e: Evenement): boolean {
    const niveau = niveauEffets(this.o.niveau());
    if (niveau <= 0) return false;
    const debut = this.maintenant();
    const r = recetteDe(e, this.hasard());
    const ctx = this.ctx;
    const maitre = this.maitre;
    if (!ctx || !maitre || ctx.state !== "running") {
      this.noter(e.son, false);
      return false;
    }
    const t0 = ctx.currentTime;
    const d = this.melange.demander(r.nom, r.priorite, r.duree, t0);
    if (!d.jouer) {
      this.noter(e.son, false);
      this.stats.refuses++;
      this.cout(debut);
      return false;
    }
    if (d.couper !== null) this.couper(d.couper, t0);
    try {
      // une voix : un bus à elle, qu'on peut éteindre en fondu si un son plus fort a besoin de sa place
      const bus = ctx.createGain();
      bus.connect(maitre);
      this.bus.set(d.id, bus);
      for (const c of r.couches) this.couche(ctx, bus, c, niveau, t0);
    } catch {
      /* un contexte fermé ou refusé : pas de son, jamais d'erreur */
    }
    if (this.bus.size > 32) for (const id of [...this.bus.keys()].slice(0, this.bus.size - 32)) this.bus.delete(id);
    this.noter(e.son, true);
    this.cout(debut);
    return true;
  }

  private noter(son: NomSon, joue: boolean): void {
    this.joues.push({ son, joue });
    if (this.joues.length > 64) this.joues.shift();
  }

  private cout(debut: number): void {
    const ms = this.maintenant() - debut;
    this.stats.appels++;
    this.stats.ms += ms;
    if (ms > this.stats.pire) this.stats.pire = ms;
  }

  /** Éteint une voix en fondu (jamais d'un coup : pas de clic). */
  private couper(id: number, t: number): void {
    const bus = this.bus.get(id);
    if (!bus) return;
    try {
      bus.gain.cancelScheduledValues(t);
      bus.gain.setTargetAtTime(0, t, 0.012);
    } catch {
      /* rien à couper */
    }
    this.bus.delete(id);
  }

  private tampon(ctx: ContexteAudio): AudioBuffer {
    if (this.bruitTampon) return this.bruitTampon;
    const n = Math.floor(ctx.sampleRate * 1.5);
    const b = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = b.getChannelData(0);
    // un bruit blanc à graine fixe : le même à chaque visite, et il ne décale pas la suite des variations des sons
    let g = 0x7041a3;
    for (let i = 0; i < n; i++) {
      g = (Math.imul(g, 1664525) + 1013904223) >>> 0;
      d[i] = g / 2147483648 - 1;
    }
    this.bruitTampon = b;
    return b;
  }

  private couche(ctx: ContexteAudio, sortie: GainNode, c: Couche, k: number, t0: number): void {
    const debut = t0 + (c.retard ?? 0);
    const fin = debut + c.duree;
    const gain = ctx.createGain();
    // de zéro à la crête (au moins 3 ms), décroissance exponentielle, puis zéro avant l'arrêt de la source : aucun clic au début ni à la fin
    const attaque = Math.max(0.003, Math.min(0.008, c.duree / 4));
    gain.gain.setValueAtTime(0.0001, debut);
    gain.gain.linearRampToValueAtTime(Math.max(0.0002, c.gain * k), debut + attaque);
    gain.gain.exponentialRampToValueAtTime(0.0001, fin);
    gain.gain.linearRampToValueAtTime(0, fin + 0.01);
    gain.connect(sortie);
    // le filtre d'un bruit (centre `freq`, qui peut balayer vers `vers`) ou d'une note (qui adoucit l'onde, centre `coupure`)
    let entree: AudioNode = gain;
    if (c.filtre) {
      const filtre = ctx.createBiquadFilter();
      filtre.type = c.filtre;
      filtre.Q.value = c.q ?? 1;
      if (c.type === "bruit") {
        filtre.frequency.setValueAtTime(c.freq, debut);
        if (c.vers) filtre.frequency.exponentialRampToValueAtTime(Math.max(20, c.vers), fin);
      } else filtre.frequency.setValueAtTime(c.coupure ?? c.freq * 4, debut);
      filtre.connect(gain);
      entree = filtre;
    }
    if (c.type === "note") {
      const osc = ctx.createOscillator();
      osc.type = c.onde ?? "sine";
      osc.frequency.setValueAtTime(c.freq, debut);
      if (c.vers) osc.frequency.exponentialRampToValueAtTime(Math.max(20, c.vers), fin);
      osc.connect(entree);
      osc.start(debut);
      osc.stop(fin + 0.02);
    } else {
      const src = ctx.createBufferSource();
      const b = this.tampon(ctx);
      src.buffer = b;
      src.connect(entree);
      // chaque bruit commence ailleurs dans le tampon : deux « crépitements » ne sont jamais identiques
      src.start(debut, this.hasard() * Math.max(0, b.duration - c.duree - 0.05));
      src.stop(fin + 0.02);
    }
  }

  // ---- les sons continus ----

  /**
   * Remet à jour les sons continus (à chaque image, la scène donne ce que la partie dit) : le roulement de la bille (sa vitesse en px/s), le ressort du lanceur (la charge, 0 à 1 000) et le grondement du trou noir (la distance
   * de la bille à son centre et son rayon). Chacun suit son niveau ; **sans mise à jour pendant 0,3 s, il s'éteint seul** (la pause, un onglet caché). Au plus une mise à jour toutes les 50 ms.
   */
  continu(vitesse: number, charge: number, trouNoir: { distance: number; rayon: number } | null): void {
    const volume = niveauEffets(this.o.niveau());
    const ctx = this.ctx;
    const maitre = this.maitre;
    if (!ctx || !maitre || ctx.state !== "running" || volume <= 0) return;
    const t = ctx.currentTime;
    if (t - this.derniereMajNappes < 0.05) return;
    const debut = this.maintenant();
    this.derniereMajNappes = t;
    try {
      this.regler("roulement", niveauRoulement(vitesse) * volume, coupureRoulement(vitesse), t);
      this.regler("ressort", niveauRessort(charge) * volume, hauteurRessort(charge), t);
      this.regler("trouNoir", trouNoir ? niveauTrouNoir(trouNoir.distance, trouNoir.rayon) * volume : 0, 0, t);
    } catch {
      /* un contexte fermé : rien à régler */
    }
    this.cout(debut);
  }

  private regler(nom: NomNappe, niveau: number, hz: number, t: number): void {
    let n = this.nappes.get(nom);
    if (!n) {
      if (niveau <= 0.0005) return; // rien à faire entendre : la nappe n'est même pas créée
      n = this.creerNappe(nom);
      this.nappes.set(nom, n);
    }
    const g = n.gain.gain;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(niveau, t, 0.05);
    g.setTargetAtTime(0, t + 0.3, 0.08); // l'homme mort : sans mise à jour, elle s'éteint
    if (n.parametre && hz > 0) {
      n.parametre.cancelScheduledValues(t);
      n.parametre.setTargetAtTime(hz, t, 0.05);
    }
  }

  private creerNappe(nom: NomNappe): Nappe {
    const ctx = this.ctx!;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.maitre!);
    if (nom === "roulement") {
      // un souffle très bas : du bruit en boucle, filtré (le filtre s'ouvre avec la vitesse)
      const src = ctx.createBufferSource();
      src.buffer = this.tampon(ctx);
      src.loop = true;
      const filtre = ctx.createBiquadFilter();
      filtre.type = "lowpass";
      filtre.Q.value = 0.6;
      filtre.frequency.value = 200;
      src.connect(filtre);
      filtre.connect(gain);
      src.start();
      return { gain, parametre: filtre.frequency };
    }
    const osc = ctx.createOscillator();
    if (nom === "ressort") {
      // un ressort qui se tend : une note qui monte avec la charge
      osc.type = "triangle";
      osc.frequency.value = 85;
      osc.connect(gain);
      osc.start();
      return { gain, parametre: osc.frequency };
    }
    // le trou noir : un grondement grave (une dent de scie lente, filtrée très bas)
    osc.type = "sawtooth";
    osc.frequency.value = 46;
    const filtre = ctx.createBiquadFilter();
    filtre.type = "lowpass";
    filtre.frequency.value = 150;
    filtre.Q.value = 1.4;
    osc.connect(filtre);
    filtre.connect(gain);
    osc.start();
    return { gain, parametre: null };
  }

  /** Coupe tous les sons continus d'un coup d'oreille (la partie s'arrête). */
  silence(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    try {
      for (const n of this.nappes.values()) {
        n.gain.gain.cancelScheduledValues(ctx.currentTime);
        n.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
      }
    } catch {
      /* rien à couper */
    }
  }

  dispose(): void {
    if (this.ctx) void Promise.resolve(this.ctx.close?.()).catch(() => undefined);
    this.ctx = null;
    this.maitre = null;
    this.nappes.clear();
    this.bus.clear();
  }
}
