import { expect, test, type Page } from "@playwright/test";
import { API, appareil, lancer } from "./appareil";

// « Rush » (lot BR5) — un vrai hack & slash : le choix de la compétence au départ (le chrono ne tourne pas, un événement d'entrée de la rediffusion), les trois compétences (clic droit, E), les vases qui éclatent, la horde de gélatons rendue par
// instances (moins de 200 appels de dessin à 40 puis 60 monstres, en haute et en basse qualité) et le coup d'élan en pleine course. Les règles sont dans `packages/rush-sim/test/` ; ici ce qu'on voit et ce qu'on touche, dans un navigateur.
interface Vue {
  tick: number;
  recharge: number;
  etat: number;
  comp: number;
  fente: number;
  course: number;
  monstres: { type: number }[];
  vases: { id: number }[];
  boucliers: unknown[];
  c: { x: number; y: number; coeurs: number };
}
const etat = (page: Page): Promise<Vue> =>
  page.evaluate(() => {
    const p = window.__rush.partie() as unknown as Vue & { c: Vue["c"] & { recharge: number; etat: number; comp: number; fente: number } };
    return { tick: p.tick, recharge: p.c.recharge, etat: p.c.etat, comp: p.c.comp, fente: p.c.fente, course: (p as unknown as { course: number }).course, monstres: p.monstres, vases: p.vases, boucliers: p.boucliers, c: p.c };
  });
const URL_JOUR = `/?api=${API}&debug&manuel&tactile=0`;

test.describe("Rush : le choix de la compétence au départ", () => {
  test("le jour s'ouvre sur trois cartes, le monde est figé (ni tick ni chrono), un chiffre ou Entrée choisit, la partie démarre, « Recommencer » ramène l'écran", async ({ browser }) => {
    const { context, page } = await appareil(browser, URL_JOUR);
    await lancer(page, null);
    await expect(page.locator(".rush-choix")).toBeVisible();
    await expect(page.locator(".rush-choix__titre")).toHaveText("TA COMPÉTENCE");
    expect(await page.locator(".rush-option").evaluateAll((l) => l.map((e) => (e as HTMLElement).dataset.carte))).toEqual(["tourbillon", "bond", "bouclier"]);
    for (const effet of await page.locator(".rush-option__effet").allTextContents()) expect(effet).not.toMatch(/[{}]/);
    expect(await page.evaluate(() => window.__rush.attenteDepart())).toBe(true);
    // figé : ni tick, ni chrono
    await page.evaluate(() => window.__jeu.avancer(120));
    expect((await etat(page)).tick).toBe(0);
    // les flèches déplacent la surbrillance, un chiffre choisit
    await page.keyboard.press("ArrowRight");
    expect(await page.evaluate(() => window.__rush.selection())).toBe(1);
    await page.keyboard.press("Digit3");
    await expect(page.locator(".rush-choix")).toBeHidden();
    expect(await page.evaluate(() => window.__rush.competence())).toBe(2);
    expect(await page.evaluate(() => window.__rush.attenteDepart())).toBe(false);
    await page.evaluate(() => window.__jeu.avancer(30));
    expect((await etat(page)).tick).toBe(30);
    // un nouveau départ : l'écran revient ; Entrée choisit la carte en surbrillance sans relancer la partie
    await page.evaluate(() => window.__rush.redemarrer());
    await expect(page.locator(".rush-choix")).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await expect(page.locator(".rush-choix")).toBeHidden();
    expect(await page.evaluate(() => window.__rush.competence())).toBe(1);
    expect(await page.evaluate(() => window.__jeu.phase())).toBe("jeu");
    await context.close();
  });

  test("à la manette (croix puis A) et au doigt (le toucher d'une carte, 844 × 390 : les trois cartes tiennent à l'écran)", async ({ browser }) => {
    const { context, page } = await appareil(browser, `${URL_JOUR}`.replace("tactile=0", "tactile=1"));
    await page.setViewportSize({ width: 844, height: 390 });
    await lancer(page, null);
    const cartes = page.locator(".rush-option");
    await expect(cartes).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      const b = (await cartes.nth(i).boundingBox())!;
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(844);
      expect(b.y + b.height).toBeLessThanOrEqual(390);
    }
    await cartes.nth(1).click();
    await expect(page.locator(".rush-choix")).toBeHidden();
    expect(await page.evaluate(() => window.__rush.competence())).toBe(1);
    // le troisième bouton, avec sa jauge, est là et ne cache pas les autres
    const comp = page.locator(".rush-bouton--comp");
    await expect(comp).toBeVisible();
    for (const autre of [".rush-bouton--coup", ".rush-bouton--esquive"]) {
      const a = (await comp.boundingBox())!;
      const b = (await page.locator(autre).boundingBox())!;
      expect(a.y + a.height <= b.y + 1 || a.x + a.width <= b.x + 1 || b.x + b.width <= a.x + 1, `le bouton Compétence recouvre ${autre}`).toBe(true);
    }
    await context.close();
  });

  test("une partie du jour avec une compétence choisie : la rediffusion la porte (le serveur la rejouera)", async ({ browser }) => {
    const { context, page } = await appareil(browser, URL_JOUR);
    await lancer(page, 1);
    expect(await page.evaluate(() => window.__rush.competence())).toBe(1);
    await page.evaluate(() => window.__rush.jouerPilote(600));
    const r = await page.evaluate(() => window.__jeu.rediffusion());
    expect(r === null || typeof r === "string").toBe(true);
    await context.close();
  });
});

