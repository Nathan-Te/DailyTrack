import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, type Page } from "@playwright/test";

// Captures du lot 42 (outil, pas un test) : `CAPTURES=1 [VOITURES=D,E,F,G,H,I] [LABEL=…] npx playwright test captures-lot42` (le `dist` habituel,
// construit avec la vitrine ; `-g quatre|detail|couleurs` pour une partie). Les images vont dans `docs/lots/lot-42-nouvelles-voitures/` (`OUT=…` pour ailleurs).
//   quatre   : chaque voiture sous quatre angles (trois quarts arrière, profil, avant, arrière), paliers 1 et 2.
//   detail   : quatre gros plans d'une voiture (`COL=D`, `PALIER=1|2`) : museau, poupe, flanc, roue avant.
//   couleurs : chaque voiture en deux couleurs (glycine, pétrole) au palier 2, trois quarts avant et arrière.
//   garage   : le Garage (ordinateur, téléphone), dix voitures et la couleur du motif.
//   poursuite: une voiture du lot en course (`VOITURE=<id du catalogue>`), Stade, Nuit, Canyon.
//   vues     : des angles au choix (`VUES`, `COL`, `PALIER`) ; `THEME=theme-nuit` (ou un autre thème de la vitrine) pour toutes.
test.skip(!process.env.CAPTURES, "outil de capture : CAPTURES=1");
test.setTimeout(900_000);

const LABEL = process.env.LABEL ? `${process.env.LABEL}-` : "";
const OUT = process.env.OUT ?? join(import.meta.dirname, "../../../docs/lots/lot-42-nouvelles-voitures");
mkdirSync(OUT, { recursive: true });
const VOITURES = (process.env.VOITURES ?? "D,E,F,G,H,I").split(",");
const THEME = process.env.THEME ?? "theme-stade";
const ecrire = (nom: string, url: string) => writeFileSync(join(OUT, `${LABEL}${nom}`), Buffer.from(url.split(",")[1]!, "base64"));

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

