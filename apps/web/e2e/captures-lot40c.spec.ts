import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, type Page } from "@playwright/test";

// Captures du lot 40c (outil, pas un test) : `CAPTURES=1 LABEL=avant|apres [VOITURES=civile,A,B,C] npx playwright test captures-lot40c` (le `dist` habituel,
// construit avec la vitrine ; `-g sparrow|quatre|motifs|garage|poursuite` pour une partie). Les images vont dans `docs/lots/lot-40c-voitures-qualite/`
// (`OUT=…` pour ailleurs), le nom porte le label : `avant-…` et `apres-…`.
//   sparrow    : la Sparrow sous quatre angles et en gros plan (portière, avant, arrière, roue), paliers 1 et 2.
//   quatre     : les quatre voitures × quatre angles, paliers 1 et 2.
//   motifs     : la bibliothèque de motifs sur la Sparrow, dans trois couleurs.
//   garage     : le Garage (Sparrow, puis Weasel), sur ordinateur et sur téléphone.
//   poursuite  : la voiture en poursuite sur Stade, Nuit et Canyon.
test.skip(!process.env.CAPTURES, "outil de capture : CAPTURES=1");
test.setTimeout(900_000);

const LABEL = process.env.LABEL ?? "apres";
const OUT = process.env.OUT ?? join(import.meta.dirname, "../../../docs/lots/lot-40c-voitures-qualite");
mkdirSync(OUT, { recursive: true });
const VOITURES = (process.env.VOITURES ?? "civile,A,B,C").split(",");
const ecrire = (nom: string, url: string) => writeFileSync(join(OUT, `${LABEL}-${nom}`), Buffer.from(url.split(",")[1]!, "base64"));

async function vitrine(page: Page) {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/vitrine/?planche=voiture");
  await page.waitForFunction(() => window.__vitrine);
  await page.evaluate(() => window.__vitrine!.voiture());
}

const ANGLES: [number, number, number][] = [
  [35, 14, 6.5],
  [90, 6, 6.2],
  [180, 18, 6.5],
  [0, 14, 7],
];

test("sparrow : quatre angles et gros plans, paliers 1 et 2", async ({ page }) => {
  await vitrine(page);
  for (const palier of [1, 2] as const) {
    ecrire(
      `sparrow-p${palier}.jpg`,
      await page.evaluate(
        async ([p]) => {
          const m = (await window.__vitrine!.voiture())!;
          m.reglerTheme("theme-stade");
          // quatre angles (haut) et quatre gros plans (bas) : la portière et son numéro, le museau, la poupe, la roue avant
          type Cible = [number, number, number] | undefined;
          const vues: [number, number, number, Cible][] = [
            [35, 14, 6.5, undefined],
            [90, 6, 6.2, undefined],
            [180, 18, 6.5, undefined],
            [0, 14, 7, undefined],
            [90, 8, 3.4, [0, 0.8, 0.15]],
            [150, 10, 3.6, [0, 0.55, 1.8]],
            [25, 12, 3.6, [0, 0.8, -1.8]],
            [75, 4, 2.6, [-0.95, 0.38, 1.3]],
          ];
          const w = 560;
          const h = 340;
          const toile = document.createElement("canvas");
          toile.width = 4 * w;
          toile.height = 2 * h;
          const x = toile.getContext("2d")!;
          for (const [i, [az, el, d, vise]] of vues.entries()) {
            const img = new Image();
            img.src = await m.apercu("civile", p, az, el, d, w, h, vise);
            await img.decode();
            x.drawImage(img, (i % 4) * w, Math.floor(i / 4) * h);
          }
          return toile.toDataURL("image/jpeg", 0.9);
        },
        [palier] as const,
      ),
    );
  }
});

// Réglage des formes (outil) : quatre gros plans lisibles (1 800 × 1 120) ; `PALIER=1|2`.
test("detail : la Sparrow de près", async ({ page }) => {
  await vitrine(page);
  const palier = Number(process.env.PALIER ?? 2) as 1 | 2;
  const col = process.env.COL ?? "civile";
  ecrire(
    col === "civile" ? `detail-p${palier}.jpg` : `detail-${col}-p${palier}.jpg`,
    await page.evaluate(async ([p, col]) => {
      const m = (await window.__vitrine!.voiture())!;
      m.reglerTheme("theme-stade");
      const vues: [number, number, number, [number, number, number]][] = [
        [155, 12, 3.4, [0, 0.55, 1.6]],
        [28, 10, 3.4, [0, 0.8, -1.6]],
        [100, 7, 3.6, [0, 0.7, 0.2]],
        [60, 6, 2.8, [-0.9, 0.45, 1.3]],
      ];
      const w = 900;
      const h = 560;
      const toile = document.createElement("canvas");
      toile.width = 2 * w;
      toile.height = 2 * h;
      const x = toile.getContext("2d")!;
      for (const [i, [az, el, d, cible]] of vues.entries()) {
        const img = new Image();
        img.src = await m.apercu(col, p, az, el, d, w, h, cible);
        await img.decode();
        x.drawImage(img, (i % 2) * w, Math.floor(i / 2) * h);
      }
      return toile.toDataURL("image/jpeg", 0.9);
    }, [palier, col] as const),
  );
});

