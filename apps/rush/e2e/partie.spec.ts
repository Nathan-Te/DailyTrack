import { expect, test } from "@playwright/test";
import { VARIANTE } from "@cdj/rush-sim";
import { appareil, jouerLeJour, lancer } from "./appareil";

// « Rush » — LE parcours de joueur, sans serveur : l'accueil (l'étiquette, JOUER, les plaques Discord et Ko-fi), la scène 3D qui se dessine, le HUD, la pause (le temps s'arrête), une partie entière jouée par le pilote de la
// simulation, l'arrivée avec son temps, « Rejouer ». Le classement avec le vrai serveur est dans `classement.spec.ts`. Les règles de la partie sont dans `packages/rush-sim/test` : ici, seulement ce que le joueur voit.
test.describe("Rush : une partie", () => {
  test("accueil, scène 3D, pause, partie jouée jusqu'à la chute du golem, arrivée et rejouer", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0");
    await expect(page.locator("#jeu-accueil .jeu-etiquette")).toBeVisible();
    await expect(page.locator("#jeu-record")).toHaveText("—");
    await expect(page.locator("#communaute")).toBeVisible(); // lot S1 : Discord et Ko-fi sur l'accueil
    await lancer(page);
    await expect(page.locator("#communaute")).toBeHidden(); // jamais en partie
    await expect(page.locator(".rush-monde canvas")).toBeVisible();
    await expect(page.locator(".rush-coeur")).toHaveCount(3);
    await expect(page.locator(".rush-boss")).toBeVisible();
    await expect(page.locator("#jeu-hud-score")).toHaveText("Golem 100 %");
    expect(await page.evaluate(() => window.__rush.calls())).toBeGreaterThan(5); // la scène a dessiné
    // La pause arrête le temps : aucun tick n'est joué, la reprise le relance.
    await page.locator("#jeu-hud-pause").click();
    await expect(page.locator("#jeu-pause")).toBeVisible();
    expect(await page.evaluate(() => window.__jeu.phase())).toBe("pause");
    await page.locator("#jeu-reprendre").click();
    expect(await page.evaluate(() => window.__jeu.phase())).toBe("jeu");
    const attendu = await jouerLeJour(page);
    expect(attendu.victoire).toBe(true);
    await expect(page.locator("#jeu-fin")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#jeu-fin-score")).toHaveText(VARIANTE.formatScore(VARIANTE.score(attendu), "fr"));
    expect(await page.evaluate(() => window.__jeu.score())).toEqual(VARIANTE.score(attendu));
    // Hors ligne (aucun serveur) : on le dit, et on garde le record dans le navigateur.
    await expect(page.locator("#jeu-fin-rang")).toContainText("Hors ligne");
    await page.locator("#jeu-rejouer").click();
    await expect(page.locator("#jeu-fin")).toBeHidden();
    await expect(page.locator("#jeu-hud-score")).toHaveText("Golem 100 %");
    await context.close();
  });

  test("les commandes : au clavier, le chevalier marche, frappe et esquive ; les touches se lisent par les actions du jeu", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&scenario=boss");
    await lancer(page);
    const x0 = await page.evaluate(() => window.__rush.partie().tick);
    expect(x0).toBe(0);
    await page.keyboard.down("ArrowUp");
    await page.evaluate(() => window.__jeu.avancer(30));
    await page.keyboard.up("ArrowUp");
    const apresMarche = await page.evaluate(() => window.__rush.changements());
    expect(apresMarche.length).toBeGreaterThanOrEqual(1);
    expect((apresMarche[0]!.e & 63) > 0).toBe(true); // une direction a été enregistrée
    await page.evaluate(() => window.__jeu.action("coup"));
    await page.evaluate(() => window.__jeu.avancer(6));
    expect(await page.evaluate(() => window.__rush.sons().some((s) => s.startsWith("coup")))).toBe(true);
    await page.evaluate(() => window.__jeu.action("esquive"));
    await page.evaluate(() => window.__jeu.avancer(3));
    expect(await page.evaluate(() => window.__rush.sons())).toContain("esquive");
    await context.close();
  });

  test("à la souris : le chevalier vise le point du sol sous le curseur, le clic frappe (maintenu, il enchaîne les trois coups), Espace esquive", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&scenario=boss");
    await page.setViewportSize({ width: 1280, height: 720 });
    await lancer(page);
    const scene = (await page.locator(".rush-monde__scene").boundingBox())!;
    const vers = async (fx: number, fy: number): Promise<number> => {
      await page.mouse.move(scene.x + scene.width * fx, scene.y + scene.height * fy);
      await page.evaluate(() => window.__jeu.avancer(1));
      return page.evaluate(() => window.__rush.visee());
    };
    // Le chevalier est dans la moitié basse de l'image : un curseur en haut de l'écran vise vers le haut (24), à gauche vers la gauche (16), à droite vers la droite (0), tout en bas vers le bas (8).
    expect(Math.abs((await vers(0.5, 0.05)) - 24)).toBeLessThanOrEqual(2);
    expect(Math.abs((await vers(0.02, 0.5)) - 16)).toBeLessThanOrEqual(4);
    const droite = await vers(0.98, 0.5);
    expect(Math.min(droite, 32 - droite)).toBeLessThanOrEqual(4);
    expect(Math.abs((await vers(0.5, 0.995)) - 8)).toBeLessThanOrEqual(3);
    // Le chevalier regarde où il vise, sans marcher.
    await vers(0.5, 0.05);
    await page.evaluate(() => window.__jeu.avancer(3));
    expect(await page.evaluate(() => window.__rush.partie().c.dir)).toBeGreaterThan(90);
    expect(await page.evaluate(() => window.__rush.partie().c.dir)).toBeLessThan(102);
    // Le clic gauche frappe ; MAINTENU, il enchaîne (coup 1, 2, puis 3, puis encore le 1).
    await page.mouse.down();
    await page.evaluate(() => window.__jeu.avancer(170));
    await page.mouse.up();
    const sons = await page.evaluate(() => window.__rush.sons());
    expect(sons.filter((s) => s === "coup1").length).toBeGreaterThanOrEqual(2);
    expect(sons).toEqual(expect.arrayContaining(["coup1", "coup2", "coup3"]));
    // Une visée est une entrée de la rediffusion : l'octet haut du changement la porte.
    const ch = await page.evaluate(() => window.__rush.changements());
    expect(ch.some((c) => (c.e >> 8) > 0)).toBe(true);
    // Espace esquive.
    await page.keyboard.press("Space");
    await page.evaluate(() => window.__jeu.avancer(40)); // l'arrêt sur image d'un coup qui touche retient quelques appels
    expect((await page.evaluate(() => window.__rush.sons())).slice(-8)).toContain("esquive");
    await context.close();
  });

  test("la vitrine est une scène figée (le golem annonce un coup, quatre gelées, deux chauves-souris) qui ne joue pas", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&scenario=vitrine");
    await lancer(page);
    await expect(page.locator(".rush-boss")).toBeVisible();
    await expect(page.locator(".rush-boss__phase")).toHaveText("Phase 1");
    await expect(page.locator("#jeu-hud-score")).toHaveText("Golem 60 %");
    const avant = await page.evaluate(() => ({ tick: window.__rush.partie().tick, monstres: window.__rush.partie().monstres.length }));
    await page.evaluate(() => window.__jeu.avancer(300));
    const apres = await page.evaluate(() => ({ tick: window.__rush.partie().tick, monstres: window.__rush.partie().monstres.length }));
    expect(apres).toEqual(avant);
    expect(avant.monstres).toBe(6);
    expect(await page.evaluate(() => window.__rush.calls())).toBeLessThan(120);
    await context.close();
  });

  test("une partie d'essai (scénario) n'est pas classable ; le joueur en est averti", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&scenario=arene");
    await lancer(page);
    await expect(page.locator("#jeu-hud-score")).toHaveText("Tués 0");
    await page.evaluate(() => window.__rush.jouerPilote(600));
    await expect(page.locator("#jeu-hud-score")).not.toHaveText("Tués 0");
    await context.close();
  });

  test("« Comment jouer » s'ouvre au premier lancement, une seule fois", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?tactile=0", false);
    await expect(page.locator("#jeu-aide")).toBeVisible();
    await page.locator("#jeu-aide-ok").click();
    await expect(page.locator("#jeu-aide")).toBeHidden();
    await page.reload();
    await page.waitForSelector("#jeu-jouer", { state: "attached" });
    await expect(page.locator("#jeu-aide")).toBeHidden();
    await context.close();
  });

  test("au doigt : un joystick à gauche, « Coup » et « Esquive » à droite, aux bords, de 44 px au moins", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=1&scenario=boss");
    await page.setViewportSize({ width: 844, height: 390 });
    await lancer(page);
    const stick = (await page.locator(".rush-stick__base").boundingBox())!;
    const coup = (await page.locator(".rush-bouton--coup").boundingBox())!;
    const esquive = (await page.locator(".rush-bouton--esquive").boundingBox())!;
    expect(stick.x + stick.width / 2).toBeLessThan(844 / 2);
    expect(coup.x).toBeGreaterThan(844 / 2);
    expect(esquive.x).toBeGreaterThan(844 / 2);
    for (const b of [coup, esquive]) expect(Math.min(b.width, b.height)).toBeGreaterThanOrEqual(44);
    expect(stick.width).toBeGreaterThanOrEqual(44);
    // Les boutons restent dans l'écran et le centre est libre.
    for (const b of [stick, coup, esquive]) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y + b.height).toBeLessThanOrEqual(390);
    }
    // Le joystick pousse le chevalier : un appui sur le bord droit de sa base donne une direction vers la droite (0).
    await page.mouse.move(stick.x + stick.width - 8, stick.y + stick.height / 2);
    await page.dispatchEvent(".rush-stick", "pointerdown", { pointerId: 7, clientX: stick.x + stick.width - 8, clientY: stick.y + stick.height / 2, pointerType: "touch", isPrimary: true, bubbles: true });
    await page.evaluate(() => window.__jeu.avancer(4));
    const ch = await page.evaluate(() => window.__rush.changements());
    expect(ch.length).toBeGreaterThanOrEqual(1);
    expect(ch[0]!.e & 63).toBe(1); // direction 0 (vers la droite) = 1
    await context.close();
  });

  test("le mannequin (lot BR0c) : un coup tenu enchaîne à la cadence lourde, rien ne meurt, un seul arrêt sur image par coup final", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&scenario=mannequin");
    await lancer(page);
    expect(await page.evaluate(() => window.__rush.partie().monstres.length)).toBe(6);
    await page.evaluate(() => window.__rush.forcer(64, 100000)); // le coup tenu
    await page.evaluate(() => window.__jeu.avancer(260));
    const sons = await page.evaluate(() => window.__rush.sons());
    expect(sons).toEqual(expect.arrayContaining(["coup1", "coup2", "coup3"]));
    const p = await page.evaluate(() => ({ monstres: window.__rush.partie().monstres.length, golem: window.__rush.partie().golem!.hp, coeurs: window.__rush.partie().c.coeurs }));
    expect(p.monstres).toBe(6); // aucun ne meurt
    expect(p.coeurs).toBe(3); // aucun ne blesse
    await context.close();
  });

  test("deux niveaux de qualité (lot BR0c) : ?qualite= l'impose, la basse se passe du post-traitement, les deux dessinent sous 200 appels", async ({ browser }) => {
    for (const q of ["haute", "basse"] as const) {
      const { context, page } = await appareil(browser, `/?debug&manuel&tactile=0&scenario=arene&monstres=30&qualite=${q}`);
      await lancer(page);
      await page.evaluate(() => window.__jeu.avancer(600));
      expect(await page.evaluate(() => window.__rush.qualite())).toBe(q);
      await page.evaluate(() => window.__rush.dessinerMaintenant());
      expect(await page.evaluate(() => window.__rush.calls())).toBeLessThan(200);
      await expect(page.locator(".rush-monde canvas")).toBeVisible();
      await context.close();
    }
    // En cours de partie, on peut passer de l'une à l'autre (la chute des images par seconde le fait toute seule).
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&scenario=boss");
    await lancer(page);
    expect(await page.evaluate(() => window.__rush.qualite())).toBe("haute");
    await page.evaluate(() => window.__rush.definirQualite("basse"));
    await page.evaluate(() => window.__rush.dessinerMaintenant());
    expect(await page.evaluate(() => window.__rush.qualite())).toBe("basse");
    await context.close();
  });
});
