// Les sons de Rush : Web Audio **procédural, sans fichier** (oscillateurs et bruit filtré). Aucun son avant le premier geste du joueur (règle des navigateurs et d'iOS). Le niveau est le volume du kit
// (la musique commune en tient le réglage) ; à 0, rien ne se joue. La musique a son propre contexte : un effet ne la coupe jamais.

export type SonNom = "coup1" | "coup2" | "coup3" | "touche" | "toucheFort" | "toucheGolem" | "mort" | "esquive" | "frole" | "degats" | "annonce" | "impact" | "onde" | "phase2" | "victoire" | "defaite" | "apparition" | "pierre" | "bloque" | "ramasse" | "niveau" | "carte" | "soin" | "ondeEpee";

import { ouvrirContexteAudio } from "@cdj/core/audio";

type Ctx = AudioContext;
interface Ton {
  de: number;
  vers?: number;
  duree: number;
  type?: OscillatorType;
  vol?: number;
  retard?: number;
  attaque?: number;
}
interface Souffle {
  duree: number;
  vol?: number;
  filtre: number;
  filtreVers?: number;
  q?: number;
  retard?: number;
  type?: BiquadFilterType;
}

function nouveauContexte(): Ctx | null {
  return ouvrirContexteAudio<Ctx>(); // lot S2 : session `ambient`, le son se mêle à celui du téléphone
}

export class Sons {
  private ctx: Ctx | null = null;
  private bruit: AudioBuffer | null = null;
  private niveau = 1;
  /** Les sons demandés (jusqu'à 64) : de quoi vérifier, hors de l'oreille, que les événements du jeu en font. */
  readonly joues: SonNom[] = [];

  constructor(niveau: () => number = () => 1) {
    this.lireNiveau = niveau;
  }
  private readonly lireNiveau: () => number;

  /** Le joueur a fait un geste : créer le contexte audio (une fois) ou le réveiller. */
  deverrouiller(): void {
    if (!this.ctx) this.ctx = nouveauContexte();
    if (this.ctx && this.ctx.state !== "running") void Promise.resolve(this.ctx.resume()).catch(() => undefined);
  }

