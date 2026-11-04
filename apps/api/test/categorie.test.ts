import { describe, expect, it } from "vitest";
import { formatDay } from "@cdj/core";
import { PREMIER_JOUR_TOWER } from "@cdj/tower-sim";
import { GAMES } from "../src/registry";
import { makeApi, ouvrirJeu, parisDayStart, playerId, TEST_DB, type TestApi } from "./helpers";
import { refOfPlayer } from "../src/players";

// Lot A3 — la catégorie d'un jeu (`jour` | `arcade`) et la règle de jour : **un changement de catégorie compte à partir du lendemain** (comme `live_from`, lot P), les journées et séries
// déjà acquises ne bougent pas. Dates fixes (`JOUR`, `JOUR + 1`). Le jeu d'arcade du dépôt est Tower ; ici, sa fiche « change de catégorie » le lendemain de `JOUR` (on règle `categorieDepuis`
// du crochet `portail`, comme le ferait une fiche `categorieDepuis`). SQLite et libSQL (`file:`), jamais Turso.

const JOUR = PREMIER_JOUR_TOWER + 8;
const MIDI = parisDayStart(JOUR) + 12 * 3_600_000;
const as = (n: number) => ({ headers: { "X-Player-Id": playerId(n) } });

/** Les jeux du registre, où Tower est `arcade` à partir de `depuis` (avant : un jeu du jour). */
const jeuxAvecChangement = (depuis: number) =>
  GAMES.map((g) =>
    g.code !== "tower"
      ? g
      : {
          ...g,
          create: (p: never, o: never) => {
            const i = (g as { create: (p: never, o: never) => { portail?: { categorie?: string; categorieDepuis?: number } } }).create(p, o);
            if (i.portail) Object.assign(i.portail, { categorie: "arcade", categorieDepuis: depuis });
            return i;
          },
        },
  ) as unknown as typeof GAMES;

async function api(depuis: number): Promise<TestApi> {
  const t = await makeApi({ seed: false, games: jeuxAvecChangement(depuis) });
  t.clock.now = MIDI;
  await t.call("GET", "/api/health");
  await ouvrirJeu(t, "track");
  await ouvrirJeu(t, "jump");
  await ouvrirJeu(t, "tower", JOUR - 3);
  return t;
}
async function joueur(t: TestApi, n: number, nom: string): Promise<void> {
  const id = playerId(n);
  await t.db.run("INSERT OR IGNORE INTO players (id, name, created_at, updated_at, name_key, ref) VALUES (?, ?, 0, 0, ?, ?)", [id, nom, nom.toLowerCase(), (await refOfPlayer(id)) as string]);
}
const track = (t: TestApi, n: number, jour: number) =>
  t.db.run("INSERT INTO results (day, player_id, ms, splits, replay, respawns, submitted_at) VALUES (?, ?, 60000, '[]', 'x', 0, ?)", [jour, playerId(n), 1000 + n]);
const jump = (t: TestApi, n: number, jour: number) =>
  t.db.run("INSERT INTO jump_results (day, player_id, level_id, ticks, deaths, replay, sim_version, generator_version, first_at, submitted_at) VALUES (?, ?, 'x', 2400, 0, 'x', 1, 1, 0, ?)", [jour, playerId(n), 1000 + n]);
const tower = (t: TestApi, n: number, jour: number) =>
  t.db.run(
    "INSERT INTO tower_results (day, player_id, tirage, hauteur_mm, hauteur_max_mm, vies, ticks, medal, replay, sim_version, generator_version, first_at, submitted_at, inputs_hash, hidden, apercu) VALUES (?, ?, 0, 30000, 30000, 2, 3000, NULL, 'x', 3, 3, ?, ?, ?, 0, 0)",
    [jour, playerId(n), 1000 + n, 1000 + n, `h${n}-${jour}`],
  );

describe(`Lot A3 : un changement de catégorie compte à partir du lendemain (${TEST_DB})`, () => {
  it("le jour du changement, Tower compte encore dans la journée ; le lendemain il n'y compte plus", { timeout: 30_000 }, async () => {
    const t = await api(JOUR + 1); // arcade à partir de demain
    const aujourdhui = (await t.call("GET", "/api/portail/jour")).body.jeux as { jeu: string; compte?: boolean; categorie?: string }[];
    expect(aujourdhui.find((j) => j.jeu === "tower")).toMatchObject({ compte: true });
    expect("categorie" in aujourdhui.find((j) => j.jeu === "tower")!).toBe(false);
    t.clock.now = MIDI + 24 * 3_600_000;
    const demain = (await t.call("GET", "/api/portail/jour")).body;
    expect(demain.date).toBe(formatDay(JOUR + 1));
    expect(demain.jeux.find((j: { jeu: string }) => j.jeu === "tower")).toMatchObject({ compte: false, categorie: "arcade" });
  });

  it("les journées et séries déjà acquises ne bougent pas : un jour passé garde ses jeux d'alors, le jour d'arcade n'exige plus Tower", async () => {
    const t = await api(JOUR + 1);
    await joueur(t, 1, "Alice");
    await joueur(t, 2, "Bruno");
    // JOUR (avant le changement) : Alice finit les trois jeux (journée parfaite) ; Bruno ne finit que Tower (série acquise de 1).
    await track(t, 1, JOUR);
    await jump(t, 1, JOUR);
    await tower(t, 1, JOUR);
    await tower(t, 2, JOUR);
    // JOUR + 1 (jeu d'arcade) : Alice finit Track et Jump seulement ; Bruno ne joue pas.
    await track(t, 1, JOUR + 1);
    await jump(t, 1, JOUR + 1);
    t.clock.now = MIDI + 24 * 3_600_000;
    const a = (await t.call("GET", "/api/portail/jour", undefined, as(1))).body.joueur;
    // Deux journées parfaites (la seconde sans Tower), série de 2.
    expect(a).toMatchObject({ serie: 2, journeesParfaites: 2, aujourdhuiParfaite: true });
    const b = (await t.call("GET", "/api/portail/jour", undefined, as(2))).body.joueur;
    // Bruno : le jour de Tower reste acquis (hier), la série est à prolonger ; aujourd'hui il n'a rien fini.
    expect(b).toMatchObject({ serie: 1, aProlonger: true, journeesParfaites: 0 });
  });

  it("sans changement (arcade depuis toujours), Tower ne compte dans aucune journée, passée ou présente", async () => {
    const t = await api(0);
    await joueur(t, 1, "Alice");
    await tower(t, 1, JOUR);
    const j = (await t.call("GET", "/api/portail/jour", undefined, as(1))).body.joueur;
    expect(j).toMatchObject({ serie: 0, journeesParfaites: 0, aujourdhuiParfaite: false });
  });
});
