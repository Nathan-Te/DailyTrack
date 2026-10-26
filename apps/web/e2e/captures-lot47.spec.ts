import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, type Page } from "@playwright/test";
import { CELL, THEMES, bestPilotRun, cellKey, createAutopilot, createRace, dailyCircuit, daysFromCivil, encodeReplay, formatDay, parseDay, stepRace, themeForDay, type Block, type PilotRun, type ThemeName, type Track } from "@cdj/sim";

// Lot 47 (outil, pas un test de CI) : les planches « sans / avec » le post-traitement — l'outil du lot 46 rejoué sur la même construction, **sur ordinateur** (`?appareil=ordinateur`
// : le navigateur piloté de la CI part sinon du palier 1) : « sans » = `?reglages=3-post` (le palier 3 sans la chaîne), « avec » = `?palier=3` (halo, étalonnage, FXAA). Pour un circuit de chaque
// thème : le départ, le premier tremplin ou la première bosse, un virage serré, l'arrivée et la miniature (inchangée : vue aérienne, aucun pas) ; plus l'accueil et le Salon.
//   CAPTURES=1 LABEL=sans npx playwright test captures-lot47 --project=chromium      → docs/lots/lot-47/sans/
//   CAPTURES=1 LABEL=avec npx playwright test captures-lot47 --project=chromium      → docs/lots/lot-47/avec/
//   CAPTURES=1 PLANCHES=1 npx playwright test captures-lot47 --project=chromium -g planches   → planches/<thème>.jpg, planches/accueil-salon.jpg
// Lot 50 (avant / après la nouvelle chaîne) : OUT=docs/lots/lot-50 LABEL=sans EXTRA="&appareil=ordinateur&palier=3&chaine=47", LABEL=avec (la chaîne du lot 50), puis
//   PLANCHES=1 COLONNES="Avant : la chaîne du lot 47|Après : la chaîne du lot 50" (les titres des deux colonnes).
test.skip(!process.env.CAPTURES, "outil de capture : CAPTURES=1");
test.skip(({ browserName }) => browserName !== "chromium", "rendu 3D : Chromium seulement");
test.setTimeout(3_600_000);

const OUT = process.env.OUT ?? join(import.meta.dirname, "../../../docs/lots/lot-47");
const BASE = process.env.BASE ?? "";
const LABEL = process.env.LABEL ?? "avec";
/** Ce que l'adresse ajoute : le palier 3 sans la chaîne pour « sans », avec elle pour « avec » (un ordinateur imposé : la chaîne n'est que de l'ordinateur). */
const EXTRA = process.env.EXTRA ?? (LABEL === "sans" ? "&appareil=ordinateur&reglages=3-post" : "&appareil=ordinateur&palier=3");
const NAMES = Object.keys(THEMES) as ThemeName[];
/** Les titres des deux colonnes des planches (lot 50 : avant / après). */
const COLONNES = (process.env.COLONNES ?? "Sans : palier 3 sans post-traitement (?reglages=3-post)|Avec : palier 3 + halo, étalonnage, FXAA (ordinateur)").split("|");
const ONLY = process.env.ONLY?.split(",");
const JOURS = "stade=2026-10-08,rallye=2026-10-21,banquise=2026-10-10,nuit=2026-10-14,campagne=2026-10-14,canyon=2026-10-06,col=2026-10-12,ville=2026-10-16";
const FIXED = Object.fromEntries(JOURS.split(",").map((s) => s.split("=") as [string, string]));
const MOMENTS = ["depart", "tremplin", "virage", "arrivee"] as const;
const LEGENDES: Record<(typeof MOMENTS)[number] | "miniature", string> = { depart: "Départ", tremplin: "Premier tremplin ou bosse", virage: "Virage serré", arrivee: "Arrivée", miniature: "Miniature (inchangée : vue aérienne, aucune passe)" };

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

/** Assemble une planche : une ligne par image (légende), deux colonnes (sans, avec). */
async function planche(page: Page, titre: string, lignes: { legende: string; avant: string; apres: string }[], sortie: string) {
  const data = (f: string) => `data:image/${f.endsWith(".png") ? "png" : "jpeg"};base64,${readFileSync(f).toString("base64")}`;
  const imgs = lignes.map((l) => ({ legende: l.legende, avant: data(l.avant), apres: data(l.apres) }));
  const octets = await page.evaluate(
    async ([imgs, titre, colonnes]) => {
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
      ctx.fillText(colonnes![0]!, pad, tete - 2);
      ctx.fillText(colonnes![1]!, pad * 2 + w, tete - 2);
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
    [imgs, titre, COLONNES] as const,
  );
  writeFileSync(sortie, Buffer.from(octets));
}

test("planches sans / avec", async ({ page }) => {
  test.skip(!process.env.PLANCHES, "PLANCHES=1 : assemble les planches à partir de sans/ et avec/");
  await page.goto("about:blank");
  const dir = join(OUT, "planches");
  mkdirSync(dir, { recursive: true });
  const f = (label: string, n: string) => join(OUT, label, n);
  for (const name of NAMES) {
    const images = [...MOMENTS.map((m) => [m, `${name}-${m}.jpg`] as const), ["miniature", `${name}-miniature.png`] as const];
    const lignes = images.filter(([, n]) => existsSync(f("sans", n)) && existsSync(f("avec", n))).map(([m, n]) => ({ legende: LEGENDES[m], avant: f("sans", n), apres: f("avec", n) }));
    if (lignes.length) await planche(page, `${THEMES[name].label ?? name} — ${FIXED[name]}`, lignes, join(dir, `${name}.jpg`));
  }
  const autres = [
    { legende: "Accueil (Ville, 16/10)", n: "accueil-ville.jpg" },
    { legende: "Salon (démo, une session fixe)", n: "salon.jpg" },
  ].filter((l) => existsSync(f("sans", l.n)) && existsSync(f("avec", l.n)));
  if (autres.length) await planche(page, "Accueil et Salon", autres.map((l) => ({ legende: l.legende, avant: f("sans", l.n), apres: f("avec", l.n) })), join(dir, "accueil-salon.jpg"));
});
