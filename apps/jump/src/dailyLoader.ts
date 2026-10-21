import type { DailyLevel, JumpThemeName } from "@cdj/jump-sim";
import { dailyLevelId, jumpThemeForDay } from "@cdj/jump-sim";
import { formatDay } from "@cdj/core";
import { dropCache, readCache, writeCache } from "./dailyCache";
import { thawLevel } from "./frozen";
import { fromPayload, generatePayload, isPayload, type DailyPayload } from "./dailyWork";
import type { KeyValue } from "./memory";
import type { WorkerReply, WorkerRequest } from "./dailyWorker";

// Chargement du niveau du jour (lot 7b), **le seul point d'appel** de `main.ts`. Ordre :
//   0. (lot 10) un **niveau figé** (`levels/AAAA-MM-JJ.json`, seulement pour une date de la liste écrite à la construction) : le fichier est lu
//      et **sa preuve rejouée** (`thawLevel`) ; refusé (ou absent, illisible), on continue comme avant ;
//   1. le cache (`jump:niveau:<id>`) : la charge est lue puis **sa preuve rejouée** (quelques ms) ; si elle échoue, le niveau est régénéré ;
//   2. un worker de module (`dailyWorker.ts`) : la génération (≈ 140 ms, 230 au pire sous Node, ×4 sur téléphone) quitte le fil principal,
//      qui affiche « Préparation du niveau… » ;
//   3. à défaut de worker (indisponible, script non chargé, erreur, délai dépassé) : la génération sur le fil principal, comme avant le 7b.
// Lot 11 : un **thème forcé** (`options.theme` différent de celui de la date : un essai, identifiant `…-t<thème>`) ne lit jamais un niveau figé
// (les fichiers de `public/levels/` sont ceux des thèmes naturels) ; le cache le range sous son identifiant, le worker le génère.
// Le résultat est gardé dans le cache. Rien ici ne touche à la simulation : le niveau est celui de `dailyLevel`, à l'empreinte près.

/** D'où vient le niveau chargé (`fige` : un niveau figé, lot 10). */
export type DailySource = "fige" | "cache" | "worker" | "principal";

export interface DailyLoad {
  level: DailyLevel;
  source: DailySource;
  /** Vrai si un calcul de génération a eu lieu pendant ce chargement (worker ou fil principal). */
  generated: boolean;
  /** Pourquoi on a dû régénérer malgré un cache (preuve refusée, autre version…), sinon "". */
  cacheMiss: string;
  /** Lot 10 : pourquoi un niveau figé annoncé pour cette date a été refusé (fichier absent, autre physique, preuve…), sinon "". */
  frozenMiss: string;
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
  /** Lot 10 : les dates figées (AAAA-MM-JJ) et la lecture d'un fichier (rend son contenu JSON, ou null s'il n'existe pas). */
  frozen?: { days: readonly string[]; read(date: string): Promise<unknown> } | undefined;
  /** Lot 11 : un thème imposé par l'adresse. Le thème de la date (ou absent) : le niveau ordinaire ; un autre : un essai. */
  theme?: JumpThemeName | null;
}

export const WORKER_TIMEOUT_MS = 20_000;

/** Demande la charge au worker ; rejette si le worker échoue ou ne répond pas. */
function viaWorker(worker: WorkerLike, day: number, timeoutMs: number, theme: JumpThemeName | null): Promise<DailyPayload> {
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
    worker.postMessage({ day, theme });
  });
}

/** Le niveau d'une date : cache vérifié, sinon worker, sinon fil principal. Ne lève pas à cause du stockage ni du worker. */
export async function loadDaily(day: number, options: LoaderOptions): Promise<DailyLoad> {
  const now = options.now ?? (() => performance.now());
  const t0 = now();
  // Lot 11 : `forced` = un thème imposé qui n'est pas celui de la date (un essai) ; null sinon.
  const forced = options.theme && options.theme !== jumpThemeForDay(day) ? options.theme : null;
  const id = dailyLevelId(day, forced);
  let blocked = 0;
  let cacheMiss = "";
  let frozenMiss = "";

  // 0. Un niveau figé : le niveau tel qu'il a été joué, sa preuve rejouée avant d'accepter quoi que ce soit (lot 10).
  const date = formatDay(day);
  if (forced === null && options.frozen?.days.includes(date)) {
    let raw: unknown = null;
    try {
      raw = await options.frozen.read(date);
    } catch {
      raw = null;
    }
    if (raw === null) frozenMiss = "fichier absent";
    else {
      const t = now();
      const level = thawLevel(raw, day);
      blocked += now() - t;
      if (typeof level !== "string") return { level, source: "fige", generated: false, cacheMiss, frozenMiss, totalMs: now() - t0, blockedMs: blocked };
      frozenMiss = level;
    }
  }

  // 1. Le cache : la preuve est rejouée avant d'accepter quoi que ce soit.
  const cached = readCache(options.store, id, options.today);
  if (cached) {
    const t = now();
    const level = fromPayload(cached, day, { proof: true, theme: forced });
    blocked += now() - t;
    if (typeof level !== "string") return { level, source: "cache", generated: false, cacheMiss, frozenMiss, totalMs: now() - t0, blockedMs: blocked };
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
        payload = await viaWorker(worker, day, options.workerTimeoutMs ?? WORKER_TIMEOUT_MS, forced);
      } catch {
        payload = null;
      }
    }
    // 3. Repli : sur le fil principal, après avoir laissé la page dessiner son message.
    if (!payload) {
      source = "principal";
      await options.yieldToPaint?.();
      const t = now();
      payload = generatePayload(day, forced);
      blocked += now() - t;
    }
    const t = now();
    const level = fromPayload(payload, day, { proof: false, theme: forced });
    blocked += now() - t;
    if (typeof level === "string") throw new Error(`niveau du jour invalide : ${level}`);
    writeCache(options.store, payload, options.today);
    return { level, source, generated: true, cacheMiss, frozenMiss, totalMs: now() - t0, blockedMs: blocked };
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

/** Lot 10 : lit le fichier figé d'une date (`levels/AAAA-MM-JJ.json`, à côté de la page) ; null s'il manque, n'est pas du JSON ou tarde. */
export async function browserFrozen(date: string): Promise<unknown> {
  const ctrl = typeof AbortController === "function" ? new AbortController() : null;
  const timer = setTimeout(() => ctrl?.abort(), 8000);
  try {
    const r = await fetch(new URL(`levels/${date}.json`, document.baseURI), { signal: ctrl?.signal, cache: "no-cache" });
    if (!r.ok) return null;
    return (await r.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** « Préparation du niveau… » : un message centré, créé à la demande, retiré dès que le niveau est prêt (lot I5 : le texte vient du catalogue, l'habillage de hud.css). */
export function progressMessage(doc: Document, texte: string): (on: boolean) => void {
  let el: HTMLElement | null = null;
  return (on) => {
    if (on && !el) {
      el = doc.createElement("div");
      el.id = "prep";
      el.setAttribute("role", "status");
      el.textContent = texte;
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
