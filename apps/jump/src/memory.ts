import {
  JUMP_SIM_VERSION,
  JumpReplayError,
  decodeReplay,
  encodeReplay,
  lifeReplay,
  replayAttempt,
  type AttemptResult,
  type JumpReplay,
  type Level,
  type RecordedAttempt,
} from "@cdj/jump-sim";
import { STORAGE_PREFIX, storageKey } from "./storage";

// Mémoire du jour (lot 3), **par niveau** : le meilleur essai (sa rediffusion), toutes les vies du jour (rediffusions, les 300 plus récentes)
// et les positions de mort du jour (les taches). Tout survit à un rechargement et se purge quand le jour, le niveau ou la version de la
// simulation change. Le stockage est **toujours protégé** (`try/catch`) : sans lui (navigation privée, quota, stockage qui lève), le jeu
// marche, il ne retient simplement rien d'une page à l'autre.
//
// Règles :
//   - le meilleur temps conservé est celui que **le rejeu recalcule** (`replayAttempt`), jamais celui du HUD ; au chargement, le meilleur
//     essai est rejoué de nouveau (une rediffusion qui ne finit plus, ou d'une autre version, est ignorée) ;
//   - une session aux réglages modifiés (`tuned`) n'enregistre **rien** : ni meilleur essai, ni vies, ni taches.
//
// Clés (`jump:` comme tout DailyJump) : `jump:jour:<niveau>` (jour, version, empreinte du niveau, compteur d'essais),
// `jump:meilleur:<niveau>`, `jump:vies:<niveau>`, `jump:morts:<niveau>`. Réglage du fantôme : `jump:fantome`.

/** Le sous-ensemble de `Storage` dont on se sert (de quoi passer un faux stockage dans les tests). */
export interface KeyValue {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
  readonly length: number;
}

/** Vies gardées par niveau et par jour (les plus récentes). */
export const MAX_LIVES = 300;
/** Positions de mort gardées par niveau et par jour (autant que de taches affichées). */
export const MAX_DEATHS = 300;

export interface StoredLife {
  /** Rediffusion de la vie seule (base64url). */
  code: string;
  /** Numéro de l'essai dont elle vient (le carnage écarte les vies de l'essai héros). */
  essai: number;
}

export interface StoredDeath {
  /** Centre du personnage à la mort, unités. */
  x: number;
  y: number;
  cause: number;
}

export interface BestAttempt {
  code: string;
  /** Temps **recalculé par le rejeu**, en pas. */
  time: number;
  deaths: number;
  essai: number;
}

/** Ce qu'a donné l'enregistrement d'un essai. */
export interface RecordedEssai {
  essai: number;
  result: AttemptResult;
  replay: JumpReplay;
  newBest: boolean;
}

/** `localStorage` s'il est lisible, sinon null (navigation privée stricte, iframe isolée…). */
export function browserStorage(): KeyValue | null {
  try {
    const s = window.localStorage;
    void s.length;
    return s;
  } catch {
    return null;
  }
}

/** Empreinte du contenu d'un niveau : le modifier (sans changer de version) purge sa mémoire. */
export function levelHash(level: Level): string {
  let h = 2166136261;
  const mix = (v: number) => (h = Math.imul(h ^ (v | 0), 16777619) >>> 0);
  mix(level.width);
  mix(level.height);
  for (const t of level.tiles) mix(t);
  for (const c of [level.start, level.finish, ...level.checkpoints]) (mix(c.col), mix(c.row));
  for (const s of level.sections) (mix(s.c0), mix(s.c1));
  for (const s of level.saws) {
    mix(s.radius);
    mix(s.cycle);
    for (const p of s.nodes) (mix(p.x), mix(p.y));
  }
  return h.toString(16).padStart(8, "0");
}

interface Meta {
  day: string;
  simVersion: number;
  level: string;
  essai: number;
}

export interface DayMemoryOptions {
  store: KeyValue | null;
  level: Level;
  /** Identifiant du niveau (`essai`, `module:cheminee:1`, plus tard la date) : il va dans les rediffusions, et nomme les clés. */
  levelId: string;
  /** Nom des clés de stockage, si ce n'est pas `levelId` (lot 4 : un morceau est rangé par entrée, `module:<id>:<n>:elan`). */
  key?: string;
  /** Le jour du jeu (AAAA-MM-JJ, date de Paris) : relu à chaque écriture, la mémoire se purge s'il a changé. */
  today(): string;
}

