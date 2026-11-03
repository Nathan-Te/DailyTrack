import { describe, expect, it } from "vitest";
import { GAMES } from "../src/registry";
import { refOfPlayer } from "../src/players";
import { adaptateurResultatsJeu, sqlDe } from "../src/jeux/index";
import { D_ESSAI, ficheEssai, jeuEssai, JOUR_ESSAI, rediffusion } from "./jeuNeufAide";
import { DAY_MS, makeApi, ouvrirJeu, playerId, type TestApi } from "./helpers";

// Lot K4d (partie 1) — **un jeu neuf obtient le filtre « Amis » / « Mon groupe », les suggestions d'amis et sa part du classement des groupes sans qu'aucun fichier de la plateforme le nomme** : `amis.ts` lit
// ce que le jeu déclare (`GameInstance.lignesAmies`, `admin.activite`) et `classementAmis.ts` met en forme ses lignes comme « Tous ». SQLite et libSQL (`file:`), jamais Turso.

const MIDI = D_ESSAI * DAY_MS + 12 * 3_600_000;
let adresse = 0;
const ip = () => `198.60.${(adresse >> 8) & 255}.${adresse++ & 255}`;
const vu = (n: number | null): Record<string, string> => (n === null ? {} : { "X-Player-Id": playerId(n) });
const get = (t: TestApi, n: number | null, path: string) => t.call("GET", path, undefined, { headers: vu(n), clientKey: ip() });
const post = (t: TestApi, n: number | null, path: string, body: unknown = {}) => t.call("POST", path, body, { headers: vu(n), clientKey: ip() });
const refDe = (n: number) => refOfPlayer(playerId(n));

async function monter(): Promise<{ t: TestApi; code: string }> {
  const def = jeuEssai("score");
  const t = await makeApi({ seed: false, games: [...GAMES, def], allowCopies: true });
  t.clock.now = MIDI;
  await t.call("GET", "/api/health");
  await ouvrirJeu(t, def.code, D_ESSAI - 3);
  return { t, code: def.code };
}
/** Une partie : `charge` donne les points (leur somme) et les octets (leur nombre). */
const jouer = (t: TestApi, code: string, n: number, charge: number[]) => post(t, n, `/api/${code}/submit`, { replay: rediffusion(charge), name: `Joueur${n}` });
const ami = async (t: TestApi, n: number, de: number) => post(t, n, "/api/amis", { ref: await refDe(de) });

