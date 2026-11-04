import { daysFromCivil, formatDay } from "@cdj/core";
import { CIBLES_GENERATOR_VERSION, CIBLES_SIM_VERSION, dailyCibles, empreinteContenu, enregistrer, figerJour, partieDuBot, seuilsDe, themeDuJour, touchesDuBot } from "@cdj/cibles-sim";
import { describe, expect, it } from "vitest";
import { ESSAIS_CIBLES } from "../scripts/cibles-essais";
import { contenuDeCibles } from "../src/cibles";
import { GAMES } from "../src/registry";
import { DAY_MS, makeApi, ouvrirJeu, playerId, type TestApi } from "./helpers";

// Lot K4f — « Cibles », le jeu témoin du kit, sur le contrat minimal d'un jeu neuf et la table commune `resultats_jeu` : le serveur sert le contenu du jeu (serveur = jeu), rejoue, classe dans le sens de la fiche
// (cibles touchées ↓, tick de la dernière touche ↑), refuse les copies et les rediffusions abîmées. SQLite et libSQL (`file:`), jamais Turso.

const JOUR = daysFromCivil(2026, 11, 10);
const DATE = formatDay(JOUR);
const MIDI = JOUR * DAY_MS + 12 * 3_600_000;
const VERSIONS = { simVersion: CIBLES_SIM_VERSION, generatorVersion: CIBLES_GENERATOR_VERSION };
const entete = (n: number) => ({ "X-Player-Id": playerId(n) });

async function monter(options: { copies?: boolean; frozen?: Record<string, unknown> } = {}): Promise<TestApi> {
  const t = await makeApi({ seed: false, games: GAMES, allowCopies: options.copies !== false, joursFiges: options.frozen ? { cibles: options.frozen } : undefined });
  t.clock.now = MIDI;
  await ouvrirJeu(t, "cibles");
  return t;
}
const envoyer = (t: TestApi, n: number, variante: number) => t.call("POST", "/api/cibles/submit", { replay: ESSAIS_CIBLES.partie(JOUR, VERSIONS, variante).rediffusion, name: `Joueur${n}` }, { headers: entete(n) });

