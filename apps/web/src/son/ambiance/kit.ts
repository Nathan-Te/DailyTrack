// Lot 56 — la boîte à outils des ambiances sonores (à la demande, jamais dans le premier chargement). Les ambiances sont **rendues par le code au chargement du thème** :
// les lits continus (vent, foule, grillons) par un `OfflineAudioContext` (calcul natif, plus vite que le temps réel), les événements ponctuels (un oiseau, un klaxon, un
// craquement de glace) par une synthèse échantillon par échantillon. Aucun fichier, aucune source tierce (rien à créditer). **Rien de ceci ne lit une course** : une ambiance
// ne reçoit que la vitesse, l'état « en course » et la position du décor (lecture seule, voir `index.ts`). Aucun hasard non semé (graine fixe : `alea`), aucune horloge murale.
// Règle d'empaquetage : aucun import d'une valeur du premier chargement (`audio`, `audioLogic`, `i18n`…).

/** Durée (s) de la couture d'une boucle : la fin d'un lit est fondue dans son début. */
export const FONDU = 2;

/** Fréquence d'échantillonnage des ambiances : 22 050 Hz (le contenu utile s'arrête vers 8 kHz ; le navigateur rééchantillonne). */
export const SR = 22050;

export type Alea = () => number;

/** Un générateur pseudo-aléatoire semé (mulberry32) : le même résultat à chaque fois, aucune horloge, aucun hasard non semé. */
export function alea(graine: number): Alea {
  let s = graine >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Un nombre tiré entre `lo` et `hi`. */
export const entre = (a: Alea, lo: number, hi: number): number => lo + (hi - lo) * a();
export const borne = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);

/** Un tirage dans une liste. */
export const parmi = <T>(a: Alea, liste: readonly T[]): T => liste[Math.min(liste.length - 1, Math.floor(a() * liste.length))]!;

// --- Bruits et filtres (synthèse échantillon par échantillon : événements courts) --------------------------------------------------------------

export function bruitBlanc(n: number, a: Alea): Float32Array {
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = a() * 2 - 1;
  return x;
}

