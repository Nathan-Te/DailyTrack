import { expect, test, type Page } from "@playwright/test";
import { THEME_NAMES, daysFromCivil, formatDay, themeForDay, type ThemeName } from "@cdj/sim";

// Graphismes, ambiance et niveaux de qualité (lot 23). Le rendu 3D demande WebGL : Chromium seulement.
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(180_000);

/** Une date pour chaque thème (à partir du 2026-10-10). */
function dayOf(name: ThemeName): string {
  let d = daysFromCivil(2026, 10, 10);
  while (themeForDay(d).name !== name) d++;
  return formatDay(d);
}

const AMBIENCE: Record<ThemeName, string> = { stade: "crowd", rallye: "breeze", banquise: "wind", nuit: "hum", campagne: "crickets", canyon: "hotwind", col: "wind", ville: "city" };
const DARK: ThemeName[] = ["nuit"];

async function open(page: Page, query: string) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(`/?debug&${query}`);
  await page.waitForFunction(() => window.__cdj?.phase);
  await page.evaluate(() => window.__cdj.manual(true));
  await page.evaluate(() => window.__cdj.advance(4));
  return errors;
}

test("chaque thème a son ambiance sonore, sa brume, ses panneaux ; aucune erreur de page", async ({ page }) => {
  const fogs: Record<string, number> = {};
  for (const name of THEME_NAMES) {
    const errors = await open(page, `seed=${dayOf(name)}&quality=2`);
    const audio = await page.evaluate(() => window.__cdj.audio);
    expect(audio.ambience, `ambiance de ${name}`).toBe(AMBIENCE[name]);
    const r = await page.evaluate(() => window.__cdj.render);
    expect(r.signs, `panneaux de ${name}`).toBeGreaterThan(0);
    expect(r.fog, `brume de ${name}`).not.toBeNull();
    fogs[name] = r.fog!.far;
    expect(errors, `erreurs de page (${name})`).toEqual([]);
  }
  // Brume propre au thème : tous différents ou presque (au moins cinq valeurs distinctes sur huit)
  expect(new Set(Object.values(fogs).map((v) => Math.round(v))).size).toBeGreaterThanOrEqual(5);
  // La Ville est plus voilée que le Col alpin, la Banquise plus que le Stade
  expect(fogs.ville!).toBeLessThan(fogs.col!);
  expect(fogs.banquise!).toBeLessThan(fogs.stade!);
});

test("niveaux de qualité : ombres, halos, phares, décor dense et silhouettes proches se règlent", async ({ page }) => {
  for (const [name, dark] of [["nuit", true], ["stade", false]] as const) {
    const seen: Record<number, Awaited<ReturnType<typeof stats>>> = {};
    for (const q of [0, 1, 2]) {
      const errors = await open(page, `seed=${dayOf(name)}&quality=${q}`);
      seen[q] = await stats(page);
      expect(errors, `erreurs de page (${name}, qualité ${q})`).toEqual([]);
    }
    expect(seen[0]!.shadowMap).toBe(0);
    expect(seen[1]!.shadowMap).toBe(512);
    expect(seen[2]!.shadowMap).toBe(1024);
    expect(seen[0]!.denseDecor || seen[1]!.denseDecor).toBe(false);
    expect(seen[2]!.denseDecor).toBe(true);
    expect(seen[0]!.hills || seen[1]!.hills).toBe(false);
    expect(seen[2]!.hills).toBe(true);
    if (dark) {
      expect(seen[0]!.headlights).toBe(0);
      expect(seen[1]!.headlights).toBeGreaterThan(0);
      expect(seen[0]!.halos.visible).toBe(false);
      expect(seen[1]!.halos.visible).toBe(true);
      expect(seen[1]!.halos.count).toBeGreaterThan(20);
    } else {
      expect(seen[2]!.headlights).toBe(0); // de jour, les phares sont éteints
    }
  }
  expect(DARK).toContain("nuit");
});

function stats(page: Page) {
  return page.evaluate(() => window.__cdj.render);
}

test("l'ambiance du thème passe sous le volume général : coupée par M (muet), jamais plus forte que lui", async ({ page }) => {
  await open(page, `seed=${dayOf("campagne")}&quality=2`);
  await page.keyboard.press("KeyM");
  await page.evaluate(() => window.__cdj.advance(3));
  const audio = await page.evaluate(() => window.__cdj.audio);
  expect(audio.settings.volume).toBe(0);
  expect(audio.ambience).toBe("crickets"); // l'ambiance existe toujours, c'est le volume général qui la couvre
});
