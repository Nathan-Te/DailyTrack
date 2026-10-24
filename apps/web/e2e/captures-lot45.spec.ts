import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, type Page } from "@playwright/test";
import { CELL, THEMES, bestPilotRun, cellKey, createAutopilot, createRace, dailyCircuit, daysFromCivil, encodeReplay, formatDay, parseDay, stepRace, themeForDay, type Block, type PilotRun, type ThemeName, type Track } from "@cdj/sim";

// Lot 45 (outil, pas un test de CI) : les planches palier 1 / palier 2 — l'outil du lot 46 (lui-même celui des lots 43 et 39), rejoué sur **la même
// construction** : « p1 » = `?palier=1`, « p2 » = `?palier=2` (la finition seule : géométrie, variété, matière sobre, traces, reflets ciblés ; la vie et le ciel
// du téléphone sont sur les planches du lot 46). Pour un circuit de chaque thème : le départ, le premier tremplin ou la première bosse, un virage serré,
// l'arrivée et la miniature (inchangée : vue aérienne, palier 1) ; plus l'accueil et le Salon.
//   CAPTURES=1 LABEL=p1 npx playwright test captures-lot45 --project=chromium      → docs/lots/lot-45/p1/
//   CAPTURES=1 LABEL=p2 npx playwright test captures-lot45 --project=chromium      → docs/lots/lot-45/p2/
//   CAPTURES=1 PLANCHES=1 npx playwright test captures-lot45 --project=chromium -g planches   → planches/<thème>.jpg, planches/accueil-salon.jpg
test.skip(!process.env.CAPTURES, "outil de capture : CAPTURES=1");
test.skip(({ browserName }) => browserName !== "chromium", "rendu 3D : Chromium seulement");
test.setTimeout(3_600_000);

const OUT = process.env.OUT ?? join(import.meta.dirname, "../../../docs/lots/lot-45");
const BASE = process.env.BASE ?? "";
const LABEL = process.env.LABEL ?? "p2";
/** Ce que l'adresse ajoute : le palier 1 ou le palier 2 (`EXTRA` pour un autre essai). */
const EXTRA = process.env.EXTRA ?? (LABEL === "p1" ? "&palier=1" : "&palier=2");
const NAMES = Object.keys(THEMES) as ThemeName[];
const ONLY = process.env.ONLY?.split(",");
const JOURS = "stade=2026-10-08,rallye=2026-10-21,banquise=2026-10-10,nuit=2026-10-14,campagne=2026-10-14,canyon=2026-10-06,col=2026-10-12,ville=2026-10-16";
const FIXED = Object.fromEntries(JOURS.split(",").map((s) => s.split("=") as [string, string]));
const MOMENTS = ["depart", "tremplin", "virage", "arrivee"] as const;
const LEGENDES: Record<(typeof MOMENTS)[number] | "miniature", string> = { depart: "Départ", tremplin: "Premier tremplin ou bosse", virage: "Virage serré", arrivee: "Arrivée", miniature: "Miniature (inchangée : vue aérienne, palier 1)" };

function momentAtBlock(track: Track, run: PilotRun, block: number, lead: number): number {
  const race = createRace(track);
  const drive = createAutopilot(track, { grip: run.grip, wall: run.wall, cut: run.cut });
  for (let t = 0; t < run.ticks; t++) {
    stepRace(race, drive(race));
    const b = track.cells.get(cellKey(Math.floor(race.car.x / CELL), Math.floor(race.car.z / CELL)));
    if (b && b.index >= block) return Math.max(30, t - lead);
  }
  return Math.floor(run.ticks / 3);
}

const dayOf = (name: ThemeName): number => parseDay(FIXED[name]!) ?? daysFromCivil(2026, 10, 13);

function moments(track: Track, run: PilotRun): Record<(typeof MOMENTS)[number], number> {
  const first = (test: (b: Block) => boolean, from = 1) => track.blocks.find((b) => b.index >= from && test(b));
  const ramp = first((b) => b.kind === "kick" || b.kind === "jump" || b.kind === "bump") ?? first((b) => b.kind === "up" || b.kind === "down");
  const turn = first((b) => b.kind === "curveL" || b.kind === "curveR", 3) ?? first((b) => /^(wide|grand)/.test(b.kind), 3);
  const last = track.blocks.length - 1;
  return {
    depart: 30,
    tremplin: momentAtBlock(track, run, ramp ? ramp.index : 6, 150),
    virage: momentAtBlock(track, run, turn ? turn.index : 8, 100),
    arrivee: momentAtBlock(track, run, Math.max(1, last - 1), 0),
  };
}

const jpeg = (page: Page) => page.screenshot({ type: "jpeg", quality: 90 });
/** Cache tout ce qui n'est pas la scène (accueil, classement, bandeaux : horloges et listes qui bougent). */
const SCENE_SEULE = "body > *:not(canvas) { visibility: hidden !important; }";

