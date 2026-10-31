import { expect, test, type Page } from "@playwright/test";

// Lot 55 (partie B) — la planche sonore de la vitrine (`/track/vitrine/?planche=son`) : le moteur d'avant et les approches A (synthèse) et B (échantillons rendus hors ligne),
// écoutés sur une même course de voiture virtuelle. Personne n'écoute en CI : ce qu'on vérifie, c'est que **le son suit la voiture** (régime et hauteur
// d'après le rendu hors ligne du scénario), qu'il ne sature pas, qu'il n'est ni muet ni cassé, qu'aucun nœud audio ne fuit, que la planche s'ouvre sans erreur et que ses
// commandes répondent. Chromium seulement (Web Audio et API de rendu hors ligne).
test.skip(({ browserName }) => browserName !== "chromium", "planche sonore : Chromium seulement");
test.setTimeout(240_000);

const VOITURES = ["civile", "muscle", "monoplace", "fourgon"] as const;

async function ouvrir(page: Page): Promise<string[]> {
  const erreurs: string[] = [];
  page.on("pageerror", (e) => erreurs.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") erreurs.push(m.text());
  });
  await page.goto("/vitrine/?planche=son");
  await page.waitForFunction(() => window.__vitrine);
  expect(await page.evaluate(() => window.__vitrine!.planche)).toBe("son");
  await page.evaluate(() => window.__vitrine!.son());
  return erreurs;
}

/** Corrélation de Pearson. */
const correlation = (a: number[], b: number[]) => {
  const n = a.length;
  const ma = a.reduce((s, v) => s + v, 0) / n;
  const mb = b.reduce((s, v) => s + v, 0) / n;
  let sab = 0;
  let saa = 0;
  let sbb = 0;
  for (let i = 0; i < n; i++) {
    sab += (a[i]! - ma) * (b[i]! - mb);
    saa += (a[i]! - ma) ** 2;
    sbb += (b[i]! - mb) ** 2;
  }
  return sab / Math.sqrt(saa * sbb);
};

test("le son suit la voiture : chaque approche, chaque voiture, rendu hors ligne du scénario entier", async ({ page }) => {
  const erreurs = await ouvrir(page);
  for (const voiture of VOITURES) {
    for (const approche of ["A", "B"] as const) {
      const r = await page.evaluate(
        async ([a, v]) => {
          const { module } = (await window.__vitrine!.son())!;
          const r = await module.rendreHorsLigne(a as "A" | "B", v as never, 31, false);
          return { crete: r.crete, rms: r.rms, nonFinis: r.nonFinis, noeuds: r.noeuds, fenetres: r.fenetres };
        },
        [approche, voiture],
      );
      const nom = `${approche} · ${voiture}`;
      expect(r.nonFinis, `${nom} : aucun échantillon non fini`).toBe(0);
      expect(r.crete, `${nom} : pas de saturation`).toBeLessThan(0.98);
      expect(r.rms, `${nom} : ni muet`).toBeGreaterThan(0.05);
      expect(r.rms, `${nom} : ni assourdissant`).toBeLessThan(0.35);
      expect(r.noeuds, `${nom} : nœuds`).toBeGreaterThan(5);
      expect(r.noeuds, `${nom} : une poignée de nœuds, pas des centaines`).toBeLessThan(40);
      const w = r.fenetres;
      // Le niveau suit la charge : l'accélération à fond (3 à 14 s) est plus forte que le ralenti (0 à 1 s) et que la roue libre (29 à 31 s).
      const niveau = (t0: number, t1: number) => {
        const f = w.filter((x) => x.t >= t0 && x.t < t1);
        return f.reduce((s, x) => s + x.rms, 0) / f.length;
      };
      expect(niveau(3, 14), `${nom} : à fond plus fort qu'au ralenti`).toBeGreaterThan(niveau(0, 1.2) * 2);
      // La hauteur trouvée (produit harmonique) est celle de la fréquence d'allumage, à l'octave près (un gros moteur a un demi-ordre fort : l'estimateur peut
      // tomber une octave plus bas, ce que l'oreille entend aussi), hors ralenti et passages de rapport où le régime change vite.
      const stables = w.filter((x) => x.rpm > 1500);
      const bons = stables.filter((x) => {
        const d = Math.log2(x.trouve / x.attendu);
        return Math.abs(d - Math.round(d)) < 0.13;
      });
      expect(bons.length / stables.length, `${nom} : la hauteur suit le régime (${stables.map((x) => `${x.t}:${x.trouve}/${Math.round(x.attendu)}`).join(" ")})`).toBeGreaterThan(0.7);
    }
  }
  expect(erreurs).toEqual([]);
});

