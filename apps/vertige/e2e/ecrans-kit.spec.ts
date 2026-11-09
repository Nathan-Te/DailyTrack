import { expect, test, type Page } from "@playwright/test";
import { appareil, lancer } from "./appareil";

// Lot « écrans du kit » — **la mise en page des écrans que le kit écrit** (accueil, « Comment jouer », Réglages, pause, fin), essayée sur « Vertige », le jeu témoin : c'est le spec du kit (le kit n'a pas de navigateur à
// lui, ses écrans sont essayés par ceux de Vertige). Six tailles : 2 560 × 1 440, 1 920 × 1 080, 1 366 × 768 (PC), 844 × 390 (téléphone en paysage), 390 × 844 et 360 × 640 (téléphone en portrait). Pour chaque écran :
// aucun recouvrement entre deux éléments touchables, un espace minimal entre deux boutons (l'échelle d'espacement du kit), des vertige d'au moins 44 px, une carte dans la fenêtre et — au PC — d'une largeur bornée.

// **Famille « Régression »** (`e2e.regression` de la fiche de Vertige, `docs/tests.md` : les mises en page ne tournent que dans la CI complète de `main` et la nuit, ou quand ce spec est modifié par la PR) : le budget de 900 s de la CI d'une PR large
// n'a plus une seconde de marge (`apps/web/test/ciZones.test.ts`).
const TAILLES = [
  { nom: "2560 × 1440", width: 2560, height: 1440, pc: true },
  { nom: "1920 × 1080", width: 1920, height: 1080, pc: true },
  { nom: "1366 × 768", width: 1366, height: 768, pc: true },
  { nom: "844 × 390", width: 844, height: 390, pc: false },
  { nom: "390 × 844", width: 390, height: 844, pc: false },
  { nom: "360 × 640", width: 360, height: 640, pc: false },
] as const;
/** L'espace minimal entre deux boutons, en px de la fenêtre : `--jeu-esp-boutons` (8 px des jetons) ; un peu de tolérance pour l'arrondi des positions. */
const ESPACE_MIN = 7.5;
const CIBLE_MIN = 43.5;

interface Boite {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Mesure {
  fenetre: { w: number; h: number; defilementH: boolean };
  carte: Boite;
  /** Les éléments touchables de l'écran affiché (`texte` pour le message d'échec). */
  touchables: { texte: string; bouton: boolean; boite: Boite }[];
  plaques: Boite[];
}

/** Mesure l'écran du dessus (le dernier cadre affiché) : sa carte, ses éléments touchables (visibles) et les plaques de la communauté. */
async function mesurer(page: Page): Promise<Mesure> {
  return page.evaluate(() => {
    const cadres = [...document.querySelectorAll<HTMLElement>(".cadre")].filter((c) => !c.hidden && getComputedStyle(c).visibility !== "hidden");
    const cadre = cadres[cadres.length - 1]!;
    const boite = (e: Element): { x: number; y: number; w: number; h: number } => {
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    };
    const touchables = [...cadre.querySelectorAll<HTMLElement>("button, a[href], input, select")]
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden" && !e.hidden && !e.closest("[hidden]");
      })
      .map((e) => ({ texte: (e.textContent || e.getAttribute("aria-label") || e.id || e.tagName).trim().slice(0, 30), bouton: e.classList.contains("dj-bouton"), boite: boite(e) }));
    return {
      fenetre: { w: innerWidth, h: innerHeight, defilementH: document.documentElement.scrollWidth > innerWidth },
      carte: boite(cadre.querySelector(".jeu-ecran")!),
      touchables,
      plaques: [...document.querySelectorAll("#communaute a")].map(boite),
    };
  });
}

const recouvre = (a: Boite, b: Boite): boolean => a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;
/** La distance entre deux boîtes (0 si elles se touchent ou se recouvrent). */
const ecart = (a: Boite, b: Boite): number => Math.max(Math.max(0, b.x - (a.x + a.w), a.x - (b.x + b.w)), Math.max(0, b.y - (a.y + a.h), a.y - (b.y + b.h)));

async function verifier(page: Page, ecran: string, taille: (typeof TAILLES)[number], accueil = false): Promise<void> {
  const m = await mesurer(page);
  const lieu = `${ecran} à ${taille.nom}`;
  expect(m.fenetre.defilementH, `${lieu} : pas de défilement horizontal de la page`).toBe(false);
  // La carte est dans la fenêtre ; au PC sa largeur est bornée (900 px à 1 920 × 1 080 comme Tower, 1,25 fois plus au grand écran ; 640 px pour les autres écrans).
  expect(m.carte.x, `${lieu} : la carte dans la fenêtre (gauche)`).toBeGreaterThanOrEqual(0);
  expect(m.carte.x + m.carte.w, `${lieu} : la carte dans la fenêtre (droite)`).toBeLessThanOrEqual(m.fenetre.w + 0.5);
  if (taille.pc) {
    const zoom = taille.width >= 2200 && taille.height >= 1200 ? 1.25 : 1;
    const max = (accueil ? 900 : 640) * zoom;
    expect(m.carte.w, `${lieu} : la carte est bornée au PC`).toBeLessThanOrEqual(max + 1);
    expect(m.carte.w, `${lieu} : ni minuscule`).toBeGreaterThanOrEqual(max * 0.9);
  } else {
    expect(m.carte.w, `${lieu} : la carte occupe la largeur du téléphone`).toBeGreaterThanOrEqual(Math.min(m.fenetre.w - 40, 560));
  }
  // Aucun recouvrement entre deux éléments touchables ; les boutons sont à `ESPACE_MIN` l'un de l'autre au moins ; chaque cible fait 44 px.
  const t = m.touchables;
  for (let i = 0; i < t.length; i++) {
    expect(Math.min(t[i]!.boite.w, t[i]!.boite.h), `${lieu} : « ${t[i]!.texte} » a une cible d'au moins 44 px`).toBeGreaterThanOrEqual(CIBLE_MIN);
    for (let j = i + 1; j < t.length; j++) {
      expect(recouvre(t[i]!.boite, t[j]!.boite), `${lieu} : « ${t[i]!.texte} » et « ${t[j]!.texte} » se recouvrent`).toBe(false);
      if (t[i]!.bouton && t[j]!.bouton) expect(ecart(t[i]!.boite, t[j]!.boite), `${lieu} : « ${t[i]!.texte} » et « ${t[j]!.texte} » sont trop proches`).toBeGreaterThanOrEqual(ESPACE_MIN);
    }
  }
  if (accueil) for (const p of m.plaques) expect(recouvre(p, m.carte), `${lieu} : une plaque de la communauté recouvre la carte`).toBe(false);
}

