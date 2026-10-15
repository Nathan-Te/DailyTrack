import { expect, test, type Page } from "@playwright/test";
import { FIXED_NOW, atInstant } from "./clock";

// Lot 9 — les thèmes visuels : chaque thème s'affiche sans erreur, en portrait et en paysage ; `?theme=` impose le thème (cosmétique :
// l'identifiant du niveau ne change pas) ; les effets réduits allègent le décor et la parallaxe, le mouvement réduit la fige.
// Captures du README : `CAPTURES=1 npx playwright test themes --project=chromium` (dans `apps/jump`) → `docs/jump/lots/img/lot-9-<thème>.png`.

const THEMES = ["foret", "usine", "glace", "nuit", "neon"] as const;
const DATE = "2026-10-20";

interface ThemeView {
  name: string;
  forced: boolean;
  ofDay: string;
  ambience: string;
  detail: { decorLite: boolean; parallaxLite: boolean; parallaxMotion: number } | null;
  stats: { tileChunks: number; tileTriangles: number; decorItems: number; decorLite: number; layers: number; layersShown: number } | null;
}
interface J {
  phase: string;
  theme: ThemeView;
  daily: { id: string } | null;
  palette: string;
  probe(): { width: number; height: number; colors: number; background: number };
}

const hasWebGL = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  });

async function open(page: Page, query: string): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(`/?${query}`);
  await page.waitForFunction(() => {
    const p = (window as unknown as { __jump?: { phase: string } }).__jump?.phase;
    return p === "ready" || p === "no-webgl";
  }, null, { timeout: 45_000 });
  return errors;
}

const info = (page: Page) =>
  page.evaluate(() => {
    const j = (window as unknown as { __jump: J }).__jump;
    return { theme: j.theme, id: j.daily?.id ?? null, palette: j.palette, phase: j.phase };
  });

for (const orientation of ["paysage", "portrait"] as const) {
  test(`chaque thème s'affiche sans erreur (${orientation})`, async ({ browser }) => {
    test.setTimeout(240_000);
    const viewport = orientation === "paysage" ? { width: 844, height: 390 } : { width: 390, height: 844 };
    await atInstant(
      browser,
      FIXED_NOW,
      async (page) => {
        test.skip(!(await hasWebGL(page)), "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire");
        let id: string | null = null;
        for (const name of THEMES) {
          const errors = await open(page, `seed=${DATE}&debug&touch=1&theme=${name}`);
          const v = await info(page);
          expect(v.phase).toBe("ready");
          expect(v.theme.name).toBe(name);
          expect(v.theme.forced).toBe(true);
          // Le thème est cosmétique : le niveau (son identifiant) est le même pour tous les thèmes.
          if (id === null) id = v.id;
          expect(v.id).toBe(id);
          const s = v.theme.stats!;
          expect(s.tileChunks).toBeGreaterThan(1);
          expect(s.tileTriangles).toBeGreaterThan(1000);
          expect(s.layers).toBeGreaterThanOrEqual(2);
          expect(s.layersShown).toBe(s.layers);
          // Les pixels : plusieurs couleurs, le fond (ciel et plans) visible sans tout couvrir.
          const px = await page.evaluate(() => (window as unknown as { __jump: J }).__jump.probe());
          expect(px.colors).toBeGreaterThanOrEqual(8);
          expect(px.background).toBeGreaterThan(0.05);
          expect(px.background).toBeLessThan(0.98);
          expect(errors, `${name} ${orientation}`).toEqual([]);
        }
      },
      { viewport, hasTouch: true, isMobile: orientation === "portrait" || undefined },
    );
  });
}

test("?theme= impose le thème ; sans lui (ou inconnu), c'est le thème du jour", async ({ browser }) => {
  await atInstant(browser, FIXED_NOW, async (page) => {
    test.skip(!(await hasWebGL(page)), "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire");
    await open(page, `seed=${DATE}&debug`);
    const day = await info(page);
    expect(day.theme.forced).toBe(false);
    expect(day.theme.name).toBe(day.theme.ofDay);
    await open(page, `seed=${DATE}&debug&theme=lave`);
    expect((await info(page)).theme.name).toBe(day.theme.ofDay);
    const other = THEMES.find((t) => t !== day.theme.ofDay)!;
    await open(page, `seed=${DATE}&debug&theme=${other}`);
    const forced = await info(page);
    expect(forced.theme.name).toBe(other);
    expect(forced.theme.ofDay).toBe(day.theme.ofDay);
    expect(forced.id).toBe(day.id);
    // Un nom accentué marche aussi.
    await open(page, `seed=${DATE}&debug&theme=n%C3%A9on`);
    expect((await info(page)).theme.name).toBe("neon");
  });
});

