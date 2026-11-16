import { ouvrirContexteAudio } from "@cdj/core/audio";
import { type Evenement, niveauEffets, notesDe } from "./sonsLogique";

// Les sons de « Gravity » (lot GR4) : Web Audio **procédural, sans fichier** (oscillateurs), sur le modèle de Blocks. La décision (quelle note, quelle hauteur) est dans `sonsLogique.ts`, pure ; ici seulement la lecture.
// - **Règle S2 : le son se mêle à celui du téléphone.** Le contexte s'ouvre par `ouvrirContexteAudio` (`@cdj/core/audio` : session `ambient`), jamais par un élément `<audio>`.
// - **Aucun son avant le premier geste** (règle des navigateurs et d'iOS) : le contexte n'est créé qu'au premier geste que la scène voit (`deverrouiller`) ; un contexte endormi (onglet caché) est réveillé au geste suivant.
// - **Le niveau vient du kit** : le « Volume des effets » du joueur (`OptionsPartie.volumeEffets()`, lu à chaque son : un réglage changé en pause vaut tout de suite), séparé de la musique. À 0, rien ne se joue.
// - La musique (`@cdj/musique`) a son propre contexte : les deux se mélangent à la sortie, un effet ne coupe ni ne retient jamais la musique.

/** Ce que `Sons` demande à un contexte audio : le sous-ensemble de `AudioContext` qu'il utilise (les tests en fournissent un faux). */
export type ContexteAudio = Pick<AudioContext, "createGain" | "createOscillator" | "destination" | "currentTime" | "state" | "resume">;

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

  constructor(private readonly o: OptionsSons) {}

  /** Le joueur a fait un geste : créer le contexte audio (une fois) ou le réveiller. */
  deverrouiller(): void {
    if (!this.ctx) this.ctx = (this.o.creerContexte ?? contexteDuNavigateur)();
    if (this.ctx && this.ctx.state !== "running") void Promise.resolve(this.ctx.resume()).catch(() => undefined);
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
