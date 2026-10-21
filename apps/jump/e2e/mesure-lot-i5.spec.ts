import { test } from "@playwright/test";
import { shiftDate } from "./clock";

// Mesure du lot I5 (outil, pas un test) : **le coût du nouveau HUD par image**, avant / après, comme la remesure du lot I4 (Track) — temps de fil principal
// par image (CDP `Performance.getMetrics`, `TaskDuration` : script, style, mise en page, peinture, tout compris) divisé par le nombre d'images (compteur
// `requestAnimationFrame` posé dans la page), téléphone 844 × 390 @2 au doigt, rendu logiciel (SwiftShader), processeur **×4** (posé une fois la page
// chargée), fenêtre de 4,5 s ; la rediffusion de l'auteur d'un jour figé (`?seed=…&solution`, sans `?debug` : pas de surimpression de débogage), donc le
// chrono, les points de passage et les plaques qui changent comme en partie. **Trois séries par cas, médiane**, séries **entrelacées** (avant, après, puis on
// recommence) pour que la dérive de la machine joue pareil. « Avant » = la construction de `main` au début du lot (servie à part : `AVANT=http://…/`).
//   (cd <copie de main>/apps/jump && npx vite build && npx vite preview --port 4190) ;
//   AVANT=http://localhost:4190/ MESURE=1 npx playwright test mesure-lot-i5 --project=chromium
//   THEMES=foret,nuit SERIES=5 : un sous-ensemble, plus de séries.
test.skip(!process.env.MESURE, "outil de mesure : MESURE=1");
test.skip(!process.env.AVANT, "outil de mesure : AVANT=<adresse de la construction d'avant>");
test.setTimeout(3_600_000);

const DATE = "2026-10-16"; // un jour figé : chargement rapide (fichier, preuve rejouée), le même niveau avant et après
const NOW = Date.parse("2026-10-20T12:00:00Z");

test("coût du HUD par image, avant / après, par thème (×4, trois séries entrelacées, médiane)", async ({ browser, browserName }) => {
  test.skip(browserName !== "chromium", "ralentissement du processeur : Chromium seulement");
  const builds = [
    { nom: "avant", base: process.env.AVANT! },
    { nom: "après", base: "http://localhost:4174/" },
  ];
  const themes = (process.env.THEMES ?? "foret,usine,glace,nuit,neon").split(",");
  const series = Number(process.env.SERIES ?? 3);
  const mesures = new Map<string, number[]>();
  for (let s = 0; s < series; s++) {
    for (const theme of themes) {
      for (const b of builds) {
        const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: "fr-FR" });
        try {
          await shiftDate(context, NOW);
          await context.addInitScript(() => {
            localStorage.setItem("jump:aide", "1");
            const w = window as unknown as { __images: number };
            w.__images = 0;
            const tick = () => {
              w.__images++;
              requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          });
          const page = await context.newPage();
          const cdp = await context.newCDPSession(page);
          await cdp.send("Performance.enable");
          await page.goto(`${b.base}?seed=${DATE}&solution&touch=1&theme=${theme}`);
          await page.waitForSelector("canvas", { timeout: 120_000 });
          await page.waitForTimeout(2000); // le niveau se construit, la rediffusion part
          await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
          await page.waitForTimeout(1000);
          const lire = async () => {
            const m = (await cdp.send("Performance.getMetrics")).metrics;
            return { tache: m.find((x) => x.name === "TaskDuration")!.value, images: await page.evaluate(() => (window as unknown as { __images: number }).__images) };
          };
          const a = await lire();
          await page.waitForTimeout(4500);
          const z = await lire();
          const ms = ((z.tache - a.tache) * 1000) / Math.max(1, z.images - a.images);
          const cle = `${theme}|${b.nom}`;
          mesures.set(cle, [...(mesures.get(cle) ?? []), ms]);
          console.log(`série ${s + 1} · ${theme} · ${b.nom} : ${ms.toFixed(2)} ms par image (${z.images - a.images} images)`);
        } finally {
          await context.close();
        }
      }
    }
  }
  const mediane = (v: number[]) => [...v].sort((x, y) => x - y)[Math.floor(v.length / 2)]!;
  const f = (v: number) => v.toFixed(2).replace(".", ",");
  const lignes = ["| Thème | Avant (séries) | Après (séries) | Médiane avant | Médiane après | Écart |", "|---|---|---|---|---|---|"];
  for (const theme of themes) {
    const av = mesures.get(`${theme}|avant`)!;
    const ap = mesures.get(`${theme}|après`)!;
    const d = mediane(ap) - mediane(av);
    lignes.push(`| ${theme} | ${av.map(f).join(" / ")} | ${ap.map(f).join(" / ")} | ${f(mediane(av))} ms | ${f(mediane(ap))} ms | **${d >= 0 ? "+" : "−"}${f(Math.abs(d))} ms** |`);
  }
  console.log(lignes.join("\n"));
});
