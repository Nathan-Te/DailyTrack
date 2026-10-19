import { formatDay } from "@cdj/core";
import { PREMIER_JOUR_JUMP, jumpMedalFor, type JumpMedals } from "@cdj/jump-sim";
import type { ApiResult, FetchLike, MeProfile, NameCheck } from "@cdj/profile";
import type { KeyValue } from "./memory";
import type { FirstGhostData } from "./firstGhost";
import type { JumpMe } from "./jumpProfile";
import type { DayBundle } from "./dayReads";
import type { CarnageSampleData, DeathMapData, JumpBoard, JumpBoardRow, JumpSubmitResult, RankEntry, RankSource } from "./rankApi";
import { storageKey } from "./storage";

// Le classement de démonstration (`?api=demo`, lot P1 de la plateforme), sur le modèle de DailyTrack (`apps/web/src/demo.ts`) : **lecture seule**
// d'un jeu de données statique (`public/demo/`, fabriqué par `npm run jump:seed -w @cdj/api` : de vraies rediffusions de joueurs « Démo … »
// validées par le vrai `createApi` en mémoire), avec la même interface que le serveur (`RankSource`). Rien ne part sur le réseau ; seul le
// fichier statique est lu (à chaque appel : sans réseau, la démo est « injoignable » comme le serveur, ce que les tests de la file utilisent).
//
// « Aujourd'hui » de la démo est figé (`DEMO_TODAY`, le lendemain des 14 jours d'archives) : le jeu y joue ce niveau-là comme niveau du jour.
// Ton essai y est classé parmi les joueurs fictifs (rang calculé ici, dans le navigateur : la démo **fait confiance au rejeu du jeu**, il n'y a
// pas de serveur) et gardé dans le stockage de la démo (`demo:` : jamais les données du vrai jeu). Les archives montrent leur classement figé.

/** Jours d'archives du jeu de données (le même nombre que `JUMP_DEMO_DAYS`, apps/api/src/jumpHistory.ts ; un test compare avec `index.json`). */
export const DEMO_DAYS = 14;
/** L'« aujourd'hui » de la démo. */
export const DEMO_TODAY = PREMIER_JOUR_JUMP + DEMO_DAYS;
/** Ton essai de démonstration (dans le stockage de la démo). */
export const DEMO_ENTRY_KEY = storageKey("demo:essai");

export interface DemoIndex {
  simVersion: number;
  generatorVersion: number;
  premierJour: string;
  demoToday: string;
  days: { date: string; number: number; levelId: string; participants: number; firstTicks: number }[];
}

export interface DemoDay {
  date: string;
  number: number;
  levelId: string;
  medals: JumpMedals;
  participants: number;
  top: JumpBoardRow[];
  rows?: { name: string; ticks: number; deaths: number }[];
  /** Lot P2 : le fantôme du premier du jour (sa rediffusion, validée par le vrai serveur à la fabrication du jeu de données). */
  first?: Omit<FirstGhostData, "date" | "levelId" | "mine"> | null;
  /** Lot P3 : la carte des morts et l'échantillon du carnage de tout le monde (vies des joueurs fictifs, validées par le vrai serveur). */
  deaths?: Pick<DeathMapData, "players" | "deaths" | "tiles">;
  carnage?: Pick<CarnageSampleData, "players" | "dayPlayers" | "lives">;
}

interface DemoEntry {
  date: string;
  levelId: string;
  name: string;
  ticks: number;
  deaths: number;
}

/** Clé d'un pseudo, comme le serveur (`nameKey`) : sans accents, minuscules, espaces réduits. */
export function demoNameKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const fail = <T>(status: number, code: string, message: string, suggestions?: string[]): ApiResult<T> => ({ ok: false, status, code, message, ...(suggestions ? { suggestions } : {}) });

/** Classe ton essai parmi les lignes du jour : les joueurs fictifs ont envoyé avant toi (à temps égal, ils passent devant). */
export function demoBoard(day: DemoDay, mine: DemoEntry | null): JumpBoard {
  const rows = (day.rows ?? day.top).map((r) => ({ name: r.name, ticks: r.ticks, deaths: r.deaths, mine: false }));
  if (mine) {
    const at = rows.findIndex((r) => r.ticks > mine.ticks);
    rows.splice(at < 0 ? rows.length : at, 0, { name: mine.name, ticks: mine.ticks, deaths: mine.deaths, mine: true });
  }
  const participants = day.participants + (mine ? 1 : 0);
  const ranked: (JumpBoardRow & { mine: boolean })[] = rows.map((r, i) => ({ rank: i + 1, name: r.name, ticks: r.ticks, deaths: r.deaths, medal: jumpMedalFor(r.ticks, day.medals), mine: r.mine }));
  const strip = ({ mine: _m, ...row }: JumpBoardRow & { mine: boolean }): JumpBoardRow => row;
  const me = ranked.find((r) => r.mine);
  return { date: day.date, open: false, participants, levelId: day.levelId, top: ranked.slice(0, 10).map(strip), me: me ? strip(me) : null };
}

