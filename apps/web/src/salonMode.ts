import { THEMES, salonSessionAt, salonSessionEnd } from "@cdj/sim";
import { DEMO_BASE, apiBase, type ApiResult } from "./api";
import { copyText } from "./clipboard";
import { getName, getPlayerId } from "./identity";
import {
  BOARD_POLL_MS,
  NOW_POLL_MS,
  PODIUM_MS,
  SalonClock,
  countdownText,
  nextSalonGhostMode,
  overtakenBy,
  pickGhostRefs,
  salonShareLine,
  sessionClock,
  sessionLabel,
  sessionMsFromParams,
  submitOpen,
  SALON_GHOST_LABEL,
  type SalonGhostMode,
} from "./salon";
import { HttpSalonApi, type SalonApi, type SalonBoard, type SalonGhost, type SalonSubmitResult } from "./salonApi";
import { DemoSalonApi } from "./salonDemo";
import { createSalonEngine, type LoadedSalonCircuit, type SalonEngine } from "./salonEngine";
import type { GhostEntry } from "./salonGhosts";
import { renderPodium, renderSalonBoard } from "./salonUi";

// Le Salon, côté jeu (lot 26) : tout ce qui vit autour de la course — horloge, déroulé d'une session (compte à rebours, dernier essai,
// fin, podium, circuit suivant), classement, fantômes à charger, envoi des courses. Le moteur de jeu (`main.ts`) fournit un `SalonHost`
// pour ce qui le concerne (changer de scène, savoir si une course est en cours). Rien ici ne touche à la simulation, aux records ni au
// classement du circuit du jour.

export type SalonState = "playing" | "overrun" | "podium" | "switching";

export interface SalonHost {
  /** Remplace le circuit (nouvelle scène) et repart d'un décompte. */
  swapCircuit(c: LoadedSalonCircuit): void;
  /** Construit à l'avance la scène du circuit suivant (pendant le podium : l'écran ne bouge pas, la bascule sera instantanée). */
  prebuild(c: LoadedSalonCircuit): void;
  /** Une course est en cours (hors décompte et hors arrivée). */
  isRacing(): boolean;
  /** Abandonne la course en cours (plus de temps : l'envoi serait refusé). */
  abortRun(): void;
  banner(text: string, seconds: number, small?: boolean): void;
  flash(): void;
  /** Les fantômes du prochain départ ont changé. */
  ghostsChanged(entries: GhostEntry[]): void;
}

export interface SalonDom {
  /** Ligne du compte à rebours. */
  countdown: HTMLElement;
  board: HTMLElement;
  podium: HTMLElement;
}

export interface SalonRunResult {
  session: number;
  ms: number;
  splits: number[];
  respawns: number;
  replay: string;
}

export interface SalonBootError {
  error: string;
}

export interface SalonOptions {
  search: string;
  /** Adresse de l'API (`demo` ou une URL). */
  base: string;
  /** Heure de départ imposée (essais, avec `?debug&salonAt=`). */
  startAt?: number | null;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T | null> => Promise.race([p, sleep(ms).then(() => null)]);

export class SalonController {
  readonly demo: boolean;
  readonly playerId = getPlayerId();
  readonly clock: SalonClock;
  readonly sessionMs: number;
  state: SalonState = "playing";
  session: number;
  circuit: LoadedSalonCircuit;
  board: SalonBoard | null = null;
  /** Ton meilleur tour de la session (en mémoire : le Salon ne touche pas aux records). */
  best: { ms: number; replay: string; splits: number[] } | null = null;
  ghostMode: SalonGhostMode = "all";
  players = 0;
  lastError = "";
  /** Compteurs de contrôle (`__cdj.salon`). */
  readonly stats = { mainThreadGenerations: 0, swaps: 0, boardPolls: 0, submits: 0, prefetched: 0, overtaken: 0 };
  host: SalonHost | null = null;
  dom: SalonDom | null = null;
  boardOpen = false;

