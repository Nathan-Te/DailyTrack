import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect as baseExpect, test, TODAY, type BrowserContext, type Page, newClockedContext } from "./fixtures";
import { dailyCircuit, encodeReplay, runPilot } from "@cdj/sim";
import { noteIdentityChange, writeIdentity, type ListableStore } from "@cdj/profile";

// Lot P4 (plateforme) : le scénario « deux appareils » du lot P2, **étendu à DailyTrack**. Un code chargé ailleurs (lot I5 : au portail, `/profil/`,
// puisque Jump n'a plus de profil dans le jeu) doit vider, sur cet
// appareil, le cache des records de DailyTrack de l'ancienne identité (le compteur de révision d'identité de `@cdj/profile` : DailyTrack le
// lit au démarrage et fait ce qu'il fait quand le code est chargé chez lui, `applyIdentity`). Sans changement d'identité : aucun effet.
//   1. l'appareil A joue DailyJump (la preuve de l'auteur, pas à pas) et choisit son pseudo : son code existe ;
//   2. l'appareil B joue DailyTrack sous sa propre identité : un record du jour, confirmé par le serveur ;
//   3. B charge le code d'A **comme le fait le portail** (`writeIdentity` + `noteIdentityChange(…, "code")`, même stockage), puis ouvre DailyJump, qui
//      le suit et se synchronise ;
//   4. B ouvre DailyTrack : le cache des records de son ancienne identité est vidé, le profil est celui d'A ;
//   5. B court sous ce profil, recharge DailyTrack : rien n'est plus vidé.
// Les deux jeux partagent le stockage parce qu'ils sont servis par la **même origine** (`/` et `/jump/`, comme sur GitHub Pages) : le serveur
// statique `e2e/deux-jeux.mjs` (port 4175) sert les deux jeux construits (la part DailyTrack de la CI construit les deux). Serveur de la
// plateforme réservé à ce fichier : port 8792 (`playwright.config.ts`). Le rendu 3D demande WebGL : Chromium seulement.
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(240_000);
const expect = baseExpect.configure({ timeout: 30_000 });

const API = "http://127.0.0.1:8792";
const SITE = "http://localhost:4175";
const TRACK_GAME = `debug&timescale=6&api=${encodeURIComponent(API)}`;
const JUMP_GAME = `debug&api=${encodeURIComponent(API)}`;
const JUMP_DIST = resolve("../jump/dist");
const circuit = dailyCircuit(TODAY);
const slowCode = encodeReplay(runPilot(circuit.track, { grip: 0.78 }).replay);

interface J {
  phase: string;
  sync: { status: string };
  home: { ready: boolean };
  manual(on: boolean): void;
  advance(n: number): unknown;
  input(bits: number | null): void;
  autoplay(code?: string): number;
}

async function device(browser: Parameters<typeof newClockedContext>[0]): Promise<{ context: BrowserContext; page: Page }> {
  if (!existsSync(join(JUMP_DIST, "index.html"))) throw new Error(`DailyJump n'est pas construit (${JUMP_DIST}) : npm run build construit les deux jeux`);
  const context = await newClockedContext(browser, { viewport: { width: 1100, height: 700 } });
  return { context, page: await context.newPage() };
}

/** DailyJump : la preuve de l'auteur jouée pas à pas jusqu'à l'écran d'arrivée. */
async function playJump(page: Page): Promise<void> {
  await page.evaluate(() => {
    const j = (window as unknown as { __jump: J }).__jump;
    j.manual(true);
    const n = j.autoplay();
    for (let t = 1; t <= n + 10 && j.phase !== "carnage" && j.phase !== "finished"; t++) j.advance(1);
    j.input(0);
    j.advance(1);
    j.input(2);
    j.advance(1);
    j.input(null);
  });
  await expect(page.locator("#arrival")).toBeVisible();
}

/** DailyTrack : une course du jour en accéléré (la rediffusion du pilote), jusqu'à l'arrivée. */
async function race(page: Page, code: string): Promise<void> {
  await page.waitForFunction(() => window.__cdj?.phase === "countdown" || window.__cdj?.phase === "racing");
  await page.evaluate((c) => window.__cdj.autoplay(c), code);
  await page.waitForFunction(() => window.__cdj.phase === "finished", undefined, { timeout: 90_000 });
}

/** « Charger un code » du portail (apps/portail/src/profil.ts) : `writeIdentity` puis `noteIdentityChange(…, "code")`, dans le stockage de la page. */
async function chargerCommeLePortail(page: Page, id: string, name: string): Promise<void> {
  const avant = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)!])));
  const m = new Map(Object.entries(avant));
  const store: ListableStore = {
    get length() {
      return m.size;
    },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
  writeIdentity({ id, name }, store);
  noteIdentityChange(store, "code");
  await page.evaluate(
    ([ecrites, retirees]) => {
      for (const k of retirees) localStorage.removeItem(k);
      for (const [k, v] of ecrites) localStorage.setItem(k, v);
    },
    [[...m], Object.keys(avant).filter((k) => !m.has(k))] as const,
  );
}

const storageOf = (page: Page, keys: string[]) => page.evaluate((ks) => Object.fromEntries(ks.map((k) => [k, localStorage.getItem(k)])), keys);

