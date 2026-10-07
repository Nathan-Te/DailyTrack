import { SIM_VERSION, dailyTrackId, type ThemeName } from "@cdj/sim";
import { createCircuitMaker, type CircuitMaker } from "./thumbGen";
import { THUMB_H, THUMB_W, releaseThumbnailRenderer, renderThumbnail, type ThumbnailCircuit, type ThumbnailOptions } from "./thumbnail";

// Service de miniatures (lot 13) : les fabrique à la demande, une par une, jamais pendant une course, et les garde
// (mémoire + IndexedDB). Tout ce qui touche au navigateur est injectable : la logique se teste sans DOM.

/** À incrémenter quand l'aspect des miniatures change (cadrage, caméra, couleurs) : les anciennes images sont ignorées. */
export const THUMB_VERSION = 1;

/** Clé de cache : l'id du circuit (version du générateur, thème forcé, et plus tard variante) + la taille + les versions. */
export function thumbKey(day: number, theme: ThemeName | null, scale: number): string {
  return `${dailyTrackId(day, theme ?? undefined)}|s${SIM_VERSION}|t${THUMB_VERSION}|x${scale}`;
}

/** Densité de pixels des miniatures : 2 sur écran haute densité (au plus). */
export function thumbScale(dpr: number): 1 | 2 {
  return dpr >= 1.5 ? 2 : 1;
}

// --- Cache persistant --------------------------------------------------------------------------------

export interface ThumbStore {
  get(key: string): Promise<Blob | null>;
  put(key: string, blob: Blob): Promise<void>;
}

const DB_NAME = "cdj-thumbs";
const STORE = "thumbs";
/** Au plus ce nombre d'images gardées : les plus anciennes partent d'abord (≈ 15 à 40 ko chacune). */
export const MAX_STORED = 160;

/** IndexedDB, toujours sous try/catch : navigation privée, données bloquées ou effacées → pas de cache, rien d'autre. */
export function createIdbStore(): ThumbStore {
  let opened: Promise<IDBDatabase | null> | null = null;
  const open = () =>
    (opened ??= new Promise<IDBDatabase | null>((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "key" });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    }));
  const run = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> => {
    const db = await open();
    if (!db) return null;
    return new Promise<T | null>((resolve) => {
      try {
        const req = fn(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  };
  return {
    async get(key) {
      const row = await run<{ blob: Blob } | undefined>("readonly", (s) => s.get(key));
      return row?.blob instanceof Blob ? row.blob : null;
    },
    async put(key, blob) {
      await run("readwrite", (s) => s.put({ key, blob, at: Date.now() }));
      // Élagage : au-delà de MAX_STORED, on retire les plus anciennes.
      const all = await run<{ key: string; at: number }[]>("readonly", (s) => s.getAll() as IDBRequest<{ key: string; at: number }[]>);
      if (all && all.length > MAX_STORED) {
        const old = [...all].sort((a, b) => a.at - b.at).slice(0, all.length - MAX_STORED);
        for (const o of old) await run("readwrite", (s) => s.delete(o.key));
      }
    },
  };
}

// --- Service -----------------------------------------------------------------------------------------

export interface ThumbJob {
  day: number;
  /** Thème forcé (jamais pour les archives : un jour a son thème). */
  theme?: ThemeName | null;
  /** Circuit déjà construit (le jeu a le sien : inutile de le générer une seconde fois). */
  circuit?: ThumbnailCircuit;
}

export interface ThumbStats {
  /** Images servies par la mémoire, par IndexedDB, et fabriquées. */
  memoryHits: number;
  storeHits: number;
  made: number;
  /** Durées de la dernière fabrication de chaque image (ms) : génération (fil de travail), rendu, encodage. */
  generateMs: number[];
  renderMs: number[];
  encodeMs: number[];
  /** Octets des images fabriquées. */
  bytes: number;
  /** Rendus lancés alors que `canRun` était faux : doit rester 0 (le test de navigateur le vérifie). */
  ranWhileBlocked: number;
  /** Circuits générés sur le fil principal (repli sans fil de travail) : doit rester 0 là où les fils de travail existent. */
  mainThreadGenerations: number;
}

export interface ThumbDeps {
  /** Vrai quand on peut travailler : faux pendant une course. */
  canRun: () => boolean;
  /** Génère un circuit (fil de travail). */
  make?: CircuitMaker;
  store?: ThumbStore | null;
  /** Rend une miniature en image (canvas → blob), avec la durée du rendu et celle de l'encodage (ms). */
  draw?: (circuit: ThumbnailCircuit, scale: number) => Promise<{ blob: Blob; renderMs: number; encodeMs: number } | null>;
  toUrl?: (blob: Blob) => string;
  /** Laisse respirer l'interface entre deux images. */
  idle?: () => Promise<void>;
  /** Attente quand `canRun` est faux (ms). */
  retryMs?: number;
  scale?: number;
  now?: () => number;
  /** Appelé quand plus rien n'est à faire un moment : libère la mémoire graphique. */
  onSettled?: () => void;
}

interface Pending {
  key: string;
  job: ThumbJob;
  wanted: Set<() => boolean>;
  resolvers: ((url: string | null) => void)[];
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Une tâche à la fois, au repos du navigateur si possible. */
export function idleSlice(): Promise<void> {
  return new Promise((resolve) => {
    const ric = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (ric) ric(() => resolve(), { timeout: 300 });
    else setTimeout(resolve, 40);
  });
}

export function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      // WebP si le navigateur sait l'écrire (sinon il rend du PNG de lui-même).
      canvas.toBlob((b) => resolve(b), "image/webp", 0.85);
    } catch {
      resolve(null);
    }
  });
}

