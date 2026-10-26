import { formatDay, mixSeed, Rng } from "@cdj/core";
import { parisDayStart } from "@cdj/clock";
import {
  JUMP_GENERATOR_VERSION,
  JUMP_SIM_VERSION,
  PREMIER_JOUR_JUMP,
  demoAttempts,
  repriseParPhase,
  encodeReplay,
  lifeReplay,
  replayAttempt,
  type DailyLevel,
  type JumpMedals,
} from "@cdj/jump-sim";
import { FICTIONAL_NAMES } from "@cdj/sim";
import { createApi } from "./api";
import type { SqlDb } from "./db";
import { assertDemoOnly, fictionalId } from "./history";
import { jumpDailyOf, type JumpBoardRow } from "./jump";
import { JUMP_LIVES_PER_DAY, type CarnageSample, type DeathMap } from "./jumpLives";

export { jumpDailyOf };

// Joueurs fictifs de DailyJump (lot P1 de la plateforme), sur le modèle de `history:seed` de DailyTrack (`history.ts`) : pour chaque jour, des
// joueurs « Démo … » (les mêmes pseudos et les mêmes identifiants stables que les pilotes de DailyTrack : un pseudo appartient à un seul joueur
// de la plateforme) envoient de **vraies rediffusions** : des perturbations à graine fixe de la preuve de l'auteur (`demoAttempts`, comme le
// carnage de démonstration), jouées par la simulation, avec morts et reprises. Leurs essais passent par **le vrai `createApi`**
// (`POST /api/jump/submit` : débit, jour, versions, rejeu serveur ; aucune écriture directe en base) avec une horloge réglée sur le jour.
// Joueurs marqués `demo` (option `demoPlayers`, jamais réglée par le serveur de production).
//
// Deux usages, un seul code (`seedJumpDays`) : `npm run jump:seed -w @cdj/api` (jeu de données statique du mode `?api=demo` de DailyJump,
// base en mémoire) et `npm run recette:seed` (la base de recette, jour courant compris).

/** Jours d'archives du jeu de données de démonstration (puis « aujourd'hui »). */
export const JUMP_DEMO_DAYS = 14;
/** L'« aujourd'hui » du mode démo : le lendemain des 14 jours d'archives depuis le premier niveau (figé : des données stables). */
export const JUMP_DEMO_TODAY = PREMIER_JOUR_JUMP + JUMP_DEMO_DAYS;

/** Un jour du jeu de données : le classement figé (top 10) et, pour « aujourd'hui », toutes les lignes (le jeu y insère ton essai). */
export interface JumpDemoDay {
  date: string;
  number: number;
  levelId: string;
  medals: JumpMedals;
  participants: number;
  top: JumpBoardRow[];
  /** « Aujourd'hui » seulement : tous les classés, dans l'ordre du classement (le jeu de démonstration calcule ton rang). */
  rows?: { name: string; ticks: number; deaths: number }[];
  /** Lot P2 : le fantôme du premier, tel que `GET /api/jump/day/<date>/ghost/first` le rend (sans `mine`). */
  first?: { name: string; ticks: number; deaths: number; replay: string; simVersion: number; generatorVersion: number } | null;
  /** Lot P3 : la carte des morts du jour (figée pour les archives), telle que `GET /api/jump/day/<date>/deaths` la rend. */
  deaths?: Pick<DeathMap, "players" | "deaths" | "tiles">;
  /** Lot P3 : l'échantillon du carnage de tout le monde, tel que `GET /api/jump/day/<date>/carnage` le rend. */
  carnage?: Pick<CarnageSample, "players" | "dayPlayers" | "lives">;
}

export interface JumpDemoIndex {
  simVersion: number;
  generatorVersion: number;
  premierJour: string;
  /** Le jour joué comme « aujourd'hui » en démonstration. */
  demoToday: string;
  days: { date: string; number: number; levelId: string; participants: number; firstTicks: number }[];
}

export interface JumpDemoDataset {
  index: JumpDemoIndex;
  days: JumpDemoDay[];
}

/**
 * Les essais fictifs d'un jour : un par joueur (son meilleur), pseudos et ordre d'envoi déterministes. Le premier a la preuve de l'auteur.
 * Lot P3 : chaque joueur a aussi ses **vies qui finissent par une mort** (celles de tous ses essais fictifs, au plus 30 : le plafond du jour),
 * au format de rediffusion ; le premier (la preuve de l'auteur) n'en a pas.
 */
