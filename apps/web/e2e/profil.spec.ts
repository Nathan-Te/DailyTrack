import { expect as baseExpect, test, type Browser, type Page, TODAY, keepOpen, newClockedContext } from "./fixtures";
import { SIM_VERSION, dailyCircuit, encodeReplay, formatDay, runPilot } from "@cdj/sim";
import { courseTrack } from "./courses";
import { encodeTransfer } from "@cdj/profile";
/** `31,402 s` (le format français du socle, recopié : les tests ne dépendent pas du code qu'ils vérifient). */
const formatTime = (ms: number) => `${Math.floor(ms / 1000)},${String(ms % 1000).padStart(3, "0")}\u00a0s`;

// Lot I4 : le jeu n'a plus d'écran de profil (Réglages › « Mon profil Du Jour › » mène au profil commun du portail, qui a ses propres e2e : portail-jour.spec.ts) ;
// ce fichier garde ce qui reste au jeu : pseudos réservés à l'envoi, synchronisation du profil (records, pseudo, code remplacé) lue dans `__cdj.sync` et le stockage.
// Pseudos réservés et profil synchronisé (lot 30), avec le vrai serveur (SQLite en mémoire, port 8790, réservé à ce fichier) et plusieurs
// « appareils » = contextes de navigateur isolés. Chaque course est jouée en accéléré (`?debug&timescale=6`) avec la rediffusion d'un pilote.
// Les scénarios se suivent (mode série) : A, B et C sont les mêmes appareils d'un bout à l'autre. Le rendu 3D demande WebGL : Chromium seulement.
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
// Pas de relance : les scénarios se suivent sur le même serveur (mémoire) et chacun laisse des joueurs derrière lui. Une relance du premier trouverait « Nowy » déjà pris
// (c'est précisément ce que ce lot garantit) et ne dirait rien de la cause du premier échec.
test.describe.configure({ mode: "serial", retries: 0 });
test.setTimeout(240_000);
// Plusieurs pages et deux workers dessinent en rendu logiciel sur la CI : un aller-retour vers l'API y dépasse vite 5 s. Les attentes d'état ont 30 s.
const expect = baseExpect.configure({ timeout: 30_000 });

const API = "http://127.0.0.1:8790";
const circuit = dailyCircuit(TODAY);
const fast = runPilot(circuit.track, { grip: 1 });
const slow = runPilot(circuit.track, { grip: 0.78 });
const fastCode = encodeReplay(fast.replay);
const slowCode = encodeReplay(slow.replay);
// Lot R9 : le serveur refuse les copies. « Nowy Pro » (B) a couru `fastCode` ; quand Nowy (A) bat son record, il court **une autre** course rapide (adhérence tirée au hasard).
const fastA = courseTrack(TODAY, [0.97, 1.03]);
const GAME = `debug&timescale=6&api=${encodeURIComponent(API)}`;