  private readonly circuits = new Map<number, Promise<LoadedSalonCircuit | null>>();
  private readonly ghostCache = new Map<string, SalonGhost>();
  private readonly inflight = new Set<Promise<unknown>>();
  private ghostSignature = "";
  private lastBoardPoll = -1e9;
  private lastNowPoll = -1e9;
  private lastCountdown = "";
  private polling = false;
  private podiumAt = 0;
  private settleAt = 0;
  private podiumShown = -1;
  private retryAt = 0;

  constructor(
    readonly api: SalonApi,
    readonly engine: SalonEngine,
    clock: SalonClock,
    sessionMs: number,
    circuit: LoadedSalonCircuit,
    demo: boolean,
  ) {
    this.clock = clock;
    this.sessionMs = sessionMs;
    this.circuit = circuit;
    this.session = circuit.session;
    this.demo = demo;
    this.circuits.set(circuit.session, Promise.resolve(circuit));
  }

  /** Circuit d'une session (mis en cache : le jeu, la démonstration et la préparation d'avance partagent le même). */
  circuitFor(session: number): Promise<LoadedSalonCircuit | null> {
    let p = this.circuits.get(session);
    if (!p) {
      p = this.engine.circuit(session);
      this.circuits.set(session, p);
      while (this.circuits.size > 4) this.circuits.delete(Math.min(...this.circuits.keys()));
    }
    return p;
  }

  get label(): string {
    return sessionLabel(this.session, this.sessionMs);
  }

  title(): string {
    return `Salon ${this.label} · ${THEMES[this.circuit.theme].label}`;
  }

  /** Place de ta meilleure course dans la dernière version du classement. */
  get myRank(): { rank: number; participants: number } | null {
    return this.board?.me ? { rank: this.board.me.rank, participants: this.board.participants } : null;
  }

  shareLine(): string | null {
    if (!this.best) return null;
    const r = this.myRank;
    return salonShareLine(this.label, this.best.ms, r?.rank, r?.participants);
  }

  // --- Déroulé ---------------------------------------------------------------------------------------------------------

  /** À appeler à chaque image : met à jour le compte à rebours et fait avancer le déroulé de la session. */
  tick(): void {
    const now = this.clock.now();
    const perf = performance.now();
    const c = sessionClock(now, this.session, this.sessionMs);

    if (this.state === "playing" || this.state === "overrun") {
      // Compte à rebours et bandeau « dernier essai ».
      const text = `⏱ ${countdownText(c.remainingMs)}${c.lastTry ? " · DERNIER ESSAI" : ""}${c.ended ? " · fin de session" : ""} · ${this.players} joueur${this.players > 1 ? "s" : ""}`;
      if (text !== this.lastCountdown && this.dom) {
        this.lastCountdown = text;
        this.dom.countdown.textContent = text;
        this.dom.countdown.classList.toggle("last", c.lastTry || c.ended);
      }
      if (c.preparing && !this.circuits.has(this.session + 1)) {
        this.stats.prefetched++;
        void this.circuitFor(this.session + 1); // la bascule n'attendra pas le générateur
      }
      if (perf - this.lastBoardPoll >= BOARD_POLL_MS) void this.refreshBoard();
      if (!this.demo && perf - this.lastNowPoll >= NOW_POLL_MS) void this.syncNow();
    }

    if (this.state === "playing" && c.ended) {
      if (this.host?.isRacing() && !c.closed) {
        this.state = "overrun";
        this.settleAt = 0;
        this.host.banner("Fin de session : termine ton tour", 4, true);
      } else {
        void this.startPodium();
      }
    } else if (this.state === "overrun") {
      if (this.host?.isRacing()) {
        if (c.closed) {
          this.host.abortRun(); // plus d'envoi accepté : on ne laisse pas courir pour rien
          void this.startPodium();
        }
      } else {
        // La course est finie (ou abandonnée) : on laisse voir le résultat un instant, puis le podium.
        if (this.settleAt === 0) this.settleAt = perf + 2500;
        if (perf >= this.settleAt) void this.startPodium();
      }
    } else if (this.state === "podium") {
      const left = (this.podiumAt + PODIUM_MS - perf) / 1000;
      const shown = Math.max(0, Math.ceil(left));
      if (shown !== this.podiumShown) this.drawPodium(left);
      if (left <= 0 && perf >= this.retryAt) void this.swapToCurrent();
    }
  }

