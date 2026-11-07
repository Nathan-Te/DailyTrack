import { PAS_SURVEILLANCE_MS, type ContexteAudio, type Dependances, type GainAudio, type OscAudio, type ParamAudio, type SourceAudio, type StockageMin, type TamponAudio } from "../src/lecteur";
import type { JeuMusique, ListeServie, PisteServie } from "../src/types";

// Des faux navigateurs pour tester le lecteur sans navigateur (lot S2 : Web Audio seulement, jamais d'élément média) : un contexte dont le test fait avancer l'horloge et qui note ce qu'on lui demande
// (morceaux décodés, lectures, gains), un téléchargement en mémoire, un stockage en mémoire.

export class FauxParam implements ParamAudio {
  value = 0;
  appels: [string, ...unknown[]][] = [];
  setTargetAtTime(v: number, t: number, c: number) {
    this.appels.push(["cible", v, t, c]);
    this.value = v;
  }
  setValueCurveAtTime(courbe: Float32Array, t: number, duree: number) {
    this.appels.push(["courbe", courbe, t, duree]);
  }
  cancelScheduledValues(t: number) {
    this.appels.push(["annule", t]);
  }
  setValueAtTime(v: number, t: number) {
    this.appels.push(["valeur", v, t]);
    this.value = v;
  }
  courbes() {
    return this.appels.filter((a) => a[0] === "courbe") as ["courbe", Float32Array, number, number][];
  }
}

export class FauxGain implements GainAudio {
  gain = new FauxParam();
  vers: unknown[] = [];
  connect(v: unknown) {
    this.vers.push(v);
    return v;
  }
}

/** Un oscillateur de la couche : note ce qu'on lui demande (forme, hauteurs, début, fin). */
export class FauxOsc implements OscAudio {
  type = "sine";
  frequency = new FauxParam();
  vers: unknown[] = [];
  debut: number | null = null;
  fin: number | null = null;
  connect(v: unknown) {
    this.vers.push(v);
    return v;
  }
  start(t: number) {
    this.debut = t;
  }
  stop(t: number) {
    this.fin = t;
  }
  /** La hauteur demandée (Hz). */
  get hz(): number {
    return (this.frequency.appels.find((a) => a[0] === "valeur")?.[1] as number) ?? 0;
  }
}

/** Un morceau décodé : seule sa durée compte. `url` dit d'où il vient (de quoi compter les téléchargements). */
export class FauxTampon implements TamponAudio {
  constructor(
    readonly url: string,
    readonly duration: number,
  ) {}
}

/** Une lecture d'un morceau décodé : note quand elle commence (horloge du contexte), à quelle position du fichier, et si on l'a arrêtée. */
export class FauxSource implements SourceAudio {
  buffer: TamponAudio | null = null;
  onended: (() => void) | null = null;
  vers: unknown[] = [];
  debut: number | null = null;
  decalage: number | null = null;
  arrets = 0;
  deconnectee = false;
  connect(v: unknown) {
    this.vers.push(v);
    return v;
  }
  disconnect() {
    this.deconnectee = true;
  }
  start(quand?: number, decalage?: number) {
    this.debut = quand ?? 0;
    this.decalage = decalage ?? 0;
  }
  stop() {
    this.arrets++;
  }
  /** La lecture est arrivée au bout du fichier. */
  finir() {
    this.onended?.();
  }
  /** Elle joue encore : commencée et pas arrêtée. */
  get joue(): boolean {
    return this.debut !== null && this.arrets === 0;
  }
  /** Le fichier de ce qu'elle joue. */
  get fichier(): string {
    return (this.buffer as FauxTampon | null)?.url ?? "";
  }
}

export class FauxContexte implements ContexteAudio {
  state = "suspended";
  currentTime = 10;
  destination = { destination: true };
  gains: FauxGain[] = [];
  sources: FauxSource[] = [];
  /** Les morceaux décodés, dans l'ordre. */
  decodes: FauxTampon[] = [];
  oscillateurs: FauxOsc[] = [];
  suspendus = 0;
  repris = 0;
  async resume() {
    this.repris++;
    this.state = "running";
  }
  async suspend() {
    this.suspendus++;
    this.state = "suspended";
  }
  createGain() {
    const g = new FauxGain();
    this.gains.push(g);
    return g;
  }
  createOscillator() {
    const o = new FauxOsc();
    this.oscillateurs.push(o);
    return o;
  }
  createBufferSource() {
    const s = new FauxSource();
    this.sources.push(s);
    return s;
  }
  /** Les « octets » sont l'adresse du fichier (voir `banc`) ; la durée est celle du morceau de la liste, ou 120 s. */
  durees = new Map<string, number>();
  async decodeAudioData(donnees: ArrayBuffer) {
    const url = new TextDecoder().decode(donnees);
    const t = new FauxTampon(url, this.durees.get(url) ?? 120);
    this.decodes.push(t);
    return t;
  }
}