describe("Cibles sur le serveur", () => {
  it("sert le contenu du jour de la simulation (serveur = jeu), jamais la preuve", async () => {
    const t = await monter();
    const c = dailyCibles(JOUR);
    const info = await t.call("GET", "/api/cibles/info");
    expect(info.body).toMatchObject({ game: "cibles", simVersion: 1, generatorVersion: 1, today: DATE });
    const jour = await t.call("GET", `/api/cibles/day/${DATE}`);
    expect(jour.status).toBe(200);
    expect(jour.body.medals).toEqual(seuilsDe(c));
    expect(jour.body.medals.author).toBe(partieDuBot(c).touches);
    expect(jour.body.theme).toBe(themeDuJour(JOUR));
    expect(JSON.stringify(jour.body)).not.toMatch(/replay|preuve|touches/);
    expect((await t.call("GET", "/api/cibles/day/2026-11-11")).status).toBe(404);
  });

  it("rejoue chaque partie, classe dans l'ordre de la fiche et garde le résultat du serveur", async () => {
    const t = await monter();
    for (const [n, v] of [[1, 3], [2, 0], [3, 9]] as const) {
      const attendu = ESSAIS_CIBLES.partie(JOUR, VERSIONS, v).attendu;
      const r = await envoyer(t, n, v);
      expect(r.status).toBe(200);
      expect(r.body.score).toEqual(attendu);
    }
    const board = await t.call("GET", `/api/cibles/day/${DATE}/board`, undefined, { headers: entete(3) });
    expect(board.body.participants).toBe(3);
    const lignes = board.body.top as { name: string; touches: number; dernier: number; medal: string | null }[];
    expect(lignes.map((l) => l.name)).toEqual(["Joueur2", "Joueur1", "Joueur3"]);
    for (let i = 1; i < lignes.length; i++) expect(lignes[i - 1]!.touches >= lignes[i]!.touches).toBe(true);
    expect(lignes[0]!.medal).not.toBeNull();
    expect(board.body.me).toMatchObject({ name: "Joueur3", rank: 3 });
  });

  it("à score égal, la dernière touche la plus tôt passe devant", async () => {
    const t = await monter();
    const c = dailyCibles(JOUR);
    const avecDelai = (delai: number) => enregistrer(c, c.cibles.map((x) => ({ tick: x.d + delai, c: x.c })));
    await t.call("POST", "/api/cibles/submit", { replay: avecDelai(20), name: "Lent" }, { headers: entete(1) });
    await t.call("POST", "/api/cibles/submit", { replay: avecDelai(15), name: "Vif" }, { headers: entete(2) });
    const board = await t.call("GET", `/api/cibles/day/${DATE}/board`);
    expect((board.body.top as { name: string; touches: number }[]).map((l) => [l.name, l.touches])).toEqual([["Vif", 20], ["Lent", 20]]);
  });

  it("refuse les copies (la partie du bot, deux fois les mêmes touches), les illisibles et les autres jours", async () => {
    const t = await monter({ copies: false });
    const c = dailyCibles(JOUR);
    const bot = await t.call("POST", "/api/cibles/submit", { replay: enregistrer(c, touchesDuBot(c)), name: "Copieur" }, { headers: entete(1) });
    expect(bot.status).toBe(409);
    expect(bot.body.error).toBe("replay_copy");
    expect((await envoyer(t, 2, 1)).status).toBe(200);
    const copie = await envoyer(t, 3, 1);
    expect(copie.body.error).toBe("replay_copy");
    expect((await t.call("POST", "/api/cibles/submit", { replay: "pas-une-rediffusion", name: "Zéro" }, { headers: entete(4) })).body.error).toBe("invalid_replay");
    const autreJour = enregistrer(dailyCibles(JOUR - 1), []);
    expect((await t.call("POST", "/api/cibles/submit", { replay: autreJour, name: "Hier" }, { headers: entete(5) })).status).toBe(409);
  });

  it("une partie vide est classée avec zéro cible", async () => {
    const t = await monter();
    const r = await t.call("POST", "/api/cibles/submit", { replay: enregistrer(dailyCibles(JOUR), []), name: "Rêveur" }, { headers: entete(1) });
    expect(r.status).toBe(200);
    expect(r.body.score).toEqual({ touches: 0, dernier: 900 });
    expect(r.body.medal).toBeNull();
  });

  it("lit le jour figé de l'image s'il se vérifie, l'ignore sinon", async () => {
    const fige = figerJour(JOUR);
    expect(contenuDeCibles(JOUR, { [DATE]: fige })).toEqual(dailyCibles(JOUR));
    const abime = { ...fige, contenu: { cibles: fige.contenu.cibles.slice(1) } };
    expect(empreinteContenu(contenuDeCibles(JOUR, { [DATE]: abime }))).toBe(empreinteContenu(dailyCibles(JOUR)));
    const t = await monter({ frozen: { [DATE]: fige } });
    const info = await t.call("GET", "/api/cibles/info");
    expect(info.body.frozenDays).toEqual([DATE]);
  });

  it("le profil du joueur et le jeu fermé (`off`) répondent comme les autres jeux", async () => {
    const t = await monter();
    await envoyer(t, 1, 2);
    const me = await t.call("GET", "/api/cibles/me", undefined, { headers: entete(1) });
    expect(me.status).toBe(200);
    expect(me.body.days).toHaveLength(1);
    const ferme = await makeApi({ seed: false, games: GAMES });
    ferme.clock.now = MIDI;
    expect((await ferme.call("GET", "/api/cibles/info")).body.error).toBe("game_unavailable");
  });
});
