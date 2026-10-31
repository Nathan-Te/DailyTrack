import type { ContexteAudio, Dependances, ElementAudio, GainAudio, ParamAudio, StockageMin } from "../src/lecteur";
import type { JeuMusique, ListeServie, PisteServie } from "../src/types";

// Des faux navigateurs pour tester le lecteur sans navigateur : un élément audio que le test fait avancer, un contexte qui note ce qu'on lui demande, un stockage en mémoire.

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

export class FauxElement implements ElementAudio {
  src = "";
  preload = "";
  currentTime = 0;
  duration = NaN;
  paused = true;
  lectures = 0;
  private ecouteurs = new Map<string, (() => void)[]>();
  async play() {
    this.lectures++;
    this.paused = false;
  }
  pause() {
    this.paused = true;
  }
  addEventListener(type: string, fn: () => void) {
    this.ecouteurs.set(type, [...(this.ecouteurs.get(type) ?? []), fn]);
  }
  emettre(type: string) {
    for (const f of this.ecouteurs.get(type) ?? []) f();
  }
  /** Fait avancer la lecture jusqu'à `t` secondes et dit `timeupdate`. */
  jusqua(t: number) {
    this.currentTime = t;
    this.emettre("timeupdate");
  }
}

export class FauxContexte implements ContexteAudio {
  state = "suspended";
  currentTime = 10;
  destination = { destination: true };
  gains: FauxGain[] = [];
  sources: { el: unknown; vers: unknown[] }[] = [];
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
  createMediaElementSource(el: unknown) {
    const s = { el, vers: [] as unknown[], connect(v: unknown) { this.vers.push(v); return v; } };
    this.sources.push(s);
    return s;
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

export const piste = (id: string, o: Partial<PisteServie> = {}): PisteServie => ({ id, titre: `Titre ${id}`, artiste: "Artiste", credit: `« Titre ${id} » — Artiste`, fichier: `${id}-abcd1234.m4a`, jeux: ["track", "jump", "tower"], poids: 1, volumeDb: 0, duree: 120, ...o });
export const liste = (...pistes: PisteServie[]): ListeServie => ({ version: 1, debit: "96k", pistes });

export interface Banc {
  deps: Dependances;
  ctx: FauxContexte;
  elements: FauxElement[];
  stockage: StockageMemoire;
  session: StockageMemoire;
  /** Les rappels programmés, que le test fait sonner. */
  attente: { ms: number; fn: () => void }[];
  evenements: Map<string, (() => void)[]>;
  etat: { cachee: boolean; maintenant: number; hasard: number[]; requetes: string[] };
  emettre(cible: "fenetre" | "document", type: string): void;
  ecouteursDe(cible: "fenetre" | "document", type: string): number;
  /** Laisse les promesses se résoudre (chargement de la liste). */
  pret(): Promise<void>;
}

/** Un banc d'essai : tout ce que le lecteur demande au navigateur, en mémoire. */
export function banc(jeu: JeuMusique, contenu: unknown, o: { stockage?: StockageMemoire; session?: StockageMemoire; maintenant?: number; hasard?: number[] } = {}): Banc {
  const ctx = new FauxContexte();
  const elements: FauxElement[] = [];
  const attente: { ms: number; fn: () => void }[] = [];
  const evenements = new Map<string, (() => void)[]>();
  const etat = { cachee: false, maintenant: o.maintenant ?? 1_000_000, hasard: o.hasard ?? [0], requetes: [] as string[] };
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
    creerAudio: () => {
      const e = new FauxElement();
      elements.push(e);
      return e;
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
  return {
    deps,
    ctx,
    elements,
    stockage,
    session,
    attente,
    evenements,
    etat,
    emettre: (cible, type) => (evenements.get(`${cible}:${type}`) ?? []).forEach((f) => f()),
    ecouteursDe: (cible, type) => (evenements.get(`${cible}:${type}`) ?? []).length,
    pret: async () => {
      for (let i = 0; i < 5; i++) await Promise.resolve();
    },
  };
}
