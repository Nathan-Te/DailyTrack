import { beforeAll, describe, expect, it } from "vitest";
import { daysFromCivil, formatDay } from "@cdj/core";
import { PREMIER_JOUR, circuitNumber, medalFor, medalsFor, themeForDay } from "@cdj/sim";
import { JUMP_GENERATOR_VERSION, JUMP_SIM_VERSION, PREMIER_JOUR_JUMP, TICK_RATE, dailyLevel, demoAttempts, encodeReplay, jumpMedalFor, lifeReplay, replayAttempt, type DailyLevel } from "@cdj/jump-sim";
import type { GameDefinition, PortailDuJeu } from "../src/games";
import { GRACE_MS } from "../src/cdj";
import { PORTAIL_PUBLIC_MAX_S, PORTAIL_READS_PER_CLIENT, PREMIER_JOUR_DU_JOUR, serieEtParfaites } from "../src/portail";
import { GAMES } from "../src/registry";
import { circuitOf, makeApi, parisDay, parisDayStart, pilotReplay, playerId, TEST_DB } from "./helpers";

// Lot I2 (plateforme, phase 3) : le portail. La route regroupée `GET /api/portail/jour` (les jeux du jour ; avec `X-Player-Id`, l'état du joueur
// dans chaque jeu, sa série tous jeux confondus et ses journées parfaites) et le profil commun `GET /api/portail/profil`. Chaque jeu déclare au
// registre ce que le portail montre de lui (crochet `portail`) : un faux jeu n° 3 le prouve. **Aucun temps n'est cru** : `fini` vient du
// classement prouvé (rejeu). Les jours sont ceux de Paris, changements d'heure compris (25/10/2026 : 25 h ; 28/03/2027 : 23 h).
// SQLite **et** libSQL.

const TODAY = daysFromCivil(2026, 10, 20);
const DATE = formatDay(TODAY);
const NOON = parisDayStart(TODAY) + 12 * 3_600_000;
const as = (n: number) => ({ headers: { "X-Player-Id": playerId(n) } });

let J: DailyLevel;
let jumpRun: { code: string; ticks: number };
let lives: string[];
let track: { code: string; finishMs: number };

beforeAll(() => {
  J = dailyLevel(TODAY);
  lives = [];
  // Lot 26 : le niveau du jour (g20) peut n'offrir aucun essai fictif plus lent que l'auteur avec la première graine : on en essaie quelques-unes (le contrat est « une course qui arrive, plus lente »).
  for (const seed of [0x5eed, 0x5eee, 0x5eef, 0x5ef0, 0x5ef1, 0x5ef2]) {
    for (const a of demoAttempts(J.level, J.replay, seed, { attempts: 40 }).filter((x) => x.end === "arrivée")) {
      const r = replayAttempt(J.level, a.replay, J.id);
      if (r.finished && r.time > J.authorTicks) {
        jumpRun = { code: encodeReplay(a.replay), ticks: r.time };
        break;
      }
    }
    if (jumpRun) break;
  }
  for (const a of demoAttempts(J.level, J.replay, 0x11fe, { attempts: 40, maxLives: 8 })) {
    for (const life of replayAttempt(J.level, a.replay, J.id).lives) {
      const code = encodeReplay(lifeReplay(a.replay, life));
      if (life.end === "mort" && lives.length < 6 && !lives.includes(code)) lives.push(code);
    }
  }
  track = pilotReplay(TODAY, 0.8);
  if (!jumpRun || lives.length < 4) throw new Error("trop peu d'essais fictifs");
}, 60_000);

async function portailApi(options: Parameters<typeof makeApi>[0] = {}) {
  const t = await makeApi({ seed: false, ...options });
  t.clock.now = NOON;
  return t;
}

const jumpBody = (extra: Record<string, unknown>) => ({ levelId: J.id, simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION, ...extra });

