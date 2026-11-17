import { expect, test, type Page } from "@playwright/test";
import { appareil, lancer } from "./appareil";

// Lot PG1 — **le HUD en surimpression** du kit (`DefinitionJeu.hud: "surimpression"`), essayé sur « Cibles », le jeu témoin : `?debug&hud=surimpression` (jamais en production). Le kit pose trois zones sur le
// plateau (haut-gauche, centre, haut-droite) et l'annonce du milieu ; le texte de la barre n'est plus visible mais reste dans la page ; sans le paramètre, la barre est celle d'avant. Essayé en portrait
// (390 × 844 et 360 × 640) et en paysage (844 × 390) : les zones sont dans la fenêtre, ne se recouvrent pas, ne cachent ni la barre ni ses boutons et n'attrapent aucun toucher.
// **Famille « Régression »** (`e2e.regression` de la fiche de Cibles) : une mise en page ; le parcours (le chargement) est `chargement-partie.spec.ts`.
const TAILLES = [
  { nom: "390 × 844 (portrait)", width: 390, height: 844 },
  { nom: "360 × 640 (portrait)", width: 360, height: 640 },
  { nom: "844 × 390 (paysage)", width: 844, height: 390 },
] as const;

interface Boite {
  x: number;
  y: number;
  w: number;
  h: number;
}
const recouvre = (a: Boite, b: Boite): boolean => a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;

async function mesurer(page: Page) {
  return page.evaluate(() => {
    const boite = (e: Element): { x: number; y: number; w: number; h: number } => {
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    };
    const zone = (nom: string): HTMLElement => document.querySelector<HTMLElement>(`.jeu-surimpression [data-zone="${nom}"]`)!;
    const contenu = (nom: string): Element[] => [...zone(nom).children];
    return {
      fenetre: { w: innerWidth, h: innerHeight, defilementH: document.documentElement.scrollWidth > innerWidth },
      plateau: boite(document.querySelector(".jeu-plateau")!),
      barre: boite(document.querySelector(".jeu-hud")!),
      boutons: [...document.querySelectorAll(".jeu-hud__bouton")].map(boite),
      racine: { ...boite(document.querySelector(".jeu-surimpression")!), evenements: getComputedStyle(document.querySelector(".jeu-surimpression")!).pointerEvents, ariaHidden: document.querySelector(".jeu-surimpression")!.getAttribute("aria-hidden") },
      hautGauche: contenu("haut-gauche").map(boite),
      centre: contenu("centre").map(boite),
      hautDroite: contenu("haut-droite").map(boite),
      annonce: contenu("annonce").map(boite),
      barreVisible: ["jeu-hud-score", "jeu-hud-temps"].map((id) => {
        const e = document.getElementById(id)!;
        const r = e.getBoundingClientRect();
        return { id, texte: e.textContent, largeur: r.width, hauteur: r.height };
      }),
    };
  });
}