async function enCourse(page: Page, url: string, code: string, tick: number, file: string) {
  await page.goto(BASE + url + EXTRA);
  await page.waitForFunction(() => window.__cdj?.phase);
  await page.evaluate(() => window.__cdj.manual(true));
  await page.evaluate((c) => window.__cdj.autoplay(c), code);
  for (let guard = 0; guard < 1200; guard++) {
    const at = await page.evaluate(() => (window.__cdj.phase === "racing" ? (window.__cdj.car as unknown as { tick: number }).tick : -1));
    if (at >= tick) break;
    // La dernière seconde par pas de 2 (une image à 60 i/s) : la caméra suit comme en jeu au lieu de traîner derrière des sauts de 30 pas.
    await page.evaluate((n) => window.__cdj.advance(n), at < 0 ? 60 : tick - at > 120 ? Math.min(30, tick - at - 120) : Math.min(2, tick - at));
  }
  // Lot 43 : **le pas à pas ne dessine pas la scène** (`main.ts` : « pas de rendu, seulement la simulation et l'interface ») — l'outil du lot 39, qui restait en pas à
  // pas, gardait l'image du décompte pour les quatre moments (l'interface, elle, avançait). Ici : pause au pas voulu (la simulation ne bouge plus), retour au rendu
  // normal, la scène seule (la pause et l'interface masquées) ; la caméra garde la place calculée au dernier pas.
  await page.keyboard.press("p");
  await page.waitForFunction(() => window.__cdj.paused);
  await page.evaluate(() => window.__cdj.manual(false));
  await page.addStyleTag({ content: SCENE_SEULE });
  await page.waitForTimeout(700);
  writeFileSync(file, await jpeg(page));
}

for (const name of NAMES) {
  test(`captures ${LABEL} : ${name}`, async ({ page }) => {
    test.skip(!!process.env.PLANCHES || (!!ONLY && !ONLY.includes(name)), "thème non demandé");
    const dir = join(OUT, LABEL);
    mkdirSync(dir, { recursive: true });
    await page.setViewportSize({ width: 640, height: 360 });
    const day = dayOf(name);
    const forced = themeForDay(day).name !== name;
    const c = dailyCircuit(day, 0, forced ? name : null);
    const run = bestPilotRun(c.track)!;
    const at = moments(c.track, run);
    const url = `/?debug&seed=${formatDay(day)}${forced ? `&theme=${name}` : ""}&quality=2&ghost=off&shake=0&fx=off&home=0`;
    for (const m of MOMENTS) await enCourse(page, url, encodeReplay(run.replay), at[m], join(dir, `${name}-${m}.jpg`));
    // La miniature aérienne du thème (vue inclinée, WebGL), telle que la rend `renderThumbnail` : octets du PNG.
    await page.goto(`${BASE}/?debug&seed=${formatDay(day)}${forced ? `&theme=${name}` : ""}&home=0&thumbs=off`);
    await page.waitForFunction(() => window.__cdj?.phase);
    const octets = await page.evaluate(
      async ([date, theme]) => {
        const r = await window.__cdj.thumbnail(date!, { theme: theme!, scale: 1 });
        return Array.from(new Uint8Array(await (await fetch(r.url)).arrayBuffer()));
      },
      [formatDay(day), forced ? name : ""] as const,
    );
    writeFileSync(join(dir, `${name}-miniature.png`), Buffer.from(octets));
    console.info(`${name} : ?seed=${formatDay(day)}${forced ? `&theme=${name}` : ""}&home=0`);
  });
}

test(`captures ${LABEL} : accueil et Salon`, async ({ page }) => {
  test.skip(!!process.env.PLANCHES, "comparaison ou planches seules");
  const dir = join(OUT, LABEL);
  mkdirSync(dir, { recursive: true });
  await page.setViewportSize({ width: 640, height: 360 });
  // L'accueil : la scène du jour sous le cadre ; on ne garde que la scène (le cadre porte un compte à rebours).
  await page.addInitScript(() => localStorage.setItem("cdj:howto", "1"));
  await page.goto(`${BASE}/?debug&home=1&seed=2026-10-16&fx=off&ghost=off&shake=0&quality=2${EXTRA}`);
  await page.waitForFunction(() => window.__cdj?.phase);
  // Pas de pas à pas ici (il ne dessine pas) : l'accueil gèle déjà la course, la scène tourne derrière à 30 images par seconde.
  await page.addStyleTag({ content: SCENE_SEULE });
  await page.waitForTimeout(1500);
  writeFileSync(join(dir, "accueil-ville.jpg"), await jpeg(page));
  // Le Salon (démo) : le circuit d'une session fixe, au départ, sans fantômes ni cadre.
  const session = Math.floor(1791549980000 / 600_000);
  await page.goto(`${BASE}/?mode=salon&api=demo&debug&salonAt=${session * 600_000 + 300_000}&fx=off&shake=0&quality=2${EXTRA}`);
  await page.waitForFunction(() => window.__cdj?.salon?.trackId, undefined, { timeout: 120_000 });
  await page.evaluate(() => window.__cdj.manual(true));
  await page.addStyleTag({ content: SCENE_SEULE });
  await page.waitForTimeout(900);
  writeFileSync(join(dir, "salon.jpg"), await jpeg(page));
});