test("chacune des dix voitures construit son moteur (synthèse et boucles) et fait du bruit sans saturer", async ({ page }) => {
  const erreurs = await ouvrir(page);
  const voitures = ["civile", "fourgon", "evolution", "rallye", "gt", "roadster", "pickup", "proto", "muscle", "monoplace"];
  for (const id of voitures) {
    for (const approche of ["A", "B"] as const) {
      const r = await page.evaluate(async ([a, v]) => {
        const { module } = (await window.__vitrine!.son())!;
        const r = await module.rendreHorsLigne(a as "A" | "B", v!, 8, false);
        return { crete: r.crete, rms: r.rms, nonFinis: r.nonFinis, noeuds: r.noeuds };
      }, [approche, id]);
      expect(r.nonFinis, `${approche} · ${id}`).toBe(0);
      expect(r.crete, `${approche} · ${id} : pas de saturation`).toBeLessThan(0.98);
      expect(r.rms, `${approche} · ${id} : pas muet`).toBeGreaterThan(0.03);
    }
  }
  expect(erreurs).toEqual([]);
});

test("aucun nœud audio ne fuit : tout ce qu'un moteur crée est détaché et arrêté", async ({ page }) => {
  const erreurs = await ouvrir(page);
  for (const approche of ["actuel", "A", "B"] as const) {
    const r = await page.evaluate(async (a) => (await window.__vitrine!.son())!.module.verifierFuites(a, "muscle"), approche);
    expect(r.crees, approche).toBeGreaterThan(5);
    // Chaque nœud créé est détaché (un `disconnect` au moins) ; chaque source démarrée est arrêtée.
    expect(r.deconnectes, `${approche} : nœuds détachés`).toBeGreaterThanOrEqual(r.crees);
    expect(r.sourcesArretees, `${approche} : sources arrêtées`).toBeGreaterThanOrEqual(r.sourcesDemarrees);
  }
  expect(erreurs).toEqual([]);
});

test("la planche s'ouvre sans erreur, les approches et les voitures se choisissent, le coût se remplit, le scénario se déplace", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const erreurs = await ouvrir(page);
  await expect(page.locator("[data-approche]").first()).toBeVisible();
  await expect(page.locator(".segments [data-approche]")).toHaveCount(3);
  await expect(page.locator(".segments [data-voiture]")).toHaveCount(10);
  await expect(page.locator(".son-moment")).toHaveCount(11);
  // Rien des autres planches n'est montré.
  await expect(page.locator("#sections")).toBeHidden();
  await page.getByRole("button", { name: "Activer le son" }).click();
  await expect(page.getByRole("button", { name: "Son activé" })).toBeDisabled();
  await page.waitForFunction(async () => (await window.__vitrine!.son())!.planche.etat().actif);
  // L'approche A joue ; le régime et un rapport sont lus.
  await page.waitForFunction(async () => (await window.__vitrine!.son())!.planche.etat().noeuds > 0);
  // Se déplacer dans le scénario : l'accélération à fond.
  await page.locator(".son-moment", { hasText: "Accélération à fond" }).click();
  await page.waitForFunction(async () => {
    const e = (await window.__vitrine!.son())!.planche.etat();
    return e.t > 3.5 && e.rapport >= 1 && e.rpm > 1500;
  });
  // B puis C se chargent (fichiers décodés) et se mesurent.
  for (const a of ["B"] as const) {
    await page.locator(`.segments [data-approche="${a}"]`).click();
    await page.waitForFunction(async (x) => {
      const e = (await window.__vitrine!.son())!.planche.etat();
      return e.approche === x && e.noeuds > 5 && (e.mesures[x]?.octets ?? 0) > 10_000;
    }, a);
  }
  // Une voiture différente recharge les boucles de B.
  await page.locator(".segments [data-approche=\"B\"]").click();
  await page.locator('[data-voiture="monoplace"]').click();
  await page.waitForFunction(async () => (await window.__vitrine!.son())!.planche.etat().voiture === "monoplace");
  // Le coût est mesuré : JS par image petit, une ligne par approche, des valeurs remplies pour celles qu'on a écoutées.
  const m = await page.evaluate(async () => (await window.__vitrine!.son())!.planche.mesurer("A", 240, 1200));
  expect(m.jsMs).toBeGreaterThan(0);
  expect(m.jsMs, "le calcul JS d'une image reste très en dessous d'une image (16 ms)").toBeLessThan(4);
  await expect(page.locator(".son-couts tbody tr")).toHaveCount(3);
  await expect(page.locator('.son-couts tr[data-ligne="B"] td').nth(1)).not.toHaveText("à écouter");
  // La conduite à la main.
  await page.getByRole("button", { name: "Conduire à la main" }).click();
  await expect(page.locator(".son-manuel")).toBeVisible();
  expect(erreurs).toEqual([]);
});

test("téléphone : la planche tient dans l'écran sans défilement horizontal", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const erreurs = await ouvrir(page);
  const largeur = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, fenetre: window.innerWidth }));
  expect(largeur.doc).toBeLessThanOrEqual(largeur.fenetre);
  // Les cibles se touchent au doigt (44 px).
  let vus = 0;
  for (const b of await page.locator(".son-banc .segment, .son-moment").all()) {
    if (!(await b.isVisible())) continue; // les commandes de la conduite à la main sont repliées
    const box = await b.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(43);
    vus++;
  }
  expect(vus).toBeGreaterThan(15);
  expect(erreurs).toEqual([]);
});