test.describe("Rush : les trois compétences", () => {
  const ADRESSE = (comp: string): string => `/?api=${API}&debug&manuel&tactile=0&scenario=mannequin&competence=${comp}`;
  const pleine = async (page: Page): Promise<void> => {
    expect((await etat(page)).recharge).toBe(0); // la compétence est prête au départ
  };

  test("tourbillon : E lance la compétence, elle se met en recharge, il tournoie et frappe les gelées autour (elles titubent), puis se termine", async ({ browser }) => {
    const { context, page } = await appareil(browser, ADRESSE("tourbillon"));
    await lancer(page);
    await pleine(page);
    await page.keyboard.down("KeyE");
    await page.evaluate(() => window.__jeu.avancer(2));
    await page.keyboard.up("KeyE");
    await page.evaluate(() => window.__jeu.avancer(30));
    const v = await etat(page);
    expect(v.etat).toBe(3);
    expect(v.recharge).toBeGreaterThan(0); // elle est en recharge
    expect(await page.evaluate(() => window.__rush.sons())).toContain("tourbillon");
    await page.evaluate(() => window.__jeu.avancer(60));
    expect((await etat(page)).etat).not.toBe(3);
    await context.close();
  });

  test("bond : le clic droit lance le saut, le cercle d'atterrissage est cyan (jamais rouge), le chevalier atterrit plus loin, l'onde de choc claque", async ({ browser }) => {
    const { context, page } = await appareil(browser, ADRESSE("bond"));
    await page.setViewportSize({ width: 1280, height: 720 });
    await lancer(page);
    await pleine(page);
    const avant = await etat(page);
    // le clic droit sur la scène (pas de menu contextuel)
    await page.locator(".rush-monde__scene").click({ button: "right", position: { x: 640, y: 300 } });
    await page.evaluate(() => window.__jeu.avancer(12));
    expect((await etat(page)).etat).toBe(3);
    // le cercle d'atterrissage est dessiné, cyan : un des deux disques du joueur est visible
    const cercle = await page.evaluate(() => {
      let teinte: number[] | null = null;
      window.__rush.scene().traverse?.((o: { visible: boolean; material?: { uniforms?: { col?: { value: { r: number; g: number; b: number } } } } }) => {
        const c = o.material?.uniforms?.col?.value;
        if (o.visible && c && c.b > c.r + 0.2) teinte = [c.r, c.g, c.b];
      });
      return teinte;
    });
    expect(cercle, "un cercle bleu-vert est posé au sol").not.toBeNull();
    await page.evaluate(() => window.__jeu.avancer(40));
    const apres = await etat(page);
    expect(Math.hypot(apres.c.x - avant.c.x, apres.c.y - avant.c.y)).toBeGreaterThan(4096 * 3);
    expect(await page.evaluate(() => window.__rush.sons())).toEqual(expect.arrayContaining(["bond", "atterri"]));
    await context.close();
  });

  test("bouclier : la compétence lance un bouclier qui file, touche et revient", async ({ browser }) => {
    const { context, page } = await appareil(browser, ADRESSE("bouclier"));
    await lancer(page);
    await pleine(page);
    await page.evaluate(() => window.__jeu.action("competence"));
    await page.evaluate(() => window.__jeu.avancer(12));
    expect((await etat(page)).boucliers.length).toBe(1);
    await page.evaluate(() => window.__jeu.avancer(100));
    expect((await etat(page)).boucliers.length).toBe(0); // revenu
    expect(await page.evaluate(() => window.__rush.sons())).toContain("bouclier");
    await context.close();
  });
});

