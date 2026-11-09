// Lot 57b (Track) : le temps de génération d'un circuit du jour **au profil téléphone** (processeur ×4), dans un fil de travail, comme le jeu.
//   node packages/sim/scripts/mesure-telephone.mjs [--versions 21,22,23] [--par-theme 8] [--ralenti 4]
// Hors CI (quelques minutes). Le calcul du fil de travail du jeu (`dailyCircuit`, comme `apps/web/src/circuitCalc.ts`) est empaqueté, puis lancé dans le Chromium de Playwright dont le
// processeur est ralenti par le protocole DevTools (`Emulation.setCPUThrottlingRate`). **Ce ralentissement ne touche que le fil principal de la page** (le témoin le vérifie : un fil de travail
// n'est pas ralenti) : le calcul tourne donc dans la page (`--mode principal`, par défaut) ; un téléphone ralentit de la même façon un fil de travail, qui ne gèle pas l'écran mais attend
// autant. `--mode travail` lance un vrai fil de travail (sans ralentissement : les temps d'un ordinateur). Pour chaque version du générateur et chaque thème, on demande les `--par-theme` premiers jours que le registre
// ne fige pas (le thème de chaque jour est celui de la version) et on note le temps jusqu'au circuit prêt, de la requête à la réponse : moyenne, pire, par thème.
// Un témoin vérifie que le ralentissement touche bien le fil de travail (une boucle de calcul pure, avec et sans).
import { createRequire } from "node:module";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const racine = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const { build } = require("esbuild");
const { chromium } = require("playwright");

const argv = process.argv.slice(2);
const opt = (nom, defaut) => {
  const i = argv.indexOf(`--${nom}`);
  return i < 0 ? defaut : argv[i + 1];
};
const VERSIONS = opt("versions", "21,22,23").split(",").map(Number);
const PAR_THEME = Number(opt("par-theme", 8));
const RALENTI = Number(opt("ralenti", 4));
const MODE = opt("mode", "principal");

const sortie = join(racine, "node_modules/.cache/cdj");
mkdirSync(sortie, { recursive: true });
const fichier = join(sortie, "circuit-worker-telephone.js");
// Le fil de travail du jeu, avec un crochet : la version du générateur à imposer (le jeu, lui, prend celle du registre des jours).
await build({
  stdin: {
    contents: `
      import { dailyCircuit, themeForDay, parseDay, resumeRegistreTrack, THEME_NAMES } from "@cdj/sim";
      const traiter = (m) => {
        if (m.cmd === "temoin") { const t0 = performance.now(); let x = 0; for (let i = 0; i < 4e7; i++) x += i % 7; return { cmd: "temoin", ms: performance.now() - t0, x }; }
        if (m.cmd === "jours") {
          const debut = parseDay(resumeRegistreTrack().jusqua) + 1;
          const jours = Object.fromEntries(THEME_NAMES.map((t) => [t, []]));
          for (let d = debut; THEME_NAMES.some((t) => jours[t].length < m.n); d++) { const t = themeForDay(d, m.g).name; if (jours[t].length < m.n) jours[t].push(d); }
          return { cmd: "jours", jours };
        }
        const t0 = performance.now();
        // Même appel que computeDaily (circuitCalc.ts), version imposée.
        const c = dailyCircuit(m.day, 0, null, m.g);
        return { cmd: "circuit", day: m.day, theme: c.theme, ms: performance.now() - t0, fallback: c.fallback, attempt: c.attempt };
      };
      if (typeof window === "undefined") self.onmessage = (e) => self.postMessage(traiter(e.data));
      else window.__traiter = traiter;`,
    resolveDir: racine,
    sourcefile: "telephone-entree.ts",
    loader: "ts",
  },
  bundle: true,
  format: "iife",
  platform: "browser",
  outfile: fichier,
  logLevel: "error",
});
const code = readFileSync(fichier, "utf8");

const navigateur = await chromium.launch();
const page = await navigateur.newPage();
await page.setContent("<html><body>mesure</body></html>");
if (MODE === "travail") {
  await page.evaluate((src) => {
    const blob = new Blob([src], { type: "text/javascript" });
    window.__w = new Worker(URL.createObjectURL(blob));
    window.__demande = (m) => new Promise((ok) => { const f = (e) => { if (e.data.cmd === m.cmd && (m.cmd !== "circuit" || e.data.day === m.day)) { window.__w.removeEventListener("message", f); ok(e.data); } }; window.__w.addEventListener("message", f); window.__w.postMessage(m); });
  }, code);
} else {
  await page.evaluate((src) => {
    (0, eval)(src);
    window.__demande = (m) => Promise.resolve(window.__traiter(m));
  }, code);
}
const demande = (m) => page.evaluate((x) => window.__demande(x), m);

const cdp = await page.context().newCDPSession(page);
const ralentir = (rate) => cdp.send("Emulation.setCPUThrottlingRate", { rate });

await ralentir(1);
const t1 = (await demande({ cmd: "temoin" })).ms;
await ralentir(RALENTI);
const tN = (await demande({ cmd: "temoin" })).ms;
console.log(`témoin (boucle de calcul dans le fil de travail) : ${t1.toFixed(0)} ms sans ralentissement, ${tN.toFixed(0)} ms à ×${RALENTI} (rapport ${(tN / t1).toFixed(2)})`);
if (tN / t1 < RALENTI * 0.6) console.log("ATTENTION : le ralentissement ne semble pas toucher le fil de travail ; les temps ci-dessous sont ceux d'un ordinateur.");

const moyenne = (a) => a.reduce((x, y) => x + y, 0) / a.length;
for (const g of VERSIONS) {
  const { jours } = await demande({ cmd: "jours", n: PAR_THEME, g });
  const tous = [];
  const parTheme = [];
  for (const [theme, liste] of Object.entries(jours)) {
    const ms = [];
    for (const day of liste) {
      const r = await demande({ cmd: "circuit", day, g });
      ms.push(r.ms);
      tous.push(r.ms);
      if (r.fallback) console.log(`  circuit de secours : v${g} jour ${day} (${theme})`);
    }
    parTheme.push(`${theme} ${moyenne(ms).toFixed(0)}`);
  }
  console.log(`v${g} à ×${RALENTI} : moyenne ${moyenne(tous).toFixed(0)} ms, pire ${Math.max(...tous).toFixed(0)} ms, médiane ${tous.sort((a, b) => a - b)[Math.floor(tous.length / 2)].toFixed(0)} ms (${tous.length} circuits) | ${parTheme.join(" · ")}`);
}
await navigateur.close();