test("quatre : les quatre voitures sous quatre angles, paliers 1 et 2", async ({ page }) => {
  await vitrine(page);
  for (const palier of [1, 2] as const) {
    ecrire(
      `voitures-p${palier}.jpg`,
      await page.evaluate(
        async ([cols, p, angles]) => {
          const m = (await window.__vitrine!.voiture())!;
          m.reglerTheme("theme-stade");
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
        [VOITURES, palier, ANGLES] as const,
      ),
    );
  }
});

test("motifs : la bibliothèque sur la Sparrow, dans trois couleurs", async ({ page }) => {
  await vitrine(page);
  const COULEURS: [string, number][] = [
    ["orange", 0xe8552d],
    ["petrole", 0x2e86a6],
    ["glycine", 0xc9a0dc],
  ];
  for (const [nom, hex] of COULEURS) {
    const url = await page.evaluate(async (c) => {
      const m = (await window.__vitrine!.voiture())!;
      m.reglerTheme("theme-stade");
      const motifs = m.motifsDisponibles();
      await m.choisirCouleur(c);
      // Quatre colonnes de motifs, deux rangées de motifs ; chacun vu deux fois : de trois quarts arrière (flanc, hayon) et de trois quarts avant (capot, aile).
      const w = 480;
      const h = 300;
      const toile = document.createElement("canvas");
      toile.width = 4 * w;
      toile.height = 4 * h;
      const x = toile.getContext("2d")!;
      for (const [i, motif] of motifs.entries()) {
        await m.choisirMotif(motif);
        for (const [k, [az, el]] of ([[48, 16], [140, 22]] as const).entries()) {
          const img = new Image();
          img.src = await m.apercu("civile", 2, az, el, 5, w, h);
          await img.decode();
          x.drawImage(img, (i % 4) * w, (Math.floor(i / 4) * 2 + k) * h);
        }
      }
      await m.choisirMotif(motifs[0]!);
      return toile.toDataURL("image/jpeg", 0.9);
    }, hex);
    ecrire(`motifs-${nom}.jpg`, url);
  }
  await page.evaluate(async () => (await window.__vitrine!.voiture())!.choisirCouleur(0xe8552d));
});

test("garage : la Sparrow et la Weasel, ordinateur et téléphone", async ({ page }) => {
  for (const [nom, w, h] of [
    ["bureau", 1280, 720],
    ["telephone", 844, 390],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    for (const voiture of ["civile", "evolution"]) {
      await page.addInitScript((v) => localStorage.setItem("cdj:track:garage", JSON.stringify({ id: v, couleur: 0, motif: "bande", debloquees: ["evolution"] })), voiture);
      await page.goto("/?api=demo&debug&home=1&quality=2");
      await page.waitForSelector("#splash", { state: "detached", timeout: 60_000 });
      await page.locator("#home-garage").click();
      await page.waitForSelector("#garage .garage-voiture__image[src^='data:image/png']", { timeout: 60_000 });
      await page.waitForFunction(() => window.__cdj.voiture.aJour, undefined, { timeout: 60_000 });
      await page.waitForTimeout(800);
      writeFileSync(join(OUT, `${LABEL}-garage-${nom}-${voiture}.jpg`), await page.screenshot({ type: "jpeg", quality: 88 }));
    }
  }
});

test("poursuite : la voiture sur Stade, Nuit et Canyon", async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 540 });
  for (const theme of ["stade", "nuit", "canyon"]) {
    await page.goto(`/?debug&home=0&fx=off&shake=0&quality=2&api=demo&theme=${theme}&today=2026-10-20`);
    await page.waitForFunction(() => window.__cdj?.phase, undefined, { timeout: 120_000 });
    await page.waitForFunction(() => window.__cdj.voiture.aJour, undefined, { timeout: 60_000 });
    await page.evaluate(() => window.__cdj.manual(true));
    await page.evaluate(async () => {
      for (let guard = 0; guard < 2000 && window.__cdj.phase !== "racing"; guard++) await window.__cdj.advance(1);
    });
    await page.keyboard.down("ArrowUp");
    for (let n = 200; n > 0; n -= 20) await page.evaluate((m) => window.__cdj.advance(m), Math.min(20, n));
    await page.keyboard.down("ArrowLeft");
    for (let n = 12; n > 0; n -= 4) await page.evaluate((m) => window.__cdj.advance(m), Math.min(4, n));
    await page.keyboard.press("KeyP");
    await page.evaluate(() => window.__cdj.advance(0));
    await page.waitForFunction(() => window.__cdj.paused);
    await page.evaluate(() => window.__cdj.manual(false));
    await page.evaluate(() => (document.getElementById("pause")!.style.visibility = "hidden"));
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
    await page.waitForTimeout(500);
    writeFileSync(join(OUT, `${LABEL}-poursuite-${theme}.jpg`), await page.screenshot({ type: "jpeg", quality: 88 }));
    await page.keyboard.up("ArrowUp");
    await page.keyboard.up("ArrowLeft");
  }
});
