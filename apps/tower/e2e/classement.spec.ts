import { readFileSync } from "node:fs";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

// Lot T4 — LE parcours de joueur nouveau : le classement du jour, avec le VRAI serveur (l'API de la plateforme, Tower monté : `apps/api/scripts/tower-serveur-essai.ts`, lancé par
// `playwright.config.ts` sur le port 8791, base en mémoire, refus des copies actif). Comme `leaderboard.spec.ts` de Track : une partie scriptée envoyée et classée (le pseudo au premier envoi), une
// copie refusée, le fantôme Diamant débloqué une fois classé, et la ligne « hors ligne, non classé » sans serveur. Chromium seulement ; rien dans `@navigateurs`.
// Le jour du serveur est le 06/11/2026, le jour préparé des fixtures (médailles et preuve de l'auteur) : la page prend la même horloge (`Date` décalé) et le même fichier.
test.describe.configure({ mode: "serial" });

const API = "http://127.0.0.1:8791";
const JOUR = "2026-11-06";
const FICHIER = readFileSync(new URL(`../../../packages/tower-sim/test/fixtures/jours/${JOUR}.json`, import.meta.url), "utf8");
const DESCENDRE = 8;

interface Porte {
  manuel(oui?: boolean): void;
  recommencer(): void;
  avancer(n: number, commandes?: number): void;
  fantome(): number;
  etatFantome(): { etat: string; meilleure: boolean; diamant: boolean };
  envoi(): { statut: string; code: string; rang: number | null };
  rediffusion(): string | null;
  vue(): { phase: string };
}
declare global {
  interface Window {
    __tower: Porte;
  }
}

/** Un appareil neuf : l'horloge du serveur, le fichier du jour préparé, l'aide « Comment jouer » déjà vue (elle a son propre test). */
async function appareil(browser: Browser, adresse = `/?api=${API}&tactile=0`, aideVue = true): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ baseURL: "http://localhost:4175", locale: "fr-FR", permissions: ["clipboard-read", "clipboard-write"] });
  const decalage = Date.UTC(2026, 10, 6, 12) - Date.now();
  await context.addInitScript(
    ({ decalage, aideVue }) => {
      const Reel = Date;
      class Decale extends Reel {
        constructor(...args: unknown[]) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          super(...((args.length === 0 ? [Reel.now() + decalage] : args) as [any]));
        }
        static override now() {
          return Reel.now() + decalage;
        }
      }
      (globalThis as { Date: DateConstructor }).Date = Decale as unknown as DateConstructor;
      if (aideVue) localStorage.setItem("tower:aide:vu", "1");
    },
    { decalage, aideVue },
  );
  await context.route(`**/jours/${JOUR}.json`, (r) => r.fulfill({ contentType: "application/json", body: FICHIER }));
  const page = await context.newPage();
  await page.goto(adresse);
  await page.waitForSelector("#accueil-jouer");
  return { context, page };
}

/** JOUER, puis une partie menée au bout, tout droit (les pièces tombent au centre) : toujours la même suite de commandes. */
async function jouerUnePartie(page: Page): Promise<void> {
  await page.locator("#accueil-jouer").click();
  await page.waitForSelector("html[data-ready=true] .tower__scene");
  await page.evaluate(
    ([commande]) => {
      const T = window.__tower;
      T.manuel(true);
      T.recommencer(); // aucun tick de la boucle temps réel n'a été joué : la suite de commandes est toujours la même
      for (let i = 0; i < 40000 && T.vue().phase !== "fini"; i++) T.avancer(1, commande!);
    },
    [DESCENDRE],
  );
  await expect(page.locator("#fin-ecran")).toBeVisible();
}

/** Le premier envoi : le serveur ne connaît pas encore le joueur, le formulaire du pseudo s'ouvre (pseudo propre à l'essai : la base est la même d'un essai à l'autre). */
async function choisirPseudo(page: Page, base: string): Promise<void> {
  const pseudo = `${base}${test.info().retry}`;
  await expect(page.locator("#fin-pseudo")).toBeVisible();
  await page.locator("#fin-pseudo").fill(pseudo);
  await page.locator("#fin-pseudo-ok").click();
}

