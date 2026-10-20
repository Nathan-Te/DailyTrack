import { salonSessionAt, salonSessionEnd } from "@cdj/sim";
import { DEMO_BASE, apiBase, type ApiResult } from "./api";
import { copyText } from "./clipboard";
import { messageErreur, nomTheme, onLangue, t } from "./i18n";
import { getName, getPlayerId } from "./identity";
import {
  BOARD_POLL_MS,
  FINALE_POLL_MS,
  NOW_POLL_MS,
  PODIUM_MS,
  SUBMIT_GRACE_MS,
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
  ghostModeLabel,
  type SalonGhostMode,
} from "./salon";
import { HttpSalonApi, type SalonApi, type SalonBoard, type SalonGhost, type SalonSubmitResult } from "./salonApi";
import { DemoSalonApi } from "./salonDemo";
import { createSalonEngine, type LoadedSalonCircuit, type SalonEngine } from "./salonEngine";
import type { GhostEntry } from "./salonGhosts";
import type { BoardPanel } from "./boardPanel";
import { renderCountdown, renderPodium, renderSalonBoard, renderSalonBoardError } from "./salonUi";
import { watchHref } from "./watch";

// Le Salon, côté jeu (lot 26) : tout ce qui vit autour de la course — horloge, déroulé d'une session (compte à rebours, dernier essai,
// fin, podium, circuit suivant), classement, fantômes à charger, envoi des courses. Le moteur de jeu (`main.ts`) fournit un `SalonHost`
// pour ce qui le concerne (changer de scène, savoir si une course est en cours). Rien ici ne touche à la simulation, aux records ni au
// classement du circuit du jour.

/**
 * `playing` : la session roule (la finale en fait partie : `finaleOn`) ; `podium` : à l'heure pile le circuit suivant est installé et le
 * podium de la session finie s'affiche par-dessus (le jeu est gelé dessous, son décompte attend la fermeture du podium) ; `switching` :
 * le circuit suivant n'était pas prêt, on réessaie.
 */
export type SalonState = "playing" | "podium" | "switching";

export interface SalonHost {
  /** Remplace le circuit (nouvelle scène) et repart d'un décompte. */
  swapCircuit(c: LoadedSalonCircuit): void;
  /** Construit à l'avance la scène du circuit suivant (pendant le podium : l'écran ne bouge pas, la bascule sera instantanée). */
  prebuild(c: LoadedSalonCircuit): void;
  /** Une course est en cours (hors décompte et hors arrivée). */
  isRacing(): boolean;
  /** Abandonne la course en cours : à l'heure pile elle s'arrête pour tout le monde et ne compte pas. */
  abortRun(): void;
  /** Finale (lot 31) : plus aucun départ (boutons grisés), classement affiché d'office ; `false` rend tout. */
  finale(on: boolean): void;
  banner(text: string, seconds: number, small?: boolean): void;
  flash(): void;
  /** Les fantômes du prochain départ ont changé. */
  ghostsChanged(entries: GhostEntry[]): void;
}

export interface SalonDom {
  /** La plaque du compte à rebours (`#medals`, en haut à droite). */
  countdown: HTMLElement;
  /** Grand compte à rebours de la finale (15 → 0), au centre. */
  finale: HTMLElement;
  board: BoardPanel;
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
  /** Spectateur (`?watch=best`, lot 27b) : ne s'annonce pas au serveur, donc ne compte pas parmi les présents. */
  spectator?: boolean;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T | null> => Promise.race([p, sleep(ms).then(() => null)]);

export class SalonController {
  readonly demo: boolean;
  /** Lu à chaque fois : « Changer mon code » change l'identifiant sans recharger la page. */
  get playerId(): string {
    return getPlayerId();
  }
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
  /** Spectateur (lot 27b) : aucune requête ne porte d'identifiant de joueur, donc aucune écriture de présence côté serveur. */
  spectator = false;