async function newDevice(browser: Browser, url = `/?${GAME}`): Promise<Page> {
  const context = await newClockedContext(browser, { viewport: { width: 1100, height: 700 }, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await context.newPage();
  await page.goto(url);
  await page.waitForFunction(() => window.__cdj?.phase === "countdown" || window.__cdj?.phase === "racing");
  return page;
}

async function race(page: Page, code: string) {
  await page.evaluate((c) => window.__cdj.autoplay(c), code);
  await page.waitForFunction(() => window.__cdj.phase === "finished", undefined, { timeout: 90_000 });
}

/**
 * Met en sommeil une page dont on n'a plus besoin pour l'instant (`manual(true)` : le jeu ne tourne ni ne dessine plus). Sans cela, les autres pages ouvertes
 * continuent de dessiner en rendu logiciel et ralentissent celle qu'on regarde : le délai de 8 s d'un appel à l'API court pendant que le fil principal est occupé.
 */
const sleep = (page: Page) => page.evaluate(() => window.__cdj.manual(true));
const wake = (page: Page) => page.evaluate(() => window.__cdj.manual(false));
/**
 * Ouvre une page et attend que la synchronisation du profil ait eu une réponse du serveur (ok, inconnu ou code remplacé), en rechargeant jusqu'à trois fois :
 * sur la CI, deux workers dessinent en rendu logiciel et un appel à l'API peut dépasser son délai de 8 s (la synchronisation se dit alors « hors ligne »
 * et se refait au lancement suivant — c'est le comportement voulu du jeu, pas ce que ce test vérifie).
 */
async function syncedGoto(page: Page, url: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(url);
    await page.waitForFunction(() => window.__cdj?.sync && !["idle", "syncing"].includes(window.__cdj.sync.status), undefined, { timeout: 60_000 });
    if ((await page.evaluate(() => window.__cdj.sync.status)) !== "offline") return;
  }
}

const idOf = (page: Page) => page.evaluate(() => localStorage.getItem("cdj:player")!);
const bestOf = (page: Page) => page.evaluate((id) => JSON.parse(localStorage.getItem(`cdj:best:${id}`) ?? "null") as { ms: number; replay?: string; medal?: string | null } | null, circuit.track.id);
const board = async () => (await (await fetch(`${API}/api/day/${circuit.date}/leaderboard?limit=50`)).json()) as { participants: number; top: { name: string; ms: number }[] };
const me = (id: string) => fetch(`${API}/api/me`, { headers: { "X-Player-Id": id } });

async function chooseName(page: Page, name: string) {
  await page.locator("#finish .online input").fill(name);
  await page.locator("#finish .online button[type=submit]").click();
}

/** Ouvre l'accueil d'une page déjà chargée (avec la synchronisation de son retour). */
async function goHomeAndWait(page: Page) {
  await page.locator("#btn-home").click();
  // Une fois le décompte fini, le jeu demande confirmation avant de quitter la course en cours (selon la lenteur de la machine, on tombe d'un côté ou de l'autre).
  const leave = page.locator("#pause-leave");
  await expect(page.locator("body")).toHaveClass(/home|paused/);
  if (await leave.isVisible()) await leave.click();
  await expect(page.locator("body")).toHaveClass(/home/);
}

let a: Page; // l'appareil de Nowy (le premier propriétaire du pseudo)
let b: Page; // un autre joueur, qui veut le même pseudo
let c: Page; // le second appareil de Nowy (charge son code)
let nowyCode = "";

test("un pseudo appartient à son premier propriétaire : refusé (casse et accents), suggestions libres, puis le code le rend", async ({ browser }) => {
  // --- A joue (lentement) et prend « Nowy » ---
  a = await newDevice(browser);
  keepOpen(a.context()); // A et C servent jusqu'au dernier scénario, qui les ferme
  await race(a, slowCode);
  await chooseName(a, "Nowy");
  await expect(a.locator("#finish .online .rank")).toHaveText("1er sur 1");
  nowyCode = encodeTransfer(await idOf(a));
  expect(nowyCode).toMatch(/^CDJ2\.[0-9a-f]{32}\.[0-9a-f]{8}$/);
  await sleep(a); // A a fini sa part : il ne dessine plus pendant les courses de B et C (son stockage se lit toujours)

  // --- B est plus rapide, mais « nówy » est pris : message du serveur, suggestions libres, « Charger un code » ---
  b = await newDevice(browser);
  await race(b, fastCode);
  await chooseName(b, "nówy");
  const error = b.locator("#finish .online .error");
  await expect(error).toContainText("Ce pseudo est déjà utilisé. C'est le tien ? Charge ton code.");
  const suggestions = b.locator("#finish .online .suggestions button");
  await expect(suggestions.first()).toHaveText("nówy2");
  await expect(suggestions.nth(1)).toHaveText("nówy_FR");
  await expect(b.locator("#finish .online").getByRole("link", { name: /Mon profil Du Jour/ })).toBeVisible(); // lot I4 : le code se charge dans le profil commun
  expect(await b.evaluate(() => localStorage.getItem("cdj:name"))).toBeNull(); // refusé : rien n'est retenu
  expect((await board()).participants).toBe(1); // la course refusée n'a rien créé
  // Un pseudo libre proposé : un toucher, et le temps entre au classement (B est plus rapide qu'A).
  await suggestions.first().click();
  await expect(b.locator("#finish .online .rank")).toHaveText("1er sur 2");
  expect((await board()).top.map((r) => r.name)).toEqual(["nówy2", "Nowy"]);
  await sleep(b);

  // --- C veut « Nowy » aussi : « Charger un code » avec le code d'A le fait devenir Nowy ---
  c = await newDevice(browser);
  keepOpen(c.context());
  await race(c, slowCode);
  await chooseName(c, "NOWY");
  await expect(c.locator("#finish .online .error")).toContainText("déjà utilisé");
  // Lot I4 : « Charger un code » mène au profil commun du portail (`../profil/?retour=<page du jeu>`) ; le code s'y charge (portail-jour.spec.ts) et
  // l'identité change dans le stockage de la plateforme. Ici : le lien, puis l'identité de Nowy installée comme le fait le portail.
  const versProfil = c.waitForRequest((r) => /\/profil\/\?retour=%2F/.test(r.url()));
  await c.locator("#finish .online").getByRole("link", { name: /Mon profil Du Jour/ }).click();
  await versProfil;
  await c.goto(`/?${GAME}`);
  await c.waitForFunction(() => window.__cdj?.phase === "countdown" || window.__cdj?.phase === "racing");
  const idA = await idOf(a);
  await c.evaluate((id) => {
    localStorage.setItem("cdj:player", id);
    localStorage.setItem("cdj:name", "Nowy");
  }, idA);
  await c.reload();
  await c.waitForFunction(() => window.__cdj?.phase === "countdown" || window.__cdj?.phase === "racing");
  expect(await idOf(c)).toBe(idA);
  expect(await c.evaluate(() => localStorage.getItem("cdj:name"))).toBe("Nowy");
  expect((await board()).participants).toBe(2); // C est devenu Nowy : personne de plus au classement
  await b.context().close();
  await sleep(c);
});

test("un record fait sur un appareil apparaît sur l'autre : temps, fantôme « ton record », médaille", async () => {
  // A bat son record ; C ne le sait pas encore.
  await wake(a);
  await a.keyboard.press("Enter"); // rejouer
  await a.waitForFunction(() => window.__cdj.phase === "countdown" || window.__cdj.phase === "racing");
  await race(a, fastA.code);
  await expect(a.locator("#finish .online .rank")).toBeVisible();
  await expect.poll(async () => (await board()).top.find((r) => r.name === "Nowy")?.ms).toBe(fastA.ms);
  expect((await bestOf(c))!.ms).toBe(slow.finishMs);
  await sleep(a);

  // C revient à l'accueil après la pause de synchronisation (30 s) : on la saute en rechargeant, ce qui est un nouveau lancement.
  await syncedGoto(c, `/?home=1&${GAME}`);
  await expect.poll(async () => (await bestOf(c))?.ms, { timeout: 30_000 }).toBe(fastA.ms);
  const record = (await bestOf(c))!;
  expect(record.replay).toBe(fastA.code); // la rediffusion du serveur : le fantôme « ton record » suit
  expect(record.medal).toBe(fastA.ms <= circuit.medals.gold ? (fastA.ms <= circuit.medals.author ? "author" : "gold") : "silver");
  await expect(c.locator("#home .mine")).toContainText(formatTime(fastA.ms));
  // Le fantôme de la prochaine course est le nouveau record.
  await c.locator("#home-daily").click();
  await expect(c.locator("#ghostinfo")).toContainText(`ton record · ${formatTime(fastA.ms)}`);
  // Les archives montrent la médaille du jour.
  await c.keyboard.press("KeyH");
  const today = c.locator("#archive a.day.current, #archive a.day").first();
  await expect(today).toContainText(formatTime(fastA.ms));
  await sleep(c);
});

test("les médailles des jours passés viennent du serveur (archives d'un appareil neuf)", async ({ browser }) => {
  const day = TODAY - 3;
  const past = dailyCircuit(day);
  const context = await newClockedContext(browser, { viewport: { width: 1100, height: 700 } });
  await context.addInitScript(() => localStorage.setItem("cdj:player", "0123456789abcdef0123456789abcdef"));
  // Le serveur d'essai n'a pas d'historique (il ne classe que le jour courant) : on lui fait répondre un profil avec deux jours passés.
  await context.route(`${API}/api/me`, (route) =>
    route.fulfill({
      status: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "X-Player-Id" },
      contentType: "application/json",
      body: JSON.stringify({
        name: "Voyageur",
        renameRequired: false,
        today: formatDay(TODAY),
        simVersion: SIM_VERSION,
        stats: { days: 1, medals: { author: 0, gold: 0, silver: 1, bronze: 0 }, bestRank: { date: formatDay(day), rank: 3, participants: 11 }, streak: 0 },
        best: null,
        past: [{ date: formatDay(day), trackId: past.track.id, ms: Math.round(past.authorMs * 1.15), medal: "silver" }],
      }),
    }),
  );
  const page = await context.newPage();
  await page.goto(`/?home=1&${GAME}`);
  await page.waitForSelector("#splash", { state: "detached", timeout: 60_000 });
  await expect.poll(() => page.evaluate(() => localStorage.getItem("cdj:name")), { timeout: 30_000 }).toBe("Voyageur"); // le profil du serveur est fusionné au cache
  await page.getByRole("button", { name: /Archives/ }).click();
  const row = page.locator(`#archive a.day[data-date="${formatDay(day)}"]`);
  await expect(row).toContainText("Argent"); // lot I4 : la médaille est nommée (plus d'émoji dans l'interface)
  await context.close();
});