export class StockageMemoire implements StockageMin {
  constructor(readonly m = new Map<string, string>()) {}
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
}

export const piste = (id: string, o: Partial<PisteServie> = {}): PisteServie => ({ id, titre: `Titre ${id}`, artiste: "Artiste", credit: `« Titre ${id} » — Artiste`, fichier: `${id}-abcd1234.m4a`, jeux: ["track", "jump", "tower"], scenes: [], sha: "0".repeat(64), poids: 1, volumeDb: 0, duree: 120, ...o });
export const liste = (...pistes: PisteServie[]): ListeServie => ({ version: 1, debit: "96k", pistes });

export interface Banc {
  deps: Dependances;
  ctx: FauxContexte;
  stockage: StockageMemoire;
  session: StockageMemoire;
  /** Les rappels programmés, que le test fait sonner. */
  attente: { ms: number; fn: () => void }[];
  evenements: Map<string, (() => void)[]>;
  etat: { cachee: boolean; maintenant: number; hasard: number[]; requetes: string[]; telechargements: string[]; retenir: boolean; echecs: Set<string> };
  emettre(cible: "fenetre" | "document", type: string): void;
  ecouteursDe(cible: "fenetre" | "document", type: string): number;
  /** Laisse les promesses se résoudre (chargement de la liste, téléchargement et décodage des morceaux). */
  pret(): Promise<void>;
  /** Les téléchargements retenus (`etat.retenir`) arrivent. */
  livrer(): Promise<void>;
  /** Fait avancer l'horloge du contexte de `s` secondes, par pas de la surveillance du lecteur (250 ms) : à chaque pas elle sonne, puis les promesses se résolvent. */
  avancer(s: number): Promise<void>;
  /** Fait sonner la surveillance du lecteur une fois. */
  surveiller(): void;
}

/** Un banc d'essai : tout ce que le lecteur demande au navigateur, en mémoire. */
export function banc(jeu: JeuMusique, contenu: unknown, o: { stockage?: StockageMemoire; session?: StockageMemoire; maintenant?: number; hasard?: number[] } = {}): Banc {
  const ctx = new FauxContexte();
  const attente: { ms: number; fn: () => void }[] = [];
  const evenements = new Map<string, (() => void)[]>();
  const etat = { cachee: false, maintenant: o.maintenant ?? 1_000_000, hasard: o.hasard ?? [0], requetes: [] as string[], telechargements: [] as string[], retenir: false, echecs: new Set<string>() };
  const retenus: (() => void)[] = [];
  const pistes = ((contenu as { pistes?: PisteServie[] } | null)?.pistes ?? []).filter((p) => p && typeof p === "object");
  for (const p of pistes) ctx.durees.set(`/musique/${p.fichier}`, p.duree);
  const stockage = o.stockage ?? new StockageMemoire();
  const session = o.session ?? new StockageMemoire();
  const deps: Dependances = {
    jeu,
    base: "/musique/",
    stockage,
    session,
    chargerListe: async (url) => {
      etat.requetes.push(url);
      return contenu;
    },
    telecharger: async (url) => {
      etat.telechargements.push(url);
      if (etat.echecs.has(url)) throw new Error("réseau");
      if (etat.retenir) await new Promise<void>((arrive) => retenus.push(arrive));
      return new TextEncoder().encode(url).buffer as ArrayBuffer;
    },
    creerContexte: () => ctx,
    cachee: () => etat.cachee,
    ecouter: (cible, type, fn) => {
      const cle = `${cible}:${type}`;
      evenements.set(cle, [...(evenements.get(cle) ?? []), fn]);
      return () => evenements.set(cle, (evenements.get(cle) ?? []).filter((f) => f !== fn));
    },
    maintenant: () => etat.maintenant,
    hasard: () => (etat.hasard.length > 1 ? etat.hasard.shift()! : etat.hasard[0]!),
    planifier: (ms, fn) => void attente.push({ ms, fn }),
  };
  async function pret(): Promise<void> {
    for (let i = 0; i < 30; i++) await Promise.resolve();
  }
  function surveiller(): void {
    const i = attente.findIndex((a) => a.ms === PAS_SURVEILLANCE_MS);
    if (i >= 0) attente.splice(i, 1)[0]!.fn();
  }
  return {
    deps,
    ctx,
    stockage,
    session,
    attente,
    evenements,
    etat,
    emettre: (cible, type) => (evenements.get(`${cible}:${type}`) ?? []).forEach((f) => f()),
    ecouteursDe: (cible, type) => (evenements.get(`${cible}:${type}`) ?? []).length,
    pret,
    livrer: async () => {
      while (retenus.length) retenus.shift()!();
      await pret();
    },
    surveiller,
    avancer: async (s) => {
      for (let t = 0; t < s - 1e-9; t += 0.25) {
        ctx.currentTime += 0.25;
        surveiller();
        await pret();
      }
    },
  };
}
