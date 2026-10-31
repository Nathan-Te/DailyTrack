import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { startSite } from "./domaine-serveurs";
import { expect as baseExpect, hasWebGL, newClockedContext, test, type Page } from "./fixtures";
import { auditAxe } from "./axe";

// Lot M1 (plateforme) : les menus à la manette. UN SEUL test dans le navigateur (règle R13), avec une manette simulée (`navigator.getGamepads` remplacé) :
// le portail (un bouton de la manette → la bande d'aide et le focus sur « Jouer » de Track), la croix jusqu'à Jump, A (on arrive dans Jump), puis dans Jump Start
// (la pause, le focus sur « Reprendre »), A sur « Reprendre » — **sans faire sauter le personnage** (un appui ne sert jamais deux fois : le A qui ferme la pause
// reste levé pour le jeu jusqu'à son relâchement) — puis un nouvel appui qui, lui, fait sauter. Le reste (navigation spatiale, répétition, zone morte, lettres) est
// testé en unitaire (packages/ui/test/manette.test.ts). Ports 4199 et 8819 réservés (le site assemblé, comme domaine.spec.ts).
test.setTimeout(120_000);
const expect = baseExpect.configure({ timeout: 30_000 });

const ROOT = resolve("../..");
const PORT = 4199;
const SITE = `http://localhost:${PORT}`;
let tmp = "";
let serveur: Server | null = null;

test.beforeAll(async () => {
  test.setTimeout(240_000);
  for (const app of ["web", "jump"]) if (!existsSync(join(ROOT, "apps", app, "dist", "index.html"))) throw new Error(`apps/${app} n'est pas construit : npm run build`);
  tmp = mkdtempSync(join(tmpdir(), "manette-"));
  execFileSync("node", ["scripts/site.mjs", "site", "--sortie", join(tmp, "site"), "--origine", SITE], { cwd: ROOT, stdio: "inherit" });
  serveur = await startSite(join(tmp, "site"), PORT, 8819); // le serveur de la plateforme n'est pas lancé : aucune requête n'en dépend ici
});

test.afterAll(async () => {
  serveur?.closeAllConnections(); // les connexions gardées ouvertes par le navigateur retarderaient `close`
  if (serveur) await new Promise((r) => serveur!.close(r));
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

const BOUTON = { A: 0, B: 1, START: 9, DROITE: 15, BAS: 13 } as const;

/** Une manette « standard » dont l'état est celui de `window.__pad` (remis à zéro à chaque page). */
async function brancherManette(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __pad?: { buttons: { pressed: boolean; touched: boolean; value: number }[]; axes: number[] } };
    w.__pad = { buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })), axes: [0, 0, 0, 0] };
    const pad = {
      id: "Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)",
      index: 0,
      connected: true,
      mapping: "standard",
      timestamp: 0,
      get axes() {
        return w.__pad!.axes;
      },
      get buttons() {
        return w.__pad!.buttons;
      },
    };
    navigator.getGamepads = () => [pad as unknown as Gamepad];
    dispatchEvent(new Event("gamepadconnected")); // le navigateur l'envoie au premier bouton : c'est lui qui charge le module des menus
  });
}

const imagesAttendre = (page: Page, n = 4) =>
  page.evaluate(
    (k) =>
      new Promise<void>((ok) => {
        let i = 0;
        const f = () => (++i >= k ? ok() : requestAnimationFrame(f));
        requestAnimationFrame(f);
      }),
    n,
  );

/** Tient un bouton enfoncé le temps de `pendant`, puis le relâche (la manette ne prévient pas : la page la lit à chaque image). */
async function appuyer(page: Page, bouton: number, pendant: () => Promise<void>): Promise<void> {
  const poser = (pressed: boolean) =>
    page.evaluate(([i, p]) => {
      // Une page qui vient de changer (A sur Jump ouvre Jump) n'a plus la manette simulée : rien à relâcher.
      const b = (window as unknown as { __pad?: { buttons: { pressed: boolean; value: number }[] } }).__pad?.buttons[i as number];
      if (!b) return;
      b.pressed = p as boolean;
      b.value = p ? 1 : 0;
    }, [bouton, pressed]);
  await poser(true);
  try {
    await pendant();
  } finally {
    await poser(false);
    // La manette ne prévient pas : le relâchement n'existe pour la page que lorsqu'elle a lu une image sans le bouton (sinon, deux appuis de suite n'en feraient qu'un).
    await imagesAttendre(page, 3).catch(() => undefined); // (la page a pu changer : A sur Jump ouvre Jump)
  }
}