export class DemoRankSource implements RankSource {
  constructor(
    /** Dossier du jeu de données (`demo/`, à côté de la page). */
    private readonly base: string,
    private readonly store: KeyValue | null,
    private readonly fetchImpl: FetchLike = (input, init) => fetch(input, init),
  ) {}

  private async json<T>(file: string): Promise<ApiResult<T>> {
    try {
      const r = await this.fetchImpl(`${this.base}${file}`, { method: "GET", cache: "no-cache" });
      if (r.status === 404) return fail(404, "unknown_day", "Pas de classement de démonstration pour ce jour");
      if (!r.ok) return fail(r.status, "http_error", `Erreur ${r.status}`);
      return { ok: true, data: (await r.json()) as T };
    } catch {
      return fail(0, "network", "Classement injoignable");
    }
  }

  private mine(): DemoEntry | null {
    try {
      const raw = this.store?.getItem(DEMO_ENTRY_KEY);
      return raw ? (JSON.parse(raw) as DemoEntry) : null;
    } catch {
      return null;
    }
  }

  async submit(_playerId: string, name: string | null, entry: RankEntry, versions: { simVersion: number; generatorVersion: number }): Promise<ApiResult<JumpSubmitResult>> {
    const index = await this.json<DemoIndex>("index.json");
    if (!index.ok) return index;
    if (index.data.simVersion !== versions.simVersion || index.data.generatorVersion !== versions.generatorVersion) {
      return fail(409, "version", "Une nouvelle version du jeu est disponible : recharge la page (jeu de données de démonstration d'une autre version)");
    }
    if (entry.date !== index.data.demoToday) return fail(409, "day_closed", "Le classement de ce jour est figé : seul le niveau du jour se classe");
    const day = await this.json<DemoDay>(`${entry.date}.json`);
    if (!day.ok) return day;
    if (day.data.levelId !== entry.levelId) return fail(409, "version", "Une nouvelle version du jeu est disponible : recharge la page");
    const previous = this.mine();
    const own = previous?.date === entry.date ? previous : null;
    const chosen = name ?? own?.name ?? null;
    if (!chosen) return fail(400, "name_required", "Choisis un pseudo pour entrer au classement");
    if (demoNameKey(chosen).startsWith("demo ")) return this.taken(chosen);
    const improved = !own || entry.ticks < own.ticks;
    const best: DemoEntry = improved ? { date: entry.date, levelId: entry.levelId, name: chosen, ticks: entry.ticks, deaths: entry.deaths } : { ...own!, name: chosen };
    try {
      this.store?.setItem(DEMO_ENTRY_KEY, JSON.stringify(best));
    } catch {
      /* sans stockage : le rang vaut pour cette page */
    }
    const board = demoBoard(day.data, best);
    return {
      ok: true,
      data: {
        accepted: true,
        date: entry.date,
        levelId: entry.levelId,
        ticks: entry.ticks,
        deaths: entry.deaths,
        improved,
        bestTicks: best.ticks,
        bestDeaths: best.deaths,
        medal: jumpMedalFor(best.ticks, day.data.medals),
        rank: board.me!.rank,
        participants: board.participants,
        // Lot P4 : le classement d'après l'envoi, comme le serveur.
        board: { ...board, open: entry.date === formatDay(DEMO_TODAY) },
      },
    };
  }

  private taken<T>(name: string): ApiResult<T> {
    return fail(409, "name_taken", "Ce pseudo est déjà utilisé. C'est le tien ? Charge ton code.", [`${name.replace(/^d[ée]mo\s+/i, "")}2`, `${name.replace(/^d[ée]mo\s+/i, "")}_FR`]);
  }

