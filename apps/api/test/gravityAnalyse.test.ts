import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { daysFromCivil, formatDay } from "@cdj/core";
import { GRAVITY_GENERATOR_VERSION, GRAVITY_SIM_VERSION, TICKS_PAR_SECONDE } from "@cdj/gravity-sim";
import { afterEach, describe, expect, it } from "vitest";
import { ESSAIS_GRAVITY } from "../scripts/gravity-essais";
import { REQUETE_PARTIES, analyser, analyserJour, formater, partieDe, quantiles, verifierPlan, type PartieAnalysee } from "../scripts/gravity-analyse-calcul";
import { PLATFORM_SCHEMA } from "../src/db";
import { GAMES } from "../src/registry";
import { DAY_MS, makeApi, ouvrirJeu, playerId, type TestApi } from "./helpers";

// Lot GR5 — l'analyse des parties de Gravity (l'outil du calibrage du lot GR6) : les calculs (quantiles, parts de médailles), la requête (une seule, par l'index, sans identifiant ni rediffusion), et l'outil de bout en bout
// (`npm run analyser -w @cdj/gravity`) sur une base locale : **ses parties viennent du vrai serveur** (rejouées, classées, médailles posées), pas de lignes écrites à la main.
const JOUR = daysFromCivil(2026, 11, 10);
const VERSIONS = { simVersion: GRAVITY_SIM_VERSION, generatorVersion: GRAVITY_GENERATOR_VERSION };

describe("les calculs", () => {
  it("les quantiles : le rang le plus proche, un effectif, la moyenne", () => {
    expect(quantiles([])).toBeNull();
    expect(quantiles([5])).toEqual({ n: 1, min: 5, p10: 5, p25: 5, p50: 5, p75: 5, p90: 5, max: 5, moyenne: 5 });
    const q = quantiles(Array.from({ length: 10 }, (_, i) => (i + 1) * 100))!; // 100 … 1 000
    expect(q).toMatchObject({ n: 10, min: 100, p10: 100, p25: 300, p50: 500, p75: 800, p90: 900, max: 1000, moyenne: 550 });
  });

  it("une ligne de la table : le score est −cle1 (la table range le plus grand en tête), la distance vient de `mesures`, la médaille en rang", () => {
    const p = partieDe({ day: JOUR, cle1: -4200, cle2: 6000, medal: "gold", mesures: JSON.stringify({ distance: 612, pieces: 40 }), apercu: 1, sim_version: 2, generator_version: 3 })!;
    expect(p).toEqual({ day: JOUR, score: 4200, ticks: 6000, distance: 612, medaille: 3, apercu: true, sim: 2, generateur: 3 });
    expect(partieDe({ day: JOUR, cle1: 0, cle2: 100, medal: null, mesures: "pas du json", apercu: 0, sim_version: 2, generator_version: 3 })).toMatchObject({ score: 0, distance: null, medaille: 0, apercu: false });
    expect(partieDe({ cle1: "x", cle2: 1 })).toBeNull();
  });

  it("l'analyse d'un jour : effectif, quantiles, durée en secondes, part des joueurs à chaque médaille (au moins ce rang)", () => {
    const parties: PartieAnalysee[] = [0, 1, 2, 3, 4].map((m, i) => ({ day: JOUR, score: 1000 * (i + 1), ticks: 120 * (30 + 30 * i), distance: 100 * (i + 1), medaille: m, apercu: i === 0, sim: 2, generateur: 3 }));
    const a = analyserJour(JOUR, parties);
    expect(a).toMatchObject({ parties: 5, apercu: 1, versions: ["g3/sim2"] });
    expect(a.score).toMatchObject({ p50: 3000, max: 5000 });
    expect(a.distance).toMatchObject({ p50: 300 });
    expect(a.duree).toMatchObject({ min: 30, p50: 90, max: 150 });
    expect(a.medailles).toEqual({ bronze: 0.8, argent: 0.6, or: 0.4, diamant: 0.2 });
    expect(TICKS_PAR_SECONDE).toBe(120);
    expect(analyser([...parties, { ...parties[0]!, day: JOUR + 1 }]).map((j) => j.day)).toEqual([JOUR, JOUR + 1]);
  });

  it("la requête : seulement les colonnes utiles, jamais de rediffusion ni d'identifiant ; le plan doit passer par l'index, un balayage est refusé", () => {
    expect(REQUETE_PARTIES).not.toMatch(/replay|player_id|\*/);
    expect(() => verifierPlan(["SEARCH resultats_jeu USING INDEX resultats_jeu_by_rank (jeu=? AND day>? AND day<?)"])).not.toThrow();
    expect(() => verifierPlan(["SEARCH resultats_jeu USING INDEX resultats_jeu_by_inputs (jeu=? AND day>? AND day<?)"])).not.toThrow(); // ce que SQLite choisit en vrai : même préfixe (jeu, day)
    expect(() => verifierPlan(["SEARCH resultats_jeu USING COVERING INDEX resultats_jeu_by_rank (jeu=? AND day>? AND day<?)"])).not.toThrow();
    expect(() => verifierPlan(["SCAN resultats_jeu"])).toThrow(/balaierait/);
    expect(() => verifierPlan(["SEARCH resultats_jeu USING INDEX resultats_jeu_by_player (jeu=?)"])).toThrow(/index sur \(jeu, day\)/);
    expect(() => verifierPlan(["SCAN players"])).toThrow(/illisible/);
  });
});