/** Bruit rose (≈ −3 dB par octave) : filtre de Paul Kellet. Niveau ≈ 0,25 d'écart-type. */
export function bruitRose(n: number, a: Alea): Float32Array {
  const x = new Float32Array(n);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;
  for (let i = 0; i < n; i++) {
    const w = a() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    x[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  return x;
}

/** Bruit brun (intégré, ≈ −6 dB par octave). */
export function bruitBrun(n: number, a: Alea): Float32Array {
  const x = new Float32Array(n);
  let v = 0;
  for (let i = 0; i < n; i++) {
    v = (v + (a() * 2 - 1) * 0.05) * 0.998;
    x[i] = v * 2.4;
  }
  return x;
}

export type TypeFiltre = "lowpass" | "highpass" | "bandpass";

/** Un filtre biquad (formules de R. Bristow-Johnson), appliqué à un tableau : un nouveau tableau. `q` : résonance (bande passante constante pour `bandpass`). */
export function filtrer(x: Float32Array, type: TypeFiltre, f: number, q = 0.7): Float32Array {
  const w0 = (2 * Math.PI * Math.min(f, SR * 0.45)) / SR;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  let b0: number;
  let b1: number;
  let b2: number;
  if (type === "lowpass") {
    b0 = (1 - cos) / 2;
    b1 = 1 - cos;
    b2 = b0;
  } else if (type === "highpass") {
    b0 = (1 + cos) / 2;
    b1 = -(1 + cos);
    b2 = b0;
  } else {
    b0 = alpha;
    b1 = 0;
    b2 = -alpha;
  }
  const a0 = 1 + alpha;
  const a1 = -2 * cos;
  const a2 = 1 - alpha;
  const y = new Float32Array(x.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const xi = x[i]!;
    const yi = (b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1;
    x1 = xi;
    y2 = y1;
    y1 = yi;
    y[i] = yi;
  }
  return y;
}

// --- Écrire des sons dans un tableau -------------------------------------------------------------------------------------------------------------

/** Ajoute `x` dans `sortie` à l'instant `t0` (s), multiplié par `gain`. */
export function ajouter(sortie: Float32Array, t0: number, x: Float32Array, gain = 1): void {
  const i0 = Math.round(t0 * SR);
  for (let i = 0; i < x.length; i++) {
    const j = i0 + i;
    if (j >= 0 && j < sortie.length) sortie[j] = sortie[j]! + x[i]! * gain;
  }
}

export interface Note {
  /** Début (s) dans le tableau, durée (s). */
  t: number;
  dur: number;
  /** Fréquence au début et à la fin (glissement exponentiel). */
  f0: number;
  f1?: number;
  amp?: number;
  /** Partiels : [rapport de fréquence, amplitude]. Par défaut le fondamental seul. */
  partiels?: readonly (readonly [number, number])[];
  /** Vibrato : fréquence (Hz) et profondeur (rapport, 0,02 = ± 2 %). */
  vib?: readonly [number, number];
  /** Part de la durée consacrée à l'attaque (0 à 1) et puissance de la fenêtre. */
  attaque?: number;
  fenetre?: number;
}

/** La fenêtre d'une note : attaque en quart de sinus (jusqu'à `att` de la durée), puis décroissance douce en cosinus à la puissance `puiss`. */
const fenetre = (u: number, att: number, puiss: number): number => (u < att ? Math.sin((Math.PI / 2) * (u / att)) : Math.pow(Math.cos((Math.PI / 2) * ((u - att) / (1 - att))), puiss));

/** Écrit une note (sinusoïdes avec partiels, glissement, vibrato, fenêtre lisse) dans `sortie`. Le glissement est un facteur par échantillon, la fenêtre est calculée toutes les 24 échantillons et interpolée : une note coûte ≈ un sinus par partiel et par échantillon. */
export function ecrireNote(sortie: Float32Array, n: Note): void {
  const nb = Math.max(2, Math.round(n.dur * SR));
  const i0 = Math.round(n.t * SR);
  const partiels = n.partiels ?? [[1, 1]];
  const att = borne(n.attaque ?? 0.15, 0.01, 0.9);
  const puiss = n.fenetre ?? 1.4;
  const pas = Math.pow((n.f1 ?? n.f0) / n.f0, 1 / (nb - 1));
  const phases = new Float64Array(partiels.length);
  const BLOC = 24;
  let f = n.f0;
  let eA = fenetre(0, att, puiss);
  let eB = fenetre(Math.min(1, BLOC / (nb - 1)), att, puiss);
  const w = (2 * Math.PI) / SR;
  const amp = n.amp ?? 0.5;
  for (let i = 0; i < nb; i++) {
    const r = i % BLOC;
    if (i > 0 && r === 0) {
      eA = eB;
      eB = fenetre(Math.min(1, (i + BLOC) / (nb - 1)), att, puiss);
    }
    f *= pas;
    const j = i0 + i;
    if (j < 0 || j >= sortie.length) continue;
    const fi = n.vib ? f * (1 + n.vib[1] * Math.sin(w * n.vib[0] * i)) : f;
    let s = 0;
    for (let k = 0; k < partiels.length; k++) {
      const p = partiels[k]!;
      phases[k] = phases[k]! + w * fi * p[0];
      s += p[1] * Math.sin(phases[k]!);
    }
    sortie[j] = sortie[j]! + s * (eA + (eB - eA) * (r / BLOC)) * amp;
  }
}

/** Rend la main au navigateur (un tour de boucle d'événements) : la fabrication d'une ambiance se fait par petits morceaux, jamais une tâche longue qui ferait sauter une image du jeu. */
export const respirer = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

/** Un coup de cloche : partiels inharmoniques (rapports d'une cloche de bronze) qui s'éteignent d'autant plus vite qu'ils sont aigus. */
export function ecrireCloche(sortie: Float32Array, t0: number, f0: number, duree: number, amp = 0.5): void {
  const PARTIELS: readonly (readonly [number, number])[] = [
    [0.5, 0.55],
    [1, 1],
    [1.19, 0.6],
    [1.5, 0.45],
    [2, 0.55],
    [2.5, 0.3],
    [3.05, 0.22],
    [4.2, 0.12],
  ];
  const nb = Math.round(duree * SR);
  for (const [r, g] of PARTIELS) {
    const tau = duree / (2.2 + r * 1.6);
    const w = (2 * Math.PI * f0 * r) / SR;
    for (let i = 0; i < nb; i++) {
      const j = Math.round(t0 * SR) + i;
      if (j >= sortie.length) break;
      const t = i / SR;
      const att = Math.min(1, t / 0.004);
      sortie[j] = sortie[j]! + amp * g * att * Math.exp(-t / tau) * Math.sin(w * i);
    }
  }
}

/** Un claquement : un court éclat de bruit filtré, à décroissance rapide (graviers, glace, applaudissements, étincelles). */
export function ecrireClic(sortie: Float32Array, t0: number, dur: number, fc: number, q: number, amp: number, a: Alea): void {
  const nb = Math.max(8, Math.round(dur * SR));
  const x = filtrer(bruitBlanc(nb, a), "bandpass", fc, q);
  const i0 = Math.round(t0 * SR);
  for (let i = 0; i < nb; i++) {
    const j = i0 + i;
    if (j >= 0 && j < sortie.length) sortie[j] = sortie[j]! + x[i]! * amp * Math.exp((-5 * i) / nb) * 3;
  }
}

/** Un écho simple (peigne) : `n` répétitions espacées de `delai` s, chacune plus faible (`reste`) et plus sourde (passe-bas). */
export function echo(x: Float32Array, delai: number, n: number, reste: number, coupure: number): Float32Array {
  const d = Math.round(delai * SR);
  const y = new Float32Array(x.length + d * n);
  y.set(x);
  let r = x;
  let g = 1;
  for (let k = 1; k <= n; k++) {
    r = filtrer(r, "lowpass", coupure, 0.6);
    g *= reste;
    ajouter(y, k * delai, r, g);
  }
  return y;
}

export function crete(x: Float32Array): number {
  let m = 0;
  for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i]!));
  return m;
}

