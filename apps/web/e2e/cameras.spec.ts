import { expect, test, type Page } from "@playwright/test";

// Caméras (lot 23) : proche, loin, capot. Touche C au clavier, bouton 🎥 au toucher (barre d'actions) ; choix mémorisé.
// Le rendu 3D demande WebGL : Chromium seulement.
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(120_000);

const camera = (page: Page) => page.evaluate(() => window.__cdj.camera);

test("C fait défiler proche → loin → capot → proche ; la carrosserie est cachée au capot ; le choix survit au rechargement", async ({ page }) => {
  await page.goto("/?debug&scenario=pilotage");
  await page.waitForFunction(() => window.__cdj?.phase);
  await page.evaluate(() => localStorage.removeItem("cdj:camera"));
  await page.reload();
  await page.waitForFunction(() => window.__cdj?.phase);
  await page.evaluate(() => window.__cdj.manual(true));
  const names: string[] = [];
  const visible: boolean[] = [];
  const hood: boolean[] = [];
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => window.__cdj.advance(3));
    const c = await camera(page);
    names.push(c.name);
    visible.push(c.carVisible);
    hood.push(await page.evaluate(() => document.body.classList.contains("cam-hood")));
    await page.keyboard.press("KeyC");
  }
  expect(names).toEqual(["proche", "loin", "capot", "proche"]);
  expect(visible).toEqual([true, true, false, true]);
  expect(hood).toEqual([false, false, true, false]);

  // la boucle a fini sur « loin » (le dernier appui n'a pas encore passé une image : le verrou de la touche est un booléen) : un appui de plus donne le capot, mémorisé
  await page.evaluate(() => window.__cdj.advance(3));
  expect((await camera(page)).name).toBe("loin");
  await page.keyboard.press("KeyC");
  await page.evaluate(() => window.__cdj.advance(2));
  expect((await camera(page)).name).toBe("capot");
  expect(await page.evaluate(() => localStorage.getItem("cdj:camera"))).toBe("capot");
  await page.reload();
  await page.waitForFunction(() => window.__cdj?.phase);
  await page.evaluate(() => window.__cdj.manual(true));
  await page.evaluate(() => window.__cdj.advance(3));
  expect((await camera(page)).name).toBe("capot");
  await expect(page.locator("#hood")).toBeVisible();
});

test("la vue capot est plus large et plus basse que les vues poursuite (champ de vision)", async ({ page }) => {
  await page.goto("/?debug&scenario=pilotage");
  await page.waitForFunction(() => window.__cdj?.phase);
  await page.evaluate(() => window.__cdj.manual(true));
  const fovs: Record<string, number> = {};
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.__cdj.advance(4));
    const c = await camera(page);
    fovs[c.name] = c.fov;
    await page.keyboard.press("KeyC");
  }
  expect(fovs.capot).toBeGreaterThan(fovs.proche!);
  expect(fovs.proche).toBeGreaterThan(fovs.loin!);
});

const PHONES = [
  { name: "Android (Pixel 7)", viewport: { width: 851, height: 393 }, deviceScaleFactor: 2.625, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36" },
  { name: "iPhone 14", viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" },
] as const;

for (const p of PHONES) {
  for (const auto of [true, false]) {
    test(`${p.name}, ${auto ? "gaz automatique" : "deux pédales"} — le bouton 🎥 change de caméra et ne vole aucun appui (?zones=1)`, async ({ browser }) => {
      const context = await browser.newContext({ ...p, isMobile: true, hasTouch: true });
      const page = await context.newPage();
      await page.addInitScript((a) => localStorage.setItem("cdj:touch", JSON.stringify({ steerMode: "buttons", autoThrottle: a, version: 2 })), auto);
      await page.goto("/?debug&scenario=plat&touch=1&steer=buttons&zones=1");
      await page.waitForFunction(() => window.__cdj?.phase);
      await page.evaluate(() => window.__cdj.manual(true));
      const W = p.viewport.width;
      const H = p.viewport.height;
      const btn = page.locator('#tbar button[aria-label="Changer de caméra"]');
      await expect(btn).toBeVisible();
      const box = (await btn.boundingBox())!;

      // 1. écart avec les frontières entre zones : au-delà du rayon (≈ 12–14 px) où le navigateur corrige un toucher vers un petit bouton
      const frontiers = (auto ? [0.25, 0.5] : [0.25, 0.5, 0.75]).map((f) => f * W);
      for (const fx of frontiers) {
        const gap = fx < box.x ? box.x - fx : fx > box.x + box.width ? fx - (box.x + box.width) : 0;
        expect(gap, `le bouton caméra est à ${gap.toFixed(0)} px de la frontière à ${((fx / W) * 100).toFixed(0)} %`).toBeGreaterThanOrEqual(14);
      }

      // 2. un appui sur le bouton : caméra suivante, trois fois pour faire le tour
      const names: string[] = [(await camera(page)).name];
      for (let i = 0; i < 3; i++) {
        await btn.tap();
        await page.evaluate(() => window.__cdj.advance(3));
        names.push((await camera(page)).name);
      }
      expect(names[0]).toBe(names[3]);
      expect(new Set(names).size).toBe(3);

      // 3. des appuis tout autour des frontières (à 2 px de chaque côté) et sur toute la hauteur : aucun ne touche la caméra, sauf
      //    sous les doigts du bouton lui-même (≤ 14 px, où le navigateur corrige vers lui, comme pour les autres boutons de la barre)
      const before = (await camera(page)).name;
      const hits: string[] = [];
      for (const fx of frontiers) {
        for (const dx of [-2, 2]) {
          for (const fy of [0.12, 0.3, 0.5, 0.7, 0.85, 0.96]) {
            const x = fx + dx;
            const y = H * fy;
            if (x > box.x - 14 && x < box.x + box.width + 14 && y > box.y - 14 && y < box.y + box.height + 14) continue;
            await page.touchscreen.tap(x, y);
            await page.evaluate(() => window.__cdj.advance(2));
            const now = (await camera(page)).name;
            if (now !== before) hits.push(`(${Math.round(x)}, ${Math.round(y)}) → ${now}`);
          }
        }
      }
      expect(hits).toEqual([]);
      await context.close();
    });
  }
}
