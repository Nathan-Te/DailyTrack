import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, type Page } from "@playwright/test";
import { CELL, THEMES, bestPilotRun, cellKey, createAutopilot, createRace, dailyCircuit, daysFromCivil, encodeReplay, formatDay, parseDay, stepRace, themeForDay, type Block, type PilotRun, type ThemeName, type Track } from "@cdj/sim";

// Captures du README du lot 37 (outil, pas un test) : `CAPTURES=1 LABEL=avant npx playwright test captures-lot37 --project=chromium`, puis
// `LABEL=apres …`, puis `PLANCHES=1 …` qui assemble une planche par thème (avant au-dessus, après dessous). Pour un circuit de chaque thème :
// le départ, le premier tremplin ou la première bosse, un virage serré, l'arrivée. `DAYS=ville=2026-10-16,…` choisit le jour de chaque thème
// (par défaut le premier jour à partir du 13/10/2026 qui a ce thème) ; `ONLY=ville,nuit` limite les thèmes ; `OUT=…` change le dossier.
test.skip(!process.env.CAPTURES, "outil de capture : CAPTURES=1");
test.skip(({ browserName }) => browserName !== "chromium", "rendu 3D : Chromium seulement");
test.setTimeout(3_600_000);

const OUT = process.env.OUT ?? join(import.meta.dirname, "../../../docs/lots/lot-37");
const LABEL = process.env.LABEL ?? "apres";
const NAMES = Object.keys(THEMES) as ThemeName[];
const ONLY = process.env.ONLY?.split(",");
// Jours choisis : pour chaque thème, le jour passé (6 → 22/10/2026) où le test de pose (decorPose.test.ts) trouvait le plus d'éléments en l'air sur `main` ;
// la Ville est celle du 16/10 (le retour de Nathan). Banquise et Campagne n'ont pas eu leur thème ces jours-là : le thème est imposé (`?theme=`).
const JOURS_PAR_DEFAUT = "stade=2026-10-08,rallye=2026-10-21,banquise=2026-10-10,nuit=2026-10-14,campagne=2026-10-14,canyon=2026-10-06,col=2026-10-12,ville=2026-10-16";
const FIXED = Object.fromEntries((process.env.DAYS ?? JOURS_PAR_DEFAUT).split(",").map((s) => s.split("=") as [string, string]));
const MOMENTS = ["depart", "tremplin", "virage", "arrivee"] as const;
const LEGENDES: Record<(typeof MOMENTS)[number], string> = { depart: "Départ", tremplin: "Premier tremplin ou bosse", virage: "Virage serré", arrivee: "Arrivée" };

/** Pas de la course du pilote où la voiture entre dans le bloc `block`, moins `lead` pas. */
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

function dayOf(name: ThemeName): number {
  if (FIXED[name]) return parseDay(FIXED[name]!) ?? daysFromCivil(2026, 10, 13);
  let day = daysFromCivil(2026, 10, 13);
  while (themeForDay(day).name !== name) day++;
  return day;
}

/** Les quatre moments d'un circuit, en pas de la course du pilote. */
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

async function shoot(page: Page, url: string, code: string, tick: number, file: string) {
  await page.goto(url);
  await page.waitForFunction(() => window.__cdj?.phase);
  await page.evaluate(() => window.__cdj.manual(true));
  await page.evaluate((c) => window.__cdj.autoplay(c), code);
  for (let guard = 0; guard < 900; guard++) {
    const at = await page.evaluate(() => (window.__cdj.phase === "racing" ? (window.__cdj.car as unknown as { tick: number }).tick : -1));
    if (at >= tick) break;
    await page.evaluate((n) => window.__cdj.advance(n), at < 0 ? 60 : Math.min(30, tick - at));
  }
  await page.keyboard.press("KeyP");
  await page.evaluate(() => window.__cdj.manual(false));
  await page.waitForTimeout(700);
  await page.evaluate(() => (document.getElementById("pause")!.style.visibility = "hidden"));
  writeFileSync(file, await page.screenshot({ type: "jpeg", quality: 82 }));
}

for (const name of NAMES) {
  test(`captures ${LABEL} : ${name}`, async ({ page }) => {
    test.skip(!!process.env.PLANCHES || (!!ONLY && !ONLY.includes(name)), "thème non demandé");
    const dir = join(OUT, LABEL);
    mkdirSync(dir, { recursive: true });
    await page.setViewportSize({ width: 960, height: 540 });
    const day = dayOf(name);
    const forced = themeForDay(day).name !== name;
    const c = dailyCircuit(day, 0, forced ? name : null);
    const run = bestPilotRun(c.track)!;
    const at = moments(c.track, run);
    for (const m of MOMENTS) await shoot(page, `/?debug&seed=${formatDay(day)}${forced ? `&theme=${name}` : ""}&quality=2&ghost=off&shake=0&fx=off&home=0`, encodeReplay(run.replay), at[m], join(dir, `${name}-${m}.jpg`));
    console.info(`${name} : ?seed=${formatDay(day)}${forced ? `&theme=${name}` : ""}&home=0`);
  });
}

test("planches avant / après", async ({ page }) => {
  test.skip(!process.env.PLANCHES, "PLANCHES=1 : assemble les planches à partir des dossiers avant/ et apres/");
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto("about:blank");
  for (const name of NAMES) {
    if (ONLY && !ONLY.includes(name)) continue;
    const rows = (["avant", "apres"] as const).map((label) => MOMENTS.map((m) => join(OUT, label, `${name}-${m}.jpg`)));
    if (rows.flat().some((f) => !existsSync(f))) continue;
    const imgs = rows.map((r) => r.map((f) => `data:image/jpeg;base64,${readFileSync(f).toString("base64")}`));
    const jpeg = await page.evaluate(
      async ([imgs, legendes, titre]) => {
        const w = 320;
        const h = 180;
        const pad = 6;
        const tete = 30;
        const legende = 22;
        const c = document.createElement("canvas");
        c.width = 4 * (w + pad) + pad + 70;
        c.height = tete + 2 * (h + legende + pad);
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = "#1E1B19";
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.fillStyle = "#F4EFE6";
        ctx.font = "italic 800 22px sans-serif";
        ctx.fillText(titre, pad, 22);
        for (let r = 0; r < 2; r++) {
          ctx.save();
          ctx.translate(18, tete + r * (h + legende + pad) + h / 2 + 24);
          ctx.rotate(-Math.PI / 2);
          ctx.font = "700 15px sans-serif";
          ctx.fillStyle = r === 0 ? "#F4EFE6" : "#E8552D";
          ctx.fillText(r === 0 ? "AVANT (main)" : "APRÈS", 0, 0);
          ctx.restore();
          for (let i = 0; i < 4; i++) {
            const im = new Image();
            im.src = imgs[r]![i]!;
            await im.decode();
            const x = 70 + pad + i * (w + pad);
            const y = tete + r * (h + legende + pad);
            ctx.drawImage(im, x, y, w, h);
            ctx.font = "600 13px sans-serif";
            ctx.fillStyle = "#F4EFE6";
            ctx.fillText(legendes[i]!, x, y + h + 16);
          }
        }
        return c.toDataURL("image/jpeg", 0.86);
      },
      [imgs, MOMENTS.map((m) => LEGENDES[m]), `${THEMES[name].label} — ${formatDay(dayOf(name))}`] as const,
    );
    writeFileSync(join(OUT, `planche-${name}.jpg`), Buffer.from(jpeg.split(",")[1]!, "base64"));
  }
});
