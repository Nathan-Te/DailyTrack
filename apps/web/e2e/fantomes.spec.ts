import { expect, test, TODAY, newClockedContext, type Page } from "./fixtures";
import { dailyCircuit, encodeReplay, runPilot } from "@cdj/sim";

// Lot 55 : choisir ses fantômes dans le classement du jour. Trois joueurs sont classés (par le vrai serveur : il rejoue leurs courses) ; un quatrième coche des cases en pause, lance
// la course : ils roulent avec leur voiture et leur pseudo ; le bouton fait défiler Rien → Le mien → Le premier → Ma sélection ; le choix est gardé pour le jour, oublié le lendemain.
// Chromium seulement (WebGL). Serveur dédié (port 8802).
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(240_000);

const API = "http://127.0.0.1:8802";
const circuit = dailyCircuit(TODAY);
const JOUEURS = [
  { id: "a1".repeat(16), name: "Alice", grip: 1 },
  { id: "b2".repeat(16), name: "Bob", grip: 0.9 },
  { id: "c3".repeat(16), name: "Cara", grip: 0.78 },
];

type Etat = { mode: string | null; choisi: boolean; refs: { ref: string; name: string; rank: number }[]; entrees: string[]; champ: number; telecharges: number };
const etat = (page: Page) => page.evaluate(() => (window as unknown as { __cdjFantomes?: Etat }).__cdjFantomes ?? null);

test.beforeAll(async () => {
  for (const j of JOUEURS) {
    const replay = encodeReplay(runPilot(circuit.track, { grip: j.grip }).replay);
    const r = await fetch(`${API}/api/submit`, { method: "POST", headers: { "Content-Type": "application/json", "X-Player-Id": j.id }, body: JSON.stringify({ name: j.name, date: circuit.date, replay }) });
    expect(r.status, `envoi de ${j.name}`).toBe(200);
  }
});

async function ouvrir(page: Page, extra = "") {
  await page.goto(`/?debug&timescale=6&api=${encodeURIComponent(API)}${extra}`);
  await page.waitForFunction(() => window.__cdj?.phase === "countdown" || window.__cdj?.phase === "racing");
  await expect(page.locator("#board .row[data-ref]")).toHaveCount(3, { timeout: 30_000 }); // le classement du coin : une référence publique par ligne
  await page.waitForFunction(() => (window as unknown as { __cdjFantomes?: unknown }).__cdjFantomes !== undefined, undefined, { timeout: 30_000 }); // le morceau à la demande
}