export function fictionalJumps(d: DailyLevel, count: number): { name: string; code: string; ticks: number; lives: string[] }[] {
  const rng = new Rng(mixSeed(d.day, 0x7a3b));
  const names: string[] = [...FICTIONAL_NAMES];
  for (let i = names.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [names[i], names[j]] = [names[j]!, names[i]!];
  }
  // Un seul lot d'essais fictifs par jour (leur préparation coûte cher : une fois par niveau), réparti entre les joueurs : chacun en reçoit
  // quelques-uns et envoie son meilleur arrivé ; plus il en reçoit, plus il a de chances d'être rapide.
  // Lot 21 : des joueurs fictifs qui reprennent bien après une mort (`repriseParPhase`) : bien plus d'essais arrivent, donc plus de joueurs classés, sur tous les jours.
  const pool = demoAttempts(d.level, d.replay, mixSeed(d.day, 0x51), { attempts: count * 16, maxLives: 8, reprise: repriseParPhase(d) });
  const out: { name: string; code: string; ticks: number; lives: string[] }[] = [{ name: names[0]!, code: d.code, ticks: d.authorTicks, lives: [] }];
  let cursor = 0;
  for (let p = 1; p < names.length && out.length < count && cursor < pool.length; p++) {
    const share = 2 + rng.int(14);
    let best: { code: string; ticks: number } | null = null;
    const lives: string[] = [];
    for (const a of pool.slice(cursor, cursor + share)) {
      const r = replayAttempt(d.level, a.replay, d.id);
      for (const life of r.lives) if (life.end === "mort" && lives.length < JUMP_LIVES_PER_DAY) lives.push(encodeReplay(lifeReplay(a.replay, life)));
      if (a.end !== "arrivée") continue;
      // Un essai fictif sans faute suit la preuve au pas près : il arrive exactement au temps de l'auteur. On ne garde que ceux qui ont trébuché
      // (sinon tout le monde serait à égalité avec l'auteur) ; le premier joueur, lui, a la preuve. Lot 16 : trébucher, c'est mourir **ou**
      // arriver plus lentement que l'auteur (une faute qui ne tue pas) : en v4, un joueur fictif reprend rarement bien après une mort (il rejoue
      // la preuve à l'aveugle, sur une horloge qui ne s'arrête pas), et certains jours n'avaient plus qu'un ou deux classés.
      if (r.finished && (r.deaths.length > 0 || r.time > d.authorTicks) && (!best || r.time < best.ticks)) best = { code: encodeReplay(a.replay), ticks: r.time };
    }
    cursor += share;
    if (best) out.push({ name: names[p]!, ...best, lives });
  }
  return out;
}

export interface JumpSeedOptions {
  /** Base (neuve en mémoire pour `jump:seed`, la base de recette pour `recette:seed`). */
  db: SqlDb;
  /** Les jours figés de l'image (ceux de `apps/jump/public/levels/`). */
  frozen: Readonly<Record<string, unknown>>;
  /** Jours à remplir (numéros de jour), dans l'ordre. */
  days: readonly number[];
  /** Joueurs par jour : entre `min` et `max` (tirés par jour). */
  players?: { min: number; max: number };
  /** Base 100 % démo exigée (jeu de données statique) ; la recette, elle, a de vrais essais de testeurs. */
  demoOnly?: boolean;
  onDay?(info: { date: string; accepted: number; refused: number; firstError: string; lives: number }): void;
}

/** Envoie les essais fictifs de chaque jour par le vrai `createApi` (horloge réglée sur le jour, à Paris). Rend le nombre d'essais acceptés. */
export async function seedJumpDays(options: JumpSeedOptions): Promise<number> {
  if (options.demoOnly) await assertDemoOnly(options.db);
  let clock = 0;
  const api = createApi({ db: options.db, now: () => clock, demoPlayers: true, allowCopies: true, jumpFrozen: options.frozen, limits: { windowMs: 600_000, perClient: 1e9, perPlayer: 1e9 } });
  const min = options.players?.min ?? 16;
  const max = options.players?.max ?? 28;
  let total = 0;
  for (const day of options.days) {
    const d = jumpDailyOf(day, options.frozen);
    const wanted = min + new Rng(mixSeed(day, 0x2c41)).int(max - min + 1);
    const jumps = fictionalJumps(d, wanted);
    let accepted = 0;
    let refused = 0;
    let lives = 0;
    let firstError = "";
    for (let p = 0; p < jumps.length; p++) {
      const j = jumps[p]!;
      // Le matin à Paris, quelques minutes entre deux joueurs : le jour est ouvert, et l'ordre d'envoi (qui départage les égalités) est stable.
      clock = parisDayStart(day) + 8 * 3_600_000 + p * 7 * 60_000;
      const res = await api.handle(
        new Request("http://seed.local/api/jump/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Player-Id": fictionalId(j.name) },
          body: JSON.stringify({ levelId: d.id, simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION, replay: j.code, name: j.name }),
        }),
      );
      if (res.status === 200) {
        accepted++;
        // Lot P3 : ses vies du jour (un lot), par le même `createApi` : chacune est rejouée, seules les morts rejouées comptent.
        if (j.lives.length) {
          const lr = await api.handle(
            new Request("http://seed.local/api/jump/lives", {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-Player-Id": fictionalId(j.name) },
              body: JSON.stringify({ levelId: d.id, simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION, lives: j.lives }),
            }),
          );
          if (lr.status === 200) lives += ((await lr.json()) as { accepted: number }).accepted;
          else if (!firstError) firstError = `vies : ${lr.status} ${String(((await lr.json()) as { error?: string }).error ?? "")}`;
        }
      } else {
        refused++; // refus du serveur : l'essai ne compte pas (jamais de contournement)
        if (!firstError) firstError = `${res.status} ${String(((await res.json()) as { error?: string }).error ?? "")}`;
      }
    }
    total += accepted;
    options.onDay?.({ date: d.date, accepted, refused, firstError, lives });
  }
  return total;
}

