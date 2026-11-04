import { type Evenement, notesDe } from "./sonsLogique";

// Les sons de « Blocks » (lot B2) : Web Audio **procédural, sans fichier** (oscillateurs), sur le modèle de Tower. La décision (quelle note, quelle hauteur) est dans `sonsLogique.ts`, pure ; ici seulement la lecture.
// - **Aucun son avant le premier geste** (règle des navigateurs et d'iOS) : le contexte audio n'est créé qu'au premier geste que la scène voit (`deverrouiller`).
// - **Le niveau vient du kit** (`niveau()` : le volume commun et son « couper ») ; à 0, rien ne se joue.
// - La musique (`@cdj/musique`) a son propre contexte : les deux se mélangent à la sortie, un effet ne coupe ni ne retient jamais la musique.

/** Ce que `Sons` demande à un contexte audio : le sous-ensemble de `AudioContext` qu'il utilise (les tests en fournissent un faux). */
export type ContexteAudio = Pick<AudioContext, "createGain" | "createOscillator" | "destination" | "currentTime" | "state" | "resume">;

export interface OptionsSons {
  /** Le niveau général, 0 à 1 (le volume du kit, 0 s'il est coupé). */
  niveau: () => number;
  /** Crée le contexte (au premier geste seulement). Défaut : le `AudioContext` du navigateur ; `null` : pas d'audio. */
  creerContexte?: () => ContexteAudio | null;
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

export interface SonJoue {
  son: Evenement["son"];
  /** La hauteur de la première note (Hz) : de quoi vérifier qu'elle monte d'un demi-ton à chaque palier du combo. */
  hz: number;
}

export class Sons {
  private ctx: ContexteAudio | null = null;
  /** Pour les tests et `?debug` : les sons demandés tant que le niveau n'était pas nul (jusqu'à 64). */
  readonly joues: SonJoue[] = [];

  constructor(private readonly o: OptionsSons) {}

  /** Le joueur a fait un geste : créer le contexte audio (une fois) ou le réveiller. */
  deverrouiller(): void {
    if (!this.ctx) this.ctx = (this.o.creerContexte ?? contexteDuNavigateur)();
    if (this.ctx && this.ctx.state !== "running") void Promise.resolve(this.ctx.resume()).catch(() => undefined);
  }

  /** Joue un son ; `retard` (secondes) le décale (la fin, après l'effacement qui la précède). */
  jouer(e: Evenement, retard = 0): void {
    const niveau = this.o.niveau();
    const notes = notesDe(e);
    if (niveau <= 0 || notes.length === 0) return;
    this.joues.push({ son: e.son, hz: notes[0]!.f });
    if (this.joues.length > 64) this.joues.shift();
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running") return;
    const maintenant = ctx.currentTime + retard;
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
