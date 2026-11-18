import { expect, test, type Browser, type Page, newClockedContext } from "./fixtures";
import { encodeReplay, salonTrackId } from "@cdj/sim";
import { choisirSessionJouable } from "../outils/salonSessionJouable";

// Le Salon avec le VRAI serveur local (lot 27) : l'API Node (celle du conteneur Docker, base SQLite en mémoire) tourne avec
// `SALON_MINUTES=3` (sessions de trois minutes, à heure fixe ; serveur réservé à ce test, port 8788). Deux « appareils » (deux contextes de navigateur isolés : chacun son identité)
// jouent chacun une course complète de la session, en accéléré (`timescale=6`, rediffusion d'un pilote à la place du clavier) ;
// chacun voit alors la ligne et le fantôme de l'autre, et la session suivante s'installe pour les deux au même moment.
// Rendu 3D : Chromium seulement.
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
const API = "http://127.0.0.1:8788";
const PODIUM_MS = 8_000; // classement final avant le changement de circuit (lot 33 ; `PODIUM_MS` de src/salon.ts)
const SESSION_MS = 180_000; // SALON_MINUTES=3 : de la marge pour deux courses complètes en rendu logiciel
// Lot R17 : le délai du test suit la session choisie (`test.setTimeout` dans le test) : du travail après le début de la session (deux courses et la bascule : ≈ 190 s mesurés,
// 420 s de marge), plus l'attente de ce début, mesurée sur l'horloge du serveur.
const TRAVAIL_MS = 420_000;
const url = `/?mode=salon&api=${encodeURIComponent(API)}&debug&timescale=6`;

async function device(browser: Browser, name: string): Promise<Page> {
  const context = await newClockedContext(browser, { viewport: { width: 1000, height: 560 } });
  const page = await context.newPage();
  await page.addInitScript((n) => localStorage.setItem("cdj:name", n), name);
  return page;
}

const loaded = (page: Page, id: string) => page.waitForFunction((t) => window.__cdj?.salon?.trackId === t, id, { timeout: 90_000 });