  private ton(c: Ctx, base: number, t: Ton): void {
    const o = c.createOscillator();
    const g = c.createGain();
    const debut = base + (t.retard ?? 0);
    o.type = t.type ?? "square";
    o.frequency.setValueAtTime(t.de, debut);
    if (t.vers !== undefined) o.frequency.exponentialRampToValueAtTime(Math.max(20, t.vers), debut + t.duree);
    const vol = (t.vol ?? 0.2) * this.niveau;
    g.gain.setValueAtTime(0.0001, debut);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), debut + (t.attaque ?? 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, debut + t.duree);
    o.connect(g).connect(c.destination);
    o.start(debut);
    o.stop(debut + t.duree + 0.03);
  }

  private souffle(c: Ctx, base: number, s: Souffle): void {
    this.bruit ??= (() => {
      const b = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = b.getChannelData(0);
      let x = 12345;
      for (let i = 0; i < d.length; i++) {
        x = (x * 1664525 + 1013904223) >>> 0;
        d[i] = (x / 0xffffffff) * 2 - 1;
      }
      return b;
    })();
    const src = c.createBufferSource();
    src.buffer = this.bruit;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = s.type ?? "bandpass";
    const debut = base + (s.retard ?? 0);
    f.frequency.setValueAtTime(s.filtre, debut);
    if (s.filtreVers !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(40, s.filtreVers), debut + s.duree);
    f.Q.value = s.q ?? 1;
    const g = c.createGain();
    g.gain.setValueAtTime(Math.max(0.0002, (s.vol ?? 0.3) * this.niveau), debut);
    g.gain.exponentialRampToValueAtTime(0.0001, debut + s.duree);
    src.connect(f).connect(g).connect(c.destination);
    src.start(debut);
    src.stop(debut + s.duree + 0.03);
  }

  jouer(son: SonNom, hauteur = 1): void {
    this.niveau = Math.max(0, Math.min(1, this.lireNiveau()));
    if (this.niveau <= 0) return;
    this.joues.push(son);
    if (this.joues.length > 64) this.joues.shift();
    const c = this.ctx;
    if (!c || c.state !== "running") return;
    const t = c.currentTime;
    const h = hauteur;
    switch (son) {
      case "coup1":
      case "coup2":
        // Le souffle de l'épée SUIT l'anticipation (le geste part ~0,08 s plus tard) : il monte, puis retombe, plus long qu'au BR0b.
        this.souffle(c, t, { duree: 0.3, vol: 0.3, filtre: son === "coup1" ? 500 : 650, filtreVers: son === "coup1" ? 2600 : 3200, q: 0.9, retard: 0.07 });
        this.souffle(c, t, { duree: 0.2, vol: 0.18, filtre: 2800, filtreVers: 600, q: 0.8, retard: 0.17 });
        this.ton(c, t, { de: son === "coup1" ? 300 : 360, vers: 150, duree: 0.16, type: "triangle", vol: 0.09, retard: 0.09 });
        break;
      case "coup3":
        this.souffle(c, t, { duree: 0.38, vol: 0.4, filtre: 320, filtreVers: 2200, q: 0.8, retard: 0.1 });
        this.souffle(c, t, { duree: 0.3, vol: 0.22, filtre: 2000, filtreVers: 260, q: 0.7, retard: 0.3 });
        this.ton(c, t, { de: 240, vers: 70, duree: 0.34, type: "sawtooth", vol: 0.13, retard: 0.14 });
        break;
      case "touche":
        // Un impact a une COUCHE GRAVE (le « poids ») sous le claquement.
        this.ton(c, t, { de: 520 * h, vers: 180, duree: 0.09, type: "square", vol: 0.2 });
        this.ton(c, t, { de: 120 * h, vers: 52, duree: 0.2, type: "sine", vol: 0.5 });
        this.souffle(c, t, { duree: 0.1, vol: 0.25, filtre: 2600, q: 0.6 });
        break;
      case "toucheFort":
        this.ton(c, t, { de: 320 * h, vers: 90, duree: 0.2, type: "sawtooth", vol: 0.28 });
        this.ton(c, t, { de: 95, vers: 34, duree: 0.42, type: "sine", vol: 0.75 });
        this.souffle(c, t, { duree: 0.24, vol: 0.45, filtre: 1800, filtreVers: 240, q: 0.6 });
        break;
      case "toucheGolem":
        this.ton(c, t, { de: 140 * h, vers: 55, duree: 0.3, type: "sawtooth", vol: 0.32 });
        this.ton(c, t, { de: 80, vers: 30, duree: 0.45, type: "sine", vol: 0.8 });
        this.souffle(c, t, { duree: 0.26, vol: 0.45, filtre: 1100, filtreVers: 220, q: 0.9 });
        break;
      case "mort":
        this.ton(c, t, { de: 620, vers: 90, duree: 0.22, type: "square", vol: 0.2 });
        this.ton(c, t, { de: 300, vers: 600, duree: 0.12, type: "triangle", vol: 0.14, retard: 0.04 });
        this.souffle(c, t, { duree: 0.24, vol: 0.3, filtre: 3500, filtreVers: 500, q: 0.5 });
        break;
      case "esquive":
        this.souffle(c, t, { duree: 0.22, vol: 0.35, filtre: 500, filtreVers: 3800, q: 1.2 });
        this.ton(c, t, { de: 220, vers: 520, duree: 0.14, type: "sine", vol: 0.1 });
        break;
      case "frole":
        this.ton(c, t, { de: 880, duree: 0.09, type: "triangle", vol: 0.18 });
        this.ton(c, t, { de: 1320, duree: 0.16, type: "triangle", vol: 0.16, retard: 0.07 });
        break;
      case "degats":
        this.ton(c, t, { de: 200, vers: 55, duree: 0.38, type: "sawtooth", vol: 0.38 });
        this.ton(c, t, { de: 90, vers: 45, duree: 0.34, type: "sine", vol: 0.55 });
        this.souffle(c, t, { duree: 0.24, vol: 0.4, filtre: 1500, filtreVers: 200, q: 0.8 });
        break;
      case "annonce":
        this.ton(c, t, { de: 90, vers: 130, duree: 0.7, type: "sawtooth", vol: 0.16, attaque: 0.25 });
        this.ton(c, t, { de: 300, vers: 440, duree: 0.45, type: "square", vol: 0.07, attaque: 0.2 });
        break;
      case "impact":
        this.ton(c, t, { de: 110, vers: 32, duree: 0.5, type: "sine", vol: 0.85 });
        this.souffle(c, t, { duree: 0.4, vol: 0.55, filtre: 1400, filtreVers: 120, q: 0.7 });
        this.ton(c, t, { de: 180, vers: 60, duree: 0.3, type: "sawtooth", vol: 0.2 });
        break;
      case "pierre":
        this.ton(c, t, { de: 140, vers: 40, duree: 0.28, type: "sine", vol: 0.55 });
        this.souffle(c, t, { duree: 0.26, vol: 0.4, filtre: 2000, filtreVers: 200, q: 0.7 });
        break;
      case "onde":
        this.ton(c, t, { de: 75, vers: 28, duree: 0.7, type: "sine", vol: 0.8 });
        this.souffle(c, t, { duree: 0.7, vol: 0.4, filtre: 300, filtreVers: 2200, q: 1.1 });
        break;
      case "phase2":
        this.ton(c, t, { de: 220, vers: 55, duree: 1.1, type: "sawtooth", vol: 0.4, attaque: 0.05 });
        this.ton(c, t, { de: 110, vers: 40, duree: 1.2, type: "square", vol: 0.25, attaque: 0.05 });
        this.souffle(c, t, { duree: 1.0, vol: 0.45, filtre: 900, filtreVers: 160, q: 0.6 });
        break;
      case "victoire":
        this.ton(c, t, { de: 80, vers: 28, duree: 1.0, type: "sine", vol: 0.9 });
        this.souffle(c, t, { duree: 0.9, vol: 0.55, filtre: 2500, filtreVers: 90, q: 0.5 });
        for (const [i, f] of [523, 659, 784, 1047].entries()) this.ton(c, t, { de: f, duree: 0.34, type: "triangle", vol: 0.2, retard: 0.55 + i * 0.12 });
        break;
      case "defaite":
        for (const [i, f] of [392, 330, 262, 196].entries()) this.ton(c, t, { de: f, vers: f * 0.96, duree: 0.34, type: "triangle", vol: 0.22, retard: i * 0.16 });
        break;
      case "apparition":
        this.ton(c, t, { de: 200, vers: 520, duree: 0.09, type: "sine", vol: 0.1 });
        break;
      case "bloque":
        this.ton(c, t, { de: 900, vers: 700, duree: 0.07, type: "square", vol: 0.16 });
        break;
      // Lot BR2 : une gemme ramassée (un petit tintement qui monte à chaque gemme de suite : `hauteur`), un niveau gagné (une montée de quatre notes), la carte choisie, un cœur rendu, l'onde de l'épée.
      case "ramasse":
        this.ton(c, t, { de: 880 * h, vers: 1320 * h, duree: 0.09, type: "triangle", vol: 0.13 });
        break;
      case "niveau":
        for (const [i, f] of [523, 659, 784, 1047].entries()) this.ton(c, t, { de: f, duree: 0.22, type: "triangle", vol: 0.2, retard: i * 0.09 });
        break;
      case "carte":
        this.ton(c, t, { de: 660, vers: 990, duree: 0.12, type: "square", vol: 0.12 });
        this.ton(c, t, { de: 1320, duree: 0.2, type: "triangle", vol: 0.16, retard: 0.08 });
        break;
      case "soin":
        for (const [i, f] of [392, 523, 659].entries()) this.ton(c, t, { de: f, duree: 0.18, type: "sine", vol: 0.18, retard: i * 0.07 });
        break;
      case "ondeEpee":
        this.souffle(c, t, { duree: 0.4, vol: 0.35, filtre: 900, filtreVers: 3600, q: 1.1 });
        this.ton(c, t, { de: 300, vers: 900, duree: 0.3, type: "sawtooth", vol: 0.08 });
        break;
    }
  }
}

/** Le niveau général des effets : le volume du kit (0 à 1) ; 0 si le son est coupé. */
export const niveauEffets = (volume: number, coupe: boolean): number => (coupe || !(volume > 0) ? 0 : Math.min(1, volume));
