import { expect, test, type Page } from "@playwright/test";
import { appareil, lancer } from "./appareil";

// Lot PG2 — **le bilan de la partie dans l'écran de fin du kit** et **les dessins de « Comment jouer »**, essayés sur « Pile poil » (jamais en production : `?debug&bilan=1`, `?debug&dessins=1`).
//   - Le jeu fournit un bilan (`PartieDuJeu.bilan`) : le kit le montre dans le vrai écran de fin, sous le score, en portrait (390 × 844, 360 × 640) et en paysage (844 × 390) ; l'écran s'ouvre en haut, sans écran
//     intermédiaire (un seul écran ouvert), sans défilement horizontal, rien ne dépasse de la fenêtre. Sans bilan (le jeu d'avant), l'écran de fin n'a pas la tuile.
//   - Un jeu peut donner un petit dessin à côté de chaque pas de « Comment jouer » ; l'écran **s'ouvre toujours en haut**, même quand il est plus haut que la fenêtre (360 × 640).
// **Famille « Régression »** (`e2e.regression` de la fiche de Pilepoil) : une mise en page.
const TAILLES = [
  { nom: "390 × 844 (portrait)", width: 390, height: 844 },
  { nom: "360 × 640 (portrait)", width: 360, height: 640 },
  { nom: "844 × 390 (paysage)", width: 844, height: 390 },
] as const;

async function finir(page: Page): Promise<void> {
  await page.evaluate(() => window.__jeu.avancer(1000)); // la partie de trente secondes est jouée sans une touche : elle finit, l'écran de fin s'ouvre
  await expect(page.locator("#jeu-fin")).toBeVisible();
}

test.describe("Pilepoil : le bilan dans l'écran de fin (kit, lot PG2)", () => {
  for (const taille of TAILLES) {
    test(`le bilan est dans le vrai écran de fin, en haut, à ${taille.nom}`, async ({ browser }) => {
      const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&bilan=1");
      try {
        await page.setViewportSize({ width: taille.width, height: taille.height });
        await lancer(page);
        await finir(page);
        const m = await page.evaluate(() => {
          const boite = (e: Element) => {
            const r = e.getBoundingClientRect();
            return { x: r.x, y: r.y, w: r.width, h: r.height };
          };
          const ouverts = [...document.querySelectorAll('[role="dialog"]')].filter((d) => !(d as HTMLElement).hidden).map((d) => d.id);
          return {
            ouverts,
            fenetre: { w: innerWidth, h: innerHeight, debordeH: document.documentElement.scrollWidth > innerWidth },
            defile: document.querySelector<HTMLElement>("#jeu-fin .cadre__defile")!.scrollTop,
            score: boite(document.getElementById("jeu-fin-score")!),
            bilan: boite(document.getElementById("jeu-fin-bilan")!),
            cause: document.getElementById("jeu-fin-cause")!.textContent,
            libelles: [...document.querySelectorAll("#jeu-fin-bilan dt")].map((e) => e.textContent),
            valeurs: [...document.querySelectorAll("#jeu-fin-bilan dd")].map((e) => e.textContent),
            titre: document.querySelector("#jeu-fin-bilan h3")!.textContent,
            html: document.getElementById("jeu-fin-bilan")!.innerHTML,
          };
        });
        const lieu = taille.nom;
        expect(m.ouverts, `${lieu} : un seul écran ouvert, l'écran de fin (aucun écran intermédiaire)`).toEqual(["jeu-fin"]);
        expect(await page.evaluate(() => window.__jeu.phase())).toBe("fin");
        expect(m.defile, `${lieu} : l'écran de fin s'ouvre en haut`).toBe(0);
        expect(m.fenetre.debordeH, `${lieu} : pas de défilement horizontal`).toBe(false);
        // Le contenu du jeu : la cause, puis les lignes (la ligne vide est ignorée), traduites par le catalogue du jeu.
        expect(m.cause).toBe("Le temps est écoulé");
        expect(m.titre).toBe("Bilan");
        expect(m.libelles).toEqual(["Touches réussies", "Thème", "Durée de la partie", "Total à viser"]);
        expect(m.valeurs[0]).toMatch(/^\d+$/); // le score du jeu (une variante au temps en donne un autre : le jeu généré reprend ce spec)
        expect(m.valeurs.slice(2)).toEqual(["30 s", "20"]);
        // Sous le score (jamais dessus), dans la fenêtre en largeur, sans déborder du côté de l'écran.
        expect(m.bilan.y, `${lieu} : le bilan est sous le score`).toBeGreaterThanOrEqual(m.score.y + m.score.h - 1);
        expect(m.bilan.x, `${lieu} : bilan dans la fenêtre (gauche)`).toBeGreaterThanOrEqual(0);
        expect(m.bilan.x + m.bilan.w, `${lieu} : bilan dans la fenêtre (droite)`).toBeLessThanOrEqual(m.fenetre.w + 0.5);
        expect(m.html, "des éléments du socle, jamais du HTML venu d'une donnée").not.toMatch(/<(script|img|a)\b/);
        // « Rejouer » reste atteignable (l'écran défile si besoin) et le bouton reçoit le focus sans avoir fait défiler.
        await page.locator("#jeu-rejouer").scrollIntoViewIfNeeded();
        await expect(page.locator("#jeu-rejouer")).toBeVisible();
      } finally {
        await context.close();
      }
    });
  }

  test("le bilan est aussi en anglais", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&bilan=1");
    try {
      await page.evaluate(() => localStorage.setItem("cdj:langue", "en"));
      await page.reload();
      await page.waitForSelector("#jeu-jouer", { state: "attached" });
      await lancer(page);
      await finir(page);
      await expect(page.locator("#jeu-fin-cause")).toHaveText("Time is up");
      await expect(page.locator("#jeu-fin-bilan h3")).toHaveText("Recap");
      await expect(page.locator("#jeu-fin-bilan dt").first()).toHaveText("Hits landed");
    } finally {
      await context.close();
    }
  });

  test("un jeu sans bilan : l'écran de fin n'a pas la tuile (inchangé)", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0");
    try {
      await lancer(page);
      await finir(page);
      await expect(page.locator("#jeu-fin-bilan")).toHaveCount(0);
      await expect(page.locator("#jeu-fin-score")).toBeVisible();
    } finally {
      await context.close();
    }
  });
});

