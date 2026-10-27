import { describe, expect, it } from "vitest";
import { VOITURE_PAR_DEFAUT, decodeReplay, formatDay, medalsFor } from "@cdj/sim";
import { crc32Hex } from "../src/identity";
import { DAY, NOON, TEST_DB, makeApi, pilotReplay, playerId, salonReplay, seedSalonCircuit, SALON_SESSION, type TestApi } from "./helpers";

// Lot 51 : la voiture de chaque course (circuit du jour, Salon) et le choix du Garage gardé par le serveur, par joueur. SQLite et libSQL.
// Règles : la voiture est une donnée à part (jamais dans la rediffusion) ; le serveur vérifie qu'elle est débloquée (sinon la Sparrow en orange) ;
// le choix du Garage se garde par joueur (dernier choix gagnant, à la minute près), refuse une voiture verrouillée, s'efface avec le joueur.
const DATE = formatDay(DAY);
const ORANGE = { ...VOITURE_PAR_DEFAUT };
const GT = { id: "gt", couleur: 3, motif: "chevrons", teinteMotif: 2 };
const FOURGON = { id: "fourgon", couleur: 5, motif: "damier", teinteMotif: 1 };
const PILOTE = 40_000;
const fast = pilotReplay(DAY, 0.9);
const slow = pilotReplay(DAY, 0.65);
const as = (id: string) => ({ headers: { "X-Player-Id": id } });
const minute = (t: TestApi) => Math.floor(t.clock.now / 60_000);

