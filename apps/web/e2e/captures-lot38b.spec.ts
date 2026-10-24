import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, type Page } from "@playwright/test";

// Captures du README de la retouche 38b (outil, pas un test) : `CAPTURES=1 npx playwright test captures-lot38b --project=chromium` (`OUT=…` change le
// dossier). Une planche par section de la vitrine des paliers : existant | palier 1 | palier 2 | palier 3, côte à côte, chacune titrée ; les thèmes en
// poursuite et en vue d'ensemble ; puis, pour trois thèmes, **chaque pas seul** au-dessus du palier 1 ; la vue en mouvement aux trois paliers ;
// enfin (38c) la matière avant / après : l'ancienne matière « détaillée » contre la matière sobre, au palier 3, en poursuite et de près.
// JPEG (des rendus 3D : le PNG pèserait cinq fois plus dans le dépôt).
test.skip(!process.env.CAPTURES, "outil de capture : CAPTURES=1");
test.skip(({ browserName }) => browserName !== "chromium", "rendu 3D : Chromium seulement");
test.setTimeout(3_600_000);

const OUT = process.env.OUT ?? join(import.meta.dirname, "../../../docs/lots/lot-38b-paliers-scene");
const COLONNES = [
  ["existant", "Existant"],
  ["P1", "Palier 1 — base"],
  ["P2", "Palier 2 — finition"],
  ["P3", "Palier 3 — vitrine"],
] as const;

/** Assemble des images (data URL) en une planche titrée, `parLigne` par ligne. */
async function planche(page: Page, images: string[], noms: string[], titre: string, w: number, h: number, parLigne: number, accent = -1): Promise<Buffer> {
  const jpeg = await page.evaluate(
    async ([imgs, ns, t, w, h, n, acc]) => {
      const pad = 6;
      const tete = 34;
      const legende = 24;
      const lignes = Math.ceil(imgs.length / n);
      const c = document.createElement("canvas");
      c.width = n * (w + pad) + pad;
      c.height = tete + lignes * (h + legende + pad);
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#1E1B19";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = "#F4EFE6";
      ctx.font = "italic 800 24px 'Barlow Condensed', sans-serif";
      ctx.fillText(t, pad, 25);
      for (let i = 0; i < imgs.length; i++) {
        const im = new Image();
        im.src = imgs[i]!;
        await im.decode();
        const x = pad + (i % n) * (w + pad);
        const y = tete + Math.floor(i / n) * (h + legende + pad);
        ctx.drawImage(im, x, y, w, h);
        ctx.font = "700 15px 'Archivo', sans-serif";
        ctx.fillStyle = i === acc ? "#E8552D" : "#F4EFE6";
        ctx.fillText(ns[i]!, x, y + h + 18);
      }
      return c.toDataURL("image/jpeg", 0.84);
    },
    [images, noms, titre, w, h, parLigne, accent] as const,
  );
  return Buffer.from(jpeg.split(",")[1]!, "base64");
}

test("une planche par section, aux trois paliers", async ({ page }) => {
  mkdirSync(OUT, { recursive: true });
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/vitrine/");
  await page.waitForFunction(() => window.__vitrine);
  const sujets = await page.evaluate(() => [...new Set(window.__vitrine!.vues().map((v) => v.sujet))]);
  const W = 560;
  const H = 315;
  for (const s of sujets) {
    for (const vue of s.startsWith("theme-") ? (["virage", "ensemble"] as const) : ([null] as const)) {
      if (vue) await page.evaluate(([x, v]) => (document.querySelectorAll(`#${x} .segment`)[v === "virage" ? 0 : 2] as HTMLButtonElement).click(), [s, vue] as const);
      const images: string[] = [];
      for (const [v] of COLONNES) images.push((await page.evaluate(([x, y, w, h]) => window.__vitrine!.capture(x, y, w, h), [s, v, W, H] as const))!);
      const titre = await page.evaluate((x) => document.querySelector(`#${x} h2`)!.textContent, s);
      const nom = `${s}${vue === "ensemble" ? "-ensemble" : ""}.jpg`;
      writeFileSync(join(OUT, nom), await planche(page, images, COLONNES.map(([, n]) => n), titre + (vue === "ensemble" ? " — vue d'ensemble" : ""), W, H, 4));
      console.info(nom);
    }
  }
});

