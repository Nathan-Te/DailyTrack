import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { daysFromCivil, formatDay } from "@cdj/core";
import {
  JUMP_GENERATOR_VERSION,
  JUMP_SIM_VERSION,
  UNITS_PER_TILE,
  dailyLevel,
  demoAttempts,
  encodeReplay,
  isSpikeTile,
  lifeReplay,
  replayAttempt,
  sectionAt,
  type JumpReplay,
} from "@cdj/jump-sim";
import type { ApiResult } from "@cdj/profile";
import { DEMO_TODAY, DemoRankSource, type DemoDay } from "../src/demoRank";
import { carnageSchedule } from "../src/carnage";
import { everyoneLabel, everyoneLives, everyonePlan } from "../src/everyone";
import { LIVES_CANDIDATES, LIVES_PER_DAY, LIVES_QUEUE_KEY, LivesQueue, chooseLives, type LifeCandidate } from "../src/livesQueue";
import { LivesSender } from "../src/livesSender";
import type { KeyValue } from "../src/memory";
import {
  OTHERS_KEEPOUT,
  OTHERS_MAX_TILES,
  OTHERS_SCALE,
  OTHERS_STRENGTH_MAX,
  OTHERS_STRENGTH_MIN,
  keepoutDistance,
  keepoutOf,
  othersStains,
  othersStrength,
} from "../src/othersStains";
import { HttpRankSource, type CarnageSampleData, type LivesLot, type LivesResult, type RankSource } from "../src/rankApi";
import { GRACE_MS, RETRY_MS } from "../src/rankQueue";
import { mayRank } from "../src/ranking";
import { stainFor } from "../src/stains";

// Lot P3 (plateforme) : les morts de tout le monde, côté jeu. La file des vies (choix des 30 morts le long du niveau, lots, reprise, purge,
// ce qui ne part jamais), l'envoi, les taches de tout le monde (plafond, intensité, distance aux dangers et aux fanions), le carnage de tout le
// monde (vies jouables, calendrier, compteur), la démonstration.

class MemStore implements KeyValue {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  get length() {
    return this.data.size;
  }
}

const DAY = daysFromCivil(2026, 10, 20);
const DATE = formatDay(DAY);
const D = dailyLevel(DAY);
const SECTIONS = D.level.sections.length;

/** Des vies du niveau du jour (rediffusions), avec leur fin rejouée. */
const LIVES: { replay: JumpReplay; code: string; end: string; section: number; checkpoint: number }[] = [];
for (const a of demoAttempts(D.level, D.replay, 0x77, { attempts: 30, maxLives: 8 })) {
  for (const life of replayAttempt(D.level, a.replay, D.id).lives) {
    const replay = lifeReplay(a.replay, life);
    LIVES.push({ replay, code: encodeReplay(replay), end: life.end, section: life.death ? sectionAt(D.level, life.death.x) : -1, checkpoint: life.start.checkpoint });
  }
}
const DEATHS = LIVES.filter((l) => l.end === "mort");

const cand = (code: string, section: number): LifeCandidate => ({ code, section });

