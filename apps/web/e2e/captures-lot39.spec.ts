import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { CELL, THEMES, bestPilotRun, cellKey, createAutopilot, createRace, dailyCircuit, daysFromCivil, encodeReplay, formatDay, parseDay, stepRace, themeForDay, type Block, type PilotRun, type ThemeName, type Track } from "@cdj/sim";

// Lot 39 (outil, pas un test de CI) : la scène du jeu passe par le socle par paliers, **à l'identique**. Cet outil prend, pour un circuit de chaque thème, le
// départ, le premier tremplin ou la première bosse, un virage serré et l'arrivée, plus l'accueil, le Salon et la miniature de chaque thème, puis compare
// l'« après » à l'« avant » (images de `main`, rangées dans `docs/lots/lot-39/avant/`).
//   CAPTURES=1 LABEL=avant npx playwright test captures-lot39 --project=chromium     → docs/lots/lot-39/avant/  (à faire sur `main`)
//   CAPTURES=1 LABEL=apres npx playwright test captures-lot39 --project=chromium     → docs/lots/lot-39/apres/
//   CAPTURES=1 COMPARER=1 npx playwright test captures-lot39 --project=chromium -g comparer   → écart image par image, seuil et raison
// Les jours sont ceux du lot 37 (le jour passé où `main` avait le plus d'éléments en l'air), thème imposé pour Banquise et Campagne.
test.skip(!process.env.CAPTURES, "outil de capture : CAPTURES=1");
test.skip(({ browserName }) => browserName !== "chromium", "rendu 3D : Chromium seulement");
test.setTimeout(3_600_000);

const OUT = process.env.OUT ?? join(import.meta.dirname, "../../../docs/lots/lot-39");
const LABEL = process.env.LABEL ?? "apres";
const NAMES = Object.keys(THEMES) as ThemeName[];
const ONLY = process.env.ONLY?.split(",");
const JOURS = "stade=2026-10-08,rallye=2026-10-21,banquise=2026-10-10,nuit=2026-10-14,campagne=2026-10-14,canyon=2026-10-06,col=2026-10-12,ville=2026-10-16";
const FIXED = Object.fromEntries(JOURS.split(",").map((s) => s.split("=") as [string, string]));
const MOMENTS = ["depart", "tremplin", "virage", "arrivee"] as const;
/** Seuil de la comparaison : part des pixels dont un canal change de plus de `SEUIL_CANAL` (sur 255). Voir `docs/lots/lot-39-socle-scene.md`. */
const SEUIL_CANAL = 8;
const SEUIL_PART = Number(process.env.SEUIL_PART ?? 0);

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
  await page.goto(url);
  await page.waitForFunction(() => window.__cdj?.phase);
  await page.evaluate(() => window.__cdj.manual(true));
  await page.evaluate((c) => window.__cdj.autoplay(c), code);
  for (let guard = 0; guard < 900; guard++) {
    const at = await page.evaluate(() => (window.__cdj.phase === "racing" ? (window.__cdj.car as unknown as { tick: number }).tick : -1));
    if (at >= tick) break;
    await page.evaluate((n) => window.__cdj.advance(n), at < 0 ? 60 : Math.min(30, tick - at));
  }
  // Pas de pause : la caméra n'avance qu'à l'image, et suspendue elle garde le décalage du dernier pas (un demi-pixel qui change d'un lancement à l'autre). En pas à
  // pas sans plus aucun pas, la voiture est immobile au pas voulu et la caméra converge en 700 ms : l'image est la même à chaque lancement.
  await page.waitForTimeout(700);
  writeFileSync(file, await jpeg(page));
}

