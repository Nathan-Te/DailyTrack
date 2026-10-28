import { randomBytes } from "node:crypto";
import { expect as baseExpect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { noteIdentityChange, writeIdentity, type ListableStore } from "@cdj/profile";
import { FIXED_NOW, TODAY, shiftDate } from "./clock";
import { honestRun } from "./jours";
import { hasWebGL } from "./phone";

// Lot P2 (plateforme) : le profil commun, sur **deux appareils** (deux contextes de navigateur, stockages séparés) contre le **vrai serveur** de la
// plateforme (SQLite en mémoire, port 8791 réservé à ce fichier : `playwright.config.ts`), comme `apps/web/e2e/profil.spec.ts` de DailyTrack :
//   1. l'appareil A finit le niveau du jour (une course fictive qui arrive, pas la preuve de l'auteur : lot R9, le serveur refuse les copies ; en pas à pas), choisit son pseudo : il est premier (pas de doublon de fantôme) ;
//   2. et 3. (lot I5 : plus de profil dans le jeu) son code est chargé sur l'appareil B **comme le fait le portail** (`/profil/`), puis B rouvre Jump ;
//   4. B retrouve l'historique et la série (fusion « le meilleur gagne »), le même pseudo, et l'identité de la plateforme que DailyTrack lit
//      (`cdj:player`, `cdj:name`, et `GET /api/me` de DailyTrack rend ce pseudo) ;
//   5. le code est changé (`POST /api/me/code`) : sur A, l'ancien est refusé (410), l'accueil le dit, rien n'est perdu sur A.
// Horloge maîtrisée (`clock.ts`, et la même pour le serveur : `TEST_CLOCK_OFFSET_MS`). Un essai relancé prend d'autres pseudos (même base en mémoire).

const SKIP = "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire";
const API = "http://127.0.0.1:8791";
const GAME = `debug&api=${encodeURIComponent(API)}`;
const expect = baseExpect.configure({ timeout: 30_000 });

interface J {
  phase: string;
  daily: { date: string; authorTicks: number } | null;
  history: { date: string; best: number | null; medal: string | null }[];
  streak: number;
  sync: { status: string; known: boolean | null; profile: { name: string | null; streak: number; medals: number; revoked: boolean }; message: string };
  rank: { state: { status: string } };
  firstGhost: { loaded: boolean; shown: boolean; mine: boolean; name: string | null };
  home: { ready: boolean };
  manual(on: boolean): void;
  advance(n: number): unknown;
  input(bits: number | null): void;
  autoplay(code?: string): number;
  setMenu(open: boolean): void;
}
const read = <K extends keyof J>(page: Page, key: K) => page.evaluate((k) => (window as unknown as { __jump: J }).__jump[k], key) as Promise<J[K]>;

async function device(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ viewport: { width: 1100, height: 700 } });
  await shiftDate(context, FIXED_NOW);
  await context.addInitScript(() => {
    const w = window as unknown as { __copied?: string };
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (t: string) => void (w.__copied = t) } });
  });
  return { context, page: await context.newPage() };
}

/** Ce que fait le portail dans le stockage du navigateur (même origine que les jeux) : `f` reçoit ce stockage, ses écritures y sont recopiées. */
async function auPortail(page: Page, f: (store: ListableStore) => void): Promise<void> {
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
  f(store);
  await page.evaluate(
    ([ecrites, retirees]) => {
      for (const k of retirees) localStorage.removeItem(k);
      for (const [k, v] of ecrites) localStorage.setItem(k, v);
    },
    [[...m], Object.keys(avant).filter((k) => !m.has(k))] as const,
  );
}

/** Met une page en sommeil (le jeu ne tourne ni ne dessine plus) : en rendu logiciel, une page qui dessine affame celle qu'on regarde. */
const sleep = (page: Page) => page.evaluate(() => (window as unknown as { __jump: J }).__jump.manual(true));

