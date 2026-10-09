import { expect, test, type Browser, type Page } from "@playwright/test";
import { encodeReplay, runPilot, salonCircuit, salonTrackId } from "@cdj/sim";

// Le Salon avec le VRAI serveur local (lot 27) : l'API Node (celle du conteneur Docker, base SQLite en mémoire) tourne avec
// `SALON_MINUTES=1` (sessions d'une minute, à heure fixe). Deux « appareils » (deux contextes de navigateur isolés : chacun son identité)
// jouent chacun une course complète de la session, en accéléré (`timescale=6`, rediffusion d'un pilote à la place du clavier) ;
// chacun voit alors la ligne et le fantôme de l'autre, et la session suivante s'installe pour les deux au même moment.
// Rendu 3D : Chromium seulement.
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(300_000);

const API = "http://127.0.0.1:8788";
const SESSION_MS = 60_000;
const url = `/?mode=salon&api=${encodeURIComponent(API)}&debug&timescale=6`;

async function device(browser: Browser, name: string): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1000, height: 560 } });
  const page = await context.newPage();
  await page.addInitScript((n) => localStorage.setItem("cdj:name", n), name);
  return page;
}

const loaded = (page: Page, id: string) => page.waitForFunction((t) => window.__cdj?.salon?.trackId === t, id, { timeout: 90_000 });

test("deux navigateurs, un vrai serveur : chacun classé, chacun voit l'autre, la bascule est commune", async ({ browser }) => {
  // On vise le début de la PROCHAINE session : toute la course tient dans une session d'une minute. Les rediffusions se calculent en attendant.
  const session = Math.floor(Date.now() / SESSION_MS) + 1;
  const id = salonTrackId(session);
  const circuit = salonCircuit(session);
  // Deux pilotes de niveaux différents : le circuit change à chaque session, tous les niveaux n'y passent pas forcément.
  const finishing = (grips: number[]) => {
    for (const grip of grips) {
      const run = runPilot(circuit.track, { grip });
      if (run.valid) return run;
    }
    throw new Error("aucun pilote ne finit ce circuit");
  };
  const fast = finishing([0.95, 0.9, 0.85, 0.8]);
  const slow = finishing([0.7, 0.65, 0.6, 0.55, 0.5]);
  expect(slow.finishMs).toBeGreaterThan(fast.finishMs);
  const fastCode = encodeReplay(fast.replay);
  const slowCode = encodeReplay(slow.replay);

  // Le serveur est bien celui des sessions d'une minute, et il compte les mêmes sessions que ce test.
  const health = await (await fetch(`${API}/api/health`)).json();
  expect(health.salonMinutes).toBe(1);

  const alice = await device(browser, "Alice");
  const bob = await device(browser, "Bob");
  const start = session * SESSION_MS;
  await new Promise((r) => setTimeout(r, Math.max(0, start - Date.now() + 200)));
  await Promise.all([alice.goto(url), bob.goto(url)]);
  await Promise.all([loaded(alice, id), loaded(bob, id)]);
  // Même horloge : celle du serveur (décalage mesuré), et la durée vient du serveur.
  expect(await alice.evaluate(() => window.__cdj.salon!.sessionMs)).toBe(SESSION_MS);
  expect(await alice.evaluate(() => window.__cdj.salon!.demo)).toBe(false);

  // --- Alice, puis Bob : chacun rejoue une course complète, le serveur la rejoue et répond avec SON temps ---
  const play = async (page: Page, code: string) => {
    await page.waitForFunction(() => window.__cdj.phase === "racing" || window.__cdj.phase === "countdown", undefined, { timeout: 30_000 });
    await page.evaluate((c) => window.__cdj.autoplay(c), code);
    await expect(page.locator("#finish .rank")).toContainText("Rang", { timeout: 120_000 });
  };
  await play(alice, fastCode);
  await play(bob, slowCode);
  expect(await alice.evaluate(() => window.__cdj.salon!.best)).toBe(fast.finishMs);
  expect(await bob.evaluate(() => window.__cdj.salon!.board!.me)).toMatchObject({ name: "Bob", ms: slow.finishMs, rank: 2 });
  // Le serveur a rejoué les deux courses et retrouvé exactement les temps de la simulation.
  const direct = await (await fetch(`${API}/api/salon/${session}/board`)).json();
  expect(direct.rows.map((r: { name: string; ms: number }) => [r.name, r.ms])).toEqual([
    ["Alice", fast.finishMs],
    ["Bob", slow.finishMs],
  ]);
  expect(direct.participants).toBe(2);
  expect(JSON.stringify(direct)).not.toMatch(/[0-9a-f]{32}/); // aucun identifiant secret dans le classement public

  // --- Chacun voit la ligne et le fantôme de l'autre (le classement se rafraîchit toutes les 5 s) ---
  await alice.waitForFunction(() => window.__cdj.salon!.board!.rows.some((r) => r.name === "Bob"), undefined, { timeout: 30_000 });
  // Un nouveau départ : les fantômes (les autres et le tien) repartent avec la course.
  await Promise.all([alice.keyboard.press("Enter"), bob.keyboard.press("Enter")]);
  await alice.waitForFunction(() => window.__cdj.salon!.ghosts!.names.includes("Bob"), undefined, { timeout: 30_000 });
  await bob.waitForFunction(() => window.__cdj.salon!.board!.rows.some((r) => r.name === "Alice"), undefined, { timeout: 30_000 });
  await bob.waitForFunction(() => window.__cdj.salon!.ghosts!.names.includes("Alice"), undefined, { timeout: 30_000 });
  for (const page of [alice, bob]) {
    const g = await page.evaluate(() => window.__cdj.salon!.ghosts!);
    expect(g.rejected).toBe(0);
    expect(g.names).toContain("Toi");
    await expect(page.locator("#board")).toContainText(page === alice ? "Bob" : "Alice");
  }
  // Les présents : le serveur compte les deux navigateurs.
  const now = await (await fetch(`${API}/api/salon/now`)).json();
  expect(now.session).toBe(session);
  expect(now.players).toBe(2);

  // --- La bascule de session se fait pour les deux au même moment : podium, puis le circuit suivant, le même pour tous ---
  const switched = (page: Page) =>
    page
      .waitForFunction((s) => window.__cdj.salon!.session > s && window.__cdj.salon!.state === "playing", session, { timeout: 150_000, polling: 100 })
      .then(() => Date.now());
  const [tA, tB] = await Promise.all([switched(alice), switched(bob)]);
  console.log(`bascule : Alice ${new Date(tA).toISOString()}, Bob ${new Date(tB).toISOString()} (écart ${Math.abs(tA - tB)} ms)`);
  expect(Math.abs(tA - tB)).toBeLessThan(3000);
  const next = salonTrackId(session + 1);
  for (const page of [alice, bob]) {
    expect(await page.evaluate(() => window.__cdj.salon!.session)).toBe(session + 1);
    expect(await page.evaluate(() => window.__cdj.salon!.trackId)).toBe(next);
    expect(await page.evaluate(() => window.__cdj.salon!.stats.mainThreadGenerations)).toBe(0);
    await expect(page.locator("#podium")).toBeHidden();
  }
  // Le classement de la nouvelle session repart de zéro ; celui de la précédente reste lisible (et son podium sera gardé).
  const fresh = await (await fetch(`${API}/api/salon/${session + 1}/board`)).json();
  expect(fresh.participants).toBe(0);
  const old = await (await fetch(`${API}/api/salon/${session}/board`)).json();
  expect(old.participants).toBe(2);
});