/** N jours passés joués par ce joueur (de quoi débloquer le fourgon à 3 jours, la GT à 10). */
async function joursJoues(t: TestApi, id: string, n: number) {
  for (let i = 1; i <= n; i++) {
    const day = DAY - i;
    const m = medalsFor(PILOTE, day);
    await t.db.run("INSERT OR IGNORE INTO circuits (day, track_id, spec, author_ms, attempt, palette, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [day, `jour-${formatDay(day)}`, "S", PILOTE, 0, "stade", NOON]);
    await t.db.run("INSERT INTO results (day, player_id, ms, splits, replay, respawns, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [day, id, m.bronze + 500, "[]", "x", 0, NOON]);
  }
}
const submit = (t: TestApi, id: string, replay: string, voiture?: unknown, name = "Pilote") => t.call("POST", "/api/submit", { playerId: id, name, date: DATE, replay, ...(voiture === undefined ? {} : { voiture }) });
const ghost = async (t: TestApi) => (await t.call("GET", `/api/day/${DATE}/ghost?kind=first`)).body;

describe(`la voiture de chaque course du jour (${TEST_DB})`, () => {
  it("jointe à l'envoi : le fantôme du premier la rend ; la rediffusion, elle, n'est pas touchée", async () => {
    const t = await makeApi();
    const id = playerId(5101);
    await joursJoues(t, id, 10); // 10 jours joués : le fourgon et la GT sont à lui
    const r = await submit(t, id, fast.code, GT);
    expect(r.status).toBe(200);
    const g = await ghost(t);
    expect(g.voiture).toEqual(GT);
    expect(g.replay, "la rediffusion rendue est exactement celle qui a été envoyée").toBe(fast.code);
    expect(decodeReplay(g.replay), "…et ne contient aucune voiture").not.toHaveProperty("voiture");
    expect((await t.db.first<{ replay: string }>("SELECT replay FROM results WHERE player_id = ? AND day = ?", [id, DAY]))!.replay).toBe(fast.code);
  });

  it("une voiture verrouillée, illisible ou absente : la Sparrow en orange", async () => {
    const cas: [string, unknown][] = [
      ["verrouillée", GT],
      ["inconnue", { ...GT, id: "tank" }],
      ["couleur hors de la palette", { ...FOURGON, couleur: 99 }],
      ["motif inconnu", { ...FOURGON, motif: "zèbre" }],
      ["teinte hors des listes", { ...FOURGON, teinteMotif: 9 }],
      ["pas un objet", "gt"],
      ["absente", undefined],
    ];
    for (const [quoi, voiture] of cas) {
      const t = await makeApi();
      const id = playerId(5102);
      await joursJoues(t, id, 3); // le fourgon est à lui, pas la GT
      expect((await submit(t, id, fast.code, voiture)).status, quoi).toBe(200);
      expect((await ghost(t)).voiture, quoi).toEqual(ORANGE);
    }
    // Le fourgon, débloqué, passe tel quel.
    const t = await makeApi();
    const id = playerId(5103);
    await joursJoues(t, id, 3);
    await submit(t, id, fast.code, FOURGON);
    expect((await ghost(t)).voiture).toEqual(FOURGON);
  });

  it("la civile (toujours à lui) passe dans la couleur et le motif choisis ; une course d'avant le lot n'a pas de voiture : la Sparrow en orange", async () => {
    const t = await makeApi();
    const rose = { id: "civile", couleur: 4, motif: "rond", teinteMotif: 3 };
    await submit(t, playerId(5104), fast.code, rose);
    expect((await ghost(t)).voiture).toEqual(rose);
    await t.db.run("UPDATE results SET car = NULL");
    expect((await ghost(t)).voiture, "ligne d'avant : NULL").toEqual(ORANGE);
    await t.db.run("UPDATE results SET car = 'abîmée'");
    expect((await ghost(t)).voiture, "valeur abîmée").toEqual(ORANGE);
  });

  it("un meilleur temps remplace la voiture avec lui ; un temps moins bon la laisse", async () => {
    const t = await makeApi();
    const id = playerId(5105);
    await joursJoues(t, id, 10);
    await submit(t, id, slow.code, GT);
    expect((await ghost(t)).voiture).toEqual(GT);
    t.clock.now += 1000;
    await submit(t, id, fast.code, FOURGON); // plus rapide : sa voiture suit
    expect((await ghost(t)).voiture).toEqual(FOURGON);
    t.clock.now += 1000;
    await submit(t, id, slow.code, GT); // plus lent : rien ne change
    expect((await ghost(t)).voiture).toEqual(FOURGON);
  });

  it("le fantôme « devant toi » aussi ; ton propre record (GET /api/me) porte la voiture de ce record", async () => {
    const t = await makeApi();
    const [a, b] = [playerId(5106), playerId(5107)];
    await joursJoues(t, a, 10);
    await submit(t, a, fast.code, GT, "Alice");
    await submit(t, b, slow.code, undefined, "Bob");
    const devant = await t.call("GET", `/api/day/${DATE}/ghost?kind=ahead`, undefined, as(b));
    expect(devant.body).toMatchObject({ name: "Alice", voiture: GT });
    const moi = await t.call("GET", "/api/me", undefined, as(a));
    expect(moi.body.best.voiture).toEqual(GT);
    expect((await t.call("GET", "/api/me", undefined, as(b))).body.best.voiture).toEqual(ORANGE);
  });
});

describe(`la voiture de chaque course du Salon (${TEST_DB})`, () => {
  const S = SALON_SESSION;
  const salonFast = salonReplay(S, 0.9);
  const salonApi = async () => {
    const t = await makeApi({ seed: false });
    await seedSalonCircuit(t.db, S);
    return t;
  };
  const sendSalon = (t: TestApi, id: string, voiture?: unknown) =>
    t.call("POST", `/api/salon/${S}/submit`, { playerId: id, name: "Salonnier", replay: salonFast.code, ...(voiture === undefined ? {} : { voiture }) });

  it("jointe à l'envoi, rendue avec le fantôme (par la référence publique) ; verrouillée ou absente : la Sparrow en orange", async () => {
    const t = await salonApi();
    const id = playerId(5110);
    await joursJoues(t, id, 3);
    const r = await sendSalon(t, id, FOURGON);
    expect(r.status).toBe(200);
    const ref = r.body.board.me.ref as string;
    const g = (await t.call("GET", `/api/salon/${S}/ghosts?refs=${ref}`)).body.ghosts[0];
    expect(g.voiture).toEqual(FOURGON);
    expect(g.replay, "la rediffusion ne porte pas la voiture").toBe(salonFast.code);
    // Verrouillée (la GT demande 10 jours) : la Sparrow en orange.
    const t2 = await salonApi();
    const r2 = await sendSalon(t2, id, GT);
    expect((await t2.call("GET", `/api/salon/${S}/ghosts?refs=${r2.body.board.me.ref}`)).body.ghosts[0].voiture).toEqual(ORANGE);
    // Aucune voiture annoncée (un jeu plus ancien) ; ligne d'avant.
    const t3 = await salonApi();
    const r3 = await sendSalon(t3, playerId(5111));
    const ref3 = r3.body.board.me.ref;
    expect((await t3.call("GET", `/api/salon/${S}/ghosts?refs=${ref3}`)).body.ghosts[0].voiture).toEqual(ORANGE);
    await t3.db.run("UPDATE salon_runs SET car = NULL");
    expect((await t3.call("GET", `/api/salon/${S}/ghosts?refs=${ref3}`)).body.ghosts[0].voiture).toEqual(ORANGE);
  });
});

describe(`le choix du Garage gardé par le serveur (${TEST_DB})`, () => {
  async function joueurClasse(n = 5120, jours = 10) {
    const t = await makeApi();
    const id = playerId(n);
    await joursJoues(t, id, jours);
    expect((await submit(t, id, fast.code)).status).toBe(200); // le joueur existe
    return { t, id };
  }
  const choisir = (t: TestApi, id: string, voiture: unknown, minute?: number) => t.call("PUT", "/api/garage", { voiture, ...(minute === undefined ? {} : { minute }) }, as(id));
  const lu = async (t: TestApi, id: string) => (await t.call("GET", "/api/garage", undefined, as(id))).body.choix;

  it("enregistré, relu par un second appareil (même identifiant) dans le profil et à l'ouverture du Garage", async () => {
    const { t, id } = await joueurClasse();
    expect(await lu(t, id), "rien d'enregistré").toBeNull();
    expect((await t.call("GET", "/api/me", undefined, as(id))).body.garage).toBeNull();
    const m = minute(t);
    const r = await choisir(t, id, GT, m);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ enregistre: true, voiture: GT, minute: m });
    // « Un autre appareil » : le même identifiant, aucun état partagé que le serveur.
    expect(await lu(t, id)).toEqual({ voiture: GT, minute: m });
    expect((await t.call("GET", "/api/me", undefined, as(id))).body.garage).toEqual({ voiture: GT, minute: m });
    // Un autre joueur ne le voit pas.
    const { id: autre } = await joueurClasse(5121, 0).then(async (x) => ({ id: x.id }));
    expect((await t.call("GET", "/api/me", undefined, as(autre))).status).toBe(404);
  });

  it("une voiture verrouillée est refusée (rien n'est enregistré, le choix gardé est rendu) ; un choix illisible donne la Sparrow en orange", async () => {
    const { t, id } = await joueurClasse(5122, 3); // le fourgon, pas la GT
    const m = minute(t);
    expect((await choisir(t, id, FOURGON, m)).body.enregistre).toBe(true);
    const refus = await choisir(t, id, GT, m + 1);
    expect(refus.status).toBe(200);
    expect(refus.body).toEqual({ enregistre: false, voiture: FOURGON, minute: m });
    expect(await lu(t, id)).toEqual({ voiture: FOURGON, minute: m });
    // Illisible : la Sparrow en orange (et, comme une voiture lisible, elle est enregistrée).
    for (const illisible of [{ id: "tank", couleur: 0, motif: "course", teinteMotif: 0 }, { ...FOURGON, couleur: -1 }, "n'importe quoi", null]) {
      const r = await choisir(t, id, illisible, m + 1);
      expect(r.body, JSON.stringify(illisible)).toEqual({ enregistre: true, voiture: ORANGE, minute: m + 1 });
    }
  });

  it("le dernier choix l'emporte, à la minute près ; une minute dans le futur est ramenée à la minute du serveur (+1)", async () => {
    const { t, id } = await joueurClasse(5123);
    const m = minute(t);
    expect((await choisir(t, id, FOURGON, m)).body.enregistre).toBe(true);
    // Un appareil resté hors ligne envoie un choix plus ancien : le serveur garde le plus récent et le dit.
    const ancien = await choisir(t, id, GT, m - 30);
    expect(ancien.body).toEqual({ enregistre: false, voiture: FOURGON, minute: m });
    // La même minute : le dernier arrivé gagne.
    expect((await choisir(t, id, GT, m)).body).toEqual({ enregistre: true, voiture: GT, minute: m });
    // Plus récent : il gagne.
    expect((await choisir(t, id, FOURGON, m + 1)).body).toEqual({ enregistre: true, voiture: FOURGON, minute: m + 1 });
    // Une horloge folle (dans dix ans) ne gèle pas les autres appareils.
    const fou = await choisir(t, id, GT, m + 10 * 365 * 24 * 60);
    expect(fou.body.minute).toBeLessThanOrEqual(m + 1);
    // Sans minute : celle du serveur.
    t.clock.now += 5 * 60_000;
    expect((await choisir(t, id, GT)).body).toMatchObject({ enregistre: true, minute: minute(t) });
  });

  it("l'identifiant en en-tête est obligatoire ; un joueur jamais classé est inconnu (il garde son choix chez lui) ; un code remplacé est refusé", async () => {
    const t = await makeApi();
    expect((await t.call("PUT", "/api/garage", { voiture: ORANGE }, {})).body.error).toBe("invalid_player");
    expect((await t.call("PUT", "/api/garage", { voiture: ORANGE, playerId: playerId(5124) }, {})).status).toBe(400); // jamais dans le corps
    const inconnu = await choisir(t, playerId(5124), ORANGE, minute(t));
    expect(inconnu.status).toBe(404);
    expect(inconnu.body.error).toBe("unknown_player");
    expect(await t.db.first("SELECT 1 AS x FROM garage_choices")).toBeNull();
    const { t: t2, id } = await joueurClasse(5125);
    const nouveau = playerId(5126);
    expect((await t2.call("POST", "/api/me/code", { newId: nouveau }, as(id))).status).toBe(200);
    expect((await choisir(t2, id, ORANGE, minute(t2))).status).toBe(410);
  });

  it("« Changer mon code » : le choix suit le joueur ; le débit est borné", async () => {
    const { t, id } = await joueurClasse(5127);
    const m = minute(t);
    await choisir(t, id, GT, m);
    const nouveau = playerId(5128);
    expect((await t.call("POST", "/api/me/code", { newId: nouveau }, as(id))).status).toBe(200);
    expect(await lu(t, nouveau)).toEqual({ voiture: GT, minute: m });
    expect(await t.db.first("SELECT 1 AS x FROM garage_choices WHERE player_id = ?", [id])).toBeNull();
    let limite = 0;
    for (let i = 0; i < 80 && !limite; i++) limite = (await choisir(t, nouveau, GT, m)).status === 429 ? i : 0;
    expect(limite, "au plus quelques dizaines d'enregistrements par fenêtre").toBeGreaterThan(0);
  });

  it("l'effacement d'un joueur efface aussi son choix de voiture et la voiture de ses courses", async () => {
    const TOKEN = "jeton-admin-de-test-assez-long";
    const t = await makeApi({ adminToken: TOKEN });
    const id = playerId(5129);
    await joursJoues(t, id, 10);
    await submit(t, id, fast.code, GT);
    await choisir(t, id, GT, minute(t));
    expect(await lu(t, id)).not.toBeNull();
    const code = `CDJ2.${id}.${crc32Hex(new TextEncoder().encode(id))}`;
    const auth = { headers: { Authorization: `Bearer ${TOKEN}` } };
    expect((await t.call("POST", "/api/admin/effacer", { code }, auth)).status, "essai à blanc").toBe(200);
    expect(await t.db.first("SELECT 1 AS x FROM garage_choices WHERE player_id = ?", [id]), "l'essai à blanc n'efface rien").not.toBeNull();
    expect((await t.call("POST", "/api/admin/effacer", { code, confirmer: true }, auth)).status).toBe(200);
    expect(await t.db.first("SELECT 1 AS x FROM garage_choices WHERE player_id = ?", [id])).toBeNull();
    expect(await t.db.first("SELECT 1 AS x FROM results WHERE player_id = ?", [id])).toBeNull();
    expect((await t.call("GET", `/api/day/${DATE}/ghost?kind=first`)).status, "plus de fantôme : plus de voiture non plus").toBe(404);
  });
});