test("quatre : chaque voiture sous quatre angles, paliers 1 et 2", async ({ page }) => {
  await vitrine(page);
  for (const palier of (process.env.PALIER ? [Number(process.env.PALIER)] : [1, 2]) as (1 | 2)[]) {
    ecrire(
      `voitures-p${palier}.jpg`,
      await page.evaluate(
        async ([cols, p, angles, theme]) => {
          const m = (await window.__vitrine!.voiture())!;
          m.reglerTheme(theme);
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
        [VOITURES, palier, ANGLES, THEME] as const,
      ),
    );
  }
});

test("detail : une voiture de près", async ({ page }) => {
  await vitrine(page);
  const palier = Number(process.env.PALIER ?? 2) as 1 | 2;
  const col = process.env.COL ?? "D";
  ecrire(
    `detail-${col}-p${palier}.jpg`,
    await page.evaluate(
      async ([p, col, theme]) => {
        const m = (await window.__vitrine!.voiture())!;
        m.reglerTheme(theme);
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
      },
      [palier, col, THEME] as const,
    ),
  );
});

test("couleurs : chaque voiture en glycine et en pétrole, palier 2", async ({ page }) => {
  await vitrine(page);
  ecrire(
    "couleurs-p2.jpg",
    await page.evaluate(
      async ([cols, theme]) => {
        const m = (await window.__vitrine!.voiture())!;
        m.reglerTheme(theme);
        const w = 420;
        const h = 255;
        const toile = document.createElement("canvas");
        toile.width = 4 * w;
        toile.height = cols.length * h;
        const x = toile.getContext("2d")!;
        for (const [k, hex] of [0xc9a0dc, 0x2e86a6].entries()) {
          await m.choisirCouleur(hex);
          for (const [j, col] of cols.entries()) {
            for (const [i, [az, el, d]] of [
              [145, 14, 6.6],
              [35, 14, 6.5],
            ].entries()) {
              const img = new Image();
              img.src = await m.apercu(col, 2, az!, el!, d!, w, h);
              await img.decode();
              x.drawImage(img, (k * 2 + i) * w, j * h);
            }
          }
        }
        return toile.toDataURL("image/jpeg", 0.88);
      },
      [VOITURES, THEME] as const,
    ),
  );
});

// Réglage des formes (outil) : des vues au choix, `VUES="az,el,d[,cx,cy,cz];…"` (cible dans le repère de la voiture), `COL=D`, `PALIER=1|2`.
test("vues : une voiture sous des angles choisis", async ({ page }) => {
  await vitrine(page);
  const palier = Number(process.env.PALIER ?? 2) as 1 | 2;
  const col = process.env.COL ?? "D";
  const vues = (process.env.VUES ?? "35,14,6.5").split(";").map((v) => v.split(",").map(Number));
  ecrire(
    `vues-${col}-p${palier}.jpg`,
    await page.evaluate(
      async ([p, col, vues, theme]) => {
        const m = (await window.__vitrine!.voiture())!;
        m.reglerTheme(theme);
        const w = 800;
        const h = 500;
        const toile = document.createElement("canvas");
        toile.width = 2 * w;
        toile.height = Math.ceil(vues.length / 2) * h;
        const x = toile.getContext("2d")!;
        for (const [i, v] of vues.entries()) {
          const img = new Image();
          img.src = await m.apercu(col, p, v[0]!, v[1]!, v[2]!, w, h, v.length > 3 ? [v[3]!, v[4]!, v[5]!] : undefined);
          await img.decode();
          x.drawImage(img, (i % 2) * w, Math.floor(i / 2) * h);
        }
        return toile.toDataURL("image/jpeg", 0.9);
      },
      [palier, col, vues, THEME] as const,
    ),
  );
});

// Le Garage (ordinateur et téléphone) avec la Pelican (débloquée par le joueur de démonstration), les dix cartes et la couleur du motif ; puis
// la caisse lagon, où la teinte lagon est hachurée.
test("garage : dix voitures et la couleur du motif, ordinateur et téléphone", async ({ page }) => {
  for (const [nom, w, h] of [
    ["bureau", 1280, 720],
    ["telephone", 844, 390],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.addInitScript(() => localStorage.setItem("cdj:track:garage", JSON.stringify({ id: "fourgon", couleur: 0, motif: "course", teinteMotif: 0, debloquees: ["fourgon", "evolution"] })));
    await page.goto("/?api=demo&debug&home=1&quality=2");
    await page.waitForSelector("#splash", { state: "detached", timeout: 60_000 });
    await page.locator("#home-garage").click();
    await page.waitForFunction(() => document.querySelectorAll("#garage .garage-voiture__image[src^='data:image/png']").length >= 10, undefined, { timeout: 120_000 });
    await page.waitForFunction(() => window.__cdj.voiture.aJour, undefined, { timeout: 60_000 });
    await page.waitForTimeout(800);
    ecrire(`garage-${nom}.jpg`, `data:image/jpeg;base64,${(await page.screenshot({ type: "jpeg", quality: 88 })).toString("base64")}`);
    await page.locator('#garage [data-couleur="5"]').click();
    await page.locator("#garage .garage-teintes").scrollIntoViewIfNeeded();
    await page.waitForFunction(() => window.__cdj.voiture.aJour, undefined, { timeout: 60_000 });
    await page.waitForTimeout(800);
    ecrire(`garage-${nom}-teinte.jpg`, `data:image/jpeg;base64,${(await page.screenshot({ type: "jpeg", quality: 88 })).toString("base64")}`);
  }
});

// En jeu, en poursuite : `VOITURE=monoplace` (un identifiant du catalogue, par `?voiture=`) sur Stade, Nuit et Canyon.
test("poursuite : une voiture du lot en course, Stade, Nuit et Canyon", async ({ page }) => {
  const id = process.env.VOITURE ?? "monoplace";
  await page.setViewportSize({ width: 960, height: 540 });
  for (const theme of ["stade", "nuit", "canyon"]) {
    await page.goto(`/?debug&home=0&fx=off&shake=0&api=demo&theme=${theme}&today=2026-10-20&voiture=${id}&couleur=3`);
    await page.waitForFunction(() => window.__cdj?.phase, undefined, { timeout: 120_000 });
    await page.waitForFunction(() => window.__cdj.voiture.aJour, undefined, { timeout: 60_000 });
    await page.evaluate(() => window.__cdj.manual(true));
    await page.evaluate(async () => {
      for (let guard = 0; guard < 2000 && window.__cdj.phase !== "racing"; guard++) await window.__cdj.advance(1);
    });
    await page.keyboard.down("ArrowUp");
    for (let n = 200; n > 0; n -= 20) await page.evaluate((m) => window.__cdj.advance(m), Math.min(20, n));
    await page.keyboard.press("KeyP");
    await page.evaluate(() => window.__cdj.advance(0));
    await page.waitForFunction(() => window.__cdj.paused);
    await page.evaluate(() => window.__cdj.manual(false));
    await page.evaluate(() => (document.getElementById("pause")!.style.visibility = "hidden"));
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
    await page.waitForTimeout(500);
    ecrire(`poursuite-${id}-${theme}.jpg`, `data:image/jpeg;base64,${(await page.screenshot({ type: "jpeg", quality: 88 })).toString("base64")}`);
    await page.keyboard.up("ArrowUp");
  }
});
