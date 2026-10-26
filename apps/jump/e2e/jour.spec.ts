import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { FIXED_NOW, PUBLISHED, TODAY, atInstant, servePublished, shiftDate } from "./clock";
import { Fingers, hasWebGL } from "./phone";
import { dayId } from "./jours";

// Lot 5 : le niveau du jour. Horloge maîtrisée par décalage de `Date` (`clock.ts`, jamais `page.clock.install`) ; tout résultat qui dépend
// du nombre de pas se lit en pas à pas (`manual` + `advance`).

/** Version du générateur des niveaux du jour (identifiants `…-g<N>`), lue dans la référence de `jump-sim`. */
const GENERATOR = (JSON.parse(readFileSync(new URL("../../../packages/jump-sim/test/fixtures/daily-golden-v5.json", import.meta.url), "utf8")) as { jumpGeneratorVersion: number }).jumpGeneratorVersion;
/** Lot 6 : entre deux morceaux, exactement un palier partagé de 2 colonnes (aucune colonne de raccord). */
const PALIER_LENGTH = 2;
/** Lot 16 : la zone de bifurcation devant une portion dure (`SLOW_ZONE_WIDTH` de jump-sim). */
const SLOW_ZONE_WIDTH = 6;

interface DailyDebug {
  date: string;
  number: number;
  id: string;
  today: string;
  mode: string;
  preview: boolean;
  refused: boolean;
  hash: string;
  pieces: { id: string; variant: number; col0: number; col1: number; start: number; end: number }[];
  /** Lot 16 : les voies lentes (morceau contourné). */
  slowRoutes: { piece: number }[];
  authorTicks: number;
  medals: { author: number; gold: number; silver: number; bronze: number };
  lastMedal: string | null;
  newDay: boolean;
  notice: string;
  line: string;
}
interface JumpDebug {
  phase: string;
  day: string;
  daily: DailyDebug | null;
  palette: string;
  watching: boolean;
  attempt: { status: string; time: number; deaths: number };
  player: { x: number; y: number; ground: boolean };
  touch: { bits: number };
  ticks: number;
  manual(on: boolean): void;
  advance(n: number): unknown;
  input(bits: number | null): void;
  restart(): void;
}
const jump = (page: Page) => page.evaluate(() => {
  const j = (window as unknown as { __jump: JumpDebug }).__jump;
  return { phase: j.phase, day: j.day, daily: j.daily, palette: j.palette, watching: j.watching, attempt: j.attempt, player: j.player, ticks: j.ticks };
});
const ready = (page: Page) => page.waitForFunction(() => ["ready", "playing", "finished"].includes((window as unknown as { __jump?: { phase: string } }).__jump?.phase ?? ""));

/** Ouvre une adresse ; faux sans WebGL (la scène ne se construit pas). */
async function open(page: Page, url: string): Promise<boolean> {
  await page.goto(url);
  if (!(await hasWebGL(page))) return false;
  await ready(page);
  return true;
}

/** Avance jusqu'à ce que la phase soit l'une de `phases` (au plus `max` pas) ; rend le nombre de pas joués (−1 si jamais). */
async function until(page: Page, phases: string[], max: number): Promise<number> {
  return page.evaluate(
    ([want, limit]) => {
      const j = (window as unknown as { __jump: JumpDebug }).__jump;
      for (let t = 1; t <= (limit as number); t++) {
        j.advance(1);
        if ((want as string[]).includes(j.phase)) return t;
      }
      return -1;
    },
    [phases, max] as const,
  );
}

const SKIP = "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire";

