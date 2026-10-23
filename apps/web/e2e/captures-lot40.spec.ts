import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

// Captures de la partie 1 du lot 40 (outil, pas un test) : la voiture en six maillages doit donner **la même image** que celle du lot 9b.
//   1. construire le jeu d'avant (`main`) dans un dossier, et celui de la branche dans `dist` ;
//   2. servir les deux (`npx vite preview --outDir <avant> --port 4174` et le `dist` habituel sur 4173) ;
//   3. `CAPTURES=1 AVANT=http://localhost:4174 OUT=… npx playwright test captures-lot40`.
// Mêmes gestes, pas à pas (`__cdj.manual` + `advance` : aucune image ne dépend de l'heure), puis pause (le pas à pas ne dessine pas), effets coupés (`?fx=off` : particules tirées au
// hasard), qualité figée à 2 (ombres portées comprises). Pour chaque vue, l'image d'avant, celle d'après et le nombre de pixels qui diffèrent
// (comparés dans le navigateur, sans dépendance) ; le résumé est écrit dans `OUT/comparaison.json`.
test.skip(!process.env.CAPTURES, "outil de capture : CAPTURES=1");
test.setTimeout(900_000);

const OUT = process.env.OUT ?? join(import.meta.dirname, "../../../docs/lots/lot-40-vehicule");
const AVANT = process.env.AVANT ?? "http://localhost:4174";
const APRES = process.env.APRES ?? "http://localhost:4173";
mkdirSync(OUT, { recursive: true });

const ESSAI = JSON.parse(readFileSync(new URL("../../../packages/sim/test/fixtures/essai-autopilot.json", import.meta.url), "utf8")) as { code: string; finishMs: number; splits: number[]; simVersion: number };

interface Vue {
  nom: string;
  adresse: string;
  camera: "proche" | "capot";
  /** Fantôme du meilleur temps (cdj:best:essai). */
  fantome?: boolean;
  /** Touches tenues, et pendant combien de pas. */
  gestes: { touches: string[]; pas: number }[];
  /** Salon : attendre ce nombre de fantômes avant de partir. */
  fantomesSalon?: number;
}

// Le Salon en démonstration (lot 26) : une session fixe, ses fantômes (version simple, un maillage) partent avec le joueur.
const SESSION = 10 * 60_000;
const SALON_A = Math.floor(1791549980000 / SESSION) * SESSION + 420_000;

const VUES: Vue[] = [
  {
    nom: "poursuite",
    adresse: "/?debug&home=0&fx=off&shake=0&quality=2&theme=stade&today=2026-10-20",
    camera: "proche",
    gestes: [
      { touches: ["ArrowUp"], pas: 200 },
      { touches: ["ArrowUp", "ArrowLeft"], pas: 14 },
      { touches: ["ArrowDown", "ArrowLeft"], pas: 6 },
    ],
  },
  {
    nom: "poursuite-nuit",
    adresse: "/?debug&home=0&fx=off&shake=0&quality=2&theme=nuit&today=2026-10-20",
    camera: "proche",
    gestes: [
      { touches: ["ArrowUp"], pas: 160 },
      { touches: ["ArrowUp", "ArrowRight"], pas: 12 },
      { touches: ["ArrowDown", "ArrowRight"], pas: 6 },
    ],
  },
  {
    nom: "capot",
    adresse: "/?debug&home=0&fx=off&shake=0&quality=2&theme=stade&today=2026-10-20",
    camera: "capot",
    gestes: [
      { touches: ["ArrowUp"], pas: 160 },
      { touches: ["ArrowUp", "ArrowLeft"], pas: 12 },
    ],
  },
  {
    nom: "fantome",
    adresse: "/?debug&fx=off&shake=0&quality=2&scenario=essai",
    camera: "proche",
    fantome: true,
    // Le joueur reste sur la ligne, le fantôme part devant.
    gestes: [{ touches: [], pas: 330 }],
  },
  {
    nom: "fantomes-salon",
    adresse: `/?mode=salon&api=demo&debug&fx=off&shake=0&quality=2&salonMinutes=10&salonAt=${SALON_A}`,
    camera: "proche",
    fantomesSalon: 3,
    gestes: [{ touches: ["ArrowUp"], pas: 150 }],
  },
];

async function capturer(page: Page, base: string, v: Vue): Promise<Buffer> {
  await page.setViewportSize({ width: 960, height: 540 });
  await page.addInitScript(
    ({ camera, best }) => {
      localStorage.setItem("cdj:camera", camera);
      if (best) localStorage.setItem("cdj:best:essai", JSON.stringify(best));
    },
    { camera: v.camera, best: v.fantome ? { ms: ESSAI.finishMs, splits: ESSAI.splits, replay: ESSAI.code, simVersion: ESSAI.simVersion } : null },
  );
  await page.goto(base + v.adresse);
  await page.waitForFunction(() => window.__cdj?.phase, undefined, { timeout: 120_000 });
  if (v.fantomesSalon) await page.waitForFunction((n) => (window.__cdj.salon?.ghosts?.count ?? 0) >= n, v.fantomesSalon, { timeout: 180_000, polling: 500 });
  await page.evaluate(() => window.__cdj.manual(true));
  // Le décompte, puis la course.
  // (un pas à la fois : un `advance(30)` qui passe la fin du décompte ferait partir la course plus ou moins tôt d'un essai à l'autre)
  await page.evaluate(async () => {
    for (let guard = 0; guard < 2000 && window.__cdj.phase !== "racing"; guard++) await window.__cdj.advance(1);
  });
  for (const [i, g] of v.gestes.entries()) {
    for (const k of g.touches) await page.keyboard.down(k);
    for (let n = g.pas; n > 0; n -= 20) await page.evaluate((m) => window.__cdj.advance(m), Math.min(20, n));
    // Les touches du dernier geste restent tenues jusqu'à la capture (feux stop allumés, roues braquées).
    if (i < v.gestes.length - 1) for (const k of g.touches) await page.keyboard.up(k);
  }
  // Le pas à pas ne dessine pas : on met en pause (même état, plus aucun pas), on rend la main au rendu et on cache l'écran de pause.
  await page.keyboard.press("KeyP");
  await page.evaluate(() => window.__cdj.advance(0)); // une image sans pas : la pause y est prise
  await page.waitForFunction(() => window.__cdj.paused);
  await page.evaluate(() => window.__cdj.manual(false));
  await page.evaluate(() => (document.getElementById("pause")!.style.visibility = "hidden"));
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
  await page.waitForTimeout(500);
  return page.screenshot();
}