  private readonly circuits = new Map<number, Promise<LoadedSalonCircuit | null>>();
  private readonly ghostCache = new Map<string, SalonGhost>();
  private readonly inflight = new Set<Promise<unknown>>();
  private ghostSignature = "";
  private lastBoardPoll = -1e9;
  private lastNowPoll = -1e9;
  private lastCountdown = "";
  private polling = false;
  private podiumAt = 0;
  private podiumShown = -1;
  private retryAt = 0;
  /** La finale est en cours (15 dernières secondes) : départs fermés, grand compte à rebours. */
  finaleOn = false;
  /** La session qui vient de finir, pour le podium (le jeu est déjà passé à la suivante). */
  private old: { session: number; label: string; board: SalonBoard | null; best: SalonController["best"]; end: number; refreshed: boolean } | null = null;
  private podiumSwapped = false;
  private prebuiltFor = -1;

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

  /** Identifiant envoyé au serveur : aucun pour un spectateur. */
  private get pid(): string | null {
    return this.spectator ? null : this.playerId;
  }

  get label(): string {
    return sessionLabel(this.session, this.sessionMs);
  }

  title(): string {
    return t("salon.circuit", { heure: this.label, theme: nomTheme(this.circuit.theme) });
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

    if (this.state === "playing") {
      const c = sessionClock(now, this.session, this.sessionMs);
      // Finale : les 15 dernières secondes. Plus aucun départ, grand compte à rebours, classement d'office, rafraîchi plus souvent.
      if (c.finale && !this.finaleOn) this.enterFinale();
      else if (!c.finale && this.finaleOn) this.leaveFinale();
      if (this.dom) this.lastCountdown = renderCountdown(this.dom.countdown, { remainingMs: c.remainingMs, finale: c.finale, players: this.players });
      if (this.finaleOn && this.dom) {
        const n = String(Math.max(0, Math.ceil(c.remainingMs / 1000)));
        if (this.dom.finale.textContent !== n) this.dom.finale.textContent = n;
      }
      if (c.preparing && !this.circuits.has(this.session + 1)) {
        this.stats.prefetched++;
        void this.circuitFor(this.session + 1); // la bascule n'attendra pas le générateur
      }
      // La scène du circuit suivant se construit dès qu'il est prêt et que personne ne roule (sinon : à l'heure pile, derrière le podium).
      if (c.preparing && this.prebuiltFor !== this.session + 1 && this.host && !this.host.isRacing()) {
        const next = this.session + 1;
        this.prebuiltFor = next;
        void this.circuitFor(next).then((circ) => {
          if (circ && this.state === "playing" && this.session + 1 === next && !this.host?.isRacing()) this.host?.prebuild(circ);
          else if (this.prebuiltFor === next) this.prebuiltFor = -1;
        });
      }
      if (perf - this.lastBoardPoll >= (this.finaleOn ? FINALE_POLL_MS : BOARD_POLL_MS)) void this.refreshBoard();
      if (!this.demo && perf - this.lastNowPoll >= NOW_POLL_MS) void this.syncNow();
      // À l'heure pile (heure du serveur) : la course en cours s'arrête pour tous, le circuit change pour tous. Personne n'attend personne.
      if (c.ended) void this.endSession();
    } else if (this.state === "podium") {
      const old = this.old;
      // Le classement final une fois les envois clos (fin + 3 s) : une course finie juste avant la fin peut encore monter au podium.
      if (old && !old.refreshed && now >= old.end + SUBMIT_GRACE_MS + 500) {
        old.refreshed = true;
        void this.refreshOldBoard();
      }
      if (this.podiumSwapped) {
        const left = (this.podiumAt + PODIUM_MS - perf) / 1000;
        const shown = Math.max(0, Math.ceil(left));
        if (shown !== this.podiumShown) this.drawPodium(left);
        if (left <= 0) this.closePodium();
      }
    }
  }

  private enterFinale(): void {
    this.finaleOn = true;
    if (this.dom) {
      this.dom.finale.hidden = false;
      this.dom.finale.textContent = String(Math.ceil((this.endMs - this.clock.now()) / 1000));
    }
    this.host?.finale(true);
    this.host?.banner(t("salon.finale.derniere"), 3, true);
    this.lastBoardPoll = -1e9; // classement tout de suite
  }