test("la page par défaut ouvre le niveau du jour (date de Paris, horloge décalée) : DailyJump #5, médaille visée", async ({ browser }) => {
  await atInstant(browser, FIXED_NOW, async (page) => {
    test.skip(!(await open(page, "/?debug&accueil=0")), SKIP);
    const j = await jump(page);
    expect(j.day).toBe(TODAY);
    expect(j.daily).toMatchObject({ date: TODAY, today: TODAY, number: 5, id: dayId(TODAY), mode: "jour", preview: true, refused: false });
    expect(j.daily!.pieces.length).toBeGreaterThanOrEqual(6);
    expect(j.daily!.authorTicks).toBeGreaterThanOrEqual(3000);
    expect(j.daily!.authorTicks).toBeLessThanOrEqual(4800);
    const line = page.locator("#dayline");
    await expect(line).toBeVisible();
    // Lot I5 : le titre du niveau au départ (« Jump n° 5 · thème »), l'objectif de médaille dans sa plaque en haut à droite (pas encore de temps :
    // le bronze), le titre de la page « Jump — Du Jour » (charte rév. 7).
    await expect(line).toContainText(/Jump n°\s5/);
    await expect(line).toContainText("aperçu"); // le serveur de test est local : un aperçu
    await expect(page.locator("#objectif")).toBeVisible();
    await expect(page.locator("#objectif")).toHaveAttribute("aria-label", /^Médaille visée : Bronze/);
    await expect(page).toHaveTitle("Jump — Du Jour");
    // Sans paramètre (et sans ?debug) : le même niveau, aucun accès de débogage.
    await page.goto("/");
    await expect(page.locator("#dayline")).toContainText(/Jump n°\s5/);
    expect(await page.evaluate(() => "__jump" in window)).toBe(false);
  });
});

test("trois dates ?seed= donnent trois niveaux différents, chacun avec son numéro et sa palette du jour", async ({ browser }) => {
  await atInstant(browser, FIXED_NOW, async (page) => {
    const seen: DailyDebug[] = [];
    for (const date of ["2026-10-17", "2026-10-20", "2026-11-02"]) {
      test.skip(!(await open(page, `/?seed=${date}&debug`)), SKIP);
      const j = await jump(page);
      expect(j.daily!.date).toBe(date);
      seen.push(j.daily!);
    }
    expect(seen.map((d) => d.number)).toEqual([2, 5, 18]);
    expect(seen.map((d) => d.mode)).toEqual(["archive", "jour", "futur"]); // le futur est ouvert : aperçu
    expect(new Set(seen.map((d) => d.hash)).size).toBe(3);
    expect(new Set(seen.map((d) => d.pieces.map((p) => `${p.id}:${p.variant}`).join(" "))).size).toBe(3);
    await expect(page.locator("#dayline")).toContainText("à venir");
  });
});

test("?seed=…&solution finit au temps de l'auteur, en pas à pas, avec la médaille « auteur »", async ({ browser }) => {
  await atInstant(browser, FIXED_NOW, async (page) => {
    test.skip(!(await open(page, "/?seed=2026-10-25&solution&debug")), SKIP);
    await page.evaluate(() => {
      const j = (window as unknown as { __jump: JumpDebug }).__jump;
      j.manual(true);
      j.restart(); // la lecture a pu démarrer pendant le chargement : on la relance, comme R
    });
    const start = await jump(page);
    expect(start.watching).toBe(true);
    expect(start.daily!.date).toBe("2026-10-25");
    // Raccords fluides (lot 6) : un palier partagé entre deux morceaux, et la solution suivante démarre au pas de sortie de la précédente.
    const pieces = start.daily!.pieces;
    for (let k = 1; k < pieces.length; k++) {
      // Lot 16 : devant une portion dure, la zone de bifurcation (cage et palier bis) s'ajoute au palier.
      const zoned = start.daily!.slowRoutes.some((r) => r.piece === k);
      expect(pieces[k]!.col0 - pieces[k - 1]!.col1 - 1).toBe(PALIER_LENGTH + (zoned ? SLOW_ZONE_WIDTH : 0));
      expect(pieces[k]!.start).toBe(pieces[k - 1]!.end);
    }
    const ticks = await until(page, ["finished"], 6000);
    expect(ticks).toBe(start.daily!.authorTicks);
    const end = await jump(page);
    expect(end.attempt).toMatchObject({ status: "arrivé", time: start.daily!.authorTicks, deaths: 0 });
    expect(end.daily!.lastMedal).toBe("author");
    await expect(page.locator("#finish")).toBeVisible();
    await expect(page.locator("#finish .title")).toHaveText("Rediffusion de l'auteur");
    await expect(page.locator("#finish .ref")).toContainText("Temps de l'auteur battu !"); // lot I5 : la phrase de la médaille du catalogue (arrivee.medaille.author)
    await expect(page.locator("#finish .ref")).toContainText("Temps de l'auteur");
    await expect(page.locator("#finish-next")).toBeHidden();
  });
});

