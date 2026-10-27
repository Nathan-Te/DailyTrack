import { expect as baseExpect, newClockedContext, test, type Page, TODAY } from "./fixtures";
import { SIM_VERSION, dailyCircuit, dailyTrackId, encodeReplay, etatGarage, formatDay, runPilot } from "@cdj/sim";

// Lot 51 : la voiture de chaque course — jointe à l'envoi, gardée avec le record, montrée au fantôme (le premier, ton record) et à la rediffusion regardée —, et le choix du
// Garage gardé par le serveur (le même profil sur tous les appareils). Le jeu parle à une API simulée dans la page (`page.route`, aucune base partagée) pour les cas
// ciblés (Régression : la nuit) ; deux tests sont Essentiels — la voiture jointe à l'envoi, et le scénario qui passe par le vrai serveur (SQLite en mémoire, port 8801 réservé à ce fichier) avec deux appareils. Le rendu 3D demande WebGL : Chromium seulement.
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(240_000);
const expect = baseExpect.configure({ timeout: 30_000 });

const CLE = "cdj:track:garage";
const circuit = dailyCircuit(TODAY);
const date = formatDay(TODAY);
const run = runPilot(circuit.track, { grip: 0.9 });
const code = encodeReplay(run.replay);
const EVOLUTION = { id: "evolution", couleur: 3, motif: "flancs", teinteMotif: 0 };
const GT = { id: "gt", couleur: 5, motif: "damier", teinteMotif: 1 };
const debug = (page: Page) => page.evaluate(() => window.__cdj.voiture);

