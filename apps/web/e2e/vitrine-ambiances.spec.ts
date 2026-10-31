import { expect, test, type Page } from "@playwright/test";

// Lot 56 — la planche d'écoute des ambiances (`/track/vitrine/?planche=ambiances`). Personne n'écoute en CI : on vérifie ce qui se mesure — que chaque thème se fabrique sans erreur, ne ssature pas, est large
// (stéréo), a un lit sans couture et assez de médiums pour un haut-parleur de téléphone, que la vitesse l'efface, que ses événements restent espacés, que la foule réagit au Stade, que rien ne fuit au
// recommencement ni au changement de thème, que l'ambiance ne modifie pas ce qu'on lui donne, et que la planche s'ouvre et répond. Chromium seulement (Web Audio hors ligne). Régression (famille R13 :
// la nuit et « Run workflow »).
test.skip(({ browserName }) => browserName !== "chromium", "planche des ambiances : Chromium seulement");
test.setTimeout(240_000);

const THEMES = ["stade", "rallye", "banquise", "campagne", "canyon", "col", "ville", "nuit"] as const;

async function ouvrir(page: Page): Promise<string[]> {
  const erreurs: string[] = [];
  page.on("pageerror", (e) => erreurs.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") erreurs.push(m.text());
  });
  await page.goto("/vitrine/?planche=ambiances");
  await page.waitForFunction(() => window.__vitrine);
  expect(await page.evaluate(() => window.__vitrine!.planche)).toBe("ambiances");
  await page.evaluate(() => window.__vitrine!.ambiances());
  return erreurs;
}

test("chaque thème se fabrique : ni saturation, ni valeur cassée, large, sans couture, des médiums, des variantes", async ({ page }) => {
  const erreurs = await ouvrir(page);
  for (const theme of THEMES) {
    const a = await page.evaluate(async (t) => (await window.__vitrine!.ambiances())!.module.analyserTheme(t), theme);
    // Le lit.
    expect(a.lit.nonFinis, `${theme} : aucun échantillon non fini`).toBe(0);
    expect(a.lit.crete, `${theme} : pas de saturation`).toBeLessThan(0.7);
    expect(a.lit.rms, `${theme} : niveau efficace du lit (0,05)`).toBeGreaterThan(0.04);
    expect(a.lit.rms, `${theme} : niveau efficace du lit (0,05)`).toBeLessThan(0.07);
    expect(a.lit.secondes, `${theme} : une boucle longue`).toBeGreaterThanOrEqual(12);
    expect(Math.abs(a.lit.correlation), `${theme} : les deux canaux sont différents (stéréo large)`).toBeLessThan(0.6);
    expect(a.lit.couture.saut, `${theme} : pas de saut à la couture de la boucle`).toBeLessThan(6);
    expect(a.lit.couture.ratio, `${theme} : pas de creux ni de bosse à la couture`).toBeGreaterThan(0.55);
    expect(a.lit.couture.ratio, `${theme} : pas de creux ni de bosse à la couture`).toBeLessThan(1.7);
    // Un haut-parleur de téléphone ne rend rien sous 250 Hz : le lit doit avoir de quoi s'entendre dans les médiums (≥ 20 % de l'énergie entre 250 et 6 000 Hz).
    expect(a.lit.bandes[1], `${theme} : des médiums (${a.lit.bandes.map((b) => b.toFixed(2)).join(" / ")})`).toBeGreaterThan(0.2);
    // Fabrication : à l'ordinateur de la CI (rendu logiciel, un seul cœur) quelques secondes au plus, des tampons de quelques Mo.
    expect(a.renduMs, `${theme} : temps de fabrication`).toBeLessThan(6000);
    expect(a.memoire, `${theme} : mémoire des tampons`).toBeLessThan(12 * 1024 * 1024);
    // La banque : des variantes (un événement qui se répète à l'identique se reconnaît), aucune crête au-dessus de 0,9, aucun groupe vide.
    expect(a.flux.length, `${theme} : au moins un flux d'événements`).toBeGreaterThan(0);
    for (const f of a.flux) {
      expect(f.pasDeGroupe, `${theme} : le flux ${f.nom} a ses variantes`).toBe(false);
      const g = a.banque.groupes[f.nom]!;
      expect(g.n, `${theme} / ${f.nom} : plusieurs variantes`).toBeGreaterThanOrEqual(f.nom === "chouette" || f.nom === "marmotte" ? 2 : 3);
      expect(g.crete, `${theme} / ${f.nom} : crête`).toBeLessThanOrEqual(0.9001);
      expect(g.dureeMin, `${theme} / ${f.nom} : une durée qui existe`).toBeGreaterThan(0.2);
      expect(g.dureeMax, `${theme} / ${f.nom} : pas plus de 7 s`).toBeLessThan(7);
    }
    expect(a.banque.secondes, `${theme} : banque`).toBeLessThan(60);
    // La couche liée au décor : seulement au Stade (la tribune) et à la Nuit (les lampadaires).
    expect(a.local !== null, `${theme} : couche liée au décor`).toBe(theme === "stade" || theme === "nuit");
    if (a.local) {
      expect(a.local.couture.saut, `${theme} : couche du décor sans saut`).toBeLessThan(8);
      expect(a.local.crete, `${theme} : couche du décor sans saturation`).toBeLessThan(0.98);
    }
    // La foule réagit au Stade, à rien d'autre ; la Nuit ne joue pas son bourdonnement à une autre hauteur (son tonal : une seule lecture).
    expect(a.reactions.length, `${theme} : réactions`).toBe(theme === "stade" ? 2 : 0);
  }
  expect(erreurs).toEqual([]);
});