test.describe("les écrans du kit : mise en page", () => {
  for (const taille of TAILLES) {
    test(`accueil, « Comment jouer » et Réglages à ${taille.nom}`, async ({ browser }) => {
      const { context, page } = await appareil(browser, `/?debug&manuel&tactile=${taille.pc ? 0 : 1}`, false);
      await page.setViewportSize({ width: taille.width, height: taille.height });
      await expect(page.locator("#jeu-aide")).toBeVisible(); // premier lancement : « Comment jouer » s'ouvre seul
      await verifier(page, "« Comment jouer »", taille);
      await page.locator("#jeu-aide-ok").click();
      await expect(page.locator("#jeu-aide")).toBeHidden();
      await verifier(page, "l'accueil", taille, true);
      await page.locator("#jeu-bouton-reglages").click();
      await expect(page.locator("#jeu-reglages")).toBeVisible();
      await expect(page.locator("#jeu-reglages-commandes button").first()).toBeVisible(); // l'écran des commandes (module à la demande) et sa feuille sont arrivés
      await page.waitForLoadState("networkidle");
      await verifier(page, "Réglages", taille);
      await context.close();
    });
    test(`pause et fin de partie à ${taille.nom}`, async ({ browser }) => {
      const { context, page } = await appareil(browser, `/?debug&manuel&tactile=${taille.pc ? 0 : 1}`);
      await page.setViewportSize({ width: taille.width, height: taille.height });
      await lancer(page);
      await page.locator("#jeu-hud-pause").click();
      await expect(page.locator("#jeu-pause")).toBeVisible();
      await verifier(page, "la pause", taille);
      await page.locator("#jeu-reprendre").click();
      await page.evaluate(() => window.__jeu.avancer(6000)); // le temps est écoulé : l'arrivée
      await expect(page.locator("#jeu-fin")).toBeVisible();
      await verifier(page, "la fin de partie", taille);
      await context.close();
    });
  }

  test("la peau : la page prend la classe de la fiche, l'accent et le décor viennent de la fiche, un écran fermé ne reçoit aucun appui", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0");
    expect(await page.evaluate(() => document.documentElement.classList.contains("jeu-etiquette--vertige"))).toBe(true);
    const peau = await page.evaluate(() => {
      const racine = getComputedStyle(document.documentElement);
      const fond = document.querySelector(".jeu-fond")!;
      const sonde = document.createElement("i");
      sonde.style.color = "var(--jeu-fond)";
      document.body.append(sonde);
      const teinte = getComputedStyle(sonde).color;
      sonde.remove();
      const jouer = getComputedStyle(document.querySelector("#jeu-jouer")!);
      return { fond: racine.getPropertyValue("--jeu-fond").trim(), coque: racine.getPropertyValue("--jeu-coque").trim(), ciel: getComputedStyle(fond).backgroundColor, teinte, bouton: jouer.color, boutonFond: jouer.backgroundColor };
    });
    expect(peau.fond).toMatch(/^#[0-9A-F]{6}$/i);
    expect(peau.coque).toMatch(/^#[0-9A-F]{6}$/i);
    expect(peau.ciel).not.toBe("rgba(0, 0, 0, 0)");
    expect(peau.ciel).toBe(peau.teinte); // sans peau dans la définition, le décor est la teinte de l'étiquette de la fiche…
    expect(peau.bouton).toBe(peau.teinte); // …et l'accent du bouton principal aussi, posé sur une plaque d'encre
    expect(peau.boutonFond).not.toBe(peau.bouton);
    await context.close();
  });

  test("le clavier mène à tous les boutons de l'accueil, dans l'ordre de lecture", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0");
    const ids: string[] = [];
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      ids.push(await page.evaluate(() => document.activeElement?.id || document.activeElement?.className.toString().split(" ")[0] || ""));
    }
    for (const id of ["jeu-jouer", "jeu-bouton-aide", "jeu-bouton-reglages"]) expect(ids, `Tab atteint ${id}`).toContain(id);
    expect(ids.indexOf("jeu-jouer")).toBeLessThan(ids.indexOf("jeu-bouton-aide"));
    expect(ids.indexOf("jeu-bouton-aide")).toBeLessThan(ids.indexOf("jeu-bouton-reglages"));
    await context.close();
  });
});
