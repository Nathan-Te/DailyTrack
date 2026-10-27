import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { newClockedContext, test } from "./fixtures";
import { dailyCircuit, encodeReplay, parseDay, runPilot } from "@cdj/sim";

// Lot 51 (outil, pas un test de CI) : la netteté avant / après, aux tailles réelles — 1440p, 4K et un écran 1280 × 720 de densité 2 (tampon 2560 × 1440, FXAA coupé) —,
// le jeu sur ordinateur (`?appareil=ordinateur&palier=3` : la chaîne de post-traitement), au départ (le portique, ses feux, la tribune, la route : des bords nets et du texte).
// Chaque image est un **recadrage à la taille réelle** (960 × 540 pixels de l'écran, au centre bas de l'image), sans mise à l'échelle.
//   Avant : la construction de `main` (lot 50, scène plafonnée à 2,1 Mpx) servie à part → BASE=http://localhost:4180 LABEL=avant
//   Après : cette construction                                                         → LABEL=apres
//   CAPTURES=1 [BASE=…] LABEL=avant|apres npx playwright test captures-lot51 --project=chromium   → docs/lots/lot-51/nettete/<cas>-<label>.jpg
test.skip(!process.env.CAPTURES, "outil de capture : CAPTURES=1");
test.skip(({ browserName }) => browserName !== "chromium", "rendu 3D : Chromium seulement");
test.setTimeout(3_600_000);

const OUT = process.env.OUT ?? join(import.meta.dirname, "../../../docs/lots/lot-51/nettete");
const BASE = process.env.BASE ?? "";
const LABEL = process.env.LABEL ?? "apres";
const CAS = [
  { id: "1440p", w: 2560, h: 1440, dpr: 1 },
  { id: "4k", w: 3840, h: 2160, dpr: 1 },
  { id: "1440p-densite2", w: 1280, h: 720, dpr: 2 },
].filter((c) => !process.env.ONLY || process.env.ONLY.split(",").includes(c.id));
const JOUR = "2026-10-08";
const TICK = Number(process.env.TICK ?? 150);

for (const cas of CAS) {
  test(`${cas.id} : ${LABEL}`, async ({ browser }) => {
    mkdirSync(OUT, { recursive: true });
    const circuit = dailyCircuit(parseDay(JOUR)!);
    const code = encodeReplay(runPilot(circuit.track, { grip: 1 }).replay);
    const context = await newClockedContext(browser, { viewport: { width: cas.w, height: cas.h }, deviceScaleFactor: cas.dpr });
    const page = await context.newPage();
    await page.goto(`${BASE}/?debug&home=0&seed=${JOUR}&ghost=off&fx=off&fps=0&quality=2&appareil=ordinateur&palier=3`);
    await page.waitForFunction(() => window.__cdj?.phase);
    await page.waitForFunction(() => window.__cdj.post.actif && window.__cdj.render.renderFrames > 3, undefined, { timeout: 600_000 });
    await page.evaluate(() => window.__cdj.manual(true));
    await page.evaluate((c) => window.__cdj.autoplay(c), code);
    for (let garde = 0; garde < 400; garde++) {
      const at = await page.evaluate(() => (window.__cdj.phase === "racing" ? (window.__cdj.car as unknown as { tick: number }).tick : -1));
      if (at >= TICK) break;
      await page.evaluate((n) => window.__cdj.advance(n), at < 0 ? 60 : Math.min(30, TICK - at));
    }
    await page.keyboard.press("p");
    await page.waitForFunction(() => window.__cdj.paused);
    await page.evaluate(() => window.__cdj.manual(false));
    await page.addStyleTag({ content: "body > *:not(canvas) { visibility: hidden !important; }" });
    await page.waitForTimeout(2500);
    const r = await page.evaluate(() => window.__cdj.resolution);
    console.log(`${cas.id} ${LABEL}`, JSON.stringify(r));
    // Un recadrage de 960 × 540 pixels de l'écran, à la taille réelle (en pixels CSS : divisé par la densité), au centre, un peu bas (la route, la voiture, le portique).
    const cssW = 960 / cas.dpr;
    const cssH = 540 / cas.dpr;
    const clip = { x: Math.round((cas.w - cssW) / 2), y: Math.round(cas.h * 0.4 - cssH / 2), width: cssW, height: cssH };
    await page.screenshot({ path: join(OUT, `${cas.id}-${LABEL}.jpg`), type: "jpeg", quality: 92, clip });
    await context.close();
  });
}
