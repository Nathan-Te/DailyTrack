import { readdirSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { expect, test } from "@playwright/test";

// Chargement rapide sur mobile : budgets de poids (déterministes) et de temps (larges, la CI est variable).
const dist = new URL("../dist/assets/", import.meta.url);

test("le jeu pèse peu : budget de poids compressé", () => {
  const files = readdirSync(dist).filter((f) => f.endsWith(".js"));
  const gz = Object.fromEntries(files.map((f) => [f, gzipSync(readFileSync(new URL(f, dist))).length]));
  // Le fil de travail des miniatures (lot 13) ne se charge qu'à l'ouverture des archives : budget à part, hors du chargement initial.
  const worker = Object.entries(gz).find(([f]) => f.startsWith("circuitWorker-"))?.[1] ?? 0;
  // Le fil de travail du Salon (lot 26) non plus : il ne se charge que dans le Salon (circuit de la session, pilotes fictifs de la démo).
  const salonWorker = Object.entries(gz).find(([f]) => f.startsWith("salonWorker-"))?.[1] ?? 0;
  // Lot I4 : le catalogue anglais est un fichier à part, chargé par `import()` seulement pour un joueur en anglais (i18n.ts) ; l'outil de réglage `?debug&tune`
  // (tune.ts) ne se charge qu'à la demande : ni l'un ni l'autre ne pèse sur le premier chargement d'un joueur en français.
  const anglais = Object.entries(gz).find(([f]) => f.startsWith("catalogue.en-"))?.[1] ?? 0;
  const tune = Object.entries(gz).find(([f]) => f.startsWith("tune-"))?.[1] ?? 0;
  const total = Object.values(gz).reduce((a, b) => a + b, 0) - worker - salonWorker - anglais - tune;
  const three = Object.entries(gz).find(([f]) => f.startsWith("three-"))?.[1] ?? 0;
  const css = readdirSync(dist)
    .filter((f) => f.endsWith(".css"))
    .reduce((n, f) => n + gzipSync(readFileSync(new URL(f, dist))).length, 0);
  expect(three, "three.js doit rester dans son propre fichier (cache entre déploiements)").toBeGreaterThan(100_000);
  // Lot I4 (budget de la phase 3) : premier chargement ≤ aujourd'hui + 20 ko de JS et de CSS compressés. « Aujourd'hui » = le lot R4 : 260,2 ko de JS (le « 259 ko » du lot)
  // et 3,8 ko de CSS, soit 264,1 ko ; le lot I4 ajoute le socle (@cdj/ui : composants, jetons), le catalogue français, la langue, les nouveaux écrans et leurs feuilles.
  expect(total + css, `JS ${total} + CSS ${css} compressés : ${JSON.stringify(gz)}`).toBeLessThan(264_100 + 22_300); // lot I7 : +1 024 o autorisés par Nathan (le plein écran et la caméra en vue) ; lot 34 : +1 276 o autorisés par Nathan (freinage après les boosts, dans le générateur : docs/plateforme/budgets.md)
  expect(total, `JS compressé : ${JSON.stringify(gz)}`).toBeLessThan(275_000); // lot 34 : +1 000 o autorisés par Nathan (freinage après les boosts) ; ≈ 271,5 ko au lot I4 (lot I4 : +11,3 ko, hors catalogue anglais et réglage de conduite) ; ≈ 260,2 ko au lot R4 (lot 30 : +5,4 ko, synchronisation du profil, pseudos réservés, code de transfert CDJ2, changer son code ; lot 29 : +8,7 ko, accueil, réglages à onglets, aide, profil, classement compact, trois bus sonores ; lot 28 : +3,1 ko ; lot 26 : +10 ko, le Salon ; lot 23 : +5,6 ko ; lot 20 : +7 ko, la bibliothèque de figures ; lot 18 : +5 ko, cuves ; lot 17 : +4 ko ; lot 14 : +10 ko, planning et panneau d'admin ; lot 9 : +8 ko ; lot 13 : +5 ko de miniatures ; budget du lot 9 : ≤ 300 ko ajoutés)
  expect(total - three, "le code du jeu et de la simulation, hors three.js").toBeLessThan(142_300); // lot 34 : +1 300 o autorisés par Nathan (freinage après les boosts) ; ≈ 138,7 ko au lot I4 (lot I4 : +15 ko) ; ≈ 123,7 ko au lot R4 (lot 30 : +4,1 ko ; lot 29 : +10 ko ; lot 28 : +3,1 ko ; lot 26 : +10 ko ; lot 23 : +5,6 ko ; lot 22 : +6 ko ; lot 20 : +7 ko ; lots 17 et 18 : +10 ko ; le panneau d'admin du lot 14 pèse ≈ 8 ko, chargé seulement sur /admin/)
  expect(anglais, "le catalogue anglais, chargé à la demande").toBeLessThan(8_000); // ≈ 6,6 ko aujourd'hui
  expect(worker, "fil de travail des miniatures (une copie de sim : générateur et pilote), chargé à la demande").toBeLessThan(26_600); // ≈ 26,5 ko aujourd'hui (lot 21 : +2 ko, bas-côtés, route bosselée, règles d'identité des thèmes, moments de choix) ; ≈ 22,4 ko au lot 20 (+5,6 ko, les figures) ; ≈ 16,7 ko avant ( (lot 18 : +3 ko, les cuves du générateur et du pilote ; lot 17 : +3,6 ko, le générateur et le pilote ont grandi) ; lot 34 : +600 o autorisés par Nathan (la règle de freinage du générateur)
});

// Lot I4 : les polices. Au plus 150 ko (charte § 4), servies par un chemin unique et absolu (`/assets/…`, les mêmes fichiers que le portail : un joueur qui vient du portail les a
// déjà en cache), et seules les deux faces du premier écran sont préchargées.
test("les polices : au plus 150 ko, chemin du site partagé avec le portail, deux faces préchargées", () => {
  const css = readdirSync(dist).filter((f) => f.endsWith(".css"));
  const faces = new Set<string>();
  for (const f of css) for (const m of readFileSync(new URL(f, dist), "utf8").matchAll(/url\(["']?([^)"']+\.woff2)["']?\)/g)) faces.add(m[1]!);
  expect(faces.size, "Archivo Black, Archivo 400 et 700, JetBrains Mono 700, Barlow Condensed 600, 700 italique et 800 italique").toBe(7);
  let octets = 0;
  for (const face of faces) {
    expect(face, "les polices sont servies par /assets/ (la racine du site, comme le portail), pas relativement à la page").toMatch(/^\/assets\/[a-z-]+-latin-\d+-(normal|italic)-[\w-]+\.woff2$/);
    octets += readFileSync(new URL(`.${face}`, new URL("../dist/", import.meta.url))).length;
  }
  expect(octets, `polices : ${(octets / 1024).toFixed(1)} ko`).toBeLessThanOrEqual(150 * 1024); // ≈ 136,3 Ko
  const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
  const precharges = [...html.matchAll(/<link rel="preload" as="font" type="font\/woff2" crossorigin href="([^"]+)"/g)].map((m) => m[1]!);
  expect(precharges.map((p) => p.replace(/^\/assets\//, "").replace(/-[\w-]{8}\.woff2$/, "")).sort()).toEqual(["archivo-latin-400-normal", "barlow-condensed-latin-800-italic"]);
  for (const p of precharges) expect(faces.has(p), `${p} : le préchargement vise le même chemin que la feuille`).toBe(true);
});

test("le fil de travail du Salon pèse peu (une copie de sim : générateur et pilote, chargée seulement dans le Salon)", () => {
  const files = readdirSync(dist).filter((f) => f.startsWith("salonWorker-") && f.endsWith(".js"));
  expect(files).toHaveLength(1);
  expect(gzipSync(readFileSync(new URL(files[0]!, dist))).length).toBeLessThan(30_000); // ≈ 27,2 ko aujourd'hui
});

test.describe("chargement sur un téléphone simulé", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "CDP : Chromium seulement");

  test("écran de chargement immédiat, jeu prêt en quelques secondes (processeur ×4, 4G lente)", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const t0 = Date.now();
    await page.goto("/?debug", { waitUntil: "commit" });
    await page.waitForFunction(() => window.__cdj?.phase, undefined, { timeout: 30_000 });
    const readyMs = Date.now() - t0;
    const fcp = await page.evaluate(() => performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? -1);
    test.info().annotations.push({ type: "mesure", description: `FCP ${Math.round(fcp)} ms, prêt ${readyMs} ms` });
    expect(fcp, "le premier affichage (écran de chargement) ne doit pas attendre le JavaScript").toBeGreaterThan(0);
    expect(fcp).toBeLessThan(2500);
    expect(readyMs).toBeLessThan(8000); // ≈ 1,9 s mesuré en local
    await expect(page.locator("#splash")).toHaveCount(0); // retiré après le premier rendu
    await context.close();
  });
});