export function rms(x: readonly Float32Array[]): number {
  let s = 0;
  let n = 0;
  for (const c of x) {
    for (let i = 0; i < c.length; i++) s += c[i]! * c[i]!;
    n += c.length;
  }
  return n ? Math.sqrt(s / n) : 0;
}

/** Ramène la crête de `x` à `cible` (un événement) et le fond en début et fin à zéro (aucun clic de coupure). */
export function normaliserCrete(x: Float32Array, cible = 0.9): Float32Array {
  const m = crete(x);
  const g = m > 0 ? cible / m : 1;
  const n = x.length;
  const fond = Math.min(n >> 1, Math.round(0.008 * SR));
  for (let i = 0; i < n; i++) {
    const c = i < fond ? i / fond : n - 1 - i < fond ? (n - 1 - i) / fond : 1;
    x[i] = x[i]! * g * c;
  }
  return x;
}

/** Ramène le niveau efficace de `x` (tous canaux) à `cible`. */
export function normaliserRms(x: Float32Array[], cible: number): void {
  const m = rms(x);
  const g = m > 0 ? cible / m : 1;
  for (const c of x) for (let i = 0; i < c.length; i++) c[i] = c[i]! * g;
}

/** Spectre moyen (16 fenêtres de 8 192 échantillons, Hann) d'un signal mono : l'énergie (part de 0 à 1) de quelques bandes. */
export function bandesDEnergie(x: Float32Array, limites: readonly number[]): number[] {
  const N = 8192;
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  const energie = new Float64Array(N / 2);
  const pas = Math.max(1, Math.floor((x.length - N) / 15));
  for (let w = 0; w < 16; w++) {
    for (let i = 0; i < N; i++) {
      re[i] = (x[w * pas + i] ?? 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
      im[i] = 0;
    }
    // FFT itérative (radix 2).
    for (let i = 1, j = 0; i < N; i++) {
      let bit = N >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) [re[i], re[j]] = [re[j]!, re[i]!];
    }
    for (let len = 2; len <= N; len <<= 1) {
      const ang = (-2 * Math.PI) / len;
      for (let i = 0; i < N; i += len) {
        for (let k = 0; k < len / 2; k++) {
          const c = Math.cos(ang * k);
          const s = Math.sin(ang * k);
          const a = i + k;
          const b = i + k + len / 2;
          const tr = re[b]! * c - im[b]! * s;
          const ti = re[b]! * s + im[b]! * c;
          re[b] = re[a]! - tr;
          im[b] = im[a]! - ti;
          re[a] = re[a]! + tr;
          im[a] = im[a]! + ti;
        }
      }
    }
    for (let i = 0; i < N / 2; i++) energie[i] = energie[i]! + re[i]! ** 2 + im[i]! ** 2;
  }
  const total = energie.reduce((s, v) => s + v, 0) || 1;
  const part = (a: number, b: number) => {
    let s = 0;
    for (let i = Math.floor((a * N) / SR); i < Math.min(N / 2, Math.floor((b * N) / SR)); i++) s += energie[i]!;
    return s / total;
  };
  return limites.slice(0, -1).map((a, i) => part(a, limites[i + 1]!));
}

