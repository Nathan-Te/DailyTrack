import { expect, test } from "@playwright/test";
import { ESSAIS_BLOCKS } from "../../api/scripts/blocks-essais";
import { BLOCKS_GENERATOR_VERSION, BLOCKS_SIM_VERSION } from "@cdj/blocks-sim";
import { parseDay } from "@cdj/core";
import { appareil, JOUR, jouerLeJour, lancer } from "./appareil";

// « Blocks » en `preview` (lot B4), sur le serveur d'essai d'APERÇU (port 8800 : le jeu y est en `preview`, ouvert par la clé d'aperçu) : jouable par son lien, absent de l'accueil, fermé sans la clé. Le passage à `preview`
// reste l'acte de Nathan (`/admin/` › Jeux) ; ce test ne fait que vérifier qu'à cet état le jeu se comporte comme la règle de publication le veut (`docs/regles/racine/publication-des-jeux.md`).
const APERCU = "http://127.0.0.1:8800";
const CLE = "cle-apercu-blocks-essai-0123456789";
const entete = { "X-Preview-Key": CLE };

test("côté serveur : fermé sans clé (ou avec une mauvaise, ou une clé dans l'adresse), ouvert avec la bonne clé en en-tête ; absent de l'accueil même pour qui a la clé", async () => {
  const get = (chemin: string, h: Record<string, string> = {}) => fetch(`${APERCU}${chemin}`, { headers: h });
  const sans = await get("/api/blocks/info");
  expect(sans.status).toBe(404);
  expect((await sans.json()).error).toBe("game_unavailable");
  expect((await get("/api/blocks/info", { "X-Preview-Key": "x".repeat(32) })).status).toBe(404);
  expect((await get(`/api/blocks/info?apercu=${CLE}&key=${CLE}`)).status).toBe(404); // la clé ne passe jamais par l'adresse
  expect((await get("/api/blocks/info", entete)).status).toBe(200);
  expect((await (await get("/api/jeux")).json()).jeux.blocks).toBe("preview");
  for (const h of [{}, entete]) {
    const accueil = (await (await get("/api/portail/jour", h)).json()).jeux as { jeu: string }[];
    expect(accueil.map((j) => j.jeu), "Blocks n'est pas à l'accueil").not.toContain("blocks");
  }
});

test("par son lien : sans clé, « Bientôt » ; avec `?apercu=`, le bandeau « Aperçu », la clé retirée de l'adresse, et on joue", async ({ browser }) => {
  const sans = await appareil(browser, `/?api=${APERCU}&debug&manuel&tactile=0`, true, false);
  await expect(sans.page.locator(".dj-bientot")).toBeVisible();
  await expect(sans.page.locator("#jeu-jouer")).toHaveCount(0);
  await sans.context.close();

  const { context, page } = await appareil(browser, `/?api=${APERCU}&debug&manuel&tactile=0&apercu=${CLE}`);
  await expect(page.locator('[data-apercu="cle"]')).toBeVisible();
  expect(page.url()).not.toContain("apercu=");
  expect(page.url()).not.toContain(CLE);
  expect(await page.evaluate(() => localStorage.getItem("cdj:apercu:blocks"))).toBe(CLE); // gardée dans le stockage local de l'appareil
  await lancer(page);
  await jouerLeJour(page);
  await expect(page.locator("#jeu-fin")).toBeVisible();
  await context.close();
});

test("le bandeau « Aperçu » ne recouvre rien en portrait : la scène lui réserve sa place (lot « manques de Blocks »)", async ({ browser }) => {
  const { context, page } = await appareil(browser, `/?api=${APERCU}&debug&manuel&tactile=0&apercu=${CLE}`);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('[data-apercu="cle"]')).toBeVisible();
  await lancer(page);
  const rect = async (sel: string) => (await page.locator(sel).boundingBox())!;
  const bandeau = await rect('[data-apercu="cle"]');
  const pause = await rect("#jeu-hud-pause");
  const plateau = await rect(".jeu-plateau");
  expect(bandeau.y + bandeau.height, "le plateau (grille et plaques du HUD) commence sous le bandeau").toBeLessThanOrEqual(plateau.y + 0.5);
  expect(bandeau.y + bandeau.height, "le bouton pause est sous le bandeau").toBeLessThanOrEqual(pause.y + 0.5);
  // La grille tient toujours dans la largeur : rien ne déborde.
  expect(plateau.x + plateau.width).toBeLessThanOrEqual(390.5);
  await context.close();
  // Sans aperçu (ni clé, ni PR), la scène n'a rien de réservé : la même page commence en haut.
  const sans = await appareil(browser, `/?debug&manuel&tactile=0`);
  await sans.page.setViewportSize({ width: 390, height: 844 });
  await lancer(sans.page);
  expect(await sans.page.evaluate(() => getComputedStyle(document.querySelector(".jeu-scene")!).paddingTop)).toBe("0px");
  await sans.context.close();
});

test("un envoi en aperçu est rangé à part : ni classement public ni nombre de classés", async () => {
  const jour = parseDay(JOUR)!;
  const envoi = await fetch(`${APERCU}/api/blocks/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Player-Id": "ab".repeat(16), ...entete },
    body: JSON.stringify({ replay: ESSAIS_BLOCKS.partie(jour, { simVersion: BLOCKS_SIM_VERSION, generatorVersion: BLOCKS_GENERATOR_VERSION }, 1).rediffusion, name: "Apercu" }),
  });
  expect(envoi.status).toBe(200);
  const board = await (await fetch(`${APERCU}/api/blocks/day/${JOUR}/board`, { headers: entete })).json();
  expect(board.participants).toBe(0);
  const vue = await (await fetch(`${APERCU}/api/portail/classement?vue=blocks`, { headers: entete })).json();
  expect(JSON.stringify(vue)).not.toContain("Apercu");
});