describe("sur les parties du vrai serveur", () => {
  const dossiers: string[] = [];
  afterEach(() => {
    for (const d of dossiers.splice(0)) rmSync(d, { recursive: true, force: true });
  });
  async function jouer(): Promise<{ t: TestApi; attendus: { score: number; ticks: number }[] }> {
    const t = await makeApi({ seed: false, games: GAMES, allowCopies: true });
    t.clock.now = JOUR * DAY_MS + 12 * 3_600_000;
    await ouvrirJeu(t, "gravity");
    const attendus: { score: number; ticks: number }[] = [];
    for (const [n, variante] of [[1, 0], [2, 4], [3, 9]] as const) {
      const p = ESSAIS_GRAVITY.partie(JOUR, VERSIONS, variante);
      const r = await t.call("POST", "/api/gravity/submit", { replay: p.rediffusion, name: `Joueur${n}` }, { headers: { "X-Player-Id": playerId(n) } });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      attendus.push({ score: p.attendu.score!, ticks: p.attendu.ticks! });
    }
    return { t, attendus };
  }

  it("la requête lit les trois parties : le plan passe par l'index, les scores et les durées sont ceux du rejeu", async () => {
    const { t, attendus } = await jouer();
    const plan = await t.db.all<{ detail: string }>(`EXPLAIN QUERY PLAN ${REQUETE_PARTIES}`, ["gravity", JOUR, JOUR]);
    expect(() => verifierPlan(plan.map((r) => r.detail))).not.toThrow();
    const lignes = await t.db.all<Record<string, unknown>>(REQUETE_PARTIES, ["gravity", JOUR, JOUR]);
    const parties = lignes.map((l) => partieDe(l)!);
    expect(parties.map((p) => p.score).sort((a, b) => a - b)).toEqual(attendus.map((a) => a.score).sort((a, b) => a - b));
    expect(parties.map((p) => p.ticks).sort((a, b) => a - b)).toEqual(attendus.map((a) => a.ticks).sort((a, b) => a - b));
    for (const p of parties) expect(p.distance).toBeGreaterThan(0);
    expect(analyserJour(JOUR, parties).parties).toBe(3);
    expect(Object.keys(lignes[0]!).sort()).toEqual(["apercu", "cle1", "cle2", "day", "generator_version", "medal", "mesures", "sim_version"]);
  });

  it("l'outil de bout en bout (base locale « recette ») : un texte par jour, la même chose en JSON, rien de personnel ; une base distante sans --distant est refusée", async () => {
    const { t, attendus } = await jouer();
    const lignes = await t.db.all<Record<string, unknown>>("SELECT * FROM resultats_jeu WHERE jeu = ?", ["gravity"]);
    expect(lignes).toHaveLength(3);
    const dossier = mkdtempSync(join(tmpdir(), "gravity-analyse-"));
    dossiers.push(dossier);
    const fichier = join(dossier, "base-recette.db");
    const base = new DatabaseSync(fichier);
    for (const sql of PLATFORM_SCHEMA.filter((s) => /resultats_jeu/.test(s))) base.exec(sql);
    const colonnes = Object.keys(lignes[0]!);
    const ajouter = base.prepare(`INSERT INTO resultats_jeu (${colonnes.join(",")}) VALUES (${colonnes.map(() => "?").join(",")})`);
    for (const l of lignes) ajouter.run(...(colonnes.map((c) => l[c]) as (string | number | null)[]));
    base.close();
    const racine = new URL("../../gravity/", import.meta.url).pathname;
    const env = { ...process.env, TURSO_DATABASE_URL: `file:${fichier}` };
    const lancer = (...suite: string[]) => spawnSync("npm", ["run", "analyser", "--silent", "--", "--cible", "recette", "--du", formatDay(JOUR), "--au", formatDay(JOUR), "--sans-seuils", ...suite], { cwd: racine, encoding: "utf8", env });
    const texte = lancer();
    expect(texte.status, texte.stdout + texte.stderr).toBe(0);
    expect(texte.stdout).toContain(formatDay(JOUR));
    expect(texte.stdout).toMatch(/3 partie\(s\)/);
    expect(texte.stdout).toMatch(/médailles atteintes : bronze \d+ % · argent \d+ % · or \d+ % · Diamant \d+ %/);
    expect(texte.stdout).not.toMatch(/Joueur\d|playerId|replay/);
    const json = JSON.parse(lancer("--json").stdout) as { jours: { parties: number; score: { max: number } }[]; ensemble: { parties: number } };
    expect(json.jours).toHaveLength(1);
    expect(json.jours[0]!.parties).toBe(3);
    expect(json.jours[0]!.score.max).toBe(Math.max(...attendus.map((a) => a.score)));
    expect(JSON.stringify(json)).not.toMatch(/Joueur\d|player_id|replay/);
    // une base distante sans --distant : refusée, rien n'est lu
    const distante = spawnSync("npm", ["run", "analyser", "--silent", "--", "--cible", "recette"], { cwd: racine, encoding: "utf8", env: { ...process.env, TURSO_DATABASE_URL: "https://base-recette.example.org", TURSO_AUTH_TOKEN: "x" } });
    expect(distante.status).toBe(1);
    expect(distante.stderr).toContain("--distant");
    // une base de production nommée « recette » (ou l'inverse) est refusée, comme pour le reste des outils
    const mauvaise = spawnSync("npm", ["run", "analyser", "--silent", "--", "--cible", "production"], { cwd: racine, encoding: "utf8", env });
    expect(mauvaise.status).toBe(1);
    expect(mauvaise.stderr).toMatch(/recette/);
  });
});
