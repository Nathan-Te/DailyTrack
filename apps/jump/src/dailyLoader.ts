import type { DailyLevel } from "@cdj/jump-sim";
import { dailyLevelId } from "@cdj/jump-sim";
import { dropCache, readCache, writeCache } from "./dailyCache";
import { fromPayload, generatePayload, isPayload, type DailyPayload } from "./dailyWork";
import type { KeyValue } from "./memory";
import type { WorkerReply, WorkerRequest } from "./dailyWorker";

// Chargement du niveau du jour (lot 7b), **le seul point d'appel** de `main.ts`. Ordre :
//   1. le cache (`jump:niveau:<id>`) : la charge est lue puis **sa preuve rejouée** (quelques ms) ; si elle échoue, le niveau est régénéré ;
//   2. un worker de module (`dailyWorker.ts`) : la génération (≈ 140 ms, 230 au pire sous Node, ×4 sur téléphone) quitte le fil principal,
//      qui affiche « Préparation du niveau… » ;
//   3. à défaut de worker (indisponible, script non chargé, erreur, délai dépassé) : la génération sur le fil principal, comme avant le 7b.
// Le résultat est gardé dans le cache. Rien ici ne touche à la simulation : le niveau est celui de `dailyLevel`, à l'empreinte près.

/** D'où vient le niveau chargé. */
export type DailySource = "cache" | "worker" | "principal";

export interface DailyLoad {
  level: DailyLevel;
  source: DailySource;
  /** Vrai si un calcul de génération a eu lieu pendant ce chargement (worker ou fil principal). */
  generated: boolean;
  /** Pourquoi on a dû régénérer malgré un cache (preuve refusée, autre version…), sinon "". */
  cacheMiss: string;
  /** Durée totale du chargement (ms) et temps pendant lequel le **fil principal** a travaillé (génération en repli, sinon rejeu de la preuve et reconstruction). */
  totalMs: number;
  blockedMs: number;
}

/** Un worker vu de loin (de quoi passer un faux dans les tests). */
export interface WorkerLike {
  postMessage(message: WorkerRequest): void;
  terminate(): void;
  onmessage: ((e: { data: WorkerReply }) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onmessageerror: ((e: unknown) => void) | null;
}

export interface LoaderOptions {
  store: KeyValue | null;
  /** Date de Paris du jour (AAAA-MM-JJ), pour la purge du cache. */
  today: string;
  /** Crée le worker ; null ou qui lève : repli sur le fil principal. */
  makeWorker?: (() => WorkerLike | null) | undefined;
  /** Montre (true) ou retire (false) « Préparation du niveau… » pendant la génération. */
  showProgress?: (on: boolean) => void;
  /** Laisse le navigateur dessiner avant un calcul long du fil principal. */
  yieldToPaint?: () => Promise<void>;
  /** Horloge (ms) ; `performance.now` par défaut. */
  now?: () => number;
  /** Délai au-delà duquel on abandonne le worker (ms). */
  workerTimeoutMs?: number;
}

export const WORKER_TIMEOUT_MS = 20_000;

/** Demande la charge au worker ; rejette si le worker échoue ou ne répond pas. */
function viaWorker(worker: WorkerLike, day: number, timeoutMs: number): Promise<DailyPayload> {
  return new Promise<DailyPayload>((resolve, reject) => {
    const timer = setTimeout(() => done(() => reject(new Error("le worker ne répond pas"))), timeoutMs);
    let over = false;
    const done = (f: () => void) => {
      if (over) return;
      over = true;
      clearTimeout(timer);
      worker.onmessage = worker.onerror = worker.onmessageerror = null;
      worker.terminate();
      f();
    };
    worker.onmessage = (e) => done(() => (e.data.ok && isPayload(e.data.payload) ? resolve(e.data.payload) : reject(new Error(e.data.ok ? "charge illisible" : e.data.error))));
    worker.onerror = () => done(() => reject(new Error("erreur du worker")));
    worker.onmessageerror = () => done(() => reject(new Error("message du worker illisible")));
    worker.postMessage({ day });
  });
}

/** Le niveau d'une date : cache vérifié, sinon worker, sinon fil principal. Ne lève pas à cause du stockage ni du worker. */
export async function loadDaily(day: number, options: LoaderOptions): Promise<DailyLoad> {
  const now = options.now ?? (() => performance.now());
  const t0 = now();
  const id = dailyLevelId(day);
  let blocked = 0;
  let cacheMiss = "";

  // 1. Le cache : la preuve est rejouée avant d'accepter quoi que ce soit.
  const cached = readCache(options.store, id, options.today);
  if (cached) {
    const t = now();
    const level = fromPayload(cached, day, { proof: true });
    blocked += now() - t;
    if (typeof level !== "string") return { level, source: "cache", generated: false, cacheMiss, totalMs: now() - t0, blockedMs: blocked };
    cacheMiss = level;
    dropCache(options.store, id);
  }

  // 2. Le worker.
  options.showProgress?.(true);
  try {
    let payload: DailyPayload | null = null;
    let source: DailySource = "worker";
    let worker: WorkerLike | null = null;
    try {
      worker = options.makeWorker?.() ?? null;
    } catch {
      worker = null;
    }
    if (worker) {
      try {
        payload = await viaWorker(worker, day, options.workerTimeoutMs ?? WORKER_TIMEOUT_MS);
      } catch {
        payload = null;
      }
    }
    // 3. Repli : sur le fil principal, après avoir laissé la page dessiner son message.
    if (!payload) {
      source = "principal";
      await options.yieldToPaint?.();
      const t = now();
      payload = generatePayload(day);
      blocked += now() - t;
    }
    const t = now();
    const level = fromPayload(payload, day, { proof: false });
    blocked += now() - t;
    if (typeof level === "string") throw new Error(`niveau du jour invalide : ${level}`);
    writeCache(options.store, payload, options.today);
    return { level, source, generated: true, cacheMiss, totalMs: now() - t0, blockedMs: blocked };
  } finally {
    options.showProgress?.(false);
  }
}

// ——— Le navigateur ———

/** Le worker de module du jeu (Vite le compile à part) ; null s'il n'existe pas dans ce navigateur. */
export function browserWorker(): WorkerLike | null {
  if (typeof Worker === "undefined") return null;
  return new Worker(new URL("./dailyWorker.ts", import.meta.url), { type: "module" }) as unknown as WorkerLike;
}

/** « Préparation du niveau… » : un message centré, créé à la demande, retiré dès que le niveau est prêt. */
export function progressMessage(doc: Document): (on: boolean) => void {
  let el: HTMLElement | null = null;
  return (on) => {
    if (on && !el) {
      el = doc.createElement("div");
      el.id = "prep";
      el.setAttribute("role", "status");
      el.textContent = "Préparation du niveau…";
      el.style.cssText =
        "position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:50;color:#fff;font:700 18px system-ui,sans-serif;background:#101820;pointer-events:none";
      doc.body.appendChild(el);
    } else if (!on && el) {
      el.remove();
      el = null;
    }
  };
}

/** Laisse une image se dessiner (le message doit être à l'écran avant un calcul qui bloque) ; un onglet caché n'en dessine pas : 100 ms au plus. */
export function yieldToPaint(): Promise<void> {
  return new Promise((resolve) => {
    let over = false;
    const go = () => {
      if (over) return;
      over = true;
      resolve();
    };
    setTimeout(go, 100);
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => setTimeout(go, 0));
  });
}