// --- La banque d'événements : toutes les variantes bout à bout dans un seul tampon ---------------------------------------------------------------

export interface Tranche {
  /** Début et durée (s) dans le tampon de la banque. */
  debut: number;
  duree: number;
}

export interface Banque {
  donnees: Float32Array;
  tranches: Record<string, Tranche[]>;
}

/** Construit une banque : chaque variante est normalisée (crête 0,9), rangée à la suite, 0,12 s de silence entre deux. */
export class ConstructeurBanque {
  private readonly morceaux: { nom: string; x: Float32Array; debut: number }[] = [];
  private fin = 0.05;
  /** Range une variante ; rend la main au navigateur ensuite (la synthèse du suivant se fait dans une autre tâche). */
  async ajouter(nom: string, x: Float32Array): Promise<void> {
    normaliserCrete(x);
    this.morceaux.push({ nom, x, debut: this.fin });
    this.fin += x.length / SR + 0.12;
    await respirer();
  }
  construire(): Banque {
    const donnees = new Float32Array(Math.ceil(this.fin * SR));
    const tranches: Record<string, Tranche[]> = {};
    for (const m of this.morceaux) {
      ajouter(donnees, m.debut, m.x);
      (tranches[m.nom] ??= []).push({ debut: m.debut, duree: m.x.length / SR });
    }
    return { donnees, tranches };
  }
}

// --- Le rendu hors ligne des lits continus ----------------------------------------------------------------------------------------------------------

/** Une courbe lisse et aléatoire, échantillonnée à 50 Hz : des points tirés tous les `espacement` s (interpolés en cosinus), entre `mini` et `maxi` (`puissance` > 1 : des pointes rares). */
export function courbeAlea(a: Alea, duree: number, espacement: number, mini: number, maxi: number, puissance = 1): Float32Array {
  const n = Math.max(2, Math.round(duree * 50));
  const nb = Math.ceil(duree / espacement) + 2;
  const pts: number[] = [];
  for (let i = 0; i < nb; i++) pts.push(Math.pow(a(), puissance));
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = (i / 50) / espacement;
    const k = Math.floor(p);
    const u = p - k;
    const w = (1 - Math.cos(Math.PI * u)) / 2;
    c[i] = mini + (maxi - mini) * (pts[k]! * (1 - w) + pts[k + 1]! * w);
  }
  return c;
}