describe("chooseLives : les 30 morts du jour, réparties le long du niveau", () => {
  it("par section d'abord (⌊30 ÷ sections⌋ chacune, dans l'ordre d'arrivée), le reste seulement une fois le niveau fini", () => {
    // 6 sections → 5 par section ; 12 morts dans la section 0 puis 3 dans la section 4.
    const list = [...Array.from({ length: 12 }, (_, i) => cand(`a${i}`, 0)), ...Array.from({ length: 3 }, (_, i) => cand(`e${i}`, 4))];
    const first = chooseLives(list, [], 6, false);
    expect(first.map((c) => c.code)).toEqual(["a0", "a1", "a2", "a3", "a4", "e0", "e1", "e2"]);
    // Fini : le quota se remplit avec les morts suivantes, d'où qu'elles viennent (ordre d'arrivée).
    const all = chooseLives(list, [], 6, true);
    expect(all.map((c) => c.code)).toEqual(list.map((c) => c.code));
    // Jamais plus que 30 − déjà parties ; celles déjà parties comptent dans leur section.
    const sent = Array.from({ length: 27 }, (_, i) => cand(`s${i}`, i % 6));
    expect(chooseLives(list, sent, 6, true)).toHaveLength(3);
    expect(chooseLives(list, Array.from({ length: 30 }, (_, i) => cand(`s${i}`, 1)), 6, true)).toEqual([]);
    const fullSection0 = Array.from({ length: 5 }, (_, i) => cand(`s${i}`, 0));
    expect(chooseLives(list, fullSection0, 6, false).map((c) => c.code)).toEqual(["e0", "e1", "e2"]);
  });

  it("plus de sections que de places : au moins une mort par section ; des sections inconnues sont ramenées dans les bornes", () => {
    const list = Array.from({ length: 40 }, (_, i) => cand(`m${i}`, i));
    const picked = chooseLives(list, [], 40, false);
    expect(picked).toHaveLength(LIVES_PER_DAY);
    expect(chooseLives([cand("x", 99), cand("y", -3)], [], 2, false).map((c) => c.code)).toEqual(["x", "y"]);
  });
});

describe("LivesQueue : lots, reprise, purge", () => {
  const today = DAY;
  it("un lot par jour, accepté : parties ; doublon : partie ; écartée : jamais renvoyée ; plafond : jour clos ; gardée d'une page à l'autre", () => {
    let now = 1_000;
    const store = new MemStore();
    const q = new LivesQueue(store, () => now);
    const lives = Array.from({ length: 6 }, (_, i) => cand(`v${i}`, i % 3));
    expect(q.add(DATE, D.id, 3, lives)).toBe(true);
    expect(q.add(DATE, D.id, 3, lives)).toBe(false); // déjà connues
    const lot = q.due()!;
    expect(lot.lives.map((l) => l.code)).toEqual(["v0", "v1", "v2", "v3", "v4", "v5"]);
    q.confirm(DATE, lot.lives, ["ok", "duplicate", "invalid", "not_death", "too_long", "ok"], 3);
    expect(q.day(DATE)).toMatchObject({ sent: [cand("v0", 0), cand("v1", 1), cand("v5", 2)], candidates: [], full: false });
    expect(q.due()).toBeNull();
    // Rechargée : la même file.
    const again = new LivesQueue(store, () => now);
    expect(again.day(DATE)?.sent).toHaveLength(3);
    again.add(DATE, D.id, 3, [cand("v2", 2), cand("w0", 0)]);
    expect(again.due()!.lives.map((l) => l.code)).toEqual(["w0"]); // v2 était déjà connue (écartée) : jamais renvoyée
    again.confirm(DATE, [cand("w0", 0)], ["over_cap"], 30);
    expect(again.day(DATE)).toMatchObject({ full: true, candidates: [] });
    expect(again.add(DATE, D.id, 3, [cand("z", 1)])).toBe(false);
    expect(store.getItem(LIVES_QUEUE_KEY)).toContain('"full":true');
  });

  it("échec : nouvel essai de plus en plus tard ; joueur inconnu : attente jusqu'au réveil ; purge après la grâce", () => {
    let now = 50_000;
    const q = new LivesQueue(new MemStore(), () => now);
    q.add(DATE, D.id, SECTIONS, [cand("a", 0)]);
    q.failed(DATE);
    expect(q.due()).toBeNull();
    expect(q.nextAt()).toBe(now + RETRY_MS[0]!);
    now += RETRY_MS[0]!;
    expect(q.due()).not.toBeNull();
    q.failed(DATE);
    expect(q.nextAt()).toBe(now + RETRY_MS[1]!);
    q.waitForPlayer(DATE);
    now += 10 * 60_000;
    expect(q.due()).toBeNull();
    expect(q.nextAt()).toBeNull();
    q.wake();
    expect(q.due()?.lives).toEqual([cand("a", 0)]);
    // Le lendemain pendant la grâce : gardé ; après : oublié.
    expect(q.purge(today + 1, GRACE_MS - 1)).toBe(0);
    expect(q.purge(today + 1, GRACE_MS)).toBe(1);
    expect(q.dates).toEqual([]);
  });

  it("au plus 300 morts candidates par jour (les premières) ; un autre niveau le même jour repart de zéro", () => {
    const q = new LivesQueue(null, () => 0);
    q.add(DATE, D.id, 1, Array.from({ length: 400 }, (_, i) => cand(`m${i}`, 0)));
    expect(q.day(DATE)!.candidates).toHaveLength(LIVES_CANDIDATES);
    expect(q.day(DATE)!.candidates[0]!.code).toBe("m0");
    q.add(DATE, `${D.id}x`, 1, [cand("autre", 0)]);
    expect(q.day(DATE)!.candidates).toEqual([cand("autre", 0)]);
  });

  it("ce qui ne part jamais : une archive, un jour à venir, un thème forcé, des réglages modifiés, une lecture (la règle du classement)", () => {
    const base = { mode: "jour" as const, levelDay: DAY, today: DAY, watching: false, tuned: false, trial: false, carnageDemo: false };
    expect(mayRank(base)).toBe(true);
    for (const o of [{ mode: "archive" as const }, { mode: "futur" as const }, { mode: "essai" as const }, { mode: null }, { tuned: true }, { trial: true }, { watching: true }, { levelDay: DAY - 1 }, { carnageDemo: true }]) {
      expect(mayRank({ ...base, ...o }), JSON.stringify(o)).toBe(false);
    }
  });
});