describe("un jeu neuf : amis, groupe, suggestions et classement des groupes", () => {
  it("lit les parties de la liste par l'index du joueur, jamais toute la journée (R14)", async () => {
    const { t } = await monter();
    const sql = sqlDe(adaptateurResultatsJeu("essaiscore", ficheEssai("score").classement.colonnes as never)).joueurs(3);
    const plan = await t.db.all<{ detail: string }>(`EXPLAIN QUERY PLAN ${sql}`, [D_ESSAI, "a", "b", "c"]);
    expect(plan.map((p) => p.detail).join(" ")).toMatch(/SEARCH resultats_jeu USING INDEX resultats_jeu_by_player \(jeu=\? AND player_id=\? AND day=\?\)/);
  });

  it("« Amis » : toi et tes amis, les colonnes de la fiche, le rang entre amis et le rang général, les absents en bas", { timeout: 30_000 }, async () => {
    const { t, code } = await monter();
    // Points : 1 → 90, 2 → 60, 3 → 40, 4 → 30 ; joueur 5 n'a pas joué.
    for (const [n, charge] of [[1, [90]], [2, [30, 30]], [3, [40]], [4, [30]]] as const) expect((await jouer(t, code, n, [...charge])).status).toBe(200);
    await t.db.run("INSERT OR IGNORE INTO players (id, name, created_at, updated_at, name_key, ref, hidden) VALUES (?, 'Joueur5', 0, 0, 'joueur5', ?, 0)", [playerId(5), await refDe(5)]);
    expect((await ami(t, 3, 1)).status).toBe(200); // 3 a pour amis 1 (premier) et 4 (dernier) et 5 (absent)
    expect((await ami(t, 3, 4)).status).toBe(200);
    expect((await ami(t, 3, 5)).status).toBe(200);

    const r = await get(t, 3, `/api/${code}/day/${JOUR_ESSAI}/board?filtre=amis`);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.headers.get("cache-control")).toBe("private, no-cache");
    expect(r.headers.get("vary")).toContain("X-Player-Id");
    expect(r.body).toMatchObject({ filtre: "amis", date: JOUR_ESSAI, classes: 3, amis: 3 });
    expect(r.body.top.map((l: { name: string; rang: number; rangGeneral: number; points: number; octets: number }) => [l.name, l.rang, l.rangGeneral, l.points, l.octets])).toEqual([
      ["Joueur1", 1, 1, 90, 1],
      ["Joueur3", 2, 3, 40, 1],
      ["Joueur4", 3, 4, 30, 1],
    ]);
    expect(r.body.top.find((l: { moi?: boolean }) => l.moi)).toMatchObject({ name: "Joueur3", ref: await refDe(3) });
    expect(r.body.absents).toEqual([{ ref: await refDe(5), pseudo: "Joueur5" }]);
    expect(JSON.stringify(r.body)).not.toContain(playerId(3)); // jamais l'identifiant secret
    // Sans filtre, « Tous » ne change pas ; un filtre inconnu est refusé ; sans identifiant : refusé.
    expect((await get(t, 3, `/api/${code}/day/${JOUR_ESSAI}/board`)).body.filtre).toBeUndefined();
    expect((await get(t, 3, `/api/${code}/day/${JOUR_ESSAI}/board?filtre=x`)).body.error).toBe("invalid_filter");
    expect((await get(t, null, `/api/${code}/day/${JOUR_ESSAI}/board?filtre=amis`)).status).toBe(400);
  });

  it("« Mon groupe » : les membres du groupe à la place des amis ; un joueur masqué n'y figure plus", { timeout: 30_000 }, async () => {
    const { t, code } = await monter();
    for (const [n, charge] of [[1, [90]], [2, [60]], [3, [40]], [4, [30]]] as const) await jouer(t, code, n, [...charge]);
    const c = await post(t, 1, "/api/groupes", { nom: "Les Cibles" });
    expect(c.status, JSON.stringify(c.body)).toBe(200);
    const moi = (await get(t, 1, "/api/groupes/moi")).body.groupe;
    for (const n of [2, 3]) expect((await post(t, n, "/api/groupes/rejoindre", { jeton: moi.invitation })).status).toBe(200);
    await t.db.run("UPDATE groupe_membres SET arrivee = ? WHERE groupe = ?", [D_ESSAI - 1, c.body.id]);
    const r = await get(t, 2, `/api/${code}/day/${JOUR_ESSAI}/board?filtre=groupe`);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body).toMatchObject({ filtre: "groupe", classes: 3, amis: 2 });
    expect(r.body.top.map((l: { name: string; points: number }) => [l.name, l.points])).toEqual([["Joueur1", 90], ["Joueur2", 60], ["Joueur3", 40]]);
    // Masquer le joueur 3 : il disparaît du filtre (jamais de ligne d'un masqué).
    await t.db.run("UPDATE players SET hidden = 1 WHERE id = ?", [playerId(3)]);
    await t.db.run("UPDATE resultats_jeu SET hidden = 1 WHERE player_id = ?", [playerId(3)]);
    const apres = await get(t, 2, `/api/${code}/day/${JOUR_ESSAI}/board?filtre=groupe`);
    expect(apres.body.top.map((l: { name: string }) => l.name)).toEqual(["Joueur1", "Joueur2"]);
  });

  it("les suggestions d'amis voient les joueurs du jeu neuf (activité lue chez le jeu, pas écrite en dur)", async () => {
    const { t, code } = await monter();
    await jouer(t, code, 1, [10]);
    await jouer(t, code, 2, [20]);
    // Un joueur sans aucun résultat n'est jamais suggéré.
    await t.db.run("INSERT OR IGNORE INTO players (id, name, created_at, updated_at, name_key, ref, hidden) VALUES (?, 'Joueurzero', 0, 0, 'joueurzero', ?, 0)", [playerId(9), await refDe(9)]);
    const s = await get(t, 1, "/api/amis/suggestions?q=joueur");
    expect(s.status, JSON.stringify(s.body)).toBe(200);
    expect(s.body.suggestions.map((x: { pseudo: string }) => x.pseudo)).toEqual(["Joueur2"]);
  });

  it("le classement des groupes a une vue du jeu neuf : moyenne des 3 meilleurs, le plus grand d'abord", { timeout: 30_000 }, async () => {
    const { t, code } = await monter();
    for (const [n, charge] of [[1, [90]], [2, [60]], [3, [30]], [4, [10]]] as const) await jouer(t, code, n, [...charge]);
    const c = await post(t, 1, "/api/groupes", { nom: "Les Cibles" });
    const moi = (await get(t, 1, "/api/groupes/moi")).body.groupe;
    for (const n of [2, 3, 4]) await post(t, n, "/api/groupes/rejoindre", { jeton: moi.invitation });
    await t.db.run("UPDATE groupe_membres SET arrivee = ? WHERE groupe = ?", [D_ESSAI - 1, c.body.id]);
    const r = await get(t, null, `/api/groupes/classement?date=${JOUR_ESSAI}&vue=${code}`);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body).toMatchObject({ vue: code, sens: "hauteur" });
    expect(r.body.groupes).toHaveLength(1);
    expect(r.body.groupes[0]).toMatchObject({ nom: "Les Cibles", score: 60, classes: 4 }); // (90 + 60 + 30) / 3
  });

  it("le portail rend l'unité du jeu neuf (points, pas des millimètres) dans sa vue, dans « Amis » et dans la feuille d'un joueur", { timeout: 30_000 }, async () => {
    const { t, code } = await monter();
    for (const [n, charge] of [[1, [90]], [2, [60]]] as const) await jouer(t, code, n, [...charge]);
    await ami(t, 1, 2);
    const vue = await get(t, 1, `/api/portail/classement?date=${JOUR_ESSAI}&vue=${code}`);
    expect(vue.status, JSON.stringify(vue.body)).toBe(200);
    expect(vue.body).toMatchObject({ vue: code, unite: "points" });
    expect(vue.body.jeux.find((j: { jeu: string }) => j.jeu === code)).toMatchObject({ unite: "points" });
    expect(vue.body.top[0]).toMatchObject({ pseudo: "Joueur1", score: { unite: "points", valeur: 90 } });
    const amis = await get(t, 1, `/api/portail/classement?date=${JOUR_ESSAI}&vue=${code}&filtre=amis`);
    expect(amis.status, JSON.stringify(amis.body)).toBe(200);
    expect(amis.body).toMatchObject({ unite: "points", filtre: "amis" });
    const fiche = await get(t, 1, `/api/amis/fiche/${await refDe(2)}?date=${JOUR_ESSAI}`);
    expect(fiche.body.jeux).toEqual([expect.objectContaining({ site: code, unite: "entier", valeur: 60 })]);
    const jour = await get(t, 1, "/api/portail/jour");
    expect(jour.body.jeux.find((j: { jeu: string }) => j.jeu === code)).toMatchObject({ unite: "points" });
  });
});
