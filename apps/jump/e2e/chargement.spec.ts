import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { parseDay } from "@cdj/core";
import { dailyLevel } from "@cdj/jump-sim";
import { atInstant } from "./clock";
import { FROZEN_DATES, generatedDay, noonOf } from "./jours";
import { hasWebGL } from "./phone";

// Lot 7b : le niveau du jour se génère hors du fil principal (worker de module), derrière « Préparation du niveau… », et se relit du cache
// (preuve rejouée) au rechargement. Horloge maîtrisée par décalage de `Date` ; tout ce qui dépend du nombre de pas se lit en pas à pas.

/**
 * Ces tests ont besoin d'un niveau du jour **généré** (worker, fil principal, cache) : l'horloge est placée sur un jour sans fichier figé,
 * calculé à l'exécution (le lendemain du dernier jour figé de `public/levels/`), jamais sur une date écrite en dur — chaque mise en production
 * fige de nouveaux jours (`freeze:days -- demain`), et le 20/10/2026 (`FIXED_NOW`) l'est depuis le 20/10.
 */
const GENERATED = generatedDay();
const GENERATED_NOW = noonOf(GENERATED);

/** Version du générateur des niveaux du jour (identifiants `…-g<N>`), lue dans la référence de `jump-sim`. */
const GENERATOR = (JSON.parse(readFileSync(new URL("../../../packages/jump-sim/test/fixtures/daily-golden-v9.json", import.meta.url), "utf8")) as { jumpGeneratorVersion: number }).jumpGeneratorVersion;

interface Load {
  source: string;
  generated: boolean;
  catalog: string;
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
  await atInstant(browser, GENERATED_NOW, async (page) => {
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
    expect(d.id).toBe(`jour-${GENERATED}-g${GENERATOR}`);
    expect(FROZEN_DATES).not.toContain(GENERATED);
  });
});

test("?seed=…&solution finit toujours au temps de l'auteur, que le niveau vienne du worker ou du cache", async ({ browser }) => {
  await atInstant(browser, GENERATED_NOW, async (page) => {
    const url = `/?seed=${GENERATED}&solution&debug`;
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

// Lot 21 : le catalogue des morceaux et le générateur sont chargés à la demande. Un texte du catalogue embarqué et un message du générateur servent de
// marques : on lit le corps de **tout** JavaScript que la page (et son fil de travail) reçoit.
const CATALOGUE = "etiquettes: scie";
const GENERATEUR = "un tirage mieux estimé est valide";

/** Garde, pour chaque fichier JavaScript reçu (page et fil de travail), son adresse et s'il porte le catalogue ou le générateur. */
function surveillerJs(page: Page): { catalogue: string[]; generateur: string[]; recus: string[] } {
  const vu = { catalogue: [] as string[], generateur: [] as string[], recus: [] as string[] };
  page.context().on("response", async (r) => {
    if (!/\.js(\?|$)/.test(r.url())) return;
    vu.recus.push(r.url());
    const corps = await r.text().catch(() => "");
    if (corps.includes(CATALOGUE)) vu.catalogue.push(r.url());
    if (corps.includes(GENERATEUR)) vu.generateur.push(r.url());
  });
  return vu;
}
const overlay = (page: Page) => page.evaluate(() => document.getElementById("debug")!.textContent ?? "");

test("un jour figé : ni le catalogue ni le générateur ne sont reçus, et ?debug le dit", { tag: "@navigateurs" }, async ({ browser }) => {
  const frozen = FROZEN_DATES.at(-1)!;
  await atInstant(browser, noonOf(frozen), async (page) => {
    const vu = surveillerJs(page);
    await page.goto("/?debug&accueil=0");
    if (!(await hasWebGL(page))) {
      test.skip(true, SKIP);
      return;
    }
    await ready(page);
    const d = await daily(page);
    expect(d.load).toMatchObject({ source: "fige", generated: false, catalog: "non", cacheMiss: "" });
    expect(vu.recus.length, "du JavaScript a bien été reçu").toBeGreaterThan(3);
    expect(vu.catalogue, "le catalogue des morceaux n'est pas reçu").toEqual([]);
    expect(vu.generateur, "le générateur n'est pas reçu").toEqual([]);
    expect(vu.recus.filter((u) => /dailyWorker/.test(u)), "le fil de travail n'est pas demandé").toEqual([]);
    await expect.poll(() => overlay(page)).toContain("origine   fichier figé, catalogue non chargé");
  });
});

test("sans worker : le générateur est chargé à la demande sur le fil principal, même niveau ; ?debug le dit", async ({ browser }) => {
  await atInstant(browser, GENERATED_NOW, async (page) => {
    const vu = surveillerJs(page);
    await page.addInitScript(() => void delete (window as unknown as { Worker?: unknown }).Worker);
    await page.goto("/?debug&accueil=0");
    if (!(await hasWebGL(page))) {
      test.skip(true, SKIP);
      return;
    }
    await ready(page);
    const d = await daily(page);
    expect(d.load).toMatchObject({ source: "principal", generated: true, catalog: "principal" });
    expect(d.id).toBe(`jour-${GENERATED}-g${GENERATOR}`);
    expect(vu.catalogue.length).toBe(1);
    expect(vu.generateur.length).toBe(1);
    await expect.poll(() => overlay(page)).toContain("origine   généré (fil principal), catalogue chargé");
  });
});

test("le fichier figé n'arrive pas : le jeu génère le niveau (repli fiable), celui du générateur en vigueur", { tag: "@navigateurs" }, async ({ browser }) => {
  const frozen = FROZEN_DATES.at(-1)!;
  await atInstant(browser, noonOf(frozen), async (page) => {
    await page.route(/\/levels\/\d{4}-\d{2}-\d{2}\.json/, (route) => route.abort());
    await page.goto("/?debug&accueil=0");
    if (!(await hasWebGL(page))) {
      test.skip(true, SKIP);
      return;
    }
    await ready(page);
    const d = await daily(page);
    expect(d.load).toMatchObject({ source: "worker", generated: true, catalog: "worker", frozenMiss: "fichier absent" });
    // Le même niveau que celui du générateur appelé directement (un jour figé sous un ancien générateur, lui, garde le niveau de son fichier : ce n'est pas le cas ici).
    const direct = dailyLevel(parseDay(frozen)!);
    expect(d.id).toBe(direct.id);
    expect(d.hash).toBe(direct.hash);
    expect(d.authorTicks).toBe(direct.authorTicks);
  });
});