/** Un faux serveur : rend ce qu'on lui dit, garde ce qu'il reçoit. */
function fakeSource(answer: (lot: LivesLot) => ApiResult<LivesResult>) {
  const calls: { id: string; lot: LivesLot; keepalive: boolean }[] = [];
  const source = {
    sendLives: async (id: string, lot: LivesLot, o: { keepalive?: boolean } = {}) => {
      calls.push({ id, lot, keepalive: !!o.keepalive });
      return answer(lot);
    },
  } as unknown as RankSource;
  return { source, calls };
}

const accepted = (lot: LivesLot, dayCount = lot.lives.length): ApiResult<LivesResult> => ({
  ok: true,
  data: { accepted: lot.lives.length, received: lot.lives.length, duplicates: 0, invalid: 0, notDeath: 0, overCap: 0, dayCount, cap: 30, results: lot.lives.map(() => "ok"), message: "" },
});

function sender(source: RankSource | null, id: () => string | null, now = { t: 1_000 }) {
  const queue = new LivesQueue(new MemStore(), () => now.t);
  const timers: number[] = [];
  const s = new LivesSender({ source, queue, playerId: id, today: () => DAY, sinceMidnight: () => 3_600_000, now: () => now.t, setTimer: (_f, ms) => timers.push(ms), clearTimer: () => {} });
  return { s, queue, timers, now };
}

