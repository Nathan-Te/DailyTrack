import { spawn, type ChildProcess } from "node:child_process";
import { expect, test, type BrowserContext, type Page, TODAY, newClockedContext } from "./fixtures";
import { dailyCircuit, encodeReplay, formatDay, runPilot, salonCircuit } from "@cdj/sim";

// Lot 32 — l'identifiant secret du joueur ne figure dans AUCUNE adresse de Track : ni dans une course du jour (classement, fantômes, envoi), ni
// à l'ouverture du Salon (heure, classement, fantômes), ni pour « revoir le meilleur tour ». Il voyage dans l'en-tête `X-Player-Id`.
// Chaque requête du navigateur est relevée (adresse **et** en-têtes) : le test échoue si l'identifiant apparaît dans l'une des adresses (ou si
// `player=` y revient), et il vérifie aussi que l'en-tête est bien là — sinon il passerait avec un jeu qui n'enverrait plus rien.
// Serveur lancé ici (port 8799, réservé à ce fichier : il garde ses joueurs et ses sessions à lui). Le rendu 3D demande WebGL : Chromium seulement.
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(240_000);

const PORT = 8799;
const API = `http://127.0.0.1:${PORT}`;
const circuit = dailyCircuit(TODAY);
const day = formatDay(TODAY);
const fastCode = encodeReplay(runPilot(circuit.track, { grip: 1 }).replay);
const slowCode = encodeReplay(runPilot(circuit.track, { grip: 0.78 }).replay);

let server: ChildProcess | undefined;

test.beforeAll(async () => {
  server = spawn("node", ["../api/dist/server.mjs"], {
    // Sessions du Salon d'une heure : le test ne traverse pas une frontière de session (gardé aussi par `awayFromBoundary`).
    env: { ...process.env, PORT: String(PORT), DB_PATH: ":memory:", ALLOW_ORIGIN: "*", NODE_NO_WARNINGS: "1", SALON_MINUTES: "60", TEST_CLOCK_OFFSET_MS: process.env.E2E_CLOCK_OFFSET_MS },
    stdio: "ignore",
  });
  for (let i = 0; i < 100; i++) {
    if (await fetch(`${API}/api/health`).then((r) => r.ok, () => false)) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`serveur ${PORT} injoignable`);
});
test.afterAll(() => void server?.kill());

type Seen = { url: string; method: string; player: string | undefined };

/** Relève chaque requête du contexte : son adresse complète, sa méthode et l'en-tête `X-Player-Id` tel qu'il part. */
function watchRequests(context: BrowserContext): { seen: Seen[]; settled: () => Promise<void> } {
  const seen: Seen[] = [];
  const pending: Promise<void>[] = [];
  context.on("request", (request) => {
    pending.push(request.allHeaders().then((h) => void seen.push({ url: request.url(), method: request.method(), player: h["x-player-id"] })));
  });
  return { seen, settled: async () => void (await Promise.all(pending)) };
}