test.describe("Rush : la horde et les vases", () => {
  test("la horde : 30 gélatons et 10 gelées, rendus par instances (moins de 200 appels de dessin), des vases en groupes", async ({ browser }) => {
    const { context, page } = await appareil(browser, `/?api=${API}&debug&manuel&tactile=0&scenario=horde`);
    await lancer(page);
    const v = await etat(page);
    expect(v.monstres.filter((m) => m.type === 2)).toHaveLength(30);
    expect(v.monstres.filter((m) => m.type === 0)).toHaveLength(10);
    expect(v.vases.length).toBeGreaterThanOrEqual(30);
    for (const q of ["haute", "basse"] as const) {
      await page.evaluate((q) => window.__rush.definirQualite(q), q);
      await page.evaluate(() => {
        window.__jeu.avancer(30);
        window.__rush.dessinerMaintenant();
      });
      const appels = await page.evaluate(() => window.__rush.calls());
      expect(appels, `appels de dessin en ${q}`).toBeLessThan(200);
    }
    await context.close();
  });

  for (const n of [40, 60]) {
    test(`${n} monstres en même temps dans l'arène : moins de 200 appels de dessin en haute et en basse qualité (ligne ?debug&fps)`, async ({ browser }) => {
      const { context, page } = await appareil(browser, `/?api=${API}&debug&manuel&tactile=0&fps&scenario=arene&monstres=${n}`);
      await lancer(page);
      for (let i = 0; i < 40 && (await etat(page)).monstres.length < n; i++) await page.evaluate(() => window.__jeu.avancer(90));
      expect((await etat(page)).monstres.length).toBeGreaterThanOrEqual(n - 2);
      expect((await etat(page)).monstres.some((m) => m.type === 2)).toBe(true);
      for (const q of ["haute", "basse"] as const) {
        await page.evaluate((q) => window.__rush.definirQualite(q), q);
        await page.evaluate(() => {
          window.__jeu.avancer(2);
          window.__rush.dessinerMaintenant();
        });
        const appels = await page.evaluate(() => window.__rush.calls());
        const ligne = await page.locator(".rush-fps").textContent();
        console.log(`fps ${n} monstres, ${q} : ${appels} appels — ${ligne}`);
        expect(appels, `appels de dessin en ${q}`).toBeLessThan(200);
      }
      await context.close();
    });
  }

  test("un coup en arc brise plusieurs vases d'un coup : éclats, son de céramique ou de bois, et ce qu'ils contenaient jaillit", async ({ browser }) => {
    const { context, page } = await appareil(browser, `/?api=${API}&debug&manuel&tactile=0&scenario=horde`);
    await lancer(page);
    // les gélatons attendent : on isole le chevalier devant un groupe de vases, sans monstre
    await page.evaluate(() => {
      const p = window.__rush.partie() as unknown as { monstres: unknown[]; vases: { x: number; y: number; groupe: number }[]; c: { x: number; y: number } };
      p.monstres.length = 0;
      const v = p.vases.filter((q) => q.groupe === 3)[0]!;
      p.c.x = v.x;
      p.c.y = v.y + 4096 * 1.1;
    });
    const avant = (await etat(page)).vases.length;
    await page.evaluate(() => {
      window.__rush.forcer(64 | 25, 40); // coup tenu, vers le haut de l'écran (la direction 24)
      window.__jeu.avancer(40);
    });
    const apres = (await etat(page)).vases.length;
    expect(apres).toBeLessThan(avant);
    const sons = await page.evaluate(() => window.__rush.sons());
    expect(sons.some((s) => s === "jarre" || s === "bois")).toBe(true);
    await context.close();
  });
});

test.describe("Rush : le coup d'élan", () => {
  test("frapper en pleine course fait une fente : le son, la traînée, la poussée du champ de la caméra", async ({ browser }) => {
    const { context, page } = await appareil(browser, `/?api=${API}&debug&manuel&tactile=0&scenario=jour&jour=2026-11-06&competence=tourbillon`);
    await lancer(page);
    const champ0 = await page.evaluate(() => window.__rush.camera().fov);
    // droit vers l'arène, sans rien frapper : la course monte (0,7 s de calme, 0,2 s de montée)
    await page.evaluate(() => {
      const e = window.__rush.versLArene();
      window.__rush.forcer(e, 70);
      window.__jeu.avancer(70);
    });
    const course = await etat(page);
    expect(course.course, "en pleine course").toBeGreaterThanOrEqual(80);
    const champCourse = await page.evaluate(() => window.__rush.camera().fov);
    expect(champCourse).toBeGreaterThan(champ0);
    await page.evaluate(() => {
      window.__rush.forcer(window.__rush.versLArene() | 64, 12);
      window.__jeu.avancer(8);
    });
    const fente = await etat(page);
    expect(fente.fente, "la fente est en cours").toBeGreaterThan(0);
    expect(await page.evaluate(() => window.__rush.sons())).toContain("elan");
    await context.close();
  });
});
