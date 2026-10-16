import { expect, test, type Page } from "@playwright/test";
import { FIXED_NOW, atInstant } from "./clock";
import { hasWebGL } from "./phone";

// Lot 7b : le niveau du jour se génère hors du fil principal (worker de module), derrière « Préparation du niveau… », et se relit du cache
// (preuve rejouée) au rechargement. Horloge maîtrisée par décalage de `Date` ; tout ce qui dépend du nombre de pas se lit en pas à pas.

interface Load {
  source: string;
  generated: boolean;
  cacheMiss: string;
  totalMs: number;
  blockedMs: number;
}
interface Jump {
  phase: string;
  daily: { id: string; hash: string; authorTicks: number; load: Load } | null;
  attempt: { status: string; time: number; deaths: number };
  manual(on: boolean): void;
  advance(n: number): unknown;
  restart(): void;
}
const SKIP = "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire";
const daily = (page: Page) => page.evaluate(() => (window as unknown as { __jump: Jump }).__jump.daily!);
const ready = (page: Page) => page.waitForFunction(() => ["ready", "playing", "finished"].includes((window as unknown as { __jump?: { phase: string } }).__jump?.phase ?? ""));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retarde le script du worker : de quoi voir l'état de chargement (le chargement d'un worker n'a pas de durée fixe, on la fixe). */
async function slowWorker(page: Page, ms: number, seen: string[] = []): Promise<void> {
  await page.route(/dailyWorker/, async (route) => {
    seen.push(route.request().url());
    await sleep(ms);
    await route.continue();
  });
}

test("la page par défaut montre « Préparation du niveau… », puis le niveau du jour, généré par le worker", async ({ browser }) => {
  await atInstant(browser, FIXED_NOW, async (page) => {
    const seen: string[] = [];
    await slowWorker(page, 700, seen);
    await page.goto("/?debug&accueil=0", { waitUntil: "commit" });
    await expect(page.locator("#prep")).toHaveText("Préparation du niveau…");
    if (!(await hasWebGL(page))) {
      test.skip(true, SKIP);
      return;
    }
    await ready(page);
    await expect(page.locator("#prep")).toHaveCount(0);
    const d = await daily(page);
    expect(d.load).toMatchObject({ source: "worker", generated: true, cacheMiss: "" });
    expect(seen.length).toBeGreaterThanOrEqual(1);
    expect(d.id).toMatch(/^jour-2026-10-20-g4$/);
  });
});

test("au rechargement le niveau vient du cache : pas de worker, pas de nouvelle génération, même empreinte", async ({ browser }) => {
  await atInstant(browser, FIXED_NOW, async (page) => {
    const seen: string[] = [];
    await slowWorker(page, 0, seen);
    await page.goto("/?debug&accueil=0");
    if (!(await hasWebGL(page))) {
      test.skip(true, SKIP);
      return;
    }
    await ready(page);
    const first = await daily(page);
    expect(first.load.source).toBe("worker");
    expect(seen.length).toBe(1);

    await page.reload();
    await ready(page);
    const second = await daily(page);
    expect(second.load).toMatchObject({ source: "cache", generated: false });
    expect(second.hash).toBe(first.hash);
    expect(second.authorTicks).toBe(first.authorTicks);
    expect(seen.length).toBe(1); // le worker n'a pas été demandé une seconde fois
    expect(second.load.totalMs).toBeLessThan(first.load.totalMs + 1); // la relecture n'attend pas un worker
  });
});

test("un cache corrompu est écarté (la preuve ne se rejoue pas) : le niveau est régénéré, puis le cache redevient sain", async ({ browser }) => {
  await atInstant(browser, FIXED_NOW, async (page) => {
    await page.goto("/?debug&accueil=0");
    if (!(await hasWebGL(page))) {
      test.skip(true, SKIP);
      return;
    }
    await ready(page);
    const first = await daily(page);
    await page.evaluate((id) => {
      const key = `jump:niveau:${id}`;
      const entry = JSON.parse(localStorage.getItem(key)!);
      entry.payload.authorTicks += 1;
      localStorage.setItem(key, JSON.stringify(entry));
    }, first.id);
    await page.reload();
    await ready(page);
    const second = await daily(page);
    expect(second.load.source).toBe("worker");
    expect(second.load.cacheMiss).toBe("la preuve ne se rejoue pas");
    expect(second.hash).toBe(first.hash);
    await page.reload();
    await ready(page);
    expect((await daily(page)).load.source).toBe("cache");
  });
});

test("sans worker (indisponible) : repli sur le fil principal, même niveau qu'avec le worker", async ({ browser }) => {
  let hashViaWorker = "";
  await atInstant(browser, FIXED_NOW, async (page) => {
    await page.goto("/?debug&accueil=0");
    if (!(await hasWebGL(page))) {
      test.skip(true, SKIP);
      return;
    }
    await ready(page);
    hashViaWorker = (await daily(page)).hash;
  });
  await atInstant(browser, FIXED_NOW, async (page) => {
    await page.addInitScript(() => {
      delete (window as unknown as { Worker?: unknown }).Worker;
    });
    await page.goto("/?debug&accueil=0", { waitUntil: "commit" });
    await ready(page);
    const d = await daily(page);
    expect(d.load).toMatchObject({ source: "principal", generated: true });
    expect(d.hash).toBe(hashViaWorker);
    await expect(page.locator("#prep")).toHaveCount(0);
  });
});

test("stockage refusé : le jeu se charge quand même, par le worker, et rien n'est gardé", async ({ browser }) => {
  await atInstant(browser, FIXED_NOW, async (page) => {
    await page.addInitScript(() => {
      const refuse = () => {
        throw new Error("SecurityError");
      };
      Object.defineProperty(window, "localStorage", { get: refuse, configurable: true });
    });
    await page.goto("/?debug&accueil=0");
    if (!(await hasWebGL(page))) {
      test.skip(true, SKIP);
      return;
    }
    await ready(page);
    expect((await daily(page)).load).toMatchObject({ source: "worker", generated: true });
  });
});

test("?seed=…&solution finit toujours au temps de l'auteur, que le niveau vienne du worker ou du cache", async ({ browser }) => {
  await atInstant(browser, FIXED_NOW, async (page) => {
    const url = "/?seed=2026-11-03&solution&debug";
    for (const source of ["worker", "cache"]) {
      await page.goto(url);
      if (!(await hasWebGL(page))) {
        test.skip(true, SKIP);
        return;
      }
      await ready(page);
      const d = await daily(page);
      expect(d.load.source).toBe(source);
      await page.evaluate(() => {
        const j = (window as unknown as { __jump: Jump }).__jump;
        j.manual(true);
        j.restart();
      });
      const played = await page.evaluate((limit) => {
        const j = (window as unknown as { __jump: Jump }).__jump;
        for (let t = 1; t <= limit; t++) {
          j.advance(1);
          if (j.phase === "finished") return t;
        }
        return limit;
      }, d.authorTicks + 50);
      expect(played).toBe(d.authorTicks);
      const end = await page.evaluate(() => (window as unknown as { __jump: Jump }).__jump.attempt);
      expect(end).toMatchObject({ status: "arrivé", time: d.authorTicks, deaths: 0 });
    }
  });
});