/** Insère directement des jours finis (historique de la série : les tests du classement prouvé sont ailleurs, et ci-dessous pour aujourd'hui). */
async function historique(t: Awaited<ReturnType<typeof portailApi>>, id: string, jours: { track?: number[]; jump?: number[] }) {
  await t.call("GET", "/api/portail/jour", undefined, { clientKey: "192.0.2.1" }); // le schéma (une autre adresse : le débit des tests reste entier)
  await t.db.run("INSERT OR IGNORE INTO players (id, name, created_at, updated_at, name_key) VALUES (?, ?, 0, 0, ?)", [id, `J${id.slice(-4)}`, `j${id.slice(-4)}`]);
  for (const d of jours.track ?? []) await t.db.run("INSERT INTO results (day, player_id, ms, splits, replay, respawns, submitted_at) VALUES (?, ?, 40000, '[]', 'x', 0, 0)", [d, id]);
  for (const d of jours.jump ?? []) {
    await t.db.run(
      "INSERT INTO jump_results (day, player_id, level_id, ticks, deaths, replay, sim_version, generator_version, first_at, submitted_at) VALUES (?, ?, ?, 5000, 0, 'x', 1, 1, 0, 0)",
      [d, id, `jour-${formatDay(d)}-g1`],
    );
  }
}

describe("série tous jeux confondus et journées parfaites (pur)", () => {
  const jeux = (track: number[], jump: number[], premierJump = PREMIER_JOUR_JUMP) => [
    { premierJour: PREMIER_JOUR, finis: new Set(track) },
    { premierJour: premierJump, finis: new Set(jump) },
  ];
  const T = TODAY;

  it("au moins un jeu fini par jour ; aujourd'hui pas encore fini : la série court jusqu'à hier (`aProlonger`)", () => {
    expect(serieEtParfaites(T, jeux([T - 2, T - 1, T], []))).toEqual({ serie: 3, aProlonger: false, journeesParfaites: 0, aujourdhuiParfaite: false });
    expect(serieEtParfaites(T, jeux([T - 2], [T - 1]))).toEqual({ serie: 2, aProlonger: true, journeesParfaites: 0, aujourdhuiParfaite: false });
    // Track un jour, Jump le suivant : la série tient (au moins un jeu par jour).
    expect(serieEtParfaites(T, jeux([T - 3, T - 1], [T - 2, T])).serie).toBe(4);
  });

  it("une série cassée vaut 0 ; un trou la coupe", () => {
    expect(serieEtParfaites(T, jeux([T - 2], []))).toEqual({ serie: 0, aProlonger: false, journeesParfaites: 0, aujourdhuiParfaite: false });
    expect(serieEtParfaites(T, jeux([T - 5, T - 4, T - 1, T], [])).serie).toBe(2);
    expect(serieEtParfaites(T, jeux([], []))).toEqual({ serie: 0, aProlonger: false, journeesParfaites: 0, aujourdhuiParfaite: false });
  });

  it("journée parfaite : tous les jeux qui existaient ce jour-là (avant le premier jour de Jump, Track seul suffit)", () => {
    const avantJump = PREMIER_JOUR_JUMP - 1;
    const r = serieEtParfaites(T, jeux([avantJump, PREMIER_JOUR_JUMP, T - 1, T], [T - 1, T]));
    expect(r.journeesParfaites).toBe(3); // la veille du premier jour de Jump, hier et aujourd'hui (le premier jour de Jump : Track seul)
    expect(r.aujourdhuiParfaite).toBe(true);
    // Un jour futur (horloge du client en avance) ne compte pas.
    expect(serieEtParfaites(T, jeux([T + 1], [T + 1])).journeesParfaites).toBe(0);
  });

  it("changements d'heure : le 25/10/2026 (25 h) et le 28/03/2027 (23 h) comptent pour un jour chacun", () => {
    const d25 = parisDay(Date.parse("2026-10-25T12:00:00Z"));
    expect(formatDay(d25)).toBe("2026-10-25");
    // Le dimanche du changement d'heure, à 23 h 30 de Paris (22 h 30 UTC, l'heure d'hiver) : toujours le 25.
    expect(parisDay(Date.parse("2026-10-25T22:30:00Z"))).toBe(d25);
    expect(serieEtParfaites(d25 + 1, jeux([d25 - 1, d25, d25 + 1], [d25]))).toEqual({ serie: 3, aProlonger: false, journeesParfaites: 1, aujourdhuiParfaite: false });
    const d28 = parisDay(Date.parse("2027-03-28T12:00:00Z"));
    expect(formatDay(d28)).toBe("2027-03-28");
    expect(parisDay(Date.parse("2027-03-28T22:30:00Z"))).toBe(d28 + 1); // 00 h 30 de Paris (heure d'été) : déjà le 29
    expect(serieEtParfaites(d28 + 1, jeux([d28 - 1, d28], [d28 - 1, d28]))).toEqual({ serie: 2, aProlonger: true, journeesParfaites: 2, aujourdhuiParfaite: false });
  });
});