  async board(date: string, _playerId: string | null): Promise<ApiResult<JumpBoard>> {
    const day = await this.json<DemoDay>(`${date}.json`);
    if (!day.ok) return day;
    const mine = this.mine();
    return { ok: true, data: { ...demoBoard(day.data, mine?.date === date && mine.levelId === day.data.levelId ? mine : null), open: date === formatDay(DEMO_TODAY) } };
  }

  /**
   * Lot P2 : le premier du jeu de données (un joueur fictif). Ton propre essai de démonstration n'a pas de rediffusion ici : s'il est plus
   * rapide, le jeu le sait (`showFirstGhost` : ton fantôme est alors celui du premier).
   */
  async firstGhost(date: string, _playerId: string | null): Promise<ApiResult<FirstGhostData>> {
    const day = await this.json<DemoDay>(`${date}.json`);
    if (!day.ok) return day;
    const f = day.data.first;
    if (!f) return fail(404, "no_ghost", "Personne n'est encore classé ce jour-là");
    return { ok: true, data: { ...f, date: day.data.date, levelId: day.data.levelId, mine: false } };
  }

  /**
   * Lot P4 : la lecture regroupée, comme le serveur : le classement, le fantôme du premier et la carte du jour, **un seul fichier lu**. La
   * démonstration n'a pas de profil (le jeu ne le demande jamais : la synchronisation y est coupée).
   */
  async bundle(date: string, _playerId: string | null): Promise<ApiResult<DayBundle>> {
    const day = await this.json<DemoDay>(`${date}.json`);
    if (!day.ok) return day;
    const open = date === formatDay(DEMO_TODAY);
    const mine = this.mine();
    const board = { ...demoBoard(day.data, mine?.date === date && mine.levelId === day.data.levelId ? mine : null), open };
    const f = day.data.first;
    const m = day.data.deaths ?? { players: 0, deaths: 0, tiles: [] };
    return {
      ok: true,
      data: {
        date,
        open,
        board,
        ghost: f ? { ...f, date: day.data.date, levelId: day.data.levelId, mine: false } : null,
        deaths: { date, levelId: day.data.levelId, open, ...m },
      },
    };
  }

  /** Lot P3 : la carte des morts du jeu de données (tes morts de démonstration n'y sont pas : rien n'est envoyé). */
  async deaths(date: string): Promise<ApiResult<DeathMapData>> {
    const day = await this.json<DemoDay>(`${date}.json`);
    if (!day.ok) return day;
    const m = day.data.deaths ?? { players: 0, deaths: 0, tiles: [] };
    return { ok: true, data: { date, levelId: day.data.levelId, open: date === formatDay(DEMO_TODAY), ...m } };
  }

  /** Lot P3 : l'échantillon du carnage de tout le monde du jeu de données. */
  async carnage(date: string): Promise<ApiResult<CarnageSampleData>> {
    const [index, day] = await Promise.all([this.json<DemoIndex>("index.json"), this.json<DemoDay>(`${date}.json`)]);
    if (!index.ok) return index;
    if (!day.ok) return day;
    const c = day.data.carnage ?? { players: 0, dayPlayers: 0, lives: [] };
    return { ok: true, data: { date, levelId: day.data.levelId, open: date === formatDay(DEMO_TODAY), simVersion: index.data.simVersion, generatorVersion: index.data.generatorVersion, ...c } };
  }

  // Le profil DailyJump n'existe pas en démonstration (comme la synchronisation de DailyTrack) : rien n'est synchronisé.
  async jumpMe(): Promise<ApiResult<JumpMe>> {
    return fail(404, "unknown_player", "Pas de profil en démonstration");
  }

  async checkName(name: string): Promise<ApiResult<NameCheck>> {
    if (demoNameKey(name).startsWith("demo ")) {
      const t = this.taken<never>(name);
      return { ok: true, data: { available: false, suggestions: t.ok ? [] : (t.suggestions ?? []) } };
    }
    return { ok: true, data: { available: true } };
  }

  // Le profil (synchronisation, code) n'existe pas en démonstration : `Profile` ne l'appelle jamais (`demo: true`).
  async me(): Promise<ApiResult<MeProfile>> {
    return fail(404, "unknown_player", "Pas de profil en démonstration");
  }
  async rename(_playerId: string, name: string): Promise<ApiResult<{ name: string }>> {
    return { ok: true, data: { name } };
  }
  async rotateCode(): Promise<ApiResult<{ rotated: true }>> {
    return fail(400, "disabled", "Pas de serveur ici : le code ne peut pas être changé.");
  }
}
