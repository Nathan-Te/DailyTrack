import { test, TODAY, newClockedContext } from "./fixtures";
import { dailyCircuit, encodeReplay, runPilot } from "@cdj/sim";

// Outil (hors CI : `MESURE=1 npx playwright test mesure-lot55 --project=chromium`) : le poids de cinq rediffusions et leur temps de chargement **en parallèle** sous un réseau 4G émulé
// (Chrome DevTools : débit descendant, latence). Le serveur d'essai ne compresse pas : c'est le pire cas (Firebase Hosting compresse le JSON, ≈ ×0,45).
test.skip(({ browserName }) => browserName !== "chromium" || !process.env.MESURE, "outil : MESURE=1");
test.setTimeout(300_000);
const API = "http://127.0.0.1:8802";
const circuit = dailyCircuit(TODAY);
const JOUEURS = ["Mika", "Léa", "Tom", "Inès", "Raph"].map((name, i) => ({ id: `${i + 1}`.repeat(32), name, grip: [1, 0.96, 0.95, 0.9, 0.88][i]! }));
const RESEAUX = [
  { nom: "4G courante (9 Mbit/s, 80 ms d'aller-retour)", down: (9 * 1e6) / 8, latence: 80 },
  { nom: "4G lente (1,6 Mbit/s, 300 ms d'aller-retour)", down: (1.6 * 1e6) / 8, latence: 300 },
];

test("cinq rediffusions en 4G", async ({ browser }) => {
  for (const j of JOUEURS) {
    const replay = encodeReplay(runPilot(circuit.track, { grip: j.grip }).replay);
    await fetch(`${API}/api/submit`, { method: "POST", headers: { "Content-Type": "application/json", "X-Player-Id": j.id }, body: JSON.stringify({ name: j.name, date: circuit.date, replay }) });
  }
  const refs = ((await (await fetch(`${API}/api/day/${circuit.date}/leaderboard?limit=5`)).json()) as { top: { ref: string }[] }).top.map((r) => r.ref);
  const context = await newClockedContext(browser, { viewport: { width: 800, height: 600 } });
  const page = await context.newPage();
  await page.goto("/?debug&manual&api=" + encodeURIComponent(API));
  await page.waitForFunction(() => window.__cdj?.phase !== undefined, undefined, { timeout: 60_000 });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  const lignes: string[] = [];
  for (const r of RESEAUX) {
    await cdp.send("Network.emulateNetworkConditions", { offline: false, downloadThroughput: r.down, uploadThroughput: r.down / 4, latency: r.latence });
    for (const essai of [1, 2]) {
      const m = await page.evaluate(async ({ api, date, refs }) => {
        const t0 = performance.now();
        const tailles = await Promise.all(refs.map(async (ref) => (await (await fetch(`${api}/api/day/${date}/run/${ref}?x=${Math.random()}`, { cache: "no-store" })).text()).length));
        return { ms: Math.round(performance.now() - t0), tailles };
      }, { api: API, date: circuit.date, refs });
      lignes.push(`${r.nom} · essai ${essai} : ${m.ms} ms pour ${m.tailles.length} rediffusions de ${m.tailles.join(" + ")} = ${m.tailles.reduce((a, b) => a + b, 0)} o`);
    }
  }
  console.log("MESURE\n" + lignes.join("\n"));
  await context.close();
});