test.describe("Pilepoil : « Comment jouer » avec ses dessins, ouvert en haut (kit, lot PG2)", () => {
  // Deux ouvertures : au premier lancement (l'aide n'est pas vue : elle s'ouvre toute seule) et par le bouton « Comment jouer » de l'accueil (celle qui défilait jusqu'au bouton).
  for (const [ouverture, vue] of [["au premier lancement", false], ["par le bouton", true]] as const)
    for (const taille of TAILLES) {
    test(`un dessin à côté de chaque pas et l'écran s'ouvre en haut, ${ouverture}, à ${taille.nom}`, async ({ browser }) => {
      const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&dessins=1", vue);
      try {
        await page.setViewportSize({ width: taille.width, height: taille.height });
        if (vue) await page.locator("#jeu-bouton-aide").click();
        await expect(page.locator("#jeu-aide")).toBeVisible();
        await page.waitForTimeout(500); // « rien ne doit changer » : un défilement lissé ou différé aurait eu le temps d'emporter l'écran jusqu'au bouton
        const m = await page.evaluate(() => {
          const defile = document.querySelector<HTMLElement>("#jeu-aide .cadre__defile")!;
          const titre = document.querySelector("#jeu-aide .jeu-ecran__titre")!.getBoundingClientRect();
          return {
            defile: defile.scrollTop,
            deborde: defile.scrollHeight > defile.clientHeight,
            titreY: titre.y,
            pas: [...document.querySelectorAll("#jeu-aide .jeu-aide > li")].map((li) => {
              const d = li.querySelector(".jeu-aide__dessin");
              const r = d?.getBoundingClientRect();
              return { dessin: !!d, svg: !!d?.querySelector("svg"), ariaHidden: d?.getAttribute("aria-hidden"), w: r?.width ?? 0, h: r?.height ?? 0, texte: li.textContent };
            }),
          };
        });
        const lieu = taille.nom;
        expect(m.defile, `${lieu} : « Comment jouer » s'ouvre en haut`).toBe(0);
        expect(m.titreY, `${lieu} : le titre n'est pas coupé`).toBeGreaterThanOrEqual(0);
        expect(m.pas).toHaveLength(3);
        for (const p of m.pas) {
          expect(p.dessin && p.svg, `${lieu} : un dessin par pas`).toBe(true);
          expect(p.ariaHidden, "le dessin est décoratif").toBe("true");
          expect(p.w).toBeGreaterThan(40);
          expect(p.h).toBeGreaterThan(40);
          expect(p.texte).toMatch(/\S/);
        }
        if (taille.height <= 640) expect(m.deborde, `${lieu} : l'écran est plus haut que la fenêtre : c'est le cas qui défilait jusqu'au bouton`).toBe(true);
        // « C'est parti » est le focus (au clavier, Entrée ferme), sans avoir fait défiler.
        await expect(page.locator("#jeu-aide-ok")).toBeFocused();
      } finally {
        await context.close();
      }
    });
  }

  test("sans dessin : les pas sont les <li> de texte d'avant", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0", false);
    try {
      await expect(page.locator("#jeu-aide")).toBeVisible();
      await expect(page.locator("#jeu-aide .jeu-aide > li")).toHaveCount(3);
      await expect(page.locator("#jeu-aide .jeu-aide__dessin")).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