export class ThumbnailService {
  readonly stats: ThumbStats = { memoryHits: 0, storeHits: 0, made: 0, generateMs: [], renderMs: [], encodeMs: [], bytes: 0, ranWhileBlocked: 0, mainThreadGenerations: 0 };
  private readonly memory = new Map<string, string>();
  private readonly inflight = new Map<string, Pending>();
  private readonly queue: Pending[] = [];
  private running = false;
  private readonly scale: number;
  private readonly deps: Required<Pick<ThumbDeps, "canRun" | "idle" | "retryMs" | "now" | "toUrl">> & ThumbDeps;

  constructor(deps: ThumbDeps) {
    this.scale = deps.scale ?? 1;
    this.deps = { idle: idleSlice, retryMs: 400, now: () => performance.now(), toUrl: (b) => URL.createObjectURL(b), ...deps };
  }

  keyOf(job: ThumbJob): string {
    return thumbKey(job.day, job.theme ?? null, this.scale);
  }

  /** Adresse de l'image si elle est déjà en mémoire (aucune attente) : pour qu'une liste redessinée ne clignote pas. */
  peek(job: ThumbJob): string | null {
    return this.memory.get(this.keyOf(job)) ?? null;
  }

  /** Images en attente de fabrication. */
  get pending(): number {
    return this.queue.length + (this.running ? 1 : 0);
  }

  /**
   * L'image d'un jour (adresse utilisable dans `<img>`), ou `null` si on ne peut pas la faire (ou si plus personne ne la veut).
   * `wanted` dit si la demande est encore utile (la ligne est toujours à l'écran) : sinon la fabrication est sautée.
   */
  async request(job: ThumbJob, wanted: () => boolean = () => true): Promise<string | null> {
    const key = this.keyOf(job);
    const hit = this.memory.get(key);
    if (hit) {
      this.stats.memoryHits++;
      return hit;
    }
    const live = this.inflight.get(key);
    if (live) {
      live.wanted.add(wanted);
      return new Promise((resolve) => live.resolvers.push(resolve));
    }
    const entry: Pending = { key, job, wanted: new Set([wanted]), resolvers: [] };
    this.inflight.set(key, entry);
    const done = new Promise<string | null>((resolve) => entry.resolvers.push(resolve));
    void this.fetch(entry);
    return done;
  }

  /** Abandonne ce qui n'a pas commencé (panneau fermé). */
  clearQueue() {
    for (const e of this.queue.splice(0)) this.finish(e, null);
  }

  private finish(entry: Pending, url: string | null) {
    this.inflight.delete(entry.key);
    for (const r of entry.resolvers) r(url);
  }

