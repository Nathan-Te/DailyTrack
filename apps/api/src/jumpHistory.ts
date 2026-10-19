import { formatDay, mixSeed, Rng } from "@cdj/core";
import { parisDayStart } from "@cdj/clock";
import {
  JUMP_GENERATOR_VERSION,
  JUMP_SIM_VERSION,
  PREMIER_JOUR_JUMP,
  demoAttempts,
  encodeReplay,
  replayAttempt,
  type DailyLevel,
  type JumpMedals,
} from "@cdj/jump-sim";
import { FICTIONAL_NAMES } from "@cdj/sim";
import { createApi } from "./api";
import type { SqlDb } from "./db";
import { assertDemoOnly, fictionalId } from "./history";
import { jumpDailyOf, type JumpBoardRow } from "./jump";

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

/** Les essais fictifs d'un jour : un par joueur (son meilleur), pseudos et ordre d'envoi déterministes. Le premier a la preuve de l'auteur. */
export function fictionalJumps(d: DailyLevel, count: number): { name: string; code: string; ticks: number }[] {
  const rng = new Rng(mixSeed(d.day, 0x7a3b));
  const names: string[] = [...FICTIONAL_NAMES];
  for (let i = names.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [names[i], names[j]] = [names[j]!, names[i]!];
  }
  // Un seul lot d'essais fictifs par jour (leur préparation coûte cher : une fois par niveau), réparti entre les joueurs : chacun en reçoit
  // quelques-uns et envoie son meilleur arrivé ; plus il en reçoit, plus il a de chances d'être rapide.
  const pool = demoAttempts(d.level, d.replay, mixSeed(d.day, 0x51), { attempts: count * 16, maxLives: 8 });
  const out: { name: string; code: string; ticks: number }[] = [{ name: names[0]!, code: d.code, ticks: d.authorTicks }];
  let cursor = 0;
  for (let p = 1; p < names.length && out.length < count && cursor < pool.length; p++) {
    const share = 2 + rng.int(14);
    let best: { code: string; ticks: number } | null = null;
    for (const a of pool.slice(cursor, cursor + share)) {
      if (a.end !== "arrivée") continue;
      const r = replayAttempt(d.level, a.replay, d.id);
      // Un essai fictif sans mort suit la preuve au pas près : il arrive exactement au temps de l'auteur. On ne garde que ceux qui ont trébuché
      // (sinon tout le monde serait à égalité avec l'auteur) ; le premier joueur, lui, a la preuve.
      if (r.finished && r.deaths.length > 0 && (!best || r.time < best.ticks)) best = { code: encodeReplay(a.replay), ticks: r.time };
    }
    cursor += share;
    if (best) out.push({ name: names[p]!, ...best });
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
  onDay?(info: { date: string; accepted: number; refused: number; firstError: string }): void;
}

/** Envoie les essais fictifs de chaque jour par le vrai `createApi` (horloge réglée sur le jour, à Paris). Rend le nombre d'essais acceptés. */
export async function seedJumpDays(options: JumpSeedOptions): Promise<number> {
  if (options.demoOnly) await assertDemoOnly(options.db);
  let clock = 0;
  const api = createApi({ db: options.db, now: () => clock, demoPlayers: true, jumpFrozen: options.frozen, limits: { windowMs: 600_000, perClient: 1e9, perPlayer: 1e9 } });
  const min = options.players?.min ?? 16;
  const max = options.players?.max ?? 28;
  let total = 0;
  for (const day of options.days) {
    const d = jumpDailyOf(day, options.frozen);
    const wanted = min + new Rng(mixSeed(day, 0x2c41)).int(max - min + 1);
    const jumps = fictionalJumps(d, wanted);
    let accepted = 0;
    let refused = 0;
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
      if (res.status === 200) accepted++;
      else {
        refused++; // refus du serveur : l'essai ne compte pas (jamais de contournement)
        if (!firstError) firstError = `${res.status} ${String(((await res.json()) as { error?: string }).error ?? "")}`;
      }
    }
    total += accepted;
    options.onDay?.({ date: d.date, accepted, refused, firstError });
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
    const entry: JumpDemoDay = { date, number: level.number, levelId: board.levelId, medals: level.medals, participants: board.participants, top: board.top, first };
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
