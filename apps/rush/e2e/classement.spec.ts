import { RUSH_GENERATOR_VERSION, RUSH_SIM_VERSION, VARIANTE } from "@cdj/rush-sim";
import { expect, test, type Page } from "@playwright/test";
import { ESSAIS_RUSH } from "../../api/scripts/rush-essais";
import { API, appareil, jouerLeJour, lancer } from "./appareil";

// « Rush » — LE parcours du classement, avec le VRAI serveur (l'API de la plateforme montée par le registre des fiches : `apps/api/scripts/rush-serveur-essai.ts`, port 8795, base en mémoire, refus des copies actif ;
// son jour est le 06/11/2026, que la page prend aussi). Une partie jouée par le pilote envoyée et classée (le pseudo au premier envoi), une copie refusée, puis **le parcours Amis** dans le dialogue du classement : ouvrir la
// feuille d'un autre joueur, l'ajouter en ami, voir « Amis » ne montrer que lui et toi. Chromium seulement ; rien dans `@navigateurs`.
test.describe.configure({ mode: "serial" });

const VERSIONS = { simVersion: RUSH_SIM_VERSION, generatorVersion: RUSH_GENERATOR_VERSION };
const JOUR_CIVIL = Date.UTC(2026, 10, 6) / 86_400_000;

/** Un autre joueur, créé par l'API même (un identifiant tiré ici, jamais celui d'un navigateur) : sa partie est rejouée et classée comme les autres. */
async function joueurDeLApi(nom: string, variante: number): Promise<void> {
  const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
  const r = await fetch(`${API}/api/rush/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Player-Id": id },
    body: JSON.stringify({ replay: ESSAIS_RUSH.partie(JOUR_CIVIL, VERSIONS, variante).rediffusion, name: nom }),
  });
  expect(r.status, `le serveur rejoue la partie de ${nom}`).toBe(200);
}

async function choisirPseudo(page: Page, pseudo: string): Promise<void> {
  await expect(page.locator("#jeu-pseudo-form")).toBeVisible({ timeout: 20_000 }); // l'arrivée attend la chute du golem (2,8 s) : de la marge pour une machine chargée
  await page.locator("#jeu-pseudo").fill(pseudo);
  await page.locator("#jeu-pseudo-ok").click();
}

// Un seul parcours, dans cet ordre : le classement du jour que le portail garde par fenêtre de 45 s (`CLASSEMENT_FENETRE_MS`) se calcule au premier appel qui en a besoin — l'arrivée du premier joueur — : les autres
// joueurs doivent donc déjà y être, sinon « Amis » lirait un classement d'avant eux.
test("une partie scriptée est classée par le serveur, sa copie est refusée, et le parcours Amis du classement", async ({ browser }) => {
  await joueurDeLApi("Carla", 3);
  await joueurDeLApi("Denis", 5);
  const pseudo = `Eve${Date.now() % 100000}`;
  const a = await appareil(browser);
  await lancer(a.page);
  const attendu = await jouerLeJour(a.page, 5, "foncer"); // lot BR5 : « foncer » (aucun écran de carte) : plus court, la CI est lente
  await choisirPseudo(a.page, pseudo);
  await expect(a.page.locator("#jeu-fin-rang")).toContainText("e sur 3", { timeout: 20_000 }); // classée parmi Carla, Denis et elle
  expect(await a.page.evaluate(() => window.__jeu.envoi().statut)).toBe("ranked");
  await expect(a.page.locator("#jeu-fin-score")).toHaveText(VARIANTE.formatScore(VARIANTE.score(attendu), "fr"));

  // La même partie, d'un autre appareil : le serveur reconnaît la copie et la refuse.
  const b = await appareil(browser);
  await lancer(b.page);
  await jouerLeJour(b.page, 5, "foncer");
  await choisirPseudo(b.page, `Bob${Date.now() % 100000}`);
  await expect.poll(() => b.page.evaluate(() => window.__jeu.envoi().statut), { timeout: 20_000 }).toBe("refused");
  await expect(b.page.locator("#jeu-fin-rang")).toContainText("refusée");
  await b.context.close();

  // Le parcours Amis : l'accueil (la page se recharge), « Tout le classement », la feuille de Carla, « Ajouter en ami », puis « Amis » : elle et toi.
  await a.page.locator("#jeu-fin-accueil").click();
  await a.page.waitForSelector("#jeu-tout-le-classement:not([hidden])");
  await a.page.locator("#jeu-tout-le-classement").click();
  const dialogue = a.page.locator("#jeu-classement-ecran");
  await expect(dialogue).toBeVisible();
  await expect(dialogue.locator("#jeu-classement-liste .rang")).toHaveCount(3);
  await expect(dialogue.locator('[role="radiogroup"]')).toBeVisible(); // le sélecteur Tous · Amis
  await dialogue.locator("#jeu-classement-liste .rang__bouton", { hasText: "Carla" }).click();
  const feuille = a.page.locator(".dj-feuille");
  await expect(feuille).toContainText(/ajouter en ami/i); // la fiche du joueur est lue (le serveur, route des amis)
  await feuille.locator(".dj-feuille__principal").click();
  await expect(feuille).toContainText("Carla est dans tes amis");
  await feuille.locator(".dj-feuille__fermer").click();
  await dialogue.locator('[data-filtre="amis"]').click();
  await expect(dialogue.locator("#jeu-classement-liste .rang")).toHaveCount(2); // Carla et toi, pas Denis
  await expect(dialogue.locator("#jeu-classement-liste")).toContainText("Carla");
  await expect(dialogue.locator("#jeu-classement-liste")).not.toContainText("Denis");
  await expect(dialogue.locator("#jeu-classement-liste")).toContainText(pseudo);
  await a.context.close();
});