test("cocher trois fantômes en pause, les voir courir, faire défiler le bouton, garder le choix pour le jour", async ({ browser }) => {
  const context = await newClockedContext(browser, { viewport: { width: 1000, height: 560 } });
  const page = await context.newPage();
  await ouvrir(page);

  // Le classement ne porte que des références publiques : jamais un identifiant dans la page.
  const refs = await page.locator("#board .row[data-ref]").evaluateAll((rows) => rows.map((r) => (r as HTMLElement).dataset.ref));
  expect(refs.every((r) => /^[0-9a-f]{12}$/.test(r ?? ""))).toBe(true);
  for (const j of JOUEURS) expect(await page.content()).not.toContain(j.id);

  // En course, le coin est en lecture seule : pas de case. En pause, les cases apparaissent (le jeu est gelé).
  await expect(page.locator("#board .tg").first()).toBeHidden();
  await page.keyboard.press("p");
  await expect(page.locator("#board .tg").first()).toBeVisible();
  // Rien choisi : le premier est proposé (coché), les deux autres non.
  await expect(page.locator("#board .tg[aria-pressed=true]")).toHaveCount(1);
  await expect(page.locator("#board .fantomes-compteur__n").first()).toHaveText("1 fantôme sur 5");

  // Trois cases cochées : ma sélection, 3 fantômes sur 5.
  const cases = page.locator("#board .row[data-ref] .tg");
  await cases.nth(1).click();
  await cases.nth(2).click();
  await expect(page.locator("#board .tg[aria-pressed=true]")).toHaveCount(3);
  await expect(page.locator("#board .fantomes-compteur__n").first()).toHaveText("3 fantômes sur 5");
  await expect.poll(async () => (await etat(page))?.mode).toBe("selection");
  expect((await etat(page))?.refs.map((r) => r.name)).toEqual(["Alice", "Bob", "Cara"]);
  await expect(page.locator("#btn-ghost")).toHaveAttribute("data-badge", "3");
  // Les trois cases ont chacune leur teinte (celle de leur voiture et de leur pseudo en course).
  const teintes = await cases.evaluateAll((bs) => bs.map((b) => (b as HTMLElement).style.getPropertyValue("--teinte")));
  expect(new Set(teintes).size).toBe(3);

  // Reprendre puis recommencer : les trois fantômes sont au départ, avec leur pseudo, et partent avec la voiture.
  await page.keyboard.press("p");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__cdj.phase === "racing");
  await expect.poll(async () => (await etat(page))?.champ).toBe(3);
  expect((await etat(page))?.entrees).toEqual(["Alice", "Bob", "Cara"]);
  await expect(page.locator("#ghostinfo")).toContainText("ma sélection · 3");
  // Chacun a été téléchargé une fois (en parallèle, avant le départ).
  expect((await etat(page))?.telecharges).toBe(3);

  // Recommencer recale tout le monde : toujours trois, repartis du départ.
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__cdj.phase === "countdown" || window.__cdj.phase === "racing");
  expect((await etat(page))?.champ).toBe(3);
  expect((await etat(page))?.telecharges, "recommencer ne retélécharge rien").toBe(3);

  // Le bouton : Ma sélection → Rien → (pas encore de record : « Le mien » est sauté) → Le premier → Ma sélection.
  await page.keyboard.press("g");
  await expect(page.locator("#btn-ghost")).toHaveAttribute("data-mode", "off");
  await page.keyboard.press("g");
  await expect(page.locator("#banner")).toContainText("Pas encore de record");
  await expect(page.locator("#btn-ghost")).toHaveAttribute("data-mode", "first");
  await expect(page.locator("#btn-ghost")).toHaveAttribute("data-badge", "1");
  await page.keyboard.press("g");
  await expect(page.locator("#btn-ghost")).toHaveAttribute("data-mode", "selection");
  await expect(page.locator("#btn-ghost")).toHaveAttribute("data-badge", "3");

  // Gardé pour le jour : une autre page du même navigateur retrouve la sélection et le mode, sans rien choisir.
  await page.close(); // une page qui ne sert plus continue de dessiner et affame la suivante (le délai d'un appel à l'API court pendant ce temps)
  const autre = await context.newPage();
  await ouvrir(autre);
  await expect.poll(async () => (await etat(autre))?.mode).toBe("selection");
  expect((await etat(autre))?.refs.map((r) => r.name)).toEqual(["Alice", "Bob", "Cara"]);
  await expect(autre.locator("#btn-ghost")).toHaveAttribute("data-badge", "3");

  // Le lendemain : la sélection est oubliée (les trois sont à nouveau seulement proposés : le premier), le mode gardé d'une course à l'autre reste.
  await autre.evaluate(() => {
    const k = "cdj:track:fantomes";
    const m = JSON.parse(localStorage.getItem(k)!);
    localStorage.setItem(k, JSON.stringify({ ...m, jour: "2026-01-01" }));
  });
  await autre.reload();
  await ouvrir(autre);
  await expect.poll(async () => (await etat(autre))?.choisi).toBe(false);
  expect((await etat(autre))?.refs.map((r) => r.name)).toEqual(["Alice"]);
  expect((await etat(autre))?.mode).toBe("selection");

  await context.close();
});

test("tout décocher coupe « Ma sélection » : le bouton la saute", async ({ browser }) => {
  const context = await newClockedContext(browser, { viewport: { width: 1000, height: 560 } });
  const page = await context.newPage();
  await ouvrir(page);
  await page.keyboard.press("p");
  await page.locator("#board .row[data-ref] .tg").nth(1).click();
  await expect.poll(async () => (await etat(page))?.mode).toBe("selection");
  await page.locator("#board .fantomes-compteur .lien").first().click(); // « Tout décocher »
  await expect(page.locator("#board .tg[aria-pressed=true]")).toHaveCount(0);
  await expect(page.locator("#board .fantomes-compteur__n").first()).toHaveText("0 fantôme sur 5");
  await expect.poll(async () => (await etat(page))?.refs.length).toBe(0);
  await expect(page.locator("#btn-ghost")).toHaveAttribute("data-mode", "off");
  // Plus de « Ma sélection » : après Rien, le premier ; après le premier, Rien.
  await page.keyboard.press("p");
  await page.keyboard.press("g");
  await expect(page.locator("#btn-ghost")).toHaveAttribute("data-mode", "first");
  await page.keyboard.press("g");
  await expect(page.locator("#btn-ghost")).toHaveAttribute("data-mode", "off");

  // L'arrivée : une ligne mène au classement pour choisir ses fantômes (le joueur finit sa course, entre au classement, puis l'ouvre).
  await page.keyboard.press("p");
  await page.keyboard.press("Enter"); // un départ propre : la rediffusion jouée par `autoplay` part du pas 0
  await page.waitForFunction(() => window.__cdj.phase === "countdown");
  const code = encodeReplay(runPilot(circuit.track, { grip: 0.95 }).replay);
  await page.evaluate((c) => window.__cdj.autoplay(c), code);
  await page.waitForFunction(() => window.__cdj.phase === "finished", undefined, { timeout: 90_000 });
  await page.locator("#finish .online input").fill("Dan");
  await page.locator("#finish .online button[type=submit]").click();
  await expect(page.locator("#finish .fantomes-lien")).toBeVisible({ timeout: 30_000 });
  await page.locator("#finish .fantomes-lien").click();
  await expect(page.locator("#board-screen")).toBeVisible();
  await expect(page.locator("#board-screen .row[data-ref] .tg").first()).toBeVisible();
  await context.close();
});
