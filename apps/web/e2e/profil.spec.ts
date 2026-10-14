import { expect as baseExpect, test, type Browser, type Page, TODAY, newClockedContext } from "./fixtures";
import { SIM_VERSION, dailyCircuit, encodeReplay, formatDay, runPilot } from "@cdj/sim";
import { encodeTransfer } from "../src/transfer";
import { formatTime } from "../src/format";

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
  await race(a, slowCode);
  await chooseName(a, "Nowy");
  await expect(a.locator("#finish .online .rank")).toHaveText("1er sur 1");
  nowyCode = encodeTransfer(await idOf(a));
  expect(nowyCode).toMatch(/^CDJ2\.[0-9a-f]{32}\.[0-9a-f]{8}$/);

  // --- B est plus rapide, mais « nówy » est pris : message du serveur, suggestions libres, « Charger un code » ---
  b = await newDevice(browser);
  await race(b, fastCode);
  await chooseName(b, "nówy");
  const error = b.locator("#finish .online .error");
  await expect(error).toContainText("Ce pseudo est déjà utilisé. C'est le tien ? Charge ton code.");
  const suggestions = b.locator("#finish .online .suggestions button");
  await expect(suggestions.first()).toHaveText("nówy2");
  await expect(suggestions.nth(1)).toHaveText("nówy_FR");
  await expect(b.locator("#finish .online").getByRole("button", { name: "Charger un code" })).toBeVisible();
  expect(await b.evaluate(() => localStorage.getItem("cdj:name"))).toBeNull(); // refusé : rien n'est retenu
  expect((await board()).participants).toBe(1); // la course refusée n'a rien créé
  await b.screenshot({ path: "../../docs/lots/img/lot-30-pseudo-pris.png" });
  // Un pseudo libre proposé : un toucher, et le temps entre au classement (B est plus rapide qu'A).
  await suggestions.first().click();
  await expect(b.locator("#finish .online .rank")).toHaveText("1er sur 2");
  expect((await board()).top.map((r) => r.name)).toEqual(["nówy2", "Nowy"]);

  // --- C veut « Nowy » aussi : « Charger un code » avec le code d'A le fait devenir Nowy ---
  c = await newDevice(browser);
  await race(c, slowCode);
  await chooseName(c, "NOWY");
  await expect(c.locator("#finish .online .error")).toContainText("déjà utilisé");
  await c.locator("#finish .online").getByRole("button", { name: "Charger un code" }).click();
  await expect(c.locator("#page-profile")).toBeVisible();
  await c.locator("#page-profile .tr-code").fill(nowyCode);
  const preview = c.locator("#page-profile .tr-preview");
  await expect(preview).toContainText("« Nowy »");
  await expect(preview).toContainText("Jours joués1");
  await c.screenshot({ path: "../../docs/lots/img/lot-30-charger-un-code.png" });
  const reloaded = c.waitForEvent("load");
  await c.locator("#page-profile .tr-apply").click();
  await reloaded;
  await c.waitForFunction(() => window.__cdj?.phase === "countdown" || window.__cdj?.phase === "racing");
  expect(await idOf(c)).toBe(await idOf(a));
  expect(await c.evaluate(() => localStorage.getItem("cdj:name"))).toBe("Nowy");
  await goHomeAndWait(c);
  await expect(c.locator("#home .profile input.name")).toHaveValue("Nowy");
  expect((await board()).participants).toBe(2); // C est devenu Nowy : personne de plus au classement
  await b.context().close();
  await sleep(a);
  await sleep(c);
});

