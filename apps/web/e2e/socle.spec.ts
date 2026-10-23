import { expect, test } from "@playwright/test";

// Lot 39 : le socle par paliers, dans le vrai jeu. Un pas factice et un palier factice (la scène d'aujourd'hui sous un autre nom) : le palier demandé en pleine
// course **ne change pas la scène** ; à la pause, elle est reconstruite (une fois), la course reprend dans la nouvelle. Rien ne change pour un joueur : aucun
// palier n'est branché dans le jeu, ce test ne fait que prouver le mécanisme.
test("un palier demandé pendant une course n'est appliqué qu'à la pause, et ses pas se chargent à la demande", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/?debug&seed=2026-10-16&ghost=off&fx=off&home=0");
  await page.waitForFunction(() => window.__cdj?.phase);
  // Un pas factice et un palier « P1 » qui compose la scène d'aujourd'hui (le jeu n'en branche aucun).
  await page.evaluate(() => {
    const s = window.__cdj.socle;
    (window as unknown as { chargements: number }).chargements = 0;
    s.PAS_DU_JEU.factice = async () => {
      (window as unknown as { chargements: number }).chargements++;
      s.brancherComposeur("P1", (track, palette, options) => s.composer(track, palette, "existant", options));
      return {};
    };
    s.PAS_DU_PALIER.P1 = ["factice"];
  });
  expect(await page.evaluate(() => window.__cdj.socle.palier())).toBe("existant");
  expect(await page.evaluate(() => (window as unknown as { chargements: number }).chargements)).toBe(0); // rien n'est chargé avant la demande

  // Course en cours : le palier est demandé, ses pas se chargent, la scène reste.
  await page.evaluate(() => window.__cdj.manual(true));
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__cdj.phase === "racing" || window.__cdj.phase === "countdown");
  for (let i = 0; i < 40 && (await page.evaluate(() => window.__cdj.phase)) !== "racing"; i++) await page.evaluate(() => window.__cdj.advance(60));
  const avant = await page.evaluate(() => window.__cdj.socle.scene());
  await page.evaluate(() => window.__cdj.socle.demander("P1"));
  await page.waitForFunction(() => (window as unknown as { chargements: number }).chargements === 1);
  for (let i = 0; i < 6; i++) await page.evaluate(() => window.__cdj.advance(30)); // la course continue, image après image
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__cdj.phase)).toBe("racing");
  expect(await page.evaluate(() => window.__cdj.socle.scene())).toBe(avant);
  expect(await page.evaluate(() => window.__cdj.socle.palier())).toBe("existant");

  // La pause : la scène est reconstruite, une seule fois ; la voiture est dans la nouvelle.
  await page.keyboard.press("KeyP");
  await page.waitForFunction(() => window.__cdj.socle.palier() === "P1");
  const apres = await page.evaluate(() => window.__cdj.socle.scene());
  expect(apres).not.toBe(avant);
  expect(await page.evaluate(() => (window as unknown as { chargements: number }).chargements)).toBe(1);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__cdj.socle.scene())).toBe(apres);
  // Reprendre : la course continue sur la nouvelle scène, sans autre reconstruction.
  await page.keyboard.press("KeyP");
  await page.evaluate(() => window.__cdj.advance(60));
  expect(await page.evaluate(() => window.__cdj.socle.scene())).toBe(apres);
});