test("deux navigateurs, un vrai serveur : chacun classé, chacun voit l'autre, la bascule est commune", async ({ browser }) => {
  // On vise le début d'une session SUIVANTE : toute la course tient dans une session de trois minutes. Les rediffusions se calculent en attendant.
  // L'heure est celle du SERVEUR (`TEST_CLOCK`), jamais celle de la machine : on lui demande la session en cours.
  // Lot R17 : le circuit d'une session dépend de son numéro, donc de l'heure atteinte par l'horloge de test (des specs passés avant dans la part) ; tous n'ont pas deux pilotes
  // qui finissent (6 sur 200 : aucun). On prend la première des trois suivantes où l'on trouve un pilote rapide et un plus lent, avec des temps différents.
  const current = await (await fetch(`${API}/api/salon/now`)).json();
  const { jouable, sautees } = choisirSessionJouable(current.session);
  const { session, fast, slow } = jouable;
  const id = salonTrackId(session);
  const attente = session * SESSION_MS - current.serverMs; // jusqu'au début de la session choisie (heure du serveur)
  test.setTimeout(TRAVAIL_MS + Math.max(attente, 0));
  console.log(`session choisie : ${session} (courante + ${session - current.session}, ${sautees} sautée(s)), début dans ${Math.round(attente / 1000)} s`);
  const fastCode = encodeReplay(fast.replay);
  const slowCode = encodeReplay(slow.replay);

  // Le serveur est bien celui des sessions de trois minutes, et il compte les mêmes sessions que ce test.
  const health = await (await fetch(`${API}/api/health`)).json();
  expect(health.salonMinutes).toBe(3);
  expect(health.testClock).toBe(true);

  // Pseudos propres à chaque essai : depuis le lot 30 un pseudo appartient à son premier propriétaire, et la relance de CI retrouve le même serveur
  // (base en mémoire) où « Alice » appartient à l'identité du premier essai. Avec les mêmes pseudos, la relance était refusée (« déjà utilisé »),
  // jamais classée, et échouait sans rien dire de la cause du premier échec.
  const tag = test.info().retry ? String(test.info().retry + 1) : "";
  const ALICE = `Alice${tag}`;
  const BOB = `Bob${tag}`;
  const alice = await device(browser, ALICE);
  const bob = await device(browser, BOB);
  // Attendre le début de la session, mesuré sur l'horloge du serveur (une question toutes les secondes, aucune durée supposée).
  for (;;) {
    const { serverMs } = await (await fetch(`${API}/api/salon/now`)).json();
    if (serverMs >= session * SESSION_MS + 200) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  await Promise.all([alice.goto(url), bob.goto(url)]);
  await Promise.all([loaded(alice, id), loaded(bob, id)]);
  // Même horloge : celle du serveur (décalage mesuré), et la durée vient du serveur.
  expect(await alice.evaluate(() => window.__cdj.salon!.sessionMs)).toBe(SESSION_MS);
  expect(await alice.evaluate(() => window.__cdj.salon!.demo)).toBe(false);

  // --- Alice, puis Bob : chacun rejoue une course complète, le serveur la rejoue et répond avec SON temps ---
  const play = async (page: Page, code: string) => {
    await page.waitForFunction(() => window.__cdj.phase === "racing" || window.__cdj.phase === "countdown", undefined, { timeout: 30_000 });
    await page.evaluate((c) => window.__cdj.autoplay(c), code);
    await expect(page.locator("#finish .rank")).toContainText(/\d+(er|e) sur \d+/, { timeout: 120_000 });
  };
  await play(alice, fastCode);
  await play(bob, slowCode);
  expect(await alice.evaluate(() => window.__cdj.salon!.best)).toBe(fast.finishMs);
  expect(await bob.evaluate(() => window.__cdj.salon!.board!.me)).toMatchObject({ name: BOB, ms: slow.finishMs, rank: 2 });
  // Le serveur a rejoué les deux courses et retrouvé exactement les temps de la simulation.
  const direct = await (await fetch(`${API}/api/salon/${session}/board`)).json();
  expect(direct.rows.map((r: { name: string; ms: number }) => [r.name, r.ms])).toEqual([
    [ALICE, fast.finishMs],
    [BOB, slow.finishMs],
  ]);
  expect(direct.participants).toBe(2);
  expect(JSON.stringify(direct)).not.toMatch(/[0-9a-f]{32}/); // aucun identifiant secret dans le classement public

  // --- Chacun voit la ligne et le fantôme de l'autre (le classement se rafraîchit toutes les 5 s) ---
  await alice.waitForFunction((n) => window.__cdj.salon!.board!.rows.some((r) => r.name === n), BOB, { timeout: 30_000 });
  // Un nouveau départ : les fantômes (les autres et le tien) repartent avec la course.
  await Promise.all([alice.keyboard.press("Enter"), bob.keyboard.press("Enter")]);
  await alice.waitForFunction((n) => window.__cdj.salon!.ghosts!.names.includes(n), BOB, { timeout: 30_000 });
  await bob.waitForFunction((n) => window.__cdj.salon!.board!.rows.some((r) => r.name === n), ALICE, { timeout: 30_000 });
  await bob.waitForFunction((n) => window.__cdj.salon!.ghosts!.names.includes(n), ALICE, { timeout: 30_000 });
  for (const page of [alice, bob]) {
    const g = await page.evaluate(() => window.__cdj.salon!.ghosts!);
    expect(g.rejected).toBe(0);
    expect(g.names).toContain("Toi");
    await expect(page.locator("#board")).toContainText(page === alice ? BOB : ALICE);
  }
  // Les présents : le serveur compte les deux navigateurs.
  const now = await (await fetch(`${API}/api/salon/now`)).json();
  expect(now.session).toBe(session);
  expect(now.players).toBe(2);

  // --- La bascule de session se fait pour les deux au même moment : podium, puis le circuit suivant, le même pour tous ---
  // Mesurée DANS chaque page, sur l'horloge du Salon (celle du serveur, recalée par `/api/salon/now`) : chaque image note l'heure du Salon,
  // et l'on garde la première image qui montre la session suivante. Une mesure côté Node (heure de retour d'un `waitForFunction`) compte
  // aussi l'attente d'un fil principal occupé par le rendu logiciel — en CI, un simple `evaluate` sur la page d'Alice y a attendu 33 s, et
  // l'écart « mesuré » entre les deux pages (1,5 à 2,1 s) venait de là, pas de la bascule (Bob à fin + 0,28 s, Alice à fin + 2,4 s côté Node).
  const end = (session + 1) * SESSION_MS;
  const swapAt = end + PODIUM_MS; // lot 33 : le circuit change après le classement final
  type Switch = { before: number; after: number | null; podiumSeen: boolean };
  const watchSwitch = (page: Page) =>
    page.evaluate((s) => {
      const rec: Switch = { before: 0, after: null, podiumSeen: false };
      (window as unknown as { __switch: Switch }).__switch = rec;
      const sample = () => {
        const sal = window.__cdj.salon!;
        if (sal.session > s) rec.after = sal.now;
        else {
          if (sal.podiumVisible && sal.state === "podium") rec.podiumSeen = true; // classement final, sur l'ancien circuit (session inchangée)
          rec.before = sal.now;
          requestAnimationFrame(sample);
        }
      };
      requestAnimationFrame(sample);
    }, session);
  await Promise.all([watchSwitch(alice), watchSwitch(bob)]);
  const switched = async (page: Page) => {
    await page.waitForFunction(() => (window as unknown as { __switch: Switch }).__switch.after !== null, undefined, { timeout: 240_000 });
    const sw = await page.evaluate(() => (window as unknown as { __switch: Switch }).__switch);
    return { before: sw.before, after: sw.after!, frame: sw.after! - sw.before, podiumSeen: sw.podiumSeen };
  };
  const [sA, sB] = await Promise.all([switched(alice), switched(bob)]);
  console.log(
    `bascule (heure du Salon − fin − classement final) : ${ALICE} +${sA.after - swapAt} ms (image ${sA.frame} ms), ${BOB} +${sB.after - swapAt} ms (image ${sB.frame} ms) ; écart ${Math.abs(sA.after - sB.after)} ms`,
  );
  for (const sw of [sA, sB]) {
    expect(sw.before, "une image de l'ancienne session a été vue").toBeGreaterThan(0);
    // Jamais avant l'heure pile ; et pas plus tard qu'une image (même règle que salon.spec.ts, lot 31) : la bascule ne dépend que de l'heure.
    expect(sw.after, "bascule avant la fin du classement final").toBeGreaterThanOrEqual(swapAt - 50);
    expect(sw.podiumSeen, "le classement final a été vu sur l'ancien circuit").toBe(true);
    expect(sw.after - swapAt, "retard de la bascule").toBeLessThan(sw.frame + 600);
  }
  // Le même instant pour les deux (le circuit change à l'heure pile du serveur, lot 31, sans attendre personne) : à une image près.
  expect(Math.abs(sA.after - sB.after)).toBeLessThan(Math.max(sA.frame, sB.frame) + 600);
  const next = salonTrackId(session + 1);
  for (const page of [alice, bob]) {
    expect(await page.evaluate(() => window.__cdj.salon!.session)).toBe(session + 1);
    expect(await page.evaluate(() => window.__cdj.salon!.trackId)).toBe(next);
    expect(await page.evaluate(() => window.__cdj.salon!.stats.mainThreadGenerations)).toBe(0);
    await expect(page.locator("#podium")).toBeHidden(); // le classement final est fermé : le circuit suivant a pris la place
  }
  // Le classement de la nouvelle session repart de zéro ; celui de la précédente reste lisible (20 s) après la bascule.
  const fresh = await (await fetch(`${API}/api/salon/${session + 1}/board`)).json();
  expect(fresh.participants).toBe(0);
  const old = await (await fetch(`${API}/api/salon/${session}/board`)).json();
  expect(old.participants).toBe(2);
  for (const page of [alice, bob]) await page.waitForFunction(() => window.__cdj.salon!.state === "playing", undefined, { timeout: 30_000 });
});