test("un record fait sur un appareil apparaît sur l'autre : temps, fantôme « ton record », médaille", async () => {
  // A bat son record ; C ne le sait pas encore.
  await wake(a);
  await a.keyboard.press("Enter"); // rejouer
  await a.waitForFunction(() => window.__cdj.phase === "countdown" || window.__cdj.phase === "racing");
  await race(a, fastCode);
  await expect(a.locator("#finish .online .rank")).toBeVisible();
  await expect.poll(async () => (await board()).top.find((r) => r.name === "Nowy")?.ms).toBe(fast.finishMs);
  expect((await bestOf(c))!.ms).toBe(slow.finishMs);
  await sleep(a);

  // C revient à l'accueil après la pause de synchronisation (30 s) : on la saute en rechargeant, ce qui est un nouveau lancement.
  await syncedGoto(c, `/?home=1&${GAME}`);
  await expect.poll(async () => (await bestOf(c))?.ms, { timeout: 30_000 }).toBe(fast.finishMs);
  const record = (await bestOf(c))!;
  expect(record.replay).toBe(fastCode); // la rediffusion du serveur : le fantôme « ton record » suit
  expect(record.medal).toBe(fast.finishMs <= circuit.medals.gold ? (fast.finishMs <= circuit.medals.author ? "author" : "gold") : "silver");
  await expect(c.locator("#home .mine")).toContainText(formatTime(fast.finishMs));
  // Le fantôme de la prochaine course est le nouveau record.
  await c.locator("#home-daily").click();
  await expect(c.locator("#ghostinfo")).toContainText(`ton record · ${formatTime(fast.finishMs)}`);
  // Les archives montrent la médaille du jour.
  await c.keyboard.press("KeyH");
  const today = c.locator("#archive a.day.current, #archive a.day").first();
  await expect(today).toContainText(formatTime(fast.finishMs));
  await c.screenshot({ path: "../../docs/lots/img/lot-30-archives.png" });
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
  await expect(page.locator("#home .profile input.name")).toHaveValue("Voyageur");
  await expect(page.locator("#home .profile .stats")).toContainText("🥈 1");
  await expect(page.locator("#home .profile .stats")).toContainText("3e sur 11");
  await page.getByRole("button", { name: /Archives/ }).click();
  const row = page.locator("#archive a.day", { hasText: formatDay(day) });
  await expect(row).toContainText("🥈");
  await context.close();
});

test("un pseudo changé sur un appareil se voit sur l'autre", async () => {
  await wake(a);
  await goHomeAndWait(a);
  await a.locator("#home .profile input.name").fill("Nowy Pro");
  await a.getByRole("button", { name: "Enregistrer" }).click();
  await expect(a.locator("#home .profile")).toContainText("Pseudo enregistré : Nowy Pro");
  await expect.poll(async () => (await board()).top.map((r) => r.name)).toContain("Nowy Pro");
  await sleep(a);
  // L'ancien pseudo est libre pour un autre : le pseudo n'appartient qu'à qui l'a.
  expect((await (await fetch(`${API}/api/name?name=nowy`)).json()).available).toBe(true);

  await syncedGoto(c, `/?home=1&${GAME}`);
  await expect(c.locator("#home .profile input.name")).toHaveValue("Nowy Pro", { timeout: 20_000 });
  expect(await c.evaluate(() => localStorage.getItem("cdj:name"))).toBe("Nowy Pro");
  await sleep(c);
});

test("hors ligne : le cache sert et le dit discrètement ; le record fait hors ligne est envoyé et classé au retour du réseau", async ({ browser }) => {
  const d = await newDevice(browser);
  const ctx = d.context();
  const before = (await board()).participants;
  // Le réseau tombe (le serveur ne répond plus) pendant la course.
  await ctx.route(`${API}/**`, (route) => route.abort());
  await race(d, slowCode);
  await chooseName(d, "Voyageur");
  await expect(d.locator("#finish .online .error")).toContainText("Hors ligne");
  expect(await d.evaluate(() => localStorage.getItem("cdj:name"))).toBe("Voyageur"); // retenu en local, vérifié à l'envoi
  expect((await bestOf(d))!.ms).toBe(slow.finishMs);
  // L'accueil, sans réseau : le profil de l'appareil, et une mention discrète.
  await d.goto(`/?home=1&${GAME}`);
  await d.waitForSelector("#splash", { state: "detached", timeout: 60_000 });
  await expect(d.locator("#home .profile .notice.quiet")).toContainText("Hors ligne");
  await expect(d.locator("#home .profile input.name")).toHaveValue("Voyageur");
  await expect(d.locator("#home .profile .stats")).toContainText("Jours joués1");
  await d.screenshot({ path: "../../docs/lots/img/lot-30-hors-ligne.png" });
  expect((await board()).participants).toBe(before);
  // Le réseau revient : au lancement suivant, le record est envoyé, rejoué et classé.
  await ctx.unroute(`${API}/**`);
  await syncedGoto(d, `/?home=1&${GAME}`);
  await expect.poll(async () => (await board()).top.find((r) => r.name === "Voyageur")?.ms, { timeout: 30_000 }).toBe(slow.finishMs);
  await expect(d.locator("#home .profile .notice.quiet")).toHaveCount(0);
  await expect(d.locator("#home .mine .rank")).toContainText(/sur \d+/, { timeout: 20_000 });
  await ctx.close();
});

