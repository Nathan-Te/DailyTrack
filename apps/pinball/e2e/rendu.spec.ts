import { expect, test, type Page } from "@playwright/test";
import { appareil, evenementsDeLEssai, jouerLeJour, lancer } from "./appareil";

// « Pinball » (lot PB2) — LE RENDU : la haute qualité (three.js) et le rendu de secours (à plat) sont deux façons de regarder la même partie. Ici : laquelle est à l'écran, que toute la table tient à l'image sur deux
// téléphones en portrait, que le rendu de secours ne charge pas three.js, que la partie rejouée est la même dans les deux, que le jeu tient sans WebGL, la vibration du batteur et le panneau `?debug&tune`.
// Les images (les quatre thèmes, le rendu de secours) sont dans `captures-lot-pb2.spec.ts`, hors CI.
/** Les fichiers que la page a demandés (la chronologie des ressources du navigateur : elle remonte aussi ce qui est parti avant que le test ne s'abonne). */
const fichiersChargees = (page: Page): Promise<string[]> => page.evaluate(() => performance.getEntriesByType("resource").map((e) => new URL(e.name).pathname));

test.describe("Pinball : le rendu", () => {
  test("haute qualité par défaut : three.js, toute la table à l'image sur deux téléphones en portrait (390 × 844 puis 360 × 640)", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=1");
    await page.setViewportSize({ width: 390, height: 844 });
    await lancer(page);
    for (const [largeur, hauteur] of [[390, 844], [360, 640]] as const) {
      await page.setViewportSize({ width: largeur, height: hauteur });
      await page.evaluate(() => window.__jeu.avancer(5));
      expect(await page.evaluate(() => window.__pinball!.qualite())).toBe("haute");
      const info = (await page.evaluate(() => window.__pinball!.trois()))!;
      expect(info.appels).toBeGreaterThan(0);
      // le cadrage : le sommet de l'arc, les épaules, les coins bas (donc les batteurs) sont tous à l'image
      expect(info.cadre.x, `${largeur} × ${hauteur}`).toBeLessThanOrEqual(1);
      expect(info.cadre.y0, `${largeur} × ${hauteur}`).toBeGreaterThanOrEqual(-1);
      expect(info.cadre.y1, `${largeur} × ${hauteur}`).toBeLessThanOrEqual(1);
      // la table remplit l'écran : pas un timbre-poste au milieu (le plus grand |x| ou |y| frôle le bord)
      expect(Math.max(info.cadre.x, -info.cadre.y0, info.cadre.y1), `${largeur} × ${hauteur}`).toBeGreaterThan(0.85);
    }
    const chargees = await fichiersChargees(page);
    expect(chargees.some((f) => /\/assets\/corps-/.test(f)), `fichiers : ${chargees.join(", ")}`).toBe(true);
    await context.close();
  });

  test("la basse qualité (?qualite=basse) est le rendu de secours : le rendu à plat, sans three.js", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=1&qualite=basse");
    await lancer(page);
    await page.evaluate(() => window.__jeu.avancer(5));
    expect(await page.evaluate(() => window.__pinball!.qualite())).toBe("basse");
    const chargees = await fichiersChargees(page);
    expect(await page.evaluate(() => window.__pinball!.trois())).toBeNull();
    expect(chargees.filter((f) => /\/assets\/corps-/.test(f)), "three.js n'est jamais demandé").toEqual([]);
    expect(chargees.some((f) => /\/assets\/scene-/.test(f)), "la scène, elle, est chargée").toBe(true);
    // le canvas est un canvas 2D : le jeu dessine
    expect(await page.evaluate(() => document.querySelector<HTMLCanvasElement>(".pinball-plateau")!.getContext("webgl2") === null)).toBe(true);
    await context.close();
  });

  test("la même partie dans les deux rendus : même score, même rediffusion", async ({ browser }) => {
    const resultats: { score: number[] | null; rediffusion: string | null }[] = [];
    for (const qualite of ["haute", "basse"]) {
      const { context, page } = await appareil(browser, `/?debug&manuel&tactile=0&qualite=${qualite}`);
      await lancer(page);
      await jouerLeJour(page);
      await expect(page.locator("#jeu-fin")).toBeVisible();
      resultats.push(await page.evaluate(() => ({ score: window.__jeu.score(), rediffusion: window.__jeu.rediffusion() })));
      await context.close();
    }
    expect(resultats[0]!.score).not.toBeNull();
    expect(resultats[0]).toEqual(resultats[1]);
  });

  test("sans WebGL, le rendu de secours prend le relais et la partie se joue", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0");
    await context.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...reste: unknown[]) {
        return /webgl/.test(type) ? null : (getContext as (...a: unknown[]) => unknown).call(this, type, ...reste);
      } as typeof getContext;
    });
    await page.reload();
    await page.waitForSelector("#jeu-jouer", { state: "attached" });
    await lancer(page);
    await page.evaluate(() => window.__jeu.avancer(30));
    expect(await page.evaluate(() => window.__pinball!.qualite())).toBe("basse");
    expect(await page.evaluate(() => window.__pinball!.tick())).toBe(30);
    await context.close();
  });

  test("un batteur qui frappe la bille fait vibrer (réglage de vibration actif), et rien si le joueur l'a coupé", async ({ browser }) => {
    for (const reglage of ["oui", "non"] as const) {
      const { context, page } = await appareil(browser, "/?debug&manuel&tactile=1&qualite=basse");
      await context.addInitScript((vibration) => {
        localStorage.setItem("pinball:reglages", JSON.stringify({ v: 1, mouvement: "normal", fantome: "aucun", vibration, effets: 100 }));
        Object.defineProperty(navigator, "vibrate", { configurable: true, value: (m: unknown) => ((window as unknown as { __vibre: unknown[] }).__vibre ??= []).push(m) > 0 });
      }, reglage);
      await page.reload();
      await page.waitForSelector("#jeu-jouer", { state: "attached" });
      await lancer(page);
      // les 9 000 premiers pas du robot d'essai (15 secondes de jeu) : il frappe la bille au batteur plusieurs fois
      await page.evaluate((evenements) => {
        let t = 0;
        for (const e of evenements) {
          window.__jeu.avancer(e.tick - t);
          t = e.tick;
          window.__pinball!.regler(e.c, e.enfonce);
        }
        window.__jeu.avancer(9000 - t);
      }, [...evenementsDeLEssai(9000)]);
      const compte = await page.evaluate(() => window.__pinball!.vibrations());
      const appels = await page.evaluate(() => (window as unknown as { __vibre?: unknown[] }).__vibre?.length ?? 0);
      if (reglage === "oui") {
        expect(compte, "le robot frappe la bille au batteur").toBeGreaterThan(0);
        // lot PBT1 : sur les tables dessinées le robot franchit la porte de l'orbite dans ces 9 000 pas (une vibration de 40 ms par passage) et le poteau peut renvoyer la bille (60 ms) : on les compte, à côté des frappes de batteur ; ni mission ni multibille ici (elles vibrent aussi)
        const autres = await page.evaluate(() => {
          const q = window.__pinball!.partie();
          return { vibrantes: q.passages + q.sauvetages, silencieux: !q.missionFaite && q.niveau === 1 && q.multibilles === 0 };
        });
        expect(autres.silencieux, "ni mission ni multibille dans ces pas").toBe(true);
        expect(appels).toBe(compte + autres.vibrantes);
      } else {
        expect(appels).toBe(0);
      }
      await context.close();
    }
  });

  test("?debug&tune : un curseur de la simulation relance la partie, ceux de la vue agissent en direct, « Exporter » écrit le JSON", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&tune");
    await lancer(page);
    await page.evaluate(() => window.__jeu.avancer(50));
    expect(await page.evaluate(() => window.__pinball!.tick())).toBe(50);
    await page.locator(".pinball-tune > button").click();
    const regler = (libelle: string, valeur: number): Promise<void> =>
      page.locator(`.pinball-tune label:has-text("${libelle}") input`).evaluate((el, v) => {
        (el as HTMLInputElement).value = String(v);
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }, valeur);
    // la vue : en direct, la partie continue
    const avant = (await page.evaluate(() => window.__pinball!.trois()))!.cadre;
    await regler("Caméra : angle", 50);
    expect((await page.evaluate(() => window.__pinball!.trois()))!.cadre).not.toEqual(avant);
    expect(await page.evaluate(() => window.__pinball!.tick())).toBe(50);
    // la simulation : la partie repart de zéro
    await regler("Pente", 500);
    await expect.poll(() => page.evaluate(() => window.__pinball!.tick())).toBe(0);
    await page.locator(".pinball-tune button", { hasText: "Exporter" }).click();
    const json = JSON.parse(await page.locator(".pinball-tune textarea").inputValue()) as { reglages: { pente: number; sauvee: number }; vue: { angle: number } };
    expect(json.reglages.pente).toBe(500);
    expect(json.reglages.sauvee).toBe(3000);
    expect(json.vue.angle).toBe(50);
    // « Rétablir » rend les valeurs de la maquette
    await page.locator(".pinball-tune button", { hasText: "Rétablir" }).click();
    await expect(page.locator('.pinball-tune label:has-text("Pente") input')).toHaveValue("820");
    await context.close();
  });

  test("&reglages= recharge les réglages exportés depuis l'adresse, ramenés dans leurs bornes ; la partie n'est pas classable", async ({ browser }) => {
    const json = encodeURIComponent(JSON.stringify({ reglages: { pente: 400, rebondMur: 99999, inconnu: 1 }, vue: { angle: 50 } }));
    const { context, page } = await appareil(browser, `/?debug&manuel&tactile=0&tune&qualite=basse&reglages=${json}`);
    await lancer(page);
    await page.locator(".pinball-tune > button").click();
    await expect(page.locator('.pinball-tune label:has-text("Pente") input')).toHaveValue("400");
    await expect(page.locator('.pinball-tune label:has-text("Rebond des murs") input')).toHaveValue("900"); // la borne
    await expect(page.locator('.pinball-tune label:has-text("Caméra : angle") input')).toHaveValue("50");
    await page.evaluate(() => window.__jeu.avancer(600000));
    await expect(page.locator("#jeu-fin")).toBeVisible();
    await expect(page.locator("#jeu-fin-rang")).toContainText("essai"); // « Partie d'essai : non classée »
    await context.close();
  });
});