  private async syncNow(): Promise<void> {
    this.lastNowPoll = performance.now();
    const t0 = Date.now();
    const r = await this.api.now(this.playerId);
    if (r.ok) {
      this.clock.sync(r.data.serverMs, t0, Date.now());
      this.players = r.data.players;
    }
  }

  async refreshBoard(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    this.lastBoardPoll = performance.now();
    this.stats.boardPolls++;
    try {
      const session = this.session;
      const r = await this.api.board(session, this.playerId, this.board?.version);
      if (session !== this.session) return;
      if (!r.ok) {
        this.lastError = r.message;
        if (!this.board) this.renderBoard();
        return;
      }
      this.lastError = "";
      this.players = r.data.players;
      if (r.data.unchanged && this.board) {
        this.board = { ...this.board, players: r.data.players, participants: r.data.participants };
        if (this.boardOpen) this.renderBoard();
        return;
      }
      const before = this.board;
      this.board = r.data;
      const by = overtakenBy(before, r.data);
      if (by) {
        this.stats.overtaken++;
        this.host?.banner(`${by} t'a dépassé`, 1.8, true);
        this.host?.flash();
      }
      this.renderBoard();
      await this.refreshGhosts();
    } finally {
      this.polling = false;
    }
  }

  renderBoard(): void {
    if (this.dom) renderSalonBoard(this.dom.board, this.board, this.label);
    if (this.dom && this.lastError && !this.board) this.dom.board.append(Object.assign(document.createElement("div"), { className: "error", textContent: this.lastError }));
  }

  /** Charge les fantômes utiles (trois premiers, devant, derrière) et prévient le jeu quand l'ensemble change. */
  async refreshGhosts(): Promise<void> {
    const board = this.board;
    if (!board) return;
    const session = this.session;
    const picks = pickGhostRefs(board);
    const wanted = picks.map((r) => ({ key: `${r.ref}:${r.ms}`, ref: r.ref, rank: r.rank as number | null }));
    // Toi : si tu as déjà un temps sur le serveur mais pas en mémoire (page rechargée), ton tour vient du serveur.
    if (!this.best && board.me) wanted.push({ key: `${board.me.ref}:${board.me.ms}`, ref: board.me.ref, rank: null });
    const missing = wanted.filter((w) => !this.ghostCache.has(w.key)).map((w) => w.ref);
    if (missing.length > 0) {
      const g = await this.api.ghosts(session, missing);
      if (session !== this.session) return;
      if (g.ok) for (const gh of g.data.ghosts) this.ghostCache.set(`${gh.ref}:${gh.ms}`, gh);
    }
    const entries: GhostEntry[] = [];
    for (const w of wanted) {
      const gh = this.ghostCache.get(w.key);
      if (gh) entries.push({ key: w.key, rank: w.rank, name: w.rank === null ? "Toi" : gh.name, ms: gh.ms, replay: gh.replay });
    }
    this.pushGhosts(entries);
  }

  private pushGhosts(others: GhostEntry[]): void {
    const entries = [...others];
    if (this.best) entries.push({ key: `mine:${this.best.ms}`, rank: null, name: "Toi", ms: this.best.ms, replay: this.best.replay });
    const signature = entries.map((e) => e.key).join("|");
    if (signature === this.ghostSignature) return;
    this.ghostSignature = signature;
    this.host?.ghostsChanged(entries);
  }

  /** Branche le moteur de jeu ; les fantômes déjà chargés au démarrage (avant que le jeu n'existe) lui sont remis. */
  attachHost(host: SalonHost): void {
    this.host = host;
    this.ghostSignature = "";
    void this.refreshGhosts();
  }