test("chaque pas seul, au-dessus du palier 1 (trois thèmes)", async ({ page }) => {
  mkdirSync(OUT, { recursive: true });
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/vitrine/");
  await page.waitForFunction(() => window.__vitrine);
  const pas = ["", "+geometrie", "+variete", "+matiere", "+traces", "+reflets", "+ombres", "+brume", "+nuages", "+drapeaux", "+foule", "+ecrans", "+particules", "+etalonnage", "+anticrenelage", "+halo"];
  const W = 400;
  const H = 225;
  for (const [s, vue] of [["theme-stade", "depart"], ["theme-nuit", "virage"], ["theme-canyon", "virage"]] as const) {
    await page.evaluate(([x, v]) => (document.querySelectorAll(`#${x} .segment`)[v === "virage" ? 0 : 1] as HTMLButtonElement).click(), [s, vue] as const);
    const images: string[] = [];
    for (const p of pas) {
      await page.evaluate((r) => window.__vitrine!.reglages(r), `1${p}`);
      images.push((await page.evaluate(([x, w, h]) => window.__vitrine!.capture(x, "carte", w, h), [s, W, H] as const))!);
    }
    const titre = await page.evaluate((x) => document.querySelector(`#${x} h2`)!.textContent, s);
    writeFileSync(join(OUT, `pas-${s.replace("theme-", "")}.jpg`), await planche(page, images, pas.map((p) => (p ? `palier 1 ${p.replace("+", "+ ")}` : "palier 1")), `${titre} — chaque pas seul au-dessus du palier 1`, W, H, 4, 0));
    console.info(s);
  }
});

test("la vue en mouvement aux trois paliers (trois thèmes)", async ({ page }) => {
  mkdirSync(OUT, { recursive: true });
  await page.setViewportSize({ width: 960, height: 760 });
  await page.goto("/vitrine/?reglages=1");
  await page.waitForFunction(() => window.__vitrine);
  for (const s of ["theme-stade", "theme-nuit", "theme-col"]) {
    await page.evaluate((x) => window.__vitrine!.mouvement.ouvrir(x), s);
    const images: string[] = [];
    for (const r of ["1", "2", "3"]) {
      await page.evaluate((x) => window.__vitrine!.reglages(x), r);
      await page.waitForFunction(async (x) => (await window.__vitrine!.mouvement.etat())?.reglages === x, r);
      const n = (await page.evaluate(() => window.__vitrine!.mouvement.etat()))!.images;
      await page.waitForFunction(async (k) => ((await window.__vitrine!.mouvement.etat())?.images ?? 0) >= k + 3, n, { timeout: 300_000 });
      const shot = await page.locator(".mouvement__cadre").screenshot({ type: "jpeg", quality: 84 });
      images.push(`data:image/jpeg;base64,${shot.toString("base64")}`);
    }
    const titre = await page.evaluate((x) => `Vue en mouvement : ${document.querySelector(`#${x} h2`)!.textContent!.replace("Thème : ", "")}`, s);
    writeFileSync(join(OUT, `mouvement-${s.replace("theme-", "")}.jpg`), await planche(page, images, ["Palier 1", "Palier 2", "Palier 3"], titre, 560, 315, 3));
    console.info(s);
  }
});

test("38c : la matière avant / après (Stade, Rallye, Nuit, Ville), en poursuite et de près", async ({ page }) => {
  mkdirSync(OUT, { recursive: true });
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/vitrine/");
  await page.waitForFunction(() => window.__vitrine);
  const colonnes = [
    ["1", "Palier 1 (le grain)"],
    ["3", "Palier 3, matière sobre (après, 38c)"],
  ] as const;
  const W = 560;
  const H = 315;
  for (const s of ["theme-stade", "theme-rallye", "theme-nuit", "theme-ville"]) {
    const images: string[] = [];
    const noms: string[] = [];
    // Les boutons de point de vue de la section : 0 = poursuite, 3 = l'asphalte de près.
    for (const [i, nomVue] of [[0, "poursuite"], [3, "de près"]] as const) {
      await page.evaluate(([x, k]) => (document.querySelectorAll(`#${x} .segment`)[k] as HTMLButtonElement).click(), [s, i] as const);
      for (const [r, nom] of colonnes) {
        await page.evaluate((x) => window.__vitrine!.reglages(x), r);
        images.push((await page.evaluate(([x, w, h]) => window.__vitrine!.capture(x, "carte", w, h), [s, W, H] as const))!);
        noms.push(`${nom} — ${nomVue}`);
      }
    }
    const titre = await page.evaluate((x) => document.querySelector(`#${x} h2`)!.textContent, s);
    writeFileSync(join(OUT, `matiere-${s.replace("theme-", "")}.jpg`), await planche(page, images, noms, `${titre} — la matière avant / après (38c)`, W, H, 3));
    console.info(s);
  }
});
