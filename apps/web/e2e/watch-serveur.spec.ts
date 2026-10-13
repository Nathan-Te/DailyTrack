import { expect, test } from "@playwright/test";

// Un spectateur ne compte pas dans la présence du Salon (lot 27b), avec le VRAI serveur local (port 8788, sessions d'une minute).
// Contrôle : un joueur ordinaire, lui, s'ajoute aux présents.
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(120_000);

const API = "http://127.0.0.1:8788";
const players = async () => ((await (await fetch(`${API}/api/salon/now`)).json()) as { players: number }).players;

test("le spectateur n'envoie aucun identifiant et n'est pas compté ; un joueur ordinaire l'est", async ({ browser }) => {
  const urls: string[] = [];
  const spectator = await (await browser.newContext()).newPage();
  spectator.on("request", (r) => urls.push(r.url()));
  const before = await players();
  await spectator.goto(`/?mode=salon&api=${encodeURIComponent(API)}&watch=best&debug`);
  await spectator.waitForFunction(() => window.__cdj?.watch, undefined, { timeout: 60_000 });
  await spectator.waitForTimeout(7000); // plus d'un tour de sondage du classement (5 s) et un `now`
  expect(urls.filter((u) => u.startsWith(API) && /\/api\/salon\//.test(u)).length).toBeGreaterThan(1);
  expect(urls.filter((u) => u.includes("player="))).toEqual([]);
  expect(await players()).toBeLessThanOrEqual(before); // (ne peut que baisser : d'autres tests ont pu laisser des présents qui s'éteignent)

  // Contrôle : le même chargement sans `watch` est un joueur, et le compte monte.
  const base = await players();
  const player = await (await browser.newContext()).newPage();
  await player.goto(`/?mode=salon&api=${encodeURIComponent(API)}&debug`);
  await player.waitForFunction(() => window.__cdj?.salon?.trackId, undefined, { timeout: 60_000 });
  await player.waitForTimeout(1500);
  expect(await players()).toBeGreaterThanOrEqual(base + 1);
});