/** Lot R9 : joue `code` (une course qui n'est pas la preuve de l'auteur : le serveur refuse les copies) comme les commandes du joueur, en pas à pas. */
async function playRun(page: Page, code: string): Promise<void> {
  const ticks = await page.evaluate((c) => {
    const j = (window as unknown as { __jump: J }).__jump;
    j.manual(true);
    const n = j.autoplay(c);
    for (let t = 1; t <= n + 10; t++) {
      j.advance(1);
      if (j.phase === "carnage" || j.phase === "finished") return t;
    }
    return -1;
  }, code);
  expect(ticks).toBeGreaterThan(0);
  await page.evaluate(() => {
    const j = (window as unknown as { __jump: J }).__jump;
    j.input(0);
    j.advance(1);
    j.input(2);
    j.advance(1);
    j.input(null);
  });
  await expect(page.locator("#arrival")).toBeVisible();
}

test("deux appareils : finir → le code chargé sur l'autre (au portail) → historique, série et pseudo retrouvés (DailyTrack aussi) ; changer le code révoque l'ancien", async ({ browser }) => {
  test.setTimeout(240_000);
  const name = `Sauteur${test.info().retry}${test.info().project.name.length}`;
  const a = await device(browser);
  const b = await device(browser);
  try {
    // ——— 1. A finit le niveau du jour et choisit son pseudo : premier du classement (le fantôme du premier, c'est le sien) ———
    // Lot P4 : les requêtes d'une partie complète (chargement, arrivée, pseudo, envoi) sont relevées : la lecture du jour est regroupée.
    const sent: string[] = [];
    a.page.on("request", (r) => {
      if (r.url().startsWith(API)) sent.push(`${r.method()} ${new URL(r.url()).pathname.replace(TODAY, "<jour>")}`);
    });
    await a.page.goto(`/?${GAME}&accueil=0`);
    test.skip(!(await hasWebGL(a.page)), SKIP);
    await a.page.waitForFunction(() => ["ready", "playing"].includes((window as unknown as { __jump?: J }).__jump?.phase ?? ""));
    expect((await read(a.page, "daily"))!.date).toBe(TODAY);
    // Sans identité, rien n'est lu ni créé : pas de synchronisation.
    expect((await read(a.page, "sync")).status).toBe("idle");
    const run = honestRun(TODAY); // calculée avant : le jeu tourne en temps réel dès qu'il est prêt
    await playRun(a.page, run.code);
    await expect(a.page.locator("#arrival-rank")).toHaveText("Choisis ton pseudo pour entrer au classement");
    await a.page.locator("#arrival-name").fill(name);
    await a.page.locator("#arrival-name-ok").click();
    await expect(a.page.locator("#arrival-rank")).toHaveText(/^1er sur \d+$/);
    // Après l'envoi accepté, le profil est relu ; le premier relu à l'arrivée, c'est A : pas de doublon.
    await a.page.waitForFunction(() => (window as unknown as { __jump: J }).__jump.sync.status === "ok", undefined, { timeout: 30_000 });
    await a.page.waitForFunction(() => (window as unknown as { __jump: J }).__jump.firstGhost.mine === true, undefined, { timeout: 30_000 });
    expect(await read(a.page, "firstGhost")).toMatchObject({ loaded: true, shown: false, mine: true, name });
    await expect(a.page.locator("#arrival-first")).toBeHidden();
    // Lot P4 : une partie complète d'un joueur neuf = 5 requêtes — la lecture du jour au chargement (classement, premier, carte : une
    // seule), l'échantillon du carnage à l'arrivée, le pseudo, l'envoi (qui rend le classement), puis, le serveur le connaissant enfin, son
    // profil (avec le jour : une seule lecture). Rien n'est relu à l'arrivée (moins de 3 minutes) ni après l'envoi.
    // Lot I3 : une requête de plus, « Jeu suivant du jour » (`GET /api/portail/jour`, après l'envoi accepté) : 6 requêtes.
    // Lot N2 : une de plus, la lecture du message en direct quand l'écran d'arrivée s'affiche (`GET /api/annonce`, jamais pendant le niveau) : 7.
    expect(sent.sort()).toEqual(
      [
        "GET /api/jump/day/<jour>/bundle",
        "GET /api/jump/day/<jour>/carnage",
        "GET /api/name",
        "POST /api/jump/submit",
        "GET /api/jump/day/<jour>/bundle",
        "GET /api/portail/jour",
        "GET /api/annonce",
      ].sort(),
    );
    await expect(a.page.locator("#arrival-next-game")).toHaveText("Jeu suivant du jour : Track ›");
    const ticks = run.ticks;
    const idA = await a.page.evaluate(() => localStorage.getItem("cdj:player"));
    expect(idA).toMatch(/^[0-9a-f]{32}$/);

    // ——— 2 et 3. Lot I5 : plus de profil dans le jeu. Le code se copie et se charge **au portail** (`/profil/`) ; ce que fait le portail pour
    // « Charger un code » (`writeIdentity` puis `noteIdentityChange(…, "code")` de @cdj/profile, apps/portail/src/profil.ts) est rejoué ici dans le
    // stockage de B, puis B rouvre Jump : il suit le code chargé ailleurs (révision d'identité, lot P4) et se synchronise. ———
    await sleep(a.page);
    await b.page.goto(`/?${GAME}`);
    await b.page.waitForFunction(() => (window as unknown as { __jump?: J }).__jump?.home.ready === true);
    if (await b.page.locator("#help").isVisible()) await b.page.locator("#help-close").click();
    await expect(b.page.locator("#home-record .tuile__valeur")).toHaveText("Pas encore");
    await expect(b.page.locator("#home-streak .tuile__valeur")).toHaveText("0 jour");
    await auPortail(b.page, (store) => {
      writeIdentity({ id: idA!, name }, store);
      noteIdentityChange(store, "code");
    });
    await b.page.reload();
    await b.page.waitForFunction(() => (window as unknown as { __jump?: J }).__jump?.sync.status === "ok", undefined, { timeout: 60_000 });

    // ——— 4. Historique, série, pseudo retrouvés ; l'identité de la plateforme est celle que DailyTrack lit ———
    const history = await read(b.page, "history");
    expect(history).toEqual([expect.objectContaining({ date: TODAY, best: ticks, medal: run.medal })]);
    expect(await read(b.page, "streak")).toBe(1);
    await expect(b.page.locator("#home-streak .tuile__valeur")).toHaveText("1 jour");
    await expect(b.page.locator("#home-record .tuile__valeur")).toHaveText(/^\d+,\d{3}\u00a0s$/);
    expect(await b.page.evaluate(() => [localStorage.getItem("cdj:player"), localStorage.getItem("cdj:name")])).toEqual([idA, name]);
    // Le profil de DailyTrack (`GET /api/me`, la route de DailyTrack) rend le même pseudo pour cette identité.
    const track = await fetch(`${API}/api/me`, { headers: { "X-Player-Id": idA! } });
    expect(track.status).toBe(200);
    expect(((await track.json()) as { name: string }).name).toBe(name);
    await sleep(b.page);

    // ——— 5. Le code est changé (au portail ou dans un autre jeu : `POST /api/me/code`) : l'ancien ne vaut plus rien, A le dit à l'accueil ———
    const idB = randomBytes(16).toString("hex");
    const rotation = await fetch(`${API}/api/me/code`, { method: "POST", headers: { "X-Player-Id": idA!, "Content-Type": "application/json" }, body: JSON.stringify({ newId: idB }) });
    expect(rotation.status).toBe(200);
    expect((await fetch(`${API}/api/jump/me`, { headers: { "X-Player-Id": idA! } })).status).toBe(410);

    await a.page.goto(`/?${GAME}`);
    await a.page.waitForFunction(() => (window as unknown as { __jump?: J }).__jump?.sync.status === "revoked", undefined, { timeout: 60_000 });
    if (await a.page.locator("#help").isVisible()) await a.page.locator("#help-close").click();
    // L'accueil le dit (le message du catalogue commun, `erreur.code_revoked`) et mène au profil commun pour charger le nouveau code.
    await expect(a.page.locator("#home-revoked")).toHaveText("Ce code n'est plus valide : il a été remplacé. Charge ton nouveau code.");
    await expect(a.page.locator("#home-revoked")).toHaveAttribute("href", "../profil/?retour=%2F");
    // Rien de perdu sur A : son historique et son pseudo restent.
    expect(await read(a.page, "history")).toEqual([expect.objectContaining({ date: TODAY, best: ticks })]);
    expect(await a.page.evaluate(() => localStorage.getItem("cdj:name"))).toBe(name);
  } finally {
    await a.context.close();
    await b.context.close();
  }
});