describe(`portail : GET /api/portail/jour sans joueur (${TEST_DB})`, () => {
  it("les jeux du jour (numéro, thème, seuils en ms, premier jour), l'heure du serveur, le prochain minuit de Paris ; publique, 60 s au plus", async () => {
    const t = await portailApi();
    const r = await t.call("GET", "/api/portail/jour");
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const m = medalsFor(circuitOf(TODAY).authorMs);
    expect(r.body).toEqual({
      date: DATE,
      journee: null, // lot I3 : avant la journée n° 1 (lot R8 : `config/lancement.json`), aucun numéro
      lancement: formatDay(PREMIER_JOUR_DU_JOUR), // lot R8 : la source unique de la date du lancement
      generation: 0, // lot R8 : la génération de données (0 : base jamais remise à zéro)
      maintenant: new Date(NOON).toISOString(),
      prochainJour: "2026-10-20T22:00:00.000Z", // minuit de Paris (heure d'été : UTC+2)
      jeux: [
        { jeu: "cdj", site: "track", nom: "Track", premierJour: formatDay(PREMIER_JOUR), numero: circuitNumber(TODAY), theme: themeForDay(TODAY).name, seuils: { author: m.author, gold: m.gold, silver: m.silver, bronze: m.bronze } },
        {
          jeu: "jump",
          site: "jump",
          nom: "Jump",
          premierJour: formatDay(PREMIER_JOUR_JUMP),
          numero: J.number,
          theme: J.theme,
          seuils: Object.fromEntries((["author", "gold", "silver", "bronze"] as const).map((k) => [k, Math.round((J.medals[k] * 1000) / TICK_RATE)])),
        },
      ],
    });
    expect(r.body.joueur).toBeUndefined();
    expect(r.headers.get("cache-control")).toBe(`public, max-age=${PORTAIL_PUBLIC_MAX_S}`);
    expect(r.headers.get("vary")).toContain("X-Player-Id");
  });

  it("le cache public ne dépasse jamais le prochain minuit de Paris", async () => {
    const t = await portailApi();
    t.clock.now = parisDayStart(TODAY + 1) - 20_000;
    expect((await t.call("GET", "/api/portail/jour")).headers.get("cache-control")).toBe("public, max-age=20");
    t.clock.now = parisDayStart(TODAY + 1) - 400;
    expect((await t.call("GET", "/api/portail/jour")).headers.get("cache-control")).toBe("public, max-age=0");
    t.clock.now = parisDayStart(TODAY + 1);
    const r = await t.call("GET", "/api/portail/jour");
    expect(r.body.date).toBe(formatDay(TODAY + 1));
    expect(r.body.jeux.map((j: { numero: number }) => j.numero)).toEqual([circuitNumber(TODAY + 1), J.number + 1]);
  }, 30_000);

  it("prochainJour aux changements d'heure : 25/10/2026 (journée de 25 h) et 28/03/2027 (23 h)", async () => {
    const t = await portailApi();
    // 00 h 30 de Paris le 25/10 (encore l'heure d'été) : le prochain minuit est 24 h 30 plus tard (à 23 h UTC, l'heure d'hiver).
    t.clock.now = Date.parse("2026-10-24T22:30:00Z");
    let r = await t.call("GET", "/api/portail/jour");
    expect(r.body.date).toBe("2026-10-25");
    expect(r.body.prochainJour).toBe("2026-10-25T23:00:00.000Z");
    expect(Date.parse(r.body.prochainJour) - t.clock.now).toBe(24.5 * 3_600_000);
    // La veille au soir : minuit du 25 tombe encore à 22 h UTC.
    t.clock.now = Date.parse("2026-10-24T21:59:00Z");
    expect((await t.call("GET", "/api/portail/jour")).body.prochainJour).toBe("2026-10-24T22:00:00.000Z");
    // 28/03/2027 : minuit du 29 à 22 h UTC (heure d'été), la journée a duré 23 h.
    t.clock.now = Date.parse("2027-03-28T10:00:00Z");
    r = await t.call("GET", "/api/portail/jour");
    expect(r.body.date).toBe("2027-03-28");
    expect(r.body.prochainJour).toBe("2027-03-28T22:00:00.000Z");
    expect(parisDayStart(parisDay(t.clock.now) + 1) - parisDayStart(parisDay(t.clock.now))).toBe(23 * 3_600_000);
  }, 60_000);

  it("avant le premier jour d'un jeu, il n'apparaît pas", async () => {
    const t = await portailApi();
    t.clock.now = parisDayStart(PREMIER_JOUR_JUMP - 1) + 12 * 3_600_000;
    const r = await t.call("GET", "/api/portail/jour");
    expect(r.body.jeux.map((j: { jeu: string }) => j.jeu)).toEqual(["cdj"]);
  }, 30_000);
});