test.describe("Cibles : le HUD en surimpression (kit, lot PG1)", () => {
  for (const taille of TAILLES) {
    test(`zones sur le plateau, sans recouvrement, à ${taille.nom}`, async ({ browser }) => {
      const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&hud=surimpression");
      await page.setViewportSize({ width: taille.width, height: taille.height });
      await lancer(page);
      await expect(page.locator(".jeu-surimpression")).toBeVisible();
      // Lot PG2 : on attend le texte de la barre **et** celui des zones avant de mesurer (l'instabilité de la CI : la mesure était faite avant que le HUD ait écrit son texte ; le kit l'écrit dès la création de la partie depuis le lot K9, ce
      // contrôle en fait un état attendu et non plus une course).
      for (const id of ["jeu-hud-score", "jeu-hud-temps"]) await expect(page.locator(`#${id}`)).not.toHaveText("");
      for (const zone of ["haut-gauche", "centre", "haut-droite", "annonce"]) await expect(page.locator(`.jeu-surimpression [data-zone="${zone}"]`)).not.toBeEmpty();
      const m = await mesurer(page);
      const lieu = taille.nom;
      expect(m.fenetre.defilementH, `${lieu} : pas de défilement horizontal`).toBe(false);
      // Le texte de la barre n'est plus visible (1 × 1 px, rogné) mais il est dans la page : la pause et les lecteurs d'écran le lisent.
      for (const b of m.barreVisible) {
        expect(b.largeur, `${lieu} : ${b.id} masqué à la vue`).toBeLessThanOrEqual(1.5);
        expect(b.texte, `${lieu} : ${b.id} lu`).not.toBe("");
      }
      expect(m.racine.ariaHidden).toBe("true"); // ce que le jeu y écrit répète la barre : un lecteur d'écran ne le lit pas deux fois
      expect(m.racine.evenements).toBe("none"); // aucun toucher n'est attrapé : la scène du jeu les reçoit tous
      // Les zones couvrent le plateau, sous la barre ; chaque contenu est dans la fenêtre ET dans le plateau.
      expect(m.racine.y, `${lieu} : les zones sont sur le plateau, pas sur la barre`).toBeGreaterThanOrEqual(m.barre.y + m.barre.h - 1);
      const contenus = { "haut-gauche": m.hautGauche, centre: m.centre, "haut-droite": m.hautDroite, annonce: m.annonce };
      for (const [nom, boites] of Object.entries(contenus)) {
        expect(boites.length, `${lieu} : la zone ${nom} est remplie`).toBeGreaterThan(0);
        for (const b of boites) {
          expect(b.x, `${lieu} : ${nom} dans la fenêtre (gauche)`).toBeGreaterThanOrEqual(0);
          expect(b.x + b.w, `${lieu} : ${nom} dans la fenêtre (droite)`).toBeLessThanOrEqual(m.fenetre.w + 0.5);
          expect(b.y, `${lieu} : ${nom} sous la barre`).toBeGreaterThanOrEqual(m.barre.y + m.barre.h - 1);
          expect(b.y + b.h, `${lieu} : ${nom} dans le plateau`).toBeLessThanOrEqual(m.plateau.y + m.plateau.h + 0.5);
        }
      }
      // Aucun recouvrement entre les trois zones du haut ; l'annonce (au milieu) ne recouvre pas la ligne du haut ; aucune ne touche un bouton de la barre.
      const haut = [...m.hautGauche, ...m.centre, ...m.hautDroite];
      for (let i = 0; i < haut.length; i++) for (let j = i + 1; j < haut.length; j++) expect(recouvre(haut[i]!, haut[j]!), `${lieu} : les zones du haut ne se recouvrent pas (${i}, ${j})`).toBe(false);
      for (const a of m.annonce) for (const h of haut) expect(recouvre(a, h), `${lieu} : l'annonce ne recouvre pas le haut`).toBe(false);
      for (const bt of m.boutons) {
        expect(bt.w, `${lieu} : bouton de la barre de 44 px`).toBeGreaterThanOrEqual(43.5);
        for (const b of [...haut, ...m.annonce]) expect(recouvre(bt, b), `${lieu} : un bouton de la barre n'est pas recouvert`).toBe(false);
      }
      // L'annonce vit une seconde de jeu (30 pas) ; la ligne du haut suit la partie.
      await page.evaluate(() => window.__jeu.avancer(40));
      await expect(page.locator('.jeu-surimpression [data-zone="annonce"]')).toBeEmpty();
      await expect(page.locator('.jeu-surimpression [data-zone="centre"]')).toHaveText(/^0:\d\d$/);
      // Les zones suivent « Recommencer » (une partie neuve repart d'un HUD plein, sans doublon).
      await page.locator("#jeu-hud-pause").click();
      await page.locator("#jeu-pause-recommencer").click();
      await expect(page.locator(".jeu-surimpression")).toHaveCount(1);
      await expect(page.locator('.jeu-surimpression [data-zone="haut-gauche"] > *')).toHaveCount(1);
      await expect(page.locator('.jeu-surimpression [data-zone="annonce"] > *')).toHaveCount(1);
      await context.close();
    });
  }

  test("sans `hud: surimpression` la barre est celle d'avant (les jeux existants ne changent pas)", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0");
    await lancer(page);
    await expect(page.locator(".jeu-surimpression")).toHaveCount(0);
    await expect(page.locator("#jeu-scene.jeu-scene--surimpression")).toHaveCount(0);
    await expect(page.locator("#jeu-hud-score")).toBeVisible();
    expect((await page.locator("#jeu-hud-score").boundingBox())!.width).toBeGreaterThan(20);
    await context.close();
  });
});
