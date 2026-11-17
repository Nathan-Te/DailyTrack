import { ouvrirContexteAudio } from "@cdj/core/audio";
import { type Evenement, SOUFFLE, echantillonsDeBruit, niveauDuSouffle, niveauEffets, notesDe } from "./sonsLogique";

// Les sons de « Gravity » (lot GR4) : Web Audio **procédural, sans fichier** (oscillateurs), sur le modèle de Blocks. La décision (quelle note, quelle hauteur) est dans `sonsLogique.ts`, pure ; ici seulement la lecture.
// - **Règle S2 : le son se mêle à celui du téléphone.** Le contexte s'ouvre par `ouvrirContexteAudio` (`@cdj/core/audio` : session `ambient`), jamais par un élément `<audio>`.
// - **Aucun son avant le premier geste** (règle des navigateurs et d'iOS) : le contexte n'est créé qu'au premier geste que la scène voit (`deverrouiller`) ; un contexte endormi (onglet caché) est réveillé au geste suivant.
// - **Le niveau vient du kit** : le « Volume des effets » du joueur (`OptionsPartie.volumeEffets()`, lu à chaque son : un réglage changé en pause vaut tout de suite), séparé de la musique. À 0, rien ne se joue.
// - La musique (`@cdj/musique`) a son propre contexte : les deux se mélangent à la sortie, un effet ne coupe ni ne retient jamais la musique.

/** Ce que `Sons` demande à un contexte audio : le sous-ensemble de `AudioContext` qu'il utilise (les tests en fournissent un faux). */
export type ContexteAudio = Pick<AudioContext, "createGain" | "createOscillator" | "createBuffer" | "createBufferSource" | "createBiquadFilter" | "destination" | "currentTime" | "sampleRate" | "state" | "resume">;

export interface OptionsSons {
  /** Le volume des effets, 0 à 1 (`OptionsPartie.volumeEffets`). */
  niveau: () => number;
  /** Crée le contexte (au premier geste seulement). Défaut : `ouvrirContexteAudio` ; `null` : pas d'audio. */
  creerContexte?: () => ContexteAudio | null;
}

const contexteDuNavigateur = (): ContexteAudio | null => ouvrirContexteAudio<ContexteAudio>();

/** Un son demandé : de quoi vérifier, sans entendre, ce que la scène a décidé (`?debug`, tests). */
export interface SonJoue {
  son: Evenement["son"];
  /** La hauteur de la première note (Hz). */
  hz: number;
}

export class Sons {
  private ctx: ContexteAudio | null = null;
  /** Les sons demandés tant que le niveau n'était pas nul (les 64 derniers). */
  readonly joues: SonJoue[] = [];
  /** Lot GR6 — le souffle de l'avion : un bruit en boucle, filtré, dont le volume suit le doigt ; créé au premier besoin, jamais avant un geste. */
  private souffleSource: { arret(): void; gain: GainNode } | null = null;
  private souffleCible = 0;

  constructor(private readonly o: OptionsSons) {}

  /** Le joueur a fait un geste : créer le contexte audio (une fois) ou le réveiller. */
  deverrouiller(): void {
    if (!this.ctx) this.ctx = (this.o.creerContexte ?? contexteDuNavigateur)();
    if (this.ctx && this.ctx.state !== "running") void Promise.resolve(this.ctx.resume()).catch(() => undefined);
  }

  /**
   * Lot GR6 — le souffle de l'avion : `actif` quand on maintient en mode avion et que la partie tourne ; coupé en pause (la scène l'éteint dès qu'elle ne voit plus de pas) et à la sortie du mode. Le niveau est celui du « Volume des
   * effets » (relu à chaque appel), jamais au-dessus de 0,3 ; les fondus sont doux (jamais de clic). Sans contexte réveillé, rien.
   */
  souffle(actif: boolean): void {
    const ctx = this.ctx;
    const cible = niveauDuSouffle(actif, this.o.niveau());
    if (!ctx || ctx.state !== "running") return;
    if (!this.souffleSource) {
      if (cible <= 0) return;
      try {
        const n = Math.max(1, Math.trunc(ctx.sampleRate));
        const tampon = ctx.createBuffer(1, n, ctx.sampleRate);
        tampon.getChannelData(0).set(echantillonsDeBruit(n));
        const source = ctx.createBufferSource();
        source.buffer = tampon;
        source.loop = true;
        const filtre = ctx.createBiquadFilter();
        filtre.type = "bandpass";
        filtre.frequency.value = SOUFFLE.filtre;
        filtre.Q.value = 0.7;
        const gain = ctx.createGain();
        gain.gain.value = 0;
        source.connect(filtre);
        filtre.connect(gain);
        gain.connect(ctx.destination);
        source.start();
        this.souffleSource = { arret: () => source.stop(), gain };
        this.souffleCible = 0;
      } catch {
        return; // pas de bruit possible : pas de souffle, jamais d'erreur
      }
    }
    if (cible === this.souffleCible) return;
    this.souffleCible = cible;
    try {
      this.souffleSource!.gain.gain.setTargetAtTime(cible, ctx.currentTime, SOUFFLE.fondu);
    } catch {
      /* un contexte fermé : rien */
    }
  }

  /** La partie est détruite : le souffle s'arrête pour de bon. */
  arreter(): void {
    try {
      this.souffleSource?.arret();
    } catch {
      /* déjà arrêté */
    }
    this.souffleSource = null;
    this.souffleCible = 0;
  }

  jouer(e: Evenement): void {
    const niveau = niveauEffets(this.o.niveau());
    const notes = notesDe(e);
    if (niveau <= 0 || notes.length === 0) return;
    this.joues.push({ son: e.son, hz: notes[0]!.f });
    if (this.joues.length > 64) this.joues.shift();
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running") return;
    const maintenant = ctx.currentTime;
    for (const n of notes) {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = n.onde;
        const debut = maintenant + n.t;
        osc.frequency.setValueAtTime(n.f, debut);
        if (n.f2 !== n.f) osc.frequency.exponentialRampToValueAtTime(n.f2, debut + n.d);
        gain.gain.setValueAtTime(0.0001, debut);
        gain.gain.linearRampToValueAtTime(Math.max(0.0001, n.g * niveau), debut + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, debut + n.d);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(debut);
        osc.stop(debut + n.d + 0.02);
      } catch {
        /* un contexte fermé ou refusé : pas de son, jamais d'erreur */
      }
    }
  }
}