  private leaveFinale(): void {
    this.finaleOn = false;
    if (this.dom) this.dom.finale.hidden = true;
    this.host?.finale(false);
  }

  private async syncNow(): Promise<void> {
    this.lastNowPoll = performance.now();
    const t0 = Date.now();
    const r = await this.api.now(this.pid);
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
      const r = await this.api.board(session, this.pid, this.board?.version);
      if (session !== this.session) return;
      if (!r.ok) {
        this.lastError = r.code;
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
        this.host?.banner(t("salon.depasse", { nom: by }), 1.8, true);
        this.host?.flash();
      }
      this.renderBoard();
      await this.refreshGhosts();
    } finally {
      this.polling = false;
    }
  }

  renderBoard(): void {
    if (this.dom) renderSalonBoard(this.dom.board, this.board, this.label, this.spectator ? undefined : watchHref(location.search));
    if (this.dom && this.lastError && !this.board) renderSalonBoardError(this.dom.board, this.lastError);
  }

  /** Charge les fantômes utiles (trois premiers, devant, derrière) et prévient le jeu quand l'ensemble change. */
  async refreshGhosts(): Promise<void> {
    const board = this.board;
    if (!board || this.spectator) return; // un spectateur ne court pas : pas de fantômes à charger
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
      if (gh) entries.push({ key: w.key, rank: w.rank, name: w.rank === null ? t("commun.toi") : gh.name, ms: gh.ms, replay: gh.replay });
    }
    this.pushGhosts(entries);
  }

  private pushGhosts(others: GhostEntry[]): void {
    const entries = [...others];
    if (this.best) entries.push({ key: `mine:${this.best.ms}`, rank: null, name: t("commun.toi"), ms: this.best.ms, replay: this.best.replay });
    const signature = entries.map((e) => e.key).join("|");
    if (signature === this.ghostSignature) return;
    this.ghostSignature = signature;
    this.host?.ghostsChanged(entries);
  }

  /**
   * Le meilleur tour de la session en cours (mode spectateur, lot 27b) : la première ligne du classement et sa rediffusion, ou `null`
   * s'il n'y a pas encore de temps. Lecture seule : rien n'est envoyé.
   */
  async bestGhost(): Promise<SalonGhost | null> {
    if (!this.board || this.board.rows.length === 0) await this.refreshBoard();
    const first = this.board?.rows[0];
    if (!first) return null;
    const key = `${first.ref}:${first.ms}`;
    let ghost = this.ghostCache.get(key);
    if (!ghost) {
      const g = await this.api.ghosts(this.session, [first.ref]);
      ghost = g.ok ? g.data.ghosts.find((x) => x.ref === first.ref) : undefined;
      if (ghost) this.ghostCache.set(key, ghost);
    }
    return ghost ?? null;
  }

  /** Branche le moteur de jeu ; les fantômes déjà chargés au démarrage (avant que le jeu n'existe) lui sont remis. */
  attachHost(host: SalonHost): void {
    this.host = host;
    this.ghostSignature = "";
    void this.refreshGhosts();
    onLangue(() => this.renderBoard()); // le titre et les lignes du classement suivent la langue
  }

  cycleGhostMode(): SalonGhostMode {
    this.ghostMode = nextSalonGhostMode(this.ghostMode);
    this.host?.banner(ghostModeLabel(this.ghostMode), 1.4, true);
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
      if (res.ok && this.old && r.session === this.old.session) {
        this.old.board = res.data.board; // course terminée juste avant la fin : elle monte au podium
        if (this.state === "podium") this.drawPodium(Math.max(0, (this.podiumAt + PODIUM_MS - performance.now()) / 1000));
      } else if (res.ok && r.session === this.session) {
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

  /**
   * L'heure pile : la course en cours est coupée (non comptée), le circuit suivant s'installe tout de suite et le podium de la session
   * finie s'affiche par-dessus avec le dernier classement connu (rafraîchi à `fin + 3 s`, quand les envois sont clos).
   */
  private async endSession(): Promise<void> {
    if (this.state !== "playing") return;
    this.state = "podium";
    this.podiumSwapped = false;
    this.retryAt = 0;
    this.podiumShown = -1;
    this.old = { session: this.session, label: this.label, board: this.board, best: this.best, end: this.endMs, refreshed: false };
    if (this.finaleOn) this.leaveFinale();
    this.host?.abortRun();
    if (this.dom) this.dom.podium.hidden = false;
    document.body.classList.add("podium");
    this.drawPodium(PODIUM_MS / 1000);
    await this.installNext();
  }

  /** Installe le circuit de la session en cours (préparé d'avance) ; réessaie s'il n'est pas prêt. */
  private async installNext(): Promise<void> {
    const target = salonSessionAt(this.clock.now(), this.sessionMs);
    const circuit = await this.circuitFor(target);
    if (this.state !== "podium") return;
    if (!circuit) {
      this.circuits.delete(target);
      this.retryAt = performance.now() + 3000;
      this.host?.banner(t("salon.circuit.indisponible"), 2.5, true);
      setTimeout(() => void this.installNext(), 3000);
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
    this.prebuiltFor = -1;
    this.podiumSwapped = true;
    this.podiumAt = performance.now(); // le podium dure 10 s à partir de l'installation du circuit suivant
    // Spectateur (lot 27b) : le podium se voit d'abord, la page revient au Salon normal à sa fermeture (voir `closePodium`).
    if (!this.spectator) this.host?.swapCircuit(circuit); // nouvelle scène ; le décompte de départ attend la fermeture du podium (jeu gelé dessous)
    this.renderBoard();
    this.lastBoardPoll = -1e9; // classement de la nouvelle session tout de suite
    void this.circuitFor(target + 1);
    this.drawPodium(PODIUM_MS / 1000);
  }

  private async refreshOldBoard(): Promise<void> {
    const old = this.old;
    if (!old) return;
    const r = await withTimeout(this.api.board(old.session, this.pid), 2500);
    if (r?.ok && this.old === old && this.state === "podium") {
      old.board = r.data;
      this.drawPodium(Math.max(0, (this.podiumAt + PODIUM_MS - performance.now()) / 1000));
    }
  }

  private closePodium(): void {
    this.state = "playing";
    this.old = null;
    if (this.dom) this.dom.podium.hidden = true;
    document.body.classList.remove("podium");
    if (this.spectator) this.host?.swapCircuit(this.circuit);
  }

  private drawPodium(secondsLeft: number): void {
    const old = this.old;
    if (!this.dom || !old) return;
    this.podiumShown = Math.max(0, Math.ceil(secondsLeft));
    const mine = old.board?.me && old.best ? { ms: old.board.me.ms, rank: old.board.me.rank, participants: old.board.participants } : null;
    const line = mine ? salonShareLine(old.label, mine.ms, mine.rank, mine.participants) : null;
    renderPodium(this.dom.podium, {
      label: old.label,
      board: old.board,
      mine,
      shareLine: line,
      secondsLeft,
      onCopy: line ? () => copyText(`${line}\n${location.origin}${location.pathname}?mode=salon`) : undefined,
    });
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
    const r = await api.now(opts.spectator ? null : getPlayerId());
    if (!r.ok) return { error: r.status === 404 ? t("salon.boot.sansSalon") : t("salon.boot.injoignable", { raison: messageErreur(r.code) }) };
    clock.sync(r.data.serverMs, t0, Date.now());
    sessionMs = r.data.endMs - r.data.startMs; // la durée vient du serveur : on ne triche pas sur le nombre de minutes
  }
  const session = salonSessionAt(clock.now(), sessionMs);
  const circuit = await engine.circuit(session);
  if (!circuit) return { error: t("salon.boot.circuit") };
  controller = new SalonController(api, engine, clock, sessionMs, circuit, demo);
  controller.spectator = !!opts.spectator;
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