test("un pseudo changé sur un appareil (dans le profil commun du portail) se voit sur l'autre", async () => {
  // Le portail change le pseudo par `PUT /api/player` (les mêmes règles et refus que dans le jeu avant le lot I4).
  const res = await fetch(`${API}/api/player`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playerId: await idOf(a), name: "Nowy Pro" }) });
  expect(res.status).toBe(200);
  await expect.poll(async () => (await board()).top.map((r) => r.name)).toContain("Nowy Pro");
  // L'ancien pseudo est libre pour un autre : le pseudo n'appartient qu'à qui l'a.
  expect((await (await fetch(`${API}/api/name?name=nowy`)).json()).available).toBe(true);

  await syncedGoto(c, `/?home=1&${GAME}`);
  await expect.poll(() => c.evaluate(() => localStorage.getItem("cdj:name")), { timeout: 20_000 }).toBe("Nowy Pro");
  await sleep(c);
});

test("hors ligne : le cache sert et le dit discrètement ; le record fait hors ligne est envoyé et classé au retour du réseau", async ({ browser }) => {
  // Lot R9 : le serveur refuse les copies : le Voyageur court **sa** course (lente, d'une adhérence tirée au hasard), pas celle de Nowy ; calculée avant d'ouvrir la page.
  const lente = courseTrack(TODAY, [0.72, 0.8]);
  const d = await newDevice(browser);
  const ctx = d.context();
  const before = (await board()).participants;
  // Le réseau tombe (le serveur ne répond plus) pendant la course.
  await ctx.route(`${API}/**`, (route) => route.abort());
  await race(d, lente.code);
  await chooseName(d, "Voyageur");
  await expect(d.locator("#finish .online .error")).toContainText("Hors ligne");
  expect(await d.evaluate(() => localStorage.getItem("cdj:name"))).toBe("Voyageur"); // retenu en local, vérifié à l'envoi
  expect((await bestOf(d))!.ms).toBe(lente.ms);
  // L'accueil, sans réseau : le profil de l'appareil, et une mention discrète.
  await d.goto(`/?home=1&${GAME}`);
  await d.waitForSelector("#splash", { state: "detached", timeout: 60_000 });
  expect(await d.evaluate(() => window.__cdj.sync.status)).toBe("offline"); // le cache sert, la synchronisation se dit hors ligne
  expect(await d.evaluate(() => localStorage.getItem("cdj:name"))).toBe("Voyageur");
  expect((await board()).participants).toBe(before);
  // Le réseau revient : au lancement suivant, le record est envoyé, rejoué et classé.
  await ctx.unroute(`${API}/**`);
  await syncedGoto(d, `/?home=1&${GAME}`);
  await expect.poll(async () => (await board()).top.find((r) => r.name === "Voyageur")?.ms, { timeout: 30_000 }).toBe(lente.ms);
  await expect(d.locator("#home .mine .rank")).toContainText(/sur \d+/, { timeout: 20_000 });
  await ctx.close();
});

