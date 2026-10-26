import { expect, test, newClockedContext } from "./fixtures";

// Un spectateur ne compte pas dans la présence du Salon (lot 27b), avec le VRAI serveur local (port 8789, réservé à ce test : sessions de deux minutes).
// Contrôle : un joueur ordinaire, lui, s'ajoute aux présents.
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(180_000);

const API = "http://127.0.0.1:8789";
const players = async () => ((await (await fetch(`${API}/api/salon/now`)).json()) as { players: number }).players;

// Une page qui s'ouvre juste avant la fin d'une session voit le podium puis la bascule (comportement voulu, testé ailleurs) : ici on attend,
// sur l'horloge du SERVEUR, d'être loin d'une frontière — le test dure une vingtaine de secondes, la marge en demande 50.
async function awayFromBoundary(marginMs = 50_000) {
  for (;;) {
    const now = (await (await fetch(`${API}/api/salon/now`)).json()) as { serverMs: number; endMs: number };
    if (now.endMs - now.serverMs >= marginMs) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
}

test("le spectateur n'envoie aucun identifiant et n'est pas compté ; un joueur ordinaire l'est", async ({ browser }) => {
  await awayFromBoundary();
  const urls: string[] = [];
  const headers: (string | undefined)[] = [];
  const spectator = await (await newClockedContext(browser)).newPage();
  spectator.on("request", (r) => {
    urls.push(r.url());
    if (r.url().startsWith(API)) headers.push(r.headers()["x-player-id"]); // lu tout de suite : `allHeaders()` ne se résout pas pour une requête annulée
  });
  const before = await players();
  await spectator.goto(`/?mode=salon&api=${encodeURIComponent(API)}&watch=best&debug`);
  await spectator.waitForFunction(() => window.__cdj?.watch, undefined, { timeout: 60_000 });
  // Plus d'un tour de sondage du classement (5 s) et un `now` : on attend l'ÉTAT (deux lectures du classement et au moins une autre requête du Salon), plus 7 s (lot R10).
  const salonUrls = () => urls.filter((u) => u.startsWith(API) && /\/api\/salon\//.test(u));
  await expect.poll(() => salonUrls().filter((u) => /\/board/.test(u)).length, { timeout: 30_000 }).toBeGreaterThan(1);
  expect(salonUrls().length).toBeGreaterThan(1);
  expect(urls.filter((u) => u.includes("player="))).toEqual([]);
  expect(headers.filter((h) => h !== undefined)).toEqual([]); // lot 32 : ni dans l'adresse, ni dans l'en-tête `X-Player-Id`
  expect(await players()).toBeLessThanOrEqual(before); // (personne d'autre n'utilise ce serveur : le compte ne peut que rester à zéro ou baisser)

  // Contrôle : le même chargement sans `watch` est un joueur, et le compte monte.
  const base = await players();
  const player = await (await newClockedContext(browser)).newPage();
  await player.goto(`/?mode=salon&api=${encodeURIComponent(API)}&debug`);
  await player.waitForFunction(() => window.__cdj?.salon?.trackId, undefined, { timeout: 60_000 });
  await expect.poll(players, { timeout: 30_000 }).toBeGreaterThanOrEqual(base + 1); // le joueur ordinaire est compté (un état, plus 1,5 s d'attente)
});