describe(`portail : GET /api/portail/jour avec un joueur (${TEST_DB})`, () => {
  it("l'état dans chaque jeu vient du classement prouvé : pas joué → en cours (morts envoyées) → fini (temps rejoué, médaille, rang)", async () => {
    const t = await portailApi();
    // DailyTrack fini : la course est rejouée par le serveur (le temps annoncé n'existe pas).
    const s = await t.call("POST", "/api/submit", { playerId: playerId(1), name: "Alice", date: DATE, replay: track.code });
    expect(s.status, JSON.stringify(s.body)).toBe(200);
    let r = await t.call("GET", "/api/portail/jour", undefined, as(1));
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const [cdj, jump] = r.body.jeux;
    expect(cdj.etat).toEqual({ statut: "fini", tempsMs: s.body.ms, medaille: medalFor(s.body.ms, medalsFor(circuitOf(TODAY).authorMs)), rang: 1, classes: 1 });
    expect(jump.etat).toEqual({ statut: "pas_joue" });
    // Lot A1 : un seul jeu fini, donc pas de temps cumulé ; sa place (sous « un jeu sur deux ») existe quand même.
    expect(r.body.joueur).toEqual({ pseudo: "Alice", serie: 1, aProlonger: false, journeesParfaites: 0, aujourdhuiParfaite: false, cumulMs: null, rangDuJour: 1, classesDuJour: 1 });
    expect(r.headers.get("cache-control")).toBe("private, no-cache");
    expect(r.headers.get("vary")).toContain("X-Player-Id");
    // DailyJump en cours : des morts envoyées (rejouées), aucun essai classé.
    expect((await t.call("POST", "/api/jump/lives", jumpBody({ lives: lives.slice(0, 4) }), as(1))).body.accepted).toBe(4);
    r = await t.call("GET", "/api/portail/jour", undefined, as(1));
    expect(r.body.jeux[1].etat).toEqual({ statut: "en_cours", morts: 4 });
    // DailyJump fini : journée parfaite.
    const j = await t.call("POST", "/api/jump/submit", jumpBody({ replay: jumpRun.code }), as(1));
    expect(j.status, JSON.stringify(j.body)).toBe(200);
    r = await t.call("GET", "/api/portail/jour", undefined, as(1));
    expect(r.body.jeux[1].etat).toEqual({ statut: "fini", tempsMs: Math.round((jumpRun.ticks * 1000) / TICK_RATE), medaille: jumpMedalFor(jumpRun.ticks, J.medals), rang: 1, classes: 1 });
    expect(r.body.joueur).toMatchObject({ pseudo: "Alice", serie: 1, aProlonger: false, journeesParfaites: 1, aujourdhuiParfaite: true, rangDuJour: 1, classesDuJour: 1 });
    // Un second classé plus lent : Alice reste première sur 2.
    expect((await t.call("POST", "/api/submit", { playerId: playerId(2), name: "Bruno", date: DATE, replay: pilotReplay(TODAY, 0.5).code })).status).toBe(200);
    t.clock.now += 31_000; // le nombre de classés est gardé 30 s par instance
    r = await t.call("GET", "/api/portail/jour", undefined, as(2));
    expect(r.body.jeux[0].etat).toMatchObject({ statut: "fini", rang: 2, classes: 2 });
    expect(JSON.stringify(r.body)).not.toContain(playerId(2));
  }, 120_000);

  it("série et journées parfaites sur l'historique ; aujourd'hui pas fini : `aProlonger`", async () => {
    const t = await portailApi();
    const id = playerId(7);
    await historique(t, id, { track: [TODAY - 5, TODAY - 4, TODAY - 3, TODAY - 2, TODAY - 1], jump: [TODAY - 2, TODAY - 1] });
    const r = await t.call("GET", "/api/portail/jour", undefined, as(7));
    // Parfaites : hier, avant-hier, et le 15/10 (la veille du premier jour de Jump : Track seul existait) ; pas le 16 (Jump existait, pas fini).
    expect(formatDay(TODAY - 5)).toBe("2026-10-15");
    expect(r.body.joueur).toEqual({ pseudo: "J0007", serie: 5, aProlonger: true, journeesParfaites: 3, aujourdhuiParfaite: false, cumulMs: null, rangDuJour: null, classesDuJour: null });
    expect(r.body.jeux.map((j: { etat: { statut: string } }) => j.etat.statut)).toEqual(["pas_joue", "pas_joue"]);
  });

  it("le changement d'heure du 25/10/2026 ne casse pas la série (jours de Paris)", async () => {
    const t = await portailApi();
    const d25 = daysFromCivil(2026, 10, 25);
    await historique(t, playerId(8), { track: [d25 - 2, d25 - 1, d25], jump: [d25] });
    t.clock.now = Date.parse("2026-10-25T22:30:00Z"); // 23 h 30 à Paris, le 25 (heure d'hiver depuis 3 h)
    const r = await t.call("GET", "/api/portail/jour", undefined, as(8));
    expect(r.body.date).toBe("2026-10-25");
    expect(r.body.joueur).toMatchObject({ serie: 3, aProlonger: false, journeesParfaites: 1, aujourdhuiParfaite: true });
    t.clock.now = Date.parse("2026-10-25T23:00:00Z"); // minuit : le 26, rien encore
    const r2 = await t.call("GET", "/api/portail/jour", undefined, as(8));
    expect(r2.body.date).toBe("2026-10-26");
    expect(r2.body.joueur).toMatchObject({ serie: 3, aProlonger: true, aujourdhuiParfaite: false });
  }, 60_000);

  it("joueur inconnu : 404 `unknown_player` ; code révoqué : 410 `code_revoked` ; les deux portent quand même les jeux du jour", async () => {
    const t = await portailApi();
    const r = await t.call("GET", "/api/portail/jour", undefined, as(99));
    expect(r.status).toBe(404);
    expect(r.body.error).toBe("unknown_player");
    expect(r.body.jeux.map((j: { jeu: string }) => j.jeu)).toEqual(["cdj", "jump"]);
    expect(r.body.joueur).toBeUndefined();
    expect(r.headers.get("cache-control")).toBe("no-store");
    await historique(t, playerId(3), { track: [TODAY - 1] });
    expect((await t.call("POST", "/api/me/code", { newId: playerId(4) }, as(3))).status).toBe(200);
    const v = await t.call("GET", "/api/portail/jour", undefined, as(3));
    expect(v.status).toBe(410);
    expect(v.body.error).toBe("code_revoked");
    expect(v.body.jeux).toHaveLength(2);
    expect((await t.call("GET", "/api/portail/jour", undefined, as(4))).body.joueur.serie).toBe(1);
    expect((await t.call("GET", "/api/portail/jour", undefined, { headers: { "X-Player-Id": "pas-un-id" } })).status).toBe(400);
  });

  it("lectures limitées (en mémoire, par adresse) ; aucune ligne écrite", async () => {
    const t = await portailApi();
    await historique(t, playerId(5), { track: [TODAY - 1] });
    const before = await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM rate");
    for (let i = 0; i < PORTAIL_READS_PER_CLIENT; i++) expect((await t.call("GET", "/api/portail/jour", undefined, i % 2 ? as(5) : {})).status).toBe(200);
    const r = await t.call("GET", "/api/portail/jour");
    expect(r.status).toBe(429);
    expect(r.body.error).toBe("rate_limited");
    expect((await t.call("GET", "/api/portail/jour", undefined, { clientKey: "198.51.100.9" })).status).toBe(200);
    expect(await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM rate")).toEqual(before);
    expect((await t.call("POST", "/api/portail/jour")).status).toBe(405);
    expect((await t.call("GET", "/api/portail/autre")).status).toBe(404);
  }, 60_000);
});

describe(`portail : le profil commun GET /api/portail/profil (${TEST_DB})`, () => {
  it("pseudo, série, journées parfaites ; par jeu jours finis, médailles, meilleure place (DailyJump : places finales gardées)", async () => {
    const t = await portailApi();
    expect((await t.call("POST", "/api/submit", { playerId: playerId(1), name: "Alice", date: DATE, replay: track.code })).status).toBe(200);
    expect((await t.call("POST", "/api/jump/submit", jumpBody({ replay: jumpRun.code, name: "Alice" }), as(1))).status).toBe(200);
    expect((await t.call("POST", "/api/jump/submit", jumpBody({ replay: encodeReplay(J.replay), name: "Bruno" }), as(2))).status).toBe(200); // l'auteur : premier
    let r = await t.call("GET", "/api/portail/profil", undefined, as(1));
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body).toMatchObject({ pseudo: "Alice", renameRequired: false, date: DATE, serie: 1, aProlonger: false, journeesParfaites: 1, aujourdhuiParfaite: true });
    const [cdj, jump] = r.body.jeux;
    expect(cdj).toMatchObject({ jeu: "cdj", joursFinis: 1, meilleurRang: { date: DATE, rang: 1, classes: 1 } });
    expect(jump).toMatchObject({ jeu: "jump", joursFinis: 1, meilleurRang: { date: DATE, rang: 2, classes: 2 } });
    expect(Object.values(jump.medailles as Record<string, number>).reduce((a, b) => a + b, 0)).toBe(jumpMedalFor(jumpRun.ticks, J.medals) ? 1 : 0);
    expect(r.headers.get("cache-control")).toBe("private, no-cache");
    // Le lendemain, après la grâce : la place d'hier est calculée une fois, puis gardée.
    t.clock.now = parisDayStart(TODAY + 1) + GRACE_MS + 1000;
    r = await t.call("GET", "/api/portail/profil", undefined, as(1));
    expect(r.body.jeux[1].meilleurRang).toEqual({ date: DATE, rang: 2, classes: 2 });
    expect(r.body).toMatchObject({ serie: 1, aProlonger: true });
    expect(await t.db.first("SELECT final_rank, final_total FROM jump_results WHERE player_id = ?", [playerId(1)])).toEqual({ final_rank: 2, final_total: 2 });
    expect((await t.call("GET", "/api/portail/profil")).status).toBe(400);
    expect((await t.call("GET", "/api/portail/profil", undefined, as(98))).body.error).toBe("unknown_player");
  }, 120_000);
});

