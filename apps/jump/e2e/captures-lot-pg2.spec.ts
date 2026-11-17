import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { FIXED_NOW, shiftDate } from "./clock";
import { hasWebGL } from "./phone";

// Captures du lot PG2 (outil, pas un test) : le personnage de Jump en course, **à deux vitesses**, à quatre moments d'un cycle des pieds, avant / après la
// correction du sens des pieds. `CAPTURES=1 OUT=<dossier> npx playwright test captures-lot-pg2 --project=chromium` (dans `apps/jump`).
// Horloge de la page décalée puis simulation pas à pas (`manual`, `advance`) : aucune image ne dépend du temps réel.
test.skip(!process.env.CAPTURES, "outil de capture : CAPTURES=1");
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(300_000);

const OUT = process.env.OUT ?? join(import.meta.dirname, "../../../docs/plateforme/lots/img/pg2");
mkdirSync(OUT, { recursive: true });

interface J {
  phase: string;
  manual(on: boolean): void;
  advance(n: number): unknown;
  input(bits: number | null): void;
  look: { pose: string; phase: number; feet: number[]; stride: number };
  player: { vx: number; x: number; y: number };
}

// Deux vitesses : l'élan à peine pris (la course démarre) et la pleine vitesse.
const VITESSES = [
  { nom: "lente", pasAvantDeMesurer: 5 },
  { nom: "pleine", pasAvantDeMesurer: 40 },
] as const;

/** Le cadre (px CSS, 44 × 44 autour du centre des pixels jaunes du personnage) ; la caméra le déplace d'une prise à l'autre. */
async function trouverPersonnage(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
  const png = await page.screenshot();
  const c = await page.evaluate(async (b64) => {
    const bin = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
    const img = await createImageBitmap(new Blob([bin], { type: "image/png" }));
    const cv = document.createElement("canvas");
    cv.width = img.width;
    cv.height = img.height;
    const g = cv.getContext("2d")!;
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, img.width, img.height).data;
    const k = img.width / window.innerWidth;
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let y = Math.floor(120 * k); y < img.height; y++)
      for (let x = Math.floor(60 * k); x < img.width * 0.7; x++) {
        const i = (y * img.width + x) * 4;
        // le jaune du joueur (#FFD23F environ) ; le bouton SAUT est plus à droite, les pastilles plus haut
        if (d[i]! > 240 && d[i + 1]! > 190 && d[i + 1]! < 225 && d[i + 2]! < 90) {
          x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
        }
      }
    return { x: (x0 + x1) / 2 / k, y: (y0 + y1) / 2 / k };
  }, png.toString("base64"));
  return { x: Math.max(0, c.x - 28), y: Math.max(0, c.y - 28), width: 56, height: 56 };
}

for (const v of VITESSES) {
  test(`course ${v.nom}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 4, locale: "fr-FR" });
    try {
      await shiftDate(context, FIXED_NOW);
      await context.addInitScript(() => localStorage.setItem("jump:aide", "1"));
      const page = await context.newPage();
      await page.goto("/?accueil=0&touch=1");
      test.skip(!(await hasWebGL(page)), "WebGL indisponible");
      await page.goto("/?accueil=0&debug&touch=1&pieces=off");
      await page.waitForFunction(() => (window as unknown as { __jump?: J }).__jump?.phase === "ready");
      await page.addStyleTag({ content: "#debug, #stamp, #tuned { display: none !important; }" });
      await page.evaluate((n) => {
        const j = (window as unknown as { __jump: J }).__jump;
        j.manual(true);
        j.input(2);
        j.advance(n);
      }, v.pasAvantDeMesurer);
      const resume: string[] = [];
      for (let i = 0; i < 4; i++) {
        // Quatre moments : on avance de quelques pas entre deux prises, et on laisse une image se dessiner.
        await page.evaluate(() => (window as unknown as { __jump: J }).__jump.advance(4));
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        const info = await page.evaluate(() => {
          const j = (window as unknown as { __jump: J }).__jump;
          return { vx: j.player.vx, pose: j.look.pose, phase: j.look.phase, feet: j.look.feet.map((n) => Math.round(n * 1000) / 1000) };
        });
        resume.push(`${i}: vx=${info.vx.toFixed(2)} pose=${info.pose} phase=${info.phase.toFixed(3)} pieds=${JSON.stringify(info.feet)}`);
        expect(info.pose).toBe("course");
        // Où est le personnage ? Les pixels jaunes (l'aplat du corps) d'une première image donnent son cadre ; la prise est un cadrage serré autour, grossi par le facteur d'échelle.
        const cadre = await trouverPersonnage(page);
        await page.screenshot({ path: join(OUT, `course-${v.nom}-${i}.png`), clip: cadre });
      }
      console.log(resume.join("\n"));
    } finally {
      await context.close();
    }
  });
}