for (const name of NAMES) {
  test(`captures ${LABEL} : ${name}`, async ({ page }) => {
    test.skip(!!process.env.COMPARER || (!!ONLY && !ONLY.includes(name)), "thème non demandé");
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
    await page.goto(`/?debug&seed=${formatDay(day)}${forced ? `&theme=${name}` : ""}&home=0&thumbs=off`);
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
  test.skip(!!process.env.COMPARER, "comparaison seule");
  const dir = join(OUT, LABEL);
  mkdirSync(dir, { recursive: true });
  await page.setViewportSize({ width: 640, height: 360 });
  // L'accueil : la scène du jour sous le cadre ; on ne garde que la scène (le cadre porte un compte à rebours).
  await page.addInitScript(() => localStorage.setItem("cdj:howto", "1"));
  await page.goto("/?debug&home=1&seed=2026-10-16&fx=off&ghost=off&shake=0&quality=2");
  await page.waitForFunction(() => window.__cdj?.phase);
  await page.evaluate(() => window.__cdj.manual(true));
  await page.addStyleTag({ content: SCENE_SEULE });
  await page.waitForTimeout(700);
  writeFileSync(join(dir, "accueil-ville.jpg"), await jpeg(page));
  // Le Salon (démo) : le circuit d'une session fixe, au départ, sans fantômes ni cadre.
  const session = Math.floor(1791549980000 / 600_000);
  await page.goto(`/?mode=salon&api=demo&debug&salonAt=${session * 600_000 + 300_000}&fx=off&shake=0&quality=2`);
  await page.waitForFunction(() => window.__cdj?.salon?.trackId, undefined, { timeout: 120_000 });
  await page.evaluate(() => window.__cdj.manual(true));
  await page.addStyleTag({ content: SCENE_SEULE });
  await page.waitForTimeout(900);
  writeFileSync(join(dir, "salon.jpg"), await jpeg(page));
});

/** Écart entre deux images JPEG décodées par le navigateur : part des pixels dont un canal diffère de plus de `SEUIL_CANAL`. */
async function ecart(page: Page, a: Buffer, b: Buffer): Promise<{ part: number; max: number }> {
  return page.evaluate(
    async ([x, y, seuil]) => {
      const charger = async (octets: number[]) => {
        const im = await createImageBitmap(new Blob([new Uint8Array(octets)]));
        const c = new OffscreenCanvas(im.width, im.height);
        const ctx = c.getContext("2d")!;
        ctx.drawImage(im, 0, 0);
        return ctx.getImageData(0, 0, im.width, im.height);
      };
      const A = await charger(x!);
      const B = await charger(y!);
      if (A.width !== B.width || A.height !== B.height) return { part: 1, max: 255 };
      let n = 0;
      let max = 0;
      for (let i = 0; i < A.data.length; i += 4) {
        let d = 0;
        for (let k = 0; k < 3; k++) d = Math.max(d, Math.abs(A.data[i + k]! - B.data[i + k]!));
        if (d > seuil!) n++;
        if (d > max) max = d;
      }
      return { part: n / (A.width * A.height), max };
    },
    [Array.from(a), Array.from(b), SEUIL_CANAL] as const,
  );
}

test("comparer l'après à l'avant", async ({ page }) => {
  test.skip(!process.env.COMPARER, "COMPARER=1 : compare apres/ à avant/");
  await page.goto("about:blank");
  const lignes: string[] = [];
  let pire = 0;
  for (const f of ["accueil-ville.jpg", "salon.jpg", ...NAMES.flatMap((n) => [...MOMENTS.map((m) => `${n}-${m}.jpg`), `${n}-miniature.png`])]) {
    const a = join(OUT, "avant", f);
    const b = join(OUT, "apres", f);
    if (!existsSync(a) || !existsSync(b)) {
      lignes.push(`${f} : image manquante`);
      pire = 1;
      continue;
    }
    const { part, max } = await ecart(page, readFileSync(a), readFileSync(b));
    lignes.push(`${f} : ${(part * 100).toFixed(3)} % des pixels (> ${SEUIL_CANAL}/255), écart max ${max}/255`);
    pire = Math.max(pire, part);
  }
  console.info(lignes.join("\n"));
  writeFileSync(join(OUT, "comparaison.txt"), `Seuil : ${SEUIL_PART * 100} % des pixels (canal > ${SEUIL_CANAL}/255)\n${lignes.join("\n")}\n`);
  expect(pire, "au moins une image diffère de l'avant au-delà du seuil").toBeLessThanOrEqual(SEUIL_PART);
});