describe("LivesSender : envoi, reprise, jamais bloquant", () => {
  it("envoie un lot (versions du jeu, rediffusions seules), keepalive quand la page se cache", async () => {
    const f = fakeSource((lot) => accepted(lot));
    const { s, queue } = sender(f.source, () => "id1");
    s.offer(DATE, D.id, SECTIONS, [cand(DEATHS[0]!.code, 0), cand(DEATHS[1]!.code, 1)], false);
    await s.flush({ keepalive: true });
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]).toMatchObject({ id: "id1", keepalive: true, lot: { levelId: D.id, simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION, lives: [DEATHS[0]!.code, DEATHS[1]!.code] } });
    expect(Object.keys(f.calls[0]!.lot).sort()).toEqual(["generatorVersion", "levelId", "lives", "simVersion"]);
    expect(queue.day(DATE)!.sent).toHaveLength(2);
    expect(s.status).toBe("sent");
  });

  it("réseau coupé : rien n'est perdu, nouvel essai programmé ; le réseau revient : ça part", async () => {
    let online = false;
    const f = fakeSource((lot) => (online ? accepted(lot) : { ok: false, status: 0, code: "network", message: "x" }));
    const { s, queue, timers } = sender(f.source, () => "id1");
    s.offer(DATE, D.id, SECTIONS, [cand("a", 0)], false);
    await s.flush();
    expect(s.status).toBe("offline");
    expect(timers.at(-1)).toBe(RETRY_MS[0]);
    expect(queue.day(DATE)!.candidates).toHaveLength(1);
    online = true;
    s.wake();
    await s.flush();
    expect(queue.day(DATE)!.sent).toHaveLength(1);
  });

  it("joueur inconnu du serveur (404) ou sans identité : les vies attendent sa première arrivée acceptée ; rien n'est créé", async () => {
    let known = false;
    const f = fakeSource((lot) => (known ? accepted(lot) : { ok: false, status: 404, code: "unknown_player", message: "x" }));
    let id: string | null = null;
    const { s, queue } = sender(f.source, () => id);
    s.offer(DATE, D.id, SECTIONS, [cand("a", 0)], false);
    await s.flush();
    expect(f.calls).toHaveLength(0); // pas d'identité : rien n'est envoyé, rien n'est créé
    expect(s.status).toBe("waiting");
    id = "id9";
    await s.flush();
    expect(f.calls).toHaveLength(0); // toujours en attente : le réveil vient de la première arrivée acceptée
    s.wake();
    await s.flush();
    expect(f.calls).toHaveLength(1);
    expect(queue.day(DATE)!.waiting).toBe(true);
    known = true;
    s.wake();
    await s.flush();
    expect(queue.day(DATE)!.sent).toHaveLength(1);
  });

  it("autre version, jour figé : le jour est oublié ; sans serveur (démonstration) : rien", async () => {
    const f = fakeSource(() => ({ ok: false, status: 409, code: "version", message: "x" }));
    const { s, queue } = sender(f.source, () => "id1");
    s.offer(DATE, D.id, SECTIONS, [cand("a", 0)], false);
    await s.flush();
    expect([s.status, queue.dates]).toEqual(["version", []]);
    const off = sender(null, () => "id1");
    off.s.offer(DATE, D.id, SECTIONS, [cand("a", 0)], false);
    await off.s.flush();
    expect([off.s.enabled, off.s.status, off.queue.dates]).toEqual([false, "off", []]);
  });

  it("le client HTTP envoie `keepalive` quand on le demande, jamais l'identifiant dans l'adresse", async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    const src = new HttpRankSource("https://api.test", async (url, init) => {
      seen.push({ url, init });
      return new Response(JSON.stringify({ accepted: 0 }), { status: 200 });
    });
    await src.sendLives("abc", { levelId: D.id, simVersion: 3, generatorVersion: 9, lives: ["x"] }, { keepalive: true });
    await src.sendLives("abc", { levelId: D.id, simVersion: 3, generatorVersion: 9, lives: ["x"] });
    await src.deaths(DATE);
    await src.carnage(DATE);
    expect(seen.map((c) => c.url)).toEqual(["https://api.test/api/jump/lives", "https://api.test/api/jump/lives", `https://api.test/api/jump/day/${DATE}/deaths`, `https://api.test/api/jump/day/${DATE}/carnage`]);
    expect([seen[0]!.init.keepalive, seen[1]!.init.keepalive]).toEqual([true, undefined]);
    expect((seen[0]!.init.headers as Record<string, string>)["X-Player-Id"]).toBe("abc");
  });
});

