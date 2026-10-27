import { expect, test, type Page } from "@playwright/test";
import { formatDay, parseDay } from "@cdj/core";
import { demoAttempts, encodeReplay, jumpThemeForDay, replayAttempt, type DailyLevel } from "@cdj/jump-sim";
import { FIXED_NOW, atInstant } from "./clock";
import { generatedDay, pageLevel } from "./jours";
import { hasWebGL } from "./phone";

// Lot 17 — le carnage lisible. Pendant le carnage, ce qui suit l'horloge (scies mobiles, clignotants de la nuit, rafales de la forêt) est dessiné
// estompé (35 %) ; les dangers fixes, les blocs alternés, les zones de vent qui soufflent toujours et le décor ne changent pas ; hors carnage,
// tout est à pleine opacité. La page de test joue la rediffusion d'un essai fictif qui arrive (pas à pas), le carnage démarre à l'arrivée.
// On attend un **état** (`clockFade` posé par le dessin), jamais une durée.

const SKIP = "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire";
const FADE = 0.35;

interface Stats {
  clockFade: number;
  sawOpacity: number[];
}
interface J {
  phase: string;
  attempt: { status: string; time: number };
  theme: { stats: Stats | null };
  blocks: { blinkFace?: number; altFace?: number; clockFade?: number } | null;
  wind: { fade?: number[]; list: { gust: unknown }[] } | null;
  carnage: { state: { active: boolean }; skip(): void };
  manual(on: boolean): void;
  advance(n: number): unknown;
  input(bits: number | null): void;
  autoplay(code?: string): number;
}
const J = (page: Page) =>
  page.evaluate(() => {
    const j = (window as unknown as { __jump: J }).__jump;
    return { phase: j.phase, stats: j.theme.stats, blocks: j.blocks, wind: j.wind };
  });

/** Le premier jour généré (sans fichier figé) de ce thème dont le niveau a ce qu'on veut voir. */
function dayWhere(theme: string | null, has: (d: DailyLevel) => boolean): string {
  const first = parseDay(generatedDay())!;
  for (let day = first; day < first + 120; day++) {
    if (theme !== null && jumpThemeForDay(day) !== theme) continue;
    if (has(pageLevel(formatDay(day)))) return formatDay(day);
  }
  throw new Error(`aucun jour ${theme ?? ""} qui convienne`);
}

/** Un essai fictif du jour qui arrive. */
function arrivingRun(date: string): string {
  const d = pageLevel(date);
  for (const a of demoAttempts(d.level, d.replay, 0xa11, { attempts: 40 })) {
    if (a.end !== "arrivée") continue;
    const r = replayAttempt(d.level, a.replay, d.id);
    if (r.finished) return encodeReplay(a.replay);
  }
  throw new Error("aucun essai qui arrive");
}

/** Joue l'essai pas à pas jusqu'au carnage (qui commence à l'arrivée du héros). */
async function playToCarnage(page: Page, date: string): Promise<void> {
  // L'essai se calcule **avant** d'ouvrir la page : le jeu tourne en temps réel dès qu'il est prêt (« Prêt… » puis la course), et le temps passé
  // à chercher l'essai décalerait la rediffusion.
  const code = arrivingRun(date);
  await page.goto(`/?debug&accueil=0&seed=${date}`);
  test.skip(!(await hasWebGL(page)), SKIP);
  await page.waitForFunction(() => ["ready", "playing"].includes((window as unknown as { __jump?: J }).__jump?.phase ?? ""));
  const reached = await page.evaluate((c) => {
    const j = (window as unknown as { __jump: J }).__jump;
    j.manual(true);
    const n = j.autoplay(c);
    for (let t = 1; t <= n + 10; t++) {
      j.advance(1);
      if (j.phase === "carnage" || j.phase === "finished") return j.phase;
    }
    return `perdu : ${j.phase} ${j.attempt.status} ${j.attempt.time}/${n}`;
  }, code);
  expect(reached).toBe("carnage");
  // Une commande déjà tenue ne passe pas le carnage : on la relâche (un nouvel appui, plus tard, le passera).
  await page.evaluate(() => {
    const j = (window as unknown as { __jump: J }).__jump;
    j.input(0);
    j.advance(1);
    j.input(null);
  });
}

/** Une touche passe le carnage. */
async function skipCarnage(page: Page): Promise<void> {
  await page.evaluate(() => {
    const j = (window as unknown as { __jump: J }).__jump;
    j.input(2);
    j.advance(1);
    j.input(null);
  });
  await page.waitForFunction(() => (window as unknown as { __jump: J }).__jump.phase !== "carnage");
}

test("`?seed=<jour>&carnage=demo` : le carnage d'un niveau du jour sans le jouer (preuve de l'auteur en héros), dangers à horloge estompés", async ({ browser }) => {
  test.setTimeout(120_000);
  const date = dayWhere(null, (d) => d.level.saws.some((s) => s.cycle !== 0));
  await atInstant(browser, FIXED_NOW, async (page) => {
    await page.goto(`/?debug&seed=${date}&carnage=demo`);
    test.skip(!(await hasWebGL(page)), SKIP);
    await page.waitForFunction(() => (window as unknown as { __jump?: J }).__jump?.phase === "carnage");
    const during = await page.evaluate(() => {
      const j = (window as unknown as { __jump: J & { carnage: { state: { active: boolean; demo: boolean; lives: number } } } }).__jump;
      return { ...j.carnage.state, stats: j.theme.stats };
    });
    expect(during).toMatchObject({ active: true, demo: true });
    expect(during.lives).toBeGreaterThan(5);
    await page.waitForFunction(() => (window as unknown as { __jump: J }).__jump.theme.stats!.clockFade < 1);
    expect((await J(page)).stats!.sawOpacity.some((o) => o === FADE)).toBe(true);
    // Une commande passe le carnage : la partie reprend à pleine opacité (la démonstration ne laisse rien).
    await page.evaluate(() => (window as unknown as { __jump: J }).__jump.manual(true));
    await skipCarnage(page);
    await page.waitForFunction(() => (window as unknown as { __jump: J }).__jump.theme.stats!.clockFade === 1);
  });
});