test("deux appareils jusqu'à DailyTrack : un code chargé dans DailyJump vide le cache des records de DailyTrack de l'ancienne identité ; sans changement, rien", async ({ browser }) => {
  const suffix = `${test.info().retry}${Date.now() % 1000}`;
  const nameA = `Sauteur${suffix}`;
  const nameB = `Pilote${suffix}`;
  const best = `cdj:best:${circuit.track.id}`;
  const sub = `cdj:sub:${circuit.track.id}`;

  // ——— 1. A joue DailyJump et choisit son pseudo ———
  const a = await device(browser);
  await a.page.goto(`${SITE}/jump/?${JUMP_GAME}&accueil=0`);
  await a.page.waitForFunction(() => ["ready", "playing"].includes((window as unknown as { __jump?: J }).__jump?.phase ?? ""));
  await playJump(a.page);
  await a.page.locator("#arrival-name").fill(nameA);
  await a.page.locator("#arrival-name-ok").click();
  // Classé (lot I5 : le rang au format du socle, « 1er », « 2e » ; un essai relancé partage la base en mémoire du premier : A peut y être 2e).
  await expect(a.page.locator("#arrival-rank")).toHaveText(/^(1er|\d+e) sur \d+$/);
  const idA = (await a.page.evaluate(() => localStorage.getItem("cdj:player")))!;
  expect(idA).toMatch(/^[0-9a-f]{32}$/);
  await a.context.close();

  // ——— 2. B joue DailyTrack sous sa propre identité : un record du jour, confirmé par le serveur ———
  const b = await device(browser);
  await b.page.goto(`${SITE}/?${TRACK_GAME}`);
  await race(b.page, slowCode);
  await b.page.locator("#finish .online input").fill(nameB);
  await b.page.locator("#finish .online button[type=submit]").click();
  await expect(b.page.locator("#finish .online .rank")).toHaveText(/sur/);
  const before = await storageOf(b.page, ["cdj:player", "cdj:name", best, sub, "cdj:identite:vue"]);
  expect(before["cdj:name"]).toBe(nameB);
  expect(before[best]).not.toBeNull();
  expect(Number(before[sub])).toBeGreaterThan(0); // confirmé par le serveur : il appartient à l'identité de B
  expect(before["cdj:identite:vue"]).not.toBeNull(); // DailyTrack note la révision vue dès sa première ouverture
  await b.page.evaluate(() => window.__cdj.manual(true));

  // ——— 3. B charge le code d'A ailleurs que dans DailyTrack (comme le portail), puis ouvre DailyJump, qui suit et se synchronise ———
  await chargerCommeLePortail(b.page, idA, nameA);
  await b.page.goto(`${SITE}/jump/?${JUMP_GAME}`);
  await b.page.waitForFunction(() => (window as unknown as { __jump?: J }).__jump?.sync.status === "ok", undefined, { timeout: 60_000 });
  // L'identité est écrite et la révision avancée (un code) ; le cache de DailyTrack, lui, n'a pas encore bougé.
  const inJump = await storageOf(b.page, ["cdj:player", "cdj:name", best, "cdj:identite:rev", "cdj:identite:code"]);
  expect([inJump["cdj:player"], inJump["cdj:name"]]).toEqual([idA, nameA]);
  expect(inJump[best]).not.toBeNull();
  expect(inJump["cdj:identite:code"]).toBe(inJump["cdj:identite:rev"]);

  // ——— 4. B ouvre DailyTrack : cache des records de l'ancienne identité vidé, nouveau profil ———
  await b.page.goto(`${SITE}/?${TRACK_GAME}`);
  await b.page.waitForFunction(() => window.__cdj?.phase === "countdown" || window.__cdj?.phase === "racing");
  const after = await storageOf(b.page, ["cdj:player", "cdj:name", best, sub, "cdj:identite:vue", "cdj:identite:rev"]);
  expect(after["cdj:player"]).toBe(idA);
  expect(after["cdj:name"]).toBe(nameA);
  expect(after[sub]).toBeNull(); // le temps confirmé de l'ancienne identité ne vaut rien pour la nouvelle
  expect(after[best]).toBeNull(); // record de B confirmé par le serveur : il partait avec son identité (A n'a jamais couru ici)
  expect(after["cdj:identite:vue"]).toBe(after["cdj:identite:rev"]);
  await b.page.waitForFunction(() => window.__cdj?.sync && !["idle", "syncing"].includes(window.__cdj.sync.status), undefined, { timeout: 60_000 });
  expect(await b.page.evaluate(() => window.__cdj.sync.status)).toBe("ok"); // le profil d'A, que le serveur connaît (DailyJump)

  // ——— 5. Sans changement d'identité : B court sous le profil d'A, recharge DailyTrack, rien n'est vidé ———
  await race(b.page, slowCode);
  await expect(b.page.locator("#finish .online .rank")).toHaveText(/sur/);
  const record = await storageOf(b.page, [best, sub]);
  expect(record[best]).not.toBeNull();
  await b.page.goto(`${SITE}/?${TRACK_GAME}`);
  await b.page.waitForFunction(() => window.__cdj?.phase === "countdown" || window.__cdj?.phase === "racing");
  expect(await storageOf(b.page, [best, sub, "cdj:player"])).toEqual({ ...record, "cdj:player": idA });
  await b.context.close();
});