test("site publié (chemin sans /b/) : une date future ouvre le niveau du jour, « Ce niveau n'est pas encore sorti », même avec ?debug&solution", async ({ browser }) => {
  await atInstant(browser, FIXED_NOW, async (page, context) => {
    await servePublished(context);
    test.skip(!(await open(page, `${PUBLISHED}?seed=2026-10-23&debug`)), SKIP);
    let j = await jump(page);
    expect(j.daily).toMatchObject({ date: TODAY, today: TODAY, preview: false, refused: true, mode: "jour", notice: "Ce niveau n'est pas encore sorti" });
    await expect(page.locator("#daynote")).toHaveText("Ce niveau n'est pas encore sorti");
    await expect(page.locator("#dayline")).not.toContainText("aperçu");
    // `&solution` ne lève pas le refus : c'est la rediffusion de l'auteur du jour qui se lit.
    expect(await open(page, `${PUBLISHED}?seed=2026-10-23&solution&debug`)).toBe(true);
    j = await jump(page);
    expect(j.daily).toMatchObject({ date: TODAY, refused: true });
    expect(j.watching).toBe(true);
    // Une date passée se joue en archive.
    expect(await open(page, `${PUBLISHED}?seed=2026-10-18&debug`)).toBe(true);
    j = await jump(page);
    expect(j.daily).toMatchObject({ date: "2026-10-18", mode: "archive", refused: false, preview: false, number: 3 });
    await expect(page.locator("#dayline")).toContainText("archive du dim. 18 oct.");
  });
});

test("passage de minuit : la partie continue, « Nouveau niveau disponible », puis le nouveau niveau à « recommencer »", async ({ browser }) => {
  test.setTimeout(90_000);
  // 23:59:57 à Paris le 20/10/2026 (UTC+2).
  await atInstant(browser, Date.parse("2026-10-20T21:59:57Z"), async (page) => {
    test.skip(!(await open(page, "/?debug&accueil=0")), SKIP);
    await page.evaluate(() => {
      const j = (window as unknown as { __jump: JumpDebug }).__jump;
      j.manual(true);
      j.input(2);
      // Lot 7 : 15 pas seulement (sur le palier de départ) : 60 pas droite tenue menaient dans le premier morceau, qui peut tuer un coureur.
      j.advance(15);
    });
    let j = await jump(page);
    expect(j.daily).toMatchObject({ date: "2026-10-20", newDay: false });
    expect(j.phase).toBe("playing");
    // L'horloge passe minuit (temps réel) : le jeu le voit au plus une seconde après.
    await page.waitForFunction(() => (window as unknown as { __jump: JumpDebug }).__jump.daily!.newDay, undefined, { timeout: 30_000 });
    await expect(page.locator("#daynote")).toContainText("Nouveau niveau disponible");
    // La partie en cours continue sur le niveau d'hier.
    const x = j.player.x;
    await page.evaluate(() => (window as unknown as { __jump: JumpDebug }).__jump.advance(15));
    j = await jump(page);
    expect(j.daily!.date).toBe("2026-10-20");
    expect(j.phase).toBe("playing");
    expect(j.player.x).toBeGreaterThan(x);
    // « Recommencer » (R) ouvre le niveau du nouveau jour.
    await Promise.all([page.waitForEvent("load"), page.keyboard.press("KeyR")]);
    await ready(page);
    j = await jump(page);
    expect(j.daily).toMatchObject({ date: "2026-10-21", today: "2026-10-21", number: 6, newDay: false });
    await expect(page.locator("#dayline")).toContainText(/Jump n°\s6/);
  });
});