export class DayMemory {
  best: BestAttempt | null = null;
  lives: StoredLife[] = [];
  deaths: StoredDeath[] = [];
  /** Numéro du prochain essai enregistré. */
  private essai = 1;
  private day: string;
  private readonly hash: string;

  constructor(private readonly opts: DayMemoryOptions) {
    this.hash = levelHash(opts.level);
    this.day = opts.today();
    this.load();
  }

  get levelId(): string {
    return this.opts.levelId;
  }

  private key(kind: string): string {
    return storageKey(`${kind}:${this.opts.key ?? this.opts.levelId}`);
  }

  private read<T>(kind: string): T | null {
    try {
      const raw = this.opts.store?.getItem(this.key(kind));
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  private write(kind: string, value: unknown): void {
    try {
      this.opts.store?.setItem(this.key(kind), JSON.stringify(value));
    } catch {
      /* quota dépassé, stockage refusé : on garde en mémoire, sans plus */
    }
  }

  private remove(kind: string): void {
    try {
      this.opts.store?.removeItem(this.key(kind));
    } catch {
      /* rien */
    }
  }

  /** Lit la mémoire ; la purge si elle est d'un autre jour, d'une autre version ou d'un autre niveau. Range les clés des jours passés. */
  private load(): void {
    this.sweep();
    const meta = this.read<Meta>("jour");
    if (!meta || meta.day !== this.day || meta.simVersion !== JUMP_SIM_VERSION || meta.level !== this.hash) {
      this.purge();
      return;
    }
    this.essai = Number.isInteger(meta.essai) && meta.essai > 0 ? meta.essai : 1;
    const lives = this.read<StoredLife[]>("vies");
    this.lives = Array.isArray(lives) ? lives.filter((l) => l && typeof l.code === "string" && isCurrent(l.code)).slice(-MAX_LIVES) : [];
    const deaths = this.read<StoredDeath[]>("morts");
    this.deaths = Array.isArray(deaths) ? deaths.filter((d) => d && Number.isInteger(d.x) && Number.isInteger(d.y)).slice(-MAX_DEATHS) : [];
    const best = this.read<BestAttempt>("meilleur");
    this.best = null;
    if (best && typeof best.code === "string") {
      // Le temps gardé est celui que le rejeu recalcule : on rejoue de nouveau (quelques millisecondes).
      try {
        const result = replayAttempt(this.opts.level, decodeReplay(best.code), this.opts.levelId);
        if (result.finished) this.best = { code: best.code, time: result.time, deaths: result.deaths.length, essai: Number.isInteger(best.essai) ? best.essai : 0 };
      } catch {
        this.best = null;
      }
    }
  }

  /** Retire les mémoires des autres niveaux qui datent d'un autre jour (le stockage ne grossit pas de jour en jour). */
  private sweep(): void {
    const store = this.opts.store;
    if (!store) return;
    try {
      const prefix = `${STORAGE_PREFIX}jour:`;
      const stale: string[] = [];
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (!k || !k.startsWith(prefix)) continue;
        let day = "";
        try {
          day = (JSON.parse(store.getItem(k) ?? "{}") as Partial<Meta>).day ?? "";
        } catch {
          day = "";
        }
        if (day !== this.day) stale.push(k.slice(prefix.length));
      }
      for (const id of stale) for (const kind of ["jour", "meilleur", "vies", "morts", "niveau"]) store.removeItem(storageKey(`${kind}:${id}`));
    } catch {
      /* rien */
    }
  }

  /** Tout oublier pour ce niveau (nouveau jour, nouvelle version, ou `__jump.storage.clear()`). */
  purge(): void {
    this.best = null;
    this.lives = [];
    this.deaths = [];
    this.essai = 1;
    for (const kind of ["meilleur", "vies", "morts"]) this.remove(kind);
    this.saveMeta();
  }

  private saveMeta(): void {
    this.write("jour", { day: this.day, simVersion: JUMP_SIM_VERSION, level: this.hash, essai: this.essai } satisfies Meta);
  }

  /** Le jour a-t-il changé depuis le chargement ? Alors la mémoire repart de zéro (minuit à Paris passé, page restée ouverte). */
  private checkDay(): void {
    const today = this.opts.today();
    if (today !== this.day) {
      this.day = today;
      this.purge();
    }
  }

  /**
   * Un essai vient de se clore : il est **rejoué** (`replayAttempt`), et c'est ce rejeu qui donne le temps, les morts et les vies gardés.
   * Rien n'est enregistré en `tuned`, ni pour une rediffusion que le rejeu refuse.
   */
  recordEssai(recorded: RecordedAttempt, tuned: boolean): RecordedEssai | null {
    if (tuned) return null;
    this.checkDay();
    let result: AttemptResult;
    try {
      result = replayAttempt(this.opts.level, recorded.replay, this.opts.levelId);
    } catch {
      return null;
    }
    const essai = this.essai++;
    for (const life of result.lives) {
      if (life.ticks === 0) continue;
      this.lives.push({ code: encodeReplay(lifeReplay(recorded.replay, life)), essai });
    }
    if (this.lives.length > MAX_LIVES) this.lives.splice(0, this.lives.length - MAX_LIVES);
    const newBest = result.finished && (this.best === null || result.time < this.best.time);
    if (newBest) {
      this.best = { code: encodeReplay(recorded.replay), time: result.time, deaths: result.deaths.length, essai };
      this.write("meilleur", this.best);
    }
    this.write("vies", this.lives);
    this.saveMeta();
    return { essai, result, replay: recorded.replay, newBest };
  }

  /** Une mort (position du centre du personnage, unités) : gardée pour les taches de la journée. Rien en `tuned`. */
  recordDeath(death: StoredDeath, tuned: boolean): boolean {
    if (tuned) return false;
    this.checkDay();
    this.deaths.push({ x: death.x, y: death.y, cause: death.cause });
    if (this.deaths.length > MAX_DEATHS) this.deaths.splice(0, this.deaths.length - MAX_DEATHS);
    this.write("morts", this.deaths);
    return true;
  }

  /** Le meilleur essai, en rediffusion (null s'il n'y en a pas). */
  bestReplay(): JumpReplay | null {
    if (!this.best) return null;
    try {
      return decodeReplay(this.best.code);
    } catch {
      return null;
    }
  }

  /** Les vies du jour en rediffusions, sauf celles de l'essai `except` (le héros du carnage). Une vie illisible est ignorée. */
  liveReplays(except = -1): JumpReplay[] {
    const out: JumpReplay[] = [];
    for (const l of this.lives) {
      if (l.essai === except) continue;
      try {
        out.push(decodeReplay(l.code));
      } catch {
        /* ignorée */
      }
    }
    return out;
  }

  /** Remplace le meilleur essai par une rediffusion importée, **si** le rejeu la valide (finie, ce niveau, cette version). */
  importBest(code: string): { ok: true; time: number } | { ok: false; reason: string } {
    try {
      const replay = decodeReplay(code);
      const result = replayAttempt(this.opts.level, replay, this.opts.levelId);
      if (!result.finished) return { ok: false, reason: "cette rediffusion n'arrive pas au bout" };
      this.best = { code: encodeReplay(replay), time: result.time, deaths: result.deaths.length, essai: 0 };
      this.write("meilleur", this.best);
      this.saveMeta();
      return { ok: true, time: result.time };
    } catch (e) {
      return { ok: false, reason: e instanceof JumpReplayError ? e.message : String(e) };
    }
  }

  /** Taille approximative de ce que la mémoire occupe dans le stockage (caractères des valeurs). */
  storedSize(): number {
    let n = 0;
    for (const kind of ["jour", "meilleur", "vies", "morts"]) {
      try {
        n += this.opts.store?.getItem(this.key(kind))?.length ?? 0;
      } catch {
        /* rien */
      }
    }
    return n;
  }
}

/** Une rediffusion de cette version de la simulation ? (Celles d'une autre version sont ignorées.) */
function isCurrent(code: string): boolean {
  try {
    return decodeReplay(code).simVersion === JUMP_SIM_VERSION;
  } catch {
    return false;
  }
}

/** Efface tout ce que DailyJump garde (`jump:*`) : `__jump.storage.clear()`. */
export function clearAll(store: KeyValue | null): number {
  if (!store) return 0;
  try {
    const keys: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (k?.startsWith(STORAGE_PREFIX)) keys.push(k);
    }
    for (const k of keys) store.removeItem(k);
    return keys.length;
  } catch {
    return 0;
  }
}

/** Le fantôme est-il voulu ? Réglage mémorisé (`jump:fantome`), oui par défaut. */
export function loadGhostSetting(store: KeyValue | null): boolean {
  try {
    return store?.getItem(storageKey("fantome")) !== "0";
  } catch {
    return true;
  }
}

export function saveGhostSetting(store: KeyValue | null, on: boolean): void {
  try {
    store?.setItem(storageKey("fantome"), on ? "1" : "0");
  } catch {
    /* rien */
  }
}