/** Une courbe d'enveloppe sur une fenêtre : montée, plateau, descente (valeurs de 0 à `crete`), 50 points par seconde. */
export function courbeEnveloppe(duree: number, montee: number, descente: number, crete: number): Float32Array {
  const n = Math.max(2, Math.round(duree * 50));
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / 50;
    const up = borne(t / Math.max(0.01, montee), 0, 1);
    const down = borne((duree - t) / Math.max(0.01, descente), 0, 1);
    c[i] = crete * Math.sin((Math.PI / 2) * up) * Math.sin((Math.PI / 2) * down);
  }
  c[0] = 0;
  c[n - 1] = 0;
  return c;
}

/** Une courbe de fréquence (Hz) qui dérive lentement. */
export const courbeFreq = (a: Alea, duree: number, espacement: number, f0: number, f1: number): Float32Array => courbeAlea(a, duree, espacement, f0, f1);

/** Le graphe d'un rendu hors ligne : une aide à écrire les lits. **Un seul canal est calculé** : le canal droit est le même son, décalé d'un peu plus du tiers de la boucle (un bruit lu 7 s plus tard n'a plus aucun rapport avec le premier :
 *  la largeur stéréo d'un grand lit, pour la moitié du calcul — ce qui compte sur un téléphone). */
export class Rendu {
  readonly ctx: OfflineAudioContext;
  /** Durée rendue (s), couture comprise. */
  readonly duree: number;
  private readonly reserve = new Map<string, AudioBuffer>();
  constructor(readonly secondes: number, readonly fondu: number) {
    this.duree = secondes + fondu;
    this.ctx = new OfflineAudioContext(1, Math.round(this.duree * SR), SR);
  }
  /** Joue un tableau (mono) depuis le début. */
  brut(x: Float32Array): AudioBufferSourceNode {
    const b = this.ctx.createBuffer(1, x.length, SR);
    b.copyToChannel(x as Float32Array<ArrayBuffer>, 0);
    return this.depuis(b);
  }
  private depuis(b: AudioBuffer): AudioBufferSourceNode {
    const s = this.ctx.createBufferSource();
    s.buffer = b;
    s.start(0);
    return s;
  }
  /** Un bruit mono de toute la durée. Quatre bruits de chaque genre sont fabriqués une fois et partagés (le tirage de `a` choisit lequel) : les voix qui les filtrent ne couvrent pas les mêmes bandes. */
  bruit(a: Alea, genre: "blanc" | "rose" | "brun" = "rose"): AudioBufferSourceNode {
    const k = Math.floor(a() * 4);
    const cle = `${genre}${k}`;
    let b = this.reserve.get(cle);
    if (!b) {
      const n = Math.round(this.duree * SR);
      const g = alea(9000 + k * 131 + genre.length);
      b = this.ctx.createBuffer(1, n, SR);
      b.copyToChannel((genre === "rose" ? bruitRose(n, g) : genre === "blanc" ? bruitBlanc(n, g) : bruitBrun(n, g)) as Float32Array<ArrayBuffer>, 0);
      this.reserve.set(cle, b);
    }
    return this.depuis(b);
  }
  /** Un bruit brun (intégré, ≈ −6 dB par octave), mono. */
  brun(a: Alea): AudioBufferSourceNode {
    return this.bruit(a, "brun");
  }
  bq(type: BiquadFilterType, f: number, q = 0.7): BiquadFilterNode {
    const b = this.ctx.createBiquadFilter();
    b.type = type;
    b.frequency.value = f;
    b.Q.value = q;
    return b;
  }
  g(v = 1): GainNode {
    const g = this.ctx.createGain();
    g.gain.value = v;
    return g;
  }
  /** Fait suivre un paramètre à une courbe sur toute la durée (le paramètre part de la première valeur). */
  suivre(p: AudioParam, c: Float32Array, t0 = 0, duree = this.duree - t0): void {
    p.value = c[0] ?? 0;
    p.setValueCurveAtTime(c, t0, duree);
  }
  /** Un oscillateur qui démarre à 0. */
  osc(type: OscillatorType, f: number): OscillatorNode {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.start(0);
    return o;
  }
  /** Fait le rendu et rend deux tableaux de `secondes` (gauche, droite décalé) ; avec couture (`fermer`), la fin est fondue dans le début (équipuissance) : la boucle ne s'entend pas. */
  async lire(fermer = true): Promise<Float32Array[]> {
    const tampon = await this.ctx.startRendering();
    const n = Math.round(this.secondes * SR);
    const f = fermer ? Math.round(this.fondu * SR) : 0;
    const x = tampon.getChannelData(0);
    const g = new Float32Array(n);
    if (fermer) {
      // La queue (n … n+f) est la suite du son qui précède le début (0 … f) : on les mélange, la queue s'éteint pendant que le début revient.
      for (let i = 0; i < n; i++) {
        if (i < f) {
          const u = (i / f) * (Math.PI / 2);
          g[i] = x[i]! * Math.sin(u) + x[n + i]! * Math.cos(u);
        } else g[i] = x[i]!;
      }
    } else g.set(x.subarray(0, n));
    const d = new Float32Array(n);
    const decalage = Math.round(n * 0.37);
    for (let i = 0; i < n; i++) d[i] = g[(i + decalage) % n]!;
    return [g, d];
  }
}