test("la vitesse efface l'ambiance (le vent de la course prend le relais), sans la couper tout à fait", async ({ page }) => {
  const erreurs = await ouvrir(page);
  for (const theme of THEMES) {
    const niveaux = await page.evaluate(async (t) => {
      const { module } = (await window.__vitrine!.ambiances())!;
      const r: number[] = [];
      for (const v of [0, 30, 70]) r.push((await module.rendreAmbianceHorsLigne(t, 12, v, null)).rms);
      return r;
    }, theme);
    expect(niveaux[0]!, `${theme} : audible à l'arrêt`).toBeGreaterThan(0.02);
    expect(niveaux[0]!, `${theme} : bien sous le moteur au ralenti (≈ 0,03 à 0,04)`).toBeLessThan(0.06);
    expect(niveaux[1]!, `${theme} : baisse à 30 m/s`).toBeLessThan(niveaux[0]! * 0.85);
    expect(niveaux[2]!, `${theme} : au plancher à 70 m/s`).toBeLessThan(niveaux[0]! * 0.4);
    expect(niveaux[2]!, `${theme} : jamais coupée tout à fait`).toBeGreaterThan(niveaux[0]! * 0.04);
  }
  expect(erreurs).toEqual([]);
});

test("les événements restent espacés : jamais en rafale, jamais plus que leur cadence, et chaque thème en joue", async ({ page }) => {
  const erreurs = await ouvrir(page);
  for (const theme of THEMES) {
    const r = await page.evaluate(async (t) => {
      const { module } = (await window.__vitrine!.ambiances())!;
      const a = await module.analyserTheme(t);
      const rendu = await module.rendreAmbianceHorsLigne(t, 100, 0, null, 3);
      return { flux: a.flux, joues: rendu.joues, evenements: rendu.evenements, crete: rendu.crete, nonFinis: rendu.nonFinis };
    }, theme);
    expect(r.nonFinis, theme).toBe(0);
    expect(r.crete, `${theme} : pas de saturation, événements compris`).toBeLessThan(0.98);
    const maxi = r.flux.reduce((s, f) => s + Math.floor(100 / f.ecart[0]) + 1, 0);
    expect(r.joues, `${theme} : au moins un événement en 100 s`).toBeGreaterThanOrEqual(1);
    expect(r.joues, `${theme} : pas plus que la cadence des flux`).toBeLessThanOrEqual(maxi);
    // Chaque flux : l'écart entre deux événements est au moins le plus court de sa cadence (et jamais deux d'un coup).
    for (const f of r.flux) {
      const t = r.evenements.filter((e) => e.startsWith(`${f.nom}@`)).map((e) => Number(e.split("@")[1]));
      for (let i = 1; i < t.length; i++) expect(t[i]! - t[i - 1]!, `${theme} / ${f.nom} : écart (${t.join(", ")})`).toBeGreaterThanOrEqual(f.ecart[0] - 0.2);
    }
  }
  expect(erreurs).toEqual([]);
});