/** Le jeu de données du mode `?api=demo` de DailyJump : 14 jours d'archives depuis le premier niveau, puis « aujourd'hui ». */
export async function seedJumpDemo(options: { db: SqlDb; frozen: Readonly<Record<string, unknown>>; onDay?: JumpSeedOptions["onDay"] }): Promise<JumpDemoDataset> {
  const days = Array.from({ length: JUMP_DEMO_DAYS + 1 }, (_, i) => PREMIER_JOUR_JUMP + i);
  await seedJumpDays({ db: options.db, frozen: options.frozen, days, demoOnly: true, onDay: options.onDay });
  // Tous les jours sont passés : on lit les classements comme le jeu le ferait (« aujourd'hui » lu tel quel, avec toutes ses lignes).
  const api = createApi({ db: options.db, now: () => parisDayStart(JUMP_DEMO_TODAY) + 23 * 3_600_000, jumpFrozen: options.frozen });
  const index: JumpDemoIndex = { simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION, premierJour: formatDay(PREMIER_JOUR_JUMP), demoToday: formatDay(JUMP_DEMO_TODAY), days: [] };
  const out: JumpDemoDay[] = [];
  for (const day of days) {
    const date = formatDay(day);
    const board = (await (await api.handle(new Request(`http://seed.local/api/jump/day/${date}/board`))).json()) as { levelId: string; participants: number; top: JumpBoardRow[] };
    const level = (await (await api.handle(new Request(`http://seed.local/api/jump/day/${date}`))).json()) as { number: number; medals: JumpMedals };
    const ghost = await api.handle(new Request(`http://seed.local/api/jump/day/${date}/ghost/first`));
    const g = ghost.status === 200 ? ((await ghost.json()) as NonNullable<JumpDemoDay["first"]>) : null;
    const first = g ? { name: g.name, ticks: g.ticks, deaths: g.deaths, replay: g.replay, simVersion: g.simVersion, generatorVersion: g.generatorVersion } : null;
    // Lot P3 : la carte des morts et l'échantillon du carnage (figés pour les jours passés, comme les archives du serveur).
    const map = (await (await api.handle(new Request(`http://seed.local/api/jump/day/${date}/deaths`))).json()) as DeathMap;
    const sample = (await (await api.handle(new Request(`http://seed.local/api/jump/day/${date}/carnage`))).json()) as CarnageSample;
    const entry: JumpDemoDay = {
      date,
      number: level.number,
      levelId: board.levelId,
      medals: level.medals,
      participants: board.participants,
      top: board.top,
      first,
      deaths: { players: map.players, deaths: map.deaths, tiles: map.tiles },
      carnage: { players: sample.players, dayPlayers: sample.dayPlayers, lives: sample.lives },
    };
    if (day === JUMP_DEMO_TODAY) {
      entry.rows = await options.db.all<{ name: string; ticks: number; deaths: number }>(
        "SELECT p.name AS name, r.ticks AS ticks, r.deaths AS deaths FROM jump_results r JOIN players p ON p.id = r.player_id WHERE r.day = ? ORDER BY r.ticks ASC, r.submitted_at ASC, r.player_id ASC",
        [day],
      );
    }
    out.push(entry);
    index.days.push({ date, number: level.number, levelId: board.levelId, participants: board.participants, firstTicks: board.top[0]?.ticks ?? 0 });
  }
  return { index, days: out };
}