test("un code remplacé ailleurs : l'ancien ne vaut plus rien, le jeu le sait (code révoqué) et le nouveau garde tout", async () => {
  // Lot I4 : « Changer mon code » n'est plus dans le jeu ; la rotation est une route de la plateforme (`POST /api/me/code`, packages/profile), testée ici côté serveur.
  const oldId = await idOf(a);
  expect((await me(oldId)).status).toBe(200);
  const newId = "0f".repeat(16);
  const rot = await fetch(`${API}/api/me/code`, { method: "POST", headers: { "Content-Type": "application/json", "X-Player-Id": oldId }, body: JSON.stringify({ newId }) });
  expect(rot.status).toBe(200);

  // Le serveur : l'ancien est refusé avec le code d'erreur `code_revoked` (le jeu le traduit : `erreur.code_revoked`), le nouveau garde tout.
  const old = await me(oldId);
  expect(old.status).toBe(410);
  expect((await old.json()).error).toBe("code_revoked");
  const kept = await (await me(newId)).json();
  expect(kept).toMatchObject({ name: "Nowy Pro", stats: { days: 1 }, best: { ms: fastA.ms } });
  expect((await board()).top.find((r) => r.name === "Nowy Pro")!.ms).toBe(fastA.ms); // les temps et le pseudo sont conservés

  await sleep(c);
  // Sur A (qui a encore l'ancien code) : la synchronisation le voit et ne détruit rien.
  await syncedGoto(a, `/?home=1&${GAME}`);
  expect(await a.evaluate(() => window.__cdj.sync.status)).toBe("revoked");
  expect(await idOf(a)).toBe(oldId);
  // L'identité du nouveau code s'installe comme le fait le profil commun du portail, et le jeu repart avec.
  await a.evaluate((id) => localStorage.setItem("cdj:player", id), newId);
  await syncedGoto(a, `/?home=1&${GAME}`);
  expect(await a.evaluate(() => window.__cdj.sync.status)).not.toBe("revoked");
  expect(await a.evaluate(() => localStorage.getItem("cdj:name"))).toBe("Nowy Pro");

  for (const page of [a, c]) await page.context().close();
});

// Garde le fichier honnête : la date « aujourd'hui » des tests est celle de l'horloge maîtrisée.
test("l'horloge de test est celle du serveur", async () => {
  const health = await (await fetch(`${API}/api/health`)).json();
  expect(health.today).toBe(formatDay(TODAY));
});