describe("taches de tout le monde : plus pâles, plus petites, plafonnées, jamais sur un danger ni un fanion", () => {
  const level = D.level;
  const keep = keepoutOf(level);
  // Une mort sur chaque tuile vide du niveau, avec des comptes variés : le pire cas pour la lisibilité.
  const tiles: [number, number, number, number][] = [];
  for (let row = 0; row < level.height; row++) for (let col = 0; col < level.width; col++) if (level.tiles[row * level.width + col] === 0) tiles.push([col, row, 1 + ((col * 7 + row) % 30), 1]);

  it("plafond de tuiles ; intensité croissante avec le nombre de morts, plafonnée, toujours sous celle des tiennes", () => {
    const list = othersStains(level, tiles, keep);
    expect(list.length).toBeLessThanOrEqual(OTHERS_MAX_TILES);
    expect(list.length).toBeGreaterThan(OTHERS_MAX_TILES / 2);
    expect(othersStrength(1)).toBe(OTHERS_STRENGTH_MIN);
    expect(othersStrength(1000)).toBe(OTHERS_STRENGTH_MAX);
    expect(othersStrength(5)).toBeLessThan(othersStrength(6));
    expect(OTHERS_STRENGTH_MAX).toBeLessThan(1);
    for (const o of list) expect(o.strength).toBeLessThanOrEqual(OTHERS_STRENGTH_MAX);
    // Les plus meurtrières d'abord.
    expect(list[0]!.count).toBe(Math.max(...tiles.map((t) => t[2])));
  });

  it("plus petites que les tiennes ; chaque disque à au moins une tuile d'un pic, d'une scie, d'un fanion, du départ et de l'arrivée", () => {
    const list = othersStains(level, tiles, keep);
    let checked = 0;
    for (const o of list) {
      for (const d of o.discs) {
        expect(keepoutDistance(keep, d.x, d.y)).toBeGreaterThanOrEqual(OTHERS_KEEPOUT);
        expect(d.r).toBeLessThan(OTHERS_KEEPOUT);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(100);
    const [col, row] = [tiles[0]![0], tiles[0]![1]];
    const own = stainFor(level, col * UNITS_PER_TILE + UNITS_PER_TILE / 2, row * UNITS_PER_TILE + UNITS_PER_TILE / 2);
    const other = othersStains(level, [[col, row, 3, 1]], { boxes: [], segments: [] })[0]!;
    expect(other.discs.map((d) => d.r)).toEqual(own.map((d) => d.r * OTHERS_SCALE));
  });

  it("une tuile au bord d'un pic ou d'un fanion ne laisse aucun disque dessus", () => {
    const spikes: [number, number, number, number][] = [];
    for (let row = 0; row < level.height; row++) for (let col = 0; col < level.width; col++) if (isSpikeTile(level.tiles[row * level.width + col]!)) spikes.push([col, row - 1, 20, 1]);
    for (const c of level.checkpoints) spikes.push([c.col, c.row, 20, 1]);
    expect(spikes.length).toBeGreaterThan(0);
    for (const o of othersStains(level, spikes, keep)) for (const d of o.discs) expect(keepoutDistance(keep, d.x, d.y)).toBeGreaterThanOrEqual(OTHERS_KEEPOUT);
    // Une carte illisible (tuiles hors du niveau, comptes nuls) ne dessine rien.
    expect(othersStains(level, [[-5, 3, 9, 1], [3, 2, 0, 1], [level.width + 4, 1, 3, 1]], keep)).toEqual([]);
  });
});

describe("carnage de tout le monde : vies jouables, calendrier, compteur", () => {
  const sample = (lives: { replay: string; p: number }[], extra: Partial<CarnageSampleData> = {}): CarnageSampleData => ({
    date: DATE,
    levelId: D.id,
    open: true,
    simVersion: JUMP_SIM_VERSION,
    generatorVersion: JUMP_GENERATOR_VERSION,
    players: new Set(lives.map((l) => l.p)).size,
    dayPlayers: 40,
    lives: lives.map((l) => ({ ...l, section: 0 })),
    ...extra,
  });

  it("écarte les vies d'une autre version, d'un autre niveau, illisibles, à l'en-tête impossible, et les tiennes", () => {
    const cp = DEATHS.find((d) => d.checkpoint >= 1)!;
    const impossible = encodeReplay({ ...cp.replay, start: { ...cp.replay.start, sections: cp.replay.start.sections.map(() => -1) } });
    const otherVersion = encodeReplay({ ...DEATHS[0]!.replay, simVersion: JUMP_SIM_VERSION + 1 });
    const s = sample([
      { replay: DEATHS[0]!.code, p: 0 },
      { replay: DEATHS[1]!.code, p: 1 },
      { replay: impossible, p: 2 },
      { replay: otherVersion, p: 3 },
      { replay: "illisible", p: 4 },
      { replay: DEATHS[2]!.code, p: 5 },
    ]);
    const e = everyoneLives(D.level, D.id, s, new Set([DEATHS[2]!.code]));
    expect(e.lives.map((l) => encodeReplay(l))).toEqual([DEATHS[0]!.code, DEATHS[1]!.code]);
    expect([e.players, e.rejected, e.own]).toEqual([[0, 1], 3, 1]);
    expect(everyoneLives(D.level, D.id, sample([{ replay: DEATHS[0]!.code, p: 0 }], { simVersion: 99 }), new Set()).lives).toEqual([]);
    expect(everyoneLives(D.level, D.id, sample([{ replay: DEATHS[0]!.code, p: 0 }], { levelId: "jour-2026-10-21-g9" }), new Set()).lives).toEqual([]);
  });

  it("chaque vie part quand le héros passe son point de départ (vagues du lot 3) ; le compteur dit les vies qui partiront et leurs joueurs", () => {
    const lives = DEATHS.slice(0, 40).map((d, i) => ({ replay: d.code, p: i % 13 }));
    const e = everyoneLives(D.level, D.id, sample(lives), new Set());
    const plan = everyonePlan(D.level, D.replay, e);
    expect(plan.depart).toEqual(carnageSchedule(D.level, D.replay, e.lives).depart);
    e.lives.forEach((l, i) => {
      if (l.start.checkpoint < 0) expect(plan.depart[i]).toBe(0);
      else expect(plan.depart[i]).toBeGreaterThan(0);
    });
    // Les départs suivent l'ordre des points de passage.
    const byCp = new Map<number, number>();
    e.lives.forEach((l, i) => byCp.set(l.start.checkpoint, plan.depart[i]!));
    const cps = [...byCp.keys()].sort((a, b) => a - b);
    for (let k = 1; k < cps.length; k++) expect(byCp.get(cps[k]!)!).toBeGreaterThanOrEqual(byCp.get(cps[k - 1]!)!);
    expect(plan.lives).toBe(plan.depart.filter((d) => d >= 0).length);
    expect(plan.label).toBe(everyoneLabel(plan.lives, plan.players));
    expect(everyoneLabel(142, 37)).toBe("142 vies de 37 joueurs");
    expect(everyoneLabel(1, 1)).toBe("1 vie de 1 joueur");
  });
});

describe("démonstration ?api=demo : carte et échantillon des joueurs fictifs", () => {
  const index = JSON.parse(readFileSync(new URL("../public/demo/index.json", import.meta.url), "utf8")) as { demoToday: string };
  const today = JSON.parse(readFileSync(new URL(`../public/demo/${index.demoToday}.json`, import.meta.url), "utf8")) as DemoDay;
  const archive = JSON.parse(readFileSync(new URL("../public/demo/2026-10-20.json", import.meta.url), "utf8")) as DemoDay;

  it("la carte et l'échantillon du jour et d'une archive (figés), rien n'est envoyé", async () => {
    expect(index.demoToday).toBe(formatDay(DEMO_TODAY));
    const files = new Map<string, unknown>([
      ["demo/index.json", JSON.parse(readFileSync(new URL("../public/demo/index.json", import.meta.url), "utf8"))],
      [`demo/${today.date}.json`, today],
      [`demo/${archive.date}.json`, archive],
    ]);
    const src = new DemoRankSource("demo/", new MemStore(), async (url) => new Response(JSON.stringify(files.get(url) ?? {}), { status: files.has(url) ? 200 : 404 }));
    const map = await src.deaths(today.date);
    expect(map).toMatchObject({ ok: true, data: { date: today.date, levelId: today.levelId, open: true, players: today.deaths!.players } });
    const frozen = await src.deaths(archive.date);
    expect(frozen).toMatchObject({ ok: true, data: { open: false, tiles: archive.deaths!.tiles } });
    const c = await src.carnage(archive.date);
    expect(c.ok && c.data.lives.length).toBe(archive.carnage!.lives.length);
    expect(c).toMatchObject({ ok: true, data: { simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION } });
    expect((src as RankSource).sendLives).toBeUndefined();
  });
});