  cycleGhostMode(): SalonGhostMode {
    this.ghostMode = nextSalonGhostMode(this.ghostMode);
    this.host?.banner(SALON_GHOST_LABEL[this.ghostMode], 1.4, true);
    return this.ghostMode;
  }

  // --- Courses ---------------------------------------------------------------------------------------------------------

  /** Ta course est finie : est-ce ton meilleur tour de la session ? (le premier temps l'est toujours) */
  recordRun(r: SalonRunResult): boolean {
    if (this.best && r.ms >= this.best.ms) return false;
    this.best = { ms: r.ms, replay: r.replay, splits: r.splits };
    this.ghostSignature = ""; // ton tour change : le prochain départ le prend
    void this.refreshGhosts();
    return true;
  }

  /** Une course de plus peut-elle encore être envoyée à cette session ? */
  canSubmit(session: number): boolean {
    return session === this.session && submitOpen(this.clock.now(), session, this.sessionMs);
  }

  /** Envoie la course ; le serveur la rejoue et répond avec SON temps et ta place. */
  submit(r: SalonRunResult, name: string): Promise<ApiResult<SalonSubmitResult>> {
    this.stats.submits++;
    const p = this.api.submit(r.session, this.playerId, name, r.replay).then((res) => {
      if (res.ok && r.session === this.session) {
        this.board = res.data.board;
        this.players = res.data.board.players;
        this.renderBoard();
        if (res.data.improved) this.host?.flash();
        void this.refreshGhosts();
      }
      return res;
    });
    this.inflight.add(p);
    void p.finally(() => this.inflight.delete(p));
    return p;
  }

  // --- Podium et bascule -----------------------------------------------------------------------------------------------

  private async startPodium(): Promise<void> {
    if (this.state === "podium" || this.state === "switching") return;
    this.state = "podium";
    this.podiumAt = performance.now() + 600; // le temps de récupérer le classement final
    this.retryAt = 0;
    this.podiumShown = -1;
    if (this.dom) this.dom.podium.hidden = false;
    document.body.classList.add("podium");
    this.drawPodium(PODIUM_MS / 1000);
    // Le circuit suivant est déjà généré : sa scène se construit maintenant, derrière le podium (une courte saccade que personne ne voit).
    void this.circuitFor(salonSessionAt(this.clock.now(), this.sessionMs)).then((c) => {
      if (c && this.state === "podium") setTimeout(() => this.state === "podium" && this.host?.prebuild(c), 250);
    });
    // Un envoi encore en route (course finie après la fin) compte dans le podium : on l'attend un instant.
    if (this.inflight.size > 0) await withTimeout(Promise.allSettled([...this.inflight]), 3000);
    const r = await withTimeout(this.api.board(this.session, this.playerId), 2500);
    if (r?.ok) this.board = r.data;
    this.podiumAt = performance.now();
    this.drawPodium(PODIUM_MS / 1000);
  }

  private drawPodium(secondsLeft: number): void {
    if (!this.dom) return;
    this.podiumShown = Math.max(0, Math.ceil(secondsLeft));
    const mine = this.board?.me && this.best ? { ms: this.board.me.ms, rank: this.board.me.rank, participants: this.board.participants } : null;
    const line = mine ? salonShareLine(this.label, mine.ms, mine.rank, mine.participants) : null;
    renderPodium(this.dom.podium, {
      label: this.label,
      board: this.board,
      mine,
      shareLine: line,
      secondsLeft,
      onCopy: line ? async (b) => {
        const label = b.textContent;
        b.textContent = (await copyText(`${line}\n${location.origin}${location.pathname}?mode=salon`)) ? "Copié ✓" : "Copie impossible";
        setTimeout(() => (b.textContent = label), 1600);
      } : undefined,
    });
  }