/** Un lit stéréo continu : `secondes` de son rendu hors ligne, sans couture, au niveau efficace `niveau` (0,06 : un fond discret). */
export async function rendreLit(secondes: number, graine: number, chaine: (a: Alea, sortie: AudioNode, r: Rendu) => void, niveau = 0.06, fermer = true, coupureBas = 110): Promise<Float32Array[]> {
  const r = new Rendu(secondes, fermer ? FONDU : 0);
  // Pas de composante continue, et pas de grave qu'un haut-parleur de téléphone ne rend pas : un passe-haut (110 Hz par défaut) à la sortie.
  const hp = r.bq("highpass", coupureBas, 0.7);
  hp.connect(r.ctx.destination);
  chaine(alea(graine), hp, r);
  const x = await r.lire(fermer);
  normaliserRms(x, niveau);
  return x;
}

/** Un babil de foule : `voix` voix (du bruit rose passé dans deux formants de voyelle, au rythme de syllabes aléatoires) rendues dans `sortie` entre `t0` et `t0 + dur`. */
export function babil(r: Rendu, a: Alea, sortie: AudioNode, o: { voix: number; t0?: number; dur?: number; syllabe: [number, number]; formants?: [[number, number], [number, number]]; brillance?: number; enveloppe?: Float32Array }): void {
  const t0 = o.t0 ?? 0;
  const dur = o.dur ?? r.duree - t0;
  const [[a1, b1], [a2, b2]] = o.formants ?? [
    [280, 760],
    [900, 2300],
  ];
  const mix = r.g(1);
  const tonalite = r.bq("lowpass", o.brillance ?? 3000, 0.5);
  mix.connect(tonalite).connect(sortie);
  if (o.enveloppe) {
    const g = r.g(0);
    r.suivre(g.gain, o.enveloppe, t0, dur);
    tonalite.disconnect();
    tonalite.connect(g).connect(sortie);
  }
  for (let i = 0; i < o.voix; i++) {
    const src = r.bruit(a);
    const f1 = r.bq("bandpass", entre(a, a1, b1), 5);
    const f2 = r.bq("bandpass", entre(a, a2, b2), 6);
    const somme = r.g(0);
    const deux = r.g(0.55);
    src.connect(f1).connect(somme);
    src.connect(f2).connect(deux).connect(somme);
    // L'enveloppe des syllabes : un rythme de 3 à 6 syllabes par seconde, irrégulier, avec des silences.
    r.suivre(somme.gain, courbeAlea(a, dur, 1 / entre(a, o.syllabe[0], o.syllabe[1]), 0, 1 / Math.sqrt(o.voix) * 2.2, 2.2), t0, dur);
    somme.connect(mix);
  }
}