test("effets réduits : décor et parallaxe allégés ; mouvement réduit : parallaxe figée", async ({ browser }) => {
  await atInstant(browser, FIXED_NOW, async (page) => {
    test.skip(!(await hasWebGL(page)), "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire");
    await open(page, `seed=${DATE}&debug&theme=nuit`);
    const normal = await info(page);
    expect(normal.theme.detail).toEqual({ decorLite: false, parallaxLite: false, parallaxMotion: 1 });
    await page.evaluate(() => localStorage.setItem("jump:settings", JSON.stringify({ v: 1, volume: 0.8, sfx: 1, ambience: 0.7, vibration: true, shake: true, effects: "reduit", reducedMotion: true })));
    await open(page, `seed=${DATE}&debug&theme=nuit`);
    const lite = await info(page);
    expect(lite.theme.detail).toEqual({ decorLite: true, parallaxLite: true, parallaxMotion: 0 });
    expect(lite.theme.stats!.layersShown).toBe(1);
    expect(lite.theme.stats!.decorLite).toBeLessThan(lite.theme.stats!.decorItems);
    // `?fx=off` allège aussi, sans toucher au réglage.
    await page.evaluate(() => localStorage.removeItem("jump:settings"));
    await open(page, `seed=${DATE}&debug&theme=nuit&fx=off`);
    expect((await info(page)).theme.detail).toMatchObject({ decorLite: true, parallaxLite: true, parallaxMotion: 1 });
  });
});

test("l'ambiance du thème se branche sur le bus « ambiance » au premier geste, sans erreur", async ({ browser, browserName }) => {
  await atInstant(browser, FIXED_NOW, async (page) => {
    test.skip(!(await hasWebGL(page)), "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire");
    const errors = await open(page, `seed=${DATE}&debug&theme=nuit`);
    type A = { available: boolean; unlocked: boolean; state: string; errors: number; ambience: { id: string | null; beds: number; events: number } };
    const audio = () => page.evaluate(() => (window as unknown as { __jump: { audio: A } }).__jump.audio);
    expect((await audio()).ambience.beds).toBe(0); // rien avant le premier geste
    await page.keyboard.press("Shift");
    await page.mouse.click(400, 300);
    const a = await audio();
    if (a.available) {
      expect(a.ambience.id).toBe("nuit");
      expect(a.ambience.beds).toBeGreaterThan(0);
      // Chromium sans tête démarre le contexte : les grillons (toutes les 0,9 à 2,4 s) se font entendre ; ailleurs, il peut rester suspendu.
      if (browserName === "chromium") {
        await page.waitForFunction(() => (window as unknown as { __jump: { audio: A } }).__jump.audio.unlocked);
        await page.waitForFunction(() => (window as unknown as { __jump: { audio: A } }).__jump.audio.ambience.events > 0, null, { timeout: 15_000 });
      }
    }
    expect((await audio()).errors).toBe(0);
    expect(errors).toEqual([]);
  });
});

test("captures des thèmes (outil : CAPTURES=1)", async ({ browser, browserName }) => {
  test.skip(!process.env.CAPTURES || browserName !== "chromium", "outil de captures : CAPTURES=1, Chromium");
  test.setTimeout(300_000);
  for (const name of THEMES) {
    await atInstant(
      browser,
      FIXED_NOW,
      async (page) => {
        // La rediffusion de l'auteur, sans surimpression : on la laisse avancer quelques secondes en temps réel.
        await page.goto(`/?seed=${DATE}&solution&theme=${name}`);
        await page.waitForTimeout(Number(process.env.CAPTURE_WAIT ?? 9000));
        await page.screenshot({ path: `../../docs/jump/lots/img/lot-9-${name}.png` });
      },
      { viewport: { width: 1280, height: 720 } },
    );
  }
});
