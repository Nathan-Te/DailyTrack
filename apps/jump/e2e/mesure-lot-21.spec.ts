import { test } from "@playwright/test";
import { shiftDate } from "./clock";
import { FROZEN_DATES, generatedDay, noonOf } from "./jours";

// Mesure du lot 21 (outil, pas un test) : le niveau du jour sans le catalogue ni le générateur dans le premier chargement. Pour trois cas, profil téléphone
// 844 × 390 @2, rendu logiciel, processeur ×1 et ×4 (CDP, Chromium seulement), cache vide, médiane de N passages :
//   « figé »   : un jour dont le fichier figé est publié (rien d'autre à charger) ;
//   « worker » : un jour sans fichier figé, généré par le worker ;
//   « repli »  : le même jour, sans worker (le générateur est chargé à la demande puis calculé sur le fil principal).
// Trois chiffres : le **temps de chargement du niveau** (`__jump.daily.load.totalMs`), le **temps avant « prêt »** (depuis le début de la navigation) et les
// **octets de JavaScript reçus** (corps encodés, fil de travail compris) avant « prêt ». À lancer sur une construction d'avant et sur celle d'après, la même machine :
//   MESURE=1 npx playwright test mesure-lot-21 --project=chromium        (N=5 par défaut : RUNS=9)
// `RESEAU=1` ajoute un réseau mobile lent (150 ms d'aller-retour, 1,6 Mbit/s : le « Slow 4G » de Lighthouse) : de quoi voir ce que coûtent des fichiers de plus
// chargés l'un après l'autre (le fil de travail importe le générateur, qui importe le catalogue…).
test.skip(!process.env.MESURE, "outil de mesure : MESURE=1");
test.setTimeout(900_000);

const median = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)]!;

test("chargement du niveau du jour : figé, worker, repli", async ({ browser, browserName }) => {
  test.skip(browserName !== "chromium", "ralentissement du processeur : Chromium seulement");
  const runs = Number(process.env.RUNS ?? 5);
  const frozen = FROZEN_DATES.at(-1)!;
  const generated = generatedDay();
  const rows: string[] = [];
  for (const rate of process.env.RESEAU ? [1] : [1, 4]) {
    for (const [mode, date, noWorker] of [["figé", frozen, false], ["worker", generated, false], ["repli (sans worker)", generated, true]] as const) {
      const load: number[] = [];
      const ready: number[] = [];
      const bytes: number[] = [];
      const files: number[] = [];
      for (let i = 0; i < runs; i++) {
        const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
        try {
          await shiftDate(context, noonOf(date));
          let octets = 0;
          let n = 0;
          context.on("requestfinished", async (request) => {
            if (!/\.js(\?|$)/.test(request.url())) return;
            octets += (await request.sizes().catch(() => ({ responseBodySize: 0 }))).responseBodySize;
            n++;
          });
          const page = await context.newPage();
          const cdp = await context.newCDPSession(page);
          await cdp.send("Emulation.setCPUThrottlingRate", { rate });
          if (process.env.RESEAU) {
            await cdp.send("Network.enable");
            await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
          }
          if (noWorker) await page.addInitScript(() => void delete (window as unknown as { Worker?: unknown }).Worker);
          await page.goto("/?debug&touch=1&accueil=0");
          await page.waitForFunction(() => ["ready", "playing"].includes((window as unknown as { __jump?: { phase: string } }).__jump?.phase ?? ""));
          const r = await page.evaluate(() => ({ at: performance.now(), load: (window as unknown as { __jump: { daily: { load: { totalMs: number; source: string } } } }).__jump.daily.load }));
          load.push(r.load.totalMs);
          ready.push(r.at);
          bytes.push(octets);
          files.push(n);
        } finally {
          await context.close();
        }
      }
      const ms = (v: number[]) => `${median(v).toFixed(0)} ms`;
      rows.push(`| ×${rate} | ${mode} | ${ms(load)} | ${ms(ready)} | ${(median(bytes) / 1024).toFixed(0)} Ko (${median(files)} fichiers) |`);
    }
  }
  console.log(["| Processeur | Cas | Chargement du niveau | Avant « prêt » | JavaScript reçu |", "|---|---|---|---|---|", ...rows].join("\n"));
});