test("portail : un bouton, la bande et Jouer ; la croix, A sur Jump ; dans Jump Start, A sur « Reprendre » sans faire sauter", async ({ browser }) => {
  const page = await (await newClockedContext(browser, { locale: "fr-FR", viewport: { width: 844, height: 390 } })).newPage();
  await page.goto(`${SITE}/`);
  await expect(page.locator("#jeux .dj-cartouche[data-jeu]")).toHaveCount(2);
  await expect(page.locator(".dj-manette-aide")).toHaveCount(0); // sans manette : rien n'est chargé

  // 1. Un bouton de la manette : la bande d'aide, et le focus sur « Jouer » de Track.
  await brancherManette(page);
  await expect(page.locator("html")).toHaveAttribute("data-entree", "manette");
  await expect(page.locator(".dj-manette-aide")).toBeVisible();
  await expect(page.locator(".dj-manette-aide")).toContainText("Valider");
  await expect(page.locator(".dj-manette-aide")).toContainText("Retour");
  await expect(page.locator('[data-jeu="track"] a.dj-bouton')).toBeFocused();
  await auditAxe(page, "portail-manette"); // la bande d'aide ne casse aucune règle d'accessibilité

  // 2. La croix vers Jump (à côté, ou dessous selon la mise en page), puis A.
  for (const direction of [BOUTON.DROITE, BOUTON.BAS]) {
    if (await page.locator('[data-jeu="jump"] a.dj-bouton').evaluate((e) => e === document.activeElement)) break;
    await appuyer(page, direction, () => imagesAttendre(page, 3));
    await imagesAttendre(page);
  }
  await expect(page.locator('[data-jeu="jump"] a.dj-bouton')).toBeFocused();
  await appuyer(page, BOUTON.A, async () => {
    await page.waitForURL(`${SITE}/jump/`);
  });

  // 3. Dans Jump : Start ouvre la pause (focus sur « Reprendre »), A reprend sans faire sauter le personnage.
  await page.goto(`${SITE}/jump/?scenario=essai&accueil=0&debug`);
  test.skip(!(await hasWebGL(page)), "ce navigateur n'a pas WebGL : Jump ne démarre pas (portail testé ci-dessus)");
  await page.waitForFunction(() => (window as unknown as { __jump?: { phase: string } }).__jump?.phase === "ready");
  await brancherManette(page);
  await expect(page.locator(".dj-manette-aide")).toBeHidden(); // jamais pendant une partie

  await appuyer(page, BOUTON.START, () => expect(page.locator("#menu-resume")).toBeVisible());
  await expect(page.locator("#menu-resume")).toBeFocused();
  await expect(page.locator(".dj-manette-aide")).toBeVisible();

  // A reprend. On le garde enfoncé encore quelques images : le jeu ne doit pas le lire comme un saut.
  await appuyer(page, BOUTON.A, async () => {
    await expect(page.locator("#menu-resume")).toBeHidden();
    await imagesAttendre(page, 12);
    const phase = await page.evaluate(() => (window as unknown as { __jump: { phase: string } }).__jump.phase);
    expect(phase, "le A qui ferme la pause ne doit pas faire sauter le personnage").toBe("ready");
  });
  await expect(page.locator(".dj-manette-aide")).toBeHidden();

  // Relâché, le prochain appui compte : le personnage saute.
  await appuyer(page, BOUTON.A, async () => {
    await page.waitForFunction(() => (window as unknown as { __jump: { phase: string } }).__jump.phase === "playing");
  });
});
