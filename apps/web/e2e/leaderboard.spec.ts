import { expect, test, type Browser, type Page } from "@playwright/test";
import { dailyCircuit, encodeReplay, medalFor, runPilot } from "@cdj/sim";
import { shareLine } from "../src/share";

// Deux « appareils » (deux contextes de navigateur isolés : chacun son identité) jouent chacun une course
// complète du circuit d'aujourd'hui, en accéléré (`?debug&timescale=6`) avec la rediffusion d'un pilote à la place du
// clavier, et se retrouvent dans le même classement, servi par le vrai serveur (SQLite en mémoire).
// Le rendu 3D demande WebGL : Chromium seulement.
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

const API = "http://127.0.0.1:8787";
const day = Math.floor(Date.now() / 86_400_000);
const circuit = dailyCircuit(day);
const fast = runPilot(circuit.track, { curveSpeed: 30 });
const slow = runPilot(circuit.track, { curveSpeed: 22 });
const fastCode = encodeReplay(fast.replay);
const slowCode = encodeReplay(slow.replay);

async function newDevice(browser: Browser, api = API): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1000, height: 560 } });
  const page = await context.newPage();
  await page.goto(`/?debug&timescale=6&api=${encodeURIComponent(api)}`);
  await page.waitForFunction(() => window.__cdj?.phase === "countdown" || window.__cdj?.phase === "racing");
  return page;
}

/** Fait jouer une rediffusion à la page jusqu'à l'arrivée. */
async function race(page: Page, code: string) {
  await page.evaluate((c) => window.__cdj.autoplay(c), code);
  await page.waitForFunction(() => window.__cdj.phase === "finished", undefined, { timeout: 90_000 });
}

test("deux appareils, deux temps, un classement", async ({ browser }) => {
  // --- Appareil d'Alice : le meilleur temps ---
  const alice = await newDevice(browser);
  await race(alice, fastCode);
  await expect(alice.locator("#finish .big")).toHaveText(new RegExp(`^${Math.floor(fast.finishMs / 1000)},`));
  // Premier temps : le jeu demande un pseudo avant d'entrer au classement.
  await expect(alice.locator("#finish .online form")).toBeVisible();
  await alice.locator("#finish .online input").fill("<b>Alice</b>");
  await alice.locator("#finish .online button[type=submit]").click();
  await expect(alice.locator("#finish .online .error")).toContainText("1 à 20 caractères"); // pseudo refusé : rien n'est envoyé
  await alice.locator("#finish .online input").fill("Alice");
  await alice.locator("#finish .online button[type=submit]").click();
  await expect(alice.locator("#finish .online .rank")).toHaveText("Rang 1 / 1");
  await expect(alice.locator("#board")).toContainText("Alice");
  // La ligne à partager reprend le rang donné par le serveur.
  await expect(alice.locator("#finish .share")).toHaveText(
    shareLine({ number: circuit.number, date: circuit.date, ms: fast.finishMs, medal: medalFor(fast.finishMs, circuit.medals), rank: 1, participants: 1 }),
  );

  // --- Appareil de Bob : un temps plus lent, une autre identité ---
  const bob = await newDevice(browser);
  await race(bob, slowCode);
  await bob.locator("#finish .online input").fill("Bob");
  await bob.locator("#finish .online button[type=submit]").click();
  await expect(bob.locator("#finish .online .rank")).toHaveText("Rang 2 / 2");
  const rows = bob.locator("#board .row");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("Alice");
  await expect(rows.nth(1)).toContainText("Bob");
  await expect(rows.nth(1)).toHaveClass(/me/);

  // Le serveur a rejoué les deux courses et retrouvé exactement les temps du navigateur.
  const lb = await (await fetch(`${API}/api/day/${circuit.date}/leaderboard`)).json();
  expect(lb.participants).toBe(2);
  expect(lb.top.map((r: { name: string; ms: number }) => [r.name, r.ms])).toEqual([
    ["Alice", fast.finishMs],
    ["Bob", slow.finishMs],
  ]);

  // --- Le pseudo et l'envoi sont mémorisés : un nouveau tour plus lent n'envoie rien et ne redemande rien ---
  expect(await bob.evaluate(() => localStorage.getItem("cdj:name"))).toBe("Bob");
  expect(Number(await bob.evaluate((id) => localStorage.getItem(`cdj:sub:${id}`), circuit.track.id))).toBe(slow.finishMs);

  // --- Fantômes des autres : Bob passe de « son record » au « premier » (Alice), qui roule à sa place ---
  await bob.keyboard.press("KeyG");
  await expect(bob.locator("#ghostinfo")).toContainText("premier : Alice");
  await bob.waitForFunction(() => window.__cdj.phase === "racing"); // la course est lancée : le fantôme ne peut plus changer sur place
  expect(await bob.evaluate(() => window.__cdj.ghost !== null)).toBe(true);

  // Un autre choix en pleine course est annoncé comme « au prochain départ » (et non plus ignoré en silence)…
  await bob.keyboard.press("KeyG");
  await expect(bob.locator("#ghostinfo")).toContainText("premier : Alice");
  await expect(bob.locator("#ghostinfo")).toContainText("→ devant toi : Alice");
  // …puis devient celui qui roule dès qu'on repart.
  await bob.keyboard.press("Enter");
  await expect(bob.locator("#ghostinfo")).toContainText("devant toi : Alice");
  await expect(bob.locator("#ghostinfo")).not.toContainText("→");

  await alice.context().close();
  await bob.context().close();
});

test("un classement injoignable ne gêne pas le jeu : message clair et bouton pour réessayer", async ({ browser }) => {
  const page = await newDevice(browser, "http://127.0.0.1:9"); // personne n'écoute
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await race(page, slowCode);
  await page.locator("#finish .online input").fill("Carol");
  await page.locator("#finish .online button[type=submit]").click();
  await expect(page.locator("#finish .online .error")).toContainText("injoignable");
  await expect(page.locator("#finish .online button")).toHaveText("Réessayer");
  await expect(page.locator("#finish .big")).toBeVisible(); // le temps reste affiché
  expect(errors).toEqual([]);
  await page.context().close();
});

test("sans adresse d'API, aucun classement n'apparaît", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/?debug&timescale=6");
  await page.waitForFunction(() => window.__cdj?.phase === "countdown" || window.__cdj?.phase === "racing");
  await race(page, slowCode);
  await expect(page.locator("#finish .big")).toBeVisible();
  await expect(page.locator("#finish .online")).toHaveCount(0);
  await expect(page.locator("#board")).toBeHidden();
  await context.close();
});