test("« Changer mon code » : l'ancien code ne vaut plus rien, l'autre appareil le voit et charge le nouveau", async () => {
  const oldId = await idOf(a);
  expect((await me(oldId)).status).toBe(200);

  // Sur C : confirmation obligatoire, puis le nouveau code est copié.
  await syncedGoto(c, `/?home=1&${GAME}`);
  await expect(c.locator("#home .profile input.name")).toHaveValue("Nowy Pro", { timeout: 20_000 });
  await c.getByRole("button", { name: "Changer mon code" }).click();
  await expect(c.locator("#home .tr-confirm")).toContainText("ne marchera plus");
  expect(await idOf(c)).toBe(oldId); // rien n'a changé tant qu'on n'a pas confirmé
  await c.locator("#home .tr-change-no").click();
  expect(await idOf(c)).toBe(oldId);
  await c.getByRole("button", { name: "Changer mon code" }).click();
  await c.locator("#home .tr-change-yes").click();
  await expect(c.locator("#home .tr-msg")).toContainText("Code changé");
  const newId = await idOf(c);
  expect(newId).not.toBe(oldId);
  const newCode = await c.evaluate(() => navigator.clipboard.readText());
  expect(newCode).toBe(encodeTransfer(newId));

  // Le serveur : l'ancien est refusé avec un message clair, le nouveau garde tout.
  const old = await me(oldId);
  expect(old.status).toBe(410);
  expect((await old.json()).message).toContain("n'est plus valide");
  const kept = await (await me(newId)).json();
  expect(kept).toMatchObject({ name: "Nowy Pro", stats: { days: 1 }, best: { ms: fast.finishMs } });
  expect((await board()).top.find((r) => r.name === "Nowy Pro")!.ms).toBe(fast.finishMs); // les temps et le pseudo sont conservés

  await sleep(c); // c ne sert plus : il affamerait la page suivante (rendu logiciel)
  // Sur A (qui a encore l'ancien code) : le jeu signale que son code n'est plus valide…
  await syncedGoto(a, `/?home=1&${GAME}`);
  const notice = a.locator("#home .profile .notice.error");
  await expect(notice).toContainText("Ce code n'est plus valide", { timeout: 20_000 });
  await a.screenshot({ path: "../../docs/lots/img/lot-30-code-invalide.png" });
  // … et on y charge le nouveau code.
  await notice.getByRole("button", { name: "Charger un code" }).click();
  await a.locator("#home .tr-code").fill(newCode);
  await expect(a.locator("#home .tr-preview")).toContainText("« Nowy Pro »");
  const reloaded = a.waitForEvent("load");
  await a.locator("#home .tr-apply").click();
  await reloaded;
  await a.waitForSelector("#splash", { state: "detached", timeout: 60_000 });
  expect(await idOf(a)).toBe(newId);
  await a.goto(`/?home=1&${GAME}`); // une course est déjà lancée après le rechargement : on repart de l'accueil
  await a.waitForSelector("#splash", { state: "detached", timeout: 60_000 });
  await expect(a.locator("#home .profile input.name")).toHaveValue("Nowy Pro");
  await expect(a.locator("#home .profile .notice.error")).toHaveCount(0);

  for (const page of [a, c]) await page.context().close();
});

// Garde le fichier honnête : la date « aujourd'hui » des tests est celle de l'horloge maîtrisée.
test("l'horloge de test est celle du serveur", async () => {
  const health = await (await fetch(`${API}/api/health`)).json();
  expect(health.today).toBe(formatDay(TODAY));
});