/** Assemble une planche : une ligne par image (légende), deux colonnes (palier 1, palier 2). */
async function planche(page: Page, titre: string, lignes: { legende: string; avant: string; apres: string }[], sortie: string) {
  const data = (f: string) => `data:image/${f.endsWith(".png") ? "png" : "jpeg"};base64,${readFileSync(f).toString("base64")}`;
  const imgs = lignes.map((l) => ({ legende: l.legende, avant: data(l.avant), apres: data(l.apres) }));
  const octets = await page.evaluate(
    async ([imgs, titre]) => {
      const w = 480;
      const h = 270;
      const pad = 8;
      const tete = 44;
      const legende = 22;
      const canvas = document.createElement("canvas");
      canvas.width = pad * 3 + w * 2;
      canvas.height = tete + imgs!.length * (legende + h + pad) + pad;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ede3cf";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#2a1e16";
      ctx.font = "700 20px sans-serif";
      ctx.fillText(titre as string, pad, 28);
      ctx.font = "600 14px sans-serif";
      ctx.fillText("Palier 1 (Économie)", pad, tete - 2);
      ctx.fillText("Palier 2 : la finition (géométrie, variété, matière, traces, reflets)", pad * 2 + w, tete - 2);
      let y = tete;
      for (const l of imgs as { legende: string; avant: string; apres: string }[]) {
        ctx.fillStyle = "#2a1e16";
        ctx.font = "600 14px sans-serif";
        ctx.fillText(l.legende, pad, y + 16);
        y += legende;
        for (const [k, src] of [l.avant, l.apres].entries()) {
          const im = new Image();
          im.src = src;
          await im.decode();
          ctx.drawImage(im, pad + k * (w + pad), y, w, h);
        }
        y += h + pad;
      }
      const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), "image/jpeg", 0.86));
      return Array.from(new Uint8Array(await blob.arrayBuffer()));
    },
    [imgs, titre] as const,
  );
  writeFileSync(sortie, Buffer.from(octets));
}

test("planches palier 1 / palier 2", async ({ page }) => {
  test.skip(!process.env.PLANCHES, "PLANCHES=1 : assemble les planches à partir de p1/ et p2/");
  await page.goto("about:blank");
  const dir = join(OUT, "planches");
  mkdirSync(dir, { recursive: true });
  const f = (label: string, n: string) => join(OUT, label, n);
  for (const name of NAMES) {
    const images = [...MOMENTS.map((m) => [m, `${name}-${m}.jpg`] as const), ["miniature", `${name}-miniature.png`] as const];
    const lignes = images.filter(([, n]) => existsSync(f("p1", n)) && existsSync(f("p2", n))).map(([m, n]) => ({ legende: LEGENDES[m], avant: f("p1", n), apres: f("p2", n) }));
    if (lignes.length) await planche(page, `${THEMES[name].label ?? name} — ${FIXED[name]}`, lignes, join(dir, `${name}.jpg`));
  }
  const autres = [
    { legende: "Accueil (Ville, 16/10)", n: "accueil-ville.jpg" },
    { legende: "Salon (démo, une session fixe)", n: "salon.jpg" },
  ].filter((l) => existsSync(f("p1", l.n)) && existsSync(f("p2", l.n)));
  if (autres.length) await planche(page, "Accueil et Salon", autres.map((l) => ({ legende: l.legende, avant: f("p1", l.n), apres: f("p2", l.n) })), join(dir, "accueil-salon.jpg"));
});

// Le réglage « Qualité graphique » (Réglages › Graphismes), en français et en anglais, en paysage de téléphone : le choix Auto et la note du palier choisi.
//   CAPTURES=1 npx playwright test captures-lot45 --project=chromium -g réglage   → docs/lots/lot-45/reglage-fr.png, reglage-en.png
test("captures : le réglage « Qualité graphique », fr et en", async ({ browser }) => {
  test.skip(!!process.env.PLANCHES, "planches seules");
  mkdirSync(OUT, { recursive: true });
  for (const [langue, locale] of [["fr", "fr-FR"], ["en", "en-US"]] as const) {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, locale });
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem("cdj:howto", "1"));
    // Un téléphone qui tient le palier 2 (mesure imposée à 16 ms) : la note dit le palier choisi pour l'appareil.
    await page.goto(`${BASE}/?debug&fps=0&home=1&ghost=off&fx=off&quality=0&appareil=telephone&intervalles=16`);
    await page.waitForFunction(() => window.__cdj?.qualite?.memoire?.mediane === 16, undefined, { timeout: 120_000 });
    await page.locator("#home-settings").click();
    await page.locator("#settings").waitFor();
    await page.waitForTimeout(500);
    writeFileSync(join(OUT, `reglage-${langue}.png`), await page.screenshot({ type: "png" }));
    await context.close();
  }
});
