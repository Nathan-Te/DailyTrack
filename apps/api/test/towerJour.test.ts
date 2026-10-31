import { formatDay } from "@cdj/core";
import { dailyTower, empreinteContenu, estimationGeometrique, lireJour, numeroTower, PREMIER_JOUR_TOWER, TOWER_GENERATOR_VERSION, TOWER_SIM_VERSION } from "@cdj/tower-sim";
import { describe, expect, it } from "vitest";
import { GAMES } from "../src/registry";
import { TOWER_GRACE_MS } from "../src/tower";
import { GRACE_MS } from "../src/cdj";
import { creerTablesTower, fixtureJour, towerGame } from "../scripts/tower-aide";
import { D, monterTower } from "../scripts/tower-test";
import { DAY_MS, makeApi, ouvrirJeu } from "./helpers";

// Lot T4 — le contenu du jour de Tower sur le serveur : « serveur = jeu » (même règle que `apps/tower/src/jour.ts`), les fichiers du jour de l'image, la lecture publique. SQLite et libSQL.

const jourMs = (jour: number, h = 12) => jour * DAY_MS + h * 3_600_000;
const monter = (date: string, frozen: Record<string, unknown> = {}) => monterTower(date, { frozen });

describe("Tower : le jour (lot T4)", () => {
  it("la grâce après minuit est celle de DailyTrack, et rien d'un jeu inconnu n'est servi sans Tower au registre", () => {
    expect(TOWER_GRACE_MS).toBe(GRACE_MS);
    expect(GAMES.map((g) => g.code)).not.toContain("tower"); // le registre l'inscrira un lot de la plateforme (cahier des charges)
  });

  it("GET /api/tower/info : versions, jour de Paris, jours de l'image, environnement", async () => {
    const t = await monter("2026-11-10", { "2026-11-07": fixtureJour("2026-11-07") });
    const r = await t.call("GET", "/api/tower/info");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ game: "tower", simVersion: TOWER_SIM_VERSION, generatorVersion: TOWER_GENERATOR_VERSION, today: "2026-11-10", frozenDays: ["2026-11-07"], environment: "local" });
  });

  it("serveur = jeu : sur 60 dates sans fichier, le contenu, le thème, le tirage et les médailles sont ceux du générateur courant (tirage 0) et de l'estimation", async () => {
    const t = await monter("2027-01-20");
    for (let i = 0; i < 60; i++) {
      const jour = PREMIER_JOUR_TOWER + i;
      const date = formatDay(jour);
      const r = await t.call("GET", `/api/tower/day/${date}`);
      expect(r.status, date).toBe(200);
      const c = dailyTower(jour, TOWER_GENERATOR_VERSION, 0);
      const m = estimationGeometrique(c);
      expect(r.body, date).toEqual({
        date,
        empreinte: empreinteContenu(c),
        number: numeroTower(jour),
        theme: c.theme,
        tirage: 0,
        medals: { author: m.auteur, gold: m.or, silver: m.argent, bronze: m.bronze },
        source: "genere",
        provisoire: true,
        simVersion: TOWER_SIM_VERSION,
        generatorVersion: TOWER_GENERATOR_VERSION,
      });
    }
  });

  it("serveur = jeu : un fichier préparé (preuve rejouée) donne son contenu, son tirage et ses médailles ; la preuve n'est jamais rendue", async () => {
    const dates = ["2026-11-06", "2026-11-07", "2026-11-08", "2026-11-17"];
    const frozen = Object.fromEntries(dates.map((d) => [d, fixtureJour(d)]));
    const t = await monter("2026-11-20", frozen);
    for (const date of dates) {
      const lu = lireJour(frozen[date], D(date));
      if (typeof lu === "string") throw new Error(lu);
      const r = await t.call("GET", `/api/tower/day/${date}`);
      expect(r.status, date).toBe(200);
      expect(r.body.source, date).toBe("prepare");
      expect(r.body.provisoire, date).toBe(false);
      expect(r.body.empreinte, date).toBe(empreinteContenu(lu.contenu));
      expect(r.body.tirage, date).toBe(lu.contenu.tirage ?? 0);
      expect(r.body.generatorVersion, date).toBe(lu.contenu.g);
      expect(r.body.medals, date).toEqual({ author: lu.medailles!.auteur, gold: lu.medailles!.or, silver: lu.medailles!.argent, bronze: lu.medailles!.bronze });
      expect(JSON.stringify(r.body), date).not.toContain(lu.preuve!);
      expect(Object.keys(r.body), date).not.toContain("preuve");
    }
    // Le 17/11 : le tirage 1 (le tirage 0 de ce jour est celui que la préparation écarte).
    expect((await t.call("GET", "/api/tower/day/2026-11-17")).body.tirage).toBe(1);
  });

  it("un fichier abîmé (preuve qui ne donne plus le Diamant écrit) est refusé : le jour est généré, la raison est journalisée sans donnée personnelle", async () => {
    const abime = { ...fixtureJour("2026-11-07"), medailles: { auteur: 59_000, or: 29_500, argent: 17_700, bronze: 8_850 } };
    const lignes: string[] = [];
    const t = await makeApi({ seed: false, games: [...GAMES, towerGame({ frozen: { "2026-11-07": abime } })], log: (s, m, f) => lignes.push(JSON.stringify({ s, m, f })) });
    await creerTablesTower(t.db);
    await ouvrirJeu(t, "tower");
    t.clock.now = jourMs(D("2026-11-10"));
    const r = await t.call("GET", "/api/tower/day/2026-11-07");
    expect(r.status).toBe(200);
    expect(r.body.source).toBe("genere");
    expect(r.body.provisoire).toBe(true);
    expect(lignes.some((l) => l.includes("fichier du jour refusé"))).toBe(true);
  });

  it("un fichier seulement figé (sans médailles ni preuve) donne son contenu, avec des médailles provisoires comme dans le jeu", async () => {
    const fige = { ...fixtureJour("2026-11-07"), medailles: null } as Record<string, unknown>;
    delete fige.preuve;
    const t = await monter("2026-11-10", { "2026-11-07": fige });
    const r = await t.call("GET", "/api/tower/day/2026-11-07");
    const lu = lireJour(fige, D("2026-11-07"));
    if (typeof lu === "string") throw new Error(lu);
    expect(r.body.source).toBe("genere");
    expect(r.body.provisoire).toBe(true);
    expect(r.body.empreinte).toBe(empreinteContenu(lu.contenu));
    const m = estimationGeometrique(lu.contenu);
    expect(r.body.medals).toEqual({ author: m.auteur, gold: m.or, silver: m.argent, bronze: m.bronze });
  });

  it("le jour est gardé en base : une seconde instance le relit sans recalculer (et un autre fichier = une autre règle = recalcul)", async () => {
    const f = { "2026-11-07": fixtureJour("2026-11-07") };
    const a = await monter("2026-11-10", f);
    await a.call("GET", "/api/tower/day/2026-11-07");
    const ligne = await a.db.first<{ rule: string; silhouette: string | null; author_hash: string | null; source: string }>("SELECT rule, silhouette, author_hash, source FROM tower_levels WHERE day = ?", [D("2026-11-07")]);
    expect(ligne?.source).toBe("prepare");
    expect(ligne?.author_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.parse(ligne!.silhouette!).length).toBeGreaterThan(0);
    // Même base, nouvelle instance : aucun rejeu de la preuve (le journal ne dit pas « jour calculé »).
    const lignes: string[] = [];
    const b = await makeApi({ seed: false, db: a.db, games: [...GAMES, towerGame({ frozen: f })], log: (_s, m) => lignes.push(m) });
    await ouvrirJeu(b, "tower");
    b.clock.now = a.clock.now;
    expect((await b.call("GET", "/api/tower/day/2026-11-07")).status).toBe(200);
    expect(lignes).not.toContain("DailyTower : jour calculé");
    // Une règle différente (ici : le fichier n'est plus là) recalcule et réécrit la ligne.
    const c = await makeApi({ seed: false, db: a.db, games: [...GAMES, towerGame({ frozen: {} })], log: (_s, m) => lignes.push(m) });
    await ouvrirJeu(c, "tower");
    c.clock.now = a.clock.now;
    expect((await c.call("GET", "/api/tower/day/2026-11-07")).body.source).toBe("genere");
    expect(lignes).toContain("DailyTower : jour calculé");
  });

  it("deux requêtes en même temps ne font qu'un calcul", async () => {
    const lignes: string[] = [];
    const t = await makeApi({ seed: false, games: [...GAMES, towerGame()], log: (_s, m) => lignes.push(m) });
    await creerTablesTower(t.db);
    await ouvrirJeu(t, "tower");
    t.clock.now = jourMs(D("2026-11-10"));
    const [a, b] = await Promise.all([t.call("GET", "/api/tower/day/2026-11-10"), t.call("GET", "/api/tower/day/2026-11-10")]);
    expect(a.body).toEqual(b.body);
    expect(lignes.filter((m) => m === "DailyTower : jour calculé")).toHaveLength(1);
  });

  it("date : illisible 400, future 404, ancienne lue ; le numéro est null avant la tour n° 1 ; lectures en cache public, pas de cookie", async () => {
    const t = await monter("2026-11-10");
    expect((await t.call("GET", "/api/tower/day/hier")).body.error).toBe("invalid_date");
    expect((await t.call("GET", "/api/tower/day/2026-11-11")).body.error).toBe("unknown_day");
    const ancien = await t.call("GET", "/api/tower/day/2026-10-20");
    expect(ancien.status).toBe(200);
    expect(ancien.body.number).toBeNull();
    const ok = await t.call("GET", "/api/tower/day/2026-11-10");
    expect(ok.body.number).toBe(9);
    expect(ok.headers.get("cache-control")).toBe("public, max-age=30");
    expect((await t.call("POST", "/api/tower/day/2026-11-10", {})).body.error).toBe("method_not_allowed");
    expect((await t.call("GET", "/api/tower/inconnue")).body.error).toBe("not_found");
  });

  it("Tower naît `off` : sans ligne dans la table des jeux, tout /api/tower/ répond 404 game_unavailable (la garde du lot P)", async () => {
    const t = await monterTower("2026-11-10", {}, {}, false);
    expect(await t.call("GET", "/api/tower/info")).toMatchObject({ status: 404, body: { error: "game_unavailable" } });
    expect(await t.call("POST", "/api/tower/submit", {})).toMatchObject({ status: 404, body: { error: "game_unavailable" } });
  });

  it("Tower est absent du registre : sans l'option `games`, /api/tower/ n'existe pas", async () => {
    const t = await makeApi();
    expect((await t.call("GET", "/api/tower/info")).status).toBe(404);
  });
});
