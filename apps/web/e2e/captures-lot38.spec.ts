import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "@playwright/test";

// Captures du README du lot 38 (outil, pas un test) : `CAPTURES=1 npx playwright test captures-lot38 --project=chromium` (`OUT=…` change le
// dossier). Une planche par section de la vitrine : existant | A | B | C | mélange, côte à côte, chacune titrée ; les thèmes en poursuite, et la
// vue d'ensemble en plus. JPEG (des rendus 3D : le PNG pèserait cinq fois plus dans le dépôt).
test.skip(!process.env.CAPTURES, "outil de capture : CAPTURES=1");
test.skip(({ browserName }) => browserName !== "chromium", "rendu 3D : Chromium seulement");
test.setTimeout(1_800_000);

const OUT = process.env.OUT ?? join(import.meta.dirname, "../../../docs/lots/lot-38-direction-scene");
const VARIANTES = [
  ["existant", "Existant"],
  ["A", "A — Net et graphique"],
  ["B", "B — Détaillé"],
  ["C", "C — Lumière et matière"],
  ["M", "Mélange recommandé"],
] as const;

test("une planche par section", async ({ page }) => {
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
      for (const [v] of VARIANTES) images.push((await page.evaluate(([x, y, w, h]) => window.__vitrine!.capture(x, y, w, h), [s, v, W, H] as const))!);
      const titre = await page.evaluate((x) => document.querySelector(`#${x} h2`)!.textContent, s);
      const jpeg = await page.evaluate(
        async ([imgs, noms, w, h, t]) => {
          const pad = 6;
          const tete = 34;
          const c = document.createElement("canvas");
          c.width = imgs.length * (w + pad) + pad;
          c.height = h + tete + pad + 26;
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
            ctx.drawImage(im, pad + i * (w + pad), tete);
            ctx.font = "700 15px 'Archivo', sans-serif";
            ctx.fillStyle = i === imgs.length - 1 ? "#E8552D" : "#F4EFE6";
            ctx.fillText(noms[i]!, pad + i * (w + pad), tete + h + 19);
          }
          return c.toDataURL("image/jpeg", 0.84);
        },
        [images, VARIANTES.map(([, n]) => n), W, H, titre + (vue === "ensemble" ? " — vue d'ensemble" : "")] as const,
      );
      const nom = `${s}${vue === "ensemble" ? "-ensemble" : ""}.jpg`;
      writeFileSync(join(OUT, nom), Buffer.from(jpeg.split(",")[1]!, "base64"));
      console.info(nom);
    }
  }
});
