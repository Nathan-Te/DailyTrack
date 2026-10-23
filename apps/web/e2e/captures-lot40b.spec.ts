import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

// Captures de la retouche 40b (outil, pas un test) : `CAPTURES=1 npx playwright test captures-lot40b` (le `dist` habituel, construit avec la vitrine).
//   1. Les quatre modèles (civile, A, B, C) sous quatre angles (trois quarts arrière, profil, avant, dos à 7 m : la caméra de poursuite), aux
//      paliers 1 et 2 (Stade) : `modeles-p1.jpg`, `modeles-p2.jpg` (les captures « avant » du petit niveau de détail : `modeles-avant-p*.jpg`).
//   2. Les trois motifs de livrée (bande, flancs, unie) de chaque modèle : `motifs.jpg`.
//   3. La planche des couleurs de la civile (8 couleurs × 8 thèmes ; la Nuit avec ses rayures et ses feux allumés) : `couleurs-civile.jpg`.
//   4. Le jeu : la civile (`/?home=0`), le Proto en lagon à flancs (`?voiture=proto&couleur=5&motif=flancs`), la civile la nuit.
test.skip(!process.env.CAPTURES, "outil de capture : CAPTURES=1");
test.setTimeout(900_000);

const OUT = process.env.OUT ?? join(import.meta.dirname, "../../../docs/lots/lot-40b-voitures-en-jeu");
mkdirSync(OUT, { recursive: true });
const MODELES = ["civile", "A", "B", "C"] as const;
const ecrire = (nom: string, url: string) => writeFileSync(join(OUT, nom), Buffer.from(url.split(",")[1]!, "base64"));

async function vitrine(page: Page) {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/vitrine/?planche=voiture");
  await page.waitForFunction(() => window.__vitrine);
  await page.evaluate(() => window.__vitrine!.voiture());
}

test("les modèles sous quatre angles, aux paliers 1 et 2", async ({ page }) => {
  await vitrine(page);
  for (const palier of [1, 2] as const) {
    ecrire(
      `modeles-p${palier}.jpg`,
      await page.evaluate(
        async ([cols, p]) => {
          const m = (await window.__vitrine!.voiture())!;
          await m.toutDessiner("theme-stade");
          const angles: [number, number, number][] = [
            [35, 14, 6.5],
            [90, 6, 6.2],
            [180, 18, 6.5],
            [0, 14, 7],
          ];
          const w = 420;
          const h = 255;
          const toile = document.createElement("canvas");
          toile.width = angles.length * w;
          toile.height = cols.length * h;
          const x = toile.getContext("2d")!;
          for (const [j, col] of cols.entries()) {
            for (const [i, [az, el, d]] of angles.entries()) {
              const img = new Image();
              img.src = await m.apercu(col, p, az, el, d, w, h);
              await img.decode();
              x.drawImage(img, i * w, j * h);
            }
          }
          return toile.toDataURL("image/jpeg", 0.88);
        },
        [MODELES, palier] as const,
      ),
    );
  }
  expect(await page.evaluate(() => window.__vitrine!.erreurs)).toEqual([]);
});

test("les trois motifs de livrée, et la planche des couleurs de la civile", async ({ page }) => {
  await vitrine(page);
  ecrire(
    "motifs.jpg",
    await page.evaluate(async (cols) => {
      const m = (await window.__vitrine!.voiture())!;
      const w = 420;
      const h = 255;
      const toile = document.createElement("canvas");
      toile.width = 3 * w;
      toile.height = cols.length * h;
      const x = toile.getContext("2d")!;
      for (const [i, motif] of (["bande", "flancs", "unie"] as const).entries()) {
        await m.choisirMotif(motif);
        for (const [j, col] of cols.entries()) {
          const img = new Image();
          img.src = await m.apercu(col, 2, 55, 22, 6.4, w, h);
          await img.decode();
          x.drawImage(img, i * w, j * h);
        }
      }
      await m.choisirMotif("bande");
      return toile.toDataURL("image/jpeg", 0.88);
    }, MODELES),
  );
  ecrire("couleurs-civile.jpg", await page.evaluate(async () => (await window.__vitrine!.voiture())!.planchesCouleurs("civile", document.createElement("canvas"))));
  expect(await page.evaluate(() => window.__vitrine!.erreurs)).toEqual([]);
});

test("le jeu : la civile, le Proto d'essai, la civile la nuit", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  const vues: [string, string][] = [
    ["jeu-civile.jpg", "/?home=0&debug&quality=2&api=demo"],
    ["jeu-proto-lagon-flancs.jpg", "/?home=0&debug&quality=2&api=demo&voiture=proto&couleur=5&motif=flancs"],
    ["jeu-civile-nuit.jpg", "/?home=0&debug&quality=2&api=demo&seed=2026-10-14&theme=nuit"],
  ];
  for (const [nom, adresse] of vues) {
    await page.goto(adresse);
    await page.waitForFunction(() => window.__cdj?.phase === "countdown" || window.__cdj?.phase === "racing");
    await page.waitForFunction(() => window.__cdj.voiture.aJour, undefined, { timeout: 60_000 });
    // Pas à pas : le décompte (3 s) et une demi-seconde, voiture à l'arrêt sur la grille (la carte du jour quitte l'écran avec le décompte).
    await page.evaluate(() => window.__cdj.manual(true));
    await page.evaluate(() => window.__cdj.advance(3 * 120 + 60));
    await page.waitForTimeout(300); // l'image d'après le dernier pas
    writeFileSync(join(OUT, nom), await page.screenshot({ type: "jpeg", quality: 88 }));
  }
});