test("au Stade la foule réagit à un point de contrôle et à l'arrivée ; ailleurs rien ne bouge", async ({ page }) => {
  const erreurs = await ouvrir(page);
  const r = await page.evaluate(async () => {
    const { module } = (await window.__vitrine!.ambiances())!;
    const sans = await module.rendreAmbianceHorsLigne("stade", 14, 40, null, 5);
    const avec = await module.rendreAmbianceHorsLigne("stade", 14, 40, null, 5, [
      { t: 4, nom: "checkpoint" },
      { t: 9, nom: "finish" },
    ]);
    const fenetre = (x: Float32Array, a: number, b: number) => {
      let s = 0;
      for (let i = Math.round(a * 22050); i < Math.round(b * 22050); i++) s += x[i]! * x[i]!;
      return Math.sqrt(s / ((b - a) * 22050));
    };
    const autre = await module.rendreAmbianceHorsLigne("rallye", 14, 40, null, 5, [{ t: 4, nom: "checkpoint" }, { t: 9, nom: "finish" }]);
    const rallyeSans = await module.rendreAmbianceHorsLigne("rallye", 14, 40, null, 5);
    return {
      avantPc: fenetre(avec.canaux[0]!, 2, 3.8),
      pc: fenetre(avec.canaux[0]!, 4.1, 5.8),
      sansPc: fenetre(sans.canaux[0]!, 4.1, 5.8),
      avantArrivee: fenetre(avec.canaux[0]!, 7, 8.8),
      arrivee: fenetre(avec.canaux[0]!, 9.1, 12),
      sansArrivee: fenetre(sans.canaux[0]!, 9.1, 12),
      // Le moteur audio natif arrondit un peu différemment d'une fois à l'autre (≈ 1e-8) : « identique » veut dire à 1e-6 près.
      rallyeEcart: autre.canaux[0]!.reduce((m, v, i) => Math.max(m, Math.abs(v - rallyeSans.canaux[0]![i]!)), 0),
    };
  });
  expect(r.pc, "la clameur d'un point de contrôle s'entend").toBeGreaterThan(r.sansPc * 1.4);
  expect(r.arrivee, "l'ovation de l'arrivée s'entend, plus fort encore").toBeGreaterThan(r.sansArrivee * 1.8);
  expect(r.arrivee).toBeGreaterThan(r.pc);
  expect(r.avantPc).toBeLessThan(r.pc);
  expect(r.rallyeEcart, "un thème sans réaction ne change pas").toBeLessThan(1e-6);
  expect(erreurs).toEqual([]);
});

test("la tribune enfle quand on passe devant, les lampadaires battent ; sans décor, rien ne change", async ({ page }) => {
  const erreurs = await ouvrir(page);
  const r = await page.evaluate(async () => {
    const { module } = (await window.__vitrine!.ambiances())!;
    const eff = async (t: "stade" | "nuit", decor: { cote: number; proche: number } | null) => (await module.rendreAmbianceHorsLigne(t, 8, 0, decor, 9)).rms;
    return {
      stadeLoin: await eff("stade", { cote: -0.8, proche: 0 }),
      stadeProche: await eff("stade", { cote: -0.8, proche: 1 }),
      nuitLoin: await eff("nuit", { cote: 0.7, proche: 0 }),
      nuitProche: await eff("nuit", { cote: 0.7, proche: 1 }),
      // Le côté : la tribune à gauche pèse sur le canal gauche.
      cotes: await (async () => {
        const g = await module.rendreAmbianceHorsLigne("stade", 8, 0, { cote: -1, proche: 1 }, 9);
        const rms = (x: Float32Array) => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length);
        return { gauche: rms(g.canaux[0]!), droite: rms(g.canaux[1]!) };
      })(),
    };
  });
  expect(r.stadeProche, "la tribune proche enfle la rumeur").toBeGreaterThan(r.stadeLoin * 1.5);
  expect(r.nuitProche, "le lampadaire proche s'entend").toBeGreaterThan(r.nuitLoin * 1.2);
  expect(r.cotes.gauche, "la tribune de gauche vient de la gauche").toBeGreaterThan(r.cotes.droite * 1.3);
  expect(erreurs).toEqual([]);
});