describe(`portail : un jeu n° 3 se déclare au registre, la route ne change pas (${TEST_DB})`, () => {
  it("un faux jeu apparaît avec son numéro, son thème, son état ; les journées parfaites le comptent dès son premier jour", async () => {
    const premier = TODAY - 1;
    const finis = new Map<string, number[]>([[playerId(7), [TODAY - 1, TODAY]]]);
    const faux: PortailDuJeu = {
      site: "lune",
      nom: "Lune",
      premierJour: premier,
      jour: async (day) => ({ numero: day - premier + 1, theme: "lune", seuils: { author: 1000, gold: 2000, silver: 3000, bronze: 4000 } }),
      etat: async (id, day) => (finis.get(id)?.includes(day) ? { statut: "fini", tempsMs: 1500, medaille: "gold", rang: 1, classes: 1 } : { statut: "pas_joue" }),
      joursFinis: async (id) => finis.get(id) ?? [],
      profil: async () => ({ joursFinis: 0, medailles: { author: 0, gold: 0, silver: 0, bronze: 0 }, meilleurRang: null }),
      classes: async () => [],
    };
    const FAUX: GameDefinition<never> = {
      code: "lune",
      name: "Faux jeu",
      prefix: "/api/lune",
      tables: [],
      schema: [],
      versions: () => ({}),
      create: () => ({ route: async () => undefined, dailyLevel: async () => null, portail: faux }),
    };
    const t = await portailApi({ games: [...GAMES, FAUX] });
    await historique(t, playerId(7), { track: [TODAY - 2, TODAY - 1, TODAY], jump: [TODAY - 2, TODAY - 1] });
    const pub = await t.call("GET", "/api/portail/jour");
    expect(pub.body.jeux.map((j: { jeu: string }) => j.jeu)).toEqual(["cdj", "jump", "lune"]);
    expect(pub.body.jeux[2]).toEqual({ jeu: "lune", site: "lune", nom: "Lune", premierJour: formatDay(premier), numero: 2, theme: "lune", seuils: { author: 1000, gold: 2000, silver: 3000, bronze: 4000 } });
    const r = await t.call("GET", "/api/portail/jour", undefined, as(7));
    expect(r.body.jeux[2].etat).toMatchObject({ statut: "fini", tempsMs: 1500 });
    // Avant-hier : le faux jeu n'existait pas (Track et Jump suffisent) ; hier : les trois ; aujourd'hui : Jump manque.
    expect(r.body.joueur).toMatchObject({ serie: 3, journeesParfaites: 2, aujourdhuiParfaite: false });
  });
});