/** Le nom de la route de DailyTrack qu'une requête de l'API vise (`ghost?kind=ahead`, `salon/board`…), ou null hors de l'API. */
function routeOf(url: string): string | null {
  if (!url.startsWith(`${API}/api/`)) return null;
  const u = new URL(url);
  const p = u.pathname.replace(/^\/api\//, "").replace(/\/\d+\//, "/").replace(/^day\/[\d-]+\//, "");
  return p === "ghost" ? `ghost?kind=${u.searchParams.get("kind")}` : p;
}

const idOf = (page: Page) => page.evaluate(() => localStorage.getItem("cdj:player") ?? "");

/** Aucune adresse ne porte l'identifiant (ni `player=`), l'adresse de la page non plus. */
function expectNoIdInAddresses(seen: Seen[], ids: string[], pages: Page[]) {
  const urls = [...seen.map((s) => s.url), ...pages.map((p) => p.url())];
  for (const url of urls) {
    expect(url, url).not.toMatch(/[?&;]player=/i);
    for (const id of ids) expect(url, url).not.toContain(id);
  }
}

// Le temps d'une session du Salon (60 minutes) : loin de sa frontière pour que les relevés restent dans la même session.
async function awayFromBoundary(marginMs = 120_000) {
  for (;;) {
    const now = (await (await fetch(`${API}/api/salon/now`)).json()) as { serverMs: number; endMs: number };
    if (now.endMs - now.serverMs >= marginMs) return;
    await new Promise((r) => setTimeout(r, 2000));
  }
}

test("aucune adresse ne porte l'identifiant du joueur : course du jour, Salon, revoir le meilleur tour", async ({ browser }) => {
  await awayFromBoundary();
  // Un autre joueur a déjà un temps du jour et un temps dans le Salon (envoyés par le serveur de test lui-même, identifiant dans l'en-tête).
  const bob = "b".repeat(32);
  const salonNow = (await (await fetch(`${API}/api/salon/now`)).json()) as { session: number };
  const salonCode = encodeReplay(runPilot(salonCircuit(salonNow.session).track, { grip: 1 }).replay);
  const daySent = await fetch(`${API}/api/submit`, { method: "POST", headers: { "Content-Type": "application/json", "X-Player-Id": bob }, body: JSON.stringify({ name: "Bob", date: day, replay: fastCode }) });
  expect(daySent.status).toBe(200);
  const salonSent = await fetch(`${API}/api/salon/${salonNow.session}/submit`, { method: "POST", headers: { "Content-Type": "application/json", "X-Player-Id": bob }, body: JSON.stringify({ name: "Bob", replay: salonCode }) });
  expect(salonSent.status).toBe(200);

  const context = await newClockedContext(browser, { viewport: { width: 1000, height: 560 } });
  const watching = watchRequests(context);
  const page = await context.newPage();

  // --- La course du jour : classement et fantôme du premier au chargement, « devant moi » par la touche G, puis l'envoi -----------------------
  await page.goto(`/?debug&timescale=6&api=${encodeURIComponent(API)}`);
  await page.waitForFunction(() => window.__cdj?.phase === "countdown" || window.__cdj?.phase === "racing");
  const id = await idOf(page);
  expect(id).toMatch(/^[0-9a-f]{32}$/);
  const asked = (route: string) => watching.seen.some((s) => routeOf(s.url) === route);
  await page.keyboard.press("g"); // fantôme suivant : le premier
  await expect.poll(() => asked("ghost?kind=first"), { timeout: 30_000 }).toBe(true);
  await page.keyboard.press("g"); // puis le joueur devant (aucun temps encore : la requête part, la réponse est « personne »)
  await expect.poll(() => asked("ghost?kind=ahead"), { timeout: 30_000 }).toBe(true);
  await page.evaluate((c) => window.__cdj.autoplay(c), slowCode);
  await page.waitForFunction(() => window.__cdj.phase === "finished", undefined, { timeout: 90_000 });
  await page.locator("#finish .online input").fill("Alice");
  await page.locator("#finish .online button[type=submit]").click();
  await expect(page.locator("#finish .online .rank")).toHaveText("2e sur 2");

  // --- Le Salon : l'heure, le classement, les fantômes (Bob a un temps dans cette session) --------------------------------------------------
  await page.goto(`/?mode=salon&debug&api=${encodeURIComponent(API)}`);
  await page.waitForFunction(() => window.__cdj?.salon?.trackId, undefined, { timeout: 60_000 });
  await page.evaluate(() => window.__cdj.salon!.refresh());
  await expect.poll(() => watching.seen.some((s) => routeOf(s.url) === "salon/ghosts"), { timeout: 60_000 }).toBe(true);

  // --- Revoir le meilleur tour : le jour, puis le Salon ---------------------------------------------------------------------------------
  await page.goto(`/?debug&watch=best&api=${encodeURIComponent(API)}`);
  await page.waitForFunction(() => window.__cdj?.watch, undefined, { timeout: 60_000 });
  await page.goto(`/?mode=salon&debug&watch=best&api=${encodeURIComponent(API)}`);
  await page.waitForFunction(() => window.__cdj?.watch, undefined, { timeout: 60_000 });
  await page.waitForFunction(() => window.__cdj.salon!.trackId, undefined, { timeout: 60_000 });
  await page.evaluate(() => window.__cdj.salon!.refresh());

  await watching.settled();
  const { seen } = watching;

  // L'identifiant n'est dans aucune adresse (et `player=` n'est revenu nulle part).
  expectNoIdInAddresses(seen, [id, bob], [page]);
  // Les routes de DailyTrack vues pendant le test portent bien l'identifiant dans l'en-tête (le test ne passe pas à vide).
  const api = seen.filter((s) => routeOf(s.url) !== null && s.method !== "OPTIONS");
  for (const route of ["leaderboard", "ghost?kind=first", "ghost?kind=ahead", "submit", "salon/now", "salon/board"]) {
    const calls = api.filter((s) => routeOf(s.url) === route);
    expect(calls.length, `${route} jamais demandée`).toBeGreaterThan(0);
    expect(calls.some((s) => s.player === id), `${route} sans X-Player-Id`).toBe(true);
    for (const c of calls) if (c.player !== undefined) expect(c.player, `${c.method} ${c.url}`).toBe(id); // (un spectateur du Salon n'envoie rien : pas de présence)
  }
  // Les fantômes du Salon se demandent par référence publique : aucun joueur, ni dans l'adresse ni dans l'en-tête.
  const ghosts = api.filter((s) => routeOf(s.url) === "salon/ghosts");
  expect(ghosts.length).toBeGreaterThan(0);
  expect(ghosts.every((s) => s.player === undefined)).toBe(true);
});
