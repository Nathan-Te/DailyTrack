import { test } from "@playwright/test";
import { appareil, lancer } from "./appareil";

// Les captures du lot BR1b (jamais en CI) : `CAPTURES=1 npx playwright test captures-lot-br1b --project=chromium` dans apps/rush.
// La carte des 7 jours, un groupe qui barre le chemin, un obstacle cassable (intact, puis brisé), la course (lignes de vitesse).
const DOSSIER = "../../docs/rush/lots";

test.describe("captures du lot BR1b", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test("la carte des 7 jours", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&scenario=carte&jours=7");
    await page.locator("#jeu-jouer").click();
    await page.waitForSelector(".rush-carte__jour canvas");
    await page.screenshot({ path: `${DOSSIER}/br1b-carte-7-jours.png`, fullPage: true });
    await context.close();
  });

  test("un groupe qui barre le chemin, un obstacle, la course", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&scenario=jour&theme=prairie");
    await lancer(page);
    // le groupe : 12 m avant lui, sur le chemin
    await page.evaluate(() => {
      const n = window.__rush.niveau() as unknown as { longueurCm: number; rencontres: { genre: string; s: number }[] };
      const g = n.rencontres.find((r) => r.genre === "groupe")!;
      window.__rush.aller(...(window.__rush.pointSurLeChemin(Math.max(0, (g.s - 1250) / n.longueurCm)) as [number, number]));
      window.__rush.recadrer();
      window.__jeu.avancer(20);
      window.__rush.dessinerMaintenant();
    });
    await page.screenshot({ path: `${DOSSIER}/br1b-groupe-avant.png` });
    await page.evaluate(() => {
      window.__rush.forcer(window.__rush.versLArene(), 40);
      window.__jeu.avancer(40);
      window.__rush.dessinerMaintenant();
    });
    await page.screenshot({ path: `${DOSSIER}/br1b-groupe-alerte.png` });
    // l'obstacle : le chevalier contre lui
    const pose = await page.evaluate(() => {
      const p = window.__rush.partie() as unknown as { niveau: { l: number; ox: number; oy: number; cases: Uint8Array; zones: Uint8Array }; obstacles: { cases: number[]; id: number }[]; c: { coeurs: number } };
      const n = p.niveau;
      const o = p.obstacles[0]!;
      const pris = new Set(o.cases);
      let pose: [number, number, number] | null = null;
      for (const k of o.cases) {
        const i = k % n.l;
        const j = (k - i) / n.l;
        for (const [di, dj] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
          const q = (j + dj) * n.l + i + di;
          if (pris.has(q) || n.cases[q] !== 0 || n.zones[q] !== 2 || pose) continue;
          pose = [(n.ox + (i + di) * 8192 + 4096) / 4096 + di * 2.5, (n.oy + (j + dj) * 8192 + 4096) / 4096 + dj * 2.5, (Math.round((Math.atan2(-dj, -di) / (Math.PI * 2)) * 32) + 32) % 32];
        }
      }
      for (const m of (window.__rush.partie() as unknown as { monstres: { hp: number }[] }).monstres) m.hp = 0;
      window.__rush.aller(pose![0], pose![1]);
      window.__rush.recadrer();
      window.__jeu.avancer(20);
      window.__rush.dessinerMaintenant();
      return pose;
    });
    await page.screenshot({ path: `${DOSSIER}/br1b-obstacle-intact.png` });
    await page.evaluate((pose) => {
      window.__rush.forcer((pose![2] + 1) | 64, 150);
      for (let t = 0; t < 17; t++) window.__jeu.avancer(1);
      window.__rush.dessinerMaintenant();
    }, pose);
    await page.screenshot({ path: `${DOSSIER}/br1b-obstacle-touche.png` });
    await page.evaluate(() => {
      for (let t = 0; t < 120; t++) window.__jeu.avancer(1);
      window.__rush.dessinerMaintenant();
    });
    await page.screenshot({ path: `${DOSSIER}/br1b-obstacle-brise.png` });
    await context.close();
  });

  test("la course", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&scenario=jour&theme=prairie");
    await lancer(page);
    // la course : en pleine course sur un tronçon dégagé (le calme est posé d'avance)
    await page.evaluate(() => {
      const n = window.__rush.niveau() as unknown as { depart: { x: number; y: number } };
      window.__rush.aller(n.depart.x / 4096, n.depart.y / 4096);
      const p = window.__rush.partie() as unknown as { c: { calme: number; elan: number }; monstres: { hp: number }[] };
      for (const m of p.monstres) m.hp = 0;
      p.c.calme = 72;
      window.__rush.forcer(window.__rush.versLArene(), 60);
      for (let t = 0; t < 40; t++) window.__jeu.avancer(1);
      window.__rush.recadrer();
      window.__jeu.avancer(2);
      window.__rush.dessinerMaintenant();
    });
    await page.screenshot({ path: `${DOSSIER}/br1b-course.png` });
    await context.close();
  });
});