/** Une API simulée dans la page : le circuit du jour, ce que `extra` ajoute ; le reste n'existe pas (404). Rend les requêtes vues. */
async function api(page: Page, base: string, extra: (path: string, method: string, body: Record<string, unknown> | null) => unknown | undefined) {
  const vues: { method: string; path: string; body: Record<string, unknown> | null; id: string | null }[] = [];
  await page.route(`${base}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body), headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*" } });
    if (req.method() === "OPTIONS") return json({});
    const body = req.method() === "GET" ? null : (req.postDataJSON() as Record<string, unknown>);
    vues.push({ method: req.method(), path: url.pathname + url.search, body, id: req.headers()["x-player-id"] ?? null });
    if (url.pathname === `/api/day/${date}`) return json({ date, number: circuit.number, trackId: dailyTrackId(TODAY), variant: 0, theme: null });
    const r = extra(url.pathname + url.search, req.method(), body);
    return r === undefined ? json({ error: "not_found" }, 404) : json(r);
  });
  return vues;
}
const ouvrir = async (page: Page, base: string, query = "") => {
  await page.goto(`/?debug&home=0&api=${encodeURIComponent(base)}${query}`);
  await page.waitForFunction(() => window.__cdj?.phase === "countdown" || window.__cdj?.phase === "racing");
};

test("le fantôme du premier a la voiture de sa course (la Sparrow en orange sans voiture) ; « ton record » a celle de ce record", { tag: "@regression" }, async ({ page }) => {
  const API = "https://api.voiture-fantome.test";
  const premier = { name: "Alice", rank: 1, ms: run.finishMs, splits: [], replay: code, simVersion: SIM_VERSION };
  await api(page, API, (path) => (path === `/api/day/${date}/ghost?kind=first` ? { ...premier, voiture: EVOLUTION } : path === `/api/day/${date}/leaderboard?limit=10` ? { date, participants: 1, top: [], me: null } : undefined));
  await ouvrir(page, API);
  expect((await debug(page)).fantomeVoiture, "au départ : la Sparrow, rien d'autre").toBe("civile");
  await page.keyboard.press("g"); // le fantôme suivant : le premier
  await expect.poll(async () => (await debug(page)).fantomeVoiture, { message: "le modèle de la voiture du premier, chargé à la demande" }).toBe("evolution");
  await page.keyboard.press("g"); // le joueur devant : personne ; puis aucun fantôme → la Sparrow
  await expect.poll(async () => (await debug(page)).fantomeVoiture).toBe("civile");

  // Ton record, fait dans une autre voiture que celle d'aujourd'hui : son fantôme la garde. (La première page est mise en sommeil : en rendu logiciel, deux pages qui
  // dessinent côte à côte se volent le processeur.)
  await page.evaluate(() => window.__cdj.manual(true));
  const page2 = await (await newClockedContext(page.context().browser()!)).newPage();
  const API2 = "https://api.voiture-record.test";
  await api(page2, API2, () => undefined);
  await page2.addInitScript(
    ([id, replay, ms, simVersion, voiture]) => localStorage.setItem(`cdj:best:${id}`, JSON.stringify({ ms, splits: [], replay, simVersion, voiture })),
    [circuit.track.id, code, run.finishMs, SIM_VERSION, GT] as const,
  );
  await ouvrir(page2, API2);
  await expect.poll(async () => (await debug(page2)).fantomeVoiture, { message: "le fantôme de ton record : la GT de ce record, pas la voiture d'aujourd'hui" }).toBe("gt");
  expect((await debug(page2)).choix.id, "…alors que ta voiture, elle, n'a pas changé").toBe("civile");
});

test("revoir ton meilleur tour : la voiture de ce tour, en version complète (modèle, couleur, motif, teinte), pas celle d'aujourd'hui", { tag: "@regression" }, async ({ page }) => {
  const API = "https://api.voiture-revoir.test";
  await api(page, API, () => undefined);
  await page.addInitScript(
    ([id, replay, ms, simVersion, voiture]) => localStorage.setItem(`cdj:best:${id}`, JSON.stringify({ ms, splits: [], replay, simVersion, voiture })),
    [circuit.track.id, code, run.finishMs, SIM_VERSION, GT] as const,
  );
  await ouvrir(page, API, "&watch=best");
  await page.waitForFunction(() => window.__cdj.watch !== null, undefined, { timeout: 60_000 });
  await expect.poll(async () => (await debug(page)).affichee, { message: "la voiture du tour regardé" }).toEqual(GT);
  expect((await debug(page)).choix.id, "ta voiture n'a pas bougé").toBe("civile");
});

test("l'envoi d'un temps joint la voiture de la course, et le record local la garde", async ({ page }) => {
  const API = "https://api.voiture-envoi.test";
  const vues = await api(page, API, (path, method) =>
    path === "/api/submit" && method === "POST"
      ? { accepted: true, improved: true, ms: run.finishMs, splits: [], respawns: 0, bestMs: run.finishMs, rank: 1, participants: 1, medal: "gold", garage: { progres: { jours: 1, or: 0, auteur: 0 }, voitures: etatGarage({ jours: 1, or: 0, auteur: 0 }), nouvelles: [] } }
      : path.startsWith("/api/day/") && path.endsWith("/leaderboard?limit=10")
        ? { date, participants: 1, top: [], me: null }
        : undefined,
  );
  const civile = { id: "civile", couleur: 4, motif: "rond", teinteMotif: 1 };
  await page.addInitScript(([k, v]) => { localStorage.setItem(k, JSON.stringify(v)); localStorage.setItem("cdj:name", "Pilote"); }, [CLE, { ...civile, minute: 1, envoye: 1 }] as const);
  await page.goto(`/?debug&timescale=6&api=${encodeURIComponent(API)}`);
  await page.waitForFunction(() => window.__cdj?.phase === "countdown" || window.__cdj?.phase === "racing");
  await page.evaluate((c) => window.__cdj.autoplay(c), code);
  await page.waitForFunction(() => window.__cdj.phase === "finished", undefined, { timeout: 90_000 });
  await expect.poll(() => vues.find((v) => v.path === "/api/submit")?.body?.voiture).toEqual(civile);
  const best = await page.evaluate((id) => JSON.parse(localStorage.getItem(`cdj:best:${id}`)!) as { voiture?: unknown; replay?: string }, circuit.track.id);
  expect(best.voiture, "le record garde sa voiture").toEqual(civile);
  expect(JSON.stringify(vues.find((v) => v.path === "/api/submit")?.body), "la voiture est une donnée à part : la rediffusion envoyée est celle de la course").toContain(code);
});

test("le choix du serveur arrive avec le profil (aucune requête de plus), la voiture est remplacée hors course ; un choix fait au Garage est envoyé", { tag: "@regression" }, async ({ page }) => {
  const API = "https://api.voiture-profil.test";
  const choix = { voiture: { id: "civile", couleur: 6, motif: "unie", teinteMotif: 0 }, minute: 99 };
  const me = { name: "Pilote", renameRequired: false, today: date, simVersion: SIM_VERSION, stats: { days: 1, medals: { author: 0, gold: 0, silver: 0, bronze: 0 }, bestRank: null, streak: 1 }, best: null, past: [], garage: choix };
  const vues = await api(page, API, (path, method, body) => {
    if (path === "/api/me") return me;
    if (path === "/api/garage" && method === "GET") return { progres: { jours: 1, or: 0, auteur: 0 }, voitures: etatGarage({ jours: 1, or: 0, auteur: 0 }), choix };
    if (path === "/api/garage" && method === "PUT") return { enregistre: true, voiture: body!.voiture, minute: body!.minute };
    if (path.endsWith("/leaderboard?limit=10")) return { date, participants: 1, top: [], me: null };
    return undefined;
  });
  await page.addInitScript(() => localStorage.setItem("cdj:name", "Pilote"));
  await page.goto(`/?debug&home=1&api=${encodeURIComponent(API)}`);
  await page.waitForFunction(() => window.__cdj?.phase);
  await expect.poll(async () => (await debug(page)).choix, { message: "la voiture du serveur, relue après l'accueil" }).toMatchObject({ id: "civile", couleur: 6, motif: "unie" });
  expect(vues.filter((v) => v.path === "/api/me"), "une seule lecture du profil : le choix y était").toHaveLength(1);
  expect(vues.some((v) => v.path === "/api/garage"), "pas de requête du Garage avant qu'on l'ouvre").toBe(false);
  expect(vues.some((v) => v.method === "PUT"), "rien à envoyer : le serveur a déjà ce choix").toBe(false);
  expect(JSON.parse((await page.evaluate((k) => localStorage.getItem(k), CLE))!)).toMatchObject({ couleur: 6, minute: 99, envoye: 99 });
  // Au Garage : une autre couleur, enregistrée et envoyée (avec une minute plus récente que celle du serveur).
  await page.locator("#home-garage").click();
  await expect(page.locator("#garage")).toBeVisible({ timeout: 30_000 });
  await page.locator('#garage [data-couleur="2"]').click();
  await expect.poll(() => vues.find((v) => v.method === "PUT")?.body).toMatchObject({ voiture: { id: "civile", couleur: 2 } });
  const put = vues.find((v) => v.method === "PUT")!;
  expect(put.id, "l'identifiant secret voyage dans l'en-tête").toMatch(/^[0-9a-f]{32}$/);
  expect(put.path, "…jamais dans l'adresse").toBe("/api/garage");
  expect(put.body!.minute as number).toBeGreaterThan(99);
  // Toucher la couleur déjà choisie ne change rien et n'envoie rien de plus (un choix plus récent fait ailleurs ne serait pas écrasé pour rien).
  const avant = vues.filter((v) => v.method === "PUT").length;
  await page.locator('#garage [data-couleur="2"]').click();
  await page.waitForTimeout(300);
  expect(vues.filter((v) => v.method === "PUT")).toHaveLength(avant);
});

test("deux appareils, le même profil, le vrai serveur : la course garde sa voiture, le choix du Garage suit le joueur sur l'autre appareil", async ({ browser }) => {
  const API = "http://127.0.0.1:8801";
  const GAME = `debug&timescale=6&api=${encodeURIComponent(API)}`;
  const mon = { id: "civile", couleur: 3, motif: "flancs", teinteMotif: 0 };
  const a = await (await newClockedContext(browser, { viewport: { width: 1100, height: 700 } })).newPage();
  await a.addInitScript(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [CLE, mon] as const);
  await a.goto(`/?${GAME}`);
  await a.waitForFunction(() => window.__cdj?.phase === "countdown" || window.__cdj?.phase === "racing");
  await a.evaluate((c) => window.__cdj.autoplay(c), code);
  await a.waitForFunction(() => window.__cdj.phase === "finished", undefined, { timeout: 90_000 });
  await a.locator("#finish .online input").fill("Voitures");
  await a.locator("#finish .online button[type=submit]").click();
  await expect(a.locator("#finish .online .rank")).toHaveText("1er sur 1");
  // Le serveur a gardé la voiture de la course (la civile est toujours à lui), à part de la rediffusion.
  const ghost = (await (await fetch(`${API}/api/day/${date}/ghost?kind=first`)).json()) as { voiture: unknown; replay: string };
  expect(ghost.voiture).toEqual({ ...mon });
  expect(ghost.replay).toBe(code);
  const id = await a.evaluate(() => localStorage.getItem("cdj:player")!);
  // Au Garage de A : une autre couleur ; le serveur la garde pour ce joueur.
  await a.goto(`/?${GAME}&home=1`);
  await a.waitForFunction(() => window.__cdj?.phase);
  await a.locator("#home-garage").click();
  await expect(a.locator("#garage")).toBeVisible({ timeout: 30_000 });
  await a.locator('#garage [data-couleur="2"]').click();
  await expect
    .poll(async () => ((await (await fetch(`${API}/api/garage`, { headers: { "X-Player-Id": id } })).json()) as { choix: { voiture: { couleur: number } } | null }).choix?.voiture.couleur, { message: "le serveur garde le dernier choix" })
    .toBe(2);
  await a.evaluate(() => window.__cdj.manual(true));
  // L'autre appareil (même identifiant) : sa voiture vient du serveur, après l'accueil ; son fantôme « ton record » a la voiture du record.
  const b = await (await newClockedContext(browser, { viewport: { width: 1100, height: 700 } })).newPage();
  await b.addInitScript((i) => { localStorage.setItem("cdj:player", i); localStorage.setItem("cdj:name", "Voitures"); }, id);
  await b.goto(`/?${GAME}`);
  await b.waitForFunction(() => window.__cdj?.phase);
  await expect.poll(async () => (await debug(b)).choix, { message: "la voiture de l'autre appareil" }).toMatchObject({ id: "civile", couleur: 2 });
  const record = await b.evaluate((tid) => JSON.parse(localStorage.getItem(`cdj:best:${tid}`) ?? "null") as { voiture?: unknown } | null, circuit.track.id);
  expect(record?.voiture, "le record rapporté du serveur garde sa voiture").toEqual(mon);
});