test("aucun nœud audio ne fuit : au recommencement, au changement de thème, à la bascule du Salon", async ({ page }) => {
  const erreurs = await ouvrir(page);
  for (const theme of THEMES) {
    const f = await page.evaluate(async (t) => (await window.__vitrine!.ambiances())!.module.verifierFuitesAmbiance(t), theme);
    expect(f.crees, `${theme} : des nœuds créés`).toBeGreaterThan(4);
    expect(f.deconnectes, `${theme} : nœuds détachés`).toBeGreaterThanOrEqual(f.crees);
    expect(f.sourcesArretees, `${theme} : sources arrêtées`).toBeGreaterThanOrEqual(f.sourcesDemarrees);
    expect(f.brefsApresArret, `${theme} : plus aucun nœud bref vivant`).toBe(0);
    // Six courses de suite (ou six bascules du Salon) dans le même contexte : le même nombre de nœuds à chaque tour, aucun reste.
    const r = await page.evaluate(async (t) => (await window.__vitrine!.ambiances())!.module.verifierRecommencements(t, 6), theme);
    expect(new Set(r.noeuds).size, `${theme} : même nombre de nœuds à chaque tour (${r.noeuds.join(",")})`).toBe(1);
    expect(r.brefsApresArret.every((n) => n === 0), `${theme} : aucun nœud bref après l'arrêt`).toBe(true);
  }
  expect(erreurs).toEqual([]);
});

test("la planche s'ouvre sans erreur : huit thèmes, deux modes, le coût se remplit, l'écoute démarre", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const erreurs = await ouvrir(page);
  await expect(page.locator(".segments [data-theme]")).toHaveCount(8);
  await expect(page.getByRole("button", { name: "Seule" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sous le moteur" })).toBeVisible();
  // Rien des autres planches n'est montré.
  await expect(page.locator("#sections")).toBeHidden();
  await expect(page.locator("#son")).toBeHidden();
  await page.getByRole("button", { name: "Activer le son" }).click();
  await expect(page.getByRole("button", { name: "Son activé" })).toBeDisabled();
  await page.waitForFunction(async () => (await window.__vitrine!.ambiances())!.planche.etat().actif);
  // Un thème qu'on choisit se fabrique et se joue ; un autre le remplace.
  await page.locator('[data-theme="campagne"]').click();
  await page.waitForFunction(async () => (await window.__vitrine!.ambiances())!.planche.etat().ambiance?.theme === "campagne");
  await page.locator('[data-theme="nuit"]').click();
  await page.waitForFunction(async () => (await window.__vitrine!.ambiances())!.planche.etat().ambiance?.theme === "nuit");
  // Le mode « Sous le moteur » charge la voiture, le moteur joue en plus.
  await page.getByRole("button", { name: "Sous le moteur" }).click();
  await expect(page.getByRole("button", { name: "Course virtuelle" })).toBeVisible();
  await page.waitForFunction(async () => {
    const e = (await window.__vitrine!.ambiances())!.planche.etat();
    return e.mode === "course" && e.ambiance?.theme === "nuit" && e.t > 0.5;
  });
  // Le tableau des coûts : « Fabriquer tous les thèmes » remplit les huit lignes.
  await page.getByRole("button", { name: "Fabriquer tous les thèmes (mesure)" }).click();
  await page.waitForFunction(() => document.querySelectorAll("tr[data-ligne] td:nth-child(3)").length === 8 && [...document.querySelectorAll("tr[data-ligne] td:nth-child(3)")].every((c) => /ms$/.test(c.textContent ?? "")));
  // Un événement, la clameur et l'ovation se déclenchent sans erreur.
  await page.getByRole("button", { name: "Un événement maintenant" }).click();
  await page.getByRole("button", { name: "Point de contrôle" }).click();
  await page.getByRole("button", { name: "Arrivée" }).click();
  expect(erreurs).toEqual([]);
});