  private async fetch(entry: Pending) {
    // 1. IndexedDB : une image déjà faite (une autre séance) coûte une lecture, pas un rendu.
    try {
      const blob = (await this.deps.store?.get(entry.key)) ?? null;
      if (blob) {
        const url = this.deps.toUrl(blob);
        this.memory.set(entry.key, url);
        this.stats.storeHits++;
        this.finish(entry, url);
        return;
      }
    } catch {
      // pas de cache : on fabrique
    }
    // 2. Sinon, file d'attente : une image à la fois.
    this.queue.push(entry);
    void this.pump();
  }

  private isWanted(e: Pending): boolean {
    for (const w of e.wanted) if (w()) return true;
    return false;
  }

  /**
   * Attend qu'on puisse travailler (pas de course en cours), puis un moment de calme. Faux si, entre-temps, plus personne ne
   * veut l'image (panneau fermé, ligne sortie de l'écran) : inutile de patienter pour rien pendant toute une course.
   */
  private async gate(entry: Pending): Promise<boolean> {
    const wait = async () => {
      while (!this.deps.canRun()) {
        if (!this.isWanted(entry)) return;
        await sleep(this.deps.retryMs);
      }
    };
    await wait();
    await this.deps.idle();
    await wait();
    return this.isWanted(entry) && this.deps.canRun();
  }

  private async pump() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.queue.length) {
        const entry = this.queue.shift()!;
        if (!this.isWanted(entry) || !(await this.gate(entry))) {
          this.finish(entry, null);
          continue;
        }
        this.finish(entry, await this.make(entry));
      }
    } finally {
      this.running = false;
    }
    this.deps.onSettled?.();
  }

  private async make(entry: Pending): Promise<string | null> {
    const { now } = this.deps;
    try {
      const t0 = now();
      const circuit = entry.job.circuit ?? (await this.deps.make?.(entry.job.day, entry.job.theme ?? null)) ?? null;
      if (!circuit) return null;
      const t1 = now();
      if (!(await this.gate(entry))) return null; // le fil de travail a pu être long : une course a peut-être commencé
      if (!this.deps.canRun()) this.stats.ranWhileBlocked++;
      const drawn = await this.deps.draw?.(circuit, this.scale);
      if (!drawn) return null;
      const { blob } = drawn;
      const url = this.deps.toUrl(blob);
      this.memory.set(entry.key, url);
      this.stats.made++;
      this.stats.bytes += blob.size;
      this.stats.generateMs.push(Math.round(t1 - t0));
      this.stats.renderMs.push(Math.round(drawn.renderMs));
      this.stats.encodeMs.push(Math.round(drawn.encodeMs));
      void this.deps.store?.put(entry.key, blob).catch(() => {});
      return url;
    } catch {
      return null;
    }
  }
}

/** Le service du jeu : fil de travail pour la génération, rendu partagé, IndexedDB, mémoire graphique rendue au repos. */
export function createThumbnailService(canRun: () => boolean, dpr = typeof devicePixelRatio === "number" ? devicePixelRatio : 1, options: ThumbnailOptions = {}): ThumbnailService {
  let release: ReturnType<typeof setTimeout> | undefined;
  const service: ThumbnailService = new ThumbnailService({
    canRun,
    scale: thumbScale(dpr),
    make: createCircuitMaker(() => service.stats.mainThreadGenerations++),
    store: typeof indexedDB === "undefined" ? null : createIdbStore(),
    draw: async (circuit, scale) => {
      const t0 = performance.now();
      const canvas = renderThumbnail(circuit, { width: THUMB_W, height: THUMB_H, scale, ...options });
      const t1 = performance.now();
      const blob = await canvasBlob(canvas);
      return blob ? { blob, renderMs: t1 - t0, encodeMs: performance.now() - t1 } : null;
    },
    onSettled() {
      // Plus rien à faire : on garde le moteur de rendu quelques secondes (on rouvre vite les archives), puis on le libère.
      clearTimeout(release);
      release = setTimeout(() => {
        if (service.pending === 0) releaseThumbnailRenderer();
      }, 4000);
    },
  });
  return service;
}