test.describe("au doigt (téléphone en paysage)", () => {
  const VIEW = { width: 844, height: 390 };
  const at = { right: [VIEW.width * 0.37, VIEW.height * 0.75], jump: [VIEW.width * 0.75, VIEW.height * 0.75] } as const;

  test("un niveau du jour se joue au doigt : courir, sauter, la ligne du jour lisible, recommencer ; cibles d'au moins 44 px", async ({ browser }) => {
    test.setTimeout(90_000);
    const chromium = browser.browserType().name() === "chromium";
    const context = await browser.newContext({ viewport: VIEW, hasTouch: true, ...(chromium ? { isMobile: true, deviceScaleFactor: 2 } : {}) });
    try {
      await shiftDate(context, FIXED_NOW);
      const page = await context.newPage();
      test.skip(!(await open(page, `/?seed=${TODAY}&touch=1&debug`)), SKIP);
      await page.evaluate(() => (window as unknown as { __jump: JumpDebug }).__jump.manual(true));
      const start = (await jump(page)).player;
      // La ligne du jour (lot I5 : le titre du niveau, montré au départ seulement) : dans l'écran, sous la bande, sans toucher les boutons.
      await expect(page.locator("#dayline")).toBeVisible();
      const line = (await page.locator("#dayline").boundingBox())!;
      expect(line.x).toBeGreaterThanOrEqual(0);
      expect(line.x + line.width).toBeLessThanOrEqual(VIEW.width);
      for (const button of await page.locator("#hud-gauche button, .tbtn").all()) {
        if (!(await button.isVisible())) continue;
        const sel = (await button.getAttribute("id")) ?? (await button.getAttribute("class"))!;
        const b = (await button.boundingBox())!;
        expect(b.width, sel).toBeGreaterThanOrEqual(44);
        expect(b.height, sel).toBeGreaterThanOrEqual(44);
        const apart = line.x + line.width <= b.x || b.x + b.width <= line.x || line.y + line.height <= b.y || b.y + b.height <= line.y;
        expect(apart, `#dayline chevauche ${sel}`).toBe(true);
      }
      const fingers = await Fingers.on(page);
      await fingers.down(1, ...at.right);
      await page.waitForFunction(() => (window as unknown as { __jump: JumpDebug }).__jump.touch.bits === 2);
      await page.evaluate(() => (window as unknown as { __jump: JumpDebug }).__jump.advance(40));
      const ran = (await jump(page)).player;
      expect(ran.x).toBeGreaterThan(start.x + 2);
      // Saut tenu au second doigt : le personnage quitte le sol.
      await fingers.down(2, ...at.jump);
      await page.waitForFunction(() => (window as unknown as { __jump: JumpDebug }).__jump.touch.bits === 6);
      const airborne = await page.evaluate(() => {
        const j = (window as unknown as { __jump: JumpDebug }).__jump;
        for (let t = 0; t < 30; t++) {
          j.advance(1);
          if (!j.player.ground) return true;
        }
        return false;
      });
      expect(airborne).toBe(true);
      await fingers.up(2);
      await fingers.up(1);
      // Lot I5 : recommencer est une action de la pause (en haut à gauche), plus un bouton de la bande.
      await page.locator("#pausebtn").tap();
      await page.locator("#menu-restart").tap();
      await page.waitForFunction(() => (window as unknown as { __jump: JumpDebug }).__jump.ticks === 0);
      const back = await jump(page);
      expect(back.player.x).toBe(start.x);
      expect(back.phase).toBe("ready");
      expect(back.daily!.date).toBe(TODAY);
    } finally {
      await context.close();
    }
  });
});