test("partie 1 : la voiture en six maillages, avant / après", async ({ browser }) => {
  const resume: Record<string, { pixels: number; differents: number; ecartMax: number }> = {};
  for (const v of VUES) {
    const images: Buffer[] = [];
    for (const base of [AVANT, APRES]) {
      const context = await browser.newContext();
      try {
        images.push(await capturer(await context.newPage(), base, v));
      } finally {
        await context.close();
      }
    }
    writeFileSync(join(OUT, `jeu-${v.nom}-avant.png`), images[0]!);
    writeFileSync(join(OUT, `jeu-${v.nom}-apres.png`), images[1]!);
    const context = await browser.newContext();
    const page = await context.newPage();
    resume[v.nom] = await page.evaluate(
      async ([a, b]) => {
        const lire = async (src: string) => {
          const img = new Image();
          img.src = src;
          await img.decode();
          const c = document.createElement("canvas");
          c.width = img.width;
          c.height = img.height;
          const x = c.getContext("2d", { willReadFrequently: true })!;
          x.drawImage(img, 0, 0);
          return x.getImageData(0, 0, c.width, c.height).data;
        };
        const [pa, pb] = await Promise.all([lire(a!), lire(b!)]);
        let differents = 0;
        let ecartMax = 0;
        for (let i = 0; i < pa.length; i += 4) {
          const e = Math.max(Math.abs(pa[i]! - pb[i]!), Math.abs(pa[i + 1]! - pb[i + 1]!), Math.abs(pa[i + 2]! - pb[i + 2]!));
          if (e > 0) differents++;
          ecartMax = Math.max(ecartMax, e);
        }
        return { pixels: pa.length / 4, differents, ecartMax };
      },
      images.map((b) => `data:image/png;base64,${b.toString("base64")}`),
    );
    await context.close();
    console.info(`${v.nom} : ${JSON.stringify(resume[v.nom])}`);
  }
  const fichier = join(OUT, "comparaison.json");
  const avant = existsSync(fichier) ? (JSON.parse(readFileSync(fichier, "utf8")) as Record<string, unknown>) : {};
  writeFileSync(fichier, JSON.stringify({ ...avant, ...resume }, null, 1));
});

// Partie 2 : les captures de la vitrine (planche « Voiture ») pour le README — `CAPTURES=1 npx playwright test captures-lot40 -g "partie 2"`
// (le `dist` habituel, construit avec la vitrine) : pour Stade, Nuit et Canyon, une planche (existant, A, B, C × paliers 1, 2, 3, puis les
// fantômes à 50 et 20 m) ; les trois modèles sous quatre angles ; la planche des couleurs (8 couleurs × 8 thèmes) de chaque modèle.
test("partie 2 : la planche « Voiture » de la vitrine", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(`${APRES}/vitrine/?planche=voiture`);
  await page.waitForFunction(() => window.__vitrine);
  await page.evaluate(() => window.__vitrine!.voiture());
  const ecrire = (nom: string, url: string) => writeFileSync(join(OUT, nom), Buffer.from(url.split(",")[1]!, "base64"));
  for (const theme of ["stade", "nuit", "canyon"]) ecrire(`vitrine-${theme}.jpg`, await page.evaluate(async (t) => (await window.__vitrine!.voiture())!.planche(`theme-${t}`, 400, 250), theme));
  // Les trois modèles au palier 2 (Stade) : trois quarts arrière, profil, avant, et la vue de la caméra de poursuite (dos, 6 m).
  ecrire(
    "modeles-angles.jpg",
    await page.evaluate(async () => {
      const m = (await window.__vitrine!.voiture())!;
      await m.toutDessiner("theme-stade");
      const angles: [number, number, number][] = [
        [35, 14, 6.5],
        [90, 6, 6.2],
        [180, 18, 6.5],
        [0, 14, 7],
      ];
      const w = 480;
      const h = 290;
      const toile = document.createElement("canvas");
      toile.width = angles.length * w;
      toile.height = 3 * h;
      const x = toile.getContext("2d")!;
      for (const [j, col] of (["A", "B", "C"] as const).entries()) {
        for (const [i, [az, el, d]] of angles.entries()) {
          const img = new Image();
          img.src = await m.apercu(col, 2, az, el, d, w, h);
          await img.decode();
          x.drawImage(img, i * w, j * h);
        }
      }
      return toile.toDataURL("image/jpeg", 0.88);
    }),
  );
  for (const col of ["A", "B", "C"] as const) ecrire(`couleurs-${col}.jpg`, await page.evaluate(async (c) => (await window.__vitrine!.voiture())!.planchesCouleurs(c, document.createElement("canvas")), col));
  expect(await page.evaluate(() => window.__vitrine!.erreurs)).toEqual([]);
});