test("une partie scriptée est envoyée, rejouée par le serveur et classée ; le Diamant se débloque une fois classé", async ({ browser, request }) => {
  const { context, page } = await appareil(browser);
  // L'accueil : personne n'est encore classé, la scène n'est pas chargée (le décor est un aplat du thème), les paliers du jour sont écrits avec leur mot.
  await expect(page.locator("#accueil-classement li")).toHaveCount(0);
  await expect(page.locator(".accueil__message")).toContainText(/Personne n'est encore classé/);
  await expect(page.locator("#accueil-paliers li")).toHaveCount(6);
  await expect(page.locator("#accueil-paliers li").first()).toContainText(/bonus/i);
  await expect(page.locator(".tower__scene")).toHaveCount(0);
  await expect(page.locator("#accueil-decompte")).toHaveText(/^\d{2}:\d{2}:\d{2}$/);
  await expect(page.locator(".accueil__tour")).toContainText(/Tour n° 5 · Banquise/); // PREMIER_JOUR_TOWER provisoire : le 02/11/2026
  expect(await page.evaluate(() => (window as unknown as { __tower?: unknown }).__tower)).toBeUndefined();

  await jouerUnePartie(page);
  // Pas encore classé : le Diamant n'est pas offert, et le serveur le refuse (403).
  expect((await page.evaluate(() => window.__tower.etatFantome())).diamant).toBe(false);
  const inconnu = await request.get(`${API}/api/tower/day/${JOUR}/diamant`, { headers: { "X-Player-Id": "0123456789abcdef0123456789abcdef" } });
  expect(inconnu.status()).toBe(403);
  expect((await inconnu.json()).error).toBe("not_ranked");

  await choisirPseudo(page, "Pistache");
  await expect(page.locator("#fin-rang")).toHaveText(/^1(er|st)$/);
  await expect(page.locator("#fin-rang-statut")).toContainText(/nouveau record/);
  expect(await page.evaluate(() => window.__tower.envoi())).toMatchObject({ statut: "ranked", rang: 1 });
  await expect(page.locator("#fin-posees")).toContainText("/40");
  await expect(page.locator("#fin-paliers")).not.toBeEmpty();

  // Le classement du jour en dialogue : ta ligne en moutarde.
  await page.locator("#fin-voir-classement").click();
  await expect(page.locator("#classement-liste li")).toHaveCount(1);
  await expect(page.locator("#classement-liste .rang--moi")).toBeVisible();
  await page.locator("#classement-fermer").click();

  // Partager : la ligne du seed, dans le presse-papiers.
  await page.locator("#fin-partager").click();
  await expect(page.locator("#fin-partage-message")).not.toBeEmpty();
  const ligne = (await page.evaluate(() => navigator.clipboard.readText())).split("\n")[0]!;
  expect(ligne).toMatch(/^Du Jour · Tower #5 — \d+,\d m( — \S+)? — (❤️|\u{1F5A4}){3}$/u);

  // Le Diamant est débloqué : Rejouer, le fantôme passe de « Ma meilleure » au Diamant (la silhouette vient du serveur).
  await page.locator("#fin-rejouer").click();
  await expect(page.locator("#fin-ecran")).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__tower.etatFantome())).toMatchObject({ etat: "meilleure", meilleure: true, diamant: true });
  await page.locator("#fantome").click();
  await expect.poll(() => page.evaluate(() => window.__tower.etatFantome().etat)).toBe("diamant");
  await expect(page.locator("#fantome")).toHaveAttribute("aria-label", /Diamant/);
  await expect.poll(() => page.evaluate(() => window.__tower.fantome())).toBeGreaterThan(0);
  await page.locator("#fantome").click();
  await expect.poll(() => page.evaluate(() => window.__tower.etatFantome().etat)).toBe("aucun");

  // L'accueil, au rechargement : ton record, ta série, le classement avec ta ligne ; le serveur répond avec la silhouette réservée aux classés.
  await page.reload();
  await page.waitForSelector("#accueil-jouer");
  await expect(page.locator("#accueil-classement .rang--moi")).toBeVisible();
  await expect(page.locator("#accueil-record")).toHaveText(/\d+[,.]\d{3} m/);
  await expect(page.locator("#accueil-serie")).toHaveText(/1 jour|1 day/);
  await context.close();
});

test("une copie est refusée : la même suite de commandes qu'un autre joueur ne se classe pas", async ({ browser }) => {
  const { context, page } = await appareil(browser);
  await jouerUnePartie(page);
  await choisirPseudo(page, "Kiwi");
  await expect(page.locator("#fin-rang-statut")).toContainText(/copie|copy/i);
  expect(await page.evaluate(() => window.__tower.envoi())).toMatchObject({ statut: "refused", code: "replay_copy" });
  await context.close();
});

test("sans serveur : la partie reste jouable et l'arrivée dit « hors ligne, non classé » ; le record est gardé pour être envoyé", async ({ browser }) => {
  const { context, page } = await appareil(browser, "/?api=http://127.0.0.1:9&tactile=0");
  await expect(page.locator(".accueil__message")).toContainText(/hors ligne|offline/i);
  await jouerUnePartie(page);
  await expect(page.locator("#fin-rang-statut")).toContainText(/Hors ligne, non classé/);
  expect((await page.evaluate(() => JSON.parse(localStorage.getItem("tower:records")!))).jours[JOUR].e).toBe(0);
  await expect(page.locator("#fin-rejouer")).toBeVisible();
  await context.close();
});

test("« Comment jouer » s'ouvre au premier lancement, une seule fois, puis à la demande", async ({ browser }) => {
  const { context, page } = await appareil(browser, `/?api=${API}&tactile=0`, false);
  await expect(page.locator("#aide-ecran")).toBeVisible();
  await expect(page.locator(".aide__points li")).toHaveCount(3);
  await expect(page.locator("#aide-ok")).toBeFocused();
  await page.locator("#aide-ok").click();
  await expect(page.locator("#aide-ecran")).toBeHidden();
  await page.reload();
  await page.waitForSelector("#accueil-jouer");
  await expect(page.locator("#aide-ecran")).toHaveCount(0);
  await page.locator("#accueil-aide").click();
  await expect(page.locator("#aide-ecran")).toBeVisible();
  await context.close();
});