  /** Bascule vers la session en cours : circuit préparé d'avance, nouvelle scène, classement de la nouvelle session. */
  private async swapToCurrent(): Promise<void> {
    if (this.state !== "podium") return;
    this.state = "switching";
    const target = salonSessionAt(this.clock.now(), this.sessionMs);
    const circuit = await this.circuitFor(target);
    if (!circuit) {
      this.circuits.delete(target);
      this.state = "podium";
      this.retryAt = performance.now() + 3000;
      this.host?.banner("Circuit indisponible, nouvel essai…", 2.5, true);
      return;
    }
    this.session = target;
    this.circuit = circuit;
    this.best = null;
    this.board = null;
    this.ghostCache.clear();
    this.ghostSignature = "";
    this.lastCountdown = "";
    this.stats.swaps++;
    if (this.dom) this.dom.podium.hidden = true;
    document.body.classList.remove("podium");
    this.state = "playing";
    this.host?.swapCircuit(circuit);
    this.renderBoard();
    this.lastBoardPoll = -1e9; // classement de la nouvelle session tout de suite
    void this.circuitFor(target + 1); // et la suivante se prépare déjà (le fil de travail s'en occupe)
  }

  /** Fin de la session en cours (ms UTC). */
  get endMs(): number {
    return salonSessionEnd(this.session, this.sessionMs);
  }
}

/**
 * Démarre le Salon : horloge (recalée sur le serveur, ou locale en démo), circuit de la session en cours (fil de travail), premier
 * classement. Renvoie une erreur lisible si le Salon n'est pas joignable : le jeu retombe alors sur le circuit du jour.
 */
export async function bootSalon(opts: SalonOptions): Promise<SalonController | SalonBootError> {
  const demo = opts.base === DEMO_BASE;
  const clock = new SalonClock();
  let sessionMs = sessionMsFromParams(opts.search);
  let controller: SalonController | null = null;
  const engine = createSalonEngine(() => {
    if (controller) controller.stats.mainThreadGenerations++;
    else bootGenerations++;
  });
  let bootGenerations = 0;
  let api: SalonApi;
  if (demo) {
    if (opts.startAt) clock.set(opts.startAt);
    const cache = new Map<number, Promise<LoadedSalonCircuit | null>>();
    api = new DemoSalonApi({
      clock,
      sessionMs,
      engine,
      // Le circuit d'une session se génère une seule fois ; le contrôleur et la démonstration partagent le même cache.
      circuit: (s) => (controller ? controller.circuitFor(s) : (cache.get(s) ?? cache.set(s, engine.circuit(s)).get(s)!)),
    });
  } else {
    api = new HttpSalonApi(opts.base);
    const t0 = Date.now();
    const r = await api.now(getPlayerId());
    if (!r.ok) return { error: r.status === 404 ? "Le Salon a besoin du serveur (cette API n'a pas de Salon)" : `Salon injoignable : ${r.message}` };
    clock.sync(r.data.serverMs, t0, Date.now());
    sessionMs = r.data.endMs - r.data.startMs; // la durée vient du serveur : on ne triche pas sur le nombre de minutes
  }
  const session = salonSessionAt(clock.now(), sessionMs);
  const circuit = await engine.circuit(session);
  if (!circuit) return { error: "Le circuit de cette session n'a pas pu être préparé" };
  controller = new SalonController(api, engine, clock, sessionMs, circuit, demo);
  controller.stats.mainThreadGenerations = bootGenerations;
  // Premier classement et premiers fantômes avant le départ (2,5 s au plus : le Salon démarre même si le serveur traîne).
  await withTimeout(controller.refreshBoard(), 2500);
  return controller;
}

/** Adresse du Salon pour le mode demandé, ou `null` si le jeu n'a pas d'API (le Salon a besoin du serveur). */
export const salonBase = (): string | null => apiBase();

export const isBootError = (r: SalonController | SalonBootError): r is SalonBootError => "error" in r;

/** Pseudo à utiliser pour l'envoi, ou `null` s'il faut le demander. */
export const salonName = (): string | null => getName();
